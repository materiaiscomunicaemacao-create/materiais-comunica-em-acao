import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.mercadopago.com";
const API_TIMEOUT_MS = 10_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;
const IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ORDER_REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PROVIDER_TICKET_HOSTS = [
  "mercadopago.com",
  "mercadopago.com.br",
  "mercadolibre.com",
  "mercadolibre.com.br",
  "mercadolivre.com",
  "mercadolivre.com.br",
];

class PaymentError extends Error {
  constructor(code, status, message, options = {}) {
    super(message, options);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
    this.statusCode = status;
  }
}

function fail(code, status, message, options) {
  throw new PaymentError(code, status, message, options);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function configuredAccessToken() {
  return isNonEmptyString(process.env.MP_ACCESS_TOKEN) ? process.env.MP_ACCESS_TOKEN.trim() : null;
}

function configuredWebhookSecret() {
  return isNonEmptyString(process.env.MP_WEBHOOK_SECRET) ? process.env.MP_WEBHOOK_SECRET.trim() : null;
}

function ensureAccessToken() {
  const token = configuredAccessToken();
  if (!token) fail("PAYMENT_NOT_CONFIGURED", 503, "Pagamento não configurado.");
  return token;
}

function ensureWebhookSecret() {
  const secret = configuredWebhookSecret();
  if (!secret) fail("PAYMENT_NOT_CONFIGURED", 503, "Pagamento não configurado.");
  return secret;
}

function getFetchImplementation(candidate) {
  const implementation = candidate ?? globalThis.fetch;
  if (typeof implementation !== "function") {
    fail("PAYMENT_NETWORK_ERROR", 502, "Não foi possível acessar o provedor de pagamento.");
  }
  return implementation;
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== "object") return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    if (Array.isArray(value) || typeof value !== "string") return null;
    return value;
  }
  return null;
}

function queryValue(query, name) {
  if (!query) return null;
  if (typeof query.get === "function") {
    const value = query.get(name);
    return typeof value === "string" ? value : null;
  }
  if (typeof query !== "object") return null;
  const value = query[name];
  if (Array.isArray(value) || typeof value !== "string") return null;
  return value;
}

function assertIdentifier(value, code = "PAYMENT_INVALID_INPUT", maxLength = 128, status = 400) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || !IDENTIFIER_RE.test(value)) {
    fail(code, status, "Identificador de pagamento inválido.");
  }
  return value;
}

function assertOrderId(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64 || !ORDER_REFERENCE_RE.test(value)) {
    fail("PAYMENT_INVALID_INPUT", 400, "Pedido inválido.");
  }
  return value;
}

function assertEmail(value) {
  if (typeof value !== "string" || value.length > 254 || !EMAIL_RE.test(value)) {
    fail("PAYMENT_INVALID_INPUT", 400, "E-mail inválido.");
  }
  return value;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 0);
}

function isInternalHostname(hostname) {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return lower === "localhost" || lower.endsWith(".localhost") || lower.endsWith(".local") || lower.endsWith(".internal") || lower === "host.docker.internal" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:") || isPrivateIpv4(lower);
}

function validateOrigin(origin) {
  if (typeof origin !== "string" || origin.length === 0) {
    fail("PAYMENT_INVALID_INPUT", 400, "Origem inválida.");
  }
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    fail("PAYMENT_INVALID_INPUT", 400, "Origem inválida.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || isInternalHostname(parsed.hostname)) {
    fail("PAYMENT_INVALID_INPUT", 400, "Origem inválida.");
  }
  return parsed.origin;
}

function assertTotalCents(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail("PAYMENT_INVALID_INPUT", 400, "Valor inválido.");
  }
  return value;
}

function formatCents(value) {
  const cents = BigInt(value);
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  return `${whole}.${fraction}`;
}

function parseCents(value) {
  let text;
  if (typeof value === "string") text = value.trim();
  else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
  else return null;

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  try {
    const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
    if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(cents);
  } catch {
    return null;
  }
}

function assertProviderStatus(status, detail) {
  if (typeof status !== "string" || status.length === 0) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  const normalized = status.toLowerCase();
  switch (normalized) {
    case "created":
    case "processing":
    case "action_required":
    case "in_review":
      return "pending";
    case "processed":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
    case "expired":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "charged_back":
      return detail === "in_process" ? "failed" : "refunded";
    default:
      fail("PAYMENT_STATUS_UNSUPPORTED", 502, "Status de pagamento não suportado.");
  }
}

function normalizeCurrency(value, countryCode) {
  const currency = typeof value === "string" && value.trim() ? value.trim().toUpperCase() : countryCode === "BRA" ? "BRL" : null;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  return currency;
}

