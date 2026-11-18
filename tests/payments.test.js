import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createPixPayment, fetchPayment, paymentPrepared, verifyWebhook } from "../server/payments.js";

const ENV_KEYS = ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"];
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setCredentials(accessToken, webhookSecret) {
  if (arguments.length === 0) {
    accessToken = "test-access-token";
    webhookSecret = "test-webhook-secret";
  }
  if (accessToken === undefined) delete process.env.MP_ACCESS_TOKEN;
  else process.env.MP_ACCESS_TOKEN = accessToken;
  if (webhookSecret === undefined) delete process.env.MP_WEBHOOK_SECRET;
  else process.env.MP_WEBHOOK_SECRET = webhookSecret;
}

function restoreCredentials() {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

function response(status, payload) {
  return { status, async json() { return payload; } };
}

function orderResponse(overrides = {}) {
  return {
    id: "ORD01TESTPAYMENT",
    type: "online",
    status: "action_required",
    status_detail: "waiting_transfer",
    external_reference: "order-123",
    total_amount: "12.34",
    country_code: "BRA",
    transactions: {
      payments: [{
        id: "PAY01TESTPAYMENT",
        amount: "12.34",
        status: "action_required",
        payment_method: {
          id: "pix",
          type: "bank_transfer",
          qr_code: "00020101021226850014br.gov.bcb.pix",
          qr_code_base64: "aGVsbG8=",
          ticket_url: "https://www.mercadopago.com.br/sandbox/payments/123/ticket",
        },
        date_of_expiration: "2026-12-01T12:00:00.000Z",
      }],
    },
    ...overrides,
  };
}

describe("payments", { concurrency: false }, () => {
afterEach(() => restoreCredentials());

test("paymentPrepared só fica ativo com Access Token e segredo de webhook", () => {
  setCredentials(undefined, undefined);
  assert.equal(paymentPrepared(), false);
  setCredentials("token", undefined);
  assert.equal(paymentPrepared(), false);
  setCredentials(undefined, "secret");
  assert.equal(paymentPrepared(), false);
  setCredentials("token", "secret");
  assert.equal(paymentPrepared(), true);
});

test("createPixPayment envia Orders API Pix com amount decimal exato e idempotência estável", async () => {
  setCredentials();
  const calls = [];
  const result = await createPixPayment({
    orderId: "order-123",
    totalCents: 1234,
    email: "cliente@example.com",
    origin: "https://loja.example.com",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(201, orderResponse());
    },
  });

  assert.deepEqual(result, {
    providerId: "ORD01TESTPAYMENT",
    code: "00020101021226850014br.gov.bcb.pix",
    qrBase64: "aGVsbG8=",
    ticketUrl: "https://www.mercadopago.com.br/sandbox/payments/123/ticket",
    expiresAt: "2026-12-01T12:00:00.000Z",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.mercadopago.com/v1/orders");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-access-token");
  assert.equal(calls[0].init.headers["X-Idempotency-Key"], "order-123");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    type: "online",
    total_amount: "12.34",
    external_reference: "order-123",
    processing_mode: "automatic",
    transactions: {
      payments: [{ amount: "12.34", payment_method: { id: "pix", type: "bank_transfer" } }],
    },
    payer: { email: "cliente@example.com" },
  });
});

test("createPixPayment preserva o limite de centavos e rejeita entradas sem executar HTTP", async () => {
  setCredentials();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(201, orderResponse());
  };
  await assert.rejects(
    createPixPayment({ orderId: "order-123", totalCents: 0, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl }),
    (error) => error.code === "PAYMENT_INVALID_INPUT" && error.status === 400,
  );
  await assert.rejects(
    createPixPayment({ orderId: "order-123", totalCents: 1.5, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl }),
    (error) => error.code === "PAYMENT_INVALID_INPUT",
  );
  await assert.rejects(
    createPixPayment({ orderId: "order-123", totalCents: Number.MAX_SAFE_INTEGER + 1, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl }),
    (error) => error.code === "PAYMENT_INVALID_INPUT",
  );
  const oneCent = await createPixPayment({ orderId: "order-123", totalCents: 1, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl: async (url, init) => {
    calls += 1;
    assert.equal(JSON.parse(init.body).total_amount, "0.01");
    return response(201, orderResponse({ total_amount: "0.01", transactions: { payments: [{ payment_method: { id: "pix", type: "bank_transfer", qr_code: "pix" } }] } }));
  } });
  assert.equal(oneCent.code, "pix");
  assert.equal(calls, 1);
});

test("createPixPayment rejeita origem não HTTPS ou host interno", async () => {
  setCredentials();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(201, orderResponse());
  };
  for (const origin of ["http://loja.example.com", "https://localhost", "https://127.0.0.1", "https://loja.example.com/path"]) {
    await assert.rejects(
      createPixPayment({ orderId: "order-123", totalCents: 1234, email: "cliente@example.com", origin, fetchImpl }),
      (error) => error.code === "PAYMENT_INVALID_INPUT" && error.status === 400,
    );
  }
  assert.equal(calls, 0);
});

test("nenhuma operação de pagamento faz HTTP sem Access Token", async () => {
  setCredentials(undefined, "secret");
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(200, orderResponse());
  };
  await assert.rejects(
    createPixPayment({ orderId: "order-123", totalCents: 1234, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl }),
    (error) => error.code === "PAYMENT_NOT_CONFIGURED" && error.status === 503,
  );
  await assert.rejects(fetchPayment("ORD01TESTPAYMENT", { fetchImpl }), (error) => error.code === "PAYMENT_NOT_CONFIGURED");
  assert.equal(calls, 0);
});

