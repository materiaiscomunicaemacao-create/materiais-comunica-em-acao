import express from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  bestSellerIds,
  createPendingOrder,
  deactivateProduct,
  getOrderForUser,
  getProduct,
  getProductPrivateFile,
  getStoreConfig,
  listAdminOrders,
  listOrdersForUser,
  listProducts,
  paymentForOrder,
  recordProviderEvent,
  savePaymentResult,
  insertProduct,
  setProductStorageKey,
  updateProduct,
  updateStoreSettings,
  userHasPaidProduct
} from "./db.js";
import { requireAdmin, requireAuth, requireCsrf } from "./auth.js";
import { readProtectedPdf, storeProtectedPdf } from "./storage.js";

const router = express.Router();
const rawPdf = express.raw({ type: "application/pdf", limit: "16mb" });

function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try { await handler(req, res, next); } catch (error) {
      if (res.headersSent) return next(error);
      return errorResponse(res, 500, "INTERNAL_ERROR", "Não foi possível concluir a operação.");
    }
  };
}

async function paymentsModule() {
  return import("./payments.js");
}

function publicOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    totalCents: order.totalCents,
    items: order.items
  };
}

function publicAdminOrder(order) {
  if (!order) return null;
  return {
    ...publicOrder(order),
    userId: order.userId,
    email: order.email,
    phone: order.phone
  };
}

function safeFilename(value) {
  const normalized = String(value || "material").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (normalized || "material").slice(0, 80);
}

function validOrigin(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.pathname.slice(1) && !url.search && !url.hash;
  } catch {
    return false;
  }
}

const checkoutSchema = z.object({
  productIds: z.array(z.string().regex(/^CEA-[A-Za-z0-9-]+$/)).min(1).max(20),
  phone: z.string().trim().min(3).max(64),
  optIn: z.literal(true),
  email: z.string().trim().email().max(320),
  origin: z.string().trim().max(512),
  idempotencyKey: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/)
}).strict().superRefine((data, ctx) => {
  if (new Set(data.productIds).size !== data.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Produtos repetidos." });
  if (!validOrigin(data.origin)) ctx.addIssue({ code: "custom", path: ["origin"], message: "Origem inválida." });
});

const productInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000),
  topics: z.array(z.string().trim().min(1).max(80)).max(20),
  stage: z.string().trim().min(1).max(64),
  years: z.array(z.string().trim().max(32)).max(20),
  level: z.string().trim().max(255),
  image: z.string().trim().max(1024).refine((value) => !value || /^\/manus-storage\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes(".."), "Use uma prévia armazenada na loja."),
  priceCents: z.number().int().min(1).max(100000000).nullable(),
  pages: z.number().int().positive().nullable(),
  format: z.string().trim().min(1).max(128),
  hasAnswerKey: z.boolean(),
  included: z.array(z.string().trim().max(1000)).max(50),
  contents: z.array(z.string().trim().max(1000)).max(50).optional(),
  objectives: z.array(z.string().trim().max(1000)).max(50).optional(),
  featured: z.boolean().optional(),
  active: z.boolean().optional(),
  commercialApproved: z.boolean().optional()
}).strict();

const productPatch = productInput.partial().strict();
const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(255).optional(),
  whatsappNumber: z.string().trim().max(64).optional(),
  contactEmail: z.string().trim().max(320).refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "E-mail inválido.").optional(),
  legalName: z.string().trim().max(255).optional(),
  taxId: z.string().trim().max(64).optional(),
  address: z.string().trim().max(2000).optional(),
  privacyText: z.string().max(50000).optional(),
  termsText: z.string().max(50000).optional(),
  licenseText: z.string().max(50000).optional(),
  publicOrigin: z.string().trim().max(512).refine((value) => !value || validOrigin(value), "Origem pública inválida.").optional(),
  paymentEnabled: z.boolean().optional()
}).strict();

router.get("/store", asyncRoute(async (_req, res) => {
  const [config, products, bestSellers] = await Promise.all([getStoreConfig(), listProducts(), bestSellerIds()]);
  return res.json({ config, products, bestSellers });
}));

router.get("/products", asyncRoute(async (_req, res) => res.json({ products: await listProducts() })));

