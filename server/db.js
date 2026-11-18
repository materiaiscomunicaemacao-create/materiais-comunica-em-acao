import mysql from "mysql2/promise";
import { randomBytes, randomUUID } from "node:crypto";
import { products as catalogProducts, topics as catalogTopics } from "../catalog.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export const pool = mysql.createPool(databaseUrl);

const JSON_FIELDS = new Set(["topics", "years", "included", "contents", "objectives"]);
const PRODUCT_UPDATE_COLUMNS = {
  title: "title",
  description: "description",
  topics: "topics_json",
  stage: "stage",
  years: "years_json",
  level: "level",
  image: "image",
  priceCents: "price_cents",
  pages: "pages",
  format: "format",
  hasAnswerKey: "has_answer_key",
  included: "included_json",
  contents: "contents_json",
  objectives: "objectives_json",
  featured: "featured",
  commercialApproved: "commercial_approved",
  active: "active"
};

function parseJson(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value || Date.now()).toISOString();
}

function topicLabel(key) {
  return catalogTopics[key] || key;
}

export function deriveProductMetadata(source) {
  const topics = Array.isArray(source.topics) ? source.topics.map(String) : [];
  const included = Array.isArray(source.included) ? source.included.map(String) : [];
  const contents = Array.isArray(source.contents) && source.contents.length
    ? source.contents.map(String)
    : included.slice();
  const objectives = Array.isArray(source.objectives) && source.objectives.length
    ? source.objectives.map(String)
    : topics.map((key) => `Trabalhar ${topicLabel(key)} por meio das atividades do material.`);
  return { contents, objectives };
}

function mapProduct(row, { admin = false, storeEnabled = false, paymentPrepared = false } = {}) {
  if (!row) return null;
  const priceCents = row.price_cents === null || row.price_cents === undefined ? null : Number(row.price_cents);
  const active = Boolean(row.active);
  const commercialApproved = Boolean(row.commercial_approved);
  const fileReady = Boolean(row.storage_key);
  const sellable = active && priceCents !== null && priceCents > 0 && fileReady && commercialApproved && storeEnabled && paymentPrepared;
  const product = {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description || ""),
    topics: parseJson(row.topics_json),
    stage: String(row.stage || "todos"),
    years: parseJson(row.years_json),
    level: String(row.level || ""),
    image: String(row.image || ""),
    priceCents,
    pages: row.pages === null || row.pages === undefined ? null : Number(row.pages),
    format: String(row.format || "PDF digital"),
    hasAnswerKey: Boolean(row.has_answer_key),
    included: parseJson(row.included_json),
    contents: parseJson(row.contents_json),
    objectives: parseJson(row.objectives_json),
    featured: Boolean(row.featured),
    active,
    sellable,
    createdAt: iso(row.created_at)
  };
  if (admin) {
    product.commercialApproved = commercialApproved;
    product.fileReady = fileReady;
  }
  return product;
}

function mapOrder(row, itemRows = [], { includePrivate = false } = {}) {
  if (!row) return null;
  const status = String(row.status);
  const order = {
    id: String(row.id),
    status,
    createdAt: iso(row.created_at),
    totalCents: Number(row.total_cents),
    items: itemRows.map((item) => ({
      productId: String(item.product_id),
      title: String(item.title),
      priceCents: Number(item.price_cents),
      downloadAvailable: status === "paid"
    }))
  };
  if (includePrivate) {
    order.userId = Number(row.user_id);
    order.phone = row.phone || "";
    order.email = row.email || "";
    order.providerId = row.provider_id || null;
    order.currency = row.currency || "BRL";
    order.updatedAt = iso(row.updated_at);
  }
  return order;
}

