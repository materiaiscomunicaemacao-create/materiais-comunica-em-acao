const CART_KEY = "comunica-cart-ids-v1";
const MAX_PDF_BYTES = 16 * 1024 * 1024;
const TOPIC_LABELS = {
  leitura: "Leitura e interpretação",
  gramatica: "Gramática",
  figuras: "Figuras de linguagem",
  preposicoes: "Preposições",
  tonicidade: "Sílaba tônica",
  adjetivos: "Adjetivos",
  abstratos: "Substantivos abstratos",
  redacao: "Redação",
  literatura: "Literatura",
  avaliacao: "Avaliações e ENEM"
};
const STAGE_LABELS = {
  fundamental: "Ensino Fundamental II",
  medio: "Ensino Médio",
  todos: "Etapa a confirmar"
};
const YEAR_LABELS = {
  "6": "6º ano",
  "7": "7º ano",
  "8": "8º ano",
  "9": "9º ano",
  m1: "1º ano do Ensino Médio",
  m2: "2º ano do Ensino Médio",
  m3: "3º ano do Ensino Médio"
};
const YEAR_STAGE = { "6": "fundamental", "7": "fundamental", "8": "fundamental", "9": "fundamental", m1: "medio", m2: "medio", m3: "medio" };
const state = readInitialState();
let csrfToken = null;
let session = null;
let currentAdminProducts = [];

function readInitialState() {
  const element = document.querySelector("#store-state");
  if (!element) return { products: [], config: {}, bestSellers: [], path: window.location.pathname };
  try {
    const parsed = JSON.parse(element.textContent || "{}");
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      config: parsed.config && typeof parsed.config === "object" ? parsed.config : {},
      bestSellers: Array.isArray(parsed.bestSellers) ? parsed.bestSellers : [],
      path: typeof parsed.path === "string" ? parsed.path : window.location.pathname
    };
  } catch {
    return { products: [], config: {}, bestSellers: [], path: window.location.pathname };
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function labelForTopic(topic) {
  return TOPIC_LABELS[topic] || String(topic || "Assunto");
}

function labelForStage(stage) {
  return STAGE_LABELS[stage] || String(stage || "Etapa a confirmar");
}

function labelForYear(year) {
  return YEAR_LABELS[year] || String(year || "Ano a confirmar");
}

function productPrice(product) {
  return Number.isInteger(product?.priceCents) && product.priceCents > 0 ? product.priceCents : null;
}

function formatPrice(cents) {
  if (!Number.isInteger(cents) || cents <= 0) return "A definir";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function safeImageUrl(value) {
  const image = String(value || "");
  return image.startsWith("/manus-storage/") ? image : "";
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function readCart() {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id) => typeof id === "string" && id.length > 0))];
  } catch {
    return [];
  }
}

function writeCart(ids) {
  const cleanIds = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cleanIds));
  } catch {
    announce("Não foi possível guardar o carrinho neste navegador.", "error");
  }
  updateCartCount(cleanIds.length);
  return cleanIds;
}

function updateCartCount(count = readCart().length) {
  document.querySelectorAll("[data-cart-count]").forEach((element) => {
    element.textContent = String(count);
    element.setAttribute("aria-label", `${count} ${count === 1 ? "item" : "itens"} no carrinho`);
  });
}

function announce(message, kind = "info") {
  document.querySelectorAll("[data-store-message]").forEach((element) => {
    element.textContent = message;
    element.dataset.kind = kind;
  });
}

function responseMessage(data, fallback) {
  const code = data?.error?.code;
  const message = data?.error?.message;
  const known = {
    PAYMENT_NOT_CONFIGURED: "Checkout indisponível: faltam credenciais ou configurações de pagamento no servidor.",
    PRICE_NOT_SET: "Checkout bloqueado: há material com preço a definir.",
    FILE_NOT_READY: "Checkout bloqueado: há material sem arquivo protegido disponível.",
    COMMERCIAL_REVIEW_REQUIRED: "Checkout bloqueado: a revisão comercial deste material ainda não foi concluída.",
    UNAUTHENTICATED: "Entre na sua conta para continuar.",
    FORBIDDEN: "Você não tem permissão para realizar esta ação.",
    CSRF_INVALID: "A sessão de segurança expirou. Atualize a página e tente novamente.",
    NOT_FOUND: "O registro solicitado não foi encontrado.",
    VALIDATION_ERROR: "Confira os campos informados e tente novamente."
  };
  return known[code] || (typeof message === "string" && message ? message : fallback);
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { response, data };
}

async function refreshStore() {
  try {
    const { response, data } = await apiFetch("/api/store");
    if (!response.ok || !Array.isArray(data?.products)) {
      announce(responseMessage(data, "Não foi possível atualizar o catálogo. O conteúdo exibido é a última resposta SSR disponível."), "error");
      return false;
    }
    state.products = data.products;
    state.config = data.config && typeof data.config === "object" ? data.config : {};
    state.bestSellers = Array.isArray(data.bestSellers) ? data.bestSellers : [];
    updateCartCount();
    return true;
  } catch {
    announce("Não foi possível atualizar o catálogo agora. Tente novamente sem perder a página SSR.", "error");
    return false;
  }
}

