"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CENTRO DE AYUDA
   Conectado a FastAPI + SQL Server
   Sin HelpData, sin FaqData, sin respuestas locales
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const HelpState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  segment: "personas",
  activeFaqFilter: "todos",
  quickActions: [],
  categories: [],
  articles: [],
  faqs: []
};

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(HelpState.theme);
  bindTheme();
  bindSegment();
  bindSearch();
  bindDiagnostic();
  bindFaqFilters();
  bindBot();
  bindModals();

  await loadAndRenderHelp();
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

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value ?? "";
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
    toast.style.transform = "translateX(24px)";
    setTimeout(() => toast.remove(), 250);
  }, 4200);
}

function applyTheme(theme) {
  HelpState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = HelpState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function bindSegment() {
  $all(".segment-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const segment = button.dataset.segment;
      if (!segment || segment === HelpState.segment) return;

      HelpState.segment = segment;

      $all(".segment-btn").forEach(item => item.classList.remove("active"));
      button.classList.add("active");

      await loadAndRenderHelp();

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message: "Se cargaron temas registrados para el segmento seleccionado.",
        type: "info"
      });
    });
  });
}

async function loadAndRenderHelp(extra = {}) {
  try {
    const response = await apiRequest(`/public/centro-ayuda${buildQuery({
      segment: HelpState.segment,
      q: extra.q || "",
      category: extra.category || "todos"
    })}`);

    HelpState.quickActions = response.quickActions || [];
    HelpState.categories = response.categories || [];
    HelpState.articles = response.articles || [];
    HelpState.faqs = response.faqs || [];

    setText("#quickTitle", response.quickTitle || "¿Qué necesitas hacer?");
    setText("#quickSubtitle", response.quickSubtitle || "Accesos rápidos registrados.");
    setText("#categoriesTitle", response.categoriesTitle || "Categorías");
    setText("#articlesTitle", response.articlesTitle || "Artículos recomendados");

    renderQuickActions(HelpState.quickActions);
    renderCategories(HelpState.categories);
    renderArticles(HelpState.articles);
    renderFaq(HelpState.activeFaqFilter);
  } catch (error) {
    openGenericModal({
      icon: "!",
      title: "No se pudo cargar centro de ayuda",
      text: error.message
    });
  }
}

