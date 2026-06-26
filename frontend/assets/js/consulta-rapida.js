"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CONSULTA RÁPIDA
   Consulta pública conectada a FastAPI + SQL Server
   Sin Mock, sin Demo, sin DNI/RUC
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const QuickState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  currentCase: null,
  compactTimeline: false,
  isLoading: false
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(QuickState.theme);
  removeObsoleteDemoAndDocumentFields();
  bindTheme();
  bindLookupForm();
  bindResultActions();
  bindBot();
  bindModals();
  loadCaseFromQuery();
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

function showElement(selector, show) {
  const el = $(selector);
  if (el) el.classList.toggle("hidden", !show);
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
  QuickState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = QuickState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function removeObsoleteDemoAndDocumentFields() {
  const documentInput = $("#documentNumber");
  const documentGroup = documentInput?.closest(".form-group");
  if (documentGroup) documentGroup.remove();

  const demoBox = $(".lookup-suggestions");
  if (demoBox) demoBox.remove();

  const lookupSubtitle = $(".lookup-card__header p");
  if (lookupSubtitle) lookupSubtitle.textContent = "Consulta únicamente con el código de caso.";
}

function bindLookupForm() {
  const form = $("#quickLookupForm");

  form?.addEventListener("submit", async event => {
    event.preventDefault();

    if (QuickState.isLoading) return;

    clearErrors();

    const payload = getLookupPayload(form);
    const validation = validateLookup(payload);

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "Datos incompletos",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    await lookupAndRender(payload.caseCode);
  });
}

async function lookupAndRender(caseCode) {
  setLoading(true);

  try {
    const response = await apiRequest(`/public/consulta-caso/${encodeURIComponent(caseCode)}`);
    const result = response.case || response;

    QuickState.currentCase = result;
    renderCase(result);

    showToast({
      title: "Caso encontrado",
      message: `Se cargó el seguimiento público del caso ${result.code}.`,
      type: "success"
    });
  } catch (error) {
    openModal("#notFoundModal");
  } finally {
    setLoading(false);
  }
}

function getLookupPayload(form) {
  const formData = new FormData(form);

  return {
    caseCode: String(formData.get("caseCode") || "").trim()
  };
}

function validateLookup(payload) {
  const errors = {};

  if (!payload.caseCode) {
    errors.caseCode = "Ingresa el código de caso.";
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
    const error = $(`#${key}Error`);
    if (error) error.textContent = value;
  });
}

function clearErrors() {
  $all(".form-error").forEach(item => {
    item.textContent = "";
  });
}

function setLoading(value) {
  QuickState.isLoading = value;

  const button = $("#lookupButton");
  if (!button) return;

  button.disabled = value;
  button.classList.toggle("loading", value);
}

function normalizeCase(data) {
  return {
    code: data.code || data.codigo_caso || "-",
    title: data.title || `Caso ${data.code || data.codigo_caso || ""}`,
    description: data.description || data.descripcion || "Caso registrado en el sistema.",
    type: data.type || data.tipo_caso || "Caso",
    service: data.service || data.servicio || "Servicio asociado",
    priority: data.priority || data.prioridad || "Media",
    status: data.status || data.estado || "Registrado",
    statusType: data.statusType || data.status_type || "info",
    lastUpdate: data.lastUpdate || data.ultima_actualizacion || "-",
    responsible: data.responsible || data.responsable || "Área de atención",
    sla: data.sla || "Sin plazo registrado",
    risk: Number(data.risk ?? data.riesgo ?? 20),
    riskText: data.riskText || data.risk_text || "Riesgo no determinado.",
    recommendation: data.recommendation || data.recomendacion || "Revisa el historial del caso.",
    tracker: Array.isArray(data.tracker) ? data.tracker : ["Registrado"],
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    evidences: Array.isArray(data.evidences) ? data.evidences : []
  };
}

