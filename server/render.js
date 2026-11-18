const LOGO = "/manus-storage/logo-comunica-em-acao-completa_c179155b.png";

const TOPICS = Object.freeze({
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
});

const STAGES = Object.freeze({
  fundamental: "Ensino Fundamental II",
  medio: "Ensino Médio",
  todos: "Etapa a confirmar"
});

const YEARS = Object.freeze({
  "6": "6º ano",
  "7": "7º ano",
  "8": "8º ano",
  "9": "9º ano",
  m1: "1º ano do Ensino Médio",
  m2: "2º ano do Ensino Médio",
  m3: "3º ano do Ensino Médio"
});

const YEAR_STAGE = Object.freeze({
  "6": "fundamental",
  "7": "fundamental",
  "8": "fundamental",
  "9": "fundamental",
  m1: "medio",
  m2: "medio",
  m3: "medio"
});

const TOPIC_ORDER = [
  "leitura",
  "gramatica",
  "figuras",
  "preposicoes",
  "tonicidade",
  "adjetivos",
  "abstratos",
  "redacao",
  "literatura",
  "avaliacao"
];

const YEAR_ORDER = ["6", "7", "8", "9", "m1", "m2", "m3"];

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function integerOrNull(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function publicProduct(product = {}) {
  const priceCents = integerOrNull(product.priceCents);
  return {
    id: stringValue(product.id),
    title: stringValue(product.title, "Material sem título"),
    description: stringValue(product.description),
    topics: asArray(product.topics).map(String),
    stage: stringValue(product.stage, "todos"),
    years: asArray(product.years).map(String),
    level: stringValue(product.level),
    image: stringValue(product.image),
    priceCents,
    pages: integerOrNull(product.pages),
    format: stringValue(product.format, "PDF digital"),
    hasAnswerKey: product.hasAnswerKey === true,
    included: asArray(product.included).map(String),
    contents: asArray(product.contents).map(String),
    objectives: asArray(product.objectives).map(String),
    featured: product.featured === true,
    active: product.active !== false,
    sellable: product.sellable === true,
    createdAt: stringValue(product.createdAt),
    edition: stringValue(product.edition)
  };
}

function publicConfig(config = {}) {
  return {
    brandName: stringValue(config.brandName, "Comunic@ Em Ação"),
    whatsappNumber: stringValue(config.whatsappNumber),
    contactEmail: stringValue(config.contactEmail),
    legalName: stringValue(config.legalName),
    taxId: stringValue(config.taxId),
    address: stringValue(config.address),
    privacyText: stringValue(config.privacyText),
    termsText: stringValue(config.termsText),
    licenseText: stringValue(config.licenseText),
    publicOrigin: stringValue(config.publicOrigin),
    paymentPrepared: config.paymentPrepared === true,
    paymentEnabled: config.paymentEnabled === true,
    whatsappAutomatic: config.whatsappAutomatic === true,
    missingSetup: asArray(config.missingSetup).map(String)
  };
}

function activeProducts(products) {
  return asArray(products).map(publicProduct).filter((product) => product.id && product.active);
}

function labelForTopic(topic) {
  return TOPICS[topic] || String(topic || "Assunto");
}

function labelForStage(stage) {
  return STAGES[stage] || String(stage || "Etapa a confirmar");
}

function labelForYear(year) {
  return YEARS[year] || String(year || "Ano a confirmar");
}

function productTopics(product) {
  return product.topics.map(labelForTopic).filter(Boolean);
}

function productYears(product) {
  return product.years.map(labelForYear).filter(Boolean);
}

function productLevel(product) {
  if (product.level) return product.level;
  if (product.years.length) return productYears(product).join(" e ");
  return labelForStage(product.stage);
}

function formatPrice(priceCents) {
  if (!Number.isInteger(priceCents) || priceCents <= 0) return "A definir";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100);
}

function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function sortProducts(items, sort = "recentes") {
  const copy = [...items];
  if (sort === "az") return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  if (sort === "za") return copy.sort((a, b) => b.title.localeCompare(a.title, "pt-BR"));
  return copy.sort((a, b) => {
    const dateA = Date.parse(a.createdAt);
    const dateB = Date.parse(b.createdAt);
    if (Number.isFinite(dateA) && Number.isFinite(dateB) && dateA !== dateB) return dateB - dateA;
    return b.id.localeCompare(a.id, "pt-BR");
  });
}

function stageForYear(year) {
  return YEAR_STAGE[year] || "todos";
}

function validChoice(value, choices) {
  return choices.includes(value) ? value : "todos";
}

export function parseFilters(path, products = []) {
  let url;
  try {
    url = new URL(path || "/", "https://renderer.invalid");
  } catch {
    url = new URL("/", "https://renderer.invalid");
  }
  const availableTopics = new Set(products.flatMap((product) => product.topics));
  const availableYears = new Set(products.flatMap((product) => product.years));
  const availableStages = new Set(products.map((product) => product.stage).filter((stage) => stage !== "todos"));
  const requestedYear = url.searchParams.get("year") || "todos";
  const requestedTopic = url.searchParams.get("topic") || "todos";
  const requestedStage = url.searchParams.get("stage") || "todos";
  const year = requestedYear !== "todos" && availableYears.has(requestedYear) ? requestedYear : "todos";
  const topic = requestedTopic !== "todos" && availableTopics.has(requestedTopic) ? requestedTopic : "todos";
  let stage = requestedStage !== "todos" && availableStages.has(requestedStage) ? requestedStage : "todos";
  if (year !== "todos") stage = stageForYear(year);
  const sort = validChoice(url.searchParams.get("sort") || "recentes", ["recentes", "az", "za"]);
  const query = url.searchParams.get("q") || url.searchParams.get("search") || "";
  return { stage, year, topic, query, sort };
}

