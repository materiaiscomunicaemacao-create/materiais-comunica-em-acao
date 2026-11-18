import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const STORAGE_PREFIX = "private-pdf";
const HKDF_SALT = Buffer.from("comunicaacao-private-pdf-v1", "utf8");
const HKDF_INFO = Buffer.from("AES-256-GCM", "utf8");

function secretKey() {
  const secret = process.env.MANUS_JWT_SECRET;
  if (!secret) throw new Error("MANUS_JWT_SECRET is required for protected storage");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, HKDF_INFO, 32));
}

function apiConfig() {
  const base = process.env.MANUS_API_URL;
  const apiKey = process.env.MANUS_API_KEY;
  if (!base || !apiKey) throw new Error("MANUS storage API is not configured");
  return { base: base.replace(/\/$/, ""), apiKey };
}

export function encryptProtectedPdf(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new TypeError("PDF must be a Buffer");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Version, IV, authentication tag and ciphertext; no plaintext metadata is retained.
  return Buffer.concat([Buffer.from([1]), iv, tag, ciphertext]);
}

export function decryptProtectedPdf(payload) {
  if (!Buffer.isBuffer(payload) || payload.length < 1 + 12 + 16 || payload[0] !== 1) {
    throw new Error("Invalid protected PDF object");
  }
  const iv = payload.subarray(1, 13);
  const tag = payload.subarray(13, 29);
  const ciphertext = payload.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function presignedUrl(operation, storageKey) {
  if (!/^[\x21-\x7e]+$/.test(storageKey)) throw new Error("Invalid storage key");
  const { base, apiKey } = apiConfig();
  const response = await fetch(`${base}/v1/storage/presign/${operation}?path=${encodeURIComponent(storageKey)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  let body = null;
  try { body = await response.json(); } catch { /* handled as a failed storage call */ }
  if (!response.ok || !body?.url) throw new Error("Storage presign failed");
  return body.url;
}

export async function storeProtectedPdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("PDF must not be empty");
  const storageKey = `${STORAGE_PREFIX}/${randomBytes(24).toString("hex")}.bin`;
  const payload = encryptProtectedPdf(buffer);
  const url = await presignedUrl("put", storageKey);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(payload.length) },
    body: payload
  });
  if (!response.ok) throw new Error("Storage upload failed");
  return storageKey;
}

export async function readProtectedPdf(storageKey) {
  const url = await presignedUrl("get", storageKey);
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error("Storage download failed");
  const bytes = Buffer.from(await response.arrayBuffer());
  return decryptProtectedPdf(bytes);
}