async function getSettingsRow(connection = pool) {
  const [rows] = await connection.query("SELECT * FROM store_settings WHERE id = 1 LIMIT 1");
  return rows[0] || {
    brand_name: "Comunic@ Em Ação",
    whatsapp_number: "",
    contact_email: "",
    legal_name: "",
    tax_id: "",
    address: "",
    privacy_text: "Política de privacidade em revisão.",
    terms_text: "Termos de uso em revisão.",
    license_text: "Licenças e direitos dos materiais em revisão.",
    public_origin: "",
    payment_enabled: 0,
    whatsapp_automatic: 0
  };
}

export async function getStoreConfig() {
  const row = await getSettingsRow();
  const paymentPrepared = [process.env.MP_ACCESS_TOKEN, process.env.MP_WEBHOOK_SECRET]
    .every((value) => typeof value === "string" && value.trim().length > 0);
  const paymentEnabled = Boolean(row.payment_enabled);
  const missingSetup = [];
  if (!(await hasAdminUser())) missingSetup.push("conta administradora ainda não vinculada");
  if (!paymentPrepared) missingSetup.push("credenciais do provedor Pix");
  if (!paymentEnabled) missingSetup.push("checkout desabilitado");
  if (!row.legal_name || !row.tax_id) missingSetup.push("identificação legal da fornecedora");
  if (!row.whatsapp_number && !row.contact_email) missingSetup.push("canal de contato");
  return {
    brandName: String(row.brand_name || "Comunic@ Em Ação"),
    whatsappNumber: String(row.whatsapp_number || ""),
    contactEmail: String(row.contact_email || ""),
    legalName: String(row.legal_name || ""),
    taxId: String(row.tax_id || ""),
    address: String(row.address || ""),
    privacyText: String(row.privacy_text || ""),
    termsText: String(row.terms_text || ""),
    licenseText: String(row.license_text || ""),
    publicOrigin: String(row.public_origin || ""),
    paymentPrepared,
    paymentEnabled,
    whatsappAutomatic: Boolean(row.whatsapp_automatic),
    missingSetup: [...new Set(missingSetup)]
  };
}

async function productRows({ id = null, admin = false } = {}) {
  const where = id ? (admin ? "WHERE id = ?" : "WHERE id = ? AND active = 1") : (admin ? "" : "WHERE active = 1");
  const params = id ? [id] : [];
  const [rows] = await pool.query(`SELECT * FROM products ${where} ORDER BY created_at ASC, id ASC`, params);
  return rows;
}

export async function listProducts({ admin = false } = {}) {
  const [rows, config] = await Promise.all([productRows({ admin }), getStoreConfig()]);
  return rows.map((row) => mapProduct(row, {
    admin,
    storeEnabled: config.paymentEnabled,
    paymentPrepared: config.paymentPrepared
  }));
}

export async function getProduct(id, { admin = false } = {}) {
  const [rows, config] = await Promise.all([productRows({ id, admin }), getStoreConfig()]);
  return mapProduct(rows[0], {
    admin,
    storeEnabled: config.paymentEnabled,
    paymentPrepared: config.paymentPrepared
  });
}

export async function bestSellerIds() {
  const [rows] = await pool.query(
    `SELECT oi.product_id, SUM(oi.quantity) AS units
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'paid'
      GROUP BY oi.product_id
      ORDER BY units DESC, oi.product_id ASC
      LIMIT 6`
  );
  return rows.map((row) => String(row.product_id));
}

export async function getUserByOpenId(openId) {
  const [rows] = await pool.query("SELECT id, open_id, name, email, role FROM users WHERE open_id = ? LIMIT 1", [openId]);
  return rows[0] ? {
    id: Number(rows[0].id),
    openId: String(rows[0].open_id),
    name: String(rows[0].name || ""),
    email: String(rows[0].email || ""),
    role: String(rows[0].role || "user")
  } : null;
}

export async function getOrCreateUser({ openId, name = "", email = "" }) {
  await pool.query(
    `INSERT INTO users (open_id, name, email, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = IF(VALUES(name) <> '', VALUES(name), name),
       email = IF(VALUES(email) <> '', VALUES(email), email),
       updated_at = CURRENT_TIMESTAMP`,
    [openId, name, email, "user"]
  );
  return getUserByOpenId(openId);
}