function renderQuickActions(items) {
  const grid = $("#quickGrid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `
      <article class="quick-card">
        <span>📭</span>
        <h3>Sin accesos registrados</h3>
        <p>No hay accesos rápidos para este segmento.</p>
        <a href="index.html">Volver al inicio ›</a>
      </article>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <article class="quick-card">
      <span>${esc(item.icon || "🔗")}</span>
      <h3>${esc(item.title || "Acceso")}</h3>
      <p>${esc(item.text || "")}</p>
      <a href="${esc(item.href || "#")}">Ir ahora ›</a>
    </article>
  `).join("");
}

function renderCategories(items) {
  const grid = $("#categoriesGrid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `
      <article class="category-card">
        <div class="category-card__icon">📭</div>
        <h3>Sin categorías</h3>
        <p>No hay categorías registradas para este segmento.</p>
      </article>
    `;
    return;
  }

  grid.innerHTML = items.map(item => `
    <article class="category-card">
      <div class="category-card__icon">${esc(item.icon || "📘")}</div>
      <h3>${esc(item.title || "Categoría")}</h3>
      <p>${esc(item.text || "")}</p>
      <div class="category-card__meta">
        <span>${Number(item.count || 0)} artículos</span>
        <span>${esc(item.tag || "")}</span>
      </div>
      <button type="button" data-category="${esc(item.title)}">
        Ver temas
      </button>
    </article>
  `).join("");

  $all("[data-category]").forEach(button => {
    button.addEventListener("click", async () => {
      const category = button.dataset.category || "todos";
      await loadAndRenderHelp({ category });
    });
  });
}

function renderArticles(items) {
  const grid = $("#articlesGrid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = `
      <article class="article-card">
        <div class="article-card__icon">📭</div>
        <span class="article-card__tag">Sin resultados</span>
        <h3>No se encontraron artículos</h3>
        <p>Prueba con otra búsqueda o categoría.</p>
      </article>
    `;
    return;
  }

  grid.innerHTML = items.map((item, index) => `
    <article class="article-card">
      <div class="article-card__icon">${esc(item.icon || "📘")}</div>
      <span class="article-card__tag">${esc(item.tag || item.category || "Ayuda")}</span>
      <h3>${esc(item.title || "Artículo")}</h3>
      <p>${esc(item.text || "")}</p>
      <button type="button" data-article-index="${index}">
        Leer guía ›
      </button>
    </article>
  `).join("");

  $all("[data-article-index]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.articleIndex);
      const article = HelpState.articles[index];

      if (article) openArticle(article);
    });
  });
}

function openArticle(article) {
  setText("#articleModalTitle", article.title || "Artículo de ayuda");
  setText("#articleModalText", article.text || "");

  const steps = $("#articleSteps");

  if (steps) {
    const source = Array.isArray(article.steps) ? article.steps : [];

    steps.innerHTML = source.length
      ? source.map((step, index) => `
          <div class="article-step">
            <span>${index + 1}</span>
            <p>${esc(step)}</p>
          </div>
        `).join("")
      : `
          <div class="article-step">
            <span>1</span>
            <p>No se registraron pasos para este artículo.</p>
          </div>
        `;
  }

  openModal("#articleModal");
}

function bindSearch() {
  $("#helpSearchBtn")?.addEventListener("click", handleHelpSearch);

  $("#helpSearchInput")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      handleHelpSearch();
    }
  });

  $all("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      $("#helpSearchInput").value = prompt;
      handleHelpSearch();
    });
  });
}

async function handleHelpSearch() {
  const query = $("#helpSearchInput")?.value.trim();

  if (!query) {
    showToast({
      title: "Búsqueda vacía",
      message: "Describe tu consulta o selecciona una sugerencia.",
      type: "warning"
    });
    return;
  }

  await loadAndRenderHelp({ q: query });

  openBot();
  addBotMessage(query, "user");
  await askAssistant(query);
}

function bindDiagnostic() {
  $("#diagnosticForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    clearErrors();

    const payload = getDiagnosticPayload();
    const validation = validateDiagnostic(payload);

    if (!validation.ok) {
      showErrors(validation.errors);

      showToast({
        title: "Diagnóstico incompleto",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    renderDiagnosticLoading();

    try {
      const response = await apiRequest("/public/centro-ayuda/diagnostico", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      renderDiagnosticResult(response);
    } catch (error) {
      renderDiagnosticError(error.message);
    }
  });
}

function getDiagnosticPayload() {
  return {
    service: $("#diagnosticService")?.value.trim(),
    problem: $("#diagnosticProblem")?.value.trim(),
    urgency: $("#diagnosticUrgency")?.value.trim()
  };
}

function validateDiagnostic(payload) {
  const errors = {};

  if (!payload.service) {
    errors.diagnosticService = "Selecciona el servicio afectado.";
  }

  if (!payload.problem) {
    errors.diagnosticProblem = "Describe el problema.";
  }

  if (!payload.urgency) {
    errors.diagnosticUrgency = "Selecciona la urgencia.";
  }

  const messages = Object.values(errors);

  return {
    ok: messages.length === 0,
    errors,
    firstMessage: messages[0] || ""
  };
}

function showErrors(errors) {
  clearErrors();

  Object.entries(errors).forEach(([key, value]) => {
    const element = $(`#${key}Error`);
    if (element) element.textContent = value;
  });
}

function clearErrors() {
  $all(".form-error").forEach(item => {
    item.textContent = "";
  });
}

