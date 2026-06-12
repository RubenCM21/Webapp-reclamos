"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - SUPERVISOR.JS
   Módulo Supervisor dinámico
   ---------------------------------------------------------
   Pantallas:
   - dashboard.html
   - casos-pendientes.html
   - asignaciones.html
   - carga-asesores.html
   - monitoreo-sla.html
   - indicadores.html
   - reportes.html
   - auditoria-casos.html
   - configuracion-supervision.html
========================================================= */

/* =========================================================
   MOCK DATA TEMPORAL
   Luego se reemplaza por llamadas al backend.
========================================================= */

/* ── PASO 1: nuevo Mock vacío ────────────────────────────────────────────── */

let Mock = {
  supervisor: {
    id: 0,
    name: "Cargando...",
    initials: "…",
    role: "Supervisor de Atención",
    status: "Supervisión activa",
    lastUpdate: "—"
  },
  advisors:      [],
  cases:         [],
  indicators: {
    kpis:       [],
    estados:    [],
    prioridades: [],
    tendencia:  []
  }
};

/* ── Cargador de datos ───────────────────────────────────────────────────── */

async function _cargarDatosSupervisor() {
  try {
    document.body.classList.add("loading-data");

    const [indicResp, casosResp, asesorResp, slaResp] = await Promise.allSettled([
      Api.Supervisor.indicadores(),
      Api.Supervisor.casosPendientes({ limit: 50 }),
      Api.Supervisor.cargaAsesores(),
      Api.Supervisor.monitoreoSla({ limit: 30 }),
    ]);

    // supervisor + indicators
    if (indicResp.status === "fulfilled" && indicResp.value) {
      const r = indicResp.value;
      if (r.supervisor)  Mock.supervisor  = r.supervisor;
      if (r.indicators)  Mock.indicators  = r.indicators;
    }

    // cases (pendientes + SLA)
    if (casosResp.status === "fulfilled" && casosResp.value) {
      Mock.cases = casosResp.value.casos || casosResp.value || [];
    }

    // advisors
    if (asesorResp.status === "fulfilled" && asesorResp.value) {
      Mock.advisors = asesorResp.value.asesores || asesorResp.value || [];
    }

  } catch (err) {
    console.error("[Supervisor] Error cargando datos:", err);
  } finally {
    document.body.classList.remove("loading-data");
  }
}

/* =========================================================
   STATE
========================================================= */

const State = {
  page: document.body.dataset.page || "",
  theme: localStorage.getItem("claro360-supervisor-theme") || "light",

  selectedCaseId: null,
  selectedAdvisorId: null,
  selectedIndicatorId: null,
  selectedAuditId: null,
  selectedConfigRuleId: null,

  pendingFilter: "todos",
  pendingView: "cards",

  assignmentFilter: "todos",
  assignmentView: "cards",

  advisorLoadFilter: "todos",
  advisorLoadView: "cards",

  slaFilter: "todos",
  slaView: "cards",

  indicatorCompact: false,

  auditFilter: "todos",
  configFilter: "todos"
};

/* =========================================================
   HELPERS
========================================================= */

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value ?? "";
}

function setHTML(selector, value) {
  const el = $(selector);
  if (el) el.innerHTML = value ?? "";
}

function getValue(selector) {
  return $(selector)?.value?.trim() || "";
}

function isChecked(selector) {
  return Boolean($(selector)?.checked);
}

function show(el, condition) {
  if (!el) return;
  el.classList.toggle("hidden", !condition);
}

function getCase(id) {
  return Mock.cases.find(item => item.id === id) || null;
}

function getAdvisor(id) {
  return Mock.advisors.find(item => item.id === id) || null;
}

function getIndicator(id) {
  return Mock.indicators.find(item => item.id === id) || null;
}

function getAudit(id) {
  return Mock.audit.find(item => item.id === id) || null;
}

function getConfigRule(id) {
  return Mock.configRules.find(item => item.id === id) || null;
}

function riskCases() {
  return Mock.cases.filter(c => c.slaHours <= 8 || c.slaHours < 0 || c.priority === "Crítica");
}

function pendingCases() {
  return Mock.cases.filter(c =>
    c.classificationStatus === "Sin clasificar" ||
    c.assignmentStatus === "Sin asesor" ||
    c.observed ||
    c.priority === "Crítica" ||
    c.slaHours <= 8
  );
}

function caseStatusType(status) {
  const s = String(status || "").toLowerCase();

  if (s.includes("vencido") || s.includes("escalado") || s.includes("crítica") || s.includes("critica")) {
    return "danger";
  }

  if (s.includes("pendiente") || s.includes("observado") || s.includes("riesgo")) {
    return "warning";
  }

  if (s.includes("cerrado") || s.includes("listo") || s.includes("controlado")) {
    return "success";
  }

  if (s.includes("derivado")) {
    return "purple";
  }

  return "info";
}

function priorityType(priority) {
  const p = String(priority || "").toLowerCase();

  if (p.includes("crítica") || p.includes("critica")) return "danger";
  if (p.includes("alta")) return "warning";
  if (p.includes("media")) return "info";

  return "success";
}

function advisorStatusType(status) {
  const s = String(status || "").toLowerCase();

  if (s.includes("no disponible")) return "danger";
  if (s.includes("ocupado")) return "warning";
  if (s.includes("disponible")) return "success";

  return "info";
}

function indicatorStatusType(status) {
  if (status === "danger") return "danger";
  if (status === "warning") return "warning";
  if (status === "success") return "success";
  return "info";
}

function pillClass(type) {
  return `status-pill status-pill--${type || "info"}`;
}

function summaryHTML(items) {
  return items.map(([label, value]) => `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
}

function saveSelectedCase(id) {
  State.selectedCaseId = id;
  localStorage.setItem("claro360-supervisor-selected-case", id);
}

function saveSelectedAdvisor(id) {
  State.selectedAdvisorId = id;
}

function toast(title, message, type = "info") {
  const box = $("#toastContainer");

  if (!box) {
    alert(`${title}\n${message}`);
    return;
  }

  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.innerHTML = `
    <span>${type === "success" ? "✓" : type === "warning" ? "!" : type === "danger" ? "×" : "ℹ"}</span>
    <div>
      <strong>${esc(title)}</strong>
      <p>${esc(message)}</p>
    </div>
  `;

  box.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateX(18px)";
    setTimeout(() => item.remove(), 260);
  }, 3200);
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(State.theme);

  await _cargarDatosSupervisor();

  setupBaseUI();
  setupGlobalEvents();
  setupBot();
  setupSearch();
  updateGlobalBadges();

  if (State.page === "supervisor-dashboard")            initDashboard();
  if (State.page === "supervisor-casos-pendientes")     initCasosPendientes();
  if (State.page === "supervisor-asignaciones")         initAsignaciones();
  if (State.page === "supervisor-carga-asesores")       initCargaAsesores();
  if (State.page === "supervisor-monitoreo-sla")        initMonitoreoSla();
  if (State.page === "supervisor-indicadores")          initIndicadores();
  if (State.page === "supervisor-reportes")             initReportes();
  if (State.page === "supervisor-auditoria-casos")      initAuditoria();
  if (State.page === "supervisor-configuracion")        initConfiguracion();
});

/* =========================================================
   BASE UI
========================================================= */

function setupBaseUI() {
  setText("#userNameTop", Mock.supervisor.name);
  setText("#userRoleTop", Mock.supervisor.role);
  setText("#userAvatar", Mock.supervisor.initials);

  $("#menuBtn")?.addEventListener("click", () => {
    $("#sidebar")?.classList.add("open");
    $("#drawerBackdrop")?.classList.add("show");
    document.body.classList.add("drawer-open");
  });

  $("#drawerBackdrop")?.addEventListener("click", () => {
    closeBot();
    closeSidebar();
  });

  $("#themeToggle")?.addEventListener("click", () => {
    applyTheme(State.theme === "light" ? "dark" : "light");
    toast(
      "Tema actualizado",
      `Se activó el modo ${State.theme === "dark" ? "oscuro" : "claro"}.`,
      "success"
    );
  });

  $("#userMenuButton")?.addEventListener("click", event => {
    event.stopPropagation();
    $("#userMenuDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    $("#userMenuDropdown")?.classList.remove("open");
  });

  $("#logoutBtn")?.addEventListener("click", logout);
  $("#logoutDropdownBtn")?.addEventListener("click", logout);
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-supervisor-theme", theme);
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");

  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function logout() { Api.Session.logout(); }

function updateGlobalBadges() {
  setText("#sidebarPendingCount", pendingCases().length);
  setText("#sidebarSlaCount", riskCases().length);
  setText("#notificationBadge", riskCases().length);
}

/* =========================================================
   MODALS
========================================================= */

function setupGlobalEvents() {
  document.addEventListener("click", event => {
    const closeBtn = event.target.closest("[data-close-modal]");
    if (closeBtn) closeModals();
  });

  $("#modalBackdrop")?.addEventListener("click", closeModals);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModals();
      closeSearch();
      closeBot();
      closeSidebar();
    }
  });
}

function openModal(selector) {
  const modal = $(selector);

  if (!modal) {
    toast("Modal no encontrado", `No existe ${selector}.`, "warning");
    return;
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  $("#modalBackdrop")?.classList.add("show");
  document.body.classList.add("modal-open");
}

function closeModals() {
  $$(".modal").forEach(modal => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });

  $("#modalBackdrop")?.classList.remove("show");
  document.body.classList.remove("modal-open");
}

function genericModal(icon, title, text) {
  setText("#genericModalIcon", icon);
  setText("#genericModalTitle", title);
  setText("#genericModalText", text);
  openModal("#genericModal");
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);
  $("#closeSearchBtn")?.addEventListener("click", closeSearch);
  $("#globalSearchInput")?.addEventListener("input", renderSearch);
}

function openSearch() {
  $("#searchModal")?.classList.add("show");
  $("#searchModal")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("search-open");

  setTimeout(() => $("#globalSearchInput")?.focus(), 50);
  renderSearch();
}

function closeSearch() {
  $("#searchModal")?.classList.remove("show");
  $("#searchModal")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-open");
}

function renderSearch() {
  const box = $("#searchResults");
  if (!box) return;

  const query = getValue("#globalSearchInput").toLowerCase();

  const pages = [
    ["🏠", "Dashboard", "Centro de supervisión operativa.", "dashboard.html"],
    ["📋", "Casos pendientes", "Clasificación y decisión de casos.", "casos-pendientes.html"],
    ["👥", "Asignaciones", "Asignar, reasignar, derivar y escalar.", "asignaciones.html"],
    ["⚖️", "Carga de asesores", "Balance de capacidad del equipo.", "carga-asesores.html"],
    ["⏱️", "Monitoreo SLA", "Control de vencimientos y riesgo.", "monitoreo-sla.html"],
    ["📈", "Indicadores", "Métricas vivas de desempeño.", "indicadores.html"],
    ["📊", "Reportes", "Generación formal de reportes.", "reportes.html"],
    ["🕵️", "Auditoría", "Trazabilidad de acciones.", "auditoria-casos.html"],
    ["⚙️", "Configuración", "Reglas operativas de supervisión.", "configuracion-supervision.html"]
  ].map(([icon, title, text, href]) => ({
    icon,
    title,
    text,
    href,
    key: `${title} ${text}`
  }));

  const cases = Mock.cases.map(item => ({
    icon: item.icon,
    title: item.id,
    text: `${item.title} · ${item.clientName}`,
    href: "casos-pendientes.html",
    key: `${item.id} ${item.title} ${item.clientName} ${item.type} ${item.priority} ${item.status} ${item.advisorName}`
  }));

  const advisors = Mock.advisors.map(item => ({
    icon: "👤",
    title: item.name,
    text: `${item.specialty} · ${item.status}`,
    href: "carga-asesores.html",
    key: `${item.name} ${item.specialty} ${item.status}`
  }));

  const indicators = Mock.indicators.map(item => ({
    icon: item.icon,
    title: item.title,
    text: `${item.value} · Meta ${item.target}`,
    href: "indicadores.html",
    key: `${item.title} ${item.value} ${item.description}`
  }));

  const results = [...pages, ...cases, ...advisors, ...indicators]
    .filter(item => !query || item.key.toLowerCase().includes(query));

  box.innerHTML = results.length
    ? results.map(item => `
      <a href="${item.href}" class="search-result-item">
        <span>${item.icon}</span>
        <div>
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.text)}</small>
        </div>
      </a>
    `).join("")
    : `<p class="muted">No se encontraron resultados.</p>`;
}

/* =========================================================
   BOT
========================================================= */

function setupBot() {
  $("#openBotSidebar")?.addEventListener("click", openBot);
  $("#openBotWelcome")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", event => {
    event.preventDefault();

    const prompt = getValue("#botInput");
    if (!prompt) return;

    $("#botInput").value = "";
    askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach(button => {
    button.addEventListener("click", () => askBot(button.dataset.botPrompt));
  });

  const aiButtons = [
    ["analyzeSupervisorWorkBtn", "Analiza la operación"],
    ["prioritizeCriticalCasesBtn", "Prioriza los casos críticos"],
    ["prioritizePendingBtn", "Prioriza casos pendientes"],
    ["analyzePendingCasesBtn", "Analiza casos pendientes"],
    ["smartAssignBtn", "Sugiere asignación para casos sin asesor"],
    ["analyzeAssignmentsBtn", "Analiza asignaciones"],
    ["balanceLoadAiBtn", "Recomienda balance de carga"],
    ["analyzeAdvisorLoadBtn", "Analiza carga de asesores"],
    ["prioritizeSlaMonitorBtn", "Prioriza SLA"],
    ["analyzeSlaMonitorBtn", "Analiza SLA"],
    ["priorityMapAiBtn", "Interpreta mapa de prioridades"],
    ["analyzeIndicatorsBtn", "Analiza indicadores principales"],
    ["generateIndicatorInsightBtn", "Genera análisis de indicadores"],
    ["analyzeReportsBtn", "Analiza reportes"],
    ["auditAnalyzeBtn", "Analiza auditoría"],
    ["generateAuditInsightBtn", "Genera análisis de auditoría"],
    ["analyzeConfigBtn", "Revisa configuración"],
    ["loadMapAiBtn", "Interpreta mapa de carga"]
  ];

  aiButtons.forEach(([id, prompt]) => {
    $(`#${id}`)?.addEventListener("click", () => askBot(prompt));
  });
}