router.get("/products/:id", asyncRoute(async (req, res) => {
  const product = await getProduct(req.params.id);
  if (!product) return errorResponse(res, 404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  return res.json({ product });
}));

router.post("/checkout", requireAuth, requireCsrf, asyncRoute(async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return errorResponse(res, 400, "INVALID_CHECKOUT", "Dados de checkout inválidos.");
  const config = await getStoreConfig();
  let payment;
  try { payment = await paymentsModule(); } catch { payment = null; }
  const prepared = config.paymentPrepared && payment && typeof payment.paymentPrepared === "function" && Boolean(payment.paymentPrepared());
  if (!config.paymentEnabled || !prepared) return errorResponse(res, 503, "PAYMENT_NOT_CONFIGURED", "Checkout ainda não está habilitado.");

  let created;
  try {
    created = await createPendingOrder({
      userId: req.user.id,
      phone: parsed.data.phone,
      email: parsed.data.email,
      productIds: parsed.data.productIds,
      idempotencyKey: parsed.data.idempotencyKey
    });
  } catch (error) {
    if (error?.code === "PRODUCT_UNAVAILABLE" || error?.code === "PRODUCT_NOT_SELLABLE") return errorResponse(res, 409, error.code, "Um dos produtos não está disponível para compra.");
    if (error?.code === "PAYMENT_NOT_CONFIGURED") return errorResponse(res, 503, error.code, "Checkout ainda não está habilitado.");
    throw error;
  }

  if (!created.created && created.order.status !== "pending") {
    return res.json({ order: publicOrder(created.order), pix: await paymentForOrder(created.order.id) });
  }

  let pix = await paymentForOrder(created.order.id);
  if (!pix) {
    try {
      const generated = await payment.createPixPayment({ orderId: created.order.id, totalCents: created.order.totalCents, email: parsed.data.email, origin: parsed.data.origin });
      if (!generated || typeof generated.providerId !== "string" || !generated.providerId) throw new Error("PAYMENT_RESPONSE_INVALID");
      created.order = await savePaymentResult(created.order.id, generated);
      pix = {
        code: generated.code || null,
        qrBase64: generated.qrBase64 || null,
        ticketUrl: generated.ticketUrl || null,
        expiresAt: generated.expiresAt || null
      };
    } catch {
      return errorResponse(res, 502, "PAYMENT_PROVIDER_ERROR", "Não foi possível criar a cobrança Pix.");
    }
  }
  return res.status(created.created ? 201 : 200).json({ order: publicOrder(created.order), pix });
}));

router.get("/orders", requireAuth, asyncRoute(async (req, res) => res.json({ orders: await listOrdersForUser(req.user.id) })));

router.get("/orders/:id", requireAuth, asyncRoute(async (req, res) => {
  let order;
  if (req.user.role === "admin") {
    const { getOrderById } = await import("./db.js");
    order = await getOrderById(req.params.id);
  } else {
    order = await getOrderForUser(req.params.id, req.user.id);
  }
  if (!order) return errorResponse(res, 404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
  const storedPix = order.status === "pending" ? await paymentForOrder(order.id) : null;
  const pix = storedPix ? { code: storedPix.code, qrBase64: storedPix.qrBase64, ticketUrl: storedPix.ticketUrl, expiresAt: storedPix.expiresAt } : null;
  return res.json({ order, pix });
}));

router.get("/downloads/:productId", requireAuth, asyncRoute(async (req, res) => {
  const isAdmin = req.user.role === "admin";
  const allowed = isAdmin || await userHasPaidProduct(req.user.id, req.params.productId);
  if (!allowed) return errorResponse(res, 403, "DOWNLOAD_FORBIDDEN", "Download não liberado para este usuário.");
  const storageKey = await getProductPrivateFile(req.params.productId);
  if (!storageKey) return errorResponse(res, 404, "FILE_NOT_READY", "Arquivo ainda não está disponível.");
  const product = await getProduct(req.params.productId, { admin: true });
  try {
    const pdf = await readProtectedPdf(storageKey);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="${safeFilename(product?.title || req.params.productId)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    });
    return res.send(pdf);
  } catch {
    return errorResponse(res, 502, "FILE_UNAVAILABLE", "Não foi possível entregar o arquivo protegido.");
  }
}));

router.post("/webhooks/mercadopago", asyncRoute(async (req, res) => {
  let payment;
  try { payment = await paymentsModule(); } catch { return errorResponse(res, 503, "PAYMENT_NOT_CONFIGURED", "Provedor de pagamento não configurado."); }
  let verified;
  try {
    verified = await payment.verifyWebhook({ headers: req.headers, query: req.query, body: req.body });
  } catch {
    return errorResponse(res, 401, "WEBHOOK_INVALID", "Webhook inválido.");
  }
  if (!verified?.providerId) return errorResponse(res, 400, "WEBHOOK_INVALID", "Webhook inválido.");
  let fetched;
  try { fetched = await payment.fetchPayment(verified.providerId); } catch { return errorResponse(res, 502, "PAYMENT_PROVIDER_ERROR", "Não foi possível verificar o pagamento."); }
  if (!fetched || fetched.providerId !== verified.providerId || typeof fetched.externalReference !== "string" || !Number.isInteger(fetched.amountCents) || fetched.currency !== "BRL") {
    return errorResponse(res, 422, "PAYMENT_REFERENCE_MISMATCH", "Referência de pagamento inválida.");
  }
  const statusMap = {
    approved: "paid",
    paid: "paid",
    pending: "pending",
    in_process: "pending",
    rejected: "failed",
    failed: "failed",
    cancelled: "cancelled",
    canceled: "cancelled",
    refunded: "refunded"
  };
  const normalizedStatus = statusMap[fetched.status];
  if (!normalizedStatus) return errorResponse(res, 422, "PAYMENT_STATUS_INVALID", "Status de pagamento inválido.");
  const eventKey = createHash("sha256").update(`${verified.providerId}:${fetched.externalReference}:${normalizedStatus}:${fetched.amountCents}:BRL`).digest("hex");
  try {
    const result = await recordProviderEvent({
      provider: "mercadopago",
      eventKey,
      providerId: verified.providerId,
      externalReference: fetched.externalReference,
      status: normalizedStatus,
      amountCents: fetched.amountCents,
      currency: "BRL"
    });
    return res.json({ ok: true, status: result.status });
  } catch (error) {
    if (error?.code === "PAYMENT_REFERENCE_MISMATCH") return errorResponse(res, 422, error.code, "Referência de pagamento inválida.");
    throw error;
  }
}));

router.get("/admin/products", requireAdmin, asyncRoute(async (_req, res) => res.json({ products: await listProducts({ admin: true }) })));

router.post("/admin/products", requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const parsed = productInput.safeParse(req.body);
  if (!parsed.success) return errorResponse(res, 400, "INVALID_PRODUCT", "Dados de produto inválidos.");
  const product = await insertProduct(parsed.data);
  return res.status(201).json({ product });
}));