function cartProductRows() {
  return readCart().map((id) => ({ id, product: productById(id) }));
}

function renderCartPage() {
  const root = document.querySelector("[data-cart-page]");
  if (!root) return;
  const items = cartProductRows();
  const list = root.querySelector("[data-cart-items]");
  const summary = root.querySelector("[data-cart-summary]");
  const form = root.querySelector("[data-checkout-form]");
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><p class="eyebrow">Carrinho vazio</p><h2>Escolha um material para começar.</h2><p>Os produtos adicionados neste navegador aparecerão aqui.</p><a class="button button-primary" href="/catalogo">Ver catálogo</a></div>`;
    summary.textContent = "Nenhum material selecionado.";
    form.hidden = true;
    updateCartCount(0);
    return;
  }
  const known = items.filter((item) => item.product);
  const missing = items.filter((item) => !item.product);
  list.innerHTML = `${known.map(({ id, product }) => `<article class="cart-item"><a href="/produto/${encodeURIComponent(id)}" class="cart-item-image">${safeImageUrl(product.image) ? `<img src="${escapeHtml(safeImageUrl(product.image))}" alt="Prévia de ${escapeHtml(product.title)}" width="160" height="160" />` : ""}</a><div><h2><a href="/produto/${encodeURIComponent(id)}">${escapeHtml(product.title)}</a></h2><p>${escapeHtml(product.level || "Material pedagógico")} · quantidade 1</p><strong>${escapeHtml(formatPrice(productPrice(product)))}</strong></div><button class="remove-button" type="button" data-remove-product="${escapeHtml(id)}">Remover</button></article>`).join("")}${missing.length ? `<p class="form-message" data-kind="error">${missing.length} item(ns) não estão mais disponíveis. ${missing.map(({ id }) => `<button type="button" class="remove-button" data-remove-product="${escapeHtml(id)}">Remover ${escapeHtml(id)}</button>`).join(" ")}</p>` : ""}`;
  const hasUndefined = known.some(({ product }) => productPrice(product) === null);
  const total = known.reduce((sum, { product }) => sum + (productPrice(product) || 0), 0);
  const missingSetup = Array.isArray(state.config.missingSetup) ? state.config.missingSetup.filter((item) => typeof item === "string" && item.trim()) : [];
  const setupText = missingSetup.length ? missingSetup.join(" · ") : "credenciais, preços, arquivos protegidos ou aprovação editorial";
  summary.innerHTML = `<span>${known.length} ${known.length === 1 ? "material" : "materiais"}</span><strong>${hasUndefined ? "A definir" : escapeHtml(formatPrice(total))}</strong><small>O servidor recalcula o total ao criar o pedido.</small>${state.config.paymentEnabled ? "" : `<small class="warning-text">Dependências/Dados: ${escapeHtml(setupText)}. O checkout pode responder 503 até a configuração.</small>`}`;
  form.hidden = known.length === 0;
  form.dataset.hasUndefined = String(hasUndefined);
  form.querySelector("button[type=submit]").disabled = known.length === 0;
  updateCartCount(items.length);
}

function addToCart(id) {
  const product = productById(id);
  if (!product) {
    announce("Este material não está disponível na resposta atual do catálogo.", "error");
    return;
  }
  const ids = readCart();
  if (!ids.includes(id)) writeCart([...ids, id]);
  else updateCartCount(ids.length);
  document.querySelectorAll(`[data-product-message="${CSS.escape(id)}"]`).forEach((element) => {
    element.textContent = "Material adicionado ao carrinho.";
    element.dataset.kind = "success";
  });
  announce(`${product.title} está no carrinho.`, "success");
  renderCartPage();
}

function removeFromCart(id) {
  writeCart(readCart().filter((item) => item !== id));
  const checkoutForm = document.querySelector("[data-checkout-form]");
  if (checkoutForm) delete checkoutForm.dataset.idempotencyKey;
  renderCartPage();
  announce("Material removido do carrinho.", "success");
}

function queryFilters() {
  const params = new URLSearchParams(window.location.search);
  const availableTopics = new Set(state.products.flatMap((product) => Array.isArray(product.topics) ? product.topics : []));
  const availableYears = new Set(state.products.flatMap((product) => Array.isArray(product.years) ? product.years : []));
  const availableStages = new Set(state.products.map((product) => product.stage).filter((stage) => stage !== "todos"));
  const year = availableYears.has(params.get("year")) ? params.get("year") : "todos";
  const topic = availableTopics.has(params.get("topic")) ? params.get("topic") : "todos";
  let stage = availableStages.has(params.get("stage")) ? params.get("stage") : "todos";
  if (year !== "todos") stage = YEAR_STAGE[year] || stage;
  const sort = ["recentes", "az", "za"].includes(params.get("sort")) ? params.get("sort") : "recentes";
  return { stage, year, topic, sort, query: params.get("q") || params.get("search") || "" };
}

function sortProducts(products, sort) {
  const result = [...products];
  if (sort === "az") return result.sort((a, b) => String(a.title).localeCompare(String(b.title), "pt-BR"));
  if (sort === "za") return result.sort((a, b) => String(b.title).localeCompare(String(a.title), "pt-BR"));
  return result.sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "");
    const bTime = Date.parse(b.createdAt || "");
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return bTime - aTime;
    return String(b.id).localeCompare(String(a.id), "pt-BR");
  });
}

function visibleProducts(filters) {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  return sortProducts(state.products.filter((product) => {
    const searchText = normalize([
      product.title,
      product.description,
      product.id,
      product.level,
      labelForStage(product.stage),
      ...(product.topics || []).map(labelForTopic),
      ...(product.years || []).map(labelForYear),
      ...(product.included || []),
      ...(product.contents || []),
      ...(product.objectives || [])
    ].join(" "));
    return (filters.stage === "todos" || product.stage === filters.stage)
      && (filters.year === "todos" || (product.years || []).includes(filters.year))
      && (filters.topic === "todos" || (product.topics || []).includes(filters.topic))
      && words.every((word) => searchText.includes(word));
  }), filters.sort);
}

function cardTemplate(product) {
  const image = safeImageUrl(product.image);
  const facts = [product.format, product.pages ? `${product.pages} páginas` : "", product.hasAnswerKey ? "Com gabarito" : "", product.edition].filter(Boolean);
  return `<article class="product-card" data-product-card data-product-id="${escapeHtml(product.id)}"><a class="product-image" href="/produto/${encodeURIComponent(product.id)}" aria-label="Ver detalhes de ${escapeHtml(product.title)}">${image ? `<img src="${escapeHtml(image)}" alt="Prévia de ${escapeHtml(product.title)}" width="1200" height="1200" loading="lazy" />` : `<div class="image-placeholder" aria-hidden="true">Prévia não cadastrada</div>`}${product.featured ? `<span class="product-tag">Destaque editorial</span>` : ""}</a><div class="product-info"><p class="product-meta">${escapeHtml((product.topics || []).map(labelForTopic).join(" · ") || "Material pedagógico")}</p><h3><a href="/produto/${encodeURIComponent(product.id)}">${escapeHtml(product.title)}</a></h3><p class="product-description">${escapeHtml(product.description)}</p><div class="product-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div><div class="product-bottom"><small>${escapeHtml(formatPrice(productPrice(product)))}</small><a class="view-product" href="/produto/${encodeURIComponent(product.id)}">Ver detalhes <span aria-hidden="true">→</span></a></div></div></article>`;
}

