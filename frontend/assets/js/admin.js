"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ADMIN.JS
   Módulo Administrador
   ---------------------------------------------------------
   Pantallas:
   - dashboard.html
   - usuarios.html
   - roles-permisos.html
   - catalogos.html
   - reglas-sla.html
   - indicadores-reportes.html
   - integraciones.html
   - auditoria.html
   - respaldo.html
   - configuracion-sistema.html
========================================================= */

/* =========================================================
   MOCK DATA TEMPORAL
   Luego se reemplaza por backend.
========================================================= */

/*
  PASO 1: Reemplaza "const Mock = { ... }" en admin.js por:
*/

 let Mock = {
   admin: {
     id: 0,
     name: "Cargando...",
     initials: "…",
     role: "Administrador del sistema",
     status: "Sistema operativo",
     lastUpdate: "—"
   },
   users:       [],
   roles:       [],
   permissions: [],
   catalogs: { areas: [], types: [], categories: [], priorities: [], states: [], channels: [], services: [] },
   slaRules:    [],
   indicators: { kpis: [], stats: {} }
 };

/*
  PASO 2 (cargador):
*/

 async function _cargarDatosAdmin() {
   try {
     document.body.classList.add("loading-data");

     const [dashResp, usersResp, rolesResp, permsResp] = await Promise.allSettled([
       Api.Admin.dashboard(),
       Api.Admin.usuarios({ limit: 50 }),
       Api.Admin.roles(),
       Api.Admin.permisos(),
     ]);

     if (dashResp.status === "fulfilled" && dashResp.value) {
       const r = dashResp.value;
       if (r.admin)      Mock.admin      = r.admin;
       if (r.indicators) Mock.indicators = r.indicators;
     }
     if (usersResp.status === "fulfilled" && usersResp.value) {
       Mock.users = usersResp.value.usuarios || [];
     }
     if (rolesResp.status === "fulfilled" && rolesResp.value) {
       Mock.roles = rolesResp.value.roles || [];
     }
     if (permsResp.status === "fulfilled" && permsResp.value) {
       Mock.permissions = permsResp.value.permisos || [];
     }

     // Cargar catálogos (solo los que necesite la página actual)

     const page = document.body.dataset.page || "";
     if (page.includes("catalogo") || page.includes("dashboard")) {
       const [areasR, tiposR, priorsR, estadosR, canalesR, servR] = await Promise.allSettled([
         Api.Admin.catalogo("areas"),
         Api.Admin.catalogo("tipos-caso"),
         Api.Admin.catalogo("prioridades"),
         Api.Admin.catalogo("estados-caso"),
         Api.Admin.catalogo("canales"),
         Api.Admin.catalogo("servicios"),
       ]);
       if (areasR.status   === "fulfilled") Mock.catalogs.areas      = areasR.value.items   || [];
       if (tiposR.status   === "fulfilled") Mock.catalogs.types      = tiposR.value.items   || [];
       if (priorsR.status  === "fulfilled") Mock.catalogs.priorities = priorsR.value.items  || [];
       if (estadosR.status === "fulfilled") Mock.catalogs.states     = estadosR.value.items || [];
       if (canalesR.status === "fulfilled") Mock.catalogs.channels   = canalesR.value.items || [];
       if (servR.status    === "fulfilled") Mock.catalogs.services   = servR.value.items    || [];
     }

     if (page.includes("sla")) {
       const slaR = await Api.Admin.reglasSla().catch(() => null);
       if (slaR) Mock.slaRules = slaR.sla || [];
     }
   } catch (err) {
     console.error("[Admin] Error cargando datos:", err);
   } finally {
     document.body.classList.remove("loading-data");
   }
 }

/* =========================================================
   STATE
========================================================= */

