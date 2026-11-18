import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.DATABASE_URL ||= "mysql://root:root@127.0.0.1:3306/unit_only";
process.env.MANUS_JWT_SECRET ||= "unit-test-only-secret";
process.env.MANUS_PROJECT_ID ||= "unit-test-app";

const { encryptProtectedPdf, decryptProtectedPdf } = await import("../server/storage.js");
const { checkoutSchema, productInput, publicOrder } = await import("../server/api.js");
const { seedProductRow } = await import("../server/db.js");
const { verifySession } = await import("../server/auth.js");


test("PDF protegido cifra e decifra sem persistir plaintext", () => {
  const source = Buffer.from("%PDF-1.7\nunit test bytes\n", "ascii");
  const encrypted = encryptProtectedPdf(source);
  assert.notDeepEqual(encrypted, source);
  assert.deepEqual(decryptProtectedPdf(encrypted), source);
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptProtectedPdf(tampered));
});

test("checkout aceita somente contrato estrito e rejeita privilégios/status/preço do cliente", () => {
  const valid = checkoutSchema.safeParse({
    productIds: ["CEA-001", "CEA-009"],
    phone: "+55 11 99999-0000",
    optIn: true,
    email: "cliente@example.com",
    origin: "https://loja.example",
    idempotencyKey: "checkout-abc-123"
  });
  assert.equal(valid.success, true);
  assert.equal(checkoutSchema.safeParse({ ...valid.data, productIds: ["CEA-001", "CEA-001"] }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...valid.data, status: "paid" }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...valid.data, amount: 1, clientPermissions: ["admin"] }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...valid.data, optIn: false }).success, false);
});

test("produto administrativo não aceita storageKey nem sellable enviados pelo cliente", () => {
  const input = {
    title: "Material unitário",
    description: "Descrição",
    topics: ["gramatica"],
    stage: "fundamental",
    years: ["6"],
    level: "6º ano",
    image: "/manus-storage/preview.jpg",
    priceCents: null,
    pages: 2,
    format: "PDF digital",
    hasAnswerKey: false,
    included: ["Atividade em PDF"],
    featured: false,
    commercialApproved: false
  };
  assert.equal(productInput.safeParse(input).success, true);
  assert.equal(productInput.safeParse({ ...input, storageKey: "private-pdf/clear.bin" }).success, false);
  assert.equal(productInput.safeParse({ ...input, sellable: true }).success, false);
});

test("seed preserva CEA-009 no 6º ano, sem preço, aprovação ou arquivo", async () => {
  const { catalogSeed } = await import("../server/db.js");
  const product = catalogSeed.find((item) => item.id === "CEA-009");
  assert.ok(product);
  assert.deepEqual(product.years, ["6"]);
  assert.equal(product.priceCents, null);
  assert.equal(product.commercialApproved, false);
  assert.equal(product.storageKey, null);
  assert.ok(product.contents.length > 0);
  assert.ok(product.objectives.length > 0);
});

test("JWT exige HS256, expiração e appId do projeto", async () => {
  const secret = new TextEncoder().encode(process.env.MANUS_JWT_SECRET);
  const valid = await new SignJWT({ openId: "open-unit", appId: process.env.MANUS_PROJECT_ID })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("open-unit")
    .setExpirationTime("10m")
    .sign(secret);
  const verified = await verifySession(valid);
  assert.equal(verified.openId, "open-unit");

  const wrongApp = await new SignJWT({ openId: "open-unit", appId: "other-app" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret);
  assert.equal(await verifySession(wrongApp), null);
  const withoutExpiry = await new SignJWT({ openId: "open-unit", appId: process.env.MANUS_PROJECT_ID })
    .setProtectedHeader({ alg: "HS256" }).sign(secret);
  assert.equal(await verifySession(withoutExpiry), null);
  const expired = await new SignJWT({ openId: "open-unit", appId: process.env.MANUS_PROJECT_ID })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(secret);
  assert.equal(await verifySession(expired), null);
});

test("resposta pública de pedido não expõe telefone, e-mail ou providerId", () => {
  const output = publicOrder({
    id: "ord_unit",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    totalCents: 100,
    phone: "+55",
    email: "private@example.com",
    providerId: "provider-secret",
    items: [{ productId: "CEA-001", title: "Teste", priceCents: 100, downloadAvailable: false }]
  });
  assert.deepEqual(output, {
    id: "ord_unit",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    totalCents: 100,
    items: [{ productId: "CEA-001", title: "Teste", priceCents: 100, downloadAvailable: false }]
  });
});

test("admin exige conta autenticada com papel aprovado, nunca um identificador pendente", async () => {
  const { requireAdmin } = await import("../server/auth.js");
  const previous = process.env.STORE_ADMIN_OPEN_ID;
  process.env.STORE_ADMIN_OPEN_ID = "unit-profile-not-approved";
  try {
    function check(user, auth) {
      let status = null;
      let nextCalled = false;
      const response = { status(code) { status = code; return this; }, json() { return this; } };
      requireAdmin({ user, auth }, response, () => { nextCalled = true; });
      return { status, nextCalled };
    }
    assert.deepEqual(check(null, null), { status: 401, nextCalled: false });
    assert.deepEqual(check({ openId: "unit-profile-not-approved", role: "user" }, { openId: "unit-profile-not-approved" }), { status: 403, nextCalled: false });
    assert.deepEqual(check({ openId: "unit-approved", role: "admin" }, { openId: "unit-approved" }), { status: null, nextCalled: true });
  } finally {
    if (previous === undefined) delete process.env.STORE_ADMIN_OPEN_ID;
    else process.env.STORE_ADMIN_OPEN_ID = previous;
  }
});

test("pedidos, downloads e usuários não usam a configuração anterior para promover perfis", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const file of ["auth.js", "api.js", "db.js"]) {
    const source = await readFile(new URL(`../server/${file}`, import.meta.url), "utf8");
    assert.ok(!source.includes("STORE_ADMIN_OPEN_ID"), `${file} deve usar somente a permissão aprovada no cadastro`);
  }
});