export function filterProducts(products, filters = {}) {
  const words = normalizeSearch(filters.query).split(/\s+/).filter(Boolean);
  const visible = products.filter((product) => {
    const haystack = normalizeSearch([
      product.title,
      product.description,
      product.id,
      product.level,
      labelForStage(product.stage),
      ...productTopics(product),
      ...productYears(product),
      ...asArray(product.included),
      ...asArray(product.contents),
      ...asArray(product.objectives)
    ].join(" "));
    return (filters.stage === "todos" || product.stage === filters.stage)
      && (filters.year === "todos" || product.years.includes(filters.year))
      && (filters.topic === "todos" || product.topics.includes(filters.topic))
      && words.every((word) => haystack.includes(word));
  });
  return sortProducts(visible, filters.sort);
}

function availableTopicKeys(products) {
  const present = new Set(products.flatMap((product) => product.topics));
  return TOPIC_ORDER.filter((topic) => present.has(topic));
}

function availableYearKeys(products) {
  const present = new Set(products.flatMap((product) => product.years));
  return YEAR_ORDER.filter((year) => present.has(year));
}

function availableStageKeys(products) {
  const present = new Set(products.map((product) => product.stage));
  return ["fundamental", "medio"].filter((stage) => present.has(stage));
}

function queryString(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "todos" && value !== "recentes") query.set(key, value);
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

function renderHeader(products, config, path) {
  const filters = parseFilters(path, products);
  const stageKeys = availableStageKeys(products);
  const topicKeys = availableTopicKeys(products);
  const yearKeys = availableYearKeys(products);
  const stageMenu = stageKeys.map((stage) => {
    const stageYears = yearKeys.filter((year) => stageForYear(year) === stage);
    return `<details class="nav-dropdown"><summary>${escapeHtml(labelForStage(stage))}</summary><div class="nav-dropdown-menu"><a href="/catalogo${escapeHtml(queryString({ stage }))}">Ver todos</a>${stageYears.map((year) => `<a href="/catalogo${escapeHtml(queryString({ stage, year }))}">${escapeHtml(labelForYear(year))}</a>`).join("")}</div></details>`;
  }).join("");
  const topicMenu = topicKeys.length ? `<details class="nav-dropdown"><summary>Assuntos</summary><div class="nav-dropdown-menu">${topicKeys.map((topic) => `<a href="/catalogo${escapeHtml(queryString({ topic }))}">${escapeHtml(labelForTopic(topic))}</a>`).join("")}</div></details>` : "";
  return `<div class="announcement">Materiais autorais <span aria-hidden="true">·</span> PDF digital <span aria-hidden="true">·</span> Planeje sua aula</div>
<header class="site-header section-shell" id="inicio">
  <a class="brand" href="/" aria-label="${escapeHtml(config.brandName)} — início"><img src="${LOGO}" alt="" width="55" height="50" /><span class="brand-copy"><strong>Comunic@</strong><em>em Ação</em></span></a>
  <form class="header-search" action="/catalogo" method="get" role="search"><label class="sr-only" for="site-search">Buscar materiais por título ou assunto</label><input id="site-search" name="q" type="search" value="${escapeHtml(filters.query)}" placeholder="Busque por título ou assunto…" autocomplete="off" /><button type="submit" aria-label="Buscar materiais"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg></button></form>
  <button class="menu-toggle" type="button" aria-label="Abrir navegação" aria-expanded="false" aria-controls="main-nav"><span></span><span></span></button>
  <nav class="main-nav" id="main-nav" aria-label="Navegação principal"><a href="/">Início</a><a href="/catalogo">Materiais</a><a href="/sobre">Sobre</a><a href="/contato">Contato</a><a href="/compras">Compras</a><a href="/carrinho" class="cart-link">Carrinho <span class="cart-count" data-cart-count aria-live="polite">0</span></a><a href="/admin">Admin</a></nav>
</header>
<nav class="category-bar" aria-label="Navegar por etapa ou assunto"><div class="category-inner section-shell"><a href="/catalogo">Todos os materiais</a>${stageMenu}${topicMenu}</div></nav>`;
}

function renderFooter(config) {
  return `<footer class="site-footer"><div class="footer-main section-shell"><div class="footer-about"><a class="brand footer-brand" href="/"><img src="${LOGO}" alt="" width="55" height="50" /><span class="brand-copy"><strong>Comunic@</strong><em>em Ação</em></span></a><p>Materiais autorais.<br />Ideias que entram em ação.</p></div><div class="footer-column"><h3>Explore</h3><a href="/catalogo">Todos os materiais</a><a href="/sobre">Sobre a loja</a><a href="/contato">Contato</a></div><div class="footer-column"><h3>Atendimento</h3><a href="/compras">Minhas compras</a><a href="/carrinho">Carrinho</a><a href="/admin">Área protegida</a></div><div class="footer-column"><h3>Informações</h3><a href="/contato">Fale conosco</a><a href="/sobre#licenca">Licença de uso</a><span>${escapeHtml(config.contactEmail || "Contato ainda não configurado")}</span></div></div><div class="footer-bottom section-shell"><span>© 2026 ${escapeHtml(config.brandName)}</span><span>Materiais digitais para a sala de aula</span></div></footer>`;
}