function openBot() {
  $("#botDrawer")?.classList.add("open");
  $("#drawerBackdrop")?.classList.add("show");
  document.body.classList.add("drawer-open");
}

function closeBot() {
  $("#botDrawer")?.classList.remove("open");

  if (!$("#sidebar")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function askBot(prompt) {
  openBot();
  addMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando";
  $("#botMessages")?.appendChild(typing);

  setTimeout(() => {
    typing.remove();
    addMessage(botAnswer(prompt), "bot");
  }, 450);
}

function addMessage(text, who) {
  const box = $("#botMessages");
  if (!box) return;

  const message = document.createElement("div");
  message.className = `message message--${who}`;
  message.textContent = text;

  box.appendChild(message);
  box.scrollTop = box.scrollHeight;
}

function botAnswer(prompt) {
  const text = String(prompt || "").toLowerCase();

  const critical = Mock.cases
    .filter(item => item.priority === "Crítica" || item.slaHours <= 8)
    .sort((a, b) => a.slaHours - b.slaHours);

  const overloaded = Mock.advisors
    .filter(item => item.capacity >= 85)
    .sort((a, b) => b.capacity - a.capacity);

  const unassigned = Mock.cases.filter(item => item.assignmentStatus === "Sin asesor");

  if (text.includes("sla") || text.includes("venc") || text.includes("riesgo")) {
    if (!critical.length) return "No hay casos con riesgo SLA alto en este momento.";

    return `El mayor riesgo está en ${critical[0].id}: ${critical[0].title}. Estado: ${critical[0].status}. SLA: ${critical[0].slaText}. Recomendación: escalar o reasignar seguimiento inmediato.`;
  }

  if (text.includes("carga") || text.includes("asesor") || text.includes("sobrecarg")) {
    if (!overloaded.length) return "La carga del equipo está equilibrada. Mantén monitoreo sobre casos críticos.";

    return `${overloaded[0].name} concentra mayor carga (${overloaded[0].capacity}%). Recomendación: redistribuir 2 o 3 casos de menor complejidad a un asesor disponible.`;
  }

  if (text.includes("asign")) {
    if (!unassigned.length) return "No hay casos sin asesor pendientes de asignación.";

    const bestAdvisor = Mock.advisors
      .filter(item => item.status === "Disponible")
      .sort((a, b) => a.capacity - b.capacity)[0];

    return `Hay ${unassigned.length} casos sin asesor. Sugerencia: asignar primero ${unassigned[0].id} a ${bestAdvisor?.name || "un asesor disponible"} por menor carga y criticidad.`;
  }

  if (text.includes("indicador") || text.includes("desviación") || text.includes("mejora")) {
    const worst = [...Mock.indicators].sort((a, b) => a.progress - b.progress)[0];
    return `El indicador que requiere más atención es ${worst.title} (${worst.value}). Causa probable: ${worst.cause}`;
  }

  if (text.includes("auditor") || text.includes("trazabilidad") || text.includes("cambios")) {
    return "La auditoría muestra cambios sensibles en escalamiento, prioridad y reasignación. Recomendación: revisar primero eventos de casos críticos y vencidos.";
  }

  if (text.includes("reporte")) {
    return "Para hoy conviene generar un reporte ejecutivo con: casos críticos, SLA en riesgo, carga por asesor, cierres, reasignaciones y auditoría de cambios relevantes.";
  }

  if (text.includes("config") || text.includes("regla") || text.includes("umbral")) {
    return "Las reglas clave a revisar son: umbral SLA alto, capacidad máxima por asesor y escalamiento automático por caso vencido.";
  }

  return "Puedo ayudarte a priorizar casos, balancear carga, revisar SLA, explicar indicadores, preparar reportes o validar trazabilidad.";
}

/* =========================================================
   COMPONENTS
========================================================= */

function renderKpis(selector, data) {
  setHTML(selector, data.map(([icon, value, title, text]) => `
    <article class="kpi-card">
      <span class="kpi-card__icon">${icon}</span>
      <div>
        <strong>${esc(value)}</strong>
        <p>${esc(title)}</p>
        <small>${esc(text)}</small>
      </div>
    </article>
  `).join(""));
}

function renderAi(selector, rows) {
  setHTML(selector, rows.map(([title, text]) => `
    <div class="ai-summary-item">
      <strong>${esc(title)}</strong>
      <p>${esc(text)}</p>
    </div>
  `).join(""));
}

function renderChecklist(selector, rows) {
  setHTML(selector, rows.map(([icon, title, text]) => `
    <article class="check-item">
      <span class="check-icon">${icon}</span>
      <div>
        <strong>${esc(title)}</strong>
        <p>${esc(text)}</p>
      </div>
    </article>
  `).join(""));
}

function renderActivity(selector, rows) {
  setHTML(selector, rows.map(item => `
    <article class="activity-item">
      <span class="activity-icon">${item.icon || "🕘"}</span>
      <div class="activity-content">
        <strong>${esc(item.title || item.action)}</strong>
        <p>${esc(item.text || item.detail)}</p>
        <small>${esc(item.date)}</small>
      </div>
    </article>
  `).join(""));
}

function caseSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Cliente", item.clientName],
    ["Tipo", item.type],
    ["Servicio", item.service],
    ["Prioridad", item.priority],
    ["Estado", item.status],
    ["Responsable", item.advisorName],
    ["SLA", item.slaText],
    ["Acción sugerida", item.action]
  ]);
}

function advisorSummary(item) {
  return summaryHTML([
    ["Asesor", item.name],
    ["Especialidad", item.specialty],
    ["Estado", item.status],
    ["Casos", item.cases],
    ["Críticos", item.critical],
    ["Riesgo SLA", item.slaRisk],
    ["Productividad", `${item.productivity}%`],
    ["Capacidad", `${item.capacity}%`]
  ]);
}

function renderCaseCard(item, mode = "supervisor") {
  return `
    <article class="case-card">
      <span class="case-card__icon">${item.icon}</span>

      <div>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.description)}</p>

        <div class="case-meta">
          <span>${esc(item.id)}</span>
          <span>${esc(item.clientName)}</span>
          <span>${esc(item.type)}</span>
          <span>${esc(item.channel)}</span>
          <span>${esc(item.priority)}</span>
          <span>${esc(item.slaText)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="${pillClass(caseStatusType(item.status))}">${esc(item.status)}</span>
        <button type="button" data-action="${mode}-view-case" data-case-id="${esc(item.id)}">Ver</button>
        ${mode === "pending" ? `
          <button type="button" data-action="classify-case" data-case-id="${esc(item.id)}">Clasificar</button>
          <button type="button" data-action="send-assignment" data-case-id="${esc(item.id)}">Asignar</button>
        ` : ""}
        ${mode === "assignment" ? `
          <button type="button" data-action="assign-case" data-case-id="${esc(item.id)}">Asignar</button>
          <button type="button" data-action="reassign-case" data-case-id="${esc(item.id)}">Reasignar</button>
        ` : ""}
        ${mode === "sla" ? `
          <button type="button" data-action="sla-alert" data-case-id="${esc(item.id)}">Alertar</button>
          <button type="button" data-action="sla-follow" data-case-id="${esc(item.id)}">Seguimiento</button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderCaseTableRow(item, mode = "pending") {
  if (mode === "pending") {
    return `
      <tr>
        <td>${esc(item.id)}</td>
        <td>${esc(item.clientName)}</td>
        <td>${esc(item.type)}</td>
        <td>${esc(item.channel)}</td>
        <td><span class="${pillClass(priorityType(item.priority))}">${esc(item.priority)}</span></td>
        <td><span class="${pillClass(caseStatusType(item.status))}">${esc(item.status)}</span></td>
        <td>${esc(item.slaText)}</td>
        <td>
          <button type="button" data-action="pending-view-case" data-case-id="${esc(item.id)}">Ver</button>
          <button type="button" data-action="classify-case" data-case-id="${esc(item.id)}">Clasificar</button>
        </td>
      </tr>
    `;
  }

  if (mode === "assignment") {
    return `
      <tr>
        <td>${esc(item.id)}</td>
        <td>${esc(item.clientName)}</td>
        <td>${esc(item.type)}</td>
        <td>${esc(item.advisorName)}</td>
        <td><span class="${pillClass(priorityType(item.priority))}">${esc(item.priority)}</span></td>
        <td>${esc(item.slaText)}</td>
        <td>${esc(item.assignmentFlow)}</td>
        <td>
          <button type="button" data-action="assignment-view-case" data-case-id="${esc(item.id)}">Ver</button>
          <button type="button" data-action="assign-case" data-case-id="${esc(item.id)}">Asignar</button>
        </td>
      </tr>
    `;
  }

  if (mode === "sla") {
    return `
      <tr>
        <td>${esc(item.id)}</td>
        <td>${esc(item.clientName)}</td>
        <td>${esc(item.advisorName)}</td>
        <td><span class="${pillClass(caseStatusType(item.status))}">${esc(item.status)}</span></td>
        <td><span class="${pillClass(priorityType(item.priority))}">${esc(item.priority)}</span></td>
        <td>${esc(item.slaText)}</td>
        <td>${esc(item.slaRisk)}</td>
        <td>
          <button type="button" data-action="sla-view-case" data-case-id="${esc(item.id)}">Ver</button>
          <button type="button" data-action="sla-alert" data-case-id="${esc(item.id)}">Alertar</button>
        </td>
      </tr>
    `;
  }

  return "";
}

function bindCaseActions(root = document) {
  $$("[data-action$='view-case']", root).forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.caseId;

      if (State.page === "supervisor-casos-pendientes") openPendingCaseModal(id);
      else if (State.page === "supervisor-asignaciones") openAssignmentCaseModal(id);
      else if (State.page === "supervisor-monitoreo-sla") openSlaCaseModal(id);
      else openQuickCaseModal(id);
    });
  });

  $$("[data-action='classify-case']", root).forEach(button => {
    button.addEventListener("click", () => openClassifyCaseModal(button.dataset.caseId));
  });

  $$("[data-action='send-assignment']", root).forEach(button => {
    button.addEventListener("click", () => openSendToAssignmentModal(button.dataset.caseId));
  });

  $$("[data-action='assign-case']", root).forEach(button => {
    button.addEventListener("click", () => openAssignAdvisorModal(button.dataset.caseId));
  });

  $$("[data-action='reassign-case']", root).forEach(button => {
    button.addEventListener("click", () => openReassignCaseModal(button.dataset.caseId));
  });

  $$("[data-action='derive-case']", root).forEach(button => {
    button.addEventListener("click", () => openDeriveAreaModal(button.dataset.caseId));
  });

  $$("[data-action='escalate-case']", root).forEach(button => {
    button.addEventListener("click", () => openEscalateCaseModal(button.dataset.caseId));
  });

  $$("[data-action='sla-alert']", root).forEach(button => {
    button.addEventListener("click", () => openSendSlaAlertModal(button.dataset.caseId));
  });

  $$("[data-action='sla-follow']", root).forEach(button => {
    button.addEventListener("click", () => openSlaFollowModal(button.dataset.caseId));
  });
}

