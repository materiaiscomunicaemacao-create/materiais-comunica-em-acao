import { catalogSeed, pool } from "./db.js";

const MIGRATION_VERSION = 1;

async function seedSettings(connection) {
  await connection.query(
    `INSERT IGNORE INTO store_settings
      (id, brand_name, whatsapp_number, contact_email, legal_name, tax_id, address,
       privacy_text, terms_text, license_text, public_origin, payment_enabled, whatsapp_automatic)
     VALUES (1, 'Comunic@ Em Ação', '', '', '', '', '',
       'Política de privacidade em revisão.',
       'Termos de uso em revisão.',
       'Licenças e direitos dos materiais em revisão.', '', 0, 0)`
  );
}

async function seedProducts(connection) {
  for (const product of catalogSeed) {
    await connection.query(
      `INSERT IGNORE INTO products
        (id, title, description, topics_json, stage, years_json, level, image, price_cents, pages, format,
         has_answer_key, included_json, contents_json, objectives_json, featured, active,
         commercial_approved, sellable, storage_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        product.id,
        product.title,
        product.description,
        JSON.stringify(product.topics),
        product.stage,
        JSON.stringify(product.years),
        product.level,
        product.image,
        product.priceCents,
        product.pages,
        product.format,
        product.hasAnswerKey ? 1 : 0,
        JSON.stringify(product.included),
        JSON.stringify(product.contents),
        JSON.stringify(product.objectives),
        product.featured ? 1 : 0,
        product.active ? 1 : 0,
        product.commercialApproved ? 1 : 0
      ]
    );
  }
}

async function applyVersionOne(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      open_id VARCHAR(191) NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(320) NOT NULL DEFAULT '',
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY users_open_id_uq (open_id),
      KEY users_role_idx (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE TABLE IF NOT EXISTS store_settings (
      id TINYINT UNSIGNED NOT NULL,
      brand_name VARCHAR(255) NOT NULL DEFAULT 'Comunic@ Em Ação',
      whatsapp_number VARCHAR(64) NOT NULL DEFAULT '',
      contact_email VARCHAR(320) NOT NULL DEFAULT '',
      legal_name VARCHAR(255) NOT NULL DEFAULT '',
      tax_id VARCHAR(64) NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      privacy_text TEXT NOT NULL,
      terms_text TEXT NOT NULL,
      license_text TEXT NOT NULL,
      public_origin VARCHAR(512) NOT NULL DEFAULT '',
      payment_enabled TINYINT(1) NOT NULL DEFAULT 0,
      whatsapp_automatic TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      topics_json JSON NOT NULL,
      stage VARCHAR(64) NOT NULL DEFAULT 'todos',
      years_json JSON NOT NULL,
      level VARCHAR(255) NOT NULL DEFAULT '',
      image VARCHAR(1024) NOT NULL DEFAULT '',
      price_cents INT UNSIGNED NULL,
      pages INT UNSIGNED NULL,
      format VARCHAR(128) NOT NULL DEFAULT 'PDF digital',
      has_answer_key TINYINT(1) NOT NULL DEFAULT 0,
      included_json JSON NOT NULL,
      contents_json JSON NOT NULL,
      objectives_json JSON NOT NULL,
      featured TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      commercial_approved TINYINT(1) NOT NULL DEFAULT 0,
      sellable TINYINT(1) NOT NULL DEFAULT 0,
      storage_key VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY products_active_idx (active),
      KEY products_featured_idx (featured)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      phone VARCHAR(64) NOT NULL DEFAULT '',
      email VARCHAR(320) NOT NULL DEFAULT '',
      idempotency_key VARCHAR(128) NOT NULL,
      provider_id VARCHAR(191) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      total_cents INT UNSIGNED NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'BRL',
      pix_code TEXT NULL,
      pix_qr_base64 MEDIUMTEXT NULL,
      pix_ticket_url TEXT NULL,
      pix_expires_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY orders_user_idempotency_uq (user_id, idempotency_key),
      UNIQUE KEY orders_provider_id_uq (provider_id),
      KEY orders_user_created_idx (user_id, created_at),
      KEY orders_status_idx (status),
      CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id VARCHAR(64) NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      price_cents INT UNSIGNED NOT NULL,
      quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      PRIMARY KEY (id),
      UNIQUE KEY order_items_product_uq (order_id, product_id),
      KEY order_items_product_idx (product_id),
      CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await connection.query(
    `CREATE TABLE IF NOT EXISTS payment_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      provider VARCHAR(64) NOT NULL,
      event_key VARCHAR(255) NOT NULL,
      provider_id VARCHAR(191) NOT NULL,
      order_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY payment_events_provider_key_uq (provider, event_key),
      UNIQUE KEY payment_events_provider_order_status_uq (provider, provider_id, order_id, status),
      KEY payment_events_order_idx (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await seedSettings(connection);
  await seedProducts(connection);
}

export async function migrate() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT UNSIGNED NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [rows] = await pool.query("SELECT version FROM schema_migrations WHERE version = ? LIMIT 1", [MIGRATION_VERSION]);
  if (rows.length) return { applied: false, version: MIGRATION_VERSION };

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await applyVersionOne(connection);
    await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [MIGRATION_VERSION]);
    await connection.commit();
    return { applied: true, version: MIGRATION_VERSION };
  } catch (error) {
    try { await connection.rollback(); } catch { /* preserve original migration error */ }
    throw error;
  } finally {
    connection.release();
  }
}

export { MIGRATION_VERSION };