test("erro HTTP do provedor vira Error estruturado sem expor resposta ou token", async () => {
  setCredentials("super-secret-token", "secret");
  await assert.rejects(
    fetchPayment("ORD01TESTPAYMENT", { fetchImpl: async () => response(429, { cause: "do not expose" }) }),
    (error) => {
      assert.equal(error.code, "PAYMENT_PROVIDER_ERROR");
      assert.equal(error.status, 429);
      assert.equal(error.message.includes("super-secret-token"), false);
      assert.equal(error.message.includes("do not expose"), false);
      return true;
    },
  );
});

test("fetchPayment normaliza somente estados oficiais e converte valores sem ponto flutuante", async () => {
  setCredentials();
  const cases = [
    ["created", "pending"],
    ["processing", "pending"],
    ["action_required", "pending"],
    ["processed", "paid"],
    ["failed", "failed"],
    ["canceled", "cancelled"],
    ["refunded", "refunded"],
  ];
  for (const [providerStatus, expectedStatus] of cases) {
    const result = await fetchPayment("ORD01TESTPAYMENT", {
      fetchImpl: async () => response(200, orderResponse({ status: providerStatus, total_amount: "10.01", transactions: { payments: [] } })),
    });
    assert.equal(result.status, expectedStatus);
    assert.equal(result.amountCents, 1001);
    assert.equal(result.currency, "BRL");
    assert.equal(result.pix, null);
  }
  await assert.rejects(
    fetchPayment("ORD01TESTPAYMENT", { fetchImpl: async () => response(200, orderResponse({ status: "invented_status" })) }),
    (error) => error.code === "PAYMENT_STATUS_UNSUPPORTED" && error.status === 502,
  );
});

test("resposta Pix sem código ou com ticket fora do provedor nunca fabrica dados", async () => {
  setCredentials();
  await assert.rejects(
    createPixPayment({ orderId: "order-123", totalCents: 1234, email: "cliente@example.com", origin: "https://loja.example.com", fetchImpl: async () => response(201, orderResponse({ transactions: { payments: [{ payment_method: { id: "pix", type: "bank_transfer", qr_code: "" } }] } })) }),
    (error) => error.code === "PAYMENT_PIX_DATA_MISSING" && error.status === 502,
  );
  await assert.rejects(
    fetchPayment("ORD01TESTPAYMENT", { fetchImpl: async () => response(200, orderResponse({ transactions: { payments: [{ payment_method: { id: "pix", type: "bank_transfer", qr_code: "pix", ticket_url: "https://evil.example.com/ticket" } }] } })) }),
    (error) => error.code === "PAYMENT_INVALID_RESPONSE" && error.status === 502,
  );
});

function signedWebhook({ id, requestId, timestamp, secret = "webhook-secret" }) {
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${timestamp},v1=${digest}`;
}

function webhookInput({ id = "ORD01Webhook", requestId = "request-123", timestamp = String(Date.now()), signature } = {}) {
  const secret = "webhook-secret";
  return {
    headers: {
      "x-signature": signature ?? signedWebhook({ id, requestId, timestamp, secret }),
      "x-request-id": requestId,
    },
    query: { "data.id": id, type: "order" },
    body: { type: "order", action: "order.processed", data: { id } },
  };
}

test("verifyWebhook valida o manifest oficial com HMAC constante e retorna o ID da Order", () => {
  setCredentials(undefined, "webhook-secret");
  const input = webhookInput({ id: "ORD01Webhook" });
  assert.deepEqual(verifyWebhook(input), { providerId: "ORD01Webhook" });
});

test("verifyWebhook rejeita adulteração, tópico incorreto, ID divergente e timestamp fora da janela", () => {
  setCredentials(undefined, "webhook-secret");
  const valid = webhookInput();
  const tampered = { ...valid, body: { ...valid.body, action: "order.canceled" } };
  assert.deepEqual(verifyWebhook(tampered), { providerId: "ORD01Webhook" });

  const signature = valid.headers["x-signature"];
  const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
  assert.throws(() => verifyWebhook({ ...valid, headers: { ...valid.headers, "x-signature": tamperedSignature } }), (error) => error.code === "WEBHOOK_INVALID" && error.status === 401);
  assert.throws(() => verifyWebhook({ ...valid, body: { ...valid.body, type: "payment" } }), (error) => error.code === "WEBHOOK_INVALID");
  assert.throws(() => verifyWebhook({ ...valid, body: { ...valid.body, data: { id: "ORD-DIFFERENT" } } }), (error) => error.code === "WEBHOOK_INVALID");

  const oldTimestamp = String(Date.now() - 301_000);
  const stale = webhookInput({ timestamp: oldTimestamp });
  assert.throws(() => verifyWebhook(stale), (error) => error.code === "WEBHOOK_INVALID" && error.status === 401);
});

test("verifyWebhook exige segredo sem fazer chamada externa", () => {
  setCredentials(undefined, undefined);
  assert.throws(() => verifyWebhook(webhookInput()), (error) => error.code === "PAYMENT_NOT_CONFIGURED" && error.status === 503);
});
});