router.put("/admin/products/:id", requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const parsed = productPatch.safeParse(req.body);
  if (!parsed.success) return errorResponse(res, 400, "INVALID_PRODUCT", "Dados de produto inválidos.");
  const product = await updateProduct(req.params.id, parsed.data);
  if (!product) return errorResponse(res, 404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  return res.json({ product });
}));

router.delete("/admin/products/:id", requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const changed = await deactivateProduct(req.params.id);
  if (!changed) return errorResponse(res, 404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  return res.json({ ok: true });
}));

router.post("/admin/products/:id/file", requireAdmin, requireCsrf, rawPdf, asyncRoute(async (req, res) => {
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length < 5 || body.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return errorResponse(res, 400, "INVALID_PDF", "O corpo deve ser um PDF válido.");
  }
  const product = await getProduct(req.params.id, { admin: true });
  if (!product) return errorResponse(res, 404, "PRODUCT_NOT_FOUND", "Produto não encontrado.");
  const storageKey = await storeProtectedPdf(body);
  await setProductStorageKey(req.params.id, storageKey);
  return res.json({ ok: true, fileReady: true });
}));

router.get("/admin/orders", requireAdmin, asyncRoute(async (_req, res) => res.json({ orders: (await listAdminOrders()).map(publicAdminOrder) })));

router.get("/admin/settings", requireAdmin, asyncRoute(async (_req, res) => res.json({ config: await getStoreConfig() })));

router.put("/admin/settings", requireAdmin, requireCsrf, asyncRoute(async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return errorResponse(res, 400, "INVALID_SETTINGS", "Configuração inválida.");
  if (parsed.data.paymentEnabled === true) {
    const config = { ...(await getStoreConfig()), ...parsed.data };
    if (!config.paymentPrepared) return errorResponse(res, 503, "PAYMENT_NOT_CONFIGURED", "Conecte as credenciais do Pix por configuração segura antes de habilitar vendas.");
    if (!config.legalName || !config.taxId || !config.address || (!config.contactEmail && !config.whatsappNumber)) {
      return errorResponse(res, 400, "STORE_SETUP_INCOMPLETE", "Preencha identificação, endereço e canal de contato da fornecedora antes de habilitar vendas.");
    }
  }
  return res.json({ config: await updateStoreSettings(parsed.data) });
}));

export const apiRouter = router;
export { checkoutSchema, productInput, productPatch, settingsSchema, publicOrder };