const State = {
  page: document.body.dataset.page || "",
  theme: localStorage.getItem("claro360-admin-theme") || "light",

  selectedUserId: null,
  selectedRoleId: null,
  selectedPermissionId: null,
  selectedCatalogId: null,
  selectedSlaRuleId: null,
  selectedIntegrationId: null,
  selectedMetricId: null,
  selectedAlertId: null,
  selectedAuditId: null,
  selectedBackupId: null,

  userFilter: "todos",
  usersView: "cards",

  permissionFilter: "todos",

  catalogFilter: "todos",
  catalogView: "cards",

  slaRuleFilter: "todos",
  slaRuleView: "cards",

  integrationFilter: "todos",
  integrationView: "cards",

  adminMetricCompact: false,

  auditFilter: "todos",
  backupFilter: "todos"
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

function getUser(id) {
  return Mock.users.find(item => item.id === id) || null;
}

function getRole(id) {
  return Mock.roles.find(item => item.id === id) || null;
}

function getPermission(id) {
  return Mock.permissions.find(item => item.id === id) || null;
}

function getCatalogItem(id) {
  return Mock.catalogItems.find(item => item.id === id) || null;
}

function getSlaRule(id) {
  return Mock.slaRules.find(item => item.id === id) || null;
}

function getIntegration(id) {
  return Mock.integrations.find(item => item.id === id) || null;
}

function getMetric(id) {
  return Mock.adminMetrics.find(item => item.id === id) || null;
}

function getAlert(id) {
  return Mock.alerts.find(item => item.id === id) || null;
}

function getAudit(id) {
  return Mock.audit.find(item => item.id === id) || null;
}

function getBackup(id) {
  return Mock.backups.find(item => item.id === id) || null;
}

function statusType(status) {
  const s = String(status || "").toLowerCase();

  if (s.includes("error") || s.includes("fallido") || s.includes("bloqueado") || s.includes("crítica") || s.includes("critica")) {
    return "danger";
  }

  if (s.includes("alerta") || s.includes("revisión") || s.includes("revision") || s.includes("pendiente") || s.includes("programado")) {
    return "warning";
  }

  if (s.includes("activo") || s.includes("activa") || s.includes("completado") || s.includes("verificado") || s.includes("generado") || s.includes("exitoso")) {
    return "success";
  }

  return "info";
}

function metricStatusType(status) {
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

function countBy(list, field) {
  return list.reduce((acc, item) => {
    const key = item[field] || "Sin dato";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
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

   await _cargarDatosAdmin();

   setupBaseUI();
   setupGlobalEvents();
   setupBot();
   setupSearch();
   updateGlobalBadges();

   if (State.page === "admin-dashboard")             initDashboard();
   if (State.page === "admin-usuarios")              initUsuarios();
   if (State.page === "admin-roles-permisos")        initRolesPermisos();
   if (State.page === "admin-catalogos")             initCatalogos();
   if (State.page === "admin-reglas-sla")            initReglasSla();
   if (State.page === "admin-indicadores-reportes")  initIndicadoresReportes();
   if (State.page === "admin-integraciones")         initIntegraciones();
   if (State.page === "admin-auditoria")             initAuditoria();
   if (State.page === "admin-respaldo")              initRespaldo();
   if (State.page === "admin-configuracion")         initConfiguracion();
 });

/* =========================================================
   BASE UI
========================================================= */

function setupBaseUI() {
  setText("#userNameTop", Mock.admin.name);
  setText("#userRoleTop", Mock.admin.role);
  setText("#userAvatar", Mock.admin.initials);

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
  localStorage.setItem("claro360-admin-theme", theme);
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
  const activeUsers = Mock.users.filter(u => u.status === "Activo").length;
  const integrationAlerts = Mock.integrations.filter(i => i.status !== "Activa").length;
  const alertCount = Mock.alerts.length;

  setText("#sidebarUserCount", activeUsers);
  setText("#sidebarIntegrationAlerts", integrationAlerts);
  setText("#notificationBadge", alertCount);
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
    ["🏠", "Dashboard", "Vista general de administración del sistema.", "dashboard.html"],
    ["👤", "Usuarios", "Gestión de cuentas, roles, estado y accesos.", "usuarios.html"],
    ["🔐", "Roles y permisos", "Matriz de permisos por rol y módulo.", "roles-permisos.html"],
    ["🧩", "Catálogos", "Categorías, prioridades, estados, canales y áreas.", "catalogos.html"],
    ["⏱️", "Reglas SLA", "Configuración de tiempos de atención y alertas.", "reglas-sla.html"],
    ["📈", "Indicadores y reportes", "Gestión, métricas y generación de reportes.", "indicadores-reportes.html"],
    ["🔌", "Integraciones", "APIs, webhooks, correo, CRM y autenticación.", "integraciones.html"],
    ["🕵️", "Auditoría", "Trazabilidad administrativa de cambios.", "auditoria.html"],
    ["💾", "Respaldo", "Copias, restauración y continuidad.", "respaldo.html"],
    ["⚙️", "Configuración", "Parámetros globales del sistema.", "configuracion-sistema.html"]
  ].map(([icon, title, text, href]) => ({
    icon,
    title,
    text,
    href,
    key: `${title} ${text}`
  }));

  const users = Mock.users.map(item => ({
    icon: "👤",
    title: item.name,
    text: `${item.email} · ${item.role} · ${item.status}`,
    href: "usuarios.html",
    key: `${item.name} ${item.email} ${item.role} ${item.area} ${item.status}`
  }));

  const catalogs = Mock.catalogItems.map(item => ({
    icon: item.icon,
    title: item.name,
    text: `${item.type} · ${item.status} · ${item.dependency}`,
    href: "catalogos.html",
    key: `${item.name} ${item.type} ${item.status} ${item.dependency} ${item.description}`
  }));

  const integrations = Mock.integrations.map(item => ({
    icon: item.icon,
    title: item.name,
    text: `${item.type} · ${item.status} · ${item.lastSync}`,
    href: "integraciones.html",
    key: `${item.name} ${item.type} ${item.status} ${item.owner} ${item.endpoint}`
  }));

  const reports = Mock.reports.map(item => ({
    icon: "📊",
    title: item.name,
    text: `${item.type} · ${item.period} · ${item.status}`,
    href: "indicadores-reportes.html",
    key: `${item.name} ${item.type} ${item.period} ${item.status}`
  }));

  const results = [...pages, ...users, ...catalogs, ...integrations, ...reports]
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
    ["analyzeAdminSystemBtn", "Revisa el estado del sistema"],
    ["analyzeUsersBtn", "Analiza usuarios"],
    ["analyzeRolesBtn", "Analiza roles y permisos"],
    ["analyzePermissionRiskBtn", "Revisa permisos sensibles"],
    ["analyzeCatalogsBtn", "Analiza catálogos"],
    ["analyzeSlaRulesBtn", "Analiza reglas SLA"],
    ["analyzeAdminIndicatorsBtn", "Analiza indicadores administrativos"],
    ["analyzeIntegrationsBtn", "Analiza integraciones"],
    ["analyzeAdminAuditBtn", "Analiza auditoría administrativa"],
    ["generateAdminAuditInsightBtn", "Genera análisis de auditoría"],
    ["analyzeBackupBtn", "Analiza respaldo"],
    ["analyzeSystemConfigBtn", "Analiza configuración del sistema"]
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

  const blockedUsers = Mock.users.filter(u => u.status === "Bloqueado");
  const inactiveUsers = Mock.users.filter(u => u.status === "Inactivo");
  const integrationErrors = Mock.integrations.filter(i => i.status === "Error" || i.status === "Con alerta");
  const sensitiveEvents = Mock.audit.filter(a => a.critical);
  const backupFailures = Mock.backups.filter(b => b.status === "Fallido");

  if (text.includes("usuario") || text.includes("bloqueado") || text.includes("inactivo")) {
    return `Debes revisar ${blockedUsers.length} usuario bloqueado y ${inactiveUsers.length} usuario inactivo. Recomendación: validar motivo de bloqueo, último acceso y rol asignado antes de reactivar.`;
  }

  if (text.includes("permiso") || text.includes("rol") || text.includes("acceso")) {
    return "Los permisos más sensibles son: gestionar usuarios, modificar roles, generar reportes y cambiar configuración global. Revisa que solo el administrador tenga acceso completo.";
  }

  if (text.includes("catálogo") || text.includes("catalogo") || text.includes("duplicado")) {
    return "Los catálogos se ven estables. Revisa elementos en revisión y dependencias con reglas SLA antes de inactivarlos.";
  }

  if (text.includes("sla") || text.includes("umbral") || text.includes("tiempo")) {
    return "Hay reglas SLA críticas configuradas a 4 horas. Verifica que la alerta preventiva no sea demasiado tardía y que el área responsable esté definida.";
  }

  if (text.includes("integración") || text.includes("integracion") || text.includes("api") || text.includes("webhook")) {
    return `Existen ${integrationErrors.length} integraciones con alerta o error. La prioridad es revisar la API de facturación y el webhook CRM.`;
  }

  if (text.includes("auditor") || text.includes("trazabilidad") || text.includes("cambio")) {
    return `La auditoría muestra ${sensitiveEvents.length} eventos sensibles. Prioriza cambios de usuarios, permisos, SLA e integraciones.`;
  }

  if (text.includes("respaldo") || text.includes("backup") || text.includes("restaur")) {
    return `Se detectó ${backupFailures.length} respaldo fallido reciente. Valida el último respaldo completado y programa una prueba de restauración parcial.`;
  }

  if (text.includes("reporte") || text.includes("indicador") || text.includes("gestión") || text.includes("gestion")) {
    return "El reporte recomendado debe incluir usuarios activos, eventos sensibles, SLA global, estado de integraciones, respaldos y auditoría administrativa.";
  }

  if (text.includes("config") || text.includes("seguridad") || text.includes("sesión") || text.includes("sesion")) {
    return "La configuración es adecuada, pero conviene revisar expiración de sesión, intentos fallidos, MFA y alertas de integración o respaldo.";
  }

  return "Puedo ayudarte a revisar usuarios, roles, catálogos, reglas SLA, indicadores, reportes, integraciones, auditoría, respaldo y configuración del sistema.";
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

function renderBarChart(selector, rows) {
  const max = Math.max(...rows.map(row => Number(row.value) || 0), 1);

  setHTML(selector, rows.map(row => `
    <div class="bar-chart__row">
      <span>${esc(row.label)}</span>
      <div>
        <i style="width:${Math.max(8, (Number(row.value) / max) * 100)}%"></i>
      </div>
      <strong>${esc(row.value)}</strong>
    </div>
  `).join(""));
}

function renderDonut(selector, legendSelector, rows, totalLabel = "Total") {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1;
  let current = 0;

  const colors = [
    "var(--claro-red)",
    "var(--warning)",
    "var(--info)",
    "var(--success)",
    "var(--purple)"
  ];

  const slices = rows.map((row, index) => {
    const start = current;
    const end = current + (Number(row.value) / total) * 100;
    current = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(", ");

  const donut = $(selector);

  if (donut) {
    donut.style.background = `conic-gradient(${slices})`;
    donut.dataset.label = `${total}\n${totalLabel}`;
  }

  setHTML(legendSelector, rows.map((row, index) => `
    <div class="donut-legend__item">
      <span class="donut-legend__dot" style="background:${colors[index % colors.length]}"></span>
      <span>${esc(row.label)}</span>
      <strong>${esc(row.value)}</strong>
    </div>
  `).join(""));
}

function renderMetricCard(item) {
  const compactClass = State.adminMetricCompact ? " indicator-card--compact" : "";

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
        <span class="${pillClass(metricStatusType(item.status))}">
          Meta ${esc(item.target)}
        </span>
        <button type="button" data-admin-metric-id="${esc(item.id)}">Detalle</button>
      </div>
    </article>
  `;
}

function bindMetricButtons(root = document) {
  $$("[data-admin-metric-id]", root).forEach(button => {
    button.addEventListener("click", () => openAdminMetricDetail(button.dataset.adminMetricId));
  });
}

function openAdminMetricDetail(id) {
  const item = getMetric(id);
  if (!item) return;

  State.selectedMetricId = id;

  setText("#adminMetricDetailIcon", item.icon);
  setText("#adminMetricDetailTitle", item.title);
  setText("#adminMetricDetailText", item.description);

  setHTML("#adminMetricDetailSummary", summaryHTML([
    ["Valor actual", item.value],
    ["Meta", item.target],
    ["Avance", `${item.progress}%`],
    ["Estado", item.status],
    ["Causa probable", item.cause],
    ["Recomendación", "Revisar el módulo relacionado y generar reporte si la desviación persiste."]
  ]));

  setText("#adminIndicatorDetailIcon", item.icon);
  setText("#adminIndicatorDetailTitle", item.title);
  setText("#adminIndicatorDetailText", item.description);

  setHTML("#adminIndicatorDetailSummary", summaryHTML([
    ["Valor actual", item.value],
    ["Meta", item.target],
    ["Avance", `${item.progress}%`],
    ["Estado", item.status],
    ["Causa probable", item.cause],
    ["Recomendación", "Revisar el módulo relacionado y generar reporte si la desviación persiste."]
  ]));

  if ($("#adminIndicatorDetailModal")) openModal("#adminIndicatorDetailModal");
  else openModal("#adminMetricDetailModal");
}

/* =========================================================
   DASHBOARD
========================================================= */

function initDashboard() {
  setText("#adminSystemStatus", Mock.admin.status);
  setText("#adminLastUpdate", Mock.admin.lastUpdate);

  renderDashboardKpis();
  renderDashboardCharts();
  renderDashboardIntegrations();
  renderDashboardAlerts();
  renderDashboardAudit();
  renderDashboardBackup();

  renderAi("#adminDashboardAiSummary", [
    ["Prioridad administrativa", "Revisar integración de facturación, usuario bloqueado y respaldo fallido reciente."],
    ["Gestión del sistema", "La plataforma está operativa, pero hay alertas técnicas que requieren seguimiento."],
    ["Reporte sugerido", "Generar resumen administrativo semanal con usuarios, SLA, integraciones, respaldo y auditoría."]
  ]);

  renderChecklist("#adminActionPlan", [
    ["1", "Revisar alertas", "Atender primero integraciones con error y usuarios bloqueados."],
    ["2", "Validar respaldo", "Confirmar que el último respaldo completado sea recuperable."],
    ["3", "Generar reporte", "Preparar reporte administrativo con indicadores y auditoría."]
  ]);

  $("#refreshCaseTrendBtn")?.addEventListener("click", () => {
    renderDashboardCharts();
    toast("Gráfico actualizado", "Se actualizó la actividad semanal del sistema.", "success");
  });

  $("#caseTrendDetailBtn")?.addEventListener("click", () => {
    openAdminMetricDetail("MET-002");
  });

  $("#refreshCaseStatusBtn")?.addEventListener("click", () => {
    renderDashboardCharts();
    toast("Estado actualizado", "Se actualizó la distribución de casos.", "success");
  });

  $("#refreshAdminAlertsBtn")?.addEventListener("click", () => {
    renderDashboardAlerts();
    toast("Alertas actualizadas", "Se actualizó la lista de alertas administrativas.", "success");
  });

  $("#adminAlertResolveBtn")?.addEventListener("click", () => {
    closeModals();
    toast("Alerta revisada", "La alerta fue marcada como revisada.", "success");
  });

  $("#adminAlertGoBtn")?.addEventListener("click", () => {
    const alert = getAlert(State.selectedAlertId);
    if (alert) window.location.href = alert.href;
  });

  $("#adminMetricAiBtn")?.addEventListener("click", () => {
    const metric = getMetric(State.selectedMetricId);
    askBot(`Analiza la métrica ${metric?.title || ""}`);
  });
}

function renderDashboardKpis() {
  renderKpis("#adminDashboardKpiGrid", [
    ["👤", Mock.users.filter(u => u.status === "Activo").length, "Usuarios activos", "Cuentas habilitadas"],
    ["🔐", Mock.roles.length, "Roles", "Perfiles configurados"],
    ["🔌", Mock.integrations.filter(i => i.status === "Activa").length, "Integraciones sanas", "Servicios operativos"],
    ["⚠️", Mock.alerts.length, "Alertas", "Requieren revisión"]
  ]);
}

function renderDashboardCharts() {
  renderBarChart("#adminCasesTrendChart", [
    { label: "Lun", value: 18 },
    { label: "Mar", value: 22 },
    { label: "Mié", value: 19 },
    { label: "Jue", value: 31 },
    { label: "Vie", value: 26 },
    { label: "Sáb", value: 8 }
  ]);

  renderDonut("#caseStatusDonut", "#caseStatusLegend", [
    { label: "En atención", value: 44 },
    { label: "Pendientes", value: 28 },
    { label: "Cerrados", value: 39 },
    { label: "Vencidos", value: 7 }
  ], "Casos");

  renderBarChart("#roleActivityChart", [
    { label: "Cliente", value: 32 },
    { label: "Asesor", value: 88 },
    { label: "Supervisor", value: 47 },
    { label: "Admin", value: 29 }
  ]);
}

function renderDashboardIntegrations() {
  setHTML("#integrationStatusGrid", Mock.integrations.map(item => `
    <article class="integration-status-item">
      <span class="integration-status-item__icon">${esc(item.icon)}</span>
      <div>
        <strong>${esc(item.name)}</strong>
        <p>${esc(item.type)} · ${esc(item.lastSync)}</p>
      </div>
      <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
    </article>
  `).join(""));
}

function renderDashboardAlerts() {
  setHTML("#adminAlertList", Mock.alerts.map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">${esc(item.icon)}</span>
      <div>
        <strong>${esc(item.title)}</strong>
        <p>${esc(item.text)}</p>
        <small>${esc(item.date)} · Severidad ${esc(item.severity)}</small>
      </div>
      <button type="button" data-admin-alert-id="${esc(item.id)}">Revisar</button>
    </article>
  `).join(""));

  show($("#emptyAdminAlertsState"), !Mock.alerts.length);

  $$("[data-admin-alert-id]").forEach(button => {
    button.addEventListener("click", () => openAdminAlert(button.dataset.adminAlertId));
  });
}

function openAdminAlert(id) {
  const item = getAlert(id);
  if (!item) return;

  State.selectedAlertId = id;

  setText("#adminAlertModalIcon", item.icon);
  setText("#adminAlertModalTitle", item.title);
  setText("#adminAlertModalText", item.text);

  setHTML("#adminAlertModalSummary", summaryHTML([
    ["Módulo", item.module],
    ["Severidad", item.severity],
    ["Fecha", item.date],
    ["Acción sugerida", item.action],
    ["Destino", item.href]
  ]));

  openModal("#adminAlertModal");
}

function renderDashboardAudit() {
  const rows = Mock.audit.slice(0, 5).map(item => ({
    icon: auditIcon(item.type),
    title: `${item.action} · ${item.module}`,
    text: `${item.before} → ${item.after}. ${item.detail}`,
    date: item.date
  }));

  renderActivity("#adminAuditTimeline", rows);
  show($("#emptyAdminAuditState"), !rows.length);
}

function renderDashboardBackup() {
  const latest = Mock.backups[0];
  const failed = Mock.backups.find(item => item.status === "Fallido");

  setHTML("#backupSummary", `
    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">✅</span>
      <div>
        <strong>Último respaldo</strong>
        <p>${esc(latest.date)} · ${esc(latest.type)} · ${esc(latest.validation)}</p>
      </div>
    </article>

    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">🗓️</span>
      <div>
        <strong>Próxima ejecución</strong>
        <p>${esc(Mock.backups.find(b => b.status === "Programado")?.date || "No programada")}</p>
      </div>
    </article>

    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">⚠️</span>
      <div>
        <strong>Observación</strong>
        <p>${failed ? `Existe respaldo fallido: ${failed.date}` : "Sin fallas recientes"}</p>
      </div>
    </article>
  `);
}

/* =========================================================
   USUARIOS
========================================================= */

function initUsers() {
  renderUsersPage();

  $("#userSearch")?.addEventListener("input", renderUsersPage);

  $$("[data-user-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.userFilter = button.dataset.userFilter;
      $$("[data-user-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderUsersPage();
    });
  });

  $("#toggleUsersViewBtn")?.addEventListener("click", () => {
    State.usersView = State.usersView === "cards" ? "table" : "cards";
    $("#toggleUsersViewBtn").textContent = State.usersView === "cards" ? "Vista tabla" : "Vista cards";
    renderUsersPage();
  });

  $("#refreshUsersBtn")?.addEventListener("click", () => {
    renderUsersPage();
    toast("Usuarios actualizados", "Se actualizó el directorio de usuarios.", "success");
  });

  $("#refreshUsersByRoleBtn")?.addEventListener("click", () => {
    renderUsersCharts();
    toast("Gráfico actualizado", "Se actualizó la distribución por rol.", "success");
  });

  $("#refreshUserStatusChartBtn")?.addEventListener("click", () => {
    renderUsersCharts();
    toast("Gráfico actualizado", "Se actualizó el estado de cuentas.", "success");
  });

  $("#openCreateUserBtn")?.addEventListener("click", openCreateUserModal);

  $("#exportUsersBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "El directorio de usuarios fue preparado para exportación.");
  });

  $("#bulkUserActionBtn")?.addEventListener("click", () => {
    openModal("#bulkUserActionModal");
  });

  $("#confirmBulkUserActionBtn")?.addEventListener("click", confirmBulkUserAction);

  $("#saveUserBtn")?.addEventListener("click", confirmSaveUser);

  $("#suggestUserRoleBtn")?.addEventListener("click", () => {
    const area = getValue("#userArea");

    if (area === "Supervisión") $("#userRole").value = "Supervisor";
    else if (area === "Administración") $("#userRole").value = "Administrador";
    else if (area === "Atención al cliente" || area === "Soporte técnico" || area === "Backoffice") $("#userRole").value = "Asesor";
    else $("#userRole").value = "Cliente";

    $("#userAccessType").value =
      $("#userRole").value === "Administrador" ? "Acceso administrativo" :
      $("#userRole").value === "Cliente" ? "Acceso estándar" :
      "Acceso restringido";

    toast("Rol sugerido", "La IA completó una propuesta de rol y tipo de acceso.", "success");
  });

  $("#userEditBtn")?.addEventListener("click", () => {
    closeModals();
    openEditUserModal(State.selectedUserId);
  });

  $("#userResetAccessBtn")?.addEventListener("click", () => {
    closeModals();
    openResetAccessModal(State.selectedUserId);
  });

  $("#userToggleStatusBtn")?.addEventListener("click", () => {
    closeModals();
    openChangeUserStatusModal(State.selectedUserId);
  });

  $("#userAuditBtn")?.addEventListener("click", () => {
    window.location.href = "auditoria.html";
  });

  $("#confirmResetAccessBtn")?.addEventListener("click", confirmResetAccess);
  $("#confirmChangeUserStatusBtn")?.addEventListener("click", confirmChangeUserStatus);

  renderAi("#usersAiSummary", [
    ["Revisión prioritaria", "Validar usuarios bloqueados e inactivos con último acceso antiguo."],
    ["Seguridad", "Cuentas administrativas deben mantenerse con acceso controlado y trazabilidad."],
    ["Acción sugerida", "Restablecer acceso solo después de validar identidad y motivo."]
  ]);

  renderChecklist("#usersActionPlan", [
    ["1", "Revisar bloqueados", "Validar causa del bloqueo antes de reactivar."],
    ["2", "Depurar inactivos", "Identificar cuentas sin uso reciente."],
    ["3", "Validar roles", "Confirmar que el rol corresponda al área funcional."]
  ]);
}