export async function hasAdminUser() {
  const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  return rows.length > 0;
}

export async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const value = await callback(connection);
    await connection.commit();
    return value;
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original error */ }
    throw error;
  } finally {
    connection.release();
  }
}

function placeholders(count) {
  return Array.from({ length: count }, () => "?").join(",");
}

async function orderRows(connection, orderId, { lock = false } = {}) {
  const [orders] = await connection.query(`SELECT * FROM orders WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [orderId]);
  if (!orders[0]) return null;
  const [items] = await connection.query("SELECT product_id, title, price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC", [orderId]);
  return { row: orders[0], items };
}

export async function getOrderById(orderId, { includePrivate = false } = {}) {
  const record = await orderRows(pool, orderId);
  return record ? mapOrder(record.row, record.items, { includePrivate }) : null;
}

export async function getOrderForUser(orderId, userId) {
  const record = await orderRows(pool, orderId);
  if (!record || Number(record.row.user_id) !== Number(userId)) return null;
  return mapOrder(record.row, record.items);
}

export async function listOrdersForUser(userId) {
  const [rows] = await pool.query("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC", [userId]);
  const result = [];
  for (const row of rows) {
    const [items] = await pool.query("SELECT product_id, title, price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC", [row.id]);
    result.push(mapOrder(row, items));
  }
  return result;
}

export async function listAdminOrders() {
  const [rows] = await pool.query("SELECT * FROM orders ORDER BY created_at DESC, id DESC");
  const result = [];
  for (const row of rows) {
    const [items] = await pool.query("SELECT product_id, title, price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC", [row.id]);
    result.push(mapOrder(row, items, { includePrivate: true }));
  }
  return result;
}

export async function createPendingOrder({ userId, phone, email, productIds, idempotencyKey }) {
  return withTransaction(async (connection) => {
    const [existing] = await connection.query(
      "SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1 FOR UPDATE",
      [userId, idempotencyKey]
    );
    if (existing[0]) {
      const record = await orderRows(connection, existing[0].id, { lock: true });
      return { order: mapOrder(record.row, record.items, { includePrivate: true }), created: false };
    }

    const settings = await getSettingsRow(connection);
    if (!Boolean(settings.payment_enabled)) {
      const error = new Error("PAYMENT_NOT_CONFIGURED");
      error.code = "PAYMENT_NOT_CONFIGURED";
      throw error;
    }
    const uniqueIds = [...new Set(productIds)];
    const [rows] = await connection.query(
      `SELECT * FROM products WHERE id IN (${placeholders(uniqueIds.length)}) FOR UPDATE`,
      uniqueIds
    );
    if (rows.length !== uniqueIds.length) {
      const error = new Error("PRODUCT_UNAVAILABLE");
      error.code = "PRODUCT_UNAVAILABLE";
      throw error;
    }
    const config = await getStoreConfig();
    let totalCents = 0;
    for (const row of rows) {
      const priceCents = row.price_cents === null ? null : Number(row.price_cents);
      if (!row.active || !row.storage_key || !row.commercial_approved || !priceCents || priceCents <= 0 || !config.paymentPrepared) {
        const error = new Error("PRODUCT_NOT_SELLABLE");
        error.code = "PRODUCT_NOT_SELLABLE";
        throw error;
      }
      totalCents += priceCents;
    }
    const orderId = `ord_${randomBytes(12).toString("hex")}`;
    try {
      await connection.query(
        `INSERT INTO orders (id, user_id, phone, email, idempotency_key, status, total_cents, currency)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, 'BRL')`,
        [orderId, userId, phone, email, idempotencyKey, totalCents]
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const [raced] = await connection.query(
        "SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? LIMIT 1 FOR UPDATE",
        [userId, idempotencyKey]
      );
      if (!raced[0]) throw error;
      const record = await orderRows(connection, raced[0].id, { lock: true });
      return { order: mapOrder(record.row, record.items, { includePrivate: true }), created: false };
    }
    for (const row of rows) {
      await connection.query(
        "INSERT INTO order_items (order_id, product_id, title, price_cents, quantity) VALUES (?, ?, ?, ?, 1)",
        [orderId, row.id, row.title, Number(row.price_cents)]
      );
    }
    const record = await orderRows(connection, orderId);
    return { order: mapOrder(record.row, record.items, { includePrivate: true }), created: true };
  });
}

export async function savePaymentResult(orderId, payment) {
  return withTransaction(async (connection) => {
    const record = await orderRows(connection, orderId, { lock: true });
    if (!record) return null;
    if (record.row.provider_id && record.row.provider_id !== payment.providerId) return mapOrder(record.row, record.items, { includePrivate: true });
    await connection.query(
      `UPDATE orders SET provider_id = ?, pix_code = ?, pix_qr_base64 = ?, pix_ticket_url = ?, pix_expires_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND provider_id IS NULL`,
      [payment.providerId, payment.code || null, payment.qrBase64 || null, payment.ticketUrl || null, payment.expiresAt ? new Date(payment.expiresAt) : null, orderId]
    );
    const updated = await orderRows(connection, orderId);
    return mapOrder(updated.row, updated.items, { includePrivate: true });
  });
}

export async function markOrderFailed(orderId) {
  await pool.query("UPDATE orders SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'", [orderId]);
}

export async function paymentForOrder(orderId) {
  const [rows] = await pool.query("SELECT provider_id, pix_code, pix_qr_base64, pix_ticket_url, pix_expires_at FROM orders WHERE id = ? LIMIT 1", [orderId]);
  if (!rows[0] || !rows[0].provider_id) return null;
  return {
    providerId: String(rows[0].provider_id),
    code: rows[0].pix_code || null,
    qrBase64: rows[0].pix_qr_base64 || null,
    ticketUrl: rows[0].pix_ticket_url || null,
    expiresAt: rows[0].pix_expires_at ? iso(rows[0].pix_expires_at) : null
  };
}

const TRANSITIONS = {
  pending: new Set(["pending", "paid", "failed", "cancelled"]),
  paid: new Set(["paid", "refunded", "cancelled"]),
  failed: new Set(["failed", "pending", "paid"]),
  cancelled: new Set(["cancelled"]),
  refunded: new Set(["refunded"])
};

export async function recordProviderEvent({ provider, eventKey, providerId, externalReference, status, amountCents, currency }) {
  return withTransaction(async (connection) => {
    const [orderRowsFound] = await connection.query("SELECT * FROM orders WHERE id = ? LIMIT 1 FOR UPDATE", [externalReference]);
    const order = orderRowsFound[0];
    if (!order || order.provider_id !== providerId || Number(order.total_cents) !== Number(amountCents) || String(order.currency) !== currency) {
      const error = new Error("PAYMENT_REFERENCE_MISMATCH");
      error.code = "PAYMENT_REFERENCE_MISMATCH";
      throw error;
    }
    try {
      await connection.query(
        `INSERT INTO payment_events (provider, event_key, provider_id, order_id, status)
         VALUES (?, ?, ?, ?, ?)`,
        [provider, eventKey, providerId, externalReference, status]
      );
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY") return { duplicate: true, status: String(order.status) };
      throw error;
    }
    const current = String(order.status);
    const next = TRANSITIONS[current]?.has(status) ? status : current;
    if (next !== current) await connection.query("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [next, externalReference]);
    return { duplicate: false, status: next };
  });
}

export async function getProductPrivateFile(productId) {
  const [rows] = await pool.query("SELECT storage_key FROM products WHERE id = ? LIMIT 1", [productId]);
  return rows[0]?.storage_key || null;
}

export async function userHasPaidProduct(userId, productId) {
  const [rows] = await pool.query(
    `SELECT oi.id FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'paid' LIMIT 1`,
    [userId, productId]
  );
  return rows.length > 0;
}

export async function adminHasPaidProduct(productId) {
  const [rows] = await pool.query(
    `SELECT oi.id FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = ? AND o.status = 'paid' LIMIT 1`,
    [productId]
  );
  return rows.length > 0;
}

export async function insertProduct(input) {
  const id = `CEA-${randomBytes(5).toString("hex").toUpperCase()}`;
  const metadata = deriveProductMetadata(input);
  await pool.query(
    `INSERT INTO products
      (id, title, description, topics_json, stage, years_json, level, image, price_cents, pages, format,
       has_answer_key, included_json, contents_json, objectives_json, featured, active, commercial_approved, sellable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.title, input.description, JSON.stringify(input.topics), input.stage, JSON.stringify(input.years), input.level,
      input.image, input.priceCents, input.pages, input.format, input.hasAnswerKey, JSON.stringify(input.included),
      JSON.stringify(metadata.contents), JSON.stringify(metadata.objectives), input.featured ?? false, input.active ?? true, input.commercialApproved ?? false]
  );
  return getProduct(id, { admin: true });
}