function renderCatalogResults() {
  const grid = document.querySelector("#product-grid");
  const filterPanel = document.querySelector("#filter-panel");
  if (!grid || !filterPanel) return;
  const filters = queryFilters();
  const visible = visibleProducts(filters);
  grid.innerHTML = visible.length ? visible.map(cardTemplate).join("") : `<div class="empty-state"><p class="eyebrow">Catálogo sem correspondência</p><h3>Nenhum material neste recorte</h3><p>Combine os filtros ou faça uma busca diferente. Não há itens artificiais para preencher o resultado.</p><button class="button button-outline" type="button" data-reset-filters>Ver todos os materiais</button></div>`;
  const count = document.querySelector("#catalog-count");
  if (count) count.textContent = `${visible.length} ${visible.length === 1 ? "material encontrado" : "materiais encontrados"}`;
  const active = document.querySelector("#active-filters");
  if (active) active.textContent = [filters.stage !== "todos" ? labelForStage(filters.stage) : "", filters.year !== "todos" ? labelForYear(filters.year) : "", filters.topic !== "todos" ? labelForTopic(filters.topic) : "", filters.query.trim() ? `Busca: “${filters.query.trim()}”` : ""].filter(Boolean).join(" · ") || "Catálogo completo · organizado por ano e assunto";
  const search = document.querySelector("#site-search");
  if (search) search.value = filters.query;
  document.querySelectorAll("input[name=stage]").forEach((input) => { input.checked = input.value === filters.stage; });
  document.querySelectorAll("input[name=topic]").forEach((input) => { input.checked = input.value === filters.topic; });
  const year = document.querySelector("#year-filter");
  if (year) year.value = filters.year;
  const sort = document.querySelector("#sort-select");
  if (sort) sort.value = filters.sort;
  document.querySelectorAll("#year-filter option").forEach((option) => {
    option.disabled = option.value !== "todos" && filters.stage !== "todos" && YEAR_STAGE[option.value] !== filters.stage;
  });
}

function navigateFilters(changes = {}) {
  const current = queryFilters();
  const next = { ...current, ...changes };
  if (next.year && next.year !== "todos") next.stage = YEAR_STAGE[next.year] || next.stage;
  const params = new URLSearchParams();
  if (next.stage !== "todos") params.set("stage", next.stage);
  if (next.year !== "todos") params.set("year", next.year);
  if (next.topic !== "todos") params.set("topic", next.topic);
  if (next.query.trim()) params.set("q", next.query.trim());
  if (next.sort !== "recentes") params.set("sort", next.sort);
  const query = params.toString();
  const target = `/catalogo${query ? `?${query}` : ""}`;
  if (window.location.pathname !== "/catalogo") {
    window.location.href = target;
    return;
  }
  window.history.pushState({}, "", target);
  renderCatalogResults();
}