function normalizeExpiry(payment) {
  const value = payment?.date_of_expiration ?? payment?.expiration_date ?? payment?.expires_at;
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Data de expiração inválida do provedor.");
  }
  return value;
}

function normalizeTicketUrl(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") fail("PAYMENT_INVALID_RESPONSE", 502, "URL de pagamento inválida do provedor.");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("PAYMENT_INVALID_RESPONSE", 502, "URL de pagamento inválida do provedor.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const knownHost = PROVIDER_TICKET_HOSTS.some((root) => hostname === root || hostname.endsWith(`.${root}`));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !knownHost) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "URL de pagamento inválida do provedor.");
  }
  return parsed.toString();
}

function normalizeQrBase64(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 8_000_000 || !BASE64_RE.test(value)) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "QR Code inválido do provedor.");
  }
  return value;
}

function normalizePix(payment, required) {
  const paymentMethod = payment?.payment_method;
  if (!paymentMethod || paymentMethod.id !== "pix" || (paymentMethod.type != null && paymentMethod.type !== "bank_transfer")) {
    if (required) fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta Pix inválida do provedor.");
    return null;
  }
  const code = paymentMethod.qr_code;
  if (typeof code !== "string" || code.length === 0) {
    if (required) fail("PAYMENT_PIX_DATA_MISSING", 502, "O provedor não retornou o código Pix.");
    return null;
  }
  return {
    code,
    qrBase64: normalizeQrBase64(paymentMethod.qr_code_base64),
    ticketUrl: normalizeTicketUrl(paymentMethod.ticket_url),
    expiresAt: normalizeExpiry(payment),
  };
}

function assertProviderOrder(response, expectedReference, expectedAmount, requirePix) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  const providerId = assertIdentifier(response.id, "PAYMENT_INVALID_RESPONSE", 128, 502);
  const externalReference = response.external_reference;
  if (typeof externalReference !== "string" || externalReference !== expectedReference) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  const amountCents = parseCents(response.total_amount);
  if (amountCents === null || amountCents !== expectedAmount) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  const status = assertProviderStatus(response.status, response.status_detail);
  const payments = response.transactions?.payments;
  if (!Array.isArray(payments) || payments.length === 0) {
    if (requirePix) fail("PAYMENT_PIX_DATA_MISSING", 502, "O provedor não retornou o pagamento Pix.");
  }
  const pix = Array.isArray(payments) && payments.length > 0 ? normalizePix(payments[0], requirePix) : null;
  return { providerId, status, pix };
}

async function requestJson(url, init, fetchImpl) {
  const implementation = getFetchImplementation(fetchImpl);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  timer.unref?.();

  let response;
  try {
    response = await implementation(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut || error?.name === "AbortError") {
      fail("PAYMENT_TIMEOUT", 504, "O provedor de pagamento demorou para responder.");
    }
    fail("PAYMENT_NETWORK_ERROR", 502, "Não foi possível acessar o provedor de pagamento.", { cause: error });
  } finally {
    clearTimeout(timer);
  }

  const status = Number(response?.status);
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.", { cause: error });
  }
  if (!Number.isInteger(status) || status < 200 || status >= 300) {
    const safeStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
    fail("PAYMENT_PROVIDER_ERROR", safeStatus, "O provedor recusou a operação.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  return payload;
}

function apiHeaders(token, idempotencyKey) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
  };
}

function buildOrderBody(orderId, totalCents, email) {
  const amount = formatCents(totalCents);
  return {
    type: "online",
    total_amount: amount,
    external_reference: orderId,
    processing_mode: "automatic",
    transactions: {
      payments: [
        {
          amount,
          payment_method: { id: "pix", type: "bank_transfer" },
        },
      ],
    },
    payer: { email },
  };
}

/**
 * Returns true only when both server-only Mercado Pago credentials are present.
 */
export function paymentPrepared() {
  return Boolean(configuredAccessToken() && configuredWebhookSecret());
}

/**
 * Creates one automatic Pix order. `fetchImpl` is an intentionally undocumented
 * test seam; production callers use the platform fetch implementation.
 */