function usersFiltered() {
  const query = getValue("#userSearch").toLowerCase();

  return Mock.users.filter(user => {
    const text = `${user.name} ${user.email} ${user.role} ${user.area} ${user.status} ${user.lastAccess}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const filter = State.userFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "activos" && user.status === "Activo") ||
      (filter === "bloqueados" && user.status === "Bloqueado") ||
      (filter === "inactivos" && user.status === "Inactivo") ||
      (filter === "asesores" && user.role === "Asesor") ||
      (filter === "supervisores" && user.role === "Supervisor") ||
      (filter === "admins" && user.role === "Administrador");

    return matchesSearch && matchesFilter;
  });
}

function renderUsersPage() {
  const rows = usersFiltered();

  setText("#usersSummaryTitle", `${Mock.users.filter(u => u.status === "Activo").length} usuarios activos`);
  setText("#usersSummaryText", `${rows.length} usuarios visibles según filtro.`);

  renderKpis("#usersKpiGrid", [
    ["👤", Mock.users.length, "Usuarios", "Total registrado"],
    ["✅", Mock.users.filter(u => u.status === "Activo").length, "Activos", "Cuentas habilitadas"],
    ["🔒", Mock.users.filter(u => u.status === "Bloqueado").length, "Bloqueados", "Requieren revisión"],
    ["🕘", Mock.users.filter(u => u.status === "Inactivo").length, "Inactivos", "Sin actividad reciente"]
  ]);

  renderUsersCharts();

  setHTML("#usersCardList", rows.map(userCard).join(""));
  setHTML("#usersTableBody", rows.map(userTableRow).join(""));

  show($("#usersCardList"), State.usersView === "cards");
  show($("#usersTableWrap"), State.usersView === "table");
  show($("#emptyUsersState"), !rows.length);

  bindUserActions($("#usersCardList"));
  bindUserActions($("#usersTableBody"));
}

function renderUsersCharts() {
  const byRole = countBy(Mock.users, "role");
  const byStatus = countBy(Mock.users, "status");

  renderDonut("#usersByRoleDonut", "#usersByRoleLegend", Object.entries(byRole).map(([label, value]) => ({ label, value })), "Usuarios");

  renderBarChart("#userStatusChart", Object.entries(byStatus).map(([label, value]) => ({ label, value })));
}

function userCard(user) {
  return `
    <article class="user-card">
      <div class="user-card__top">
        <span class="user-card__avatar">${esc(user.initials)}</span>
        <div>
          <h3>${esc(user.name)}</h3>
          <p>${esc(user.email)}</p>
        </div>
        <span class="${pillClass(statusType(user.status))}">${esc(user.status)}</span>
      </div>

      <div class="user-card__meta">
        <span>${esc(user.role)}</span>
        <span>${esc(user.area)}</span>
        <span>${esc(user.accessType)}</span>
        <span>Último acceso: ${esc(user.lastAccess)}</span>
      </div>

      <div class="user-card__actions">
        <button type="button" data-action="view-user" data-user-id="${esc(user.id)}">Ver</button>
        <button type="button" data-action="edit-user" data-user-id="${esc(user.id)}">Editar</button>
        <button type="button" data-action="status-user" data-user-id="${esc(user.id)}">Estado</button>
      </div>
    </article>
  `;
}

function userTableRow(user) {
  return `
    <tr>
      <td>${esc(user.name)}</td>
      <td>${esc(user.email)}</td>
      <td>${esc(user.role)}</td>
      <td>${esc(user.area)}</td>
      <td><span class="${pillClass(statusType(user.status))}">${esc(user.status)}</span></td>
      <td>${esc(user.lastAccess)}</td>
      <td>
        <button type="button" data-action="view-user" data-user-id="${esc(user.id)}">Ver</button>
        <button type="button" data-action="edit-user" data-user-id="${esc(user.id)}">Editar</button>
      </td>
    </tr>
  `;
}

function bindUserActions(root = document) {
  $$("[data-action='view-user']", root).forEach(button => {
    button.addEventListener("click", () => openUserDetail(button.dataset.userId));
  });

  $$("[data-action='edit-user']", root).forEach(button => {
    button.addEventListener("click", () => openEditUserModal(button.dataset.userId));
  });

  $$("[data-action='status-user']", root).forEach(button => {
    button.addEventListener("click", () => openChangeUserStatusModal(button.dataset.userId));
  });
}

function userSummary(user) {
  return summaryHTML([
    ["Código", user.id],
    ["Nombre", user.name],
    ["Correo", user.email],
    ["Rol", user.role],
    ["Área", user.area],
    ["Estado", user.status],
    ["Tipo de acceso", user.accessType],
    ["Último acceso", user.lastAccess],
    ["Riesgo", user.risk]
  ]);
}

function openUserDetail(id) {
  const user = getUser(id);
  if (!user) return;

  State.selectedUserId = id;

  setText("#userDetailIcon", user.initials);
  setText("#userDetailTitle", user.name);
  setText("#userDetailText", `${user.email} · ${user.role} · ${user.status}`);
  setHTML("#userDetailSummary", userSummary(user));

  openModal("#userDetailModal");
}

function openCreateUserModal() {
  State.selectedUserId = null;

  setText("#userFormEyebrow", "Nuevo usuario");
  setText("#userFormTitle", "Crear usuario");
  setText("#userFormText", "Completa la información de la cuenta, rol, área y estado de acceso.");

  ["#userFullName", "#userEmail", "#userComment"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  ["#userRole", "#userArea", "#userStatus", "#userAccessType"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  if ($("#userFormDeclaration")) $("#userFormDeclaration").checked = false;

  openModal("#userFormModal");
}

function openEditUserModal(id) {
  const user = getUser(id);
  if (!user) return;

  State.selectedUserId = id;

  setText("#userFormEyebrow", "Editar usuario");
  setText("#userFormTitle", user.name);
  setText("#userFormText", "Modifica los datos administrativos de la cuenta seleccionada.");

  if ($("#userFullName")) $("#userFullName").value = user.name;
  if ($("#userEmail")) $("#userEmail").value = user.email;
  if ($("#userRole")) $("#userRole").value = user.role;
  if ($("#userArea")) $("#userArea").value = user.area;
  if ($("#userStatus")) $("#userStatus").value = user.status;
  if ($("#userAccessType")) $("#userAccessType").value = user.accessType;
  if ($("#userComment")) $("#userComment").value = `Actualización administrativa de ${user.name}.`;
  if ($("#userFormDeclaration")) $("#userFormDeclaration").checked = false;

  openModal("#userFormModal");
}

function confirmSaveUser() {
  if (
    !getValue("#userFullName") ||
    !getValue("#userEmail") ||
    !getValue("#userRole") ||
    !getValue("#userArea") ||
    !getValue("#userStatus") ||
    !getValue("#userAccessType") ||
    !isChecked("#userFormDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, correo, rol, área, estado, acceso y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Usuario guardado", "La cuenta fue registrada correctamente.", "success");
  renderUsersPage();
}

function openResetAccessModal(id) {
  const user = getUser(id);
  if (!user) return;

  State.selectedUserId = id;
  setHTML("#resetAccessSummary", userSummary(user));

  if ($("#resetAccessDeclaration")) $("#resetAccessDeclaration").checked = false;

  openModal("#resetAccessModal");
}

function confirmResetAccess() {
  if (!isChecked("#resetAccessDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar el restablecimiento de acceso.", "warning");
    return;
  }

  closeModals();
  toast("Acceso restablecido", "Se generó el restablecimiento de acceso.", "success");
}

function openChangeUserStatusModal(id) {
  const user = getUser(id);
  if (!user) return;

  State.selectedUserId = id;

  setHTML("#changeUserStatusSummary", userSummary(user));
  if ($("#newUserStatus")) $("#newUserStatus").value = "";
  if ($("#changeUserStatusReason")) $("#changeUserStatusReason").value = "";
  if ($("#changeUserStatusDeclaration")) $("#changeUserStatusDeclaration").checked = false;

  openModal("#changeUserStatusModal");
}

function confirmChangeUserStatus() {
  if (
    !getValue("#newUserStatus") ||
    !getValue("#changeUserStatusReason") ||
    !isChecked("#changeUserStatusDeclaration")
  ) {
    toast("Faltan datos", "Completa nuevo estado, motivo y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Estado actualizado", "El cambio quedó registrado en auditoría.", "success");
  renderUsersPage();
}

function confirmBulkUserAction() {
  if (
    !getValue("#bulkUserScope") ||
    !getValue("#bulkUserAction") ||
    !isChecked("#bulkUserDeclaration")
  ) {
    toast("Faltan datos", "Selecciona alcance, acción y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Acción preparada", "La acción masiva quedó preparada para revisión.", "success");
}

/* =========================================================
   ROLES Y PERMISOS
========================================================= */

function initRolesPermissions() {
  renderRolesPermissionsPage();

  $("#permissionSearch")?.addEventListener("input", renderPermissionMatrix);

  $$("[data-permission-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.permissionFilter = button.dataset.permissionFilter;
      $$("[data-permission-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderPermissionMatrix();
    });
  });

  $("#openCreateRoleBtn")?.addEventListener("click", openCreateRoleModal);

  $("#savePermissionMatrixBtn")?.addEventListener("click", () => {
    openModal("#savePermissionMatrixModal");
  });

  $("#confirmSavePermissionMatrixBtn")?.addEventListener("click", confirmSavePermissionMatrix);

  $("#refreshPermissionMatrixBtn")?.addEventListener("click", () => {
    renderPermissionMatrix();
    toast("Matriz actualizada", "Se actualizó la matriz de permisos.", "success");
  });

  $("#resetPermissionMatrixBtn")?.addEventListener("click", () => {
    renderPermissionMatrix();
    toast("Matriz restaurada", "Se restauró la vista actual de permisos.", "success");
  });

  $("#exportPermissionMatrixBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "La matriz de permisos fue preparada para exportación.");
  });

  $("#refreshRolesChartBtn")?.addEventListener("click", () => {
    renderRolesChart();
    toast("Gráfico actualizado", "Se actualizó la distribución de usuarios por rol.", "success");
  });

  $("#refreshRoleCardsBtn")?.addEventListener("click", () => {
    renderRoleCards();
    toast("Roles actualizados", "Se actualizó la lista de roles configurados.", "success");
  });

  $("#exportRolesBtn")?.addEventListener("click", () => {
    genericModal("📤", "Roles preparados", "La lista de roles fue preparada para exportación.");
  });

  $("#editPermissionBtn")?.addEventListener("click", () => {
    closeModals();
    openModal("#savePermissionMatrixModal");
  });

  $("#permissionAuditBtn")?.addEventListener("click", () => {
    window.location.href = "auditoria.html";
  });

  $("#saveRoleBtn")?.addEventListener("click", confirmSaveRole);

  $("#suggestRolePermissionsBtn")?.addEventListener("click", () => {
    const scope = getValue("#roleScope");

    if (scope === "Cliente") $("#roleAccessLevel").value = "Básico";
    else if (scope === "Atención") $("#roleAccessLevel").value = "Operativo";
    else if (scope === "Supervisión") $("#roleAccessLevel").value = "Supervisor";
    else if (scope === "Administración") $("#roleAccessLevel").value = "Administrador";

    $("#roleStatus").value = "Activo";
    $("#roleDescription").value =
      "La IA sugiere un rol con permisos acordes al alcance funcional seleccionado, evitando accesos administrativos innecesarios.";

    toast("Permisos sugeridos", "Se completó una propuesta base para el rol.", "success");
  });

  renderAi("#rolesAiSummary", [
    ["Permisos sensibles", "Solo el rol Administrador debe modificar usuarios, roles, configuración global y catálogos críticos."],
    ["Control preventivo", "Evita otorgar permisos de exportación o auditoría a roles operativos sin justificación."],
    ["Revisión sugerida", "Auditar cambios en roles después de cada ajuste de matriz."]
  ]);

  renderChecklist("#rolesActionPlan", [
    ["1", "Validar mínimos", "Cada rol debe tener solo los permisos necesarios."],
    ["2", "Revisar sensibles", "Cambios de usuarios, roles y configuración deben quedar limitados."],
    ["3", "Guardar con sustento", "Todo cambio debe quedar registrado para auditoría."]
  ]);
}

function renderRolesPermissionsPage() {
  setText("#rolesSummaryTitle", `${Mock.roles.length} roles configurados`);
  setText("#rolesSummaryText", `${Mock.permissions.length} permisos funcionales en matriz.`);

  renderKpis("#rolesKpiGrid", [
    ["🔐", Mock.roles.length, "Roles", "Perfiles activos"],
    ["🧩", Mock.permissions.length, "Permisos", "Acciones configuradas"],
    ["⚠️", Mock.permissions.filter(p => p.sensitive).length, "Sensibles", "Requieren control"],
    ["👤", Mock.users.length, "Usuarios", "Cuentas asignadas"]
  ]);

  renderRolesChart();
  renderPermissionRisk();
  renderPermissionMatrix();
  renderRoleCards();
}

function renderRolesChart() {
  const byRole = countBy(Mock.users, "role");
  renderBarChart("#rolesUsersChart", Object.entries(byRole).map(([label, value]) => ({ label, value })));
}

function renderPermissionRisk() {
  const rows = Mock.permissions.filter(permission => permission.sensitive);

  setHTML("#permissionRiskList", rows.map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">🔐</span>
      <div>
        <strong>${esc(item.module)} · ${esc(item.permission)}</strong>
        <p>${esc(item.description)}</p>
        <small>Permiso sensible · Requiere control administrativo</small>
      </div>
      <button type="button" data-permission-id="${esc(item.id)}">Ver</button>
    </article>
  `).join(""));

  $$("[data-permission-id]").forEach(button => {
    button.addEventListener("click", () => openPermissionDetail(button.dataset.permissionId));
  });
}

function permissionFiltered() {
  const query = getValue("#permissionSearch").toLowerCase();

  return Mock.permissions.filter(permission => {
    const text = `${permission.module} ${permission.permission} ${permission.description}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const filter = State.permissionFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "cliente" && permission.cliente) ||
      (filter === "asesor" && permission.asesor) ||
      (filter === "supervisor" && permission.supervisor) ||
      (filter === "administrador" && permission.administrador) ||
      (filter === "sensibles" && permission.sensitive);

    return matchesSearch && matchesFilter;
  });
}

function renderPermissionMatrix() {
  const rows = permissionFiltered();

  setHTML("#permissionMatrixBody", rows.map(permission => `
    <tr>
      <td>
        <strong>${esc(permission.module)}</strong><br />
        <small>${esc(permission.permission)}</small>
      </td>

      <td>
        <button type="button" class="permission-toggle ${permission.cliente ? "is-on" : ""}" data-toggle-permission="${esc(permission.id)}" data-role="cliente"></button>
      </td>

      <td>
        <button type="button" class="permission-toggle ${permission.asesor ? "is-on" : ""}" data-toggle-permission="${esc(permission.id)}" data-role="asesor"></button>
      </td>

      <td>
        <button type="button" class="permission-toggle ${permission.supervisor ? "is-on" : ""}" data-toggle-permission="${esc(permission.id)}" data-role="supervisor"></button>
      </td>

      <td>
        <button type="button" class="permission-toggle ${permission.administrador ? "is-on" : ""}" data-toggle-permission="${esc(permission.id)}" data-role="administrador"></button>
      </td>

      <td>
        <button type="button" class="permission-detail-btn" data-permission-detail="${esc(permission.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  show($("#emptyPermissionState"), !rows.length);

  $$("[data-toggle-permission]").forEach(button => {
    button.addEventListener("click", () => {
      button.classList.toggle("is-on");
      toast("Permiso modificado", "Cambio temporal aplicado. Guarda la matriz para confirmar.", "success");
    });
  });

  $$("[data-permission-detail]").forEach(button => {
    button.addEventListener("click", () => openPermissionDetail(button.dataset.permissionDetail));
  });
}

function openPermissionDetail(id) {
  const permission = getPermission(id);
  if (!permission) return;

  State.selectedPermissionId = id;

  setText("#permissionDetailIcon", permission.sensitive ? "⚠️" : "🔐");
  setText("#permissionDetailTitle", `${permission.module} · ${permission.permission}`);
  setText("#permissionDetailText", permission.description);

  setHTML("#permissionDetailSummary", summaryHTML([
    ["Módulo", permission.module],
    ["Permiso", permission.permission],
    ["Sensible", permission.sensitive ? "Sí" : "No"],
    ["Cliente", permission.cliente ? "Permitido" : "No permitido"],
    ["Asesor", permission.asesor ? "Permitido" : "No permitido"],
    ["Supervisor", permission.supervisor ? "Permitido" : "No permitido"],
    ["Administrador", permission.administrador ? "Permitido" : "No permitido"]
  ]));

  openModal("#permissionDetailModal");
}

function renderRoleCards() {
  setHTML("#roleCardGrid", Mock.roles.map(role => `
    <article class="role-card">
      <div class="role-card__top">
        <span class="role-card__icon">${esc(role.icon)}</span>
        <div>
          <h3>${esc(role.name)}</h3>
          <p>${esc(role.description)}</p>
        </div>
        <span class="${pillClass(statusType(role.status))}">${esc(role.status)}</span>
      </div>

      <div class="role-card__meta">
        <span>${esc(role.scope)}</span>
        <span>${esc(role.accessLevel)}</span>
        <span>${esc(role.users)} usuarios</span>
      </div>

      <div class="role-card__actions">
        <button type="button" data-action="edit-role" data-role-id="${esc(role.id)}">Editar</button>
        <button type="button" data-action="audit-role" data-role-id="${esc(role.id)}">Auditoría</button>
      </div>
    </article>
  `).join(""));

  $$("[data-action='edit-role']").forEach(button => {
    button.addEventListener("click", () => openEditRoleModal(button.dataset.roleId));
  });

  $$("[data-action='audit-role']").forEach(button => {
    button.addEventListener("click", () => {
      window.location.href = "auditoria.html";
    });
  });
}

function openCreateRoleModal() {
  State.selectedRoleId = null;

  setText("#roleFormEyebrow", "Nuevo rol");
  setText("#roleFormTitle", "Crear rol");
  setText("#roleFormText", "Define nombre, alcance, nivel de acceso y módulos asociados al rol.");

  ["#roleName", "#roleDescription"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  ["#roleScope", "#roleAccessLevel", "#roleStatus"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  if ($("#roleFormDeclaration")) $("#roleFormDeclaration").checked = false;

  openModal("#roleFormModal");
}

function openEditRoleModal(id) {
  const role = getRole(id);
  if (!role) return;

  State.selectedRoleId = id;

  setText("#roleFormEyebrow", "Editar rol");
  setText("#roleFormTitle", role.name);
  setText("#roleFormText", "Modifica el alcance y descripción del rol seleccionado.");

  if ($("#roleName")) $("#roleName").value = role.name;
  if ($("#roleScope")) $("#roleScope").value = role.scope;
  if ($("#roleAccessLevel")) $("#roleAccessLevel").value = role.accessLevel;
  if ($("#roleStatus")) $("#roleStatus").value = role.status;
  if ($("#roleDescription")) $("#roleDescription").value = role.description;
  if ($("#roleFormDeclaration")) $("#roleFormDeclaration").checked = false;

  openModal("#roleFormModal");
}

function confirmSaveRole() {
  if (
    !getValue("#roleName") ||
    !getValue("#roleScope") ||
    !getValue("#roleAccessLevel") ||
    !getValue("#roleStatus") ||
    !getValue("#roleDescription") ||
    !isChecked("#roleFormDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, alcance, nivel, estado, descripción y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Rol guardado", "El rol fue registrado correctamente.", "success");
  renderRoleCards();
}

function confirmSavePermissionMatrix() {
  if (!isChecked("#permissionMatrixDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste los permisos.", "warning");
    return;
  }

  closeModals();
  toast("Matriz guardada", "Los permisos fueron guardados correctamente.", "success");
}

/* =========================================================
   CATÁLOGOS
========================================================= */

function initCatalogs() {
  renderCatalogsPage();

  $("#catalogSearch")?.addEventListener("input", renderCatalogsPage);

  $$("[data-catalog-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.catalogFilter = button.dataset.catalogFilter;
      $$("[data-catalog-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderCatalogsPage();
    });
  });

  $("#toggleCatalogViewBtn")?.addEventListener("click", () => {
    State.catalogView = State.catalogView === "cards" ? "table" : "cards";
    $("#toggleCatalogViewBtn").textContent = State.catalogView === "cards" ? "Vista tabla" : "Vista cards";
    renderCatalogsPage();
  });

  $("#openCreateCatalogItemBtn")?.addEventListener("click", openCreateCatalogModal);

  $("#refreshCatalogsBtn")?.addEventListener("click", () => {
    renderCatalogsPage();
    toast("Catálogos actualizados", "Se actualizó la lista de elementos.", "success");
  });

  $("#exportCatalogsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Catálogos preparados", "Los catálogos fueron preparados para exportación.");
  });

  $("#validateCatalogsBtn")?.addEventListener("click", () => {
    askBot("Valida inconsistencias de catálogos");
  });

  $("#refreshCatalogChartBtn")?.addEventListener("click", () => {
    renderCatalogCharts();
    toast("Gráfico actualizado", "Se actualizó la distribución de catálogos.", "success");
  });

  $("#refreshCatalogStatusBtn")?.addEventListener("click", () => {
    renderCatalogCharts();
    toast("Estado actualizado", "Se actualizó el estado de catálogos.", "success");
  });

  $("#catalogEditBtn")?.addEventListener("click", () => {
    closeModals();
    openEditCatalogModal(State.selectedCatalogId);
  });

  $("#catalogToggleStatusBtn")?.addEventListener("click", () => {
    closeModals();
    openCatalogStatusModal(State.selectedCatalogId);
  });

  $("#catalogAuditBtn")?.addEventListener("click", () => {
    window.location.href = "auditoria.html";
  });

  $("#saveCatalogItemBtn")?.addEventListener("click", confirmSaveCatalogItem);

  $("#catalogSuggestBtn")?.addEventListener("click", () => {
    $("#catalogItemStatus").value = "Activo";
    $("#catalogItemDependency").value = "Reglas SLA";
    $("#catalogItemDescription").value =
      "La IA sugiere validar que este elemento no duplique catálogos existentes y que su dependencia funcional esté documentada.";
    toast("Validación sugerida", "La IA completó una recomendación para el catálogo.", "success");
  });

  $("#confirmCatalogStatusBtn")?.addEventListener("click", confirmCatalogStatus);

  renderAi("#catalogAiSummary", [
    ["Dependencias críticas", "Prioridades, categorías y canales impactan directamente en reglas SLA y reportes."],
    ["Elementos en revisión", "No deben usarse en producción hasta validar dependencia y duplicidad."],
    ["Acción sugerida", "Antes de inactivar elementos, revisar si son usados por SLA, asignaciones o reportes."]
  ]);

  renderChecklist("#catalogActionPlan", [
    ["1", "Validar duplicados", "Evitar elementos equivalentes con nombres distintos."],
    ["2", "Revisar dependencias", "Confirmar impacto en SLA, asignaciones y reportes."],
    ["3", "Auditar cambios", "Registrar sustento al activar o inactivar catálogos."]
  ]);
}

function catalogFiltered() {
  const query = getValue("#catalogSearch").toLowerCase();

  return Mock.catalogItems.filter(item => {
    const text = `${item.name} ${item.type} ${item.status} ${item.usage} ${item.dependency} ${item.description}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const matchesFilter =
      State.catalogFilter === "todos" ||
      item.filterType === State.catalogFilter;

    return matchesSearch && matchesFilter;
  });
}

function renderCatalogsPage() {
  const rows = catalogFiltered();

  setText("#catalogSummaryTitle", `${Mock.catalogItems.length} elementos configurados`);
  setText("#catalogSummaryText", `${rows.length} elementos visibles según filtro.`);

  renderKpis("#catalogKpiGrid", [
    ["🧩", Mock.catalogItems.length, "Elementos", "Total configurado"],
    ["✅", Mock.catalogItems.filter(i => i.status === "Activo").length, "Activos", "Disponibles"],
    ["🕘", Mock.catalogItems.filter(i => i.status === "En revisión").length, "En revisión", "Pendientes"],
    ["⏱️", Mock.catalogItems.filter(i => i.dependency === "Reglas SLA").length, "Impactan SLA", "Dependencia crítica"]
  ]);

  renderCatalogCharts();

  setHTML("#catalogCardList", rows.map(catalogCard).join(""));
  setHTML("#catalogTableBody", rows.map(catalogTableRow).join(""));

  show($("#catalogCardList"), State.catalogView === "cards");
  show($("#catalogTableWrap"), State.catalogView === "table");
  show($("#emptyCatalogState"), !rows.length);

  bindCatalogActions($("#catalogCardList"));
  bindCatalogActions($("#catalogTableBody"));
}

function renderCatalogCharts() {
  const byType = countBy(Mock.catalogItems, "type");
  const byStatus = countBy(Mock.catalogItems, "status");

  renderBarChart("#catalogDistributionChart", Object.entries(byType).map(([label, value]) => ({ label, value })));
  renderDonut("#catalogStatusDonut", "#catalogStatusLegend", Object.entries(byStatus).map(([label, value]) => ({ label, value })), "Elementos");
}

function catalogCard(item) {
  return `
    <article class="catalog-card">
      <div class="catalog-card__top">
        <span class="catalog-card__icon">${esc(item.icon)}</span>
        <div>
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description)}</p>
        </div>
        <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
      </div>

      <div class="catalog-card__meta">
        <span>${esc(item.type)}</span>
        <span>${esc(item.usage)}</span>
        <span>${esc(item.dependency)}</span>
        <span>${esc(item.updatedAt)}</span>
      </div>

      <div class="catalog-card__actions">
        <button type="button" data-action="view-catalog" data-catalog-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-catalog" data-catalog-id="${esc(item.id)}">Editar</button>
        <button type="button" data-action="status-catalog" data-catalog-id="${esc(item.id)}">Estado</button>
      </div>
    </article>
  `;
}

function catalogTableRow(item) {
  return `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.type)}</td>
      <td><span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(item.usage)}</td>
      <td>${esc(item.dependency)}</td>
      <td>${esc(item.updatedAt)}</td>
      <td>
        <button type="button" data-action="view-catalog" data-catalog-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-catalog" data-catalog-id="${esc(item.id)}">Editar</button>
      </td>
    </tr>
  `;
}

function bindCatalogActions(root = document) {
  $$("[data-action='view-catalog']", root).forEach(button => {
    button.addEventListener("click", () => openCatalogDetail(button.dataset.catalogId));
  });

  $$("[data-action='edit-catalog']", root).forEach(button => {
    button.addEventListener("click", () => openEditCatalogModal(button.dataset.catalogId));
  });

  $$("[data-action='status-catalog']", root).forEach(button => {
    button.addEventListener("click", () => openCatalogStatusModal(button.dataset.catalogId));
  });
}

function catalogSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Nombre", item.name],
    ["Tipo", item.type],
    ["Estado", item.status],
    ["Uso", item.usage],
    ["Dependencia", item.dependency],
    ["Última actualización", item.updatedAt],
    ["Descripción", item.description]
  ]);
}

function openCatalogDetail(id) {
  const item = getCatalogItem(id);
  if (!item) return;

  State.selectedCatalogId = id;

  setText("#catalogDetailIcon", item.icon);
  setText("#catalogDetailTitle", item.name);
  setText("#catalogDetailText", item.description);
  setHTML("#catalogDetailSummary", catalogSummary(item));

  openModal("#catalogDetailModal");
}

function openCreateCatalogModal() {
  State.selectedCatalogId = null;

  setText("#catalogFormEyebrow", "Nuevo catálogo");
  setText("#catalogFormTitle", "Nuevo elemento de catálogo");
  setText("#catalogFormText", "Registra un elemento funcional que será usado por los módulos de atención.");

  ["#catalogItemName", "#catalogItemDescription"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  ["#catalogItemType", "#catalogItemStatus", "#catalogItemDependency"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  if ($("#catalogFormDeclaration")) $("#catalogFormDeclaration").checked = false;

  openModal("#catalogFormModal");
}

function openEditCatalogModal(id) {
  const item = getCatalogItem(id);
  if (!item) return;

  State.selectedCatalogId = id;

  setText("#catalogFormEyebrow", "Editar catálogo");
  setText("#catalogFormTitle", item.name);
  setText("#catalogFormText", "Modifica la información funcional del elemento seleccionado.");

  if ($("#catalogItemName")) $("#catalogItemName").value = item.name;
  if ($("#catalogItemType")) $("#catalogItemType").value = item.type;
  if ($("#catalogItemStatus")) $("#catalogItemStatus").value = item.status;
  if ($("#catalogItemDependency")) $("#catalogItemDependency").value = item.dependency;
  if ($("#catalogItemDescription")) $("#catalogItemDescription").value = item.description;
  if ($("#catalogFormDeclaration")) $("#catalogFormDeclaration").checked = false;

  openModal("#catalogFormModal");
}

function confirmSaveCatalogItem() {
  if (
    !getValue("#catalogItemName") ||
    !getValue("#catalogItemType") ||
    !getValue("#catalogItemStatus") ||
    !getValue("#catalogItemDependency") ||
    !getValue("#catalogItemDescription") ||
    !isChecked("#catalogFormDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, tipo, estado, dependencia, descripción y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Elemento guardado", "El catálogo fue registrado correctamente.", "success");
  renderCatalogsPage();
}

function openCatalogStatusModal(id) {
  const item = getCatalogItem(id);
  if (!item) return;

  State.selectedCatalogId = id;

  setHTML("#catalogStatusSummary", catalogSummary(item));

  if ($("#newCatalogStatus")) $("#newCatalogStatus").value = "";
  if ($("#catalogStatusReason")) $("#catalogStatusReason").value = "";
  if ($("#catalogStatusDeclaration")) $("#catalogStatusDeclaration").checked = false;

  openModal("#catalogStatusModal");
}

function confirmCatalogStatus() {
  if (
    !getValue("#newCatalogStatus") ||
    !getValue("#catalogStatusReason") ||
    !isChecked("#catalogStatusDeclaration")
  ) {
    toast("Faltan datos", "Completa nuevo estado, motivo y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Estado actualizado", "El cambio de catálogo fue registrado.", "success");
  renderCatalogsPage();
}

/* =========================================================
   REGLAS SLA
========================================================= */

function initSlaRules() {
  renderSlaRulesPage();

  $("#slaRuleSearch")?.addEventListener("input", renderSlaRulesPage);

  $$("[data-sla-rule-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.slaRuleFilter = button.dataset.slaRuleFilter;
      $$("[data-sla-rule-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderSlaRulesPage();
    });
  });

  $("#toggleSlaRulesViewBtn")?.addEventListener("click", () => {
    State.slaRuleView = State.slaRuleView === "cards" ? "table" : "cards";
    $("#toggleSlaRulesViewBtn").textContent = State.slaRuleView === "cards" ? "Vista tabla" : "Vista cards";
    renderSlaRulesPage();
  });

  $("#openCreateSlaRuleBtn")?.addEventListener("click", openCreateSlaRuleModal);

  $("#refreshSlaRulesBtn")?.addEventListener("click", () => {
    renderSlaRulesPage();
    toast("Reglas actualizadas", "Se actualizó la matriz SLA.", "success");
  });

  $("#exportSlaRulesBtn")?.addEventListener("click", () => {
    genericModal("📤", "Exportación preparada", "Las reglas SLA fueron preparadas para exportación.");
  });

  $("#validateSlaRulesBtn")?.addEventListener("click", () => {
    askBot("Valida inconsistencias SLA");
  });

  $("#refreshSlaPriorityChartBtn")?.addEventListener("click", () => {
    renderSlaCharts();
    toast("Gráfico actualizado", "Se actualizó el SLA por prioridad.", "success");
  });

  $("#refreshSlaStatusChartBtn")?.addEventListener("click", () => {
    renderSlaCharts();
    toast("Estado actualizado", "Se actualizó el estado de reglas SLA.", "success");
  });

  $("#slaRuleEditBtn")?.addEventListener("click", () => {
    closeModals();
    openEditSlaRuleModal(State.selectedSlaRuleId);
  });

  $("#slaRuleDuplicateBtn")?.addEventListener("click", () => {
    closeModals();
    openDuplicateSlaRuleModal(State.selectedSlaRuleId);
  });

  $("#slaRuleAuditBtn")?.addEventListener("click", () => {
    window.location.href = "auditoria.html";
  });

  $("#saveSlaRuleBtn")?.addEventListener("click", confirmSaveSlaRule);

  $("#suggestSlaRuleBtn")?.addEventListener("click", () => {
    const priority = getValue("#slaRulePriority");

    if (priority === "Crítica") {
      $("#slaRuleTime").value = "4 horas";
      $("#slaRuleAlert").value = "1 hora antes";
      $("#slaRuleArea").value = "Soporte técnico";
    } else if (priority === "Alta") {
      $("#slaRuleTime").value = "24 horas";
      $("#slaRuleAlert").value = "4 horas antes";
    } else if (priority === "Media") {
      $("#slaRuleTime").value = "48 horas";
      $("#slaRuleAlert").value = "8 horas antes";
    } else {
      $("#slaRuleTime").value = "72 horas";
      $("#slaRuleAlert").value = "24 horas antes";
    }

    $("#slaRuleStatus").value = "Activo";
    $("#slaRuleDescription").value =
      "La IA sugiere esta configuración considerando prioridad, tiempo de atención, alerta preventiva y área responsable.";

    toast("SLA sugerido", "Se completó una recomendación de regla SLA.", "success");
  });

  renderAi("#slaRulesAiSummary", [
    ["Reglas críticas", "Las incidencias críticas deben tener tiempos cortos y alerta preventiva temprana."],
    ["Inconsistencias", "Evita reglas duplicadas por tipo de caso, prioridad y canal."],
    ["Escalamiento", "Toda regla crítica debe tener área responsable y criterio de alerta."]
  ]);

  renderChecklist("#slaRulesActionPlan", [
    ["1", "Validar duplicados", "Revisar si existe una regla equivalente antes de crear otra."],
    ["2", "Revisar alerta", "La alerta preventiva debe activarse antes del vencimiento real."],
    ["3", "Confirmar área", "Cada regla SLA debe tener responsable claro."]
  ]);
}

function slaRulesFiltered() {
  const query = getValue("#slaRuleSearch").toLowerCase();

  return Mock.slaRules.filter(rule => {
    const text = `${rule.name} ${rule.caseType} ${rule.priority} ${rule.channel} ${rule.time} ${rule.alert} ${rule.area} ${rule.status}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const filter = State.slaRuleFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "reclamos" && rule.caseType === "Reclamo") ||
      (filter === "incidencias" && rule.caseType === "Incidencia") ||
      (filter === "criticas" && rule.priority === "Crítica") ||
      (filter === "activas" && rule.status === "Activo") ||
      (filter === "revision" && rule.status === "En revisión");

    return matchesSearch && matchesFilter;
  });
}

function renderSlaRulesPage() {
  const rows = slaRulesFiltered();

  setText("#slaRulesSummaryTitle", `${Mock.slaRules.length} reglas SLA`);
  setText("#slaRulesSummaryText", `${rows.length} reglas visibles según filtro.`);

  renderKpis("#slaRulesKpiGrid", [
    ["⏱️", Mock.slaRules.length, "Reglas", "Total configurado"],
    ["✅", Mock.slaRules.filter(r => r.status === "Activo").length, "Activas", "En operación"],
    ["🚨", Mock.slaRules.filter(r => r.priority === "Crítica").length, "Críticas", "Atención inmediata"],
    ["🕘", Mock.slaRules.filter(r => r.status === "En revisión").length, "En revisión", "Pendientes"]
  ]);

  renderSlaCharts();

  setHTML("#slaRuleCardList", rows.map(slaRuleCard).join(""));
  setHTML("#slaRuleTableBody", rows.map(slaRuleTableRow).join(""));

  show($("#slaRuleCardList"), State.slaRuleView === "cards");
  show($("#slaRuleTableWrap"), State.slaRuleView === "table");
  show($("#emptySlaRulesState"), !rows.length);

  bindSlaRuleActions($("#slaRuleCardList"));
  bindSlaRuleActions($("#slaRuleTableBody"));
}

function renderSlaCharts() {
  const priorityHours = Mock.slaRules.map(rule => ({
    label: rule.priority,
    value: parseInt(rule.time, 10) || 0
  }));

  const byStatus = countBy(Mock.slaRules, "status");

  renderBarChart("#slaPriorityChart", priorityHours);
  renderDonut("#slaStatusDonut", "#slaStatusLegend", Object.entries(byStatus).map(([label, value]) => ({ label, value })), "Reglas");
}

function slaRuleCard(rule) {
  return `
    <article class="sla-rule-card">
      <div class="sla-rule-card__top">
        <span class="sla-rule-card__icon">${esc(rule.icon)}</span>
        <div>
          <h3>${esc(rule.name)}</h3>
          <p>${esc(rule.description)}</p>
        </div>
        <span class="${pillClass(statusType(rule.status))}">${esc(rule.status)}</span>
      </div>

      <div class="sla-rule-card__meta">
        <span>${esc(rule.caseType)}</span>
        <span>${esc(rule.priority)}</span>
        <span>${esc(rule.channel)}</span>
        <span>${esc(rule.time)}</span>
        <span>Alerta: ${esc(rule.alert)}</span>
        <span>${esc(rule.area)}</span>
      </div>

      <div class="sla-rule-card__actions">
        <button type="button" data-action="view-sla-rule" data-sla-rule-id="${esc(rule.id)}">Ver</button>
        <button type="button" data-action="edit-sla-rule" data-sla-rule-id="${esc(rule.id)}">Editar</button>
        <button type="button" data-action="duplicate-sla-rule" data-sla-rule-id="${esc(rule.id)}">Duplicar</button>
      </div>
    </article>
  `;
}

function slaRuleTableRow(rule) {
  return `
    <tr>
      <td>${esc(rule.name)}</td>
      <td>${esc(rule.caseType)}</td>
      <td>${esc(rule.priority)}</td>
      <td>${esc(rule.channel)}</td>
      <td>${esc(rule.time)}</td>
      <td>${esc(rule.alert)}</td>
      <td><span class="${pillClass(statusType(rule.status))}">${esc(rule.status)}</span></td>
      <td>
        <button type="button" data-action="view-sla-rule" data-sla-rule-id="${esc(rule.id)}">Ver</button>
        <button type="button" data-action="edit-sla-rule" data-sla-rule-id="${esc(rule.id)}">Editar</button>
      </td>
    </tr>
  `;
}

function bindSlaRuleActions(root = document) {
  $$("[data-action='view-sla-rule']", root).forEach(button => {
    button.addEventListener("click", () => openSlaRuleDetail(button.dataset.slaRuleId));
  });

  $$("[data-action='edit-sla-rule']", root).forEach(button => {
    button.addEventListener("click", () => openEditSlaRuleModal(button.dataset.slaRuleId));
  });

  $$("[data-action='duplicate-sla-rule']", root).forEach(button => {
    button.addEventListener("click", () => openDuplicateSlaRuleModal(button.dataset.slaRuleId));
  });
}

function slaRuleSummary(rule) {
  return summaryHTML([
    ["Código", rule.id],
    ["Regla", rule.name],
    ["Tipo de caso", rule.caseType],
    ["Prioridad", rule.priority],
    ["Canal", rule.channel],
    ["Tiempo SLA", rule.time],
    ["Alerta preventiva", rule.alert],
    ["Área responsable", rule.area],
    ["Estado", rule.status]
  ]);
}

function openSlaRuleDetail(id) {
  const rule = getSlaRule(id);
  if (!rule) return;

  State.selectedSlaRuleId = id;

  setText("#slaRuleDetailIcon", rule.icon);
  setText("#slaRuleDetailTitle", rule.name);
  setText("#slaRuleDetailText", rule.description);
  setHTML("#slaRuleDetailSummary", slaRuleSummary(rule));

  openModal("#slaRuleDetailModal");
}

function openCreateSlaRuleModal() {
  State.selectedSlaRuleId = null;

  setText("#slaRuleFormEyebrow", "Nueva regla");
  setText("#slaRuleFormTitle", "Nueva regla SLA");
  setText("#slaRuleFormText", "Define las condiciones y tiempos de atención para la regla SLA.");

  ["#slaRuleName", "#slaRuleDescription"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  [
    "#slaRuleCaseType",
    "#slaRulePriority",
    "#slaRuleChannel",
    "#slaRuleTime",
    "#slaRuleAlert",
    "#slaRuleArea",
    "#slaRuleStatus"
  ].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  if ($("#slaRuleDeclaration")) $("#slaRuleDeclaration").checked = false;

  openModal("#slaRuleFormModal");
}

function openEditSlaRuleModal(id) {
  const rule = getSlaRule(id);
  if (!rule) return;

  State.selectedSlaRuleId = id;

  setText("#slaRuleFormEyebrow", "Editar regla");
  setText("#slaRuleFormTitle", rule.name);
  setText("#slaRuleFormText", "Modifica las condiciones y tiempos de atención de la regla SLA.");

  if ($("#slaRuleName")) $("#slaRuleName").value = rule.name;
  if ($("#slaRuleCaseType")) $("#slaRuleCaseType").value = rule.caseType;
  if ($("#slaRulePriority")) $("#slaRulePriority").value = rule.priority;
  if ($("#slaRuleChannel")) $("#slaRuleChannel").value = rule.channel;
  if ($("#slaRuleTime")) $("#slaRuleTime").value = rule.time;
  if ($("#slaRuleAlert")) $("#slaRuleAlert").value = rule.alert;
  if ($("#slaRuleArea")) $("#slaRuleArea").value = rule.area;
  if ($("#slaRuleStatus")) $("#slaRuleStatus").value = rule.status;
  if ($("#slaRuleDescription")) $("#slaRuleDescription").value = rule.description;
  if ($("#slaRuleDeclaration")) $("#slaRuleDeclaration").checked = false;

  openModal("#slaRuleFormModal");
}

function openDuplicateSlaRuleModal(id) {
  const rule = getSlaRule(id);
  if (!rule) return;

  State.selectedSlaRuleId = null;

  setText("#slaRuleFormEyebrow", "Duplicar regla");
  setText("#slaRuleFormTitle", `Copia de ${rule.name}`);
  setText("#slaRuleFormText", "Ajusta los datos antes de guardar una nueva regla basada en esta configuración.");

  if ($("#slaRuleName")) $("#slaRuleName").value = `Copia de ${rule.name}`;
  if ($("#slaRuleCaseType")) $("#slaRuleCaseType").value = rule.caseType;
  if ($("#slaRulePriority")) $("#slaRulePriority").value = rule.priority;
  if ($("#slaRuleChannel")) $("#slaRuleChannel").value = rule.channel;
  if ($("#slaRuleTime")) $("#slaRuleTime").value = rule.time;
  if ($("#slaRuleAlert")) $("#slaRuleAlert").value = rule.alert;
  if ($("#slaRuleArea")) $("#slaRuleArea").value = rule.area;
  if ($("#slaRuleStatus")) $("#slaRuleStatus").value = "En revisión";
  if ($("#slaRuleDescription")) $("#slaRuleDescription").value = rule.description;
  if ($("#slaRuleDeclaration")) $("#slaRuleDeclaration").checked = false;

  openModal("#slaRuleFormModal");
}

function confirmSaveSlaRule() {
  if (
    !getValue("#slaRuleName") ||
    !getValue("#slaRuleCaseType") ||
    !getValue("#slaRulePriority") ||
    !getValue("#slaRuleChannel") ||
    !getValue("#slaRuleTime") ||
    !getValue("#slaRuleAlert") ||
    !getValue("#slaRuleArea") ||
    !getValue("#slaRuleStatus") ||
    !getValue("#slaRuleDescription") ||
    !isChecked("#slaRuleDeclaration")
  ) {
    toast("Faltan datos", "Completa todos los campos de la regla SLA y confirma la revisión.", "warning");
    return;
  }

  closeModals();
  toast("Regla SLA guardada", "La configuración SLA fue registrada correctamente.", "success");
  renderSlaRulesPage();
}

/* =========================================================
   INDICADORES Y REPORTES
========================================================= */

function initAdminIndicatorsReports() {
  renderAdminIndicatorsPage();

  [
    "#adminIndicatorPeriod",
    "#adminIndicatorModule",
    "#adminIndicatorRole",
    "#adminIndicatorChannel"
  ].forEach(selector => {
    $(selector)?.addEventListener("change", renderAdminIndicatorsPage);
  });

  $("#refreshAdminIndicatorsBtn")?.addEventListener("click", () => {
    renderAdminIndicatorsPage();
    toast("Indicadores actualizados", "Se recalcularon los indicadores administrativos.", "success");
  });

  $("#exportAdminIndicatorsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Indicadores preparados", "Los indicadores fueron preparados para exportación.");
  });

  $("#refreshAdminCaseEvolutionBtn")?.addEventListener("click", () => {
    renderAdminIndicatorCharts();
    toast("Gráfico actualizado", "Se actualizó la evolución de casos.", "success");
  });

  $("#refreshAdminChannelDonutBtn")?.addEventListener("click", () => {
    renderAdminIndicatorCharts();
    toast("Canales actualizados", "Se actualizó la distribución por canal.", "success");
  });

  $("#refreshAdminMetricCardsBtn")?.addEventListener("click", () => {
    renderAdminMetricCards();
    toast("Métricas actualizadas", "Se actualizaron las métricas administrativas.", "success");
  });

  $("#toggleAdminMetricViewBtn")?.addEventListener("click", () => {
    State.adminMetricCompact = !State.adminMetricCompact;
    $("#toggleAdminMetricViewBtn").textContent = State.adminMetricCompact ? "Vista amplia" : "Vista compacta";
    renderAdminMetricCards();
  });

  $("#openAdminReportModalBtn")?.addEventListener("click", openAdminReportModal);
  $("#adminIndicatorReportBtn")?.addEventListener("click", () => {
    closeModals();
    openAdminReportModal();
  });

  $("#compareAdminIndicatorsBtn")?.addEventListener("click", () => {
    genericModal("📊", "Comparación preparada", "Se preparó una comparación contra el periodo anterior.");
  });

  $("#confirmGenerateAdminReportBtn")?.addEventListener("click", confirmGenerateAdminReport);

  $("#suggestAdminReportBtn")?.addEventListener("click", () => {
    $("#adminReportType").value = "Resumen ejecutivo";
    $("#adminReportPeriod").value = "Semana actual";
    $("#adminReportFormat").value = "PDF";
    $("#adminReportScope").value = "Todos los módulos";
    $("#adminReportIncludeCharts").checked = true;
    $("#adminReportIncludeAudit").checked = true;
    $("#adminReportIncludeSla").checked = true;
    $("#adminReportIncludeSecurity").checked = true;
    $("#adminReportComment").value =
      "Reporte sugerido por IA con visión ejecutiva de usuarios, accesos, SLA, integraciones, respaldo y auditoría.";
    toast("Reporte sugerido", "La IA completó una configuración recomendada.", "success");
  });

  $("#refreshAdminReportsBtn")?.addEventListener("click", () => {
    renderAdminReportsTable();
    toast("Reportes actualizados", "Se actualizó la lista de reportes administrativos.", "success");
  });

  $("#scheduleAdminReportBtn")?.addEventListener("click", () => {
    openModal("#scheduleAdminReportModal");
  });

  $("#confirmScheduleAdminReportBtn")?.addEventListener("click", confirmScheduleAdminReport);

  $("#adminIndicatorAiBtn")?.addEventListener("click", () => {
    const metric = getMetric(State.selectedMetricId);
    askBot(`Analiza indicador ${metric?.title || ""}`);
  });

  renderAi("#adminIndicatorsAiSummary", [
    ["Desviación principal", "El SLA global y las integraciones sanas requieren atención administrativa."],
    ["Reporte recomendado", "Generar resumen ejecutivo semanal con indicadores, auditoría, seguridad y respaldo."],
    ["Acción", "Revisar integraciones con error antes de cerrar el reporte ejecutivo."]
  ]);

  renderChecklist("#adminReportActionPlan", [
    ["1", "Incluir KPIs", "Usuarios, casos, SLA, integraciones, reportes y eventos sensibles."],
    ["2", "Agregar gráficos", "Evolución de casos y distribución por canal."],
    ["3", "Cerrar con alertas", "Incluir observaciones administrativas y acciones recomendadas."]
  ]);
}

function renderAdminIndicatorsPage() {
  setText("#adminIndicatorsSummaryTitle", "Indicadores actualizados");
  setText("#adminIndicatorsSummaryText", "Vista administrativa con filtros aplicados.");

  renderKpis("#adminIndicatorsKpiGrid", [
    ["👤", Mock.users.filter(u => u.status === "Activo").length, "Usuarios activos", "Cuentas disponibles"],
    ["📈", "128", "Casos registrados", "Volumen del periodo"],
    ["⏱️", "87%", "SLA global", "Cumplimiento operativo"],
    ["🔌", "3/5", "Integraciones sanas", "Servicios sin alerta"]
  ]);

  renderAdminIndicatorCharts();
  renderAdminMetricCards();
  renderAdminReportsTable();
}

function renderAdminIndicatorCharts() {
  renderBarChart("#adminCaseEvolutionChart", [
    { label: "Lun", value: 18 },
    { label: "Mar", value: 22 },
    { label: "Mié", value: 19 },
    { label: "Jue", value: 31 },
    { label: "Vie", value: 26 },
    { label: "Sáb", value: 12 }
  ]);

  renderDonut("#adminChannelDonut", "#adminChannelLegend", [
    { label: "Portal", value: 42 },
    { label: "Call center", value: 36 },
    { label: "App", value: 31 },
    { label: "Correo", value: 19 }
  ], "Casos");
}

function renderAdminMetricCards() {
  setHTML("#adminMetricGrid", Mock.adminMetrics.map(renderMetricCard).join(""));
  show($("#emptyAdminMetricsState"), !Mock.adminMetrics.length);
  bindMetricButtons($("#adminMetricGrid"));
}

function renderAdminReportsTable() {
  setHTML("#adminReportsTableBody", Mock.reports.map(report => `
    <tr>
      <td>${esc(report.name)}</td>
      <td>${esc(report.type)}</td>
      <td>${esc(report.period)}</td>
      <td>${esc(report.format)}</td>
      <td><span class="${pillClass(statusType(report.status))}">${esc(report.status)}</span></td>
      <td>${esc(report.owner)}</td>
      <td>
        <button type="button" data-admin-report-id="${esc(report.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  $$("[data-admin-report-id]").forEach(button => {
    button.addEventListener("click", () => {
      const report = Mock.reports.find(item => item.id === button.dataset.adminReportId);
      if (!report) return;

      genericModal(
        "📊",
        report.name,
        `Tipo: ${report.type}. Periodo: ${report.period}. Formato: ${report.format}. Estado: ${report.status}.`
      );
    });
  });
}

function openAdminReportModal() {
  [
    "#adminReportType",
    "#adminReportPeriod",
    "#adminReportFormat",
    "#adminReportScope"
  ].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  [
    "#adminReportIncludeCharts",
    "#adminReportIncludeAudit",
    "#adminReportIncludeSla",
    "#adminReportIncludeSecurity"
  ].forEach(selector => {
    if ($(selector)) $(selector).checked = false;
  });

  if ($("#adminReportComment")) $("#adminReportComment").value = "";

  openModal("#adminReportModal");
}

function confirmGenerateAdminReport() {
  if (
    !getValue("#adminReportType") ||
    !getValue("#adminReportPeriod") ||
    !getValue("#adminReportFormat") ||
    !getValue("#adminReportScope")
  ) {
    toast("Faltan datos", "Completa tipo, periodo, formato y alcance del reporte.", "warning");
    return;
  }

  closeModals();
  toast("Reporte generado", "El reporte administrativo fue generado correctamente.", "success");
}

function confirmScheduleAdminReport() {
  if (
    !getValue("#scheduleAdminReportFrequency") ||
    !getValue("#scheduleAdminReportRecipients") ||
    !isChecked("#scheduleAdminReportDeclaration")
  ) {
    toast("Faltan datos", "Completa frecuencia, destinatarios y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Reporte programado", "La programación del reporte fue registrada.", "success");
}

/* =========================================================
   INTEGRACIONES
========================================================= */

function initIntegrations() {
  renderIntegrationsPage();

  $("#integrationSearch")?.addEventListener("input", renderIntegrationsPage);

  $$("[data-integration-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.integrationFilter = button.dataset.integrationFilter;
      $$("[data-integration-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderIntegrationsPage();
    });
  });

  $("#toggleIntegrationsViewBtn")?.addEventListener("click", () => {
    State.integrationView = State.integrationView === "cards" ? "table" : "cards";
    $("#toggleIntegrationsViewBtn").textContent =
      State.integrationView === "cards" ? "Vista tabla" : "Vista cards";
    renderIntegrationsPage();
  });

  $("#openCreateIntegrationBtn")?.addEventListener("click", openCreateIntegrationModal);

  $("#refreshIntegrationsBtn")?.addEventListener("click", () => {
    renderIntegrationsPage();
    toast("Integraciones actualizadas", "Se actualizó el directorio de servicios conectados.", "success");
  });

  $("#exportIntegrationsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Integraciones preparadas", "La información fue preparada para exportación.");
  });

  $("#testAllIntegrationsBtn")?.addEventListener("click", () => {
    genericModal("🔌", "Prueba ejecutada", "Se ejecutó una prueba general de conectividad. Hay servicios con alerta que requieren revisión.");
  });

  $("#refreshIntegrationStatusBtn")?.addEventListener("click", () => {
    renderIntegrationCharts();
    toast("Estado actualizado", "Se actualizó el estado de integraciones.", "success");
  });

  $("#refreshIntegrationSyncBtn")?.addEventListener("click", () => {
    renderIntegrationCharts();
    toast("Sincronización actualizada", "Se actualizó el resumen de sincronizaciones.", "success");
  });

  $("#integrationEditBtn")?.addEventListener("click", () => {
    closeModals();
    openEditIntegrationModal(State.selectedIntegrationId);
  });

  $("#integrationTestBtn")?.addEventListener("click", () => {
    const integration = getIntegration(State.selectedIntegrationId);
    closeModals();

    if (integration?.status === "Error") {
      toast("Prueba con error", `${integration.name} no respondió correctamente.`, "danger");
    } else if (integration?.status === "Con alerta") {
      toast("Prueba con alerta", `${integration.name} respondió con latencia elevada.`, "warning");
    } else {
      toast("Conexión exitosa", `${integration?.name || "La integración"} respondió correctamente.`, "success");
    }
  });

  $("#integrationLogsBtn")?.addEventListener("click", () => {
    closeModals();
    openIntegrationLogsModal(State.selectedIntegrationId);
  });

  $("#saveIntegrationBtn")?.addEventListener("click", confirmSaveIntegration);

  $("#suggestIntegrationBtn")?.addEventListener("click", () => {
    $("#integrationStatus").value = "Activa";
    $("#integrationCriticality").value = "Alta";
    $("#integrationDescription").value =
      "La IA sugiere validar endpoint, criticidad, trazabilidad, responsable técnico y que no existan credenciales visibles.";
    toast("Validación sugerida", "La IA completó una recomendación técnica.", "success");
  });

  $("#exportIntegrationLogsBtn")?.addEventListener("click", () => {
    genericModal("📄", "Logs preparados", "Los logs de integración fueron preparados para exportación.");
  });

  $("#refreshWebhookEventsBtn")?.addEventListener("click", () => {
    renderActivity("#webhookEventsTimeline", Mock.webhooks);
    toast("Eventos actualizados", "Se actualizaron los eventos de webhooks.", "success");
  });

  $("#exportWebhookEventsBtn")?.addEventListener("click", () => {
    genericModal("📤", "Eventos preparados", "Los eventos de webhooks fueron preparados para exportación.");
  });

  renderAi("#integrationsAiSummary", [
    ["Prioridad técnica", "Revisar primero la API de facturación por estar en error y ser de criticidad alta."],
    ["Alerta activa", "El webhook CRM presenta latencia y requiere validación de endpoint o cola de eventos."],
    ["Control recomendado", "Probar conexión, revisar logs y confirmar última sincronización."]
  ]);

  renderChecklist("#integrationsActionPlan", [
    ["1", "Probar conexión", "Ejecutar prueba sobre servicios con error o alerta."],
    ["2", "Revisar logs", "Validar respuesta, latencia y código de error."],
    ["3", "Escalar responsable", "Derivar a responsable técnico si el error persiste."]
  ]);
}

function integrationsFiltered() {
  const query = getValue("#integrationSearch").toLowerCase();

  return Mock.integrations.filter(item => {
    const text = `${item.name} ${item.type} ${item.status} ${item.lastSync} ${item.owner} ${item.criticality} ${item.endpoint}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const filter = State.integrationFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "activas" && item.status === "Activa") ||
      (filter === "alerta" && item.status === "Con alerta") ||
      (filter === "error" && item.status === "Error") ||
      (filter === "api" && item.filterType === "api") ||
      (filter === "webhook" && item.filterType === "webhook") ||
      (filter === "seguridad" && item.filterType === "seguridad");

    return matchesSearch && matchesFilter;
  });
}

function renderIntegrationsPage() {
  const rows = integrationsFiltered();

  setText("#integrationsSummaryTitle", `${Mock.integrations.filter(i => i.status === "Activa").length} integraciones activas`);
  setText("#integrationsSummaryText", `${rows.length} integraciones visibles según filtro.`);

  renderKpis("#integrationsKpiGrid", [
    ["🔌", Mock.integrations.length, "Integraciones", "Servicios configurados"],
    ["✅", Mock.integrations.filter(i => i.status === "Activa").length, "Activas", "Sin observación"],
    ["⚠️", Mock.integrations.filter(i => i.status === "Con alerta").length, "Con alerta", "Requieren revisión"],
    ["🚨", Mock.integrations.filter(i => i.status === "Error").length, "Error", "Atención inmediata"]
  ]);

  renderIntegrationCharts();

  setHTML("#integrationCardList", rows.map(integrationCard).join(""));
  setHTML("#integrationTableBody", rows.map(integrationTableRow).join(""));

  show($("#integrationCardList"), State.integrationView === "cards");
  show($("#integrationTableWrap"), State.integrationView === "table");
  show($("#emptyIntegrationsState"), !rows.length);

  bindIntegrationActions($("#integrationCardList"));
  bindIntegrationActions($("#integrationTableBody"));

  renderActivity("#webhookEventsTimeline", Mock.webhooks);
}

function renderIntegrationCharts() {
  const byStatus = countBy(Mock.integrations, "status");

  renderDonut(
    "#integrationStatusDonut",
    "#integrationStatusLegend",
    Object.entries(byStatus).map(([label, value]) => ({ label, value })),
    "Servicios"
  );

  renderBarChart("#integrationSyncChart", [
    { label: "Éxito", value: 12 },
    { label: "Alerta", value: 3 },
    { label: "Error", value: 1 },
    { label: "Pend.", value: 2 }
  ]);
}

function integrationCard(item) {
  return `
    <article class="integration-card">
      <div class="integration-card__top">
        <span class="integration-card__icon">${esc(item.icon)}</span>
        <div>
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description)}</p>
        </div>
        <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
      </div>

      <div class="integration-card__meta">
        <span>${esc(item.type)}</span>
        <span>${esc(item.criticality)}</span>
        <span>${esc(item.lastSync)}</span>
        <span>${esc(item.owner)}</span>
      </div>

      <div class="integration-card__actions">
        <button type="button" data-action="view-integration" data-integration-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="test-integration" data-integration-id="${esc(item.id)}">Probar</button>
        <button type="button" data-action="logs-integration" data-integration-id="${esc(item.id)}">Logs</button>
      </div>
    </article>
  `;
}

function integrationTableRow(item) {
  return `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.type)}</td>
      <td><span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(item.lastSync)}</td>
      <td>${esc(item.owner)}</td>
      <td>${esc(item.criticality)}</td>
      <td>
        <button type="button" data-action="view-integration" data-integration-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="logs-integration" data-integration-id="${esc(item.id)}">Logs</button>
      </td>
    </tr>
  `;
}

function bindIntegrationActions(root = document) {
  $$("[data-action='view-integration']", root).forEach(button => {
    button.addEventListener("click", () => openIntegrationDetail(button.dataset.integrationId));
  });

  $$("[data-action='test-integration']", root).forEach(button => {
    button.addEventListener("click", () => {
      const integration = getIntegration(button.dataset.integrationId);

      if (integration?.status === "Error") {
        toast("Prueba con error", `${integration.name} no respondió correctamente.`, "danger");
      } else if (integration?.status === "Con alerta") {
        toast("Prueba con alerta", `${integration.name} respondió con latencia elevada.`, "warning");
      } else {
        toast("Conexión exitosa", `${integration?.name || "Integración"} respondió correctamente.`, "success");
      }
    });
  });

  $$("[data-action='logs-integration']", root).forEach(button => {
    button.addEventListener("click", () => openIntegrationLogsModal(button.dataset.integrationId));
  });
}

function integrationSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Nombre", item.name],
    ["Tipo", item.type],
    ["Estado", item.status],
    ["Última sincronización", item.lastSync],
    ["Responsable", item.owner],
    ["Criticidad", item.criticality],
    ["Endpoint", item.endpoint],
    ["Descripción", item.description]
  ]);
}

function openIntegrationDetail(id) {
  const item = getIntegration(id);
  if (!item) return;

  State.selectedIntegrationId = id;

  setText("#integrationDetailIcon", item.icon);
  setText("#integrationDetailTitle", item.name);
  setText("#integrationDetailText", item.description);
  setHTML("#integrationDetailSummary", integrationSummary(item));

  openModal("#integrationDetailModal");
}

function openCreateIntegrationModal() {
  State.selectedIntegrationId = null;

  setText("#integrationFormEyebrow", "Nueva integración");
  setText("#integrationFormTitle", "Nueva integración");
  setText("#integrationFormText", "Registra un servicio externo, API, webhook, autenticación o canal de notificación.");

  ["#integrationName", "#integrationEndpoint", "#integrationDescription"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  ["#integrationType", "#integrationStatus", "#integrationCriticality"].forEach(selector => {
    if ($(selector)) $(selector).value = "";
  });

  if ($("#integrationDeclaration")) $("#integrationDeclaration").checked = false;

  openModal("#integrationFormModal");
}

function openEditIntegrationModal(id) {
  const item = getIntegration(id);
  if (!item) return;

  State.selectedIntegrationId = id;

  setText("#integrationFormEyebrow", "Editar integración");
  setText("#integrationFormTitle", item.name);
  setText("#integrationFormText", "Modifica datos técnicos y estado de la integración.");

  if ($("#integrationName")) $("#integrationName").value = item.name;
  if ($("#integrationType")) $("#integrationType").value = item.type;
  if ($("#integrationStatus")) $("#integrationStatus").value = item.status;
  if ($("#integrationCriticality")) $("#integrationCriticality").value = item.criticality;
  if ($("#integrationEndpoint")) $("#integrationEndpoint").value = item.endpoint;
  if ($("#integrationDescription")) $("#integrationDescription").value = item.description;
  if ($("#integrationDeclaration")) $("#integrationDeclaration").checked = false;

  openModal("#integrationFormModal");
}

function confirmSaveIntegration() {
  if (
    !getValue("#integrationName") ||
    !getValue("#integrationType") ||
    !getValue("#integrationStatus") ||
    !getValue("#integrationCriticality") ||
    !getValue("#integrationEndpoint") ||
    !getValue("#integrationDescription") ||
    !isChecked("#integrationDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, tipo, estado, criticidad, endpoint, descripción y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Integración guardada", "La integración fue registrada correctamente.", "success");
  renderIntegrationsPage();
}

function openIntegrationLogsModal(id) {
  const item = getIntegration(id);
  if (!item) return;

  State.selectedIntegrationId = id;

  setText("#integrationLogsTitle", `Eventos de ${item.name}`);

  renderActivity("#integrationLogsTimeline", [
    {
      icon: item.status === "Error" ? "🚨" : "✅",
      title: "Prueba de conexión",
      text: item.status === "Error" ? "Servicio no respondió correctamente." : "Servicio respondió correctamente.",
      date: item.lastSync
    },
    {
      icon: "📄",
      title: "Endpoint revisado",
      text: item.endpoint,
      date: "Registro técnico"
    },
    {
      icon: "🔐",
      title: "Validación de seguridad",
      text: "No se muestran credenciales en pantalla.",
      date: "Control interno"
    }
  ]);

  openModal("#integrationLogsModal");
}

/* =========================================================
   AUDITORÍA ADMIN
========================================================= */

function initAdminAudit() {
  renderAdminAuditPage();

  $("#adminAuditSearch")?.addEventListener("input", renderAdminAuditPage);

  $$("[data-admin-audit-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.auditFilter = button.dataset.adminAuditFilter;
      $$("[data-admin-audit-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAdminAuditPage();
    });
  });

  $("#refreshAuditTypeChartBtn")?.addEventListener("click", () => {
    renderAdminAuditCharts();
    toast("Gráfico actualizado", "Se actualizó la actividad auditable.", "success");
  });

  $("#refreshAuditRiskBtn")?.addEventListener("click", () => {
    renderAdminAuditRisk();
    toast("Riesgos actualizados", "Se actualizaron los eventos críticos.", "success");
  });

  $("#refreshAuditEventsBtn")?.addEventListener("click", () => {
    renderAdminAuditPage();
    toast("Auditoría actualizada", "Se actualizaron los eventos administrativos.", "success");
  });

  $("#exportAdminAuditBtn")?.addEventListener("click", () => {
    genericModal("📤", "Auditoría preparada", "La auditoría administrativa fue preparada para exportación.");
  });

  $("#downloadAuditEventsBtn")?.addEventListener("click", () => {
    genericModal("📄", "Descarga preparada", "Los eventos auditables fueron preparados para descarga.");
  });

  $("#compareAuditEventsBtn")?.addEventListener("click", () => {
    openModal("#adminAuditCompareModal");
  });

  $("#adminAuditDownloadDetailBtn")?.addEventListener("click", () => {
    genericModal("📄", "Detalle preparado", "El detalle auditable fue preparado para descarga.");
  });

  $("#adminAuditCompareDetailBtn")?.addEventListener("click", () => {
    closeModals();
    openModal("#adminAuditCompareModal");
  });

  $("#confirmAdminAuditCompareBtn")?.addEventListener("click", confirmAdminAuditCompare);

  renderAi("#adminAuditAiSummary", [
    ["Eventos sensibles", "Revisar cambios de usuarios, permisos, reglas SLA e integraciones."],
    ["Mayor riesgo", "La API de facturación pasó a error y debe asociarse al seguimiento técnico."],
    ["Control", "Toda modificación administrativa debe conservar antes, después, usuario, fecha e IP."]
  ]);

  renderChecklist("#adminAuditActionPlan", [
    ["1", "Filtrar críticos", "Revisar eventos sensibles de seguridad y configuración."],
    ["2", "Comparar cambios", "Validar antes y después en roles, SLA e integraciones."],
    ["3", "Exportar evidencia", "Descargar trazabilidad para respaldo formal."]
  ]);
}

function auditIcon(type) {
  const icons = {
    usuarios: "👤",
    roles: "🔐",
    catalogos: "🧩",
    sla: "⏱️",
    integraciones: "🔌",
    configuracion: "⚙️"
  };

  return icons[type] || "🕵️";
}

function adminAuditFiltered() {
  const query = getValue("#adminAuditSearch").toLowerCase();

  return Mock.audit.filter(item => {
    const text = `${item.date} ${item.module} ${item.type} ${item.action} ${item.user} ${item.before} ${item.after} ${item.result} ${item.detail}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const matchesFilter =
      State.auditFilter === "todos" ||
      item.type === State.auditFilter ||
      (State.auditFilter === "criticos" && item.critical);

    return matchesSearch && matchesFilter;
  });
}

function renderAdminAuditPage() {
  const rows = adminAuditFiltered();

  setText("#auditSummaryTitle", `${rows.length} eventos visibles`);
  setText("#auditSummaryText", `Filtro actual: ${State.auditFilter}.`);

  renderKpis("#adminAuditKpiGrid", [
    ["🕵️", Mock.audit.length, "Eventos", "Total registrado"],
    ["⚠️", Mock.audit.filter(a => a.critical).length, "Críticos", "Impacto sensible"],
    ["👤", Mock.audit.filter(a => a.type === "usuarios").length, "Usuarios", "Cambios de cuenta"],
    ["🔌", Mock.audit.filter(a => a.type === "integraciones").length, "Integraciones", "Eventos técnicos"]
  ]);

  renderAdminAuditCharts();
  renderAdminAuditRisk();
  renderAdminAuditTable(rows);
}

function renderAdminAuditCharts() {
  const byModule = countBy(Mock.audit, "module");
  renderBarChart("#adminAuditTypeChart", Object.entries(byModule).map(([label, value]) => ({ label, value })));
}

function renderAdminAuditRisk() {
  const rows = Mock.audit.filter(item => item.critical);

  setHTML("#adminAuditRiskList", rows.map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">${auditIcon(item.type)}</span>
      <div>
        <strong>${esc(item.action)} · ${esc(item.module)}</strong>
        <p>${esc(item.detail)}</p>
        <small>${esc(item.date)} · Usuario: ${esc(item.user)}</small>
      </div>
      <button type="button" data-admin-audit-id="${esc(item.id)}">Ver</button>
    </article>
  `).join(""));

  $$("[data-admin-audit-id]").forEach(button => {
    button.addEventListener("click", () => openAdminAuditDetail(button.dataset.adminAuditId));
  });
}

function renderAdminAuditTable(rows) {
  setHTML("#adminAuditTableBody", rows.map(item => `
    <tr>
      <td>${esc(item.date)}</td>
      <td>${esc(item.module)}</td>
      <td>${esc(item.action)}</td>
      <td>${esc(item.user)}</td>
      <td>${esc(item.before)}</td>
      <td>${esc(item.after)}</td>
      <td><span class="${pillClass(statusType(item.result))}">${esc(item.result)}</span></td>
      <td>
        <button type="button" data-admin-audit-id="${esc(item.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  show($("#emptyAdminAuditState"), !rows.length);

  $$("[data-admin-audit-id]").forEach(button => {
    button.addEventListener("click", () => openAdminAuditDetail(button.dataset.adminAuditId));
  });
}

function openAdminAuditDetail(id) {
  const item = getAudit(id);
  if (!item) return;

  State.selectedAuditId = id;

  setText("#adminAuditDetailIcon", auditIcon(item.type));
  setText("#adminAuditDetailTitle", `${item.action} · ${item.module}`);
  setText("#adminAuditDetailText", item.detail);

  setHTML("#adminAuditDetailSummary", summaryHTML([
    ["Fecha", item.date],
    ["Módulo", item.module],
    ["Acción", item.action],
    ["Usuario", item.user],
    ["Antes", item.before],
    ["Después", item.after],
    ["Resultado", item.result],
    ["IP", item.ip],
    ["Crítico", item.critical ? "Sí" : "No"]
  ]));

  openModal("#adminAuditDetailModal");
}

function confirmAdminAuditCompare() {
  if (
    !getValue("#adminAuditCompareModule") ||
    !getValue("#adminAuditCompareType") ||
    !isChecked("#adminAuditCompareDeclaration")
  ) {
    toast("Faltan datos", "Completa módulo, tipo de comparación y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Comparación preparada", "Se generó la comparación de eventos administrativos.", "success");
}

/* =========================================================
   RESPALDO
========================================================= */

function initBackup() {
  renderBackupPage();

  $("#backupSearch")?.addEventListener("input", renderBackupPage);

  $$("[data-backup-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.backupFilter = button.dataset.backupFilter;
      $$("[data-backup-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderBackupPage();
    });
  });

  $("#runBackupNowBtn")?.addEventListener("click", () => {
    genericModal("💾", "Respaldo iniciado", "Se inició una copia incremental manual. El resultado quedará registrado en el historial.");
  });

  $("#scheduleBackupBtn")?.addEventListener("click", () => {
    openModal("#scheduleBackupModal");
  });

  $("#confirmScheduleBackupBtn")?.addEventListener("click", confirmScheduleBackup);

  $("#refreshBackupChartBtn")?.addEventListener("click", () => {
    renderBackupCharts();
    toast("Gráfico actualizado", "Se actualizó el historial semanal de respaldos.", "success");
  });

  $("#refreshBackupStatusBtn")?.addEventListener("click", () => {
    renderBackupCharts();
    toast("Estado actualizado", "Se actualizó el estado de copias.", "success");
  });

  $("#refreshBackupHistoryBtn")?.addEventListener("click", () => {
    renderBackupPage();
    toast("Historial actualizado", "Se actualizó el historial de respaldo.", "success");
  });

  $("#validateBackupBtn")?.addEventListener("click", () => {
    toast("Validación iniciada", "Se inició la validación del último respaldo completado.", "success");
  });

  $("#exportBackupHistoryBtn")?.addEventListener("click", () => {
    genericModal("📤", "Historial preparado", "El historial de respaldos fue preparado para exportación.");
  });

  $("#backupValidateBtn")?.addEventListener("click", () => {
    closeModals();
    toast("Validación iniciada", "Se inició la validación de la copia seleccionada.", "success");
  });

  $("#backupRestoreBtn")?.addEventListener("click", () => {
    closeModals();
    openModal("#restoreTestModal");
  });

  $("#backupDownloadLogBtn")?.addEventListener("click", () => {
    genericModal("📄", "Log preparado", "El log del respaldo fue preparado para descarga.");
  });

  $("#openRestoreTestBtn")?.addEventListener("click", () => {
    openModal("#restoreTestModal");
  });

  $("#confirmRestoreTestBtn")?.addEventListener("click", confirmRestoreTest);

  $("#refreshRestoreTimelineBtn")?.addEventListener("click", () => {
    renderActivity("#restoreTimeline", Mock.restoreEvents);
    toast("Restauración actualizada", "Se actualizaron eventos de restauración.", "success");
  });

  renderAi("#backupAiSummary", [
    ["Estado general", "El último respaldo fue completado y verificado, pero existe una falla reciente a revisar."],
    ["Revisión sugerida", "Validar copia más reciente y programar prueba de restauración parcial."],
    ["Continuidad", "Mantener respaldo incremental diario y completo semanal."]
  ]);

  renderChecklist("#backupActionPlan", [
    ["1", "Validar último respaldo", "Confirmar integridad de la copia más reciente."],
    ["2", "Revisar falla", "Analizar causa del respaldo fallido."],
    ["3", "Probar restauración", "Programar prueba parcial en ambiente no productivo."]
  ]);
}

function backupFiltered() {
  const query = getValue("#backupSearch").toLowerCase();

  return Mock.backups.filter(item => {
    const text = `${item.date} ${item.type} ${item.status} ${item.size} ${item.location} ${item.validation}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);

    const filter = State.backupFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "completados" && item.status === "Completado") ||
      (filter === "fallidos" && item.status === "Fallido") ||
      (filter === "programados" && item.status === "Programado") ||
      (filter === "verificados" && item.validation === "Verificado");

    return matchesSearch && matchesFilter;
  });
}

function renderBackupPage() {
  const rows = backupFiltered();

  setText("#backupSummaryTitle", "Respaldo disponible");
  setText("#backupSummaryText", `${rows.length} copias visibles según filtro.`);

  renderKpis("#backupKpiGrid", [
    ["💾", Mock.backups.length, "Copias", "Historial total"],
    ["✅", Mock.backups.filter(b => b.status === "Completado").length, "Completados", "Copias exitosas"],
    ["🚨", Mock.backups.filter(b => b.status === "Fallido").length, "Fallidos", "Requieren revisión"],
    ["🧪", Mock.backups.filter(b => b.validation === "Verificado").length, "Verificados", "Recuperables"]
  ]);

  renderBackupCharts();
  renderBackupTable(rows);
  renderActivity("#restoreTimeline", Mock.restoreEvents);
}

function renderBackupCharts() {
  renderBarChart("#backupWeeklyChart", [
    { label: "Lun", value: 1 },
    { label: "Mar", value: 1 },
    { label: "Mié", value: 1 },
    { label: "Jue", value: 0 },
    { label: "Vie", value: 1 },
    { label: "Sáb", value: 1 }
  ]);

  const byStatus = countBy(Mock.backups, "status");

  renderDonut(
    "#backupStatusDonut",
    "#backupStatusLegend",
    Object.entries(byStatus).map(([label, value]) => ({ label, value })),
    "Copias"
  );
}

function renderBackupTable(rows) {
  setHTML("#backupTableBody", rows.map(item => `
    <tr>
      <td>${esc(item.date)}</td>
      <td>${esc(item.type)}</td>
      <td><span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(item.size)}</td>
      <td>${esc(item.location)}</td>
      <td>${esc(item.validation)}</td>
      <td>
        <button type="button" data-backup-id="${esc(item.id)}">Ver</button>
      </td>
    </tr>
  `).join(""));

  show($("#emptyBackupState"), !rows.length);

  $$("[data-backup-id]").forEach(button => {
    button.addEventListener("click", () => openBackupDetail(button.dataset.backupId));
  });
}

function backupSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Fecha", item.date],
    ["Tipo", item.type],
    ["Estado", item.status],
    ["Tamaño", item.size],
    ["Ubicación", item.location],
    ["Validación", item.validation],
    ["Responsable", item.owner]
  ]);
}

function openBackupDetail(id) {
  const item = getBackup(id);
  if (!item) return;

  State.selectedBackupId = id;

  setText("#backupDetailIcon", item.status === "Fallido" ? "🚨" : "💾");
  setText("#backupDetailTitle", `${item.type} · ${item.date}`);
  setText("#backupDetailText", `Estado: ${item.status}. Validación: ${item.validation}.`);
  setHTML("#backupDetailSummary", backupSummary(item));

  openModal("#backupDetailModal");
}

function confirmScheduleBackup() {
  if (
    !getValue("#backupFrequency") ||
    !getValue("#backupType") ||
    !getValue("#backupWindow") ||
    !getValue("#backupRetention") ||
    !isChecked("#backupScheduleDeclaration")
  ) {
    toast("Faltan datos", "Completa frecuencia, tipo, ventana, retención y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Respaldo programado", "La programación fue registrada correctamente.", "success");
}

function confirmRestoreTest() {
  if (
    !getValue("#restoreTestType") ||
    !getValue("#restoreEnvironment") ||
    !isChecked("#restoreTestDeclaration")
  ) {
    toast("Faltan datos", "Completa tipo de prueba, ambiente y confirmación.", "warning");
    return;
  }

  closeModals();
  toast("Prueba programada", "La prueba de restauración fue registrada.", "success");
}

/* =========================================================
   CONFIGURACIÓN DEL SISTEMA
========================================================= */

function initSystemConfig() {
  renderSystemConfigPage();

  $("#saveSystemConfigBtn")?.addEventListener("click", () => {
    openModal("#confirmSystemConfigModal");
  });

  $("#confirmSaveSystemConfigBtn")?.addEventListener("click", confirmSaveSystemConfig);

  $("#restoreSystemConfigBtn")?.addEventListener("click", () => {
    genericModal("↩", "Valores restaurados", "Se restauraron los valores recomendados del sistema.");
  });

  $("#refreshSystemConfigBtn")?.addEventListener("click", () => {
    renderSystemConfigPage();
    toast("Configuración actualizada", "Se actualizó la vista de configuración.", "success");
  });

  $("#exportSystemConfigBtn")?.addEventListener("click", () => {
    genericModal("📤", "Configuración preparada", "Los parámetros del sistema fueron preparados para exportación.");
  });

  renderAi("#systemConfigAiSummary", [
    ["Seguridad", "Mantener contraseña fuerte, intentos fallidos limitados y revisar MFA para perfiles administrativos."],
    ["Notificaciones", "Las alertas de SLA, usuarios bloqueados, integraciones y respaldo están activas."],
    ["Mantenimiento", "Mantener modo mantenimiento desactivado salvo ventana programada."]
  ]);

  renderChecklist("#systemConfigActionPlan", [
    ["1", "Validar sesión", "Revisar expiración y política de intentos fallidos."],
    ["2", "Revisar alertas", "Confirmar notificaciones críticas activas."],
    ["3", "Guardar con control", "Todo cambio debe quedar registrado en auditoría."]
  ]);
}

function renderSystemConfigPage() {
  setText("#systemConfigSummaryTitle", "Configuración activa");
  setText("#systemConfigSummaryText", "Parámetros listos para revisión.");

  renderKpis("#systemConfigKpiGrid", [
    ["🔐", "Fuerte", "Contraseña", "Política activa"],
    ["🕘", "30 min", "Sesión", "Expiración"],
    ["🔔", "4", "Alertas", "Notificaciones críticas"],
    ["🛠️", "Off", "Mantenimiento", "Modo actual"]
  ]);
}

function confirmSaveSystemConfig() {
  if (!isChecked("#systemConfigDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste los cambios.", "warning");
    return;
  }

  closeModals();
  toast("Configuración guardada", "Los parámetros globales fueron actualizados correctamente.", "success");
}