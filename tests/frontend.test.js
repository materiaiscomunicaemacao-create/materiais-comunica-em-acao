import test from "node:test";
import assert from "node:assert/strict";
import { products as sourceProducts } from "../catalog.js";
import { filterProducts, parseFilters, renderPage } from "../server/render.js";

const fixtureProducts = sourceProducts.map((product, index) => ({
  ...product,
  priceCents: index === 0 ? 1290 : null,
  active: true,
  featured: index === 1,
  createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
}));

const fixtureConfig = {
  brandName: "Comunic@ Em Ação",
  publicOrigin: "",
  paymentPrepared: false,
  paymentEnabled: false
};

function documentBody(html) {
  return html.split('<script type="application/json" id="store-state">')[0];
}

test("renderPage entrega SSR público com links reais e os nove materiais", () => {
  const result = renderPage({ path: "/", products: fixtureProducts, config: fixtureConfig, bestSellers: [] });
  assert.equal(result.status, 200);
  const body = documentBody(result.html);
  for (const product of fixtureProducts) assert.match(body, new RegExp(product.id));
  for (const route of ["/", "/catalogo", "/produto/CEA-009", "/sobre", "/contato", "/carrinho", "/compras", "/admin"]) {
    assert.match(body, new RegExp(`href="${route.replaceAll("/", "\\/")}"`));
  }
  assert.match(body, /Ainda não há dados de pedidos pagos/);
});

test("filtros SSR combinam assunto e ano sem criar categorias vazias", () => {
  const path = "/catalogo?topic=gramatica&year=6";
  const filters = parseFilters(path, fixtureProducts);
  assert.deepEqual(filters, { stage: "fundamental", year: "6", topic: "gramatica", query: "", sort: "recentes" });
  const visible = filterProducts(fixtureProducts, filters);
  assert.deepEqual(visible.map((product) => product.id), ["CEA-009"]);
  const body = documentBody(renderPage({ path, products: fixtureProducts, config: fixtureConfig }).html);
  assert.match(body, /Quem qualifica e quem nomeia/);
  assert.doesNotMatch(body, /Hora de interpretar/);
  assert.match(body, /name="topic" value="gramatica" checked/);
  assert.match(body, /<option value="6" selected>/);
});

test("produto CEA-009 tem página própria, ano correto e preço real", () => {
  const result = renderPage({
    path: "/produto/CEA-009",
    products: fixtureProducts,
    config: { ...fixtureConfig, publicOrigin: "https://loja.example" }
  });
  assert.equal(result.status, 200);
  assert.match(result.html, /<title>Quem qualifica e quem nomeia\? — Adjetivos e substantivos abstratos \| Comunic@ Em Ação<\/title>/);
  assert.match(result.html, /6º ano/);
  assert.match(result.html, /A definir/);
  assert.match(result.html, /rel="canonical" href="https:\/\/loja\.example\/produto\/CEA-009"/);
  assert.match(result.html, /property="og:url" content="https:\/\/loja\.example\/produto\/CEA-009"/);
});

test("rotas e produtos inexistentes retornam 404 real e noindex", () => {
  const missingProduct = renderPage({ path: "/produto/CEA-999", products: fixtureProducts, config: fixtureConfig });
  const missingRoute = renderPage({ path: "/rota-inexistente", products: fixtureProducts, config: fixtureConfig });
  assert.equal(missingProduct.status, 404);
  assert.equal(missingRoute.status, 404);
  assert.match(missingProduct.html, /<meta name="robots" content="noindex,nofollow,noarchive" \/>/);
  assert.doesNotMatch(missingProduct.html, /rel="canonical"/);
  assert.match(missingRoute.html, /Página não encontrada/);
});

test("campos públicos dinâmicos são escapados no HTML e no estado hidratado", () => {
  const malicious = {
    ...fixtureProducts[0],
    id: "CEA-XSS",
    title: '</h1><script>alert("x")</script><h1>',
    description: '<img src=x onerror="alert(1)">',
    image: '/manus-storage/preview" onerror="alert(2)'
  };
  const result = renderPage({
    path: "/produto/CEA-XSS",
    products: [malicious],
    config: { ...fixtureConfig, brandName: 'Marca <script>alert(3)</script>' }
  });
  assert.equal(result.status, 200);
  assert.match(result.html, /&lt;\/h1&gt;&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(result.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(result.html, /<script>alert\(/);
  assert.match(result.html, /\\u003c\/h1\\u003e/);
});

test("páginas protegidas não incluem dados pessoais passados ao renderer", () => {
  const privateUser = { id: "u-1", openId: "owner-secret", name: "Pessoa Privada", email: "private@example.test", role: "admin" };
  for (const path of ["/compras", "/admin"]) {
    const result = renderPage({ path, products: fixtureProducts, config: fixtureConfig, user: privateUser });
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.html, /Pessoa Privada|private@example\.test|owner-secret/);
    assert.match(result.html, /noindex,nofollow,noarchive/);
  }
});