export async function createPixPayment({ orderId, totalCents, email, origin, fetchImpl } = {}) {
  assertOrderId(orderId);
  assertTotalCents(totalCents);
  assertEmail(email);
  validateOrigin(origin);
  const token = ensureAccessToken();
  const response = await requestJson(
    `${API_BASE_URL}/v1/orders`,
    {
      method: "POST",
      headers: apiHeaders(token, orderId),
      body: JSON.stringify(buildOrderBody(orderId, totalCents, email)),
    },
    fetchImpl,
  );
  const result = assertProviderOrder(response, orderId, totalCents, true);
  if (result.status === "failed" || result.status === "cancelled" || result.status === "refunded") {
    fail("PAYMENT_PROVIDER_STATE", 502, "O provedor não criou um pagamento Pix utilizável.");
  }
  return {
    providerId: result.providerId,
    code: result.pix.code,
    qrBase64: result.pix.qrBase64,
    ticketUrl: result.pix.ticketUrl,
    expiresAt: result.pix.expiresAt,
  };
}

function verifySignature(headers, query, body, secret) {
  const signatureHeader = headerValue(headers, "x-signature");
  const requestId = headerValue(headers, "x-request-id");
  const queryDataId = queryValue(query, "data.id") ?? queryValue(query, "data_id");
  const bodyDataId = body?.data?.id;
  const queryType = queryValue(query, "type");

  if (!isNonEmptyString(signatureHeader) || !isNonEmptyString(requestId) || !isNonEmptyString(queryDataId) || !IDENTIFIER_RE.test(queryDataId) || !isNonEmptyString(bodyDataId) || queryType !== null && queryType !== "order" && queryType !== "orders") {
    fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
  }
  if (typeof bodyDataId !== "string" || !IDENTIFIER_RE.test(bodyDataId) || bodyDataId.toLowerCase() !== queryDataId.toLowerCase()) {
    fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || body.type !== "order") {
    fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
  }

  const pieces = signatureHeader.split(",");
  let timestamp = null;
  let received = null;
  for (const piece of pieces) {
    const separator = piece.indexOf("=");
    if (separator <= 0 || separator === piece.length - 1) continue;
    const key = piece.slice(0, separator).trim();
    const value = piece.slice(separator + 1).trim();
    if (key === "ts") {
      if (timestamp !== null || !/^\d{10,13}$/.test(value)) fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
      timestamp = value;
    } else if (key === "v1") {
      if (received !== null || !/^[0-9a-f]{64}$/i.test(value)) fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
      received = value.toLowerCase();
    }
  }
  if (timestamp === null || received === null) fail("WEBHOOK_INVALID", 401, "Notificação inválida.");

  const manifest = `id:${queryDataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest, "utf8").digest();
  const receivedBytes = Buffer.from(received, "hex");
  if (receivedBytes.length !== expected.length || !timingSafeEqual(expected, receivedBytes)) {
    fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
  }

  const numericTimestamp = Number(timestamp);
  const timestampMs = timestamp.length <= 10 ? numericTimestamp * 1000 : numericTimestamp;
  if (!Number.isSafeInteger(numericTimestamp) || !Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > WEBHOOK_TOLERANCE_SECONDS * 1000) {
    fail("WEBHOOK_INVALID", 401, "Notificação inválida.");
  }
  return queryDataId;
}

export function verifyWebhook({ headers, query, body } = {}) {
  const secret = ensureWebhookSecret();
  const providerId = verifySignature(headers, query, body, secret);
  return { providerId };
}

/**
 * Re-reads an Order by provider ID. Business ownership, amount/reference
 * matching and database state transitions remain the caller's responsibility.
 */
export async function fetchPayment(providerId, { fetchImpl } = {}) {
  assertIdentifier(providerId, "PAYMENT_INVALID_INPUT");
  const token = ensureAccessToken();
  const response = await requestJson(
    `${API_BASE_URL}/v1/orders/${encodeURIComponent(providerId)}`,
    {
      method: "GET",
      headers: apiHeaders(token),
    },
    fetchImpl,
  );
  if (typeof response.id !== "string" || response.id.toLowerCase() !== providerId.toLowerCase()) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  if (typeof response.external_reference !== "string" || response.external_reference.length === 0) {
    fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  }
  const amountCents = parseCents(response.total_amount);
  if (amountCents === null) fail("PAYMENT_INVALID_RESPONSE", 502, "Resposta inválida do provedor.");
  const payments = response.transactions?.payments;
  const firstPayment = Array.isArray(payments) && payments.length > 0 ? payments[0] : null;
  const statusSource = response.status ?? firstPayment?.status;
  const status = assertProviderStatus(statusSource, response.status_detail ?? firstPayment?.status_detail);
  const pix = firstPayment ? normalizePix(firstPayment, false) : null;
  return {
    providerId,
    externalReference: response.external_reference,
    status,
    amountCents,
    currency: normalizeCurrency(response.currency_id ?? response.currency, response.country_code),
    pix,
  };
}
