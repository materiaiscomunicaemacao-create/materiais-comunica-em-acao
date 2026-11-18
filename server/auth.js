import express from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getOrCreateUser, getUserByOpenId, hasAdminUser } from "./db.js";

export const SESSION_COOKIE = "webdev_app_session";
const CSRF_COOKIE = "comunicaacao_csrf";
const OAUTH_NONCE_COOKIE = "comunicaacao_oauth_nonce";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const textEncoder = new TextEncoder();

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function cookieMap(req) {
  const raw = req.headers.cookie || "";
  const result = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
  }
  return result;
}

function setCookie(res, name, value, { maxAge = null, httpOnly = true } = {}) {
  const pieces = [`${name}=${encodeURIComponent(value)}`, "Path=/", "Secure", "SameSite=None"];
  if (httpOnly) pieces.push("HttpOnly");
  if (maxAge !== null) pieces.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  res.append("Set-Cookie", pieces.join("; "));
}

function clearCookie(res, name) {
  setCookie(res, name, "", { maxAge: 0, httpOnly: name !== CSRF_COOKIE });
}

function sessionSecret() {
  const secret = process.env.MANUS_JWT_SECRET;
  return secret ? textEncoder.encode(secret) : null;
}

function loginAvailable() {
  return Boolean(process.env.MANUS_PROJECT_ID && process.env.MANUS_OAUTH_PORTAL_URL && process.env.MANUS_OAUTH_API_URL && process.env.MANUS_JWT_SECRET);
}

function tokenFromRequest(req) {
  return cookieMap(req)[SESSION_COOKIE] || null;
}

async function verifySession(token) {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.appId !== process.env.MANUS_PROJECT_ID) return null;
    const openId = typeof payload.openId === "string" ? payload.openId : (typeof payload.sub === "string" ? payload.sub : "");
    if (!openId) return null;
    return { payload, openId };
  } catch {
    return null;
  }
}

export async function authMiddleware(req, _res, next) {
  req.user = null;
  req.auth = null;
  const token = tokenFromRequest(req);
  if (!token) return next();
  const verified = await verifySession(token);
  if (!verified) return next();
  try {
    const user = await getOrCreateUser({
      openId: verified.openId,
      name: typeof verified.payload.name === "string" ? verified.payload.name : "",
      email: typeof verified.payload.email === "string" ? verified.payload.email : ""
    });
    req.user = user;
    req.auth = { token, payload: verified.payload, openId: verified.openId };
  } catch {
    // A database outage must not turn an invalid/unresolved session into an admin session.
    req.user = null;
    req.auth = null;
  }
  return next();
}

export function requireAuth(req, res, next) {
  if (!req.user || !req.auth) return sendError(res, 401, "AUTH_REQUIRED", "Login necessário.");
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.auth) return sendError(res, 401, "AUTH_REQUIRED", "Login necessário.");
  if (req.user.role !== "admin") return sendError(res, 403, "ADMIN_REQUIRED", "Acesso administrativo necessário.");
  return next();
}

function csrfSignature(token, sessionToken) {
  const secret = sessionSecret();
  if (!secret || !sessionToken) return "";
  return createHmac("sha256", secret).update(`${sessionToken}.${token}`).digest("base64url");
}

function makeCsrfToken(sessionToken) {
  const nonce = randomBytes(32).toString("base64url");
  return `${nonce}.${csrfSignature(nonce, sessionToken)}`;
}

function validCsrfToken(token, sessionToken, cookieToken) {
  if (!token || !cookieToken || token !== cookieToken || !sessionToken) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const nonce = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = csrfSignature(nonce, sessionToken);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function csrfTokenForRequest(req, res) {
  if (!req.auth?.token) return null;
  const cookies = cookieMap(req);
  if (validCsrfToken(cookies[CSRF_COOKIE], req.auth.token, cookies[CSRF_COOKIE])) return cookies[CSRF_COOKIE];
  const token = makeCsrfToken(req.auth.token);
  setCookie(res, CSRF_COOKIE, token, { maxAge: SESSION_MAX_AGE, httpOnly: false });
  return token;
}

export function requireCsrf(req, res, next) {
  if (!req.user || !req.auth) return sendError(res, 401, "AUTH_REQUIRED", "Login necessário.");
  const cookies = cookieMap(req);
  const supplied = req.get("X-CSRF-Token") || "";
  if (!validCsrfToken(supplied, req.auth.token, cookies[CSRF_COOKIE])) {
    return sendError(res, 403, "CSRF_INVALID", "Token CSRF inválido ou ausente.");
  }
  return next();
}

async function issueSession(user) {
  const secret = sessionSecret();
  if (!secret) throw new Error("MANUS_JWT_SECRET is required");
  return new SignJWT({
    openId: user.openId,
    name: user.name || "",
    email: user.email || "",
    appId: process.env.MANUS_PROJECT_ID
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.openId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

function oauthStateFromRequest(req, res) {
  const origin = typeof req.query.origin === "string" ? req.query.origin : "";
  let parsed;
  try { parsed = new URL(origin); } catch { return { error: "OAUTH_ORIGIN_INVALID" }; }
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return { error: "OAUTH_ORIGIN_INVALID" };
  }
  const nonce = randomBytes(32).toString("base64url");
  const redirectUri = `${parsed.origin}/api/auth/callback`;
  const state = Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64url");
  setCookie(res, OAUTH_NONCE_COOKIE, nonce, { maxAge: 600, httpOnly: true });
  return { state, redirectUri };
}

async function oauthJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  let data = null;
  try { data = await response.json(); } catch { /* generic failure below */ }
  if (!response.ok || !data) throw new Error("OAUTH_REQUEST_FAILED");
  return data;
}

function parseOAuthState(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.nonce !== "string" || typeof parsed.redirectUri !== "string") return null;
    const redirect = new URL(parsed.redirectUri);
    if (!/^https?:$/.test(redirect.protocol) || redirect.pathname !== "/api/auth/callback" || redirect.search || redirect.hash) return null;
    return { nonce: parsed.nonce, redirectUri: parsed.redirectUri };
  } catch {
    return null;
  }
}

export const authRouter = express.Router();

authRouter.get("/session", async (req, res) => {
  const csrfToken = req.user ? csrfTokenForRequest(req, res) : null;
  let adminConfigured = false;
  try { adminConfigured = await hasAdminUser(); } catch { /* migration may not have run yet */ }
  return res.json({
    user: req.user ? {
      id: req.user.id,
      openId: req.user.openId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role === "admin" ? "admin" : "user"
    } : null,
    csrfToken,
    loginAvailable: loginAvailable(),
    adminConfigured
  });
});

authRouter.get("/auth/start", (req, res) => {
  if (!loginAvailable()) return sendError(res, 503, "LOGIN_NOT_CONFIGURED", "Login Manus ainda não está configurado.");
  const stateData = oauthStateFromRequest(req, res);
  if (stateData.error) return sendError(res, 400, stateData.error, "Origem OAuth inválida.");
  const portal = process.env.MANUS_OAUTH_PORTAL_URL.replace(/\/$/, "");
  const params = new URLSearchParams({
    appId: process.env.MANUS_PROJECT_ID,
    redirectUri: stateData.redirectUri,
    state: stateData.state,
    responseType: "code"
  });
  return res.redirect(`${portal}/app-auth?${params.toString()}`);
});

authRouter.get("/auth/callback", async (req, res) => {
  if (!loginAvailable()) return sendError(res, 503, "LOGIN_NOT_CONFIGURED", "Login Manus ainda não está configurado.");
  const state = parseOAuthState(typeof req.query.state === "string" ? req.query.state : "");
  const cookies = cookieMap(req);
  if (!state || !cookies[OAUTH_NONCE_COOKIE] || cookies[OAUTH_NONCE_COOKIE] !== state.nonce) {
    clearCookie(res, OAUTH_NONCE_COOKIE);
    return sendError(res, 400, "OAUTH_STATE_INVALID", "Estado OAuth inválido.");
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) return sendError(res, 400, "OAUTH_CODE_MISSING", "Código OAuth ausente.");
  try {
    const oauthBase = process.env.MANUS_OAUTH_API_URL.replace(/\/$/, "");
    const exchanged = await oauthJson(`${oauthBase}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
      clientId: process.env.MANUS_PROJECT_ID,
      grantType: "authorization_code",
      code,
      redirectUri: state.redirectUri
    });
    if (typeof exchanged.accessToken !== "string" || !exchanged.accessToken) throw new Error("OAUTH_IDENTITY_FAILED");
    const identity = await oauthJson(`${oauthBase}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, { accessToken: exchanged.accessToken });
    if (typeof identity.openId !== "string" || !identity.openId) throw new Error("OAUTH_IDENTITY_FAILED");
    const user = await getOrCreateUser({ openId: identity.openId, name: identity.name || "", email: identity.email || "" });
    const session = await issueSession(user);
    setCookie(res, SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, httpOnly: true });
    clearCookie(res, OAUTH_NONCE_COOKIE);
    return res.redirect("/compras");
  } catch {
    clearCookie(res, OAUTH_NONCE_COOKIE);
    return sendError(res, 502, "OAUTH_FAILED", "Não foi possível concluir o login.");
  }
});

authRouter.post("/auth/logout", requireAuth, requireCsrf, (req, res) => {
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, CSRF_COOKIE);
  return res.json({ ok: true });
});

export { cookieMap, verifySession, loginAvailable };