export async function updateProduct(id, input) {
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(PRODUCT_UPDATE_COLUMNS)) {
    if (!(key in input)) continue;
    assignments.push(`${column} = ?`);
    const value = JSON_FIELDS.has(key) ? JSON.stringify(input[key]) : input[key];
    values.push(value);
  }
  if (input.topics && !Object.hasOwn(input, "contents") && !Object.hasOwn(input, "objectives")) {
    assignments.push("objectives_json = ?");
    values.push(JSON.stringify(deriveProductMetadata(input).objectives));
  }
  if (!assignments.length) return getProduct(id, { admin: true });
  assignments.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  await pool.query(`UPDATE products SET ${assignments.join(", ")} WHERE id = ?`, values);
  return getProduct(id, { admin: true });
}

export async function deactivateProduct(id) {
  const [result] = await pool.query("UPDATE products SET active = 0, sellable = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function setProductStorageKey(id, storageKey) {
  const [result] = await pool.query("UPDATE products SET storage_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [storageKey, id]);
  return result.affectedRows > 0;
}

export async function updateStoreSettings(input) {
  const columns = {
    brandName: "brand_name", whatsappNumber: "whatsapp_number", contactEmail: "contact_email", legalName: "legal_name",
    taxId: "tax_id", address: "address", privacyText: "privacy_text", termsText: "terms_text", licenseText: "license_text",
    publicOrigin: "public_origin", paymentEnabled: "payment_enabled"
  };
  const assignments = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (key in input) {
      assignments.push(`${column} = ?`);
      values.push(input[key]);
    }
  }
  if (assignments.length) {
    assignments.push("updated_at = CURRENT_TIMESTAMP");
    await pool.query(`UPDATE store_settings SET ${assignments.join(", ")} WHERE id = 1`, values);
  }
  return getStoreConfig();
}

export async function closePool() {
  await pool.end();
}

export function seedProductRow(source) {
  const metadata = deriveProductMetadata(source);
  return {
    id: source.id,
    title: source.title,
    description: source.description || "",
    topics: source.topics || [],
    stage: source.stage || "todos",
    years: source.years || [],
    level: source.level || "",
    image: source.image || "",
    priceCents: null,
    pages: source.pages ?? null,
    format: source.format || "PDF digital",
    hasAnswerKey: Boolean(source.hasAnswerKey),
    included: source.included || [],
    contents: metadata.contents,
    objectives: metadata.objectives,
    featured: Boolean(source.featured),
    active: true,
    commercialApproved: false,
    storageKey: null
  };
}

export const catalogSeed = catalogProducts.map(seedProductRow);
export { mapProduct, mapOrder };

// Kept for focused unit tests; production code uses the same transition table.
export const allowedPaymentTransitions = TRANSITIONS;
