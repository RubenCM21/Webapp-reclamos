"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - INDEX
   Página pública conectada a FastAPI + SQL Server
   Sin mockCases, sin HomeData local, sin simulaciones
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const AppState = {
  segment: "personas",
  currentHeroSlide: 0,
  theme: localStorage.getItem("claro360-theme") || "light",
  home: null
};

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(AppState.theme);
  rewritePrivateClientLinks();
  removeObsoleteIndexFields();
  bindNavigation();
  bindSegmentSwitch();
  bindHeroPanel();
  bindQuickCaseForm();
  bindAI();
  bindBot();
  bindModals();
  bindSearch();
  bindHelp();

  await renderSegment("personas");
});

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text ?? "";
}

function setHref(selector, href) {
  const element = $(selector);
  if (element) element.setAttribute("href", href);
}

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) return data.detail.map(item => item.msg || "Dato inválido").join(" ");
  if (typeof data.message === "string") return data.message;
  return "No se pudo completar la operación.";
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(getApiErrorMessage(data));
  }

  return data;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

function showToast({ title, message, type = "info" }) {
  const container = $("#toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : type === "warning" ? "!" : type === "danger" ? "×" : "ℹ"}</span>
    <div>
      <strong>${esc(title)}</strong>
      <p>${esc(message)}</p>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 250);
  }, 4200);
}

function removeObsoleteIndexFields() {
  const docInput = $("#documentNumber");
  const docLabel = docInput?.previousElementSibling;

  if (docLabel && docLabel.tagName === "LABEL") docLabel.remove();
  if (docInput) docInput.remove();

  const disclaimer = $(".ai-disclaimer");
  if (disclaimer) {
    disclaimer.textContent = "Las respuestas son orientativas y se generan con información registrada en la plataforma.";
  }
}

function privateRoute(path, role = "cliente-persona") {
  return `login.html?role=${encodeURIComponent(role)}&next=${encodeURIComponent(path)}`;
}

function rewritePrivateClientLinks() {
  const privateMap = {
    "cliente/registrar-reclamo.html": privateRoute("cliente/registrar-reclamo.html", "cliente-persona"),
    "cliente/registrar-incidencia.html": privateRoute("cliente/registrar-incidencia.html", "cliente-persona"),
    "cliente/dashboard.html": privateRoute("cliente/dashboard.html", "cliente-persona"),
    "cliente/mis-casos.html": privateRoute("cliente/mis-casos.html", "cliente-persona")
  };

  $all("a[href]").forEach(link => {
    const href = link.getAttribute("href");
    if (privateMap[href]) {
      link.setAttribute("href", privateMap[href]);
    }
  });
}

/* =========================================================
   NAVIGATION
========================================================= */