function renderCase(raw) {
  const data = normalizeCase(raw);
  QuickState.currentCase = data;

  showElement("#emptyStateSection", false);
  showElement("#resultSection", true);

  setText("#resultTitle", data.title);
  setText("#resultDescription", data.description);
  setText("#resultType", data.type);
  setText("#resultService", data.service);
  setText("#resultPriority", data.priority);
  setText("#resultLastUpdate", data.lastUpdate);
  setText("#resultResponsible", data.responsible);
  setText("#resultSla", data.sla);
  setText("#aiRecommendation", data.recommendation);
  setText("#riskText", data.riskText);
  setText("#evidenceCount", `${data.evidences.length} archivo${data.evidences.length === 1 ? "" : "s"}`);

  renderStatusBadge(data);
  renderRisk(data);
  renderTracker(data);
  renderTimeline(data.timeline);
  renderEvidences(data.evidences);

  $("#resultSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderStatusBadge(data) {
  const badge = $("#resultStatusBadge");
  if (!badge) return;

  badge.textContent = data.status;
  badge.className = "status-badge";

  if (data.statusType === "success" || data.statusType === "ok") {
    badge.classList.add("status-badge--success");
  }

  if (data.statusType === "warning" || data.statusType === "maintenance") {
    badge.classList.add("status-badge--warning");
  }

  if (data.statusType === "danger") {
    badge.classList.add("status-badge--danger");
  }
}

function renderRisk(data) {
  const bar = $("#riskMeterBar");
  if (!bar) return;

  const risk = Math.max(0, Math.min(100, Number(data.risk || 0)));

  bar.style.width = `${risk}%`;

  if (risk >= 75) {
    bar.style.background = "linear-gradient(90deg, var(--danger), #ffb4b0)";
  } else if (risk >= 45) {
    bar.style.background = "linear-gradient(90deg, var(--warning), #ffd98a)";
  } else {
    bar.style.background = "linear-gradient(90deg, var(--success), #8ee8c4)";
  }
}

function renderTracker(data) {
  const steps = $all(".tracker-step");
  const tracker = data.tracker || [];

  steps.forEach(step => {
    const title = step.querySelector("strong")?.textContent || "";

    step.classList.remove("done", "active");

    if (tracker.includes(title)) {
      step.classList.add("done");
    }

    if (title === data.status) {
      step.classList.remove("done");
      step.classList.add("active");
    }

    if (data.status === "Pendiente por cliente" && title === "En atención") {
      step.classList.remove("done");
      step.classList.add("active");
    }
  });
}

function renderTimeline(items) {
  const list = $("#timelineList");
  if (!list) return;

  const source = QuickState.compactTimeline ? items.slice(-2) : items;

  if (!source.length) {
    list.innerHTML = `
      <div class="timeline-item">
        <div class="timeline-icon">🕘</div>
        <div class="timeline-content">
          <strong>Sin historial público</strong>
          <p>El caso no tiene eventos públicos registrados.</p>
          <small>-</small>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = source.map(item => `
    <div class="timeline-item">
      <div class="timeline-icon">${esc(item.icon || "🕘")}</div>
      <div class="timeline-content">
        <strong>${esc(item.title || "Evento registrado")}</strong>
        <p>${esc(item.description || "")}</p>
        <small>${esc(item.date || "-")}</small>
      </div>
    </div>
  `).join("");
}

function renderEvidences(items) {
  const list = $("#evidenceList");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <div class="evidence-item">
        <span>📭</span>
        <div>
          <strong>Sin evidencias públicas</strong>
          <small>No se registran archivos públicos asociados.</small>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="evidence-item">
      <span>${esc(item.icon || "📎")}</span>
      <div>
        <strong>${esc(item.name || "Evidencia registrada")}</strong>
        <small>${esc(item.detail || "")}</small>
      </div>
    </div>
  `).join("");
}

function bindResultActions() {
  $("#toggleTimelineView")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    QuickState.compactTimeline = !QuickState.compactTimeline;

    $("#toggleTimelineView").textContent = QuickState.compactTimeline
      ? "Vista completa"
      : "Vista compacta";

    renderTimeline(QuickState.currentCase.timeline);
  });

  $("#refreshTracking")?.addEventListener("click", async () => {
    if (!QuickState.currentCase) return;

    showToast({
      title: "Actualizando seguimiento",
      message: "Consultando última información del caso.",
      type: "info"
    });

    await lookupAndRender(QuickState.currentCase.code);
  });

  $("#openFullTracking")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    const next = `cliente/detalle-caso.html?case=${encodeURIComponent(QuickState.currentCase.code)}`;
    window.location.href = `login.html?role=cliente-persona&next=${encodeURIComponent(next)}`;
  });

  $("#downloadConstancy")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    renderConstancy(QuickState.currentCase);
    openModal("#constancyModal");
  });

  $("#openAiSummary")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    renderAiSummary(QuickState.currentCase);
    openModal("#aiSummaryModal");
  });

  $("#openBotFromResult")?.addEventListener("click", openBot);

  $("#uploadEvidenceBtn")?.addEventListener("click", () => {
    const next = QuickState.currentCase
      ? `cliente/detalle-caso.html?case=${encodeURIComponent(QuickState.currentCase.code)}`
      : "cliente/mis-casos.html";

    window.location.href = `login.html?role=cliente-persona&next=${encodeURIComponent(next)}`;
  });

  $("#respondRequestBtn")?.addEventListener("click", () => {
    const next = QuickState.currentCase
      ? `cliente/detalle-caso.html?case=${encodeURIComponent(QuickState.currentCase.code)}`
      : "cliente/mis-casos.html";

    window.location.href = `login.html?role=cliente-persona&next=${encodeURIComponent(next)}`;
  });

  $("#goHelpBtn")?.addEventListener("click", () => {
    window.location.href = "centro-ayuda.html";
  });
}