function resetFilters() {
  if (window.location.pathname === "/catalogo") {
    window.history.pushState({}, "", "/catalogo");
    renderCatalogResults();
  } else {
    window.location.href = "/catalogo";
  }
}

function startLogin() {
  const origin = window.location.origin;
  window.location.href = `/api/auth/start?origin=${encodeURIComponent(origin)}`;
}

function csrfHeaders() {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

function uuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto?.getRandomValues?.(bytes);
  return `${Date.now().toString(36)}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function loadSession() {
  try {
    const { response, data } = await apiFetch("/api/session");
    if (!response.ok || !data) return { user: null, error: responseMessage(data, "Não foi possível verificar sua sessão.") };
    csrfToken = typeof data.csrfToken === "string" ? data.csrfToken : null;
    session = data;
    return data;
  } catch {
    return { user: null, error: "Não foi possível verificar sua sessão agora." };
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function renderPix(data) {
  const target = document.querySelector("[data-pix-result]");
  if (!target) return;
  const pix = data?.pix;
  if (!pix) {
    target.hidden = false;
    target.innerHTML = `<h3>Pedido preparado</h3><p>O pedido foi registrado pelo servidor. Nenhum código Pix foi exibido porque a API não retornou um dado de pagamento.</p>`;
    return;
  }
  const ticket = safeHttpsUrl(pix.ticketUrl);
  const code = typeof pix.code === "string" ? pix.code : "";
  const qr = typeof pix.qrBase64 === "string" && pix.qrBase64 ? pix.qrBase64 : "";
  target.hidden = false;
  target.innerHTML = `<h3>Pagamento Pix</h3>${code ? `<label class="pix-code-label" for="pix-code">Código Pix</label><textarea id="pix-code" readonly rows="4">${escapeHtml(code)}</textarea>` : ""}${qr ? `<img class="pix-qr" src="${escapeHtml(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`)}" alt="QR Code Pix retornado pela API" />` : ""}${ticket ? `<a class="button button-outline" href="${escapeHtml(ticket)}" rel="noopener">Abrir instruções de pagamento</a>` : ""}${pix.expiresAt ? `<small>Expira em ${escapeHtml(pix.expiresAt)}</small>` : ""}`;
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector("[data-checkout-message]");
  const ids = readCart();
  const rows = cartProductRows().filter((row) => row.product);
  if (!ids.length || !rows.length) {
    message.textContent = "Adicione pelo menos um material ao carrinho.";
    message.dataset.kind = "error";
    return;
  }
  if (form.dataset.hasUndefined === "true" || rows.some(({ product }) => productPrice(product) === null)) {
    message.textContent = "Checkout bloqueado: há material com preço a definir. Remova-o ou aguarde a configuração editorial.";
    message.dataset.kind = "error";
    return;
  }
  const currentSession = session?.user ? session : await loadSession();
  if (!currentSession?.user) {
    message.textContent = "Entre na sua conta para preparar o pedido.";
    message.dataset.kind = "error";
    return;
  }
  if (!csrfToken) {
    message.textContent = "A sessão de segurança não está disponível. Atualize a página e tente novamente.";
    message.dataset.kind = "error";
    return;
  }
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  message.textContent = "Enviando pedido para a API…";
  try {
    const formData = new FormData(form);
    const requestKey = form.dataset.idempotencyKey || uuid();
    form.dataset.idempotencyKey = requestKey;
    const { response, data } = await apiFetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({
        productIds: ids,
        phone: String(formData.get("phone") || "").trim(),
        optIn: formData.get("optIn") === "on",
        email: String(formData.get("email") || "").trim(),
        origin: window.location.origin,
        idempotencyKey: requestKey
      })
    });
    if (!response.ok) {
      message.textContent = responseMessage(data, response.status === 503 ? "Checkout indisponível no servidor até a configuração das dependências." : "Não foi possível preparar o pedido.");
      message.dataset.kind = "error";
      if (response.status === 401) setTimeout(startLogin, 250);
      return;
    }
    message.textContent = "Pedido recebido pela API.";
    message.dataset.kind = "success";
    renderPix(data);
    writeCart([]);
    delete form.dataset.idempotencyKey;
    renderCartPage();
  } catch {
    message.textContent = "Não foi possível conectar ao checkout. Nenhum pagamento foi criado no navegador.";
    message.dataset.kind = "error";
  } finally {
    submit.disabled = false;
  }
}

function orderStatus(status) {
  return ({ pending: "Pendente", paid: "Pago", failed: "Falhou", cancelled: "Cancelado", refunded: "Reembolsado" })[status] || String(status || "Status não informado");
}