function bindNavigation() {
  const mainNav = $("#mainNav");
  const mobileBtn = $("#mobileMenuBtn");
  const mainMenu = $("#mainMenu");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 12) {
      mainNav?.classList.add("scrolled");
    } else {
      mainNav?.classList.remove("scrolled");
    }
  });

  mobileBtn?.addEventListener("click", () => {
    mainMenu?.classList.toggle("open");
  });

  $all('a[href^="#"]').forEach(link => {
    link.addEventListener("click", () => {
      mainMenu?.classList.remove("open");
    });
  });

  $("#themeToggle")?.addEventListener("click", () => {
    const nextTheme = AppState.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${nextTheme === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

/* =========================================================
   SEGMENT
========================================================= */

function bindSegmentSwitch() {
  $all(".segment-tab").forEach(button => {
    button.addEventListener("click", async () => {
      const segment = button.dataset.segment;
      if (!segment || segment === AppState.segment) return;

      $all(".segment-tab").forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");

      await renderSegment(segment);

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message: "Se cargó información pública registrada para el segmento seleccionado.",
        type: "info"
      });
    });
  });
}

async function renderSegment(segment) {
  AppState.segment = segment;

  try {
    const response = await apiRequest(`/public/home${buildQuery({ segment })}`);

    AppState.home = response;

    const data = response;

    setText("#heroEyebrow", data.hero?.eyebrow);
    setText("#heroTitle", data.hero?.title);
    setText("#heroDescription", data.hero?.description);
    setText("#heroPrimaryBtn", data.hero?.primaryText);
    setHref("#heroPrimaryBtn", data.hero?.primaryHref);
    setText("#panelTitle", data.hero?.panelTitle);
    setText("#heroStatusText", data.hero?.statusText);

    const navCloud = $("[data-label-personas]");
    if (navCloud) {
      navCloud.textContent =
        segment === "personas"
          ? navCloud.dataset.labelPersonas
          : navCloud.dataset.labelEmpresas;
    }

    setText("#quickActionsTitle", data.quickTitle);
    setText("#quickActionsSubtitle", data.quickSubtitle);
    setText("#solutionsEyebrow", data.solutionsEyebrow);
    setText("#solutionsTitle", data.solutionsTitle);
    setText("#solutionsSubtitle", data.solutionsSubtitle);

    renderQuickActions(data.quickActions || []);
    renderSolutions(data.solutions || []);
    renderMetrics(data.metrics || []);
    toggleMegaMenuContent(segment);
    toggleHeroSlide(segment);
  } catch (error) {
    openGenericModal({
      icon: "!",
      title: "No se pudo cargar inicio",
      text: error.message
    });
  }
}

function toggleMegaMenuContent(segment) {
  $all("[data-menu-content]").forEach(menu => {
    menu.classList.toggle("hidden", menu.dataset.menuContent !== segment);
  });
}

function toggleHeroSlide(segment) {
  $all(".hero__slide").forEach(slide => {
    slide.classList.toggle("active", slide.dataset.slide === segment);
  });
}

function renderQuickActions(actions) {
  const grid = $("#quickActionsGrid");
  if (!grid) return;

  if (!actions.length) {
    grid.innerHTML = `
      <article class="quick-action-card">
        <span class="quick-action-card__icon">📭</span>
        <h3>Sin accesos registrados</h3>
        <p>No se encontraron accesos rápidos para este segmento.</p>
        <a href="centro-ayuda.html">Ir al centro de ayuda ›</a>
      </article>
    `;
    return;
  }

  grid.innerHTML = actions.map(item => `
    <article class="quick-action-card">
      <span class="quick-action-card__icon">${esc(item.icon || "🔗")}</span>
      <h3>${esc(item.title || "Acceso")}</h3>
      <p>${esc(item.description || item.text || "")}</p>
      <a href="${esc(item.href || "#")}">Conoce más ›</a>
    </article>
  `).join("");
}

function renderSolutions(solutions) {
  const grid = $("#solutionsGrid");
  if (!grid) return;

  if (!solutions.length) {
    grid.innerHTML = `
      <article class="solution-card">
        <div class="solution-card__content">
          <span class="solution-card__tag">Sin datos</span>
          <h3>No hay soluciones registradas</h3>
          <p>No se encontraron soluciones para este segmento.</p>
          <a href="centro-ayuda.html" class="btn btn--primary">Ir a ayuda</a>
        </div>
      </article>
    `;
    return;
  }

  grid.innerHTML = solutions.map(item => `
    <article class="solution-card">
      <img src="${esc(item.image || "")}" alt="${esc(item.title || "Solución")}">
      <div class="solution-card__content">
        <span class="solution-card__tag">${esc(item.tag || "")}</span>
        <h3>${esc(item.title || "Solución")}</h3>
        <p>${esc(item.description || "")}</p>
        <a href="${esc(item.href || "#")}" class="btn btn--primary">Ver más</a>
      </div>
    </article>
  `).join("");
}

function renderMetrics(metrics) {
  const cards = $all(".metric-card");

  metrics.forEach((metric, index) => {
    const card = cards[index];
    if (!card) return;

    const label = card.querySelector(".metric-card__label");
    const counter = card.querySelector(".counter");
    const small = card.querySelector("small");

    if (label) label.textContent = metric.label || "Indicador";
    if (counter) {
      counter.dataset.target = Number(metric.value || 0);
      counter.dataset.suffix = metric.suffix || "";
      counter.textContent = formatMetricValue(metric.value, metric.suffix);
    }
    if (small) small.textContent = metric.description || "";
  });
}

function formatMetricValue(value, suffix) {
  const number = Number(value || 0).toLocaleString("es-PE");
  return `${number}${suffix || ""}`;
}

/* =========================================================
   HERO PANEL
========================================================= */

function bindHeroPanel() {
  const serviceButtons = $all(".service-toggle__item");

  serviceButtons.forEach(button => {
    button.addEventListener("click", () => {
      serviceButtons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");

      const service = button.dataset.service;
      updateHeroSelect(service);
    });
  });

  $("#heroPanelAction")?.addEventListener("click", () => {
    const action = $("#heroActionSelect")?.value;

    const routes = {
      "registrar-reclamo": privateRoute("cliente/registrar-reclamo.html", AppState.segment === "empresas" ? "cliente-empresa" : "cliente-persona"),
      "registrar-incidencia": privateRoute("cliente/registrar-incidencia.html", AppState.segment === "empresas" ? "cliente-empresa" : "cliente-persona"),
      "consultar-caso": "consulta-rapida.html",
      "centro-ayuda": "centro-ayuda.html"
    };

    if (routes[action]) {
      window.location.href = routes[action];
    }
  });

  $("#prevSlide")?.addEventListener("click", () => animateDots(-1));
  $("#nextSlide")?.addEventListener("click", () => animateDots(1));
}

function updateHeroSelect(service) {
  const select = $("#heroActionSelect");
  if (!select) return;

  const optionsByService = {
    movil: [
      ["registrar-reclamo", "Registrar reclamo móvil"],
      ["registrar-incidencia", "Reportar incidencia móvil"],
      ["consultar-caso", "Consultar caso móvil"],
      ["centro-ayuda", "Ayuda para mi línea"]
    ],
    hogar: [
      ["registrar-reclamo", "Registrar reclamo hogar"],
      ["registrar-incidencia", "Reportar falla de internet"],
      ["consultar-caso", "Consultar estado de caso"],
      ["centro-ayuda", "Ayuda para internet/TV"]
    ],
    empresa: [
      ["registrar-incidencia", "Reportar incidencia empresarial"],
      ["consultar-caso", "Consultar ticket empresarial"],
      ["centro-ayuda", "Mesa de ayuda empresarial"],
      ["registrar-reclamo", "Registrar reclamo corporativo"]
    ]
  };

  const options = optionsByService[service] || optionsByService.movil;

  select.innerHTML = options
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join("");

  const statusText = {
    movil: "Red móvil monitoreada",
    hogar: "Soporte hogar disponible",
    empresa: "Mesa empresarial activa"
  };

  setText("#heroStatusText", statusText[service] || "Atención disponible");
}

function animateDots(direction) {
  const dots = $all(".hero__dots .dot");
  if (!dots.length) return;

  dots[AppState.currentHeroSlide]?.classList.remove("active");

  AppState.currentHeroSlide += direction;

  if (AppState.currentHeroSlide < 0) {
    AppState.currentHeroSlide = dots.length - 1;
  }

  if (AppState.currentHeroSlide >= dots.length) {
    AppState.currentHeroSlide = 0;
  }

  dots[AppState.currentHeroSlide]?.classList.add("active");
}

/* =========================================================
   QUICK CASE LOOKUP
========================================================= */

function bindQuickCaseForm() {
  const form = $("#quickCaseForm");
  if (!form) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(form);
    const caseCode = String(formData.get("caseCode") || "").trim();

    if (!caseCode) {
      openGenericModal({
        icon: "!",
        title: "Dato incompleto",
        text: "Ingresa el código de caso para realizar la consulta."
      });
      return;
    }

    showToast({
      title: "Consultando caso",
      message: "Estamos validando el código ingresado.",
      type: "info"
    });

    try {
      const response = await apiRequest(`/public/consulta-caso/${encodeURIComponent(caseCode)}`);
      const result = response.case || response;

      renderCaseResultModal(result);
      openModal("#caseResultModal");
    } catch (error) {
      openGenericModal({
        icon: "×",
        title: "Caso no encontrado",
        text: error.message
      });
    }
  });
}