function populateAdvisorSelects() {
  const options = `<option value="">Seleccionar</option>` + Mock.advisors.map(item => `
    <option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.specialty)} · ${item.capacity}% carga</option>
  `).join("");

  [
    "#assignAdvisorSelect",
    "#reassignToAdvisor",
    "#redistributeFromAdvisor",
    "#redistributeToAdvisor",
    "#indicatorAdvisorFilter"
  ].forEach(selector => {
    const select = $(selector);
    if (!select) return;

    if (selector === "#indicatorAdvisorFilter") {
      select.innerHTML = `<option value="todos">Todos</option>` + Mock.advisors.map(item => `
        <option value="${esc(item.id)}">${esc(item.name)}</option>
      `).join("");
    } else {
      select.innerHTML = options;
    }
  });
}

/* =========================================================
   DASHBOARD
========================================================= */

function initDashboard() {
  setText("#dashboardHeroEyebrow", "Supervisión operativa");
  setText("#dashboardHeroTitle", `Hola, ${Mock.supervisor.name}`);
  setText("#dashboardHeroText", "Controla pendientes, asignaciones, carga del equipo, SLA, indicadores y trazabilidad desde una vista ejecutiva.");
  setText("#supervisorStatus", Mock.supervisor.status);
  setText("#supervisorLastUpdate", Mock.supervisor.lastUpdate);

  renderDashboardKpis();
  renderCriticalCases();
  renderAdvisorLoadSummary();
  renderDashboardSla();
  renderDashboardIndicators();
  renderSupervisorActivity();

  renderAi("#supervisorAiSummary", [
    ["Prioridad inmediata", "Atender casos críticos con SLA vencido o menor a 8 horas."],
    ["Carga del equipo", "El mayor riesgo se concentra en asesores con ocupación superior a 85%."],
    ["Decisión sugerida", "Clasificar casos nuevos y asignar primero los que afectan SLA."]
  ]);

  $("#refreshCriticalCasesBtn")?.addEventListener("click", () => {
    renderCriticalCases();
    toast("Casos actualizados", "Se refrescó la lista de casos críticos.", "success");
  });

  $("#refreshAdvisorLoadBtn")?.addEventListener("click", () => {
    renderAdvisorLoadSummary();
    toast("Carga actualizada", "Se actualizó la distribución del equipo.", "success");
  });

  $("#refreshDashboardSlaBtn")?.addEventListener("click", () => {
    renderDashboardSla();
    toast("SLA actualizado", "Se actualizó el resumen de vencimientos.", "success");
  });

  $("#refreshDashboardIndicatorsBtn")?.addEventListener("click", () => {
    renderDashboardIndicators();
    toast("Indicadores actualizados", "Se recalcularon los indicadores principales.", "success");
  });

  $("#refreshSupervisorActivityBtn")?.addEventListener("click", () => {
    renderSupervisorActivity();
    toast("Actividad actualizada", "Se actualizó la trazabilidad reciente.", "success");
  });

  $("#indicatorDetailAiBtn")?.addEventListener("click", () => {
    askBot("Analiza el indicador seleccionado");
  });

  $("#caseQuickViewAssignBtn")?.addEventListener("click", () => {
    closeModals();
    openAssignAdvisorModal(State.selectedCaseId);
  });

  $("#caseQuickViewClassifyBtn")?.addEventListener("click", () => {
    closeModals();
    openClassifyCaseModal(State.selectedCaseId);
  });

  $("#caseQuickViewEscalateBtn")?.addEventListener("click", () => {
    closeModals();
    openEscalateCaseModal(State.selectedCaseId);
  });
}

function renderDashboardKpis() {
  renderKpis("#supervisorKpiGrid", [
    ["📋", pendingCases().length, "Pendientes", "Casos por decisión"],
    ["🔥", Mock.cases.filter(c => c.priority === "Crítica").length, "Críticos", "Requieren atención"],
    ["⏱️", riskCases().length, "Riesgo SLA", "Vencidos o próximos"],
    ["👥", Mock.advisors.length, "Asesores", "Equipo operativo"]
  ]);
}

function renderCriticalCases() {
  const rows = [...Mock.cases]
    .filter(c => c.priority === "Crítica" || c.slaHours <= 8 || c.status === "Observado")
    .sort((a, b) => a.slaHours - b.slaHours);

  setHTML("#criticalCasesList", rows.map(c => renderCaseCard(c, "supervisor")).join(""));
  show($("#emptyCriticalCasesState"), !rows.length);
  bindCaseActions($("#criticalCasesList"));
}

function renderAdvisorLoadSummary() {
  const rows = [...Mock.advisors].sort((a, b) => b.capacity - a.capacity);

  setHTML("#advisorLoadSummary", rows.map(a => `
    <article class="advisor-load-card">
      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(a.initials)}</span>
        <div>
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.specialty)}</p>
        </div>
        <span class="${pillClass(advisorStatusType(a.status))}">${esc(a.status)}</span>
      </div>

      <div class="advisor-load-metrics">
        <div>
          <span>Casos</span>
          <strong>${esc(a.cases)}</strong>
        </div>
        <div>
          <span>Críticos</span>
          <strong>${esc(a.critical)}</strong>
        </div>
        <div>
          <span>SLA</span>
          <strong>${esc(a.slaRisk)}</strong>
        </div>
        <div>
          <span>Carga</span>
          <strong>${esc(a.capacity)}%</strong>
        </div>
      </div>

      <div class="advisor-load-progress">
        <span style="width:${Math.min(a.capacity, 100)}%"></span>
      </div>

      <div class="service-actions">
        <button type="button" data-advisor-id="${esc(a.id)}" data-action="view-advisor">Ver asesor</button>
      </div>
    </article>
  `).join(""));

  show($("#emptyAdvisorLoadState"), !rows.length);
  bindAdvisorButtons($("#advisorLoadSummary"));
}

function renderDashboardSla() {
  const rows = [...riskCases()].sort((a, b) => a.slaHours - b.slaHours);

  setHTML("#dashboardSlaList", rows.map(c => `
    <article class="sla-item">
      <span class="activity-icon">⏱️</span>
      <div>
        <strong>${esc(c.id)} · ${esc(c.priority)}</strong>
        <p>${esc(c.title)} · ${esc(c.slaText)} · ${esc(c.advisorName)}</p>
        <div class="sla-meter">
          <span style="width:${Math.max(12, 100 - Math.max(c.slaHours, 0) * 9)}%"></span>
        </div>
      </div>
      <button type="button" data-action="sla-view-case" data-case-id="${esc(c.id)}">Ver</button>
    </article>
  `).join(""));

  show($("#emptyDashboardSlaState"), !rows.length);
  bindCaseActions($("#dashboardSlaList"));
}

function renderDashboardIndicators() {
  const rows = Mock.indicators.slice(0, 4);

  setHTML("#dashboardIndicatorGrid", rows.map(i => indicatorCard(i)).join(""));

  bindIndicatorButtons($("#dashboardIndicatorGrid"));
}

function renderSupervisorActivity() {
  const rows = Mock.audit.slice(0, 5).map(a => ({
    icon: auditIcon(a.type),
    title: `${a.action} · ${a.caseId}`,
    text: `${a.before} → ${a.after}. ${a.detail}`,
    date: a.date
  }));

  renderActivity("#supervisorActivityTimeline", rows);
  show($("#emptySupervisorActivityState"), !rows.length);
}

function openQuickCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#caseQuickViewIcon", item.icon);
  setText("#caseQuickViewTitle", item.id);
  setText("#caseQuickViewText", item.description);
  setHTML("#caseQuickViewSummary", caseSummary(item));

  openModal("#caseQuickViewModal");
}

/* =========================================================
   CASOS PENDIENTES
========================================================= */

function initPendingCases() {
  renderPendingCases();

  $("#pendingCaseSearch")?.addEventListener("input", renderPendingCases);

  $$("[data-pending-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.pendingFilter = button.dataset.pendingFilter;
      $$("[data-pending-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderPendingCases();
    });
  });

  $("#togglePendingViewBtn")?.addEventListener("click", () => {
    State.pendingView = State.pendingView === "cards" ? "table" : "cards";
    $("#togglePendingViewBtn").textContent = State.pendingView === "cards" ? "Vista tabla" : "Vista cards";
    renderPendingCases();
  });

  $("#refreshPendingCasesBtn")?.addEventListener("click", () => {
    renderPendingCases();
    toast("Pendientes actualizados", "Se actualizó la bandeja de casos pendientes.", "success");
  });

  $("#exportPendingCasesBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "La bandeja de pendientes fue preparada para exportación.");
  });

  $("#prioritizePendingBtn")?.addEventListener("click", () => {
    askBot("Qué casos pendientes debo revisar primero");
  });

  $("#pendingCaseClassifyBtn")?.addEventListener("click", () => {
    closeModals();
    openClassifyCaseModal(State.selectedCaseId);
  });

  $("#pendingCaseSendAssignBtn")?.addEventListener("click", () => {
    closeModals();
    openSendToAssignmentModal(State.selectedCaseId);
  });

  $("#pendingCaseObserveBtn")?.addEventListener("click", () => {
    closeModals();
    openObserveCaseModal(State.selectedCaseId);
  });

  $("#confirmClassifyCaseBtn")?.addEventListener("click", confirmClassifyCase);

  $("#classifyCaseAiBtn")?.addEventListener("click", () => {
    $("#classifyCaseType").value = "Incidencia";
    $("#classifyCaseCategory").value = "Soporte técnico";
    $("#classifyCasePriority").value = "Crítica";
    $("#classifyCaseRoute").value = "Asignación directa";
    $("#classifyCaseReason").value = "La IA sugiere clasificación crítica por impacto del servicio, SLA cercano y necesidad de atención técnica inmediata.";
    toast("Sugerencia aplicada", "Se completó una clasificación sugerida por IA.", "success");
  });

  $("#confirmChangePriorityBtn")?.addEventListener("click", confirmChangePriority);
  $("#confirmObserveCaseBtn")?.addEventListener("click", confirmObserveCase);
  $("#confirmSendToAssignmentBtn")?.addEventListener("click", confirmSendToAssignment);

  renderAi("#pendingAiSummary", [
    ["Primero", "Revisar casos críticos sin clasificar o sin asesor."],
    ["Luego", "Observar casos con información incompleta antes de asignarlos."],
    ["Después", "Enviar a asignación los casos ya clasificados y con evidencia suficiente."]
  ]);

  renderChecklist("#pendingActionPlan", [
    ["1", "Clasificar críticos", "Define tipo, categoría y prioridad en casos con SLA corto."],
    ["2", "Corregir observados", "Devuelve casos incompletos con observación clara."],
    ["3", "Enviar a asignación", "Pasa casos validados a la cola de responsables."]
  ]);
}

function pendingFilteredCases() {
  const query = getValue("#pendingCaseSearch").toLowerCase();

  return pendingCases().filter(item => {
    const text = `${item.id} ${item.clientName} ${item.type} ${item.channel} ${item.priority} ${item.status} ${item.classificationStatus} ${item.assignmentStatus}`.toLowerCase();

    const matchesSearch = !query || text.includes(query);

    const filter = State.pendingFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "sin_clasificar" && item.classificationStatus === "Sin clasificar") ||
      (filter === "sin_asignar" && item.assignmentStatus === "Sin asesor") ||
      (filter === "observados" && item.observed) ||
      (filter === "criticos" && item.priority === "Crítica") ||
      (filter === "sla_riesgo" && item.slaHours <= 8);

    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function renderPendingCases() {
  const rows = pendingFilteredCases();

  setText("#pendingSummaryTitle", `${rows.length} pendientes visibles`);
  setText("#pendingSummaryText", `Filtro actual: ${State.pendingFilter}.`);

  renderKpis("#pendingKpiGrid", [
    ["📋", rows.length, "Pendientes visibles", "Resultado del filtro"],
    ["🧭", rows.filter(c => c.classificationStatus === "Sin clasificar").length, "Sin clasificar", "Requieren tipificación"],
    ["👥", rows.filter(c => c.assignmentStatus === "Sin asesor").length, "Sin asesor", "Requieren responsable"],
    ["🔥", rows.filter(c => c.priority === "Crítica").length, "Críticos", "Atención inmediata"]
  ]);

  setHTML("#pendingCasesList", rows.map(c => renderCaseCard(c, "pending")).join(""));
  setHTML("#pendingCasesTableBody", rows.map(c => renderCaseTableRow(c, "pending")).join(""));

  show($("#pendingCasesList"), State.pendingView === "cards");
  show($("#pendingCasesTableWrap"), State.pendingView === "table");
  show($("#emptyPendingCasesState"), !rows.length);

  bindCaseActions($("#pendingCasesList"));
  bindCaseActions($("#pendingCasesTableBody"));
}

function openPendingCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#pendingCaseModalIcon", item.icon);
  setText("#pendingCaseModalTitle", item.id);
  setText("#pendingCaseModalText", item.description);
  setHTML("#pendingCaseModalSummary", caseSummary(item));

  openModal("#pendingCaseModal");
}

function openClassifyCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#classifyCaseContext", caseSummary(item));
  openModal("#classifyCaseModal");
}