function renderDiagnosticLoading() {
  const result = $("#diagnosticResult");
  if (!result) return;

  result.innerHTML = `
    <div class="empty-diagnostic">
      <span>🤖</span>
      <h3>Analizando consulta...</h3>
      <p>El sistema está evaluando servicio, problema y urgencia.</p>
    </div>
  `;
}

function renderDiagnosticResult(data) {
  const result = $("#diagnosticResult");
  if (!result) return;

  result.innerHTML = `
    <div class="diagnostic-recommendation">
      <div class="diagnostic-result-icon">🤖</div>
      <h3>Recomendación</h3>
      <p>${esc(data.message || "Se generó una recomendación.")}</p>

      <div class="recommendation-box">
        <span>Acción recomendada</span>
        <strong>${esc(data.action || "-")}</strong>
      </div>

      <div class="recommendation-box">
        <span>Prioridad estimada</span>
        <strong>${esc(data.priority || "-")}</strong>
      </div>

      <div class="recommendation-box">
        <span>Evidencia sugerida</span>
        <strong>${esc(data.evidence || "-")}</strong>
      </div>

      <a href="${esc(data.route || "centro-ayuda.html")}" class="btn btn--primary btn--full">
        Continuar
      </a>
    </div>
  `;

  showToast({
    title: "Diagnóstico completado",
    message: `Acción sugerida: ${data.action || "Revisar ayuda"}.`,
    type: "success"
  });
}

function renderDiagnosticError(message) {
  const result = $("#diagnosticResult");
  if (!result) return;

  result.innerHTML = `
    <div class="empty-diagnostic">
      <span>!</span>
      <h3>No se pudo completar diagnóstico</h3>
      <p>${esc(message)}</p>
    </div>
  `;
}

function bindFaqFilters() {
  $all(".faq-filter").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "todos";

      HelpState.activeFaqFilter = filter;

      $all(".faq-filter").forEach(item => item.classList.remove("active"));
      button.classList.add("active");

      renderFaq(filter);
    });
  });
}

function renderFaq(filter) {
  const list = $("#faqList");
  if (!list) return;

  const items =
    filter === "todos"
      ? HelpState.faqs
      : HelpState.faqs.filter(item => item.category === filter);

  if (!items.length) {
    list.innerHTML = `
      <article class="faq-item">
        <button class="faq-question" type="button">
          <span>No hay preguntas para este filtro</span>
          <strong>—</strong>
        </button>
      </article>
    `;
    return;
  }

  list.innerHTML = items.map(item => `
    <article class="faq-item">
      <button class="faq-question" type="button">
        <span>${esc(item.question)}</span>
        <strong>+</strong>
      </button>
      <div class="faq-answer">
        ${esc(item.answer)}
      </div>
    </article>
  `).join("");

  $all(".faq-question").forEach(button => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      item?.classList.toggle("open");

      const icon = button.querySelector("strong");
      if (icon) icon.textContent = item?.classList.contains("open") ? "−" : "+";
    });
  });
}

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#openBotContact")?.addEventListener("click", openBot);
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

  $("#articleAskBot")?.addEventListener("click", async () => {
    closeAllModals();
    openBot();
    addBotMessage("Explícame este artículo de forma simple", "user");
    await askAssistant("Explícame este artículo de forma simple");
  });
}

async function askAssistant(prompt) {
  const typing = addTyping();

  try {
    const response = await apiRequest("/public/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: "centro-ayuda",
        prompt,
        segment: HelpState.segment
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

function addBotMessage(text, sender) {
  const container = $("#botMessages");
  if (!container) return;

  const message = document.createElement("div");
  message.className = `message message--${sender}`;
  message.textContent = text;

  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function addTyping() {
  const container = $("#botMessages");
  const message = document.createElement("div");

  message.className = "message message--bot";
  message.textContent = "ClaroBot está consultando la base de ayuda...";

  container?.appendChild(message);

  if (container) container.scrollTop = container.scrollHeight;

  return message;
}

function bindModals() {
  $all("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeAllModals();
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