function renderCaseResultModal(result) {
  setText("#resultCaseCode", result.code || "-");

  const card = $(".case-result-card");
  if (!card) return;

  card.innerHTML = `
    <div>
      <span>Código</span>
      <strong>${esc(result.code || "-")}</strong>
    </div>

    <div>
      <span>Tipo</span>
      <strong>${esc(result.type || "-")}</strong>
    </div>

    <div>
      <span>Servicio</span>
      <strong>${esc(result.service || "-")}</strong>
    </div>

    <div>
      <span>Estado</span>
      <strong class="status-text">${esc(result.status || "-")}</strong>
    </div>

    <div>
      <span>Última actualización</span>
      <strong>${esc(result.lastUpdate || "-")}</strong>
    </div>
  `;

  const link = $("#caseResultModal .modal__actions a");
  if (link) {
    link.href = `consulta-rapida.html?case=${encodeURIComponent(result.code || "")}`;
    link.textContent = "Ver seguimiento público";
  }
}

/* =========================================================
   AI / BOT
========================================================= */

function bindAI() {
  $("#aiSearchBtn")?.addEventListener("click", handleAISearch);

  $("#aiSearchInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") handleAISearch();
  });

  $("#aiVoiceBtn")?.addEventListener("click", () => {
    showToast({
      title: "Consulta por voz",
      message: "La consulta por voz no está habilitada en esta versión.",
      type: "info"
    });
  });

  $all(".quick-prompt").forEach(button => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      const input = $("#aiSearchInput");
      if (input) input.value = prompt;
      handleAISearch();
    });
  });

  $("#openBotFromHero")?.addEventListener("click", openBot);
  $("#openBotFromStatus")?.addEventListener("click", openBot);

  $("#openEvidenceAdvice")?.addEventListener("click", async () => {
    openBot();
    addBotMessage("Qué evidencia debo adjuntar", "user");
    await askAssistant("Qué evidencia debo adjuntar");
  });
}