function renderProductCard(product, extraClass = "") {
  const topics = productTopics(product).join(" · ");
  const facts = [product.format, product.pages ? `${product.pages} páginas` : "", product.hasAnswerKey ? "Com gabarito" : "", product.edition].filter(Boolean);
  const title = escapeHtml(product.title);
  const image = product.image ? `<img src="${escapeHtml(product.image)}" alt="Prévia de ${title}" width="1200" height="1200" loading="lazy" />` : `<div class="image-placeholder" aria-hidden="true">Prévia não cadastrada</div>`;
  return `<article class="product-card ${escapeHtml(extraClass)}" data-product-card data-product-id="${escapeHtml(product.id)}"><a class="product-image" href="/produto/${encodeURIComponent(product.id)}" aria-label="Ver detalhes de ${title}">${image}${product.featured ? `<span class="product-tag">Destaque editorial</span>` : ""}</a><div class="product-info"><p class="product-meta">${escapeHtml(topics || "Material pedagógico")}</p><h3><a href="/produto/${encodeURIComponent(product.id)}">${title}</a></h3><p class="product-description">${escapeHtml(product.description)}</p><div class="product-facts">${facts.map((fact) => `<span>${escapeHtml(fact)}</span>`).join("")}</div><div class="product-bottom"><small>${escapeHtml(formatPrice(product.priceCents))}</small><a class="view-product" href="/produto/${encodeURIComponent(product.id)}">Ver detalhes <span aria-hidden="true">→</span></a></div></div></article>`;
}

function renderProductGrid(products, emptyTitle = "Nenhum material neste recorte", emptyText = "Combine os filtros de etapa, ano, assunto ou busca para consultar os materiais cadastrados.") {
  if (!products.length) return `<div class="empty-state"><p class="eyebrow">Catálogo sem correspondência</p><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyText)}</p><a class="button button-outline" href="/catalogo">Ver todos os materiais</a></div>`;
  return products.map((product) => renderProductCard(product)).join("");
}

function renderFilters(products, filters) {
  const stageKeys = availableStageKeys(products);
  const topicKeys = availableTopicKeys(products);
  const yearKeys = availableYearKeys(products);
  return `<details class="filter-panel" id="filter-panel" open><summary class="filter-panel-summary">Filtrar materiais <span aria-hidden="true">+</span></summary><div class="filter-content"><fieldset class="filter-group"><legend>Etapa escolar</legend><label><input type="radio" name="stage" value="todos" ${filters.stage === "todos" ? "checked" : ""} /> Todas as etapas</label>${stageKeys.map((stage) => `<label><input type="radio" name="stage" value="${escapeHtml(stage)}" ${filters.stage === stage ? "checked" : ""} /> ${escapeHtml(labelForStage(stage))}</label>`).join("")}</fieldset><div class="filter-group"><label class="filter-label" for="year-filter">Ano escolar</label><select id="year-filter"><option value="todos" ${filters.year === "todos" ? "selected" : ""}>Todos os anos</option>${yearKeys.map((year) => `<option value="${escapeHtml(year)}" ${filters.year === year ? "selected" : ""}>${escapeHtml(labelForYear(year))}</option>`).join("")}</select></div><fieldset class="filter-group"><legend>Assunto</legend><label><input type="radio" name="topic" value="todos" ${filters.topic === "todos" ? "checked" : ""} /> Todos os assuntos</label>${topicKeys.map((topic) => `<label class="${topic === "figuras" || topic === "preposicoes" || topic === "tonicidade" || topic === "adjetivos" || topic === "abstratos" ? "sub-filter" : ""}"><input type="radio" name="topic" value="${escapeHtml(topic)}" ${filters.topic === topic ? "checked" : ""} /> ${escapeHtml(labelForTopic(topic))}</label>`).join("")}</fieldset><button class="clear-filters" type="button" data-reset-filters>Limpar todos os filtros</button></div></details>`;
}

function filtersText(filters) {
  return [
    filters.stage !== "todos" ? labelForStage(filters.stage) : "",
    filters.year !== "todos" ? labelForYear(filters.year) : "",
    filters.topic !== "todos" ? labelForTopic(filters.topic) : "",
    filters.query.trim() ? `Busca: “${filters.query.trim()}”` : ""
  ].filter(Boolean).join(" · ") || "Catálogo completo · organizado por ano e assunto";
}

function renderCatalogPage(products, path) {
  const filters = parseFilters(path, products);
  const visible = filterProducts(products, filters);
  return `<main id="conteudo"><section class="catalogue section-shell" id="catalogo" aria-labelledby="catalogue-title"><div class="section-heading"><div><p class="eyebrow">Escolha para sua turma</p><h1 id="catalogue-title">Nossos materiais</h1></div><p class="section-intro">Comece pelo ano ou pelo assunto.<br />Combine os filtros para encontrar sua proposta.</p></div><div class="catalog-layout">${renderFilters(products, filters)}<div class="catalog-results"><div class="catalog-toolbar"><p id="catalog-count" role="status" aria-live="polite">${visible.length} ${visible.length === 1 ? "material encontrado" : "materiais encontrados"}</p><label for="sort-select">Ordenar por <select id="sort-select"><option value="recentes" ${filters.sort === "recentes" ? "selected" : ""}>Ordem de cadastro</option><option value="az" ${filters.sort === "az" ? "selected" : ""}>Título: A a Z</option><option value="za" ${filters.sort === "za" ? "selected" : ""}>Título: Z a A</option></select></label></div><p class="active-filters" id="active-filters">${escapeHtml(filtersText(filters))}</p><div class="product-grid" id="product-grid">${renderProductGrid(visible)}</div><div class="catalog-note"><strong>O catálogo está crescendo.</strong><p>Novos materiais serão organizados por ano e assunto, sempre com prévia e descrição.</p><a href="/contato">Sugerir um tema <span aria-hidden="true">→</span></a></div></div></div></section></main>`;
}

function renderHome(products, config, bestSellers) {
  const curated = products.filter((product) => product.featured);
  const highlights = (curated.length ? curated : sortProducts(products)).slice(0, 3);
  const novelties = sortProducts(products).slice(0, 3);
  const topicKeys = availableTopicKeys(products);
  const sellerProducts = asArray(bestSellers).map(String).map((id) => products.find((product) => product.id === id)).filter(Boolean);
  const heroProduct = highlights[0];
  return `<main id="conteudo"><section class="hero section-shell" aria-labelledby="hero-title"><div class="hero-copy"><p class="eyebrow">Língua Portuguesa · Ensino Fundamental II e Médio</p><h1 id="hero-title">Mais ideias.<br /><em>Mais aula em ação.</em></h1><p class="hero-lede">Leitura, gramática, redação e literatura em materiais autorais. Encontre a proposta que combina com a sua turma.</p><a class="button button-primary" href="/catalogo">Encontrar meu material <span aria-hidden="true">→</span></a><div class="hero-tags"><span>Atividades em PDF</span><span>Prévias dos materiais</span></div></div>${heroProduct ? `<figure class="hero-art"><a href="/produto/${encodeURIComponent(heroProduct.id)}">${heroProduct.image ? `<img src="${escapeHtml(heroProduct.image)}" alt="Prévia de ${escapeHtml(heroProduct.title)}" width="1200" height="1200" />` : ""}</a><figcaption><span>PRÉVIA EDITORIAL</span>${escapeHtml(heroProduct.title)} · ${escapeHtml(productLevel(heroProduct))}</figcaption></figure>` : ""}</section><div class="benefits-bar"><div class="section-shell benefits-inner"><span><b>01</b> Escolha por ano escolar</span><span><b>02</b> Explore por assunto</span><span><b>03</b> Confira a prévia e os detalhes</span></div></div><section class="editorial-section section-shell" aria-labelledby="featured-title"><div class="section-heading"><div><p class="eyebrow">Curadoria editorial</p><h2 id="featured-title">Destaques da loja</h2></div><a class="text-link" href="/catalogo">Ver catálogo completo →</a></div><div class="product-grid product-grid-3">${renderProductGrid(highlights, "Ainda não há destaques cadastrados", "Os materiais aparecerão aqui depois da revisão editorial.")}</div></section><section class="editorial-section editorial-soft" aria-labelledby="new-title"><div class="section-shell"><div class="section-heading"><div><p class="eyebrow">Entradas do catálogo</p><h2 id="new-title">Novidades</h2></div><p class="section-intro">Conheça as propostas mais recentes da coleção.</p></div><div class="product-grid product-grid-3">${renderProductGrid(novelties, "Nenhuma novidade cadastrada", "Ainda não há materiais públicos para esta seção.")}</div></div></section><section class="category-section section-shell" aria-labelledby="category-title"><div class="section-heading"><div><p class="eyebrow">Navegue por assunto</p><h2 id="category-title">Encontre por assunto</h2></div><p class="section-intro">Da revisão de gramática à leitura e à escrita.</p></div><div class="category-grid">${topicKeys.map((topic) => `<a class="category-card" href="/catalogo${escapeHtml(queryString({ topic }))}"><span>${escapeHtml(labelForTopic(topic))}</span><small>${products.filter((product) => product.topics.includes(topic)).length} ${products.filter((product) => product.topics.includes(topic)).length === 1 ? "material" : "materiais"}</small><b aria-hidden="true">→</b></a>`).join("")}</div></section><section class="seller-section section-shell" aria-labelledby="seller-title"><div class="section-heading"><div><p class="eyebrow">Pedidos pagos</p><h2 id="seller-title">Mais vendidos</h2></div><p class="section-intro">Popularidade calculada somente a partir de pedidos confirmados.</p></div>${sellerProducts.length ? `<div class="product-grid product-grid-3">${sellerProducts.map((product) => renderProductCard(product)).join("")}</div>` : `<div class="honest-empty"><strong>Ainda não há dados de pedidos pagos.</strong><p>Esta seção será atualizada após as primeiras vendas confirmadas.</p></div>`}</section><section class="catalogue home-catalogue section-shell" id="catalogo" aria-labelledby="home-catalog-title"><div class="section-heading"><div><p class="eyebrow">Todos os materiais</p><h2 id="home-catalog-title">Explore a coleção</h2></div><a class="text-link" href="/catalogo">Abrir filtros →</a></div><div class="product-grid" id="product-grid">${renderProductGrid(products)}</div></section><section class="how" aria-labelledby="how-title"><div class="section-shell"><div class="section-heading"><div><p class="eyebrow">Compra e entrega</p><h2 id="how-title">Do catálogo à sua sala.</h2></div><p class="section-intro">O pedido é recalculado no servidor<br />antes de qualquer cobrança.</p></div><div class="steps"><article class="step"><span class="step-no">01</span><h3>Escolha o material</h3><p>Veja a prévia, o ano indicado e o que acompanha a atividade.</p></article><article class="step"><span class="step-no">02</span><h3>Confira o pedido</h3><p>Adicione materiais ao carrinho; preços a definir continuam bloqueados no checkout.</p></article><article class="step"><span class="step-no">03</span><h3>Receba com segurança</h3><p>Após confirmação do pagamento, o arquivo aparece na área de compras quando estiver disponível.</p></article></div><div class="setup-note"><strong>${escapeHtml(config.paymentEnabled && config.paymentPrepared ? "Pagamentos configurados" : "Loja em preparação")}</strong><p>${escapeHtml(config.paymentEnabled && config.paymentPrepared ? "O checkout usa os dados do servidor e não aceita valores enviados pelo navegador." : "Preços, arquivos protegidos e credenciais de pagamento ainda precisam ser configurados antes das vendas.")}</p></div></div></section><section class="about" id="sobre"><div class="section-shell about-inner"><div><p class="eyebrow">Comunic@ Em Ação</p><h2>Comunicar é o primeiro passo<br /><em>para transformar.</em></h2></div><p>Materiais autorais que aproximam leitura, escrita e reflexão sobre a língua. Propostas para apoiar professores e abrir espaço para a participação de quem aprende.</p></div></section><section class="contact section-shell" id="contato"><div class="contact-card"><div><p class="eyebrow">Vamos conversar</p><h2>Precisa de ajuda para escolher?</h2><p>Confira os detalhes de cada atividade ou tire suas dúvidas sobre a entrega.</p></div><div class="contact-action">${config.whatsappNumber ? `<a class="button button-primary" href="https://wa.me/${escapeHtml(config.whatsappNumber.replace(/\D/g, ""))}">Acompanhar atendimento <span aria-hidden="true">→</span></a>` : `<a class="button button-outline" href="/contato">Ver contato</a>`}<small>${escapeHtml(config.whatsappNumber ? "Atendimento pelo WhatsApp" : "WhatsApp ainda não configurado")}</small></div></div></section></main>`;
}