function confirmClassifyCase() {
  if (
    !getValue("#classifyCaseType") ||
    !getValue("#classifyCaseCategory") ||
    !getValue("#classifyCasePriority") ||
    !getValue("#classifyCaseRoute") ||
    !getValue("#classifyCaseReason") ||
    !isChecked("#classifyCaseDeclaration")
  ) {
    toast("Faltan datos", "Completa tipo, categoría, prioridad, ruta, criterio y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Caso clasificado", "La clasificación fue registrada correctamente.", "success");
  renderPendingCases();
}

function openChangePriorityModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#changePriorityContext", caseSummary(item));
  openModal("#changePriorityModal");
}

function confirmChangePriority() {
  if (
    !getValue("#newPriority") ||
    !getValue("#priorityReasonType") ||
    !getValue("#priorityComment") ||
    !isChecked("#priorityDeclaration")
  ) {
    toast("Faltan datos", "Completa prioridad, motivo, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Prioridad actualizada", "El cambio de prioridad fue registrado.", "success");
}

function openObserveCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#observeCaseContext", caseSummary(item));
  openModal("#observeCaseModal");
}

function confirmObserveCase() {
  if (
    !getValue("#observeReason") ||
    !getValue("#observeReturnTo") ||
    !getValue("#observeComment") ||
    !isChecked("#observeDeclaration")
  ) {
    toast("Faltan datos", "Completa motivo, retorno, detalle y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Observación registrada", "El caso fue observado con trazabilidad.", "success");
}

function openSendToAssignmentModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#sendToAssignmentContext", caseSummary(item));
  openModal("#sendToAssignmentModal");
}

function confirmSendToAssignment() {
  if (
    !getValue("#assignmentSuggestion") ||
    !getValue("#assignmentQueue") ||
    !isChecked("#assignmentDeclaration")
  ) {
    toast("Faltan datos", "Completa sugerencia, cola destino y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Caso enviado", "El caso fue enviado a la cola de asignación.", "success");
}

/* =========================================================
   ASIGNACIONES
========================================================= */

function initAssignments() {
  renderAssignments();

  $("#assignmentsSearch")?.addEventListener("input", renderAssignments);

  $$("[data-assignment-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.assignmentFilter = button.dataset.assignmentFilter;
      $$("[data-assignment-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAssignments();
    });
  });

  $("#toggleAssignmentsViewBtn")?.addEventListener("click", () => {
    State.assignmentView = State.assignmentView === "cards" ? "table" : "cards";
    $("#toggleAssignmentsViewBtn").textContent = State.assignmentView === "cards" ? "Vista tabla" : "Vista cards";
    renderAssignments();
  });

  $("#refreshAssignmentsBtn")?.addEventListener("click", () => {
    renderAssignments();
    toast("Asignaciones actualizadas", "Se refrescó la bandeja de asignaciones.", "success");
  });

  $("#exportAssignmentsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "La información de asignaciones fue preparada para exportación.");
  });

  $("#smartAssignBtn")?.addEventListener("click", () => {
    askBot("Sugiere asignación para casos sin asesor");
  });

  $("#openMassAssignmentBtn")?.addEventListener("click", () => {
    openModal("#massAssignmentModal");
  });

  $("#assignmentCaseAssignBtn")?.addEventListener("click", () => {
    closeModals();
    openAssignAdvisorModal(State.selectedCaseId);
  });

  $("#assignmentCaseReassignBtn")?.addEventListener("click", () => {
    closeModals();
    openReassignCaseModal(State.selectedCaseId);
  });

  $("#assignmentCaseDeriveBtn")?.addEventListener("click", () => {
    closeModals();
    openDeriveAreaModal(State.selectedCaseId);
  });

  $("#assignmentCaseEscalateBtn")?.addEventListener("click", () => {
    closeModals();
    openEscalateCaseModal(State.selectedCaseId);
  });

  $("#confirmAssignAdvisorBtn")?.addEventListener("click", confirmAssignAdvisor);

  $("#assignAdvisorAiBtn")?.addEventListener("click", () => {
    const bestAdvisor = [...Mock.advisors]
      .filter(a => a.status === "Disponible")
      .sort((a, b) => a.capacity - b.capacity)[0];

    if (bestAdvisor) {
      $("#assignAdvisorSelect").value = bestAdvisor.id;
      $("#assignCriterion").value = "Menor carga";
      $("#assignVisibility").value = "Visible para asesor";
      $("#assignComment").value = `La IA sugiere asignar a ${bestAdvisor.name} por menor carga relativa, disponibilidad y capacidad para recibir nuevos casos.`;
      toast("Asesor sugerido", `Se sugirió a ${bestAdvisor.name}.`, "success");
    }
  });

  $("#confirmReassignCaseBtn")?.addEventListener("click", confirmReassignCase);

  $("#reassignAiBtn")?.addEventListener("click", () => {
    const bestAdvisor = [...Mock.advisors]
      .filter(a => a.status === "Disponible")
      .sort((a, b) => a.capacity - b.capacity)[0];

    if (bestAdvisor) {
      $("#reassignToAdvisor").value = bestAdvisor.id;
      $("#reassignReason").value = "Sobrecarga";
      $("#reassignPriority").value = "Alta";
      $("#reassignComment").value = `La IA recomienda reasignar a ${bestAdvisor.name} para reducir concentración de carga y mitigar riesgo SLA.`;
      toast("Destino sugerido", `Se sugirió a ${bestAdvisor.name}.`, "success");
    }
  });

  $("#confirmDeriveAreaBtn")?.addEventListener("click", confirmDeriveArea);
  $("#confirmEscalateCaseBtn")?.addEventListener("click", confirmEscalateCase);

  $("#confirmMassAssignmentBtn")?.addEventListener("click", confirmMassAssignment);

  $("#massAssignmentAiBtn")?.addEventListener("click", () => {
    $("#massAssignmentCriteria").value = "Menor carga";
    $("#massAssignmentScope").value = "Casos sin asesor";
    toast("Criterio sugerido", "La IA recomienda asignación por menor carga para casos sin asesor.", "success");
  });

  renderAi("#assignmentsAiSummary", [
    ["Asignar primero", "Casos sin asesor con prioridad crítica o SLA menor a 8 horas."],
    ["Evitar sobrecarga", "No asignar nuevos casos a asesores con carga mayor a 85%."],
    ["Escalar", "Casos vencidos o bloqueados deben pasar a mesa crítica o jefatura."]
  ]);

  renderChecklist("#assignmentsActionPlan", [
    ["1", "Resolver sin asesor", "Asignar responsables a casos críticos sin dueño."],
    ["2", "Reasignar sobrecarga", "Mover casos desde asesores saturados a disponibles."],
    ["3", "Escalar vencidos", "Elevar casos con SLA vencido o bloqueo operativo."]
  ]);
}

function assignmentFilteredCases() {
  const query = getValue("#assignmentsSearch").toLowerCase();

  return Mock.cases.filter(item => {
    const text = `${item.id} ${item.clientName} ${item.advisorName} ${item.area} ${item.priority} ${item.status} ${item.assignmentFlow}`.toLowerCase();

    const matchesSearch = !query || text.includes(query);

    const filter = State.assignmentFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "sin_asesor" && item.assignmentStatus === "Sin asesor") ||
      (filter === "reasignar" && item.blocked) ||
      (filter === "derivados" && item.derived) ||
      (filter === "escalados" && item.escalated) ||
      (filter === "criticos" && item.priority === "Crítica");

    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function renderAssignments() {
  const rows = assignmentFilteredCases();

  setText("#assignmentsSummaryTitle", `${rows.length} casos visibles`);
  setText("#assignmentsSummaryText", `Filtro actual: ${State.assignmentFilter}.`);

  renderKpis("#assignmentsKpiGrid", [
    ["👥", rows.length, "Casos visibles", "Resultado del filtro"],
    ["🧭", rows.filter(c => c.assignmentStatus === "Sin asesor").length, "Sin asesor", "Pendientes de responsable"],
    ["🔁", rows.filter(c => c.blocked).length, "Reasignables", "Bloqueados o sobrecarga"],
    ["🚨", rows.filter(c => c.escalated || c.priority === "Crítica").length, "Escalables", "Riesgo alto"]
  ]);

  setHTML("#assignmentsCaseList", rows.map(c => renderCaseCard(c, "assignment")).join(""));
  setHTML("#assignmentsTableBody", rows.map(c => renderCaseTableRow(c, "assignment")).join(""));

  show($("#assignmentsCaseList"), State.assignmentView === "cards");
  show($("#assignmentsTableWrap"), State.assignmentView === "table");
  show($("#emptyAssignmentsState"), !rows.length);

  bindCaseActions($("#assignmentsCaseList"));
  bindCaseActions($("#assignmentsTableBody"));
}

function openAssignmentCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#assignmentCaseModalIcon", item.icon);
  setText("#assignmentCaseModalTitle", item.id);
  setText("#assignmentCaseModalText", item.description);
  setHTML("#assignmentCaseModalSummary", caseSummary(item));

  openModal("#assignmentCaseModal");
}

function openAssignAdvisorModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#assignAdvisorContext", caseSummary(item));
  openModal("#assignAdvisorModal");
}

function confirmAssignAdvisor() {
  if (
    !getValue("#assignAdvisorSelect") ||
    !getValue("#assignQueueSelect") ||
    !getValue("#assignCriterion") ||
    !getValue("#assignVisibility") ||
    !getValue("#assignComment") ||
    !isChecked("#assignDeclaration")
  ) {
    toast("Faltan datos", "Completa asesor, cola, criterio, visibilidad, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Asignación registrada", "El caso fue asignado correctamente.", "success");
  renderAssignments();
}

function openReassignCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#reassignCaseContext", caseSummary(item));

  if ($("#reassignFromAdvisor")) {
    $("#reassignFromAdvisor").value = item.advisorName || "Sin asignar";
  }

  openModal("#reassignCaseModal");
}

function confirmReassignCase() {
  if (
    !getValue("#reassignToAdvisor") ||
    !getValue("#reassignReason") ||
    !getValue("#reassignPriority") ||
    !getValue("#reassignComment") ||
    !isChecked("#reassignDeclaration")
  ) {
    toast("Faltan datos", "Completa nuevo asesor, motivo, prioridad, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Reasignación registrada", "El caso fue reasignado con trazabilidad.", "success");
  renderAssignments();
}

function openDeriveAreaModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#deriveAreaContext", caseSummary(item));
  openModal("#deriveAreaModal");
}

function confirmDeriveArea() {
  if (
    !getValue("#deriveAreaSelect") ||
    !getValue("#deriveAreaSla") ||
    !getValue("#deriveAreaReason") ||
    !isChecked("#deriveAreaDeclaration")
  ) {
    toast("Faltan datos", "Completa área, SLA interno, motivo y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Derivación registrada", "El caso fue derivado al área responsable.", "success");
}

function openEscalateCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#escalateCaseContext", caseSummary(item));
  openModal("#escalateCaseModal");
}