async function handleAISearch() {
  const input = $("#aiSearchInput");
  const prompt = input?.value.trim();

  if (!prompt) {
    openGenericModal({
      icon: "!",
      title: "Consulta vacía",
      text: "Escribe una consulta o selecciona una sugerencia rápida."
    });
    return;
  }

  openBot();
  addBotMessage(prompt, "user");
  await askAssistant(prompt);

  input.value = "";
}

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#floatingHelp")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);
  $("#drawerBackdrop")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addBotMessage(prompt, "user");
    input.value = "";

    await askAssistant(prompt);
  });

  $all("[data-bot-prompt]").forEach(button => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.botPrompt || "";
      addBotMessage(prompt, "user");
      await askAssistant(prompt);
    });
  });
}

async function askAssistant(prompt) {
  const typing = addTypingMessage();

  try {
    const response = await apiRequest("/public/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: "index",
        prompt,
        segment: AppState.segment
      })
    });

    typing.remove();
    addBotMessage(response.answer || "No se recibió respuesta del asistente.", "bot");
  } catch (error) {
    typing.remove();
    addBotMessage(error.message, "bot");
  }
}

function openBot() {
  $("#botDrawer")?.classList.add("open");
  $("#drawerBackdrop")?.classList.add("show");
  document.body.classList.add("drawer-open");
}

function closeBot() {
  $("#botDrawer")?.classList.remove("open");
  $("#drawerBackdrop")?.classList.remove("show");
  document.body.classList.remove("drawer-open");
}

function addBotMessage(message, sender) {
  const container = $("#botMessages");
  if (!container) return;

  const bubble = document.createElement("div");
  bubble.className = `bot-message bot-message--${sender}`;
  bubble.textContent = message;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function addTypingMessage() {
  const container = $("#botMessages");

  const bubble = document.createElement("div");
  bubble.className = "bot-message bot-message--bot";
  bubble.textContent = "ClaroBot está consultando información registrada...";

  container?.appendChild(bubble);
  if (container) container.scrollTop = container.scrollHeight;

  return bubble;
}

/* =========================================================
   MODALS
========================================================= */

function bindModals() {
  $all("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
      closeSearch();
      closeBot();
    }
  });
}

