import { products, topics, stages, years, stageForYear, getVisibleProducts } from "/catalog.js";

const state = { stage: "todos", year: "todos", topic: "todos", query: "", sort: "recentes" };
const grid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#site-search");
const yearSelect = document.querySelector("#year-filter");
const sortSelect = document.querySelector("#sort-select");
const productDialog = document.querySelector("#product-modal");
const infoDialog = document.querySelector("#info-modal");
const filterPanel = document.querySelector("#filter-panel");
const nav = document.querySelector("#main-nav");
const menuToggle = document.querySelector(".menu-toggle");
let lastDialogTrigger = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function cardTemplate(product) {
  const subject = product.topics.map((key) => topics[key]).join(" · ");
  return `<article class="product-card">
    <button class="product-image" type="button" data-product="${product.id}" aria-label="Ver detalhes de ${escapeHtml(product.title)}">
      <img src="${product.image}" alt="Prévia com páginas sobrepostas de ${escapeHtml(product.title)}" width="1200" height="1200" loading="lazy" />
      <span class="product-tag">${product.level}</span>
    </button>
    <div class="product-info">
      <p class="product-meta">${subject}</p>
      <h3><button type="button" data-product="${product.id}">${product.title}</button></h3>
      <p class="product-description">${product.description}</p>
      <div class="product-facts"><span>${product.format}</span>${product.pages ? `<span>${product.pages} páginas</span>` : ""}${product.hasAnswerKey ? "<span>Com gabarito</span>" : ""}${product.edition ? `<span>${product.edition}</span>` : ""}</div>
      <div class="product-bottom"><small>Preço a definir</small><button class="view-product" type="button" data-product="${product.id}">Ver detalhes <span aria-hidden="true">→</span></button></div>
    </div>
  </article>`;
}

function syncControls() {
  document.querySelectorAll('input[name="stage"]').forEach((input) => { input.checked = input.value === state.stage; });
  document.querySelectorAll('input[name="topic"]').forEach((input) => { input.checked = input.value === state.topic; });
  [...yearSelect.options].forEach((option) => {
    option.disabled = option.value !== "todos" && state.stage !== "todos" && stageForYear(option.value) !== state.stage;
  });
  yearSelect.value = state.year;
  sortSelect.value = state.sort;
  searchInput.value = state.query;
}

function renderCatalog() {
  syncControls();
  const visible = getVisibleProducts(state);
  grid.innerHTML = visible.length ? visible.map(cardTemplate).join("") : `<div class="empty-state"><p class="eyebrow">Nenhum resultado neste recorte</p><h3>Vamos tentar outra combinação?</h3><p>Ainda não há material cadastrado para estes filtros. Escolha outro ano ou assunto, ou volte ao catálogo completo.</p><button type="button" class="button button-outline" data-reset>Ver todos os materiais</button></div>`;
  const count = document.querySelector("#catalog-count");
  count.textContent = `${visible.length} ${visible.length === 1 ? "material encontrado" : "materiais encontrados"}`;
  const description = [
    state.stage !== "todos" ? stages[state.stage] : "",
    state.year !== "todos" ? years[state.year] : "",
    state.topic !== "todos" ? topics[state.topic] : "",
    state.query.trim() ? `Busca: “${state.query.trim()}”` : ""
  ].filter(Boolean);
  document.querySelector("#active-filters").textContent = description.length ? description.join(" · ") : "Catálogo completo · organizado por ano e assunto";
}

function resetFilters() {
  Object.assign(state, { stage: "todos", year: "todos", topic: "todos", query: "", sort: "recentes" });
  renderCatalog();
}

function openDialog(dialog, trigger) {
  lastDialogTrigger = trigger || document.activeElement;
  dialog.showModal();
  document.body.classList.add("dialog-open");
}

function openProduct(id, trigger) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  document.querySelector("#modal-content").innerHTML = `<div class="modal-product">
    <div class="modal-preview"><img src="${product.image}" alt="Prévia de ${escapeHtml(product.title)}" width="1200" height="1200" /><p>Apenas prévia · o PDF completo não está exposto na vitrine.</p></div>
    <div class="modal-description"><p class="eyebrow">${product.id} · ${product.topics.map((key) => topics[key]).join(" · ")}</p><h2 id="modal-title">${product.title}</h2><p>${product.description}</p>
      <dl class="product-specs"><div><dt>Para quem</dt><dd>${product.stage === "todos" ? "Etapa a confirmar" : stages[product.stage]} · ${product.level}</dd></div><div><dt>Formato</dt><dd>${product.format}${product.pages ? ` · ${product.pages} páginas` : ""}</dd></div><div><dt>Entrega prevista</dt><dd>WhatsApp após confirmação do Pix</dd></div></dl>
      <h3>O que acompanha</h3><ul>${product.included.map((item) => `<li>${item}</li>`).join("")}</ul>
      <div class="product-delivery-note"><strong>Preço a definir</strong><p>O atendimento e os pagamentos ainda não estão ativos. A loja está em preparação.</p></div>
      <button type="button" class="button button-primary" data-product-contact="${product.id}">Informações de atendimento <span aria-hidden="true">→</span></button>
    </div></div>`;
  openDialog(productDialog, trigger);
}