function renderOrders(orders) {
  const list = document.querySelector("[data-orders-list]");
  if (!list) return;
  if (!orders.length) {
    list.hidden = false;
    list.innerHTML = `<div class="empty-state"><p class="eyebrow">Nenhum pedido</p><h2>Ainda não há compras nesta conta.</h2><p>Pedidos confirmados aparecerão aqui quando existirem.</p><a class="button button-outline" href="/catalogo">Ver catálogo</a></div>`;
    return;
  }
  list.hidden = false;
  list.innerHTML = orders.map((order) => `<article class="order-card"><div class="order-heading"><div><p class="eyebrow">Pedido ${escapeHtml(order.id)}</p><h2>${escapeHtml(order.createdAt || "Data não informada")}</h2></div><strong class="order-status status-${escapeHtml(order.status)}">${escapeHtml(orderStatus(order.status))}</strong></div><p>Total: ${escapeHtml(formatPrice(order.totalCents))}</p>${order.status === "pending" ? `<button type="button" class="button button-outline" data-view-pix="${escapeHtml(order.id)}">Ver instruções de Pix</button>` : ""}<ul>${(Array.isArray(order.items) ? order.items : []).map((item) => `<li><span>${escapeHtml(item.title || item.productId)} · ${escapeHtml(formatPrice(item.priceCents))}</span>${item.downloadAvailable === true ? `<a href="/api/downloads/${encodeURIComponent(item.productId)}">Baixar PDF</a>` : `<small>Download indisponível até a confirmação</small>`}</li>`).join("")}</ul></article>`).join("");
}

async function showPendingPix(id) {
  const { response, data } = await apiFetch(`/api/orders/${encodeURIComponent(id)}`);
  if (!response.ok) return announce(responseMessage(data, "Não foi possível consultar o Pix."), "error");
  renderPix(data);
  document.querySelector("[data-pix-result]")?.scrollIntoView({ behavior: "auto", block: "center" });
}

async function loadAdminOrders() {
  const target = document.querySelector("[data-admin-orders]");
  if (!target) return;
  try {
    const { response, data } = await apiFetch("/api/admin/orders");
    if (!response.ok) throw new Error(responseMessage(data, "Não foi possível consultar os pedidos."));
    target.innerHTML = (data.orders || []).map((order) => `<article class="order-card"><h3>Pedido ${escapeHtml(order.id)}</h3><p>${escapeHtml(orderStatus(order.status))} · ${escapeHtml(formatPrice(order.totalCents))}</p><p>${escapeHtml(order.email)} · ${escapeHtml(order.phone)}</p><ul>${(order.items || []).map((item) => `<li>${escapeHtml(item.title)}${order.status === "paid" ? ` — <a href="/api/downloads/${encodeURIComponent(item.productId)}">Baixar para entrega</a>` : ""}</li>`).join("")}</ul>${order.phone ? `<a href="https://wa.me/${escapeHtml(order.phone.replace(/\D/g, ""))}" class="button button-outline" target="_blank" rel="noopener">Atender pelo WhatsApp</a>` : ""}</article>`).join("") || "<p>Ainda não há pedidos registrados.</p>";
  } catch (error) { target.textContent = error.message; }
}

function updateAccountCard(currentSession) {
  document.querySelectorAll("[data-account-bar]").forEach((card) => {
    const user = currentSession?.user;
    card.hidden = !user;
    if (!user) return;
    card.querySelector("[data-account-name]").textContent = user.name || user.email || "Conta autenticada";
    card.querySelector("[data-account-email]").textContent = user.email ? ` — ${user.email}` : "";
    card.querySelector("[data-other-account-link]").href = `/api/auth/start?origin=${encodeURIComponent(window.location.origin)}`;
    card.querySelector("[data-account-logout]").hidden = window.self !== window.top;
  });
}

async function initPurchases() {
  const root = document.querySelector("[data-purchases-root]");
  if (!root) return;
  const message = root.querySelector("[data-purchases-message]");
  const login = root.querySelector("[data-purchases-login]");
  const loginLink = root.querySelector("[data-login-link]");
  loginLink.href = `/api/auth/start?origin=${encodeURIComponent(window.location.origin)}`;
  const currentSession = await loadSession();
  updateAccountCard(currentSession);
  if (currentSession.error) {
    message.textContent = currentSession.error;
    message.dataset.kind = "error";
    return;
  }
  if (!currentSession.user) {
    message.hidden = true;
    login.hidden = false;
    return;
  }
  try {
    const { response, data } = await apiFetch("/api/orders");
    if (!response.ok) {
      message.textContent = responseMessage(data, response.status === 403 ? "A conta não tem acesso a estes pedidos." : "Não foi possível carregar seus pedidos.");
      message.dataset.kind = "error";
      return;
    }
    message.hidden = true;
    renderOrders(Array.isArray(data?.orders) ? data.orders : []);
  } catch {
    message.textContent = "Não foi possível carregar seus pedidos agora.";
    message.dataset.kind = "error";
  }
}

function adminProductRow(product) {
  const price = formatPrice(productPrice(product));
  return `<article class="admin-product-row"><div><p class="eyebrow">${escapeHtml(product.id)}</p><h3>${escapeHtml(product.title)}</h3><p>${escapeHtml(product.stage || "todos")} · ${escapeHtml(price)} · ${product.active === false ? "inativo" : "ativo"}</p></div><div class="row-actions"><button class="button button-outline" type="button" data-admin-edit="${escapeHtml(product.id)}">Editar</button><button class="button button-outline danger-button" type="button" data-admin-delete="${escapeHtml(product.id)}">Desativar</button></div></article>`;
}

function setFormValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (!field) return;
  if (field.type === "checkbox") field.checked = value === true;
  else field.value = value ?? "";
}

function ensureAdminOptions(name, values, labels) {
  const container = document.querySelector(`[data-admin-${name}-options]`);
  if (!container) return;
  const inputName = name === "topic" ? "topics" : name === "year" ? "years" : name;
  const known = new Set([...container.querySelectorAll("input")].map((input) => input.value));
  values.filter((value) => !known.has(value)).forEach((value) => {
    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML = `<input type="checkbox" name="${inputName}" value="${escapeHtml(value)}" /> ${escapeHtml(labels(value))}`;
    container.append(label);
  });
}

function clearAdminCheckboxes(form, name) {
  form.querySelectorAll(`input[name="${name}"]`).forEach((input) => { input.checked = false; });
}

function populateAdminForm(product = null) {
  const form = document.querySelector("[data-admin-product-form]");
  if (!form) return;
  form.hidden = false;
  form.dataset.editingId = product?.id || "";
  setFormValue(form, "id", product?.id || "");
  setFormValue(form, "title", product?.title || "");
  setFormValue(form, "description", product?.description || "");
  setFormValue(form, "stage", product?.stage || "todos");
  setFormValue(form, "level", product?.level || "");
  setFormValue(form, "format", product?.format || "PDF digital");
  setFormValue(form, "image", product?.image || "");
  setFormValue(form, "priceCents", Number.isInteger(product?.priceCents) ? product.priceCents : "");
  setFormValue(form, "pages", Number.isInteger(product?.pages) ? product.pages : "");
  setFormValue(form, "edition", product?.edition || "");
  setFormValue(form, "hasAnswerKey", product?.hasAnswerKey === true);
  setFormValue(form, "commercialApproved", product?.commercialApproved === true);
  setFormValue(form, "active", product ? product.active !== false : true);
  setFormValue(form, "featured", product?.featured === true);
  setFormValue(form, "included", (product?.included || []).join("\n"));
  setFormValue(form, "contents", (product?.contents || []).join("\n"));
  setFormValue(form, "objectives", (product?.objectives || []).join("\n"));
  clearAdminCheckboxes(form, "topics");
  clearAdminCheckboxes(form, "years");
  (product?.topics || []).forEach((topic) => { const input = form.querySelector(`input[name="topics"][value="${CSS.escape(topic)}"]`); if (input) input.checked = true; });
  (product?.years || []).forEach((year) => { const input = form.querySelector(`input[name="years"][value="${CSS.escape(year)}"]`); if (input) input.checked = true; });
  const heading = form.querySelector("[data-admin-form-title]");
  if (heading) heading.textContent = product ? `Editar ${product.id}` : "Novo produto";
  const upload = form.querySelector("[data-admin-upload]");
  if (upload) upload.hidden = !product;
  form.querySelector("[data-admin-form-message]").textContent = "";
  form.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function adminPayload(form) {
  const value = (name) => String(form.elements.namedItem(name)?.value || "").trim();
  const lines = (name) => value(name).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const priceRaw = value("priceCents");
  const pagesRaw = value("pages");
  return {
    title: value("title"),
    description: value("description"),
    topics: [...form.querySelectorAll("input[name=topics]:checked")].map((input) => input.value),
    stage: value("stage") || "todos",
    years: [...form.querySelectorAll("input[name=years]:checked")].map((input) => input.value),
    level: value("level"),
    image: value("image"),
    priceCents: priceRaw ? Number(priceRaw) : null,
    pages: pagesRaw ? Number(pagesRaw) : null,
    format: value("format"),
    hasAnswerKey: form.elements.namedItem("hasAnswerKey")?.checked === true,
    included: lines("included"),
    contents: lines("contents"),
    objectives: lines("objectives"),
    featured: form.elements.namedItem("featured")?.checked === true,
    active: form.elements.namedItem("active")?.checked === true,
    commercialApproved: form.elements.namedItem("commercialApproved")?.checked === true
  };
}

async function loadAdminData() {
  const list = document.querySelector("[data-admin-products]");
  const message = document.querySelector("[data-admin-global-message]");
  try {
    const [{ response: productResponse, data: productData }, { response: settingsResponse, data: settingsData }] = await Promise.all([apiFetch("/api/admin/products"), apiFetch("/api/admin/settings")]);
    if (!productResponse.ok) throw new Error(responseMessage(productData, "Não foi possível carregar os produtos administrativos."));
    if (!settingsResponse.ok) throw new Error(responseMessage(settingsData, "Não foi possível carregar as configurações administrativas."));
    currentAdminProducts = Array.isArray(productData?.products) ? productData.products : [];
    list.innerHTML = currentAdminProducts.length ? currentAdminProducts.map(adminProductRow).join("") : `<div class="empty-state"><h3>Nenhum produto administrativo</h3><p>Crie o primeiro produto pela API protegida.</p></div>`;
    populateSettingsForm(settingsData?.config || {});
    ensureAdminOptions("topic", [...new Set(currentAdminProducts.flatMap((product) => product.topics || []))], labelForTopic);
    ensureAdminOptions("year", [...new Set(currentAdminProducts.flatMap((product) => product.years || []))], labelForYear);
    message.textContent = "Dados administrativos atualizados.";
    message.dataset.kind = "success";
  } catch (error) {
    message.textContent = error.message || "Não foi possível carregar os dados administrativos.";
    message.dataset.kind = "error";
  }
}

function populateSettingsForm(config) {
  const form = document.querySelector("[data-admin-settings-form]");
  if (!form) return;
  ["legalName", "taxId", "address", "contactEmail", "whatsappNumber", "publicOrigin", "privacyText", "termsText", "licenseText"].forEach((field) => setFormValue(form, field, config[field] || ""));
  setFormValue(form, "paymentEnabled", config.paymentEnabled === true);
}

async function saveAdminProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector("[data-admin-form-message]");
  const payload = adminPayload(form);
  const id = String(form.elements.namedItem("id")?.value || "").trim();
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/admin/products/${encodeURIComponent(id)}` : "/api/admin/products";
  message.textContent = "Salvando no servidor…";
  try {
    const { response, data } = await apiFetch(url, { method, headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify(payload) });
    if (!response.ok) {
      message.textContent = responseMessage(data, "Não foi possível salvar o produto.");
      message.dataset.kind = "error";
      return;
    }
    message.textContent = "Produto salvo pela API.";
    message.dataset.kind = "success";
    await loadAdminData();
    form.hidden = true;
  } catch {
    message.textContent = "Não foi possível conectar à API administrativa.";
    message.dataset.kind = "error";
  }
}

async function deleteAdminProduct(id) {
  if (!window.confirm("Desativar este produto? A API preservará pedidos existentes.")) return;
  const message = document.querySelector("[data-admin-global-message]");
  try {
    const { response, data } = await apiFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE", headers: csrfHeaders() });
    if (!response.ok) {
      message.textContent = responseMessage(data, "Não foi possível desativar o produto.");
      message.dataset.kind = "error";
      return;
    }
    message.textContent = "Produto desativado pela API.";
    message.dataset.kind = "success";
    await loadAdminData();
  } catch {
    message.textContent = "Não foi possível conectar à API administrativa.";
    message.dataset.kind = "error";
  }
}

async function uploadAdminFile() {
  const form = document.querySelector("[data-admin-product-form]");
  const input = form?.querySelector("[data-admin-file]");
  const message = form?.querySelector("[data-admin-form-message]");
  const id = String(form?.elements.namedItem("id")?.value || "").trim();
  const file = input?.files?.[0];
  if (!id || !file) return;
  if (file.type !== "application/pdf" || file.size > MAX_PDF_BYTES) {
    message.textContent = "Envie um PDF de até 16 MiB. O arquivo é validado novamente pelo servidor.";
    message.dataset.kind = "error";
    return;
  }
  message.textContent = "Enviando PDF bruto para armazenamento protegido…";
  try {
    const { response, data } = await apiFetch(`/api/admin/products/${encodeURIComponent(id)}/file`, { method: "POST", headers: { "Content-Type": "application/pdf", ...csrfHeaders() }, body: await file.arrayBuffer() });
    if (!response.ok) {
      message.textContent = responseMessage(data, "Não foi possível enviar o PDF.");
      message.dataset.kind = "error";
      return;
    }
    message.textContent = "PDF protegido enviado pela API.";
    message.dataset.kind = "success";
    input.value = "";
    await loadAdminData();
  } catch {
    message.textContent = "Não foi possível conectar ao upload administrativo.";
    message.dataset.kind = "error";
  }
}

async function saveAdminSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector("[data-admin-settings-message]");
  const value = (name) => String(form.elements.namedItem(name)?.value || "").trim();
  const payload = { legalName: value("legalName"), taxId: value("taxId"), address: value("address"), contactEmail: value("contactEmail"), whatsappNumber: value("whatsappNumber"), publicOrigin: value("publicOrigin"), privacyText: value("privacyText"), termsText: value("termsText"), licenseText: value("licenseText"), paymentEnabled: form.elements.namedItem("paymentEnabled")?.checked === true };
  message.textContent = "Salvando configurações no servidor…";
  try {
    const { response, data } = await apiFetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json", ...csrfHeaders() }, body: JSON.stringify(payload) });
    if (!response.ok) {
      message.textContent = responseMessage(data, "Não foi possível salvar as configurações.");
      message.dataset.kind = "error";
      return;
    }
    message.textContent = "Configurações salvas pela API.";
    message.dataset.kind = "success";
    state.config = data?.config || state.config;
  } catch {
    message.textContent = "Não foi possível conectar à API de configurações.";
    message.dataset.kind = "error";
  }
}

async function initAdmin() {
  const root = document.querySelector("[data-admin-root]");
  if (!root) return;
  const message = root.querySelector("[data-admin-message]");
  const setup = root.querySelector("[data-admin-setup]");
  const content = root.querySelector("[data-admin-content]");
  const currentSession = await loadSession();
  updateAccountCard(currentSession);
  if (currentSession.error) {
    message.textContent = currentSession.error;
    message.dataset.kind = "error";
    setup.hidden = false;
    return;
  }
  if (!currentSession.user || currentSession.user.role !== "admin") {
    message.hidden = true;
    setup.hidden = false;
    return;
  }
  message.hidden = true;
  content.hidden = false;
  await loadAdminData();
  await loadAdminOrders();
}

async function logout() {
  const currentSession = session || await loadSession();
  if (!csrfToken) {
    announce("A sessão de segurança não está disponível. Atualize a página.", "error");
    return;
  }
  try {
    const { response, data } = await apiFetch("/api/auth/logout", { method: "POST", headers: csrfHeaders() });
    if (!response.ok) {
      announce(responseMessage(data, "Não foi possível encerrar a sessão."), "error");
      return;
    }
    window.location.href = "/compras";
  } catch {
    announce("Não foi possível encerrar a sessão agora.", "error");
  }
}

function setupNavigation() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  if (toggle && nav) toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar navegação" : "Abrir navegação");
    nav.classList.toggle("mobile-open", open);
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("a,button");
    if (!target) return;
    if (target.matches("[data-add-product]")) addToCart(target.dataset.addProduct);
    if (target.matches("[data-remove-product]")) removeFromCart(target.dataset.removeProduct);
    if (target.matches("[data-reset-filters]")) resetFilters();
    if (target.matches("[data-view-pix]")) showPendingPix(target.dataset.viewPix);
    if (target.matches("[data-login]")) { event.preventDefault(); startLogin(); }
    if (target.matches("[data-logout]")) { event.preventDefault(); logout(); }
    if (target.matches("[data-admin-new]")) populateAdminForm();
    if (target.matches("[data-admin-cancel]")) { const form = target.closest("form"); form.hidden = true; }
    if (target.matches("[data-admin-edit]")) populateAdminForm(currentAdminProducts.find((product) => product.id === target.dataset.adminEdit));
    if (target.matches("[data-admin-delete]")) deleteAdminProduct(target.dataset.adminDelete);
    if (target.matches("[data-admin-upload]")) target.closest("form").querySelector("[data-admin-file]").click();
    if (target.matches("a[href^='/'], a[href^='#']") && nav?.classList.contains("mobile-open")) {
      nav.classList.remove("mobile-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
  document.querySelectorAll(".nav-dropdown").forEach((current) => current.addEventListener("toggle", () => {
    if (current.open) document.querySelectorAll(".nav-dropdown").forEach((other) => { if (other !== current) other.open = false; });
  }));
}

function setupFilters() {
  const panel = document.querySelector("#filter-panel");
  if (!panel) return;
  const smallScreen = window.matchMedia("(max-width: 760px)");
  const syncPanel = () => { panel.open = !smallScreen.matches; };
  syncPanel();
  smallScreen.addEventListener("change", syncPanel);
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches("input[name=stage]")) navigateFilters({ stage: target.value, year: target.value === "todos" ? "todos" : queryFilters().year });
    if (target.matches("input[name=topic]")) navigateFilters({ topic: target.value });
    if (target.matches("#year-filter")) navigateFilters({ year: target.value });
    if (target.matches("#sort-select")) navigateFilters({ sort: target.value });
  });
  const search = document.querySelector(".header-search");
  search?.addEventListener("submit", (event) => {
    if (window.location.pathname !== "/catalogo") return;
    event.preventDefault();
    navigateFilters({ query: String(search.elements.namedItem("q")?.value || "") });
    document.querySelector("#catalogo")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  window.addEventListener("popstate", renderCatalogResults);
  renderCatalogResults();
}

function setupCheckout() {
  document.querySelector("[data-checkout-form]")?.addEventListener("submit", submitCheckout);
}

function setupAdminForms() {
  document.querySelector("[data-admin-product-form]")?.addEventListener("submit", saveAdminProduct);
  document.querySelector("[data-admin-settings-form]")?.addEventListener("submit", saveAdminSettings);
  document.querySelector("[data-admin-file]")?.addEventListener("change", uploadAdminFile);
}

function setupProtectedPreview() {
  const preview = document.querySelector("[data-protected-preview]");
  if (!preview) return;
  const stop = (event) => {
    event.preventDefault();
    announce("Esta é uma prévia protegida. O arquivo completo não é exibido nesta página.", "info");
  };
  ["contextmenu", "selectstart", "dragstart", "copy", "cut"].forEach((eventName) => preview.addEventListener(eventName, stop));
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (["c", "p", "s", "u"].includes(String(event.key).toLowerCase())) {
      event.preventDefault();
      announce("Esta ação está desativada na visualização protegida.", "info");
    }
  });
}

async function initialize() {
  updateCartCount();
  setupNavigation();
  setupFilters();
  setupCheckout();
  setupAdminForms();
  setupProtectedPreview();
  renderCartPage();
  await refreshStore();
  renderCatalogResults();
  renderCartPage();
  await Promise.all([initPurchases(), initAdmin()]);
}

initialize();