function openModal(selector) {
  const modal = $(selector);
  const backdrop = $("#modalBackdrop");

  if (!modal || !backdrop) return;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  backdrop.classList.add("show");
  document.body.classList.add("modal-open");
}

function closeAllModals() {
  $all(".modal").forEach(modal => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });

  $("#modalBackdrop")?.classList.remove("show");
  document.body.classList.remove("modal-open");
}

function openGenericModal({ icon = "ℹ", title = "Información", text = "" }) {
  setText("#genericModalIcon", icon);
  setText("#genericModalTitle", title);
  setText("#genericModalText", text);
  openModal("#genericModal");
}

/* =========================================================
   GLOBAL SEARCH
========================================================= */

function bindSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);

  $all("[data-close-search]").forEach(button => {
    button.addEventListener("click", closeSearch);
  });

  const input = $("#globalSearchInput");

  input?.addEventListener("input", () => {
    renderSearchResults(input.value);
  });

  document.addEventListener("keydown", event => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const shortcut = isMac ? event.metaKey : event.ctrlKey;

    if (shortcut && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
}

function openSearch() {
  const modal = $("#searchModal");

  modal?.classList.add("show");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("search-open");

  setTimeout(() => $("#globalSearchInput")?.focus(), 100);
}

function closeSearch() {
  const modal = $("#searchModal");

  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-open");
}

async function renderSearchResults(query) {
  const container = $("#globalSearchResults");
  if (!container) return;

  const cleanQuery = query.trim();

  if (!cleanQuery) {
    container.innerHTML = `<p class="muted">Prueba buscando: reclamo, incidencia, SLA, internet, empresa.</p>`;
    return;
  }

  container.innerHTML = `<p class="muted">Buscando...</p>`;

  try {
    const response = await apiRequest(`/public/search${buildQuery({ q: cleanQuery })}`);
    const results = response.items || [];

    if (!results.length) {
      container.innerHTML = `
        <p class="muted">No se encontraron resultados. Prueba con otra palabra o consulta a ClaroBot.</p>
      `;
      return;
    }

    container.innerHTML = results.map(item => `
      <a href="${esc(item.href || "#")}" class="search-result-item">
        <span>${esc(item.icon || "🔎")}</span>
        <div>
          <strong>${esc(item.title || "Resultado")}</strong>
          <small>${esc(item.description || "")}</small>
        </div>
      </a>
    `).join("");
  } catch (error) {
    container.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

/* =========================================================
   HELP
========================================================= */

function bindHelp() {
  $("#helpSearchBtn")?.addEventListener("click", async () => {
    const query = $("#helpSearchInput")?.value.trim();

    if (!query) {
      showToast({
        title: "Centro de ayuda",
        message: "Escribe una palabra clave para buscar.",
        type: "warning"
      });
      return;
    }

    try {
      const response = await apiRequest(`/public/centro-ayuda${buildQuery({
        segment: AppState.segment,
        q: query
      })}`);

      const faqs = response.faqs || [];
      const articles = response.articles || [];

      if (!faqs.length && !articles.length) {
        openGenericModal({
          icon: "🔎",
          title: "Sin resultados",
          text: `No se encontraron guías relacionadas con "${query}".`
        });
        return;
      }

      openGenericModal({
        icon: "🔎",
        title: "Resultado de ayuda",
        text: `Se encontraron ${articles.length} artículo(s) y ${faqs.length} pregunta(s) relacionada(s). Abre el Centro de ayuda para ver el detalle.`
      });
    } catch (error) {
      openGenericModal({
        icon: "!",
        title: "No se pudo buscar ayuda",
        text: error.message
      });
    }
  });

  $all(".faq-item").forEach(item => {
    item.addEventListener("click", () => {
      window.location.href = "centro-ayuda.html";
    });
  });
}