function renderConstancy(data) {
  const preview = $("#constancyPreview");
  if (!preview) return;

  preview.innerHTML = `
    <div>
      <span>Código</span>
      <strong>${esc(data.code)}</strong>
    </div>
    <div>
      <span>Estado</span>
      <strong>${esc(data.status)}</strong>
    </div>
    <div>
      <span>Servicio</span>
      <strong>${esc(data.service)}</strong>
    </div>
    <div>
      <span>Fecha de consulta</span>
      <strong>${esc(new Date().toLocaleString("es-PE"))}</strong>
    </div>
  `;
}

function renderAiSummary(data) {
  setText(
    "#aiSummaryText",
    `El caso ${data.code} corresponde a un ${String(data.type).toLowerCase()} sobre ${data.service}. Actualmente se encuentra en estado "${data.status}".`
  );

  const box = $("#aiSummaryBox");
  if (!box) return;

  box.innerHTML = `
    <div>
      <span>Estado actual</span>
      <strong>${esc(data.status)}</strong>
    </div>
    <div>
      <span>Prioridad</span>
      <strong>${esc(data.priority)}</strong>
    </div>
    <div>
      <span>Riesgo SLA</span>
      <strong>${esc(data.risk)}%</strong>
    </div>
    <div>
      <span>Recomendación</span>
      <strong>${esc(data.recommendation)}</strong>
    </div>
  `;
}

async function loadCaseFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("case") || params.get("codigo") || params.get("code");

  if (!code) return;

  const input = $("#caseCode");
  if (input) input.value = code;

  await lookupAndRender(code);
}

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);
  $("#drawerBackdrop")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addBotMessage(prompt, "user");
    input.value = "";

    const typing = addTyping();

    try {
      const response = await apiRequest("/public/asistente", {
        method: "POST",
        body: JSON.stringify({
          page: "consulta-rapida",
          prompt,
          case: QuickState.currentCase
        })
      });

      typing.remove();
      addBotMessage(response.answer || "No se recibió respuesta del asistente.", "bot");
    } catch (error) {
      typing.remove();
      addBotMessage(error.message, "bot");
    }
  });

  $all("[data-bot-prompt]").forEach(button => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.botPrompt || "";
      const input = $("#botInput");
      if (input) input.value = prompt;
      $("#botForm")?.dispatchEvent(new Event("submit"));
    });
  });
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
  message.textContent = "ClaroBot está revisando la información disponible...";

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