function renderProductDetail(product) {
  const topicText = productTopics(product).join(" · ");
  const yearsText = productYears(product).join(" · ") || productLevel(product);
  const included = product.included.length ? `<section><h2>O que acompanha</h2><ul class="detail-list">${product.included.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : "";
  const contents = product.contents.length ? `<section><h2>Conteúdos</h2><ul class="detail-list">${product.contents.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : "";
  const objectives = product.objectives.length ? `<section><h2>Objetivos pedagógicos</h2><ul class="detail-list">${product.objectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : "";
  return `<main id="conteudo"><div class="breadcrumb section-shell"><a href="/catalogo">Catálogo</a><span aria-hidden="true">/</span><span>${escapeHtml(product.id)}</span></div><article class="product-detail section-shell"><div class="detail-preview protected-preview" data-protected-preview tabindex="0" aria-label="Visualização protegida de ${escapeHtml(product.title)}"><div class="preview-watermark" aria-hidden="true">PRÉVIA PROTEGIDA · COMUNIC@ EM AÇÃO · NÃO COPIAR</div>${product.image ? `<img src="${escapeHtml(product.image)}" alt="Prévia protegida de ${escapeHtml(product.title)}" width="1200" height="1200" draggable="false" />` : ""}<p><strong>Visualização permitida somente como amostra.</strong> A prévia tem marca d’água e não contém o PDF completo. Seleção, arrastar, impressão e atalhos de cópia são desativados nesta área.</p></div><div class="detail-copy"><p class="eyebrow">${escapeHtml(product.id)} · ${escapeHtml(topicText || "Material pedagógico")}</p><h1>${escapeHtml(product.title)}</h1><p class="detail-description">${escapeHtml(product.description)}</p><dl class="product-specs"><div><dt>Para quem</dt><dd>${escapeHtml(yearsText)}</dd></div><div><dt>Formato</dt><dd>${escapeHtml(product.format)}</dd></div>${product.pages ? `<div><dt>Quantidade</dt><dd>${product.pages} páginas</dd></div>` : ""}${product.edition ? `<div><dt>Edição</dt><dd>${escapeHtml(product.edition)}</dd></div>` : ""}${product.hasAnswerKey ? `<div><dt>Gabarito</dt><dd>Incluído conforme descrição editorial</dd></div>` : ""}</dl>${contents}${objectives}${included}<div class="purchase-box"><div><span class="price-label">Preço</span><strong>${escapeHtml(formatPrice(product.priceCents))}</strong></div><p>${product.priceCents === null ? "Preço a definir. O material pode ser listado no carrinho, mas o checkout permanece bloqueado até a configuração." : "O valor final é conferido novamente pelo servidor no checkout."}</p><button class="button button-primary" type="button" data-add-product="${escapeHtml(product.id)}">Adicionar ao carrinho <span aria-hidden="true">→</span></button><span class="inline-status" data-product-message="${escapeHtml(product.id)}" role="status" aria-live="polite"></span></div></div></article></main>`;
}

function renderAbout(config) {
  return `<main id="conteudo"><section class="page-intro section-shell"><p class="eyebrow">Comunic@ Em Ação</p><h1>Materiais para colocar a linguagem em movimento.</h1><p>Esta é uma loja editorial de materiais autorais para aulas de Língua Portuguesa. A coleção aproxima leitura, escrita, gramática e literatura de propostas que cabem na rotina de quem ensina.</p></section><section class="prose-section section-shell"><div class="prose-grid"><div><p class="eyebrow">Nosso compromisso</p><h2>Conheça cada proposta antes de escolher.</h2></div><div><p>As páginas públicas mostram as prévias, os conteúdos informados e o público indicado de cada material. Quando uma informação ainda não foi confirmada, ela aparece como “a definir” ou “ano a confirmar”.</p><p>Confira a ficha de cada produto para conhecer o conteúdo e verificar se ele acompanha gabarito.</p></div></div></section><section class="prose-section section-shell" id="licenca"><div class="prose-grid"><div><p class="eyebrow">Licença</p><h2>Uso pedagógico responsável.</h2></div><div><p>${escapeHtml(config.licenseText || "A licença final será apresentada antes da ativação comercial. As prévias não disponibilizam o PDF completo e a redistribuição pública depende de autorização.")}</p><p>Os detalhes legais são mantidos pelo painel administrativo e serão publicados somente quando revisados.</p></div></div></section></main>`;
}

function renderContact(config) {
  const contactDetails = [config.contactEmail ? `<p><strong>E-mail</strong><br /><a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a></p>` : "", config.whatsappNumber ? `<p><strong>WhatsApp</strong><br /><a href="https://wa.me/${escapeHtml(config.whatsappNumber.replace(/\D/g, ""))}">Abrir atendimento</a></p>` : "", config.legalName ? `<p><strong>Responsável</strong><br />${escapeHtml(config.legalName)}</p>` : ""].filter(Boolean).join("");
  return `<main id="conteudo"><section class="page-intro section-shell"><p class="eyebrow">Vamos conversar</p><h1>Ajuda para escolher seu material?</h1><p>Use os detalhes de cada produto para comparar ano, assunto, formato e o que acompanha a atividade. Se ainda precisar de orientação, veja os canais configurados abaixo.</p></section><section class="contact-page section-shell"><div class="contact-card contact-card-large"><div><p class="eyebrow">Canais disponíveis</p><h2>${contactDetails ? "Fale com a loja" : "Contato em preparação"}</h2><p>${contactDetails ? "Os dados abaixo são os canais publicados pela administração." : "Nenhum canal de atendimento foi configurado ainda. Esta mensagem não inventa um telefone ou endereço."}</p></div><div class="contact-details">${contactDetails || `<p class="honest-empty">Contato ainda não configurado.</p>`}</div></div></section></main>`;
}

function renderCart() {
  return `<main id="conteudo"><section class="page-intro section-shell"><p class="eyebrow">Seu pedido</p><h1>Carrinho</h1><p>Os itens ficam apenas no armazenamento local deste navegador. O servidor recalcula produtos e preços antes de criar qualquer pedido.</p></section><section class="cart-layout section-shell" data-cart-page><div class="cart-items" data-cart-items><p class="loading-state">Carregando carrinho…</p></div><aside class="cart-summary"><h2>Resumo</h2><p data-cart-summary>Seu carrinho está sendo consultado.</p><form class="checkout-form" data-checkout-form hidden><label for="checkout-email">E-mail para o pedido</label><input id="checkout-email" name="email" type="email" autocomplete="email" required /><label for="checkout-phone">Telefone para entrega</label><input id="checkout-phone" name="phone" type="tel" autocomplete="tel" required /><label class="check-row"><input name="optIn" type="checkbox" required /> Aceito o contato transacional necessário para a entrega.</label><button class="button button-primary" type="submit">Preparar checkout</button><p class="form-message" data-checkout-message role="status" aria-live="polite"></p></form><div class="pix-result" data-pix-result hidden></div></aside></section></main>`;
}

function renderAccountBar() {
  return `<section class="account-summary" data-account-bar hidden><p>Sua conta na loja: <strong data-account-name></strong><span data-account-email></span></p><div class="account-actions"><a class="button button-primary" data-other-account-link href="/api/auth/start" target="_blank" rel="noopener">Entrar com outra conta</a><button class="button button-outline" type="button" data-account-logout data-logout hidden>Sair da conta da loja</button></div><small>O botão abre o login da loja em outra aba. Escolha a conta desejada; o login não libera administração automaticamente.</small></section>`;
}

function renderPurchases() {
  return `<main id="conteudo"><section class="page-intro section-shell"><p class="eyebrow">Área protegida</p><h1>Minhas compras</h1><p>Entre com sua conta para consultar somente os pedidos associados a você. Downloads aparecem apenas quando o pagamento e a disponibilidade estiverem confirmados.</p></section><section class="protected-shell section-shell" data-purchases-root>${renderAccountBar()}<div class="loading-state" data-purchases-message role="status" aria-live="polite">Verificando sua sessão…</div><div data-purchases-login hidden><h2>Login necessário</h2><p>O acesso aos pedidos é protegido. Nenhum dado de compra é exibido nesta página pública.</p><a class="button button-primary" data-login-link href="/api/auth/start">Entrar para consultar pedidos</a></div><div data-orders-list hidden></div><div class="pix-result" data-pix-result hidden></div></section></main>`;
}

function adminTopicsOptions(products, selected = []) {
  const selectedSet = new Set(selected);
  return availableTopicKeys(products).map((topic) => `<label class="check-row"><input type="checkbox" name="topics" value="${escapeHtml(topic)}" ${selectedSet.has(topic) ? "checked" : ""} /> ${escapeHtml(labelForTopic(topic))}</label>`).join("");
}

function adminYearsOptions(products, selected = []) {
  const selectedSet = new Set(selected);
  return availableYearKeys(products).map((year) => `<label class="check-row"><input type="checkbox" name="years" value="${escapeHtml(year)}" ${selectedSet.has(year) ? "checked" : ""} /> ${escapeHtml(labelForYear(year))}</label>`).join("");
}

function renderAdmin(products) {
  return `<main id="conteudo"><section class="page-intro section-shell"><p class="eyebrow">Superfície protegida</p><h1>Administração</h1><p>Produtos, arquivos e configurações são carregados somente pelas APIs protegidas. Não há campo para inserir chave, token ou credencial de serviço no navegador.</p></section><section class="admin-shell section-shell" data-admin-root>${renderAccountBar()}<div class="loading-state" data-admin-message role="status" aria-live="polite">Verificando permissão…</div><div data-admin-setup hidden><h2>Acesso administrativo não concedido</h2><p data-admin-explanation>Use a conta escolhida para administrar a loja. A permissão será liberada somente depois de confirmar esse login; não é necessário copiar identificadores aqui.</p><a class="button button-outline" href="/compras">Ir para a área de conta</a></div><div class="admin-content" data-admin-content hidden><div class="admin-toolbar"><div><h2>Catálogo editorial</h2><p class="muted">As alterações são persistidas pelo servidor e recarregadas pela API.</p></div><button class="button button-outline" type="button" data-admin-new>Adicionar produto</button></div><p class="form-message" data-admin-global-message role="status" aria-live="polite"></p><div class="admin-products" data-admin-products></div><form class="admin-product-form" data-admin-product-form hidden><input type="hidden" name="id" /><div class="form-heading"><h2 data-admin-form-title>Novo produto</h2><button class="button button-outline" type="button" data-admin-cancel>Cancelar</button></div><div class="form-grid"><label>Título<input name="title" required maxlength="240" /></label><label>Descrição<textarea name="description" rows="4" required></textarea></label><label>Etapa<select name="stage"><option value="todos">Etapa a confirmar</option><option value="fundamental">Ensino Fundamental II</option><option value="medio">Ensino Médio</option></select></label><label>Nível exibido<input name="level" maxlength="100" /></label><label>Formato<input name="format" value="PDF digital" required maxlength="80" /></label><label>Imagem pública /manus-storage<input name="image" maxlength="500" /></label><label>Preço em centavos (vazio = a definir)<input name="priceCents" type="number" min="1" step="1" /></label><label>Quantidade de páginas<input name="pages" type="number" min="1" step="1" /></label><label class="check-row"><input name="hasAnswerKey" type="checkbox" /> Tem gabarito informado</label><fieldset><legend>Assuntos</legend><div class="check-list" data-admin-topic-options>${adminTopicsOptions(products)}</div></fieldset><fieldset><legend>Anos</legend><div class="check-list" data-admin-year-options>${adminYearsOptions(products)}</div></fieldset><label>Itens incluídos<textarea name="included" rows="5" placeholder="Um item por linha"></textarea></label><label>Conteúdos objetivos<textarea name="contents" rows="5" placeholder="Um conteúdo por linha"></textarea></label><label>Objetivos editoriais<textarea name="objectives" rows="5" placeholder="Um objetivo por linha"></textarea></label><label class="check-row"><input name="commercialApproved" type="checkbox" /> Revisão comercial aprovada</label><label class="check-row"><input name="active" type="checkbox" checked /> Ativo na loja</label><label class="check-row"><input name="featured" type="checkbox" /> Destaque editorial</label></div><div class="form-actions"><button class="button button-primary" type="submit">Salvar produto</button><button class="button button-outline" type="button" data-admin-upload hidden>Enviar PDF protegido</button><input data-admin-file type="file" accept="application/pdf" hidden /><p class="form-message" data-admin-form-message role="status" aria-live="polite"></p></div></form><section class="admin-settings"><div class="admin-toolbar"><div><h2>Configurações públicas</h2><p class="muted">Somente contatos, identificação, políticas e estado de pagamento. Tokens de provedores não entram nesta tela.</p></div></div><form data-admin-settings-form><div class="form-grid"><label>Nome legal<input name="legalName" /></label><label>CPF/CNPJ ou identificação<input name="taxId" /></label><label>Endereço público<input name="address" /></label><label>E-mail de contato<input name="contactEmail" type="email" /></label><label>WhatsApp<input name="whatsappNumber" type="tel" /></label><label>Origem pública HTTPS<input name="publicOrigin" type="url" placeholder="https://exemplo.com" /></label><label>Política de privacidade<textarea name="privacyText" rows="5"></textarea></label><label>Termos de uso<textarea name="termsText" rows="5"></textarea></label><label>Licença de uso<textarea name="licenseText" rows="5"></textarea></label><label class="check-row"><input name="paymentEnabled" type="checkbox" /> Habilitar pagamentos após validação</label></div><button class="button button-primary" type="submit">Salvar configurações</button><p class="form-message" data-admin-settings-message role="status" aria-live="polite"></p></form></section><section class="admin-settings"><h2>Pedidos e entregas</h2><p>Os arquivos são liberados ao comprador somente após pagamento confirmado. O atendimento pelo WhatsApp aqui é manual.</p><div data-admin-orders>Carregando pedidos…</div></section></div></section></main>`;
}

function routeMeta(route, product, config) {
  const brand = config.brandName || "Comunic@ Em Ação";
  const meta = {
    title: `${brand} — materiais pedagógicos`,
    description: "Materiais pedagógicos autorais de Língua Portuguesa para explorar leitura, gramática, redação e literatura por assunto e ano escolar.",
    type: "website",
    image: LOGO,
    noindex: false
  };
  if (route === "catalogo") {
    meta.title = `Catálogo de materiais | ${brand}`;
    meta.description = "Consulte materiais pedagógicos autorais por etapa, ano escolar e assunto, com prévias e informações editoriais claras.";
  } else if (route === "produto" && product) {
    meta.title = `${product.title} | ${brand}`;
    meta.description = product.description || `Detalhes editoriais de ${product.title}.`;
    meta.type = "product";
    meta.image = product.image || LOGO;
  } else if (route === "sobre") {
    meta.title = `Sobre a loja | ${brand}`;
    meta.description = "Conheça a proposta editorial da Comunic@ Em Ação e o compromisso com informações claras sobre materiais pedagógicos.";
  } else if (route === "contato") {
    meta.title = `Contato | ${brand}`;
    meta.description = "Encontre os canais públicos de contato da Comunic@ Em Ação e tire dúvidas sobre os materiais pedagógicos.";
  } else if (route === "carrinho") {
    meta.title = `Carrinho | ${brand}`;
    meta.description = "Revise os materiais selecionados antes de preparar um pedido.";
    meta.noindex = true;
  } else if (route === "compras") {
    meta.title = `Minhas compras | ${brand}`;
    meta.description = "Área protegida para consultar pedidos e downloads disponíveis após confirmação do pagamento.";
    meta.noindex = true;
  } else if (route === "admin") {
    meta.title = `Administração | ${brand}`;
    meta.description = "Superfície protegida para administrar catálogo, arquivos e configurações da loja.";
    meta.noindex = true;
  } else if (route === "404") {
    meta.title = `Página não encontrada | ${brand}`;
    meta.description = "A página solicitada não existe nesta loja.";
    meta.noindex = true;
  }
  return meta;
}

function absolutePublicUrl(config, value) {
  const origin = stringValue(config.publicOrigin);
  if (!/^https:\/\//i.test(origin)) return "";
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") return "";
    return new URL(value, parsed.origin).toString();
  } catch {
    return "";
  }
}

function renderHead(meta, config, path) {
  const canonical = meta.noindex ? "" : absolutePublicUrl(config, path.split("?")[0]);
  const image = !meta.noindex ? absolutePublicUrl(config, meta.image) : "";
  return `<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(meta.title)}</title><meta name="description" content="${escapeHtml(meta.description)}" />${meta.noindex ? `<meta name="robots" content="noindex,nofollow,noarchive" />` : ""}<meta property="og:type" content="${escapeHtml(meta.type)}" /><meta property="og:title" content="${escapeHtml(meta.title)}" /><meta property="og:description" content="${escapeHtml(meta.description)}" /><meta property="og:site_name" content="${escapeHtml(config.brandName)}" />${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" /><link rel="canonical" href="${escapeHtml(canonical)}" />` : ""}${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escapeHtml(meta.title)}" /><meta name="twitter:description" content="${escapeHtml(meta.description)}" />${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet" /><link rel="stylesheet" href="/store.css" /></head>`;
}

function renderShell({ path, products, config, bestSellers, content, meta, status }) {
  const state = {
    path,
    products,
    config,
    bestSellers: asArray(bestSellers).map(String).filter((id) => products.some((product) => product.id === id))
  };
  return { status, html: `<!doctype html><html lang="pt-BR">${renderHead(meta, config, path)}<body data-route="${escapeHtml(path.split("?")[0])}"><a class="skip-link" href="#conteudo">Ir para o conteúdo</a>${renderHeader(products, config, path)}<div class="store-message section-shell" data-store-message role="status" aria-live="polite"></div>${content}${renderFooter(config)}<script type="application/json" id="store-state">${escapeJson(state)}</script><script type="module" src="/store.js"></script></body></html>` };
}

export function renderPage({ path = "/", products = [], config = {}, bestSellers = [], user: _user } = {}) {
  let url;
  try {
    url = new URL(path, "https://renderer.invalid");
  } catch {
    url = new URL("/", "https://renderer.invalid");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    pathname = "\u0000";
  }
  const publicProducts = activeProducts(products);
  const safeConfig = publicConfig(config);
  const cleanPath = `${pathname}${url.search}`;
  let content;
  let status = 200;
  let route = pathname === "/" ? "home" : pathname.slice(1);
  let detail;
  if (pathname === "/") {
    content = renderHome(publicProducts, safeConfig, bestSellers);
  } else if (pathname === "/catalogo") {
    content = renderCatalogPage(publicProducts, cleanPath);
    route = "catalogo";
  } else if (pathname === "/sobre") {
    content = renderAbout(safeConfig);
    route = "sobre";
  } else if (pathname === "/contato") {
    content = renderContact(safeConfig);
    route = "contato";
  } else if (pathname === "/carrinho") {
    content = renderCart();
    route = "carrinho";
  } else if (pathname === "/compras") {
    content = renderPurchases();
    route = "compras";
  } else if (pathname === "/admin") {
    content = renderAdmin(publicProducts);
    route = "admin";
  } else if (pathname.startsWith("/produto/")) {
    const id = pathname.slice("/produto/".length);
    detail = publicProducts.find((product) => product.id === id);
    if (!detail || !id || id.includes("/")) {
      status = 404;
      route = "404";
      content = `<main id="conteudo"><section class="page-intro section-shell not-found"><p class="eyebrow">404</p><h1>Material não encontrado.</h1><p>O produto solicitado não existe ou não está disponível na vitrine.</p><a class="button button-primary" href="/catalogo">Voltar ao catálogo</a></section></main>`;
    } else {
      route = "produto";
      content = renderProductDetail(detail);
    }
  } else {
    status = 404;
    route = "404";
    content = `<main id="conteudo"><section class="page-intro section-shell not-found"><p class="eyebrow">404</p><h1>Página não encontrada.</h1><p>O endereço solicitado não corresponde a uma página real da loja.</p><a class="button button-primary" href="/">Voltar ao início</a></section></main>`;
  }
  return renderShell({ path: cleanPath, products: publicProducts, config: safeConfig, bestSellers, content, meta: routeMeta(route, detail, safeConfig), status });
}

export { TOPICS, STAGES, YEARS, formatPrice, publicProduct };
