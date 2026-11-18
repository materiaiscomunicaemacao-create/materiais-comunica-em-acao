import express from "express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { pool, listProducts, getStoreConfig, bestSellerIds } from "./server/db.js";
import { authMiddleware, authRouter } from "./server/auth.js";
import { apiRouter } from "./server/api.js";
import { renderPage } from "./server/render.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT id FROM products LIMIT 1");
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "preparing" });
  }
});

for (const name of ["store.js", "store.css"]) {
  app.get(`/${name}`, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(resolve(root, "public", name));
  });
}
app.get("/manus-routes.json", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(resolve(root, "manus-routes.json"));
});

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
app.use("/api", express.json({ limit: "1mb" }), authMiddleware, authRouter, apiRouter);
app.use("/api", (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
});

app.use(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  try {
    const [products, config, bestSellers] = await Promise.all([
      listProducts(), getStoreConfig(), bestSellerIds()
    ]);
    const page = renderPage({ path: req.originalUrl, products, config, bestSellers, user: null });
    const privatePage = req.path === "/compras" || req.path === "/admin";
    res.setHeader("Cache-Control", privatePage ? "private, no-store" : "no-cache");
    if (privatePage) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.status(page.status).type("html").send(page.html);
  } catch (error) {
    next(error);
  }
});
app.use((req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const tooLarge = error.type === "entity.too.large";
  const status = tooLarge ? 413 : Number(error.status || error.statusCode) || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  if (safeStatus >= 500) console.error("Falha na aplicação:", error.code || error.name || "SERVER_ERROR");
  res.setHeader("Cache-Control", "private, no-store");
  res.status(safeStatus).json({ error: {
    code: tooLarge ? "FILE_TOO_LARGE" : error.code || "SERVER_ERROR",
    message: tooLarge ? "O arquivo excede o tamanho permitido." : safeStatus < 500 ? error.message : "Não foi possível concluir agora. Tente novamente."
  } });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`Loja Comunic@ Em Ação disponível na porta ${port}`));