const infoContent = {
  whatsapp: {
    title: "Atendimento em preparação",
    body: "<p>O número oficial do WhatsApp será conectado antes do início das vendas.</p><p>O fluxo previsto é: escolha do material, pagamento por Pix e entrega individual após a confirmação. Nesta versão, nenhum pedido é cobrado e nenhum arquivo é enviado automaticamente.</p>"
  },
  privacy: {
    title: "Privacidade: informações preliminares",
    body: "<p>Esta vitrine não possui formulário de pedido, login nem coleta de dados bancários. Quando as vendas forem ativadas, os dados necessários para pedido, entrega e suporte deverão ser informados na política de privacidade completa.</p><p>O site utiliza recursos de hospedagem e fontes externas. Estas informações são um resumo de preparação, não substituem a política definitiva com identificação da responsável, fornecedores, direitos e canal de contato.</p>"
  },
  terms: {
    title: "Licença de uso dos materiais",
    body: "<p>Os materiais são digitais. O uso pedagógico, as permissões de impressão e os limites da licença serão informados em cada produto antes de abrir vendas.</p><p>Não é permitida revenda ou redistribuição pública dos arquivos sem autorização. As prévias não disponibilizam o PDF completo. Este resumo não substitui os termos de compra e os direitos do consumidor aplicáveis.</p>"
  }
};

function openInfo(key, trigger, product) {
  const info = infoContent[key];
  if (!info) return;
  document.querySelector("#info-title").textContent = info.title;
  document.querySelector("#info-content").innerHTML = info.body;
  if (product) {
    const paragraph = document.createElement("p");
    paragraph.className = "selected-product";
    paragraph.textContent = `Material consultado: ${product.title} (${product.id}).`;
    document.querySelector("#info-content").prepend(paragraph);
  }
  openDialog(infoDialog, trigger);
}

document.querySelectorAll('input[name="stage"]').forEach((input) => input.addEventListener("change", () => {
  state.stage = input.value;
  if (state.year !== "todos" && state.stage !== "todos" && stageForYear(state.year) !== state.stage) state.year = "todos";
  renderCatalog();
}));

yearSelect.addEventListener("change", () => {
  state.year = yearSelect.value;
  if (state.year !== "todos") state.stage = stageForYear(state.year);
  renderCatalog();
});

document.querySelectorAll('input[name="topic"]').forEach((input) => input.addEventListener("change", () => {
  state.topic = input.value;
  renderCatalog();
}));

sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; renderCatalog(); });

document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = searchInput.value;
  renderCatalog();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector("#catalogo").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
});
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  renderCatalog();
});

function closeNavigation() {
  menuToggle.setAttribute("aria-expanded", "false");
  nav.classList.remove("mobile-open");
  document.querySelectorAll(".nav-dropdown[open]").forEach((details) => { details.open = false; });
}

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Fechar navegação" : "Abrir navegação");
  nav.classList.toggle("mobile-open", open);
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, a");
  if (target?.hasAttribute("data-reset")) resetFilters();
  if (target?.hasAttribute("data-stage") || target?.hasAttribute("data-topic")) {
    if (target.dataset.stage) {
      state.stage = target.dataset.stage;
      state.year = target.dataset.year || "todos";
    }
    if (target.dataset.topic) state.topic = target.dataset.topic;
    renderCatalog();
  }
  if (target?.dataset.product) openProduct(target.dataset.product, target);
  if (target?.hasAttribute("data-close-dialog")) target.closest("dialog").close();
  if (target?.hasAttribute("data-whatsapp")) openInfo("whatsapp", target);
  if (target?.dataset.info) openInfo(target.dataset.info, target);
  if (target?.dataset.productContact) {
    const product = products.find((item) => item.id === target.dataset.productContact);
    const originalTrigger = lastDialogTrigger;
    productDialog.close();
    openInfo("whatsapp", originalTrigger, product);
  }
  if (target?.matches('a[href^="#"]')) closeNavigation();
  if (!event.target.closest(".nav-dropdown")) document.querySelectorAll(".nav-dropdown[open]").forEach((details) => { details.open = false; });
});

document.querySelectorAll(".nav-dropdown").forEach((current) => current.addEventListener("toggle", () => {
  if (current.open) document.querySelectorAll(".nav-dropdown").forEach((other) => { if (other !== current) other.open = false; });
}));

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) {
      document.body.classList.remove("dialog-open");
      if (lastDialogTrigger?.isConnected) lastDialogTrigger.focus();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});

document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeNavigation(); });
const mobile = window.matchMedia("(max-width: 760px)");
const filterSummary = filterPanel.querySelector("summary");
function syncFilterPanel() {
  filterPanel.open = !mobile.matches;
  filterSummary.tabIndex = mobile.matches ? 0 : -1;
}
filterSummary.addEventListener("click", (event) => { if (!mobile.matches) event.preventDefault(); });
syncFilterPanel();
mobile.addEventListener("change", () => { syncFilterPanel(); closeNavigation(); });
renderCatalog();