function confirmEscalateCase() {
  if (
    !getValue("#escalateLevel") ||
    !getValue("#escalateReason") ||
    !getValue("#escalateComment") ||
    !isChecked("#escalateDeclaration")
  ) {
    toast("Faltan datos", "Completa nivel, motivo, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Escalamiento registrado", "El caso fue escalado correctamente.", "success");
}

function confirmMassAssignment() {
  if (
    !getValue("#massAssignmentCriteria") ||
    !getValue("#massAssignmentScope") ||
    !isChecked("#massAssignmentDeclaration")
  ) {
    toast("Faltan datos", "Selecciona criterio, alcance y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Asignación masiva preparada", "Se preparó la distribución para revisión.", "success");
}

/* =========================================================
   CARGA DE ASESORES
========================================================= */

function initAdvisorLoad() {
  renderAdvisorLoadPage();

  $("#advisorLoadSearch")?.addEventListener("input", renderAdvisorLoadPage);

  $$("[data-load-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.advisorLoadFilter = button.dataset.loadFilter;
      $$("[data-load-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAdvisorLoadPage();
    });
  });

  $("#toggleAdvisorLoadViewBtn")?.addEventListener("click", () => {
    State.advisorLoadView = State.advisorLoadView === "cards" ? "table" : "cards";
    $("#toggleAdvisorLoadViewBtn").textContent = State.advisorLoadView === "cards" ? "Vista tabla" : "Vista cards";
    renderAdvisorLoadPage();
  });

  $("#refreshAdvisorLoadPageBtn")?.addEventListener("click", () => {
    renderAdvisorLoadPage();
    toast("Carga actualizada", "Se actualizó la información del equipo.", "success");
  });

  $("#exportAdvisorLoadBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "La carga de asesores fue preparada para exportación.");
  });

  $("#openRedistributeLoadBtn")?.addEventListener("click", () => {
    openRedistributeLoadModal();
  });

  $("#confirmRedistributeLoadBtn")?.addEventListener("click", confirmRedistributeLoad);

  $("#redistributeLoadAiBtn")?.addEventListener("click", () => {
    const from = [...Mock.advisors].sort((a, b) => b.capacity - a.capacity)[0];
    const to = [...Mock.advisors].filter(a => a.status === "Disponible").sort((a, b) => a.capacity - b.capacity)[0];

    if (from) $("#redistributeFromAdvisor").value = from.id;
    if (to) $("#redistributeToAdvisor").value = to.id;

    $("#redistributeCasesCount").value = "2";
    $("#redistributeCriteria").value = "Casos críticos";

    toast("Redistribución sugerida", "Se propuso mover 2 casos críticos desde el asesor con mayor carga.", "success");
  });

  $("#advisorDetailReassignBtn")?.addEventListener("click", () => {
    closeModals();
    openRedistributeLoadModal(State.selectedAdvisorId);
  });

  $("#advisorDetailAvailabilityBtn")?.addEventListener("click", () => {
    closeModals();
    openAdvisorAvailabilityModal(State.selectedAdvisorId);
  });

  $("#advisorDetailAuditBtn")?.addEventListener("click", () => {
    window.location.href = "auditoria-casos.html";
  });

  $("#confirmAdvisorAvailabilityBtn")?.addEventListener("click", confirmAdvisorAvailability);

  $("#refreshLoadMapBtn")?.addEventListener("click", () => {
    renderAdvisorLoadMap();
    toast("Mapa actualizado", "Se actualizó el mapa operativo de carga.", "success");
  });

  renderAi("#advisorLoadAiSummary", [
    ["Mayor carga", "El asesor técnico concentra más casos y riesgo SLA."],
    ["Redistribución", "Mover casos de menor complejidad a asesores disponibles."],
    ["Prevención", "Bloquear nuevas asignaciones a perfiles con ocupación sobre 90%."]
  ]);

  renderChecklist("#advisorLoadActionPlan", [
    ["1", "Identificar sobrecarga", "Revisar asesores con capacidad superior a 85%."],
    ["2", "Mover casos", "Redistribuir casos críticos o de baja complejidad."],
    ["3", "Actualizar disponibilidad", "Bloquear asignaciones si hay ausencia o saturación."]
  ]);
}

function advisorLoadFiltered() {
  const query = getValue("#advisorLoadSearch").toLowerCase();

  return Mock.advisors.filter(item => {
    const text = `${item.name} ${item.specialty} ${item.status} ${item.cases} ${item.critical} ${item.slaRisk}`.toLowerCase();

    const matchesSearch = !query || text.includes(query);

    const filter = State.advisorLoadFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "disponibles" && item.status === "Disponible") ||
      (filter === "sobrecargados" && item.capacity >= 85) ||
      (filter === "criticos" && item.critical > 0) ||
      (filter === "sla_riesgo" && item.slaRisk > 0) ||
      (filter === "no_disponibles" && item.status === "No disponible");

    return matchesSearch && matchesFilter;
  }).sort((a, b) => b.capacity - a.capacity);
}

function renderAdvisorLoadPage() {
  const rows = advisorLoadFiltered();

  const avgCapacity = Math.round(Mock.advisors.reduce((sum, a) => sum + a.capacity, 0) / Mock.advisors.length);

  setText("#advisorLoadSummaryTitle", `${avgCapacity}% ocupación promedio`);
  setText("#advisorLoadSummaryText", `${rows.length} asesores visibles según filtro.`);

  renderKpis("#advisorLoadKpiGrid", [
    ["👥", Mock.advisors.length, "Asesores", "Equipo activo"],
    ["⚖️", `${avgCapacity}%`, "Carga promedio", "Ocupación global"],
    ["🔥", Mock.advisors.reduce((sum, a) => sum + a.critical, 0), "Críticos", "Distribuidos en equipo"],
    ["⏱️", Mock.advisors.reduce((sum, a) => sum + a.slaRisk, 0), "Riesgo SLA", "Casos en monitoreo"]
  ]);

  setHTML("#advisorLoadList", rows.map(a => advisorLoadCard(a)).join(""));
  setHTML("#advisorLoadTableBody", rows.map(a => `
    <tr>
      <td>${esc(a.name)}</td>
      <td>${esc(a.specialty)}</td>
      <td><span class="${pillClass(advisorStatusType(a.status))}">${esc(a.status)}</span></td>
      <td>${esc(a.cases)}</td>
      <td>${esc(a.critical)}</td>
      <td>${esc(a.slaRisk)}</td>
      <td>${esc(a.productivity)}%</td>
      <td>
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(a.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  show($("#advisorLoadList"), State.advisorLoadView === "cards");
  show($("#advisorLoadTableWrap"), State.advisorLoadView === "table");
  show($("#emptyAdvisorLoadPageState"), !rows.length);

  bindAdvisorButtons($("#advisorLoadList"));
  bindAdvisorButtons($("#advisorLoadTableBody"));

  renderAdvisorLoadMap();
}

function advisorLoadCard(a) {
  return `
    <article class="advisor-load-card">
      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(a.initials)}</span>
        <div>
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.specialty)}</p>
        </div>
        <span class="${pillClass(advisorStatusType(a.status))}">${esc(a.status)}</span>
      </div>

      <div class="advisor-load-metrics">
        <div>
          <span>Casos</span>
          <strong>${esc(a.cases)}</strong>
        </div>
        <div>
          <span>Críticos</span>
          <strong>${esc(a.critical)}</strong>
        </div>
        <div>
          <span>SLA</span>
          <strong>${esc(a.slaRisk)}</strong>
        </div>
        <div>
          <span>Carga</span>
          <strong>${esc(a.capacity)}%</strong>
        </div>
      </div>

      <div class="advisor-load-progress">
        <span style="width:${Math.min(a.capacity, 100)}%"></span>
      </div>

      <div class="service-actions">
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(a.id)}">Ver detalle</button>
        <button type="button" data-action="availability-advisor" data-advisor-id="${esc(a.id)}">Disponibilidad</button>
      </div>
    </article>
  `;
}

function renderAdvisorLoadMap() {
  setHTML("#advisorLoadMap", Mock.advisors.map(a => {
    const type = a.capacity >= 90 ? "danger" : a.capacity >= 80 ? "warning" : "success";

    return `
      <article class="load-map-card">
        <div class="load-map-card__top">
          <div>
            <h3>${esc(a.name)}</h3>
            <p>${esc(a.specialty)}</p>
          </div>
          <span class="map-score map-score--${type}">${esc(a.capacity)}%</span>
        </div>

        <p>${esc(a.cases)} casos asignados · ${esc(a.critical)} críticos · ${esc(a.slaRisk)} en riesgo SLA.</p>

        <div class="service-actions">
          <button type="button" data-action="view-advisor" data-advisor-id="${esc(a.id)}">Ver</button>
        </div>
      </article>
    `;
  }).join(""));

  bindAdvisorButtons($("#advisorLoadMap"));
}

function bindAdvisorButtons(root = document) {
  $$("[data-action='view-advisor']", root).forEach(button => {
    button.addEventListener("click", () => openAdvisorDetailModal(button.dataset.advisorId));
  });

  $$("[data-action='availability-advisor']", root).forEach(button => {
    button.addEventListener("click", () => openAdvisorAvailabilityModal(button.dataset.advisorId));
  });
}

function openAdvisorDetailModal(id) {
  const item = getAdvisor(id);
  if (!item) return;

  saveSelectedAdvisor(id);

  setText("#advisorDetailIcon", "👤");
  setText("#advisorDetailTitle", item.name);
  setText("#advisorDetailText", item.specialty);
  setHTML("#advisorDetailSummary", advisorSummary(item));

  openModal("#advisorDetailModal");
}

function openRedistributeLoadModal(advisorId = null) {
  if (advisorId) {
    const advisor = getAdvisor(advisorId);
    if (advisor) {
      setHTML("#redistributeLoadContext", advisorSummary(advisor));
      $("#redistributeFromAdvisor").value = advisor.id;
    }
  } else {
    setHTML("#redistributeLoadContext", summaryHTML([
      ["Origen sugerido", "Asesor con mayor carga"],
      ["Destino sugerido", "Asesor disponible con menor ocupación"],
      ["Criterio", "Balance operativo y SLA"]
    ]));
  }

  openModal("#redistributeLoadModal");
}

function confirmRedistributeLoad() {
  if (
    !getValue("#redistributeFromAdvisor") ||
    !getValue("#redistributeToAdvisor") ||
    !getValue("#redistributeCasesCount") ||
    !getValue("#redistributeCriteria") ||
    !isChecked("#redistributeDeclaration")
  ) {
    toast("Faltan datos", "Completa asesor origen, destino, cantidad, criterio y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Redistribución registrada", "La redistribución fue registrada correctamente.", "success");
}

function openAdvisorAvailabilityModal(id) {
  const item = getAdvisor(id);
  if (!item) return;

  saveSelectedAdvisor(id);

  setHTML("#advisorAvailabilityContext", advisorSummary(item));
  openModal("#advisorAvailabilityModal");
}

function confirmAdvisorAvailability() {
  if (
    !getValue("#advisorAvailabilityStatus") ||
    !getValue("#advisorAvailabilityReason") ||
    !getValue("#advisorAvailabilityComment") ||
    !isChecked("#advisorAvailabilityDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, motivo, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Disponibilidad actualizada", "El estado del asesor fue actualizado.", "success");
}

/* =========================================================
   MONITOREO SLA
========================================================= */

function initSlaMonitor() {
  renderSlaMonitor();

  $("#slaMonitorSearch")?.addEventListener("input", renderSlaMonitor);

  $$("[data-sla-monitor-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.slaFilter = button.dataset.slaMonitorFilter;
      $$("[data-sla-monitor-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderSlaMonitor();
    });
  });

  $("#toggleSlaMonitorViewBtn")?.addEventListener("click", () => {
    State.slaView = State.slaView === "cards" ? "table" : "cards";
    $("#toggleSlaMonitorViewBtn").textContent = State.slaView === "cards" ? "Vista tabla" : "Vista cards";
    renderSlaMonitor();
  });

  $("#refreshSlaMonitorBtn")?.addEventListener("click", () => {
    renderSlaMonitor();
    toast("SLA actualizado", "Se actualizaron las alertas de vencimiento.", "success");
  });

  $("#exportSlaMonitorBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "El monitoreo SLA fue preparado para exportación.");
  });

  $("#sendMassSlaAlertBtn")?.addEventListener("click", () => {
    openSendSlaAlertModal(riskCases()[0]?.id);
  });

  $("#slaCaseReassignBtn")?.addEventListener("click", () => {
    closeModals();
    openReassignCaseModal(State.selectedCaseId);
  });

  $("#slaCaseEscalateBtn")?.addEventListener("click", () => {
    closeModals();
    openEscalateCaseModal(State.selectedCaseId);
  });

  $("#slaCaseAlertBtn")?.addEventListener("click", () => {
    closeModals();
    openSendSlaAlertModal(State.selectedCaseId);
  });

  $("#confirmSendSlaAlertBtn")?.addEventListener("click", confirmSendSlaAlert);

  $("#slaAlertAiBtn")?.addEventListener("click", () => {
    $("#slaAlertTarget").value = "Asesor responsable";
    $("#slaAlertChannel").value = "Notificación interna";
    $("#slaAlertMessage").value =
      "Alerta preventiva: el caso seleccionado presenta riesgo de vencimiento SLA. Se requiere registrar avance, confirmar responsable y definir acción correctiva inmediata.";
    toast("Texto generado", "La IA generó una alerta preventiva.", "success");
  });

  $("#confirmSlaSupervisorFollowBtn")?.addEventListener("click", confirmSlaFollow);

  $("#refreshPriorityMapBtn")?.addEventListener("click", () => {
    renderPriorityMap();
    toast("Mapa actualizado", "Se actualizó el mapa de prioridades.", "success");
  });

  renderAi("#slaMonitorAiSummary", [
    ["Mayor riesgo", "Los casos vencidos y con menos de 8 horas requieren acción inmediata."],
    ["Contención", "Reasignar casos bloqueados y escalar los que ya superaron SLA."],
    ["Seguimiento", "Registrar acción supervisora para dejar trazabilidad preventiva."]
  ]);

  renderChecklist("#slaMonitorActionPlan", [
    ["1", "Atender vencidos", "Escalar casos que ya superaron el plazo."],
    ["2", "Alertar responsables", "Enviar alerta preventiva al asesor o área derivada."],
    ["3", "Registrar seguimiento", "Dejar evidencia de la acción supervisora aplicada."]
  ]);
}

function slaFilteredCases() {
  const query = getValue("#slaMonitorSearch").toLowerCase();

  return Mock.cases.filter(item => {
    const text = `${item.id} ${item.clientName} ${item.advisorName} ${item.priority} ${item.status} ${item.slaText} ${item.slaRisk}`.toLowerCase();

    const matchesSearch = !query || text.includes(query);

    const filter = State.slaFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "vencidos" && item.slaHours < 0) ||
      (filter === "riesgo_alto" && item.slaHours <= 8) ||
      (filter === "vence_hoy" && item.slaGroup === "vence_hoy") ||
      (filter === "bloqueados" && item.blocked) ||
      (filter === "derivados" && item.derived);

    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function renderSlaMonitor() {
  const rows = slaFilteredCases();

  setText("#slaMonitorSummaryTitle", `${riskCases().length} casos en riesgo`);
  setText("#slaMonitorSummaryText", `${rows.length} casos visibles según filtro.`);

  renderKpis("#slaMonitorKpiGrid", [
    ["🚨", Mock.cases.filter(c => c.slaHours < 0).length, "Vencidos", "Superaron SLA"],
    ["🔥", Mock.cases.filter(c => c.slaHours <= 8 && c.slaHours >= 0).length, "Riesgo alto", "Menos de 8 horas"],
    ["📌", Mock.cases.filter(c => c.blocked).length, "Bloqueados", "Requieren intervención"],
    ["🔀", Mock.cases.filter(c => c.derived).length, "Derivados", "Seguimiento a áreas"]
  ]);

  setHTML("#slaMonitorCaseList", rows.map(c => renderCaseCard(c, "sla")).join(""));
  setHTML("#slaMonitorTableBody", rows.map(c => renderCaseTableRow(c, "sla")).join(""));

  show($("#slaMonitorCaseList"), State.slaView === "cards");
  show($("#slaMonitorTableWrap"), State.slaView === "table");
  show($("#emptySlaMonitorState"), !rows.length);

  renderPriorityMap();
  renderSlaByAdvisor();

  bindCaseActions($("#slaMonitorCaseList"));
  bindCaseActions($("#slaMonitorTableBody"));
}

function renderPriorityMap() {
  const groups = [
    {
      title: "Vencidos",
      icon: "🚨",
      score: Mock.cases.filter(c => c.slaHours < 0).length,
      type: "danger",
      text: "Casos que superaron el plazo comprometido."
    },
    {
      title: "Riesgo alto",
      icon: "🔥",
      score: Mock.cases.filter(c => c.slaHours <= 8 && c.slaHours >= 0).length,
      type: "warning",
      text: "Casos con vencimiento cercano y prioridad alta."
    },
    {
      title: "Bloqueados",
      icon: "📌",
      score: Mock.cases.filter(c => c.blocked).length,
      type: "info",
      text: "Casos detenidos por información o decisión pendiente."
    },
    {
      title: "Derivados",
      icon: "🔀",
      score: Mock.cases.filter(c => c.derived).length,
      type: "success",
      text: "Casos enviados a áreas internas para validación."
    }
  ];

  setHTML("#priorityMapGrid", groups.map(item => `
    <article class="priority-map-card">
      <div class="priority-map-card__top">
        <div>
          <h3>${esc(item.icon)} ${esc(item.title)}</h3>
          <p>${esc(item.text)}</p>
        </div>
        <span class="map-score map-score--${item.type}">${esc(item.score)}</span>
      </div>

      <div class="service-actions">
        <button type="button" data-priority-map="${esc(item.title)}">Revisar</button>
      </div>
    </article>
  `).join(""));

  $$("[data-priority-map]").forEach(button => {
    button.addEventListener("click", () => {
      toast("Filtro sugerido", `Revisa el grupo: ${button.dataset.priorityMap}.`, "success");
    });
  });
}

function renderSlaByAdvisor() {
  setHTML("#slaByAdvisorList", Mock.advisors.map(a => `
    <article class="advisor-load-card">
      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(a.initials)}</span>
        <div>
          <h3>${esc(a.name)}</h3>
          <p>${esc(a.specialty)}</p>
        </div>
        <span class="${pillClass(a.slaRisk >= 4 ? "danger" : a.slaRisk >= 2 ? "warning" : "success")}">
          ${esc(a.slaRisk)} riesgos
        </span>
      </div>

      <div class="advisor-load-metrics">
        <div>
          <span>Casos</span>
          <strong>${esc(a.cases)}</strong>
        </div>
        <div>
          <span>Críticos</span>
          <strong>${esc(a.critical)}</strong>
        </div>
        <div>
          <span>SLA</span>
          <strong>${esc(a.slaRisk)}</strong>
        </div>
        <div>
          <span>Carga</span>
          <strong>${esc(a.capacity)}%</strong>
        </div>
      </div>
    </article>
  `).join(""));
}

function openSlaCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#slaCaseDetailIcon", item.icon);
  setText("#slaCaseDetailTitle", item.id);
  setText("#slaCaseDetailText", `${item.title}. ${item.reason}`);
  setHTML("#slaCaseDetailSummary", caseSummary(item));

  openModal("#slaCaseDetailModal");
}

function openSendSlaAlertModal(id) {
  const item = getCase(id || State.selectedCaseId);
  if (item) {
    saveSelectedCase(item.id);
    setHTML("#sendSlaAlertContext", caseSummary(item));
  } else {
    setHTML("#sendSlaAlertContext", summaryHTML([
      ["Alcance", "Casos con riesgo SLA"],
      ["Destino", "Responsables operativos"],
      ["Tipo", "Alerta preventiva"]
    ]));
  }

  openModal("#sendSlaAlertModal");
}

function confirmSendSlaAlert() {
  if (
    !getValue("#slaAlertTarget") ||
    !getValue("#slaAlertChannel") ||
    !getValue("#slaAlertMessage") ||
    !isChecked("#slaAlertDeclaration")
  ) {
    toast("Faltan datos", "Completa destinatario, canal, mensaje y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Alerta enviada", "La alerta SLA fue registrada correctamente.", "success");
}

function openSlaFollowModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  setHTML("#slaSupervisorFollowContext", caseSummary(item));
  openModal("#slaSupervisorFollowModal");
}

function confirmSlaFollow() {
  if (
    !getValue("#slaFollowAction") ||
    !getValue("#slaFollowResult") ||
    !getValue("#slaFollowComment") ||
    !isChecked("#slaFollowDeclaration")
  ) {
    toast("Faltan datos", "Completa acción, resultado, comentario y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Seguimiento registrado", "La acción supervisora fue registrada.", "success");
}

/* =========================================================
   INDICADORES
========================================================= */

function initIndicators() {
  renderIndicators();

  $("#indicatorPeriodFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorAdvisorFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorCaseTypeFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorChannelFilter")?.addEventListener("change", renderIndicators);

  $("#refreshIndicatorsBtn")?.addEventListener("click", () => {
    renderIndicators();
    toast("Indicadores actualizados", "Se recalcularon las métricas operativas.", "success");
  });

  $("#exportIndicatorsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "Los indicadores fueron preparados para exportación.");
  });

  $("#toggleIndicatorViewBtn")?.addEventListener("click", () => {
    State.indicatorCompact = !State.indicatorCompact;
    $("#toggleIndicatorViewBtn").textContent = State.indicatorCompact ? "Vista amplia" : "Vista compacta";
    renderIndicators();
  });

  $("#resetIndicatorFiltersBtn")?.addEventListener("click", () => {
    if ($("#indicatorPeriodFilter")) $("#indicatorPeriodFilter").value = "semana";
    if ($("#indicatorAdvisorFilter")) $("#indicatorAdvisorFilter").value = "todos";
    if ($("#indicatorCaseTypeFilter")) $("#indicatorCaseTypeFilter").value = "todos";
    if ($("#indicatorChannelFilter")) $("#indicatorChannelFilter").value = "todos";
    renderIndicators();
    toast("Filtros limpiados", "Se restauraron los filtros principales.", "success");
  });

  $("#compareIndicatorsBtn")?.addEventListener("click", () => {
    openModal("#compareIndicatorsModal");
  });

  $("#confirmCompareIndicatorsBtn")?.addEventListener("click", confirmCompareIndicators);

  $("#indicatorDetailAiBtn")?.addEventListener("click", () => {
    const indicator = getIndicator(State.selectedIndicatorId);
    askBot(`Analiza indicador ${indicator?.title || ""}`);
  });

  $("#indicatorDetailReportBtn")?.addEventListener("click", () => {
    closeModals();
    window.location.href = "reportes.html";
  });

  renderAi("#indicatorsAiSummary", [
    ["Desviación principal", "El cumplimiento SLA está por debajo de la meta operativa."],
    ["Causa probable", "El riesgo se concentra en incidencias técnicas y casos derivados."],
    ["Acción", "Balancear carga técnica y activar seguimiento preventivo."]
  ]);

  renderChecklist("#indicatorActionPlan", [
    ["1", "Revisar SLA", "Abrir casos que explican la caída del indicador."],
    ["2", "Balancear carga", "Reducir concentración en asesores saturados."],
    ["3", "Auditar cierres", "Revisar casos reabiertos o cierres con baja satisfacción."]
  ]);
}

function renderIndicators() {
  setText("#indicatorsSummaryTitle", "Indicadores actualizados");
  setText("#indicatorsSummaryText", "Vista operativa con filtros aplicados.");

  renderKpis("#indicatorsKpiGrid", [
    ["⏱️", "87%", "Cumplimiento SLA", "Meta 95%"],
    ["✅", "72%", "Tasa de cierre", "Meta 80%"],
    ["⚖️", "78%", "Balance de carga", "Meta 90%"],
    ["⭐", "4.4", "Satisfacción", "Meta 4.6"]
  ]);

  setHTML("#mainIndicatorGrid", Mock.indicators.map(indicatorCard).join(""));
  show($("#emptyIndicatorsState"), !Mock.indicators.length);

  renderIndicatorTrend();
  renderIndicatorPriorityStack();
  renderAdvisorPerformanceTable();

  bindIndicatorButtons($("#mainIndicatorGrid"));
}

function indicatorCard(item) {
  const compactClass = State.indicatorCompact ? " indicator-card--compact" : "";

  return `
    <article class="indicator-card${compactClass}">
      <div class="indicator-card__top">
        <div>
          <h3>${esc(item.title)}</h3>
          <strong>${esc(item.value)}</strong>
        </div>
        <span class="indicator-card__icon">${esc(item.icon)}</span>
      </div>

      <p>${esc(item.description)}</p>

      <div class="indicator-card__bar">
        <span style="width:${Math.min(item.progress, 100)}%"></span>
      </div>

      <div class="indicator-card__footer">
        <span class="${pillClass(indicatorStatusType(item.status))}">
          Meta ${esc(item.target)}
        </span>
        <button type="button" data-indicator-id="${esc(item.id)}">Detalle</button>
      </div>
    </article>
  `;
}

function bindIndicatorButtons(root = document) {
  $$("[data-indicator-id]", root).forEach(button => {
    button.addEventListener("click", () => openIndicatorDetail(button.dataset.indicatorId));
  });
}

function openIndicatorDetail(id) {
  const item = getIndicator(id);
  if (!item) return;

  State.selectedIndicatorId = id;

  setText("#indicatorDetailIcon", item.icon);
  setText("#indicatorDetailTitle", item.title);
  setText("#indicatorDetailText", item.description);

  setHTML("#indicatorDetailSummary", summaryHTML([
    ["Valor actual", item.value],
    ["Meta", item.target],
    ["Variación", item.trend],
    ["Estado", item.status],
    ["Causa probable", item.cause],
    ["Recomendación", "Revisar casos relacionados y aplicar acción correctiva."]
  ]));

  const related = Mock.cases
    .filter(c => c.priority === "Crítica" || c.slaHours <= 8 || c.blocked)
    .slice(0, 3);

  setHTML("#indicatorRelatedCases", related.map(c => renderCaseCard(c, "supervisor")).join(""));

  bindCaseActions($("#indicatorRelatedCases"));

  openModal("#indicatorDetailModal");
}

function renderIndicatorTrend() {
  const data = [
    ["Lun", 18],
    ["Mar", 24],
    ["Mié", 20],
    ["Jue", 29],
    ["Vie", 26]
  ];

  const max = Math.max(...data.map(row => row[1]));

  setHTML("#indicatorTrendChart", data.map(([day, value]) => `
    <div class="bar-chart__row">
      <span>${esc(day)}</span>
      <div>
        <i style="width:${(value / max) * 100}%"></i>
      </div>
      <strong>${esc(value)}</strong>
    </div>
  `).join(""));
}

function renderIndicatorPriorityStack() {
  const data = [
    ["Crítica", Mock.cases.filter(c => c.priority === "Crítica").length],
    ["Alta", Mock.cases.filter(c => c.priority === "Alta").length],
    ["Media", Mock.cases.filter(c => c.priority === "Media").length],
    ["Baja", Mock.cases.filter(c => c.priority === "Baja").length]
  ];

  setHTML("#indicatorPriorityStack", data.map(([label, value]) => `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join(""));
}

function renderAdvisorPerformanceTable() {
  setHTML("#advisorPerformanceTableBody", Mock.advisors.map(a => `
    <tr>
      <td>${esc(a.name)}</td>
      <td>${esc(a.cases)}</td>
      <td>${Math.max(0, a.cases - a.slaRisk)}</td>
      <td>${Math.max(75, 100 - a.slaRisk * 3)}%</td>
      <td>${esc(a.productivity)}%</td>
      <td><span class="${pillClass(advisorStatusType(a.status))}">${esc(a.status)}</span></td>
      <td>
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(a.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  bindAdvisorButtons($("#advisorPerformanceTableBody"));
}

function confirmCompareIndicators() {
  if (
    !getValue("#compareBasePeriod") ||
    !getValue("#compareTargetPeriod") ||
    !isChecked("#compareIndicatorsDeclaration")
  ) {
    toast("Faltan datos", "Selecciona periodo base, comparativo y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Comparación generada", "Se preparó la comparación de indicadores.", "success");
}

/* =========================================================
   REPORTES
========================================================= */

function initReports() {
  renderReports();

  $("#generateReportBtn")?.addEventListener("click", openReportPreview);
  $("#confirmGenerateReportBtn")?.addEventListener("click", openReportPreview);
  $("#previewReportBtn")?.addEventListener("click", openReportPreview);

  $("#reportPreviewGenerateBtn")?.addEventListener("click", () => {
    closeModals();
    toast("Reporte generado", "El reporte fue generado correctamente.", "success");
  });

  $("#reportPreviewExportBtn")?.addEventListener("click", () => {
    closeModals();
    toast("Reporte exportado", "El archivo fue preparado para descarga.", "success");
  });

  $("#scheduleReportBtn")?.addEventListener("click", () => {
    openModal("#scheduleReportModal");
  });

  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);

  $("#resetReportFiltersBtn")?.addEventListener("click", resetReportForm);

  $("#reportAiBtn")?.addEventListener("click", () => {
    $("#reportType").value = "Resumen ejecutivo";
    $("#reportPeriod").value = "Semana actual";
    $("#reportScope").value = "Solo críticos";
    $("#reportFormat").value = "PDF";
    $("#includeCharts").checked = true;
    $("#includeCases").checked = true;
    $("#includeSla").checked = true;
    $("#includeAudit").checked = true;
    $("#reportComment").value =
      "Reporte recomendado para seguimiento ejecutivo de casos críticos, cumplimiento SLA, carga del equipo y trazabilidad relevante.";
    toast("Configuración sugerida", "La IA completó una configuración recomendada.", "success");
  });

  $("#saveReportConfigBtn")?.addEventListener("click", () => {
    toast("Configuración guardada", "La configuración del reporte quedó guardada.", "success");
  });

  $("#refreshRecentReportsBtn")?.addEventListener("click", () => {
    renderRecentReports();
    toast("Reportes actualizados", "Se actualizó el historial de reportes.", "success");
  });

  $("#exportRecentReportsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Lista preparada", "El historial de reportes fue preparado para exportación.");
  });

  renderAi("#reportsAiSummary", [
    ["Reporte recomendado", "Generar resumen ejecutivo con SLA, casos críticos y carga del equipo."],
    ["Frecuencia sugerida", "Programar reporte semanal para revisión de jefatura."],
    ["Contenido clave", "Incluir gráficos, detalle de casos críticos y trazabilidad relevante."]
  ]);
}

function renderReports() {
  setText("#reportsSummaryTitle", `${Mock.reports.length} reportes recientes`);
  setText("#reportsSummaryText", "Reportes generados, programados o disponibles.");

  renderKpis("#reportsKpiGrid", [
    ["📊", Mock.reports.length, "Reportes", "Historial reciente"],
    ["⏱️", "2", "Reportes SLA", "Seguimiento operativo"],
    ["🕵️", "1", "Auditoría", "Trazabilidad incluida"],
    ["📤", "3", "Exportables", "PDF, Excel o CSV"]
  ]);

  setHTML("#frequentReportsList", [
    {
      icon: "📊",
      title: "Resumen ejecutivo",
      text: "Incluye KPIs, SLA, críticos, carga y auditoría.",
      action: "Usar"
    },
    {
      icon: "⏱️",
      title: "Cumplimiento SLA",
      text: "Analiza vencidos, riesgos, responsables y tendencias.",
      action: "Usar"
    },
    {
      icon: "👥",
      title: "Productividad por asesor",
      text: "Compara carga, cierres, SLA y desempeño del equipo.",
      action: "Usar"
    }
  ].map(item => `
    <article class="template-card">
      <div class="template-card__header">
        <span>${item.icon}</span>
        <div>
          <strong>${esc(item.title)}</strong>
          <small>Plantilla frecuente</small>
        </div>
      </div>
      <p>${esc(item.text)}</p>
      <div class="service-actions">
        <button type="button" data-report-template="${esc(item.title)}">${esc(item.action)}</button>
      </div>
    </article>
  `).join(""));

  $$("[data-report-template]").forEach(button => {
    button.addEventListener("click", () => {
      $("#reportType").value =
        button.dataset.reportTemplate === "Cumplimiento SLA"
          ? "Cumplimiento SLA"
          : button.dataset.reportTemplate === "Productividad por asesor"
            ? "Productividad del equipo"
            : "Resumen ejecutivo";

      toast("Plantilla aplicada", `Se aplicó: ${button.dataset.reportTemplate}.`, "success");
    });
  });

  renderRecentReports();
}

function renderRecentReports() {
  setHTML("#recentReportsTableBody", Mock.reports.map(report => `
    <tr>
      <td>${esc(report.name)}</td>
      <td>${esc(report.type)}</td>
      <td>${esc(report.period)}</td>
      <td>${esc(report.format)}</td>
      <td>${esc(report.owner)}</td>
      <td><span class="${pillClass(report.status === "Generado" ? "success" : "info")}">${esc(report.status)}</span></td>
      <td>
        <button type="button" data-report-id="${esc(report.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  $$("[data-report-id]").forEach(button => {
    button.addEventListener("click", () => {
      const report = Mock.reports.find(item => item.id === button.dataset.reportId);
      if (!report) return;

      setText("#reportPreviewTitle", report.name);
      setText("#reportPreviewText", `Reporte ${report.type} correspondiente a ${report.period}.`);
      setHTML("#reportPreviewSummary", summaryHTML([
        ["Tipo", report.type],
        ["Periodo", report.period],
        ["Formato", report.format],
        ["Generado por", report.owner],
        ["Estado", report.status]
      ]));

      renderChecklist("#reportPreviewSections", [
        ["📊", "Indicadores", "KPIs principales y tendencias."],
        ["⏱️", "SLA", "Cumplimiento, vencidos y riesgos."],
        ["👥", "Equipo", "Carga y productividad por asesor."],
        ["🕵️", "Trazabilidad", "Eventos relevantes de auditoría."]
      ]);

      openModal("#reportPreviewModal");
    });
  });
}

function openReportPreview() {
  const type = getValue("#reportType") || "Resumen ejecutivo";
  const period = getValue("#reportPeriod") || "Semana actual";
  const scope = getValue("#reportScope") || "Todos los casos";
  const format = getValue("#reportFormat") || "PDF";

  setText("#reportPreviewTitle", type);
  setText("#reportPreviewText", "Revisa la configuración antes de generar o exportar el reporte.");

  setHTML("#reportPreviewSummary", summaryHTML([
    ["Tipo de reporte", type],
    ["Periodo", period],
    ["Alcance", scope],
    ["Formato", format],
    ["Gráficos", isChecked("#includeCharts") ? "Sí" : "No"],
    ["Detalle de casos", isChecked("#includeCases") ? "Sí" : "No"],
    ["SLA", isChecked("#includeSla") ? "Sí" : "No"],
    ["Auditoría", isChecked("#includeAudit") ? "Sí" : "No"]
  ]));

  renderChecklist("#reportPreviewSections", [
    ["📊", "Resumen ejecutivo", "Indicadores principales del periodo."],
    ["⏱️", "Cumplimiento SLA", "Casos vencidos y próximos a vencer."],
    ["👥", "Productividad", "Carga y desempeño por asesor."],
    ["🕵️", "Trazabilidad", "Acciones relevantes registradas."]
  ]);

  openModal("#reportPreviewModal");
}

function resetReportForm() {
  ["#reportType", "#reportPeriod", "#reportScope", "#reportFormat"].forEach(selector => {
    const el = $(selector);
    if (el) el.value = "";
  });

  ["#includeCharts", "#includeCases", "#includeSla", "#includeAudit"].forEach(selector => {
    const el = $(selector);
    if (el) el.checked = false;
  });

  if ($("#reportComment")) $("#reportComment").value = "";

  toast("Formulario limpio", "Se limpiaron los parámetros del reporte.", "success");
}

function confirmScheduleReport() {
  if (
    !getValue("#scheduleFrequency") ||
    !getValue("#scheduleFormat") ||
    !getValue("#scheduleRecipients") ||
    !isChecked("#scheduleReportDeclaration")
  ) {
    toast("Faltan datos", "Completa frecuencia, formato, destinatarios y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Reporte programado", "El envío recurrente fue configurado correctamente.", "success");
}

/* =========================================================
   AUDITORÍA
========================================================= */

function initAudit() {
  renderAudit();

  $("#auditSearch")?.addEventListener("input", renderAudit);

  $$("[data-audit-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.auditFilter = button.dataset.auditFilter;
      $$("[data-audit-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAudit();
    });
  });

  $("#refreshAuditBtn")?.addEventListener("click", () => {
    renderAudit();
    toast("Auditoría actualizada", "Se actualizaron los eventos registrados.", "success");
  });

  $("#exportAuditBtn")?.addEventListener("click", () => {
    genericModal("📤", "Auditoría preparada", "La trazabilidad fue preparada para exportación.");
  });

  $("#downloadAuditTraceBtn")?.addEventListener("click", () => {
    genericModal("📄", "Trazabilidad preparada", "La trazabilidad de auditoría fue preparada para descarga.");
  });

  $("#compareAuditBtn")?.addEventListener("click", () => {
    openModal("#compareAuditModal");
  });

  $("#auditDetailDownloadBtn")?.addEventListener("click", () => {
    genericModal("📄", "Detalle preparado", "El detalle auditable fue preparado para descarga.");
  });

  $("#auditDetailCompareBtn")?.addEventListener("click", () => {
    closeModals();
    openModal("#compareAuditModal");
  });

  $("#confirmCompareAuditBtn")?.addEventListener("click", confirmCompareAudit);

  renderAi("#auditAiSummary", [
    ["Eventos sensibles", "Revisar cambios de prioridad, reasignaciones y escalamientos."],
    ["Caso crítico", "Los eventos asociados a casos vencidos deben verificarse primero."],
    ["Control", "Confirmar que cada cambio tenga usuario, fecha, antes, después y sustento."]
  ]);

  renderChecklist("#auditActionPlan", [
    ["1", "Filtrar críticos", "Revisar eventos de casos vencidos o escalados."],
    ["2", "Comparar cambios", "Validar antes y después de prioridad o responsable."],
    ["3", "Exportar evidencia", "Descargar trazabilidad para reportes formales."]
  ]);
}

function auditFiltered() {
  const query = getValue("#auditSearch").toLowerCase();

  return Mock.audit.filter(item => {
    const text = `${item.date} ${item.caseId} ${item.type} ${item.action} ${item.user} ${item.before} ${item.after} ${item.detail}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesFilter = State.auditFilter === "todos" || item.type === State.auditFilter;

    return matchesSearch && matchesFilter;
  });
}

function renderAudit() {
  const rows = auditFiltered();

  setText("#auditSummaryTitle", `${rows.length} eventos visibles`);
  setText("#auditSummaryText", `Filtro actual: ${State.auditFilter}.`);

  renderKpis("#auditKpiGrid", [
    ["🕵️", Mock.audit.length, "Eventos", "Total registrado"],
    ["👥", Mock.audit.filter(a => a.type === "asignacion" || a.type === "reasignacion").length, "Movimientos", "Asignación/reasignación"],
    ["🚨", Mock.audit.filter(a => a.type === "escalamiento").length, "Escalamientos", "Casos críticos"],
    ["📌", Mock.audit.filter(a => a.type === "prioridad").length, "Prioridad", "Cambios sensibles"]
  ]);

  setHTML("#auditTableBody", rows.map(item => `
    <tr>
      <td>${esc(item.date)}</td>
      <td>${esc(item.caseId)}</td>
      <td>${esc(item.action)}</td>
      <td>${esc(item.user)}</td>
      <td>${esc(item.before)}</td>
      <td>${esc(item.after)}</td>
      <td>
        <button type="button" data-audit-id="${esc(item.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  show($("#emptyAuditState"), !rows.length);

  $$("[data-audit-id]").forEach(button => {
    button.addEventListener("click", () => openAuditDetail(button.dataset.auditId));
  });
}

function auditIcon(type) {
  const icons = {
    asignacion: "👥",
    reasignacion: "🔁",
    derivacion: "🔀",
    escalamiento: "🚨",
    cierre: "✅",
    prioridad: "📌"
  };

  return icons[type] || "🕵️";
}

function openAuditDetail(id) {
  const item = getAudit(id);
  if (!item) return;

  State.selectedAuditId = id;

  setText("#auditDetailIcon", auditIcon(item.type));
  setText("#auditDetailTitle", `${item.action} · ${item.caseId}`);
  setText("#auditDetailText", item.detail);

  setHTML("#auditDetailSummary", summaryHTML([
    ["Fecha", item.date],
    ["Caso", item.caseId],
    ["Tipo", item.type],
    ["Usuario", item.user],
    ["Antes", item.before],
    ["Después", item.after],
    ["Detalle", item.detail]
  ]));

  openModal("#auditDetailModal");
}

function confirmCompareAudit() {
  if (
    !getValue("#compareAuditCase") ||
    !getValue("#compareAuditType") ||
    !isChecked("#compareAuditDeclaration")
  ) {
    toast("Faltan datos", "Completa código de caso, tipo de comparación y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Comparación preparada", "Se generó la comparación de cambios del caso.", "success");
}

/* =========================================================
   CONFIGURACIÓN
========================================================= */

function initConfig() {
  renderConfig();

  $("#configSearch")?.addEventListener("input", renderConfig);

  $$("[data-config-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.configFilter = button.dataset.configFilter;
      $$("[data-config-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderConfig();
    });
  });

  $("#refreshSupervisorConfigBtn")?.addEventListener("click", () => {
    renderConfig();
    toast("Configuración actualizada", "Se actualizaron las reglas operativas.", "success");
  });

  $("#exportSupervisorConfigBtn")?.addEventListener("click", () => {
    genericModal("📤", "Configuración preparada", "Las reglas de supervisión fueron preparadas para exportación.");
  });

  $("#saveSupervisorConfigBtn")?.addEventListener("click", () => {
    openModal("#confirmConfigSaveModal");
  });

  $("#restoreSupervisorConfigBtn")?.addEventListener("click", () => {
    genericModal("↩", "Valores restaurados", "Se restauraron los valores recomendados de supervisión.");
  });

  $("#confirmSaveSupervisorConfigBtn")?.addEventListener("click", confirmSaveConfig);

  $("#confirmEditConfigRuleBtn")?.addEventListener("click", confirmEditConfigRule);

  $("#configRuleAiBtn")?.addEventListener("click", () => {
    const rule = getConfigRule(State.selectedConfigRuleId);

    if (!rule) return;

    if (rule.category === "sla") $("#configRuleValue").value = "Menos de 6 horas";
    else if (rule.category === "capacidad") $("#configRuleValue").value = "16 casos";
    else $("#configRuleValue").value = rule.value;

    $("#configRuleStatus").value = "Activo";
    $("#configRuleReason").value =
      "La IA sugiere este ajuste para mejorar control preventivo, reducir concentración de carga y anticipar riesgos operativos.";

    toast("Valor sugerido", "Se aplicó una recomendación de IA.", "success");
  });

  $("#editPriorityMatrixBtn")?.addEventListener("click", () => {
    openModal("#priorityMatrixModal");
  });

  $("#priorityMatrixAiBtn")?.addEventListener("click", () => {
    $("#priorityImpactWeight").value = "Alto";
    $("#priorityUrgencyWeight").value = "Alto";
    $("#prioritySlaWeight").value = "Alto";
    $("#priorityClientWeight").value = "Medio";
    toast("Matriz sugerida", "La IA recomienda mayor peso en impacto, urgencia y SLA.", "success");
  });

  $("#confirmPriorityMatrixBtn")?.addEventListener("click", confirmPriorityMatrix);

  $("#simulatePriorityBtn")?.addEventListener("click", () => {
    openModal("#simulatePriorityModal");
  });

  $("#confirmSimulatePriorityBtn")?.addEventListener("click", simulatePriority);

  $("#addRouteRuleBtn")?.addEventListener("click", () => {
    openModal("#routeRuleModal");
  });

  $("#confirmRouteRuleBtn")?.addEventListener("click", confirmRouteRule);

  $("#validateRoutesBtn")?.addEventListener("click", () => {
    toast("Rutas validadas", "Las rutas operativas no presentan inconsistencias críticas.", "success");
  });

  renderAi("#configAiSummary", [
    ["Regla sensible", "Revisar capacidad máxima por asesor para evitar sobrecarga."],
    ["Umbral SLA", "Conviene activar alerta preventiva antes de las 8 horas restantes."],
    ["Escalamiento", "Mantener escalamiento automático para casos vencidos o bloqueados."]
  ]);

  renderChecklist("#configChecklist", [
    ["1", "Validar SLA", "Confirmar que los umbrales no sean demasiado tardíos."],
    ["2", "Revisar carga", "Ajustar capacidad máxima por asesor según complejidad."],
    ["3", "Confirmar rutas", "Verificar que cada condición tenga área destino."]
  ]);
}

function configFiltered() {
  const query = getValue("#configSearch").toLowerCase();

  return Mock.configRules.filter(rule => {
    const text = `${rule.title} ${rule.category} ${rule.value} ${rule.description} ${rule.status}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesFilter = State.configFilter === "todos" || rule.category === State.configFilter;

    return matchesSearch && matchesFilter;
  });
}

function renderConfig() {
  const rows = configFiltered();

  setText("#configSummaryTitle", `${Mock.configRules.length} reglas activas`);
  setText("#configSummaryText", "Parámetros operativos disponibles para supervisión.");

  renderKpis("#configKpiGrid", [
    ["👥", Mock.configRules.filter(r => r.category === "asignacion").length, "Asignación", "Reglas de distribución"],
    ["⏱️", Mock.configRules.filter(r => r.category === "sla").length, "SLA", "Umbrales de control"],
    ["📌", Mock.configRules.filter(r => r.category === "prioridad").length, "Prioridad", "Criterios operativos"],
    ["🚨", Mock.configRules.filter(r => r.category === "escalamiento").length, "Escalamiento", "Rutas críticas"]
  ]);

  setHTML("#configRuleGrid", rows.map(rule => `
    <article class="config-rule-card">
      <div class="config-rule-card__top">
        <div>
          <h3>${esc(rule.icon)} ${esc(rule.title)}</h3>
          <p>${esc(rule.description)}</p>
        </div>
        <span class="${pillClass(rule.status === "Activo" ? "success" : "warning")}">${esc(rule.status)}</span>
      </div>

      <div class="case-meta">
        <span>${esc(rule.category)}</span>
        <span>${esc(rule.value)}</span>
      </div>

      <div class="service-actions">
        <button type="button" data-rule-id="${esc(rule.id)}">Editar</button>
      </div>
    </article>
  `).join(""));

  show($("#emptyConfigState"), !rows.length);

  $$("[data-rule-id]").forEach(button => {
    button.addEventListener("click", () => openConfigRule(button.dataset.ruleId));
  });

  renderPriorityMatrix();
  renderRouteRules();
}

function openConfigRule(id) {
  const rule = getConfigRule(id);
  if (!rule) return;

  State.selectedConfigRuleId = id;

  setText("#editConfigRuleIcon", rule.icon);
  setText("#editConfigRuleTitle", rule.title);
  setText("#editConfigRuleText", rule.description);

  setHTML("#editConfigRuleSummary", summaryHTML([
    ["Categoría", rule.category],
    ["Valor actual", rule.value],
    ["Estado", rule.status],
    ["Descripción", rule.description]
  ]));

  if ($("#configRuleValue")) $("#configRuleValue").value = rule.value;
  if ($("#configRuleStatus")) $("#configRuleStatus").value = rule.status;

  openModal("#editConfigRuleModal");
}

function confirmEditConfigRule() {
  if (
    !getValue("#configRuleValue") ||
    !getValue("#configRuleStatus") ||
    !getValue("#configRuleReason") ||
    !isChecked("#configRuleDeclaration")
  ) {
    toast("Faltan datos", "Completa nuevo valor, estado, sustento y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Regla actualizada", "La regla fue guardada correctamente.", "success");
}

function renderPriorityMatrix() {
  const rows = [
    ["Impacto", "Alto", "Aumenta prioridad si afecta servicio o cliente crítico."],
    ["Urgencia", "Alto", "Aumenta prioridad si requiere acción inmediata."],
    ["SLA", "Alto", "Aumenta prioridad si está próximo a vencer."],
    ["Tipo cliente", "Medio", "Ajusta prioridad para clientes empresa o críticos."]
  ];

  setHTML("#priorityMatrixGrid", rows.map(([title, value, text]) => `
    <article class="priority-matrix-card">
      <div class="priority-matrix-card__top">
        <div>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
        </div>
        <span class="map-score map-score--info">${esc(value)}</span>
      </div>
    </article>
  `).join(""));
}

function confirmPriorityMatrix() {
  if (
    !getValue("#priorityImpactWeight") ||
    !getValue("#priorityUrgencyWeight") ||
    !getValue("#prioritySlaWeight") ||
    !getValue("#priorityClientWeight") ||
    !isChecked("#priorityMatrixDeclaration")
  ) {
    toast("Faltan datos", "Completa todos los pesos y confirma la matriz.", "warning");
    return;
  }

  closeModals();
  toast("Matriz guardada", "Los criterios de prioridad fueron actualizados.", "success");
}

function simulatePriority() {
  if (
    !getValue("#simulateImpact") ||
    !getValue("#simulateUrgency") ||
    !getValue("#simulateSla") ||
    !getValue("#simulateClientType")
  ) {
    toast("Faltan datos", "Completa impacto, urgencia, SLA y tipo de cliente.", "warning");
    return;
  }

  const impact = getValue("#simulateImpact");
  const urgency = getValue("#simulateUrgency");
  const sla = getValue("#simulateSla");
  const client = getValue("#simulateClientType");

  let result = "Media";

  if (
    impact === "Alto" ||
    urgency === "Alta" ||
    sla === "Menos de 4 horas" ||
    client === "Cliente crítico"
  ) {
    result = "Crítica";
  } else if (impact === "Medio" || urgency === "Media") {
    result = "Alta";
  }

  setHTML("#simulatePriorityResult", summaryHTML([
    ["Impacto", impact],
    ["Urgencia", urgency],
    ["SLA restante", sla],
    ["Tipo cliente", client],
    ["Prioridad sugerida", result]
  ]));

  toast("Simulación completada", `Prioridad sugerida: ${result}.`, "success");
}

function renderRouteRules() {
  setHTML("#routeRulesTableBody", Mock.routeRules.map(route => `
    <tr>
      <td>${esc(route.route)}</td>
      <td>${esc(route.condition)}</td>
      <td>${esc(route.area)}</td>
      <td>${esc(route.internalSla)}</td>
      <td>${esc(route.escalation)}</td>
      <td><span class="${pillClass(route.status === "Activo" ? "success" : "warning")}">${esc(route.status)}</span></td>
      <td>
        <button type="button" data-route-id="${esc(route.id)}">Editar</button>
      </td>
    </tr>
  `).join(""));

  $$("[data-route-id]").forEach(button => {
    button.addEventListener("click", () => {
      openModal("#routeRuleModal");
    });
  });
}

function confirmRouteRule() {
  if (
    !getValue("#routeRuleName") ||
    !getValue("#routeRuleCondition") ||
    !getValue("#routeRuleArea") ||
    !getValue("#routeRuleSla") ||
    !isChecked("#routeRuleDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, condición, área, SLA y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Ruta guardada", "La ruta operativa fue guardada correctamente.", "success");
}

function confirmSaveConfig() {
  if (!isChecked("#confirmConfigSaveDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste los cambios.", "warning");
    return;
  }

  closeModals();
  toast("Configuración guardada", "Los parámetros de supervisión fueron actualizados.", "success");
}