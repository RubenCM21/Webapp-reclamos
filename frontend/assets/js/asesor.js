"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ASESOR.JS
   Versión dinámica lista para backend
   ---------------------------------------------------------
   Regla:
   - HTML: estructura + ids + contenedores
   - JS: mock data + render dinámico + acciones
   - Backend futuro: reemplaza Mock por llamadas API
========================================================= */

/* =========================================================
   MOCK DATA TEMPORAL
   Cuando conectes backend, reemplazas este objeto por fetch/API.
========================================================= */

let Mock = {
  advisor: {
    id: 0,
    name: "Cargando...",
    initials: "…",
    role: "Asesor de Atención",
    status: "Disponible",
    shift: "Turno operativo",
    lastAccess: "—"
  },
  cases:         [],
  templates:     [],
  notifications: [],
  performance: {
    kpis:  [],
    chart: [],
    table: []
  }
};

/* ── Cargador de datos ───────────────────────────────────────────────────── */

async function _cargarDatosAsesor() {
  try {
    document.body.classList.add("loading-data");

    const [rendResp, bandResp, plantResp, notifResp] = await Promise.allSettled([
      Api.Asesor.rendimiento(),
      Api.Asesor.bandeja({ limit: 50 }),
      Api.Asesor.plantillas(),
      Api.Asesor.notificaciones({ limit: 30 }),
    ]);

    // advisor + performance
    if (rendResp.status === "fulfilled" && rendResp.value) {
      const r = rendResp.value;
      if (r.advisor)     Mock.advisor     = r.advisor;
      if (r.performance) Mock.performance = r.performance;
    }

    // cases
    if (bandResp.status === "fulfilled" && bandResp.value) {
      Mock.cases = bandResp.value.casos || bandResp.value || [];
    }

    // templates
    if (plantResp.status === "fulfilled" && plantResp.value) {
      Mock.templates = plantResp.value.plantillas || plantResp.value || [];
    }

    // notifications
    if (notifResp.status === "fulfilled" && notifResp.value) {
      Mock.notifications = notifResp.value.notificaciones || notifResp.value || [];
    }

  } catch (err) {
    console.error("[Asesor] Error cargando datos:", err);
  } finally {
    document.body.classList.remove("loading-data");
  }
}

/* =========================================================
   STATE
========================================================= */

const State = {
  page: document.body.dataset.page || "",
  theme: localStorage.getItem("claro360-asesor-theme") || "light",
  selectedCaseId: null,
  selectedTemplateId: null,
  selectedNotificationId: null,
  queueFilter: "todos",
  inboxFilter: "todos",
  slaFilter: "todos",
  templateFilter: "todos",
  notificationFilter: "todas",
  queueView: "cards",
  performancePeriod: "semana"
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

function getCase(id) {
  return Mock.cases.find(c => c.id === id) || null;
}

function getTemplate(id) {
  return Mock.templates.find(t => t.id === id) || null;
}

function getNotification(id) {
  return Mock.notifications.find(n => n.id === id) || null;
}

function statusType(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("cierre") || value.includes("cerrado")) return "success";
  if (value.includes("pendiente")) return "warning";
  if (value.includes("crítico") || value.includes("critico")) return "danger";
  if (value.includes("derivado")) return "purple";
  return "info";
}

function priorityType(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.includes("crítica") || value.includes("critica")) return "danger";
  if (value.includes("alta")) return "warning";
  if (value.includes("media")) return "info";
  return "success";
}

function pillClass(type) {
  return `status-pill status-pill--${type || "info"}`;
}

function slaRisk(c) {
  return Number(c.slaHours) <= 8;
}

function saveSelectedCase(id) {
  State.selectedCaseId = id;
  localStorage.setItem("claro360-selected-case", id);
}

function goToDetail(id) {
  saveSelectedCase(id);
  window.location.href = `detalle-atencion.html?id=${encodeURIComponent(id)}`;
}

function getCaseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || localStorage.getItem("claro360-selected-case") || Mock.cases[0]?.id;
}

function show(el, condition) {
  if (!el) return;
  el.classList.toggle("hidden", !condition);
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

  // Cargar datos reales
  await _cargarDatosAsesor();

  // Inicializar UI igual que el original
  setupBaseUI();
  setupGlobalEvents();
  setupBot();
  setupSearch();
  updateGlobalBadges();

  if (State.page === "asesor-dashboard")            initDashboard();
  if (State.page === "asesor-bandeja")              initBandeja();
  if (State.page === "asesor-detalle-atencion")     initDetalleAtencion();
  if (State.page === "asesor-cola-trabajo")         initColaTrabajo();
  if (State.page === "asesor-calendario-sla")       initCalendarioSla();
  if (State.page === "asesor-plantillas-respuesta") initPlantillas();
  if (State.page === "asesor-notificaciones")       initNotificaciones();
  if (State.page === "asesor-rendimiento")          initRendimiento();
});


/* =========================================================
   BASE UI
========================================================= */

function setupBaseUI() {
  setText("#userNameTop", Mock.advisor.name);
  setText("#userRoleTop", Mock.advisor.role);
  setText("#userAvatar", Mock.advisor.initials);

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
    toast("Tema actualizado", `Se activó el modo ${State.theme === "dark" ? "oscuro" : "claro"}.`, "success");
  });

  $("#userMenuButton")?.addEventListener("click", e => {
    e.stopPropagation();
    $("#userMenuDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    $("#userMenuDropdown")?.classList.remove("open");
  });

  $("#logoutBtn")?.addEventListener("click", logout);
  $("#logoutDropdownBtn")?.addEventListener("click", logout);
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-asesor-theme", theme);
}

function logout() {
  Api.Session.logout();
}

function updateGlobalBadges() {
  setText("#sidebarAssignedCount", Mock.cases.length);
  const unread = Mock.notifications.filter(n => n.unread).length;
  setText("#sidebarNotificationCount", unread);
  setText("#notificationBadge", unread);
}

/* =========================================================
   GLOBAL EVENTS / MODALS
========================================================= */

function setupGlobalEvents() {
  document.addEventListener("click", e => {
    const closeBtn = e.target.closest("[data-close-modal]");
    if (closeBtn) closeModals();

    const modalBtn = e.target.closest("[data-open-modal]");
    if (modalBtn) {
      e.preventDefault();
      openModal(`#${modalBtn.dataset.openModal}`);
    }
  });

  $("#modalBackdrop")?.addEventListener("click", closeModals);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
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
  $$(".modal").forEach(m => {
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
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

function summaryHTML(items) {
  return items.map(([label, value]) => `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
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

  const q = getValue("#globalSearchInput").toLowerCase();

  const pages = [
    ["📊", "Dashboard", "Resumen operativo del asesor.", "dashboard.html"],
    ["📥", "Bandeja", "Casos asignados y filtros.", "bandeja.html"],
    ["🗂️", "Cola de trabajo", "Kanban operativo.", "cola-trabajo.html"],
    ["⏱️", "Calendario SLA", "Vencimientos y alertas.", "calendario-sla.html"],
    ["💬", "Plantillas", "Respuestas predefinidas.", "plantillas-respuesta.html"],
    ["🔔", "Notificaciones", "Alertas operativas.", "notificaciones.html"],
    ["📈", "Rendimiento", "Indicadores del asesor.", "rendimiento.html"]
  ].map(([icon, title, text, href]) => ({ icon, title, text, href, key: `${title} ${text}` }));

  const cases = Mock.cases.map(c => ({
    icon: c.icon,
    title: c.id,
    text: `${c.title} · ${c.clientName}`,
    href: `detalle-atencion.html?id=${encodeURIComponent(c.id)}`,
    key: `${c.id} ${c.title} ${c.clientName} ${c.service} ${c.priority} ${c.status}`
  }));

  const items = [...pages, ...cases].filter(i => !q || i.key.toLowerCase().includes(q));

  box.innerHTML = items.length
    ? items.map(i => `
      <a href="${i.href}" class="search-result-item">
        <span>${i.icon}</span>
        <div>
          <strong>${esc(i.title)}</strong>
          <small>${esc(i.text)}</small>
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
  $("#attentionOpenBotBtn")?.addEventListener("click", openBot);

  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const prompt = getValue("#botInput");
    if (!prompt) return;
    $("#botInput").value = "";
    askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach(btn => {
    btn.addEventListener("click", () => askBot(btn.dataset.botPrompt));
  });

  const aiButtons = [
    ["analyzeAdvisorWorkBtn", "Analiza mi carga"],
    ["analyzeQueueBtn", "Prioriza mi bandeja"],
    ["attentionAiBtn", "Resume este caso"],
    ["queueAnalyzeBtn", "Ordena mi cola de trabajo"],
    ["slaAnalyzeBtn", "Analiza vencimientos SLA"],
    ["templateAnalyzeBtn", "Analiza plantillas"],
    ["analyzeAdvisorNotificationsBtn", "Prioriza mis alertas"],
    ["performanceInsightBtn", "Analiza mi rendimiento"],
    ["performanceAnalyzeBtn", "Analiza mi rendimiento"],
    ["slaPrioritizeBtn", "Prioriza SLA"],
    ["notificationsPrioritizeBtn", "Qué alerta atiendo primero"],
    ["templateAiBtn", "Genera plantilla para pedir evidencia"]
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

  const msg = document.createElement("div");
  msg.className = `message message--${who}`;
  msg.textContent = text;

  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function botAnswer(prompt) {
  const p = String(prompt || "").toLowerCase();
  const risk = Mock.cases.filter(slaRisk).sort((a, b) => a.slaHours - b.slaHours);
  const closeable = Mock.cases.filter(c => c.status === "Listo para cierre");
  const pending = Mock.cases.filter(c => c.status === "Pendiente por cliente");

  if (p.includes("sla") || p.includes("vence") || p.includes("riesgo")) {
    return risk.length
      ? `El primer caso en riesgo es ${risk[0].id}: ${risk[0].title}. Tiene ${risk[0].slaText}. Recomendación: abrir detalle y registrar avance inmediato.`
      : "No hay casos en riesgo SLA crítico en este momento.";
  }

  if (p.includes("bandeja") || p.includes("prioriza") || p.includes("cola")) {
    return "Orden recomendado: primero casos críticos con SLA corto, luego pendientes por cliente, después derivados y finalmente listos para cierre.";
  }

  if (p.includes("cerrar") || p.includes("cierre")) {
    return closeable.length
      ? `Puedes revisar ${closeable[0].id}. Antes de cerrar valida evidencia, respuesta final y trazabilidad.`
      : "No hay casos listos para cierre en este momento.";
  }

  if (p.includes("evidencia") || p.includes("cliente")) {
    return pending.length
      ? `El caso ${pending[0].id} está pendiente por cliente. Solicita evidencia clara: captura, fecha, servicio afectado y prueba técnica.`
      : "No hay casos pendientes por cliente ahora.";
  }

  if (p.includes("rendimiento")) {
    return "Tu rendimiento simulado muestra buen cumplimiento SLA. La oportunidad principal es reducir bloqueos por cliente usando solicitudes más específicas.";
  }

  if (p.includes("plantilla") || p.includes("redacta")) {
    return "Una buena plantilla debe indicar qué falta, por qué se necesita, plazo de respuesta y canal de envío. Evita mensajes genéricos.";
  }

  return "Puedo ayudarte a priorizar casos, revisar SLA, redactar respuestas, validar cierres o interpretar indicadores.";
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

function caseCard(c) {
  return `
    <article class="case-card">
      <span class="case-card__icon">${c.icon}</span>

      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description)}</p>

        <div class="case-meta">
          <span>${esc(c.id)}</span>
          <span>${esc(c.clientName)}</span>
          <span>${esc(c.type)}</span>
          <span>${esc(c.service)}</span>
          <span>${esc(c.priority)}</span>
          <span>${esc(c.slaText)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="${pillClass(statusType(c.status))}">${esc(c.status)}</span>
        <button type="button" data-action="view-case" data-case-id="${esc(c.id)}">Ver</button>
      </div>
    </article>
  `;
}

function bindCaseActions(root = document) {
  $$("[data-action='view-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openCasePreview(btn.dataset.caseId));
  });

  $$("[data-action='open-detail']", root).forEach(btn => {
    btn.addEventListener("click", () => goToDetail(btn.dataset.caseId));
  });

  $$("[data-action='update-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openQueueUpdate(btn.dataset.caseId));
  });

  $$("[data-action='request-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openQueueRequest(btn.dataset.caseId));
  });

  $$("[data-action='derive-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openQueueDerive(btn.dataset.caseId));
  });

  $$("[data-action='move-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openMoveCase(btn.dataset.caseId));
  });

  $$("[data-action='close-case']", root).forEach(btn => {
    btn.addEventListener("click", () => openWorkQueueClose(btn.dataset.caseId));
  });
}

function openCasePreview(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);

  setText("#caseModalIcon", c.icon);
  setText("#caseModalTitle", c.id);
  setText("#caseModalText", c.description);
  setHTML("#caseModalSummary", caseSummary(c));

  $("#caseModalOpenDetailBtn")?.addEventListener("click", () => goToDetail(c.id), { once: true });
  $("#caseModalUpdateBtn")?.addEventListener("click", () => {
    closeModals();
    openQueueUpdate(c.id);
  }, { once: true });

  openModal("#caseModal");
}

function caseSummary(c) {
  return summaryHTML([
    ["Cliente", c.clientName],
    ["Tipo", c.type],
    ["Servicio", c.service],
    ["Prioridad", c.priority],
    ["Estado", c.status],
    ["SLA", c.slaText],
    ["Acción sugerida", c.action]
  ]);
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
  setHTML(selector, rows.map(a => `
    <article class="activity-item">
      <span class="activity-icon">${a.icon}</span>
      <div class="activity-content">
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.text)}</p>
        <small>${esc(a.date)}</small>
      </div>
    </article>
  `).join(""));
}

/* =========================================================
   DASHBOARD
========================================================= */

function initDashboard() {
  setText("#dashboardHeroEyebrow", Mock.advisor.shift);
  setText("#dashboardHeroTitle", `Hola, ${Mock.advisor.name}`);
  setText("#advisorStatus", Mock.advisor.status);
  setText("#advisorLastAccess", Mock.advisor.lastAccess);

  renderKpis("#advisorKpiGrid", [
    ["📥", Mock.cases.length, "Casos asignados", "Carga actual"],
    ["🔥", Mock.cases.filter(c => c.priority === "Crítica").length, "Críticos", "Atención inmediata"],
    ["⏱️", Mock.cases.filter(slaRisk).length, "Riesgo SLA", "Vencimiento cercano"],
    ["✅", Mock.cases.filter(c => c.status === "Listo para cierre").length, "Listos cierre", "Validación final"]
  ]);

  renderPriorityCases();
  renderDashboardActivity();
  renderDashboardSla();
  renderDashboardQueue();

  renderAi("#advisorAiSummary", [
    ["Prioridad principal", "Atiende primero los casos críticos con menor tiempo SLA."],
    ["Bloqueos", "Los casos pendientes por cliente deben tener solicitud clara y plazo visible."],
    ["Cierre rápido", "Los listos para cierre pueden liberar carga si ya tienen evidencia y respuesta final."]
  ]);

  $("#refreshPriorityBtn")?.addEventListener("click", () => {
    renderPriorityCases();
    toast("Casos actualizados", "La lista de prioridad fue actualizada.", "success");
  });

  $("#sortPriorityBtn")?.addEventListener("click", () => {
    renderPriorityCases();
    toast("Orden IA aplicado", "Se ordenaron los casos por criticidad y SLA.", "success");
  });

  $("#refreshActivityBtn")?.addEventListener("click", () => {
    renderDashboardActivity();
    toast("Actividad actualizada", "Se refrescaron los últimos movimientos.", "success");
  });

  $("#refreshSlaBtn")?.addEventListener("click", () => {
    renderDashboardSla();
    toast("SLA actualizado", "Se recalcularon las alertas de vencimiento.", "success");
  });
}

function renderPriorityCases() {
  const items = [...Mock.cases]
    .sort((a, b) => a.slaHours - b.slaHours)
    .slice(0, 4);

  setHTML("#priorityCasesList", items.map(caseCard).join(""));
  show($("#emptyPriorityState"), !items.length);
  bindCaseActions($("#priorityCasesList"));
}

function renderDashboardActivity() {
  const rows = Mock.cases.flatMap(c => c.history.map(h => ({
    ...h,
    title: `${h.title} · ${c.id}`
  }))).slice(0, 5);

  renderActivity("#advisorActivityTimeline", rows);
  show($("#emptyActivityState"), !rows.length);
}

function renderDashboardSla() {
  const rows = Mock.cases
    .filter(slaRisk)
    .sort((a, b) => a.slaHours - b.slaHours);

  setHTML("#advisorSlaList", rows.map(c => `
    <article class="sla-item">
      <span class="activity-icon">⏱️</span>
      <div>
        <strong>${esc(c.id)} · ${esc(c.priority)}</strong>
        <p>${esc(c.title)} · ${esc(c.slaText)}</p>
        <div class="sla-meter"><span style="width:${Math.max(10, 100 - c.slaHours * 8)}%"></span></div>
      </div>
      <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
    </article>
  `).join(""));

  show($("#emptySlaState"), !rows.length);
  bindCaseActions($("#advisorSlaList"));
}

function renderDashboardQueue() {
  const groups = ["Nuevo", "En atención", "Pendiente cliente", "Derivado", "Listo para cierre"];
  setHTML("#queueBoard", groups.map(group => {
    const rows = Mock.cases.filter(c => c.queueStatus === group);
    return `
      <article class="queue-column">
        <div class="queue-column__header">
          <h3>${esc(group)}</h3>
          <span class="${pillClass("info")}">${rows.length}</span>
        </div>

        ${rows.map(c => `
          <div class="queue-mini-card">
            <strong>${esc(c.id)}</strong>
            <p>${esc(c.title)}</p>
            <div class="case-meta">
              <span>${esc(c.priority)}</span>
              <span>${esc(c.slaText)}</span>
            </div>
            <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
          </div>
        `).join("") || `<p class="muted">Sin casos.</p>`}
      </article>
    `;
  }).join(""));

  show($("#emptyQueueBoardState"), !Mock.cases.length);
  bindCaseActions($("#queueBoard"));
}

/* =========================================================
   BANDEJA
========================================================= */

function initBandeja() {
  renderInbox();

  $("#advisorQueueSearch")?.addEventListener("input", renderInbox);

  $$("[data-advisor-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.inboxFilter = btn.dataset.advisorFilter;
      $$("[data-advisor-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderInbox();
    });
  });

  $("#refreshQueueBtn")?.addEventListener("click", () => {
    renderInbox();
    toast("Bandeja actualizada", "Se refrescaron los casos asignados.", "success");
  });

  $("#exportQueueBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "Cuando exista backend, se exportará la bandeja en Excel o CSV.");
  });

  $("#toggleQueueViewBtn")?.addEventListener("click", () => {
    State.queueView = State.queueView === "cards" ? "table" : "cards";
    $("#toggleQueueViewBtn").textContent = State.queueView === "cards" ? "Vista tabla" : "Vista cards";
    renderInbox();
  });

  $("#prioritizeQueueBtn")?.addEventListener("click", () => {
    toast("Priorización aplicada", "La bandeja se ordenó por SLA y prioridad.", "success");
    askBot("Prioriza mi bandeja");
  });

  $("#confirmQueueUpdateBtn")?.addEventListener("click", confirmQueueUpdate);
  $("#queueUpdateAiBtn")?.addEventListener("click", () => {
    $("#queueUpdateDetail").value = "Se revisó la información disponible, se validó el estado del caso y se registra avance para mantener trazabilidad operativa.";
    toast("Texto generado", "Se mejoró la redacción de actualización.", "success");
  });

  $("#confirmQueueRequestBtn")?.addEventListener("click", confirmQueueRequest);
  $("#queueRequestAiBtn")?.addEventListener("click", () => {
    $("#queueRequestSubject").value = "Solicitud de información adicional";
    $("#queueRequestMessage").value = "Estimado cliente, para continuar con la atención de su caso necesitamos que nos envíe evidencia adicional relacionada con el servicio reportado. Esta información permitirá continuar la revisión dentro del plazo indicado.";
    toast("Mensaje generado", "Se generó texto de solicitud.", "success");
  });

  $("#confirmQueueDeriveBtn")?.addEventListener("click", confirmQueueDerive);
}

function inboxFilteredCases() {
  const q = getValue("#advisorQueueSearch").toLowerCase();

  return Mock.cases.filter(c => {
    const text = `${c.id} ${c.title} ${c.clientName} ${c.service} ${c.priority} ${c.status}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);

    const f = State.inboxFilter;
    const matchesFilter =
      f === "todos" ||
      (f === "critica" && c.priority === "Crítica") ||
      (f === "alta" && c.priority === "Alta") ||
      (f === "pendiente_cliente" && c.status === "Pendiente por cliente") ||
      (f === "sla_riesgo" && slaRisk(c)) ||
      (f === "listo_cierre" && c.status === "Listo para cierre");

    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function renderInbox() {
  const rows = inboxFilteredCases();

  setText("#queueSummaryStatus", `${rows.length} casos visibles`);
  setText("#queueSummaryText", `Filtro actual: ${State.inboxFilter}`);

  renderKpis("#inboxKpiGrid", [
    ["📥", rows.length, "Casos visibles", "Resultado del filtro"],
    ["🔥", rows.filter(c => c.priority === "Crítica").length, "Críticos", "Atención inmediata"],
    ["⏱️", rows.filter(slaRisk).length, "Riesgo SLA", "Vencimiento cercano"],
    ["✅", rows.filter(c => c.status === "Listo para cierre").length, "Listos cierre", "Validación final"]
  ]);

  setHTML("#advisorQueueList", rows.map(c => `
    <article class="case-card">
      <span class="case-card__icon">${c.icon}</span>
      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description)}</p>
        <div class="case-meta">
          <span>${esc(c.id)}</span>
          <span>${esc(c.clientName)}</span>
          <span>${esc(c.type)}</span>
          <span>${esc(c.service)}</span>
          <span>${esc(c.priority)}</span>
          <span>${esc(c.slaText)}</span>
        </div>
      </div>
      <div class="case-actions">
        <span class="${pillClass(statusType(c.status))}">${esc(c.status)}</span>
        <button type="button" data-action="open-detail" data-case-id="${esc(c.id)}">Ver</button>
        <button type="button" data-action="update-case" data-case-id="${esc(c.id)}">Actualizar</button>
        <button type="button" data-action="request-case" data-case-id="${esc(c.id)}">Solicitar</button>
        <button type="button" data-action="derive-case" data-case-id="${esc(c.id)}">Derivar</button>
      </div>
    </article>
  `).join(""));

  setHTML("#advisorQueueTableBody", rows.map(c => `
    <tr>
      <td>${esc(c.id)}</td>
      <td>${esc(c.clientName)}</td>
      <td>${esc(c.type)}</td>
      <td>${esc(c.service)}</td>
      <td>${esc(c.priority)}</td>
      <td><span class="${pillClass(statusType(c.status))}">${esc(c.status)}</span></td>
      <td>${esc(c.slaText)}</td>
      <td>
        <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
      </td>
    </tr>
  `).join(""));

  show($("#advisorQueueList"), State.queueView === "cards");
  show($("#advisorQueueTableWrap"), State.queueView === "table");
  show($("#emptyAdvisorQueueState"), !rows.length);

  renderAi("#queueAiSummary", [
    ["Primero", "Atiende casos críticos o con menor SLA disponible."],
    ["Bloqueos", "Solicita información cuando el caso esté pendiente por cliente."],
    ["Cierre", "Valida casos listos para cierre si tienen evidencia suficiente."]
  ]);

  renderChecklist("#inboxSuggestedActions", [
    ["1", "Abrir primer SLA", "Revisar el caso con menor tiempo restante."],
    ["2", "Solicitar evidencia", "Desbloquear pendientes por cliente."],
    ["3", "Cerrar casos listos", "Reducir carga operativa sin perder trazabilidad."]
  ]);

  bindCaseActions($("#advisorQueueList"));
  bindCaseActions($("#advisorQueueTableBody"));
}

function openQueueUpdate(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);
  setHTML("#queueUpdateContext", caseSummary(c));
  openModal("#queueUpdateModal");
}

function confirmQueueUpdate() {
  if (!State.selectedCaseId) return;
  if (!getValue("#queueUpdateStatus") || !getValue("#queueUpdateVisibility") || !getValue("#queueUpdateSummary") || !getValue("#queueUpdateDetail") || !isChecked("#queueUpdateDeclaration")) {
    toast("Faltan datos", "Completa estado, visibilidad, resumen, detalle y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Actualización registrada", "El caso fue actualizado en el frontend simulado.", "success");
}

function openQueueRequest(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);
  setHTML("#queueRequestContext", caseSummary(c));
  openModal("#queueRequestModal");
}

function confirmQueueRequest() {
  if (!getValue("#queueRequestChannel") || !getValue("#queueRequestDeadline") || !getValue("#queueRequestSubject") || !getValue("#queueRequestMessage") || !isChecked("#queueRequestDeclaration")) {
    toast("Faltan datos", "Completa canal, plazo, asunto, mensaje y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Solicitud enviada", "La solicitud fue registrada y enviada de forma simulada.", "success");
}

function openQueueDerive(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);
  setHTML("#queueDeriveContext", caseSummary(c));
  openModal("#queueDeriveModal");
}

function confirmQueueDerive() {
  if (!getValue("#queueDeriveArea") || !getValue("#queueDerivePriority") || !getValue("#queueDeriveReason")) {
    toast("Faltan datos", "Completa área, prioridad y motivo.", "warning");
    return;
  }

  closeModals();
  toast("Caso derivado", "La derivación fue registrada de forma simulada.", "success");
}

/* =========================================================
   DETALLE ATENCIÓN
========================================================= */

function initDetalleAtencion() {
  const id = getCaseIdFromUrl();
  saveSelectedCase(id);
  renderCaseDetail(id);

  $("#openUpdateCaseModal")?.addEventListener("click", () => openDetailUpdate());
  $("#quickOpenUpdateBtn")?.addEventListener("click", () => openDetailUpdate());

  $("#openRequestInfoModal")?.addEventListener("click", () => openDetailRequest());
  $("#quickOpenRequestBtn")?.addEventListener("click", () => openDetailRequest());

  $("#quickOpenDeriveBtn")?.addEventListener("click", () => openDetailDerive());
  $("#quickOpenCloseBtn")?.addEventListener("click", () => openDetailClose());

  $("#detailDownloadBtn")?.addEventListener("click", () => genericModal("📄", "Constancia preparada", "La constancia se generará desde backend con los datos reales del caso."));
  $("#detailShareBtn")?.addEventListener("click", () => genericModal("🔗", "Enlace preparado", "Se generó una referencia simulada para compartir el caso."));
  $("#attentionEvidenceHelpBtn")?.addEventListener("click", () => genericModal("📎", "Guía de evidencias", "Valida fecha, servicio, captura, documento sustentatorio y relación directa con el caso."));

  $("#refreshAttentionHistoryBtn")?.addEventListener("click", () => {
    renderCaseDetail(State.selectedCaseId);
    toast("Historial actualizado", "Se refrescó la línea de tiempo del caso.", "success");
  });

  $("#refreshDetailSlaBtn")?.addEventListener("click", () => {
    renderCaseDetail(State.selectedCaseId);
    toast("SLA actualizado", "Se actualizó la alerta SLA del caso.", "success");
  });

  $("#confirmQuickUpdateBtn")?.addEventListener("click", confirmDetailUpdate);
  $("#updateImproveTextBtn")?.addEventListener("click", () => {
    $("#quickUpdateDetail").value = "Se revisó la información registrada por el cliente, se validó la evidencia disponible y se deja constancia del avance realizado. Como siguiente paso, corresponde continuar con la validación y comunicar el resultado según la visibilidad seleccionada.";
    toast("Texto mejorado", "La IA generó una redacción base.", "success");
  });

  $("#confirmQuickRequestBtn")?.addEventListener("click", confirmDetailRequest);
  $("#requestGenerateTextBtn")?.addEventListener("click", () => {
    $("#quickRequestSubject").value = "Solicitud de información adicional para continuar la atención";
    $("#quickRequestMessage").value = "Estimado cliente, para continuar con la atención de su caso necesitamos que nos envíe evidencia adicional relacionada con el servicio reportado. Esta información permitirá continuar la revisión dentro del plazo indicado.";
    toast("Mensaje generado", "Se generó un mensaje base.", "success");
  });

  $("#confirmDeriveBtn")?.addEventListener("click", confirmDetailDerive);
  $("#confirmCloseCaseBtn")?.addEventListener("click", confirmDetailClose);
  $("#closeCaseAiBtn")?.addEventListener("click", () => toast("Validación IA", "La IA recomienda cerrar solo si hay evidencia, respuesta final y trazabilidad completa.", "success"));
}

function renderCaseDetail(id) {
  const c = getCase(id);

  if (!c) {
    show($("#emptyCaseInfoState"), true);
    return;
  }

  setText("#caseTypeLabel", c.type);
  setText("#caseTitle", c.title);
  setText("#caseDescription", c.description);
  setText("#caseReasonText", c.reason);
  setText("#caseStatusBadge", c.status);
  $("#caseStatusBadge").className = pillClass(statusType(c.status));

  setHTML("#caseMeta", `
    <span>${esc(c.id)}</span>
    <span>${esc(c.clientName)}</span>
    <span>${esc(c.service)}</span>
    <span>${esc(c.priority)}</span>
    <span>${esc(c.slaText)}</span>
  `);

  setHTML("#customerInfoGrid", [
    ["👤", "Cliente", c.clientName],
    ["🪪", "Documento", c.document],
    ["📡", "Servicio", c.service],
    ["📬", "Canal", c.channel],
    ["⏱️", "SLA", c.slaText],
    ["📌", "Acción sugerida", c.action]
  ].map(([icon, title, text]) => `
    <article class="info-item">
      <span class="info-icon">${icon}</span>
      <div>
        <strong>${esc(title)}</strong>
        <p>${esc(text)}</p>
      </div>
    </article>
  `).join(""));

  setHTML("#attentionEvidenceList", c.evidence.map(e => `
    <article class="evidence-item">
      <span class="evidence-icon">${e.icon}</span>
      <div>
        <strong>${esc(e.name)}</strong>
        <p>${esc(e.detail)}</p>
      </div>
      <button type="button" class="panel-action" onclick="void(0)">Ver</button>
    </article>
  `).join(""));

  show($("#emptyEvidenceState"), !c.evidence.length);

  renderChecklist("#attentionChecklist", [
    ["✅", "Cliente identificado", "Datos básicos y servicio asociado validados."],
    ["📎", "Evidencia revisada", c.evidence.length ? "Existen archivos disponibles para análisis." : "Falta evidencia para continuar."],
    ["⏱️", "SLA monitoreado", `Tiempo restante: ${c.slaText}.`],
    ["💬", "Respuesta clara", "Debe indicar acción realizada y siguiente paso."]
  ]);

  renderActivity("#attentionHistoryTimeline", c.history);
  show($("#emptyHistoryState"), !c.history.length);

  renderAi("#attentionAiSummary", [
    ["Resumen", c.description],
    ["Siguiente paso", c.action],
    ["Riesgo", slaRisk(c) ? "Caso con vencimiento cercano. Priorizar atención." : "Caso sin riesgo crítico inmediato."]
  ]);

  setHTML("#detailSlaList", `
    <article class="sla-item">
      <span class="activity-icon">⏱️</span>
      <div>
        <strong>${esc(c.slaText)} · ${esc(c.priority)}</strong>
        <p>${esc(c.status)} · ${esc(c.action)}</p>
        <div class="sla-meter"><span style="width:${Math.max(10, 100 - c.slaHours * 5)}%"></span></div>
      </div>
    </article>
  `);
}

function openDetailUpdate() {
  const c = getCase(State.selectedCaseId);
  if (!c) return;
  setHTML("#updateCaseContext", caseSummary(c));
  openModal("#updateAttentionModal");
}

function openDetailRequest() {
  const c = getCase(State.selectedCaseId);
  if (!c) return;
  setHTML("#requestCaseContext", caseSummary(c));
  openModal("#requestInfoModal");
}

function openDetailDerive() {
  const c = getCase(State.selectedCaseId);
  if (!c) return;
  setHTML("#deriveCaseContext", caseSummary(c));
  openModal("#deriveCaseModal");
}

function openDetailClose() {
  const c = getCase(State.selectedCaseId);
  if (!c) return;
  setHTML("#closeCaseContext", caseSummary(c));
  openModal("#closeCaseModal");
}

function confirmDetailUpdate() {
  if (!getValue("#quickUpdateStatus") || !getValue("#quickUpdateVisibility") || !getValue("#quickUpdateSummary") || !getValue("#quickUpdateDetail") || !isChecked("#quickUpdateDeclaration")) {
    toast("Faltan datos", "Completa estado, visibilidad, resumen, detalle y confirmación.", "warning");
    return;
  }
  closeModals();
  toast("Actualización registrada", "El avance fue registrado correctamente.", "success");
}

function confirmDetailRequest() {
  if (!getValue("#quickRequestChannel") || !getValue("#quickRequestDeadline") || !getValue("#quickRequestSubject") || !getValue("#quickRequestMessage") || !isChecked("#quickRequestDeclaration")) {
    toast("Faltan datos", "Completa canal, plazo, asunto, mensaje y confirmación.", "warning");
    return;
  }
  closeModals();
  toast("Solicitud enviada", "La solicitud fue registrada correctamente.", "success");
}

function confirmDetailDerive() {
  if (!getValue("#deriveArea") || !getValue("#derivePriority") || !getValue("#deriveReason")) {
    toast("Faltan datos", "Completa área, prioridad y motivo.", "warning");
    return;
  }
  closeModals();
  toast("Caso derivado", "La derivación fue registrada correctamente.", "success");
}

function confirmDetailClose() {
  if (!getValue("#closeCaseResponse") || !isChecked("#closeCaseDeclaration")) {
    toast("Validación pendiente", "Ingresa respuesta final y confirma la declaración.", "warning");
    return;
  }
  closeModals();
  toast("Caso cerrado", "El cierre fue registrado correctamente.", "success");
}

/* =========================================================
   COLA TRABAJO
========================================================= */

function initColaTrabajo() {
  renderWorkQueue();

  $("#workQueueSearch")?.addEventListener("input", renderWorkQueue);

  $$("[data-queue-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.queueFilter = btn.dataset.queueFilter;
      $$("[data-queue-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderWorkQueue();
    });
  });

  $("#queueSmartOrderBtn")?.addEventListener("click", () => {
    toast("Cola ordenada", "Se priorizó por SLA y criticidad.", "success");
    askBot("Ordena mi cola de trabajo");
  });

  $("#queueBalanceBtn")?.addEventListener("click", () => toast("Balance simulado", "La carga fue balanceada de forma simulada.", "success"));
  $("#queueRefreshBtn")?.addEventListener("click", () => {
    renderWorkQueue();
    toast("Cola actualizada", "Se refrescó la cola de trabajo.", "success");
  });
  $("#queueExportBtn")?.addEventListener("click", () => genericModal("📤", "Exportación preparada", "El tablero se exportará cuando exista backend."));

  $("#queueOpenDetailBtn")?.addEventListener("click", () => goToDetail(State.selectedCaseId));
  $("#queueMoveCaseBtn")?.addEventListener("click", () => {
    closeModals();
    openMoveCase(State.selectedCaseId);
  });

  $("#confirmMoveCaseBtn")?.addEventListener("click", confirmMoveCase);
  $("#confirmWorkQueueRequestBtn")?.addEventListener("click", confirmWorkQueueRequest);
  $("#workQueueGenerateRequestBtn")?.addEventListener("click", () => {
    $("#workQueueRequestMessage").value = "Estimado cliente, necesitamos información adicional para continuar con la atención del caso. Por favor adjunte evidencia relacionada con el servicio reportado dentro del plazo indicado.";
    toast("Texto generado", "Se generó mensaje de solicitud.", "success");
  });
  $("#confirmWorkQueueCloseBtn")?.addEventListener("click", confirmWorkQueueClose);
  $("#queueCloseAiBtn")?.addEventListener("click", () => toast("Validación IA", "Verifica evidencia, respuesta final y trazabilidad antes del cierre.", "success"));
}

function workQueueFilteredCases() {
  const q = getValue("#workQueueSearch").toLowerCase();

  return Mock.cases.filter(c => {
    const text = `${c.id} ${c.title} ${c.clientName} ${c.service} ${c.priority} ${c.status} ${c.queueStatus}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);

    const f = State.queueFilter;
    const matchesFilter =
      f === "todos" ||
      (f === "critica" && c.priority === "Crítica") ||
      (f === "sla_riesgo" && slaRisk(c)) ||
      (f === "pendiente_cliente" && c.queueStatus === "Pendiente cliente") ||
      (f === "listo_cierre" && c.queueStatus === "Listo para cierre");

    return matchesSearch && matchesFilter;
  });
}

function renderWorkQueue() {
  const rows = workQueueFilteredCases();

  renderKpis("#workQueueKpiGrid", [
    ["📥", rows.length, "Casos en cola", "Carga visible"],
    ["🔥", rows.filter(c => c.priority === "Crítica").length, "Críticos", "Prioridad inmediata"],
    ["⏱️", rows.filter(slaRisk).length, "Riesgo SLA", "Vencimiento cercano"],
    ["✅", rows.filter(c => c.queueStatus === "Listo para cierre").length, "Listos cierre", "Validación final"]
  ]);

  setText("#workQueueSummaryTitle", `${rows.length} casos visibles`);
  setText("#workQueueSummaryText", `Filtro actual: ${State.queueFilter}`);

  const groups = ["Nuevo", "En atención", "Pendiente cliente", "Derivado", "Listo para cierre"];

  setHTML("#workQueueBoard", groups.map(group => {
    const groupCases = rows.filter(c => c.queueStatus === group);

    return `
      <article class="queue-column">
        <div class="queue-column__header">
          <h3>${esc(group)}</h3>
          <span class="${pillClass("info")}">${groupCases.length}</span>
        </div>

        ${groupCases.map(c => `
          <div class="queue-mini-card">
            <strong>${esc(c.id)}</strong>
            <p>${esc(c.title)}</p>
            <div class="case-meta">
              <span>${esc(c.priority)}</span>
              <span>${esc(c.slaText)}</span>
            </div>
            <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Detalle</button>
            <button type="button" class="panel-action" data-action="move-case" data-case-id="${esc(c.id)}">Mover</button>
            ${group === "Pendiente cliente" ? `<button type="button" class="panel-action" data-action="request-case" data-case-id="${esc(c.id)}">Solicitar</button>` : ""}
            ${group === "Listo para cierre" ? `<button type="button" class="panel-action" data-action="close-case" data-case-id="${esc(c.id)}">Cerrar</button>` : ""}
          </div>
        `).join("") || `<p class="muted">Sin casos.</p>`}
      </article>
    `;
  }).join(""));

  renderAi("#workQueueAiSummary", [
    ["Atender primero", "Casos críticos con SLA menor a 8 horas."],
    ["Evitar bloqueo", "Pendientes por cliente deben tener solicitud clara."],
    ["Liberar carga", "Cerrar casos listos con evidencia suficiente."]
  ]);

  show($("#emptyWorkQueueState"), !rows.length);
  bindCaseActions($("#workQueueBoard"));
}

function openMoveCase(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);
  setHTML("#moveCaseContext", caseSummary(c));
  openModal("#moveCaseModal");
}

function confirmMoveCase() {
  if (!getValue("#moveCaseStatus") || !getValue("#moveCaseVisibility") || !getValue("#moveCaseReason") || !isChecked("#moveCaseDeclaration")) {
    toast("Faltan datos", "Completa estado, visibilidad, motivo y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Estado actualizado", "El movimiento fue registrado de forma simulada.", "success");
}

function openWorkQueueClose(id) {
  const c = getCase(id);
  if (!c) return;

  saveSelectedCase(id);
  setHTML("#workQueueCloseContext", caseSummary(c));
  openModal("#queueCloseModal");
}

function confirmWorkQueueClose() {
  if (!getValue("#workQueueCloseResponse") || !isChecked("#workQueueCloseDeclaration")) {
    toast("Validación pendiente", "Ingresa respuesta final y confirma la declaración.", "warning");
    return;
  }

  closeModals();
  toast("Caso cerrado", "El cierre fue registrado de forma simulada.", "success");
}

function confirmWorkQueueRequest() {
  if (!getValue("#workQueueRequestChannel") || !getValue("#workQueueRequestDeadline") || !getValue("#workQueueRequestMessage") || !isChecked("#workQueueRequestDeclaration")) {
    toast("Faltan datos", "Completa canal, plazo, mensaje y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Solicitud enviada", "La solicitud fue registrada de forma simulada.", "success");
}

/* =========================================================
   CALENDARIO SLA
========================================================= */

function initCalendarioSla() {
  renderSlaCalendar();

  $("#slaSearchInput")?.addEventListener("input", renderSlaCalendar);

  $$("[data-sla-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.slaFilter = btn.dataset.slaFilter;
      $$("[data-sla-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSlaCalendar();
    });
  });

  $("#slaRefreshBtn")?.addEventListener("click", () => {
    renderSlaCalendar();
    toast("Calendario actualizado", "Se refrescaron vencimientos SLA.", "success");
  });

  $("#slaTodayBtn")?.addEventListener("click", () => {
    State.slaFilter = "hoy";
    renderSlaCalendar();
    toast("Vista de hoy", "Se muestran vencimientos del día.", "success");
  });

  $("#slaWeekBtn")?.addEventListener("click", () => {
    State.slaFilter = "todos";
    renderSlaCalendar();
    toast("Vista semanal", "Se muestran vencimientos de la semana.", "success");
  });

  $("#slaExportBtn")?.addEventListener("click", () => genericModal("📤", "Exportación preparada", "El calendario SLA se exportará con backend."));

  $("#confirmSlaReminderBtn")?.addEventListener("click", confirmSlaReminder);
  $("#improveSlaReminderBtn")?.addEventListener("click", () => {
    $("#slaReminderMessage").value = "Estimado cliente, le recordamos que necesitamos la información solicitada para continuar con la atención de su caso dentro del plazo establecido.";
    toast("Texto mejorado", "Se generó recordatorio con IA.", "success");
  });
  $("#confirmSlaFollowBtn")?.addEventListener("click", confirmSlaFollow);
}

function slaFilteredCases() {
  const q = getValue("#slaSearchInput").toLowerCase();

  return Mock.cases.filter(c => {
    const text = `${c.id} ${c.title} ${c.clientName} ${c.priority} ${c.status} ${c.slaText}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);

    const f = State.slaFilter;
    const matchesFilter =
      f === "todos" ||
      (f === "critico" && slaRisk(c)) ||
      (f === "hoy" && c.slaGroup === "hoy") ||
      (f === "pendiente_cliente" && c.status === "Pendiente por cliente") ||
      (f === "listo_cierre" && c.status === "Listo para cierre");

    return matchesSearch && matchesFilter;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function renderSlaCalendar() {
  const rows = slaFilteredCases();

  renderKpis("#slaKpiGrid", [
    ["🔥", rows.filter(slaRisk).length, "SLA críticos", "Menos de 8 horas"],
    ["⏱️", rows.filter(c => c.slaGroup === "hoy").length, "Vence hoy", "Monitoreo inmediato"],
    ["📩", rows.filter(c => c.status === "Pendiente por cliente").length, "Pendiente cliente", "Puede bloquear avance"],
    ["✅", rows.filter(c => c.status === "Listo para cierre").length, "Listos cierre", "Validación final"]
  ]);

  setText("#slaSummaryTitle", `${rows.filter(slaRisk).length} casos en riesgo`);
  setText("#slaSummaryText", `${rows.length} vencimientos visibles según filtro.`);

  const groups = [
    ["hoy", "Hoy", "Vencimientos críticos"],
    ["mañana", "Mañana", "Casos programados"],
    ["semana", "Esta semana", "Seguimientos preventivos"]
  ];

  setHTML("#slaCalendarGrid", groups.map(([key, title, subtitle]) => {
    const items = rows.filter(c => c.slaGroup === key);
    return `
      <article class="sla-day-card ${key === "hoy" ? "sla-day-card--critical" : ""}">
        <div class="sla-day-card__header">
          <div>
            <span class="eyebrow">${esc(title)}</span>
            <h3>${esc(subtitle)}</h3>
          </div>
          <span class="${pillClass(key === "hoy" ? "danger" : "info")}">${items.length} casos</span>
        </div>

        <div class="sla-list">
          ${items.map(c => `
            <article class="sla-item">
              <span class="activity-icon">⏱️</span>
              <div>
                <strong>${esc(c.id)} · ${esc(c.title)}</strong>
                <p>${esc(c.clientName)} · ${esc(c.priority)} · ${esc(c.slaText)}</p>
                <div class="sla-meter"><span style="width:${Math.max(10, 100 - c.slaHours * 5)}%"></span></div>
              </div>
              <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
              <button type="button" class="panel-action" data-action="sla-reminder" data-case-id="${esc(c.id)}">Recordar</button>
            </article>
          `).join("") || `<p class="muted">Sin casos en este periodo.</p>`}
        </div>
      </article>
    `;
  }).join(""));

  renderAi("#slaAiSummary", [
    ["Atención inmediata", "Prioriza los casos con menos horas restantes."],
    ["Prevención", "Envía recordatorios a clientes pendientes antes del vencimiento."],
    ["Seguimiento", "Registra avance en casos derivados para mantener trazabilidad."]
  ]);

  renderChecklist("#slaActionPlan", [
    ["1", "Resolver críticos", "Abrir casos con vencimiento menor a 8 horas."],
    ["2", "Enviar recordatorios", "Notificar a clientes con información pendiente."],
    ["3", "Registrar seguimiento", "Actualizar derivados antes de vencimiento."]
  ]);

  show($("#emptySlaCalendarState"), !rows.length);

  bindCaseActions($("#slaCalendarGrid"));

  $$("[data-action='sla-reminder']").forEach(btn => {
    btn.addEventListener("click", () => openSlaReminder(btn.dataset.caseId));
  });
}

function openSlaReminder(id) {
  const c = getCase(id);
  if (!c) return;
  saveSelectedCase(id);
  setHTML("#slaReminderContext", caseSummary(c));
  openModal("#slaReminderModal");
}

function confirmSlaReminder() {
  if (!getValue("#slaReminderChannel") || !getValue("#slaReminderDeadline") || !getValue("#slaReminderMessage") || !isChecked("#slaReminderDeclaration")) {
    toast("Faltan datos", "Completa canal, plazo, mensaje y confirmación.", "warning");
    return;
  }
  closeModals();
  toast("Recordatorio enviado", "El recordatorio fue registrado de forma simulada.", "success");
}

function confirmSlaFollow() {
  if (!getValue("#slaFollowText") || !isChecked("#slaFollowDeclaration")) {
    toast("Faltan datos", "Completa el seguimiento y confirma la declaración.", "warning");
    return;
  }
  closeModals();
  toast("Seguimiento registrado", "El seguimiento SLA fue registrado.", "success");
}

/* =========================================================
   PLANTILLAS
========================================================= */

function initPlantillas() {
  renderTemplates();

  $("#templateSearchInput")?.addEventListener("input", renderTemplates);

  $$("[data-template-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.templateFilter = btn.dataset.templateFilter;
      $$("[data-template-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderTemplates();
    });
  });

  $("#newTemplateBtn")?.addEventListener("click", () => openModal("#newTemplateModal"));
  $("#manageVariablesBtn")?.addEventListener("click", openVariablesModal);
  $("#refreshTemplatesBtn")?.addEventListener("click", () => {
    renderTemplates();
    toast("Plantillas actualizadas", "Se refrescó el catálogo.", "success");
  });
  $("#templateExportBtn")?.addEventListener("click", () => genericModal("📤", "Exportación preparada", "El catálogo se exportará con backend."));

  $("#previewUseTemplateBtn")?.addEventListener("click", () => {
    closeModals();
    openUseTemplate(State.selectedTemplateId);
  });
  $("#improveTemplateBtn")?.addEventListener("click", () => toast("Plantilla mejorada", "La IA mejoró el tono de la plantilla.", "success"));
  $("#sendTemplateBtn")?.addEventListener("click", sendTemplate);
  $("#templateToneBtn")?.addEventListener("click", () => toast("Tono mejorado", "Se ajustó la redacción del mensaje.", "success"));
  $("#saveTemplateBtn")?.addEventListener("click", saveNewTemplate);
  $("#generateNewTemplateBtn")?.addEventListener("click", () => {
    $("#newTemplateBody").value = "Estimado/a {cliente_nombre}, para continuar con la atención del caso {codigo_caso}, necesitamos información adicional relacionada con {servicio_afectado}. Agradecemos enviarla dentro del plazo indicado.";
    toast("Plantilla generada", "Se generó una plantilla base con IA.", "success");
  });
}

function templateFiltered() {
  const q = getValue("#templateSearchInput").toLowerCase();
  return Mock.templates.filter(t => {
    const text = `${t.title} ${t.category} ${t.channel} ${t.description}`.toLowerCase();
    const matchSearch = !q || text.includes(q);
    const matchFilter = State.templateFilter === "todos" || t.category === State.templateFilter;
    return matchSearch && matchFilter;
  });
}

function renderTemplates() {
  const rows = templateFiltered();

  renderKpis("#templateKpiGrid", [
    ["📩", Mock.templates.filter(t => t.category === "evidencia").length, "Evidencia", "Solicitudes"],
    ["📝", Mock.templates.filter(t => t.category === "reclamo").length, "Reclamo", "Respuestas"],
    ["🔀", Mock.templates.filter(t => t.category === "derivacion").length, "Derivación", "Áreas"],
    ["✅", Mock.templates.filter(t => t.category === "cierre").length, "Cierre", "Finalización"]
  ]);

  setText("#templateSummaryTitle", `${rows.length} plantillas visibles`);
  setText("#templateSummaryText", `Filtro actual: ${State.templateFilter}`);

  setHTML("#templateGrid", rows.map(t => `
    <article class="template-card">
      <div class="template-card__header">
        <span>${t.icon}</span>
        <div>
          <strong>${esc(t.title)}</strong>
          <small>${esc(t.channel)}</small>
        </div>
      </div>

      <p>${esc(t.description)}</p>

      <div class="case-meta">
        <span>${esc(t.category)}</span>
        <span>${esc(t.id)}</span>
      </div>

      <div class="service-actions">
        <button type="button" data-template-preview="${esc(t.id)}">Previsualizar</button>
        <button type="button" data-template-use="${esc(t.id)}">Usar</button>
      </div>
    </article>
  `).join(""));

  renderAi("#templatesAiSummary", [
    ["Tono recomendado", "Usa mensajes claros, neutrales y orientados a acción."],
    ["Evita ambigüedad", "Indica qué falta, por qué se requiere y plazo."],
    ["Cierre correcto", "Incluye resultado, sustento y canal de seguimiento."]
  ]);

  renderChecklist("#templateVariablesList", [
    ["{ }", "{cliente_nombre}", "Inserta automáticamente el nombre del cliente."],
    ["{ }", "{codigo_caso}", "Incluye el código del reclamo o incidencia."],
    ["{ }", "{servicio_afectado}", "Muestra el servicio relacionado con la atención."],
    ["{ }", "{fecha_limite}", "Agrega el plazo máximo de respuesta del caso."]
  ]);

  show($("#emptyTemplateState"), !rows.length);

  $$("[data-template-preview]").forEach(btn => {
    btn.addEventListener("click", () => openPreviewTemplate(btn.dataset.templatePreview));
  });

  $$("[data-template-use]").forEach(btn => {
    btn.addEventListener("click", () => openUseTemplate(btn.dataset.templateUse));
  });
}

function openPreviewTemplate(id) {
  const t = getTemplate(id);
  if (!t) return;

  State.selectedTemplateId = id;
  setText("#previewTemplateIcon", t.icon);
  setText("#previewTemplateTitle", t.title);
  setText("#previewTemplateDescription", t.description);
  setHTML("#previewTemplateSummary", summaryHTML([
    ["Canal sugerido", t.channel],
    ["Categoría", t.category],
    ["Mensaje", t.body]
  ]));
  openModal("#previewTemplateModal");
}

function openUseTemplate(id) {
  const t = getTemplate(id);
  if (!t) return;

  State.selectedTemplateId = id;
  setHTML("#useTemplateContext", summaryHTML([
    ["Plantilla", t.title],
    ["Categoría", t.category],
    ["Canal sugerido", t.channel]
  ]));
  $("#templateMessage").value = t.body;
  openModal("#useTemplateModal");
}

function sendTemplate() {
  if (!getValue("#templateCaseCode") || !getValue("#templateChannel") || !getValue("#templateMessage") || !isChecked("#templateDeclaration")) {
    toast("Faltan datos", "Completa código, canal, mensaje y confirmación.", "warning");
    return;
  }
  closeModals();
  toast("Mensaje enviado", "La plantilla fue aplicada al caso de forma simulada.", "success");
}

function saveNewTemplate() {
  if (!getValue("#newTemplateName") || !getValue("#newTemplateCategory") || !getValue("#newTemplateBody") || !isChecked("#newTemplateDeclaration")) {
    toast("Faltan datos", "Completa nombre, categoría, contenido y confirmación.", "warning");
    return;
  }
  closeModals();
  toast("Plantilla guardada", "La plantilla fue guardada de forma simulada.", "success");
}

function openVariablesModal() {
  setHTML("#variablesModalSummary", summaryHTML([
    ["{cliente_nombre}", "Nombre del cliente."],
    ["{codigo_caso}", "Código único del caso."],
    ["{servicio_afectado}", "Servicio asociado."],
    ["{fecha_limite}", "Plazo máximo de respuesta."],
    ["{asesor_nombre}", "Nombre del asesor responsable."]
  ]));
  openModal("#variablesModal");
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

function initNotificaciones() {
  renderNotifications();

  $("#advisorNotificationSearch")?.addEventListener("input", renderNotifications);

  $$("[data-advisor-notification-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.notificationFilter = btn.dataset.advisorNotificationFilter;
      $$("[data-advisor-notification-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderNotifications();
    });
  });

  $("#refreshAdvisorNotificationsBtn")?.addEventListener("click", () => {
    renderNotifications();
    toast("Notificaciones actualizadas", "Se refrescaron las alertas.", "success");
  });

  $("#markAllAdvisorNotificationsBtn")?.addEventListener("click", () => {
    Mock.notifications.forEach(n => n.unread = false);
    renderNotifications();
    updateGlobalBadges();
    toast("Notificaciones leídas", "Todas las alertas fueron marcadas como leídas.", "success");
  });

  $("#clearAdvisorReadBtn")?.addEventListener("click", () => openModal("#clearNotificationsModal"));

  $("#confirmClearReadNotificationsBtn")?.addEventListener("click", () => {
    Mock.notifications = Mock.notifications.filter(n => n.unread);
    closeModals();
    renderNotifications();
    updateGlobalBadges();
    toast("Leídas limpiadas", "Se ocultaron las notificaciones leídas.", "success");
  });

  $("#notificationOpenCaseBtn")?.addEventListener("click", () => {
    const n = getNotification(State.selectedNotificationId);
    if (n?.caseId) goToDetail(n.caseId);
  });

  $("#notificationMarkReadBtn")?.addEventListener("click", () => {
    const n = getNotification(State.selectedNotificationId);
    if (n) n.unread = false;
    closeModals();
    renderNotifications();
    updateGlobalBadges();
    toast("Notificación leída", "La alerta fue marcada como leída.", "success");
  });
}

function notificationFiltered() {
  const q = getValue("#advisorNotificationSearch").toLowerCase();

  return Mock.notifications.filter(n => {
    const text = `${n.title} ${n.text} ${n.caseId} ${n.type} ${n.priority}`.toLowerCase();
    const matchSearch = !q || text.includes(q);
    const f = State.notificationFilter;
    const matchFilter =
      f === "todas" ||
      (f === "critica" && n.priority === "critica") ||
      (f === "sla" && n.type === "sla") ||
      (f === "cliente" && n.type === "cliente") ||
      (f === "asignacion" && n.type === "asignacion") ||
      (f === "no_leidas" && n.unread);
    return matchSearch && matchFilter;
  });
}

function renderNotifications() {
  const rows = notificationFiltered();

  renderKpis("#notificationsKpiGrid", [
    ["🔥", Mock.notifications.filter(n => n.priority === "critica").length, "Críticas", "SLA o urgencia"],
    ["📥", Mock.notifications.filter(n => n.type === "asignacion").length, "Asignaciones", "Nuevos casos"],
    ["📩", Mock.notifications.filter(n => n.type === "cliente").length, "Cliente", "Respuestas recibidas"],
    ["🔔", Mock.notifications.filter(n => n.unread).length, "No leídas", "Pendientes"]
  ]);

  setText("#notificationsSummaryTitle", `${Mock.notifications.filter(n => n.unread).length} alertas pendientes`);
  setText("#notificationsSummaryText", `${rows.length} visibles según filtro.`);

  setHTML("#advisorNotificationList", rows.map(n => `
    <article class="notification-full-item ${n.unread ? "is-unread" : ""}">
      <span class="notification-item__icon">${n.icon}</span>
      <div>
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.text)}</p>
        <div class="case-meta">
          <span>${esc(n.type)}</span>
          <span>${esc(n.priority)}</span>
          <span>${esc(n.caseId)}</span>
          <span>${esc(n.date)}</span>
          <span>${n.unread ? "No leída" : "Leída"}</span>
        </div>
      </div>
      <button type="button" data-notification-id="${esc(n.id)}">Ver</button>
    </article>
  `).join(""));

  renderAi("#advisorNotificationsAiSummary", [
    ["Atención inmediata", "Revisa primero alertas críticas y SLA."],
    ["Cliente respondió", "Desbloquea casos pendientes revisando evidencia."],
    ["Cierre posible", "Valida casos listos para cierre."]
  ]);

  renderChecklist("#advisorNotificationActionPlan", [
    ["1", "Abrir alerta crítica", "Atender vencimientos cercanos."],
    ["2", "Validar evidencia", "Revisar respuestas de cliente."],
    ["3", "Cerrar pendientes", "Liberar casos listos para cierre."]
  ]);

  show($("#emptyAdvisorNotificationState"), !rows.length);

  $$("[data-notification-id]").forEach(btn => {
    btn.addEventListener("click", () => openNotification(btn.dataset.notificationId));
  });
}

function openNotification(id) {
  const n = getNotification(id);
  if (!n) return;

  State.selectedNotificationId = id;
  setText("#notificationModalIcon", n.icon);
  setText("#notificationModalTitle", n.title);
  setText("#notificationModalText", n.text);
  setHTML("#notificationModalSummary", summaryHTML([
    ["Caso", n.caseId],
    ["Tipo", n.type],
    ["Prioridad", n.priority],
    ["Fecha", n.date],
    ["Estado", n.unread ? "No leída" : "Leída"]
  ]));
  openModal("#advisorNotificationModal");
}

/* =========================================================
   RENDIMIENTO
========================================================= */

function initRendimiento() {
  renderPerformance();

  $("#performanceWeekBtn")?.addEventListener("click", () => {
    State.performancePeriod = "semana";
    renderPerformance();
    toast("Vista semanal", "Se activó el periodo semanal.", "success");
  });

  $("#performanceMonthBtn")?.addEventListener("click", () => {
    State.performancePeriod = "mes";
    renderPerformance();
    toast("Vista mensual", "Se activó el periodo mensual.", "success");
  });

  $("#performanceExportBtn")?.addEventListener("click", openPerformanceReport);
  $("#performanceDownloadBtn")?.addEventListener("click", openPerformanceReport);
}

function renderPerformance() {
  renderKpis("#performanceKpiGrid", Mock.performance.kpis);

  setText("#performanceSummaryTitle", "Rendimiento estable");
  setText("#performanceSummaryText", `Periodo actual: ${State.performancePeriod}.`);
  setText("#performanceTrendBadge", "Tendencia positiva");

  const max = Math.max(...Mock.performance.chart.map(x => x[1]));

  setHTML("#performanceChart", Mock.performance.chart.map(([day, value]) => `
    <div class="bar-chart__row">
      <span>${esc(day)}</span>
      <div><i style="width:${(value / max) * 100}%"></i></div>
      <strong>${esc(value)}</strong>
    </div>
  `).join(""));

  setHTML("#performanceSlaDonut", `
    <div class="donut-metric__ring">
      <span>92%</span>
    </div>
    <p>La mayoría de casos se atienden dentro del plazo operativo definido.</p>
  `);

  const priorities = [
    ["Crítica", Mock.cases.filter(c => c.priority === "Crítica").length],
    ["Alta", Mock.cases.filter(c => c.priority === "Alta").length],
    ["Media", Mock.cases.filter(c => c.priority === "Media").length],
    ["Baja", Mock.cases.filter(c => c.priority === "Baja").length]
  ];

  setHTML("#performancePriorityStack", priorities.map(([label, value]) => `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join(""));

  setHTML("#performanceTableBody", Mock.performance.table.map(row => `
    <tr>
      <td>${esc(row[0])}</td>
      <td>${esc(row[1])}</td>
      <td>${esc(row[2])}</td>
      <td>${esc(row[3])}</td>
      <td><span class="${pillClass(row[5])}">${esc(row[4])}</span></td>
    </tr>
  `).join(""));

  renderAi("#performanceAiSummary", [
    ["Fortaleza", "Buen nivel de cumplimiento SLA y cierre de casos."],
    ["Oportunidad", "Reducir bloqueos por cliente con solicitudes más específicas."],
    ["Recomendación", "Priorizar incidencias técnicas con vencimiento cercano."]
  ]);

  renderChecklist("#performanceActionPlan", [
    ["1", "Revisar SLA temprano", "Abrir calendario al inicio del turno."],
    ["2", "Reducir bloqueos", "Usar plantillas claras para pedir evidencia."],
    ["3", "Cerrar con trazabilidad", "Validar respuesta final antes de cerrar."]
  ]);
}

function openPerformanceReport() {
  setText("#performanceReportTitle", "Reporte preparado");
  setText("#performanceReportText", "El reporte se generará desde backend cuando se conecte la base de datos.");
  setHTML("#performanceReportSummary", summaryHTML([
    ["Periodo", State.performancePeriod],
    ["Casos atendidos", "28"],
    ["SLA cumplido", "92%"],
    ["Satisfacción", "4.6"]
  ]));
  openModal("#performanceReportModal");
}