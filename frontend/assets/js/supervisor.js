"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - SUPERVISOR.JS
   Versión consolidada para módulo Supervisor
   Frontend conectado a FastAPI + SQL Server
   No usa mock. No toca login. No reemplaza auth.
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const State = {
  page: document.body.dataset.page || "",
  config: {},
  theme:
    localStorage.getItem("claro360-supervisor-theme") ||
    localStorage.getItem("claro360-theme") ||
    "light",

  user: null,
  supervisor: null,
  permissions: new Set(),

  catalogs: {},
  cases: [],
  advisors: [],
  indicators: [],
  reports: [],
  audit: [],
  configRules: [],
  routeRules: [],

  selectedCaseId: null,
  selectedAdvisorId: null,
  selectedIndicatorId: null,
  selectedReportId: null,
  selectedAuditId: null,
  selectedConfigRuleId: null,

  selections: {
    pending: new Set(),
    assignments: new Set(),
    advisors: new Set(),
    sla: new Set()
  },

  pagination: {
    pending: { page: 1, pageSize: 20, total: 0 },
    assignments: { page: 1, pageSize: 20, total: 0 },
    advisors: { page: 1, pageSize: 20, total: 0 },
    sla: { page: 1, pageSize: 20, total: 0 },
    advisorPerformance: { page: 1, pageSize: 20, total: 0 }
  },

  views: {
    pending: "cards",
    assignments: "cards",
    advisors: "cards",
    sla: "cards",
    indicatorsCompact: false
  },

  filters: {
    pending: "todos",
    assignments: "todos",
    advisors: "todos",
    sla: "todos",
    audit: "todos",
    config: "todos"
  },

  confirmHandler: null,
  lastMassAssignmentPreview: null,
  lastRedistributionPreview: null,
  lastMassSlaAlertPreview: null,
  lastIndicatorComparison: null
};

/* =========================================================
   SELECTORES / HELPERS DOM
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
  const element = $(selector);
  if (element) element.textContent = value ?? "";
}

function setHTML(selector, value) {
  const element = $(selector);
  if (element) element.innerHTML = value ?? "";
}

function getValue(selector) {
  return $(selector)?.value?.trim() || "";
}

function setValue(selector, value) {
  const element = $(selector);
  if (element) element.value = value ?? "";
}

function isChecked(selector) {
  return Boolean($(selector)?.checked);
}

function show(elementOrSelector, condition) {
  const element =
    typeof elementOrSelector === "string"
      ? $(elementOrSelector)
      : elementOrSelector;

  if (!element) return;
  element.classList.toggle("hidden", !condition);
}

function resetForm(selector) {
  const form = $(selector);
  if (form) form.reset();
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function todayStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "todos" &&
      value !== "todas"
    ) {
      query.append(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

function safeFileName(value, fallback = "archivo") {
  return String(value || fallback)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

function initials(name) {
  return String(name || "Supervisor")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "SU";
}

/* =========================================================
   CONFIGURACIÓN POR PÁGINA
========================================================= */

function readPageConfig() {
  const configNode = $("#supervisorPageConfig");

  if (!configNode) {
    State.config = {
      page: State.page,
      module: State.page,
      mainEndpoint: endpointByPage(State.page),
      catalogEndpoint: "/supervisor/catalogos",
      exportEndpoint: "/supervisor/exportar"
    };

    return State.config;
  }

  try {
    State.config = JSON.parse(configNode.textContent || "{}");
  } catch {
    State.config = {};
  }

  State.config.page = State.config.page || State.page;
  State.config.mainEndpoint = State.config.mainEndpoint || endpointByPage(State.page);
  State.config.catalogEndpoint = State.config.catalogEndpoint || "/supervisor/catalogos";
  State.config.exportEndpoint = State.config.exportEndpoint || "/supervisor/exportar";

  return State.config;
}

function endpointByPage(page) {
  const map = {
    "supervisor-dashboard": "/supervisor/dashboard",
    "supervisor-casos-pendientes": "/supervisor/casos-pendientes",
    "supervisor-asignaciones": "/supervisor/asignaciones",
    "supervisor-carga-asesores": "/supervisor/carga-asesores",
    "supervisor-monitoreo-sla": "/supervisor/monitoreo-sla",
    "supervisor-indicadores": "/supervisor/indicadores",
    "supervisor-reportes": "/supervisor/reportes",
    "supervisor-auditoria-casos": "/supervisor/auditoria",
    "supervisor-configuracion-supervision": "/supervisor/configuracion"
  };

  return map[page] || "/supervisor/dashboard";
}

/* =========================================================
   SESIÓN / API
========================================================= */

function getToken() {
  return localStorage.getItem("claro360-access-token") || "";
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("claro360-user") || "{}");
  } catch {
    return {};
  }
}

function clearSession() {
  localStorage.removeItem("claro360-access-token");
  localStorage.removeItem("claro360-refresh-token");
  localStorage.removeItem("claro360-user");
  localStorage.removeItem("claro360-role");
  localStorage.removeItem("claro360-client-type");
  localStorage.removeItem("claro360-selected-role");
  localStorage.removeItem("claro360-supervisor-selected-case");
}

function requireSupervisorSession() {
  const token = getToken();
  const storedUser = getStoredUser();

  if (!token || !storedUser?.rol) {
    window.location.href = "../login.html?role=supervisor";
    return false;
  }

  if (storedUser.rol !== "SUPERVISOR") {
    clearSession();
    window.location.href = "../login.html?role=supervisor";
    return false;
  }

  State.user = storedUser;
  return true;
}

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";
  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item.msg || item.message || "Dato inválido")
      .join(" ");
  }

  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  return "No se pudo completar la operación.";
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok) {
    let data = {};

    try {
      data = contentType.includes("application/json")
        ? await response.json()
        : { detail: await response.text() };
    } catch {
      data = {};
    }

    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = "../login.html?role=supervisor";
      return {};
    }

    throw new Error(getApiErrorMessage(data));
  }

  if (contentType.includes("application/json")) {
    return await response.json();
  }

  if (contentType.includes("application/octet-stream") || contentType.includes("application/pdf")) {
    return await response.blob();
  }

  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizePayload(response = {}) {
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return response.data;
  }

  if (response?.payload && typeof response.payload === "object" && !Array.isArray(response.payload)) {
    return response.payload;
  }

  if (response?.result && typeof response.result === "object" && !Array.isArray(response.result)) {
    return response.result;
  }

  return response || {};
}

function listFrom(response = {}, keys = []) {
  const sources = [
    response,
    response?.data,
    response?.payload,
    response?.result,
    response?.resultado,
    response?.dashboard
  ].filter(Boolean);

  for (const source of sources) {
    for (const key of keys) {
      if (Array.isArray(source?.[key])) return source[key];
    }
  }

  return [];
}

/* =========================================================
   TOASTS / TEMA / UI BASE
========================================================= */

function toast(title, message, type = "info") {
  const box = $("#toastContainer");

  if (!box) return;

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
    setTimeout(() => item.remove(), 250);
  }, 3500);
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-supervisor-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function setupBaseUI() {
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

  $("#userMenuButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
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

function logout() {
  clearSession();
  toast("Sesión cerrada", "Serás redirigido al login.", "success");

  setTimeout(() => {
    window.location.href = "../login.html?role=supervisor";
  }, 650);
}

function setupUserFromStorage() {
  const user = State.user || getStoredUser();
  const name = user.nombre || user.name || user.username || "Supervisor";

  setText("#userNameTop", name);
  setText("#userRoleTop", "Supervisor de Atención");
  setText("#userAvatar", initials(name));
}

/* =========================================================
   MODALES / CONFIRMACIÓN CENTRAL
========================================================= */

function setupModalEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) closeModals();
  });

  $("#modalBackdrop")?.addEventListener("click", closeModals);

  document.addEventListener("keydown", (event) => {
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
    toast("Ventana no disponible", `No existe ${selector} en esta pantalla.`, "warning");
    return;
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  $("#modalBackdrop")?.classList.add("show");
  document.body.classList.add("modal-open");
}

function closeModals() {
  $$(".modal").forEach((modal) => {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  });

  $("#modalBackdrop")?.classList.remove("show");
  document.body.classList.remove("modal-open");

  State.confirmHandler = null;

  const declaration = $("#confirmActionDeclaration");
  if (declaration) declaration.checked = false;
}

function genericModal(icon, title, text) {
  setText("#genericModalIcon", icon);
  setText("#genericModalTitle", title);
  setText("#genericModalText", text);
  openModal("#genericModal");
}

function summaryHTML(items = []) {
  return items.map(([label, value]) => `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>
  `).join("");
}

function openConfirmAction({
  icon = "⚠️",
  eyebrow = "Confirmación requerida",
  title = "Confirmar acción",
  text = "Revisa la información antes de continuar.",
  summary = "",
  declaration = "Confirmo que deseo ejecutar esta acción.",
  onConfirm
}) {
  if (!$("#confirmActionModal")) {
    if (typeof onConfirm === "function") onConfirm();
    return;
  }

  State.confirmHandler = onConfirm;

  setText("#confirmActionIcon", icon);
  setText("#confirmActionEyebrow", eyebrow);
  setText("#confirmActionTitle", title);
  setText("#confirmActionText", text);
  setHTML("#confirmActionSummary", summary);
  setText("#confirmActionDeclarationText", declaration);

  const checkbox = $("#confirmActionDeclaration");
  if (checkbox) checkbox.checked = false;

  openModal("#confirmActionModal");
}

function setupConfirmActionModal() {
  $("#confirmActionAcceptBtn")?.addEventListener("click", async () => {
    if (!isChecked("#confirmActionDeclaration")) {
      toast("Confirmación requerida", "Marca la declaración antes de continuar.", "warning");
      return;
    }

    const handler = State.confirmHandler;

    if (typeof handler !== "function") {
      closeModals();
      return;
    }

    try {
      await handler();
    } catch (error) {
      genericModal("!", "No se pudo completar la acción", error.message);
    }
  });
}

/* =========================================================
   PERMISOS
========================================================= */

function setPermissions(rawPermissions = []) {
  const values = Array.isArray(rawPermissions) ? rawPermissions : [];
  State.permissions = new Set(values.map(String));

  applyPermissions();
}

function hasPermission(permission) {
  if (!permission) return true;
  if (!State.permissions.size) return true;
  return State.permissions.has(permission);
}

function applyPermissions() {
  $$("[data-permission]").forEach((element) => {
    const permission = element.dataset.permission;

    if (!hasPermission(permission)) {
      element.classList.add("hidden");
      element.setAttribute("aria-hidden", "true");
      element.disabled = true;
    }
  });
}

/* =========================================================
   CATÁLOGOS DESDE BD
========================================================= */

async function loadCatalogs() {
  const endpoint = State.config.catalogEndpoint || "/supervisor/catalogos";

  try {
    const response = await apiRequest(endpoint);
    const payload = normalizePayload(response);

    State.catalogs = payload.catalogs || payload.catalogos || payload;

    populateCatalogSelects();
  } catch (error) {
    toast("Catálogos no disponibles", error.message, "warning");
  }
}

function getCatalogItems(name) {
  const data = State.catalogs || {};
  const list = data[name];

  if (Array.isArray(list)) return list;

  return [];
}

function optionValue(item) {
  return item.value ?? item.valor ?? item.id ?? item.codigo ?? item.code ?? item.nombre ?? item.name ?? "";
}

function optionText(item) {
  return item.label ?? item.text ?? item.nombre ?? item.name ?? item.descripcion ?? item.value ?? item.valor ?? "";
}

function populateCatalogSelects() {
  $$("select[data-catalog]").forEach((select) => {
    const catalogName = select.dataset.catalog;
    const items = getCatalogItems(catalogName);

    if (!items.length) return;

    const currentValue = select.value;
    const placeholder = select.querySelector("option")?.outerHTML || `<option value="">Seleccionar</option>`;

    select.innerHTML = placeholder + items.map((item) => {
      const value = optionValue(item);
      const text = optionText(item);
      const disabled = item.disabled || item.activo === false ? "disabled" : "";

      return `<option value="${esc(value)}" ${disabled}>${esc(text)}</option>`;
    }).join("");

    if (currentValue) select.value = currentValue;
  });
}

/* =========================================================
   NORMALIZADORES
========================================================= */

function priorityValue(priority) {
  const value = String(priority || "").toLowerCase();

  if (value.includes("crítica") || value.includes("critica")) return 4;
  if (value.includes("alta")) return 3;
  if (value.includes("media")) return 2;

  return 1;
}

function normalizeCase(item = {}) {
  const rawDeadline =
    item.fecha_limite_resolucion ||
    item.deadline ||
    item.sla_deadline ||
    item.slaDeadline;

  const deadline = rawDeadline ? new Date(rawDeadline) : null;

  const calculatedHours =
    deadline && !Number.isNaN(deadline.getTime())
      ? Math.ceil((deadline - new Date()) / 3600000)
      : Number(item.slaHours ?? item.sla_hours ?? item.horas_sla ?? 999);

  const status = item.status || item.estado || item.estado_caso || "Nuevo";
  const advisorName =
    item.advisorName ||
    item.asesor_nombre ||
    item.asesor ||
    item.responsable ||
    "Sin asignar";

  const advisorId =
    item.advisorId ||
    item.asesor_id ||
    item.responsable_actual_usuario_id ||
    item.responsable_id ||
    null;

  const priority = item.priority || item.prioridad || "Media";
  const type = item.type || item.tipo_caso || item.tipo || "Caso";
  const id = item.id || item.case_id || item.caso_id || item.codigo_caso || item.codigo || "-";
  const code = item.code || item.codigo_caso || item.codigo || id;

  const assigned =
    Boolean(advisorId) ||
    !["", "Sin asignar", "No asignado", null, undefined].includes(advisorName);

  const classificationStatus =
    item.classificationStatus ||
    item.estado_clasificacion ||
    item.clasificacion ||
    (type === "Caso" ? "Sin clasificar" : "Clasificado");

  const assignmentStatus =
    item.assignmentStatus ||
    item.estado_asignacion ||
    (assigned ? "Asignado" : "Sin asesor");

  const derived =
    Boolean(item.derived ?? item.derivado) ||
    String(status).toLowerCase().includes("derivado");

  const escalated =
    Boolean(item.escalated ?? item.escalado) ||
    String(status).toLowerCase().includes("escalado");

  const observed =
    Boolean(item.observed ?? item.observado) ||
    String(status).toLowerCase().includes("observado");

  const blocked =
    Boolean(item.blocked ?? item.bloqueado) ||
    String(status).toLowerCase().includes("bloqueado") ||
    String(status).toLowerCase().includes("pendiente");

  const slaGroup =
    item.slaGroup ||
    item.sla_group ||
    (
      calculatedHours < 0 ? "vencido" :
      calculatedHours <= 8 ? "vence_hoy" :
      calculatedHours <= 24 ? "vence_manana" :
      "semana"
    );

  return {
    id,
    caseId: id,
    code,
    icon:
      item.icon ||
      item.icono ||
      (type === "Incidencia" ? "⚠️" : priorityValue(priority) === 4 ? "🔥" : "📝"),
    type,
    clientName:
      item.clientName ||
      item.cliente_nombre ||
      item.cliente ||
      item.nombre_cliente ||
      "Cliente",
    clientType: item.clientType || item.tipo_cliente || "Cliente",
    channel: item.channel || item.canal || "Portal cliente",
    service: item.service || item.servicio || item.servicio_nombre || "Servicio asociado",
    title: item.title || item.titulo || code,
    description: item.description || item.descripcion || item.detalle || "",
    status,
    classificationStatus,
    assignmentStatus,
    assignmentFlow:
      item.assignmentFlow ||
      item.flujo_asignacion ||
      (escalated ? "Escalado" : derived ? "Derivado" : assigned ? "Asignado" : "Pendiente asignación"),
    advisorId,
    advisorName,
    area: item.area || item.area_nombre || item.cola || "Mesa de entrada",
    priority,
    slaHours: calculatedHours,
    slaText:
      item.slaText ||
      item.sla ||
      item.sla_text ||
      (calculatedHours < 0 ? "Vencido" : calculatedHours === 999 ? "Sin plazo" : `${calculatedHours}h restantes`),
    slaRisk:
      item.slaRisk ||
      item.riesgo_sla ||
      (calculatedHours < 0 ? "Vencido" : calculatedHours <= 8 ? "Riesgo alto" : calculatedHours <= 24 ? "Riesgo medio" : "Controlado"),
    slaGroup,
    pendingType:
      item.pendingType ||
      item.tipo_pendiente ||
      (!assigned ? "sin_asignar" : classificationStatus === "Sin clasificar" ? "sin_clasificar" : observed ? "observados" : "todos"),
    blocked,
    escalated,
    derived,
    observed,
    createdAt: item.createdAt || item.fecha_registro || item.created_at || item.fecha || "",
    updatedAt: item.updatedAt || item.fecha_actualizacion || item.updated_at || "",
    action: item.action || item.accion || item.proximo_paso || "Revisar caso y registrar decisión.",
    reason: item.reason || item.motivo || item.descripcion || "",
    followupStatus: item.followupStatus || item.estado_seguimiento || item.seguimiento || "Sin seguimiento",
    raw: item
  };
}

function normalizeAdvisor(item = {}) {
  const cases = Number(item.cases ?? item.casos ?? item.casos_asignados ?? 0);
  const critical = Number(item.critical ?? item.criticos ?? item.casos_criticos ?? 0);
  const slaRiskValue = Number(item.slaRisk ?? item.sla_risk ?? item.riesgo_sla ?? item.casos_sla_riesgo ?? 0);
  const capacity = Number(item.capacity ?? item.capacidad ?? item.ocupacion ?? Math.min(100, cases * 7));
  const name = item.name || item.nombre || item.asesor_nombre || item.username || "Asesor";

  return {
    id: item.id || item.usuario_id || item.asesor_id || item.personal_id || name,
    name,
    initials: item.initials || item.iniciales || initials(name),
    specialty: item.specialty || item.especialidad || item.area || item.area_nombre || "Atención al cliente",
    status: item.status || item.estado || (capacity >= 90 ? "Sobrecargado" : "Disponible"),
    cases,
    critical,
    slaRisk: slaRiskValue,
    productivity: Number(item.productivity ?? item.productividad ?? 0),
    capacity,
    email: item.email || item.correo || item.correo_oficial || "",
    area: item.area || item.area_nombre || "",
    shift: item.turno || item.shift || "",
    raw: item
  };
}

function normalizeIndicator(item = {}) {
  const title = item.title || item.titulo || item.nombre || "Indicador";

  return {
    id: item.id || item.indicador_id || title,
    icon: item.icon || item.icono || "📈",
    title,
    value: item.value ?? item.valor ?? 0,
    target: item.target ?? item.meta ?? "-",
    trend: item.trend ?? item.tendencia ?? "-",
    status: item.status || item.estado_tipo || item.estado || "info",
    progress: Number(item.progress ?? item.avance ?? item.porcentaje ?? 0),
    description: item.description || item.descripcion || "",
    cause: item.cause || item.causa || "",
    relatedCases: item.relatedCases || item.casos_relacionados || [],
    raw: item
  };
}

function normalizeReport(item = {}) {
  return {
    id: item.id || item.reporte_id || item.codigo || item.name || item.nombre,
    name: item.name || item.nombre || "Reporte",
    type: item.type || item.tipo || "Operativo",
    period: item.period || item.periodo || "-",
    format: item.format || item.formato || "PDF",
    owner: item.owner || item.generado_por || item.usuario || "Supervisor",
    status: item.status || item.estado || "Disponible",
    date: item.date || item.fecha_generacion || item.fecha || "",
    raw: item
  };
}

function normalizeAudit(item = {}) {
  return {
    id: item.id || item.auditoria_id || item.historial_id,
    date: item.date || item.fecha || item.fecha_evento || "",
    caseId: item.caseId || item.codigo_caso || item.caso || item.caso_id || "-",
    type: String(item.type || item.tipo || item.accion_tipo || item.modulo || "general").toLowerCase(),
    action: item.action || item.accion || "Evento registrado",
    user: item.user || item.usuario || item.username || "Sistema",
    role: item.role || item.rol || "-",
    before: item.before || item.valor_anterior || item.antes || "-",
    after: item.after || item.valor_nuevo || item.despues || "-",
    result: item.result || item.resultado || "Registrado",
    severity: item.severity || item.criticidad || "Media",
    detail: item.detail || item.detalle || item.observacion || item.descripcion || "",
    raw: item
  };
}

/* =========================================================
   TIPOS VISUALES
========================================================= */

function caseStatusType(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("vencido") || value.includes("escalado") || value.includes("crítica") || value.includes("critica")) return "danger";
  if (value.includes("pendiente") || value.includes("observado") || value.includes("riesgo") || value.includes("bloqueado")) return "warning";
  if (value.includes("cerrado") || value.includes("listo") || value.includes("resuelto") || value.includes("controlado")) return "success";
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

function advisorStatusType(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("no disponible") || value.includes("inactivo") || value.includes("bloque")) return "danger";
  if (value.includes("ocupado") || value.includes("sobrecargado")) return "warning";
  if (value.includes("disponible") || value.includes("activo")) return "success";

  return "info";
}

function indicatorStatusType(status) {
  if (["danger", "warning", "success", "info", "purple"].includes(status)) return status;
  return caseStatusType(status);
}

function pillClass(type) {
  return `status-pill status-pill--${type || "info"}`;
}

function slaRisk(caseItem) {
  const item = normalizeCase(caseItem);
  return item.slaHours < 0 || item.slaHours <= 8 || priorityValue(item.priority) === 4;
}

/* =========================================================
   RENDERIZADORES COMUNES
========================================================= */

function renderKpis(selector, data = []) {
  const rows = Array.isArray(data) ? data : [];

  setHTML(selector, rows.map((item) => {
    const icon = item.icon ?? item.icono ?? "•";
    const value = item.value ?? item.valor ?? 0;
    const title = item.title ?? item.label ?? item.titulo ?? "Indicador";
    const text = item.text ?? item.description ?? item.descripcion ?? "";

    return `
      <article class="kpi-card">
        <span class="kpi-card__icon">${esc(icon)}</span>
        <div>
          <strong>${esc(value)}</strong>
          <p>${esc(title)}</p>
          <small>${esc(text)}</small>
        </div>
      </article>
    `;
  }).join(""));
}

function renderAi(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(selector, list.length ? list.map((item) => {
    const title = item.title ?? item.titulo ?? "Resumen";
    const text = item.text ?? item.descripcion ?? item.description ?? "";

    return `
      <div class="ai-summary-item">
        <strong>${esc(title)}</strong>
        <p>${esc(text)}</p>
      </div>
    `;
  }).join("") : `
    <div class="ai-summary-item">
      <strong>Sin análisis disponible</strong>
      <p>El análisis aparecerá cuando existan datos cargados desde el sistema.</p>
    </div>
  `);
}

function renderChecklist(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(selector, list.map((item, index) => {
    const icon = item.icon ?? item.icono ?? String(index + 1);
    const title = item.title ?? item.titulo ?? "Acción";
    const text = item.text ?? item.descripcion ?? item.description ?? "";

    return `
      <article class="check-item">
        <span class="check-icon">${esc(icon)}</span>
        <div>
          <strong>${esc(title)}</strong>
          <p>${esc(text)}</p>
        </div>
      </article>
    `;
  }).join(""));
}

function renderActivity(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(selector, list.map((item) => `
    <article class="activity-item">
      <span class="activity-icon">${esc(item.icon || item.icono || "🕘")}</span>
      <div class="activity-content">
        <strong>${esc(item.title || item.action || item.accion || "Movimiento")}</strong>
        <p>${esc(item.text || item.detail || item.detalle || item.descripcion || "")}</p>
        <small>${esc(formatDateTime(item.date || item.fecha || item.fecha_evento))}</small>
      </div>
    </article>
  `).join(""));
}

function caseSummary(item) {
  const c = normalizeCase(item);

  return summaryHTML([
    ["Código", c.code],
    ["Cliente", c.clientName],
    ["Tipo", c.type],
    ["Servicio", c.service],
    ["Prioridad", c.priority],
    ["Estado", c.status],
    ["Responsable", c.advisorName],
    ["SLA", c.slaText],
    ["Acción sugerida", c.action]
  ]);
}

function advisorSummary(item) {
  const advisor = normalizeAdvisor(item);

  return summaryHTML([
    ["Asesor", advisor.name],
    ["Especialidad", advisor.specialty],
    ["Estado", advisor.status],
    ["Casos", advisor.cases],
    ["Críticos", advisor.critical],
    ["Riesgo SLA", advisor.slaRisk],
    ["Productividad", `${advisor.productivity}%`],
    ["Capacidad", `${advisor.capacity}%`]
  ]);
}

/* =========================================================
   BUSCADOR GLOBAL
========================================================= */

const PAGE_LINKS = [
  ["🏠", "Dashboard", "Centro de supervisión operativa.", "dashboard.html"],
  ["📋", "Casos pendientes", "Clasificación y decisión de casos.", "casos-pendientes.html"],
  ["👥", "Asignaciones", "Asignar, reasignar, derivar y escalar.", "asignaciones.html"],
  ["⚖️", "Carga de asesores", "Balance de capacidad del equipo.", "carga-asesores.html"],
  ["⏱️", "Monitoreo SLA", "Control de vencimientos y riesgo.", "monitoreo-sla.html"],
  ["📈", "Indicadores", "Métricas operativas.", "indicadores.html"],
  ["📊", "Reportes", "Generación formal de reportes.", "reportes.html"],
  ["🕵️", "Auditoría", "Trazabilidad de acciones.", "auditoria-casos.html"],
  ["⚙️", "Configuración", "Reglas operativas de supervisión.", "configuracion-supervision.html"]
];

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

async function renderSearch() {
  const box = $("#searchResults");

  if (!box) return;

  const q = getValue("#globalSearchInput");

  if (!q) {
    box.innerHTML = PAGE_LINKS.map(([icon, title, text, href]) => `
      <a href="${href}" class="search-result-item">
        <span>${icon}</span>
        <div>
          <strong>${esc(title)}</strong>
          <small>${esc(text)}</small>
        </div>
      </a>
    `).join("");

    return;
  }

  box.innerHTML = `<p class="muted">Buscando información...</p>`;

  try {
    const response = await apiRequest(`/supervisor/search${buildQuery({ q })}`);
    const items = listFrom(response, ["items", "resultados", "results"]);

    box.innerHTML = items.length
      ? items.map((item) => `
        <a href="${esc(item.href || "#")}" class="search-result-item">
          <span>${esc(item.icon || item.icono || "🔎")}</span>
          <div>
            <strong>${esc(item.title || item.titulo || "Resultado")}</strong>
            <small>${esc(item.text || item.descripcion || "")}</small>
          </div>
        </a>
      `).join("")
      : `<p class="muted">No se encontraron resultados.</p>`;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

/* =========================================================
   BOT IA
========================================================= */

function setupBot() {
  $("#openBotSidebar")?.addEventListener("click", openBot);
  $("#openBotWelcome")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = getValue("#botInput");
    if (!prompt) return;

    setValue("#botInput", "");
    await askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach((button) => {
    button.addEventListener("click", () => askBot(button.dataset.botPrompt || ""));
  });

  const aiButtons = [
    ["analyzeSupervisorWorkBtn", "Analiza la operación del supervisor"],
    ["prioritizeCriticalCasesBtn", "Prioriza los casos críticos"],
    ["prioritizePendingBtn", "Prioriza casos pendientes"],
    ["analyzePendingCasesBtn", "Analiza casos pendientes"],
    ["smartAssignBtn", "Sugiere asignación para casos sin asesor"],
    ["analyzeAssignmentsBtn", "Analiza asignaciones"],
    ["balanceLoadAiBtn", "Recomienda balance de carga"],
    ["analyzeAdvisorLoadBtn", "Analiza carga de asesores"],
    ["prioritizeSlaMonitorBtn", "Prioriza casos SLA"],
    ["analyzeSlaMonitorBtn", "Analiza SLA"],
    ["priorityMapAiBtn", "Interpreta mapa de prioridades"],
    ["analyzeIndicatorsBtn", "Analiza indicadores principales"],
    ["generateIndicatorInsightBtn", "Genera análisis de indicadores"],
    ["loadMapAiBtn", "Interpreta mapa de carga"],
    ["classifyCaseAiBtn", "Sugiere clasificación para el caso"],
    ["assignAdvisorAiBtn", "Sugiere asesor para el caso"],
    ["reassignAiBtn", "Sugiere reasignación"],
    ["redistributeLoadAiBtn", "Sugiere redistribución de carga"],
    ["slaAlertAiBtn", "Genera texto de alerta SLA"],
    ["massSlaAlertAiBtn", "Genera texto para alerta SLA masiva"],
    ["massAssignmentAiBtn", "Recomienda criterio de asignación masiva"]
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

async function askBot(prompt) {
  openBot();
  addBotMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando información del sistema...";
  $("#botMessages")?.appendChild(typing);

  try {
    const response = await apiRequest("/supervisor/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        module: State.config.module,
        prompt,
        case_id: State.selectedCaseId,
        advisor_id: State.selectedAdvisorId,
        indicator_id: State.selectedIndicatorId
      })
    });

    typing.remove();
    addBotMessage(response.answer || response.respuesta || "No se recibió respuesta del asistente.", "bot");
  } catch (error) {
    typing.remove();
    addBotMessage(`No se pudo consultar el asistente: ${error.message}`, "bot");
  }
}

function addBotMessage(text, who) {
  const box = $("#botMessages");

  if (!box) return;

  const message = document.createElement("div");
  message.className = `message message--${who}`;
  message.textContent = text;

  box.appendChild(message);
  box.scrollTop = box.scrollHeight;
}

/* =========================================================
   SHELL DATA
========================================================= */

async function loadShellData() {
  try {
    const response = await apiRequest("/supervisor/me");
    const payload = normalizePayload(response);

    State.supervisor = payload.supervisor || payload.user || payload;
    setPermissions(payload.permissions || payload.permisos || State.config.permissions || []);

    const name =
      State.supervisor.nombre ||
      State.supervisor.name ||
      State.supervisor.username ||
      State.user?.nombre ||
      "Supervisor";

    setText("#userNameTop", name);
    setText("#userRoleTop", State.supervisor.cargo || State.supervisor.role || "Supervisor de Atención");
    setText("#userAvatar", State.supervisor.initials || State.supervisor.iniciales || initials(name));
  } catch (error) {
    toast("Perfil no disponible", error.message, "warning");
  }

  await refreshGlobalBadges();
}

async function refreshGlobalBadges() {
  try {
    const response = await apiRequest("/supervisor/resumen");
    const payload = normalizePayload(response);

    const pending = Number(payload.pendientes ?? payload.pending ?? payload.casos_pendientes ?? 0);
    const sla = Number(payload.sla_riesgo ?? payload.slaRisk ?? payload.sla ?? 0);

    setText("#sidebarPendingCount", pending);
    setText("#sidebarSlaCount", sla);
    setText("#notificationBadge", sla || "");
  } catch {
    setText("#sidebarPendingCount", "0");
    setText("#sidebarSlaCount", "0");
    setText("#notificationBadge", "");
  }
}

/* =========================================================
   INICIALIZACIÓN
   Las funciones initDashboard, initPendingCases, etc.
   van en la siguiente parte.
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  readPageConfig();
  applyTheme(State.theme);
  setupBaseUI();
  setupModalEvents();
  setupConfirmActionModal();
  setupSearch();
  setupBot();

  if (!requireSupervisorSession()) return;

  setupUserFromStorage();

  await loadShellData();
  await loadCatalogs();

  if (State.page === "supervisor-dashboard") await initDashboard();
  if (State.page === "supervisor-casos-pendientes") await initPendingCases();
  if (State.page === "supervisor-asignaciones") await initAssignments();
  if (State.page === "supervisor-carga-asesores") await initAdvisorLoad();
  if (State.page === "supervisor-monitoreo-sla") await initSlaMonitor();
  if (State.page === "supervisor-indicadores") await initIndicators();
  if (State.page === "supervisor-reportes") await initReports();
  if (State.page === "supervisor-auditoria-casos") await initAudit();
  if (State.page === "supervisor-configuracion-supervision") await initConfig();

  applyPermissions();
});

/* =========================================================
   HELPERS DE DATOS
========================================================= */

function saveSelectedCase(id) {
  State.selectedCaseId = id;
  if (id) localStorage.setItem("claro360-supervisor-selected-case", id);
}

function saveSelectedAdvisor(id) {
  State.selectedAdvisorId = id;
}

function saveSelectedIndicator(id) {
  State.selectedIndicatorId = id;
}

function saveSelectedReport(id) {
  State.selectedReportId = id;
}

function saveSelectedAudit(id) {
  State.selectedAuditId = id;
}

function getCase(id) {
  return State.cases
    .map(normalizeCase)
    .find((item) => String(item.id) === String(id) || String(item.code) === String(id)) || null;
}

function getAdvisor(id) {
  return State.advisors
    .map(normalizeAdvisor)
    .find((item) => String(item.id) === String(id)) || null;
}

function getIndicator(id) {
  return State.indicators
    .map(normalizeIndicator)
    .find((item) => String(item.id) === String(id)) || null;
}

function getPendingCases() {
  return State.cases.map(normalizeCase).filter((item) => (
    item.classificationStatus === "Sin clasificar" ||
    item.assignmentStatus === "Sin asesor" ||
    item.observed ||
    priorityValue(item.priority) === 4 ||
    item.slaHours <= 8
  ));
}

function getSelectedIds(key) {
  return Array.from(State.selections[key] || []);
}

function clearSelection(key) {
  State.selections[key]?.clear();
  $$(`[data-selection-group="${key}"]`).forEach((input) => {
    input.checked = false;
  });
  updateBulkBars();
}

function updateSelection(key, id, checked) {
  if (!State.selections[key]) State.selections[key] = new Set();

  if (checked) State.selections[key].add(String(id));
  else State.selections[key].delete(String(id));

  updateBulkBars();
}

function updateBulkBars() {
  const pendingCount = State.selections.pending.size;
  const assignmentsCount = State.selections.assignments.size;
  const advisorCount = State.selections.advisors.size;
  const slaCount = State.selections.sla.size;

  setText("#pendingSelectedCount", pendingCount);
  setText("#assignmentsSelectedCount", assignmentsCount);
  setText("#advisorLoadSelectedCount", advisorCount);
  setText("#slaMonitorSelectedCount", slaCount);

  show("#pendingBulkBar", pendingCount > 0);
  show("#assignmentsBulkBar", assignmentsCount > 0);
  show("#advisorLoadBulkBar", advisorCount > 0);
  show("#slaMonitorBulkBar", slaCount > 0);
}

function bindSelectionEvents(root = document) {
  $$("[data-select-id]", root).forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      updateSelection(
        checkbox.dataset.selectionGroup,
        checkbox.dataset.selectId,
        checkbox.checked
      );
    });
  });

  [
    ["#pendingSelectAll", "pending"],
    ["#assignmentsSelectAll", "assignments"],
    ["#advisorLoadSelectAll", "advisors"],
    ["#slaSelectAll", "sla"]
  ].forEach(([selector, group]) => {
    const checkbox = $(selector);
    if (!checkbox) return;

    checkbox.addEventListener("change", () => {
      $$(`[data-selection-group="${group}"]`).forEach((item) => {
        item.checked = checkbox.checked;
        updateSelection(group, item.dataset.selectId, checkbox.checked);
      });
    });
  });
}

/* =========================================================
   LOADERS
========================================================= */

async function loadCases(params = {}) {
  const endpoint = params.endpoint || "/supervisor/casos";
  const cleanParams = { ...params };
  delete cleanParams.endpoint;

  const response = await apiRequest(`${endpoint}${buildQuery(cleanParams)}`);

  State.cases = listFrom(response, [
    "items",
    "cases",
    "casos",
    "critical_cases",
    "casos_criticos",
    "pending_cases",
    "casos_pendientes"
  ]);

  await refreshGlobalBadges();
  return response;
}

async function loadAdvisors(params = {}) {
  const response = await apiRequest(`/supervisor/asesores${buildQuery(params)}`);

  State.advisors = listFrom(response, [
    "items",
    "advisors",
    "asesores",
    "users",
    "usuarios",
    "team",
    "equipo"
  ]);

  populateAdvisorSelects();
  return response;
}

async function loadIndicators(params = {}) {
  const response = await apiRequest(`/supervisor/indicadores${buildQuery(params)}`);

  State.indicators = listFrom(response, [
    "items",
    "indicators",
    "indicadores",
    "kpis",
    "metrics",
    "metricas"
  ]);

  return response;
}

async function loadReports(params = {}) {
  const response = await apiRequest(`/supervisor/reportes${buildQuery(params)}`);

  State.reports = listFrom(response, [
    "items",
    "reports",
    "reportes",
    "recent",
    "recientes",
    "historial"
  ]);

  return response;
}

async function loadAudit(params = {}) {
  const response = await apiRequest(`/supervisor/auditoria${buildQuery(params)}`);

  State.audit = listFrom(response, [
    "items",
    "audit",
    "auditoria",
    "events",
    "eventos",
    "trace",
    "trazabilidad",
    "historial"
  ]);

  return response;
}

function populateAdvisorSelects() {
  const advisors = State.advisors.map(normalizeAdvisor);

  const advisorOptions =
    `<option value="">Seleccionar</option>` +
    advisors.map((item) => `
      <option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.specialty)} · ${esc(item.capacity)}% carga</option>
    `).join("");

  [
    "#assignAdvisorSelect",
    "#reassignToAdvisor",
    "#redistributeFromAdvisor",
    "#redistributeToAdvisor",
    "#slaAdvisorFilter",
    "#indicatorAdvisorFilter",
    "#assignmentsAdvisorFilter"
  ].forEach((selector) => {
    const select = $(selector);
    if (!select) return;

    const firstOption = select.querySelector("option")?.outerHTML || `<option value="">Seleccionar</option>`;

    if (selector.includes("Filter")) {
      select.innerHTML = `<option value="todos">Todos</option>` + advisors.map((item) => `
        <option value="${esc(item.id)}">${esc(item.name)}</option>
      `).join("");
    } else {
      select.innerHTML = advisorOptions;
    }

    if (!advisors.length) select.innerHTML = firstOption;
  });
}

/* =========================================================
   FILTROS / PAGINACIÓN
========================================================= */

function getAdvancedFilters(prefix) {
  const result = {};

  $$(`[id^="${prefix}"]`).forEach((element) => {
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName)) return;

    const key = element.id
      .replace(prefix, "")
      .replace(/^[A-Z]/, (char) => char.toLowerCase());

    if (element.type === "checkbox") result[key] = element.checked;
    else result[key] = element.value;
  });

  return result;
}

function paginateRows(rows, key) {
  const pagination = State.pagination[key];

  if (!pagination) return rows;

  pagination.total = rows.length;

  const start = (pagination.page - 1) * pagination.pageSize;
  return rows.slice(start, start + pagination.pageSize);
}

function updatePaginationUI(key, totalSelector, pageSelector) {
  const pagination = State.pagination[key];

  if (!pagination) return;

  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));

  if (pagination.page > totalPages) pagination.page = totalPages;

  setText(totalSelector, `Mostrando ${Math.min(pagination.total, pagination.pageSize)} de ${pagination.total} registros`);
  setText(pageSelector, `Página ${pagination.page} de ${totalPages}`);
}

function bindPagination({
  key,
  prevSelector,
  nextSelector,
  pageSizeSelector,
  render
}) {
  $(prevSelector)?.addEventListener("click", () => {
    if (State.pagination[key].page > 1) {
      State.pagination[key].page -= 1;
      render();
    }
  });

  $(nextSelector)?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(State.pagination[key].total / State.pagination[key].pageSize));

    if (State.pagination[key].page < totalPages) {
      State.pagination[key].page += 1;
      render();
    }
  });

  $(pageSizeSelector)?.addEventListener("change", () => {
    State.pagination[key].pageSize = Number(getValue(pageSizeSelector) || 20);
    State.pagination[key].page = 1;
    render();
  });
}

/* =========================================================
   RENDERIZADORES DE CASOS
========================================================= */

function renderCaseCard(item, mode = "supervisor", selectionGroup = "") {
  const c = normalizeCase(item);
  const buttons = [];

  buttons.push(`<button type="button" data-action="${mode}-view-case" data-case-id="${esc(c.id)}">Ver</button>`);

  if (mode === "supervisor") {
    buttons.push(`<button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>`);
    buttons.push(`<button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>`);
    buttons.push(`<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`);
  }

  if (mode === "pending") {
    buttons.push(`<button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>`);
    buttons.push(`<button type="button" data-action="send-assignment" data-case-id="${esc(c.id)}">Asignar</button>`);
    buttons.push(`<button type="button" data-action="change-priority" data-case-id="${esc(c.id)}">Prioridad</button>`);
    buttons.push(`<button type="button" data-action="observe-case" data-case-id="${esc(c.id)}">Observar</button>`);
  }

  if (mode === "assignment") {
    buttons.push(`<button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>`);
    buttons.push(`<button type="button" data-action="reassign-case" data-case-id="${esc(c.id)}">Reasignar</button>`);
    buttons.push(`<button type="button" data-action="derive-case" data-case-id="${esc(c.id)}">Derivar</button>`);
    buttons.push(`<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`);
  }

  if (mode === "sla") {
    buttons.push(`<button type="button" data-action="sla-alert" data-case-id="${esc(c.id)}">Alertar</button>`);
    buttons.push(`<button type="button" data-action="sla-follow" data-case-id="${esc(c.id)}">Seguimiento</button>`);
    buttons.push(`<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`);
  }

  const checkbox = selectionGroup
    ? `
      <label class="card-select">
        <input
          type="checkbox"
          data-select-id="${esc(c.id)}"
          data-selection-group="${esc(selectionGroup)}"
          ${State.selections[selectionGroup]?.has(String(c.id)) ? "checked" : ""}
          aria-label="Seleccionar caso ${esc(c.code)}"
        />
      </label>
    `
    : "";

  return `
    <article class="case-card">
      ${checkbox}
      <span class="case-card__icon">${esc(c.icon)}</span>

      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description || c.reason || c.action)}</p>

        <div class="case-meta">
          <span>${esc(c.code)}</span>
          <span>${esc(c.clientName)}</span>
          <span>${esc(c.type)}</span>
          <span>${esc(c.channel)}</span>
          <span>${esc(c.priority)}</span>
          <span>${esc(c.slaText)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="${pillClass(caseStatusType(c.status))}">${esc(c.status)}</span>
        ${buttons.join("")}
      </div>
    </article>
  `;
}

function renderCaseTableRow(item, mode = "pending", selectionGroup = "") {
  const c = normalizeCase(item);

  const checkbox = selectionGroup
    ? `
      <td>
        <input
          type="checkbox"
          data-select-id="${esc(c.id)}"
          data-selection-group="${esc(selectionGroup)}"
          ${State.selections[selectionGroup]?.has(String(c.id)) ? "checked" : ""}
          aria-label="Seleccionar caso ${esc(c.code)}"
        />
      </td>
    `
    : "";

  if (mode === "pending") {
    return `
      <tr>
        ${checkbox}
        <td>${esc(c.code)}</td>
        <td>${esc(c.clientName)}</td>
        <td>${esc(c.type)}</td>
        <td>${esc(c.channel)}</td>
        <td><span class="${pillClass(priorityType(c.priority))}">${esc(c.priority)}</span></td>
        <td><span class="${pillClass(caseStatusType(c.status))}">${esc(c.status)}</span></td>
        <td>${esc(c.slaText)}</td>
        <td>
          <button type="button" data-action="pending-view-case" data-case-id="${esc(c.id)}">Ver</button>
          <button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>
        </td>
      </tr>
    `;
  }

  if (mode === "assignment") {
    return `
      <tr>
        ${checkbox}
        <td>${esc(c.code)}</td>
        <td>${esc(c.clientName)}</td>
        <td>${esc(c.type)}</td>
        <td>${esc(c.advisorName)}</td>
        <td><span class="${pillClass(priorityType(c.priority))}">${esc(c.priority)}</span></td>
        <td>${esc(c.slaText)}</td>
        <td>${esc(c.assignmentFlow)}</td>
        <td>
          <button type="button" data-action="assignment-view-case" data-case-id="${esc(c.id)}">Ver</button>
          <button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>
        </td>
      </tr>
    `;
  }

  if (mode === "sla") {
    return `
      <tr>
        ${checkbox}
        <td>${esc(c.code)}</td>
        <td>${esc(c.clientName)}</td>
        <td>${esc(c.advisorName)}</td>
        <td><span class="${pillClass(caseStatusType(c.status))}">${esc(c.status)}</span></td>
        <td><span class="${pillClass(priorityType(c.priority))}">${esc(c.priority)}</span></td>
        <td>${esc(c.slaText)}</td>
        <td>${esc(c.slaRisk)}</td>
        <td>${esc(c.followupStatus)}</td>
        <td>
          <button type="button" data-action="sla-view-case" data-case-id="${esc(c.id)}">Ver</button>
          <button type="button" data-action="sla-alert" data-case-id="${esc(c.id)}">Alertar</button>
        </td>
      </tr>
    `;
  }

  return "";
}

function bindCaseActions(root = document) {
  $$('[data-action$="view-case"]', root).forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.caseId;

      if (State.page === "supervisor-casos-pendientes") openPendingCaseModal(id);
      else if (State.page === "supervisor-asignaciones") openAssignmentCaseModal(id);
      else if (State.page === "supervisor-monitoreo-sla") openSlaCaseModal(id);
      else openQuickCaseModal(id);
    });
  });

  $$('[data-action="classify-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "classify"));
  });

  $$('[data-action="change-priority"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "priority"));
  });

  $$('[data-action="observe-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "observe"));
  });

  $$('[data-action="send-assignment"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "send-assignment"));
  });

  $$('[data-action="assign-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "assign"));
  });

  $$('[data-action="reassign-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "reassign"));
  });

  $$('[data-action="derive-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "derive"));
  });

  $$('[data-action="escalate-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "escalate"));
  });

  $$('[data-action="sla-alert"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "alert"));
  });

  $$('[data-action="sla-follow"]', root).forEach((button) => {
    button.addEventListener("click", () => openCaseAction(button.dataset.caseId, "follow"));
  });

  bindSelectionEvents(root);
}

/* =========================================================
   DEEP LINKS / ACCIONES ENTRE PÁGINAS
========================================================= */

function targetPageForCaseAction(action) {
  if (["classify", "priority", "observe", "send-assignment"].includes(action)) {
    return "casos-pendientes.html";
  }

  if (["alert", "follow"].includes(action)) {
    return "monitoreo-sla.html";
  }

  return "asignaciones.html";
}

function goToCaseAction(caseId, action) {
  if (!caseId) {
    toast("Caso no seleccionado", "Selecciona un caso antes de ejecutar la acción.", "warning");
    return;
  }

  saveSelectedCase(caseId);

  const page = targetPageForCaseAction(action);
  window.location.href = `${page}?case=${encodeURIComponent(caseId)}&action=${encodeURIComponent(action)}`;
}

function openCaseAction(caseId, action) {
  const map = {
    classify: ["#classifyCaseModal", () => openClassifyCaseModal(caseId)],
    priority: ["#changePriorityModal", () => openChangePriorityModal(caseId)],
    observe: ["#observeCaseModal", () => openObserveCaseModal(caseId)],
    "send-assignment": ["#sendToAssignmentModal", () => openSendToAssignmentModal(caseId)],
    assign: ["#assignAdvisorModal", () => openAssignAdvisorModal(caseId)],
    reassign: ["#reassignCaseModal", () => openReassignCaseModal(caseId)],
    derive: ["#deriveAreaModal", () => openDeriveAreaModal(caseId)],
    escalate: ["#escalateCaseModal", () => openEscalateCaseModal(caseId)],
    alert: ["#sendSlaAlertModal", () => openSendSlaAlertModal(caseId)],
    follow: ["#slaSupervisorFollowModal", () => openSlaFollowModal(caseId)]
  };

  const config = map[action];

  if (!config) return;

  const [modalSelector, callback] = config;

  if ($(modalSelector)) {
    callback();
    return;
  }

  goToCaseAction(caseId, action);
}

function processCaseDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case") || localStorage.getItem("claro360-supervisor-selected-case");
  const action = params.get("action");

  if (!caseId || !action) return;

  setTimeout(() => {
    openCaseAction(caseId, action);
  }, 250);
}

/* =========================================================
   ACCIONES BACKEND
========================================================= */

async function postCaseAction(action, caseId, payload, onSuccess) {
  await apiRequest(`/supervisor/casos/${encodeURIComponent(caseId)}/${action}`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  closeModals();
  toast("Acción registrada", "La acción fue registrada correctamente.", "success");

  await refreshGlobalBadges();

  if (typeof onSuccess === "function") await onSuccess();
}

function openBackendConfirm({ title, text, summary, action, caseId, payload, onSuccess }) {
  openConfirmAction({
    icon: "⚠️",
    title,
    text,
    summary,
    declaration: "Confirmo que la acción fue revisada y debe registrarse en auditoría.",
    onConfirm: async () => {
      await postCaseAction(action, caseId, payload, onSuccess);
    }
  });
}

/* =========================================================
   EXPORTACIÓN BACKEND
========================================================= */

function currentPageFilters() {
  if (State.page === "supervisor-dashboard") {
    return getAdvancedFilters("dashboard");
  }

  if (State.page === "supervisor-casos-pendientes") {
    return {
      filtro_rapido: State.filters.pending,
      busqueda: getValue("#pendingCaseSearch"),
      ...getAdvancedFilters("pending")
    };
  }

  if (State.page === "supervisor-asignaciones") {
    return {
      filtro_rapido: State.filters.assignments,
      busqueda: getValue("#assignmentsSearch"),
      ...getAdvancedFilters("assignments")
    };
  }

  if (State.page === "supervisor-carga-asesores") {
    return {
      filtro_rapido: State.filters.advisors,
      busqueda: getValue("#advisorLoadSearch"),
      ...getAdvancedFilters("advisorLoad")
    };
  }

  if (State.page === "supervisor-monitoreo-sla") {
    return {
      filtro_rapido: State.filters.sla,
      busqueda: getValue("#slaMonitorSearch"),
      ...getAdvancedFilters("sla")
    };
  }

  if (State.page === "supervisor-indicadores") {
    return getAdvancedFilters("indicator");
  }

  return {};
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function extensionByFormat(format) {
  const value = String(format || "").toLowerCase();

  if (value.includes("pdf")) return "pdf";
  if (value.includes("doc")) return "docx";
  if (value.includes("xls") || value.includes("excel")) return "xlsx";
  if (value.includes("csv")) return "csv";
  if (value.includes("png") || value.includes("imagen")) return "png";
  if (value.includes("dashboard") || value.includes("html")) return "html";

  return "xlsx";
}

async function requestExport({
  format,
  scope,
  detail,
  destination,
  reason,
  include = {},
  selectedIds = [],
  module = State.config.module,
  endpoint = State.config.exportEndpoint
}) {
  if (!format || !scope || !reason) {
    toast("Faltan datos", "Completa formato, alcance y motivo de exportación.", "warning");
    return;
  }

  const payload = {
    module,
    page: State.page,
    format,
    scope,
    detail,
    destination,
    reason,
    include,
    selected_ids: selectedIds,
    filters: currentPageFilters(),
    audit_module: State.config.auditModule
  };

  const result = await apiRequest(endpoint || "/supervisor/exportar", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (result instanceof Blob) {
    const ext = extensionByFormat(format);
    downloadBlob(result, `${safeFileName(module, "exportacion")}_${todayStamp()}.${ext}`);
    toast("Exportación generada", "El archivo fue descargado correctamente.", "success");
    return;
  }

  if (result.download_url || result.url) {
    window.open(result.download_url || result.url, "_blank");
    toast("Exportación generada", "Se abrió el archivo generado por el backend.", "success");
    return;
  }

  if (result.share_url || result.dashboard_url) {
    genericModal("🔗", "Dashboard compartible", result.share_url || result.dashboard_url);
    return;
  }

  toast("Exportación registrada", "La solicitud de exportación fue registrada correctamente.", "success");
}

/* =========================================================
   DASHBOARD
========================================================= */

async function initDashboard() {
  bindDashboardEvents();
  await renderDashboard();
}

function bindDashboardEvents() {
  [
    "#refreshDashboardBtn",
    "#refreshCriticalCasesBtn",
    "#refreshAdvisorLoadBtn",
    "#refreshDashboardSlaBtn",
    "#refreshDashboardIndicatorsBtn",
    "#refreshSupervisorActivityBtn"
  ].forEach((selector) => {
    $(selector)?.addEventListener("click", renderDashboard);
  });

  $("#resetDashboardFiltersBtn")?.addEventListener("click", () => {
    setValue("#dashboardPeriodFilter", "hoy");
    setValue("#dashboardAreaFilter", "todos");
    setValue("#dashboardPriorityFilter", "todos");
    setValue("#dashboardStatusFilter", "todos");
    renderDashboard();
  });

  ["#dashboardPeriodFilter", "#dashboardAreaFilter", "#dashboardPriorityFilter", "#dashboardStatusFilter"].forEach((selector) => {
    $(selector)?.addEventListener("change", renderDashboard);
  });

  $("#openDashboardExportBtn")?.addEventListener("click", () => openModal("#dashboardExportModal"));
  $("#confirmDashboardExportBtn")?.addEventListener("click", confirmDashboardExport);

  $("#caseQuickViewAssignBtn")?.addEventListener("click", () => {
    goToCaseAction(State.selectedCaseId, "assign");
  });

  $("#caseQuickViewClassifyBtn")?.addEventListener("click", () => {
    goToCaseAction(State.selectedCaseId, "classify");
  });

  $("#caseQuickViewEscalateBtn")?.addEventListener("click", () => {
    goToCaseAction(State.selectedCaseId, "escalate");
  });
}

async function renderDashboard() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint}${buildQuery({
      period: getValue("#dashboardPeriodFilter"),
      area: getValue("#dashboardAreaFilter"),
      priority: getValue("#dashboardPriorityFilter"),
      status: getValue("#dashboardStatusFilter")
    })}`);

    const payload = normalizePayload(response);

    State.cases = listFrom(payload, ["cases", "casos", "critical_cases", "casos_criticos", "pending_cases", "casos_pendientes"]);
    State.advisors = listFrom(payload, ["advisors", "asesores", "team", "equipo"]);
    State.indicators = listFrom(payload, ["indicators", "indicadores", "kpis", "metrics"]);
    State.audit = listFrom(payload, ["activity", "actividad", "audit", "auditoria", "historial"]);

    const supervisor = payload.supervisor || State.supervisor || {};
    const name = supervisor.nombre || supervisor.name || State.user?.nombre || "Supervisor";

    setText("#dashboardHeroEyebrow", payload.hero_eyebrow || "Supervisión operativa");
    setText("#dashboardHeroTitle", payload.hero_title || `Hola, ${name}`);
    setText("#dashboardHeroText", payload.hero_text || "Controla pendientes, asignaciones, carga del equipo, SLA, indicadores y trazabilidad desde una vista ejecutiva.");
    setText("#supervisorStatus", supervisor.status || supervisor.estado || "Supervisión activa");
    setText("#supervisorLastUpdate", payload.last_update ? `Última actualización: ${formatDateTime(payload.last_update)}` : "Última actualización registrada");

    renderKpis("#supervisorKpiGrid", payload.kpis || buildSupervisorKpis());
    renderCriticalCases(payload.critical_cases || payload.casos_criticos || State.cases);
    renderAdvisorLoadSummary(State.advisors);
    renderDashboardSla(State.cases.filter(slaRisk));
    renderDashboardIndicators(State.indicators);
    renderSupervisorActivity(State.audit);
    renderAi("#supervisorAiSummary", payload.ai_summary || payload.resumen_ia || buildDashboardAi());

    await refreshGlobalBadges();
  } catch (error) {
    renderAi("#supervisorAiSummary", [{ title: "No se pudo cargar dashboard", text: error.message }]);
    show("#emptyCriticalCasesState", true);
    show("#emptyAdvisorLoadState", true);
    show("#emptyDashboardSlaState", true);
  }
}

function buildSupervisorKpis() {
  const cases = State.cases.map(normalizeCase);

  return [
    { icon: "📋", value: getPendingCases().length, label: "Pendientes", description: "Casos por decisión" },
    { icon: "🔥", value: cases.filter((c) => priorityValue(c.priority) === 4).length, label: "Críticos", description: "Requieren atención" },
    { icon: "⏱️", value: cases.filter(slaRisk).length, label: "Riesgo SLA", description: "Vencidos o próximos" },
    { icon: "👥", value: State.advisors.length, label: "Asesores", description: "Equipo operativo" }
  ];
}

function buildDashboardAi() {
  return [
    { title: "Prioridad inmediata", text: "Revisar casos críticos, vencidos o sin responsable asignado." },
    { title: "Control operativo", text: "Balancear carga y asegurar seguimiento SLA." }
  ];
}

function renderCriticalCases(rows = []) {
  const cases = rows
    .map(normalizeCase)
    .filter((item) => slaRisk(item) || item.observed || priorityValue(item.priority) === 4)
    .sort((a, b) => a.slaHours - b.slaHours);

  setHTML("#criticalCasesList", cases.map((item) => renderCaseCard(item, "supervisor")).join(""));
  show("#emptyCriticalCasesState", !cases.length);
  bindCaseActions($("#criticalCasesList"));
}

function renderAdvisorLoadSummary(rows = []) {
  const advisors = rows
    .map(normalizeAdvisor)
    .sort((a, b) => b.capacity - a.capacity)
    .slice(0, 6);

  setHTML("#advisorLoadSummary", advisors.map((advisor) => advisorLoadMiniCard(advisor)).join(""));
  show("#emptyAdvisorLoadState", !advisors.length);
  bindAdvisorButtons($("#advisorLoadSummary"));
}

function advisorLoadMiniCard(advisor) {
  return `
    <article class="advisor-load-card">
      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(advisor.initials)}</span>
        <div>
          <h3>${esc(advisor.name)}</h3>
          <p>${esc(advisor.specialty)}</p>
        </div>
        <span class="${pillClass(advisorStatusType(advisor.status))}">${esc(advisor.status)}</span>
      </div>

      <div class="advisor-load-metrics">
        <div><span>Casos</span><strong>${esc(advisor.cases)}</strong></div>
        <div><span>Críticos</span><strong>${esc(advisor.critical)}</strong></div>
        <div><span>SLA</span><strong>${esc(advisor.slaRisk)}</strong></div>
        <div><span>Carga</span><strong>${esc(advisor.capacity)}%</strong></div>
      </div>

      <div class="advisor-load-progress"><span style="width:${Math.min(advisor.capacity, 100)}%"></span></div>

      <div class="service-actions">
        <button type="button" data-advisor-id="${esc(advisor.id)}" data-action="view-advisor">Ver asesor</button>
      </div>
    </article>
  `;
}

function renderDashboardSla(rows = []) {
  const cases = rows.map(normalizeCase).sort((a, b) => a.slaHours - b.slaHours).slice(0, 8);

  setHTML("#dashboardSlaList", cases.map((item) => `
    <article class="sla-item">
      <span class="activity-icon">⏱️</span>
      <div>
        <strong>${esc(item.code)} · ${esc(item.priority)}</strong>
        <p>${esc(item.title)} · ${esc(item.slaText)} · ${esc(item.advisorName)}</p>
        <div class="sla-meter">
          <span style="width:${Math.max(12, Math.min(100, 100 - Math.max(item.slaHours, 0) * 9))}%"></span>
        </div>
      </div>
      <button type="button" data-action="sla-view-case" data-case-id="${esc(item.id)}">Ver</button>
    </article>
  `).join(""));

  show("#emptyDashboardSlaState", !cases.length);
  bindCaseActions($("#dashboardSlaList"));
}

function renderDashboardIndicators(rows = []) {
  const indicators = rows.map(normalizeIndicator).slice(0, 4);

  setHTML("#dashboardIndicatorGrid", indicators.map(indicatorCard).join(""));
  show("#emptyDashboardIndicatorsState", !indicators.length);
  bindIndicatorButtons($("#dashboardIndicatorGrid"));
}

function renderSupervisorActivity(rows = []) {
  renderActivity("#supervisorActivityTimeline", rows);
  show("#emptySupervisorActivityState", !rows.length);
}

function openQuickCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);

  setText("#caseQuickViewIcon", item.icon);
  setText("#caseQuickViewTitle", item.code);
  setText("#caseQuickViewText", item.description);
  setHTML("#caseQuickViewSummary", caseSummary(item));

  openModal("#caseQuickViewModal");
}

async function confirmDashboardExport() {
  await requestExport({
    format: getValue("#dashboardExportFormat"),
    scope: getValue("#dashboardExportScope"),
    detail: getValue("#dashboardExportDetail"),
    destination: getValue("#dashboardExportRecipient"),
    reason: getValue("#dashboardExportReason"),
    include: {
      kpis: isChecked("#dashboardExportIncludeKpis"),
      cases: isChecked("#dashboardExportIncludeCases"),
      sla: isChecked("#dashboardExportIncludeSla"),
      activity: isChecked("#dashboardExportIncludeActivity")
    }
  });

  closeModals();
}

/* =========================================================
   CASOS PENDIENTES
========================================================= */

async function initPendingCases() {
  bindPendingEvents();
  await renderPendingCases();
  processCaseDeepLink();
}

function bindPendingEvents() {
  $("#pendingCaseSearch")?.addEventListener("input", () => {
    State.pagination.pending.page = 1;
    renderPendingCases();
  });

  $$("[data-pending-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.pending = button.dataset.pendingFilter || "todos";
      State.pagination.pending.page = 1;

      $$("[data-pending-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderPendingCases();
    });
  });

  $("#togglePendingViewBtn")?.addEventListener("click", () => {
    State.views.pending = State.views.pending === "cards" ? "table" : "cards";
    setText("#togglePendingViewBtn", State.views.pending === "cards" ? "Vista tabla" : "Vista cards");
    renderPendingCases();
  });

  $("#refreshPendingCasesBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderPendingCases();
  });

  $("#applyPendingAdvancedFiltersBtn")?.addEventListener("click", renderPendingCases);

  $("#resetPendingAdvancedFiltersBtn")?.addEventListener("click", () => {
    ["#pendingDateFrom", "#pendingDateTo"].forEach((selector) => setValue(selector, ""));
    ["#pendingChannelFilter", "#pendingTypeFilter", "#pendingPriorityFilter", "#pendingStatusFilter", "#pendingClientTypeFilter", "#pendingSlaFilter"]
      .forEach((selector) => setValue(selector, "todos"));
    renderPendingCases();
  });

  $("#exportPendingCasesBtn")?.addEventListener("click", () => openModal("#pendingExportModal"));
  $("#bulkExportPendingBtn")?.addEventListener("click", () => openModal("#pendingExportModal"));
  $("#openBulkPendingActionsBtn")?.addEventListener("click", openBulkPendingActionsModal);
  $("#confirmBulkPendingActionBtn")?.addEventListener("click", confirmBulkPendingAction);
  $("#confirmPendingExportBtn")?.addEventListener("click", confirmPendingExport);

  $("#pendingCaseClassifyBtn")?.addEventListener("click", () => {
    closeModals();
    openClassifyCaseModal(State.selectedCaseId);
  });

  $("#pendingCaseSendAssignBtn")?.addEventListener("click", () => {
    closeModals();
    openSendToAssignmentModal(State.selectedCaseId);
  });

  $("#pendingCasePriorityBtn")?.addEventListener("click", () => {
    closeModals();
    openChangePriorityModal(State.selectedCaseId);
  });

  $("#pendingCaseObserveBtn")?.addEventListener("click", () => {
    closeModals();
    openObserveCaseModal(State.selectedCaseId);
  });

  $("#confirmClassifyCaseBtn")?.addEventListener("click", confirmClassifyCase);
  $("#confirmChangePriorityBtn")?.addEventListener("click", confirmChangePriority);
  $("#confirmObserveCaseBtn")?.addEventListener("click", confirmObserveCase);
  $("#confirmSendToAssignmentBtn")?.addEventListener("click", confirmSendToAssignment);

  $("#classifyCaseAiBtn")?.addEventListener("click", suggestClassification);

  $("#clearPendingSelectionBtn")?.addEventListener("click", () => clearSelection("pending"));

  bindPagination({
    key: "pending",
    prevSelector: "#pendingPrevPageBtn",
    nextSelector: "#pendingNextPageBtn",
    pageSizeSelector: "#pendingPageSize",
    render: renderPendingCases
  });
}

async function renderPendingCases() {
  try {
    if (!State.cases.length) {
      await loadCases({
        endpoint: State.config.mainEndpoint,
        ...getPendingBackendParams()
      });
    }

    const allRows = pendingFilteredCases();
    const pageRows = paginateRows(allRows, "pending");

    setText("#pendingSummaryTitle", `${allRows.length} pendientes visibles`);
    setText("#pendingSummaryText", `Filtro actual: ${State.filters.pending}.`);

    renderKpis("#pendingKpiGrid", [
      { icon: "📋", value: allRows.length, label: "Pendientes visibles", description: "Resultado del filtro" },
      { icon: "🧭", value: allRows.filter((c) => c.classificationStatus === "Sin clasificar").length, label: "Sin clasificar", description: "Requieren tipificación" },
      { icon: "👥", value: allRows.filter((c) => c.assignmentStatus === "Sin asesor").length, label: "Sin asesor", description: "Requieren responsable" },
      { icon: "🔥", value: allRows.filter((c) => priorityValue(c.priority) === 4).length, label: "Críticos", description: "Atención inmediata" }
    ]);

    setHTML("#pendingCasesList", pageRows.map((item) => renderCaseCard(item, "pending", "pending")).join(""));
    setHTML("#pendingCasesTableBody", pageRows.map((item) => renderCaseTableRow(item, "pending", "pending")).join(""));

    show("#pendingCasesList", State.views.pending === "cards");
    show("#pendingCasesTableWrap", State.views.pending === "table");
    show("#emptyPendingCasesState", !allRows.length);

    updatePaginationUI("pending", "#pendingPaginationSummary", "#pendingCurrentPage");

    renderAi("#pendingAiSummary", buildPendingAi(allRows));
    renderChecklist("#pendingActionPlan", buildPendingPlan(allRows));

    bindCaseActions($("#pendingCasesList"));
    bindCaseActions($("#pendingCasesTableBody"));
    updateBulkBars();
  } catch (error) {
    renderAi("#pendingAiSummary", [{ title: "No se pudieron cargar pendientes", text: error.message }]);
    show("#emptyPendingCasesState", true);
  }
}

function getPendingBackendParams() {
  return {
    filtro: State.filters.pending,
    busqueda: getValue("#pendingCaseSearch"),
    fecha_desde: getValue("#pendingDateFrom"),
    fecha_hasta: getValue("#pendingDateTo"),
    canal: getValue("#pendingChannelFilter"),
    tipo: getValue("#pendingTypeFilter"),
    prioridad: getValue("#pendingPriorityFilter"),
    estado: getValue("#pendingStatusFilter"),
    tipo_cliente: getValue("#pendingClientTypeFilter"),
    sla: getValue("#pendingSlaFilter")
  };
}

function pendingFilteredCases() {
  const query = getValue("#pendingCaseSearch").toLowerCase();

  return getPendingCases().filter((item) => {
    const text = `${item.code} ${item.clientName} ${item.type} ${item.channel} ${item.priority} ${item.status} ${item.classificationStatus} ${item.assignmentStatus}`.toLowerCase();
    const filter = State.filters.pending;

    const matchesQuickFilter =
      filter === "todos" ||
      (filter === "sin_clasificar" && item.classificationStatus === "Sin clasificar") ||
      (filter === "sin_asignar" && item.assignmentStatus === "Sin asesor") ||
      (filter === "observados" && item.observed) ||
      (filter === "criticos" && priorityValue(item.priority) === 4) ||
      (filter === "sla_riesgo" && item.slaHours <= 8);

    const matchesAdvanced =
      matchSelect(item.channel, "#pendingChannelFilter") &&
      matchSelect(item.type, "#pendingTypeFilter") &&
      matchSelect(item.priority, "#pendingPriorityFilter") &&
      matchSelect(item.status, "#pendingStatusFilter") &&
      matchSelect(item.clientType, "#pendingClientTypeFilter") &&
      matchSlaRange(item, "#pendingSlaFilter");

    return (!query || text.includes(query)) && matchesQuickFilter && matchesAdvanced;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function matchSelect(value, selector) {
  const selected = getValue(selector);
  if (!selected || selected === "todos" || selected === "todas") return true;
  return String(value).toLowerCase() === String(selected).toLowerCase();
}

function matchSlaRange(item, selector) {
  const selected = getValue(selector);
  if (!selected || selected === "todos") return true;

  if (selected === "vencido") return item.slaHours < 0;
  if (selected === "menos_4h") return item.slaHours >= 0 && item.slaHours <= 4;
  if (selected === "menos_8h") return item.slaHours >= 0 && item.slaHours <= 8;
  if (selected === "menos_24h") return item.slaHours >= 0 && item.slaHours <= 24;

  return true;
}

function buildPendingAi(rows) {
  return [
    { title: "Primero", text: rows.some(slaRisk) ? "Revisar casos críticos sin clasificar o sin asesor." : "La bandeja no tiene casos críticos visibles." },
    { title: "Luego", text: "Observar casos con información incompleta antes de asignarlos." },
    { title: "Después", text: "Enviar a asignación los casos ya clasificados y con evidencia suficiente." }
  ];
}

function buildPendingPlan(rows) {
  return [
    { icon: "1", title: "Clasificar críticos", text: `${rows.filter((c) => priorityValue(c.priority) === 4).length} caso(s) críticos.` },
    { icon: "2", title: "Corregir observados", text: "Devuelve casos incompletos con observación clara." },
    { icon: "3", title: "Enviar a asignación", text: "Pasa casos validados a la cola de responsables." }
  ];
}

function openPendingCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);

  setText("#pendingCaseModalIcon", item.icon);
  setText("#pendingCaseModalTitle", item.code);
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

function openChangePriorityModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#changePriorityContext", caseSummary(item));
  openModal("#changePriorityModal");
}

function openObserveCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#observeCaseContext", caseSummary(item));
  openModal("#observeCaseModal");
}

function openSendToAssignmentModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#sendToAssignmentContext", caseSummary(item));
  openModal("#sendToAssignmentModal");
}

function suggestClassification() {
  const item = getCase(State.selectedCaseId);

  if (!item) return;

  setValue("#classifyCaseType", item.type);
  setValue("#classifyCasePriority", priorityValue(item.priority) === 4 || item.slaHours <= 8 ? "Crítica" : item.priority);
  setValue("#classifyCaseReason", "Sugerencia calculada según tipo de caso, criticidad, SLA restante y servicio afectado.");

  toast("Sugerencia aplicada", "Se completó parte de la clasificación sugerida.", "success");
}

async function confirmClassifyCase() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#classifyCaseType") ||
    !getValue("#classifyCaseCategory") ||
    !getValue("#classifyCasePriority") ||
    !getValue("#classifyCaseRoute") ||
    !getValue("#classifyCaseReason") ||
    !isChecked("#classifyCaseDeclaration")
  ) {
    toast("Faltan datos", "Completa tipo, categoría, prioridad, ruta, sustento y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar clasificación",
    text: "La clasificación actualizará la trazabilidad del caso.",
    summary: caseSummary(item),
    action: "clasificar",
    caseId: State.selectedCaseId,
    payload: {
      tipo_caso: getValue("#classifyCaseType"),
      categoria: getValue("#classifyCaseCategory"),
      prioridad: getValue("#classifyCasePriority"),
      ruta: getValue("#classifyCaseRoute"),
      sla_interno: getValue("#classifyCaseInternalSla"),
      visibilidad: getValue("#classifyCaseVisibility"),
      motivo: getValue("#classifyCaseReason")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderPendingCases();
    }
  });
}

async function confirmChangePriority() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#newPriority") ||
    !getValue("#priorityReasonType") ||
    !getValue("#priorityComment") ||
    !isChecked("#priorityDeclaration")
  ) {
    toast("Faltan datos", "Completa prioridad, motivo, comentario y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar cambio de prioridad",
    text: "El cambio de prioridad quedará registrado en auditoría.",
    summary: caseSummary(item),
    action: "prioridad",
    caseId: State.selectedCaseId,
    payload: {
      prioridad: getValue("#newPriority"),
      tipo_motivo: getValue("#priorityReasonType"),
      comentario: getValue("#priorityComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderPendingCases();
    }
  });
}

async function confirmObserveCase() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#observeReason") ||
    !getValue("#observeReturnTo") ||
    !getValue("#observeComment") ||
    !isChecked("#observeDeclaration")
  ) {
    toast("Faltan datos", "Completa motivo, retorno, detalle y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar observación",
    text: "El caso será observado y retornado a la cola indicada.",
    summary: caseSummary(item),
    action: "observar",
    caseId: State.selectedCaseId,
    payload: {
      motivo: getValue("#observeReason"),
      retorno: getValue("#observeReturnTo"),
      visibilidad: getValue("#observeVisibility"),
      fecha_subsanacion: getValue("#observeDueDate"),
      comentario: getValue("#observeComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderPendingCases();
    }
  });
}

async function confirmSendToAssignment() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#assignmentSuggestion") ||
    !getValue("#assignmentQueue") ||
    !isChecked("#assignmentDeclaration")
  ) {
    toast("Faltan datos", "Completa criterio, cola destino y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar envío a asignación",
    text: "El caso quedará listo para asignar responsable.",
    summary: caseSummary(item),
    action: "enviar-asignacion",
    caseId: State.selectedCaseId,
    payload: {
      sugerencia: getValue("#assignmentSuggestion"),
      cola: getValue("#assignmentQueue"),
      prioridad: getValue("#assignmentPriority"),
      modo: getValue("#assignmentMode"),
      comentario: getValue("#assignmentComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderPendingCases();
    }
  });
}

function openBulkPendingActionsModal() {
  const selected = getSelectedIds("pending");

  setHTML("#bulkPendingSummary", summaryHTML([
    ["Casos seleccionados", selected.length],
    ["Filtro actual", State.filters.pending],
    ["Acción", "Pendiente de selección"]
  ]));

  openModal("#bulkPendingActionsModal");
}

async function confirmBulkPendingAction() {
  if (!getValue("#bulkPendingActionType") || !isChecked("#bulkPendingDeclaration")) {
    toast("Faltan datos", "Selecciona acción y confirma la declaración.", "warning");
    return;
  }

  const selected = getSelectedIds("pending");

  openConfirmAction({
    title: "Confirmar acción masiva",
    text: "La acción se aplicará sobre el lote seleccionado o filtrado.",
    summary: summaryHTML([
      ["Acción", getValue("#bulkPendingActionType")],
      ["Seleccionados", selected.length],
      ["Cola", getValue("#bulkPendingQueue") || "No aplica"],
      ["Prioridad", getValue("#bulkPendingPriority") || "Mantener"]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/casos-pendientes/accion-masiva", {
        method: "POST",
        body: JSON.stringify({
          accion: getValue("#bulkPendingActionType"),
          selected_ids: selected,
          cola: getValue("#bulkPendingQueue"),
          prioridad: getValue("#bulkPendingPriority"),
          formato: getValue("#bulkPendingFormat"),
          comentario: getValue("#bulkPendingComment"),
          filters: currentPageFilters()
        })
      });

      closeModals();
      clearSelection("pending");
      State.cases = [];
      await renderPendingCases();
      toast("Acción masiva registrada", "La acción fue procesada correctamente.", "success");
    }
  });
}

async function confirmPendingExport() {
  await requestExport({
    format: getValue("#pendingExportFormat"),
    scope: getValue("#pendingExportScope"),
    detail: getValue("#pendingExportDetail"),
    destination: getValue("#pendingExportDestination"),
    reason: getValue("#pendingExportReason"),
    selectedIds: getSelectedIds("pending"),
    include: {
      client: isChecked("#pendingExportIncludeClient"),
      sla: isChecked("#pendingExportIncludeSla"),
      history: isChecked("#pendingExportIncludeHistory"),
      comments: isChecked("#pendingExportIncludeComments")
    }
  });

  closeModals();
}

/* =========================================================
   ASIGNACIONES
========================================================= */

async function initAssignments() {
  bindAssignmentEvents();
  await Promise.all([loadAdvisors(), renderAssignments()]);
  processCaseDeepLink();
}

function bindAssignmentEvents() {
  $("#assignmentsSearch")?.addEventListener("input", () => {
    State.pagination.assignments.page = 1;
    renderAssignments();
  });

  $$("[data-assignment-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.assignments = button.dataset.assignmentFilter || "todos";
      State.pagination.assignments.page = 1;

      $$("[data-assignment-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderAssignments();
    });
  });

  $("#toggleAssignmentsViewBtn")?.addEventListener("click", () => {
    State.views.assignments = State.views.assignments === "cards" ? "table" : "cards";
    setText("#toggleAssignmentsViewBtn", State.views.assignments === "cards" ? "Vista tabla" : "Vista cards");
    renderAssignments();
  });

  $("#refreshAssignmentsBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderAssignments();
  });

  $("#applyAssignmentsAdvancedFiltersBtn")?.addEventListener("click", renderAssignments);

  $("#resetAssignmentsAdvancedFiltersBtn")?.addEventListener("click", () => {
    [
      "#assignmentsDateFrom",
      "#assignmentsDateTo"
    ].forEach((selector) => setValue(selector, ""));

    [
      "#assignmentsAdvisorFilter",
      "#assignmentsAreaFilter",
      "#assignmentsPriorityFilter",
      "#assignmentsStatusFilter",
      "#assignmentsTypeFilter",
      "#assignmentsSlaFilter"
    ].forEach((selector) => setValue(selector, "todos"));

    renderAssignments();
  });

  $("#exportAssignmentsBtn")?.addEventListener("click", () => openModal("#assignmentsExportModal"));
  $("#bulkExportAssignmentsBtn")?.addEventListener("click", () => openModal("#assignmentsExportModal"));
  $("#confirmAssignmentsExportBtn")?.addEventListener("click", confirmAssignmentsExport);

  $("#openMassAssignmentBtn")?.addEventListener("click", () => openModal("#massAssignmentModal"));
  $("#confirmMassAssignmentBtn")?.addEventListener("click", prepareMassAssignment);
  $("#applyMassAssignmentBtn")?.addEventListener("click", applyMassAssignment);
  $("#massAssignmentAiBtn")?.addEventListener("click", suggestMassAssignment);

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
  $("#assignAdvisorAiBtn")?.addEventListener("click", suggestAdvisorAssignment);
  $("#confirmReassignCaseBtn")?.addEventListener("click", confirmReassignCase);
  $("#reassignAiBtn")?.addEventListener("click", suggestReassignment);
  $("#confirmDeriveAreaBtn")?.addEventListener("click", confirmDeriveArea);
  $("#confirmEscalateCaseBtn")?.addEventListener("click", confirmEscalateCase);

  $("#assignAdvisorSelect")?.addEventListener("change", renderAssignAdvisorCapacityPreview);
  $("#reassignToAdvisor")?.addEventListener("change", renderReassignComparisonPreview);

  $("#clearAssignmentsSelectionBtn")?.addEventListener("click", () => clearSelection("assignments"));

  bindPagination({
    key: "assignments",
    prevSelector: "#assignmentsPrevPageBtn",
    nextSelector: "#assignmentsNextPageBtn",
    pageSizeSelector: "#assignmentsPageSize",
    render: renderAssignments
  });
}

async function renderAssignments() {
  try {
    if (!State.cases.length) {
      await loadCases({
        endpoint: State.config.mainEndpoint,
        ...getAssignmentBackendParams()
      });
    }

    const allRows = assignmentFilteredCases();
    const pageRows = paginateRows(allRows, "assignments");

    setText("#assignmentsSummaryTitle", `${allRows.length} casos visibles`);
    setText("#assignmentsSummaryText", `Filtro actual: ${State.filters.assignments}.`);

    renderKpis("#assignmentsKpiGrid", [
      { icon: "👥", value: allRows.length, label: "Casos visibles", description: "Resultado del filtro" },
      { icon: "🧭", value: allRows.filter((c) => c.assignmentStatus === "Sin asesor").length, label: "Sin asesor", description: "Pendientes de responsable" },
      { icon: "🔁", value: allRows.filter((c) => c.blocked).length, label: "Reasignables", description: "Bloqueados o sobrecarga" },
      { icon: "🚨", value: allRows.filter((c) => c.escalated || priorityValue(c.priority) === 4).length, label: "Escalables", description: "Riesgo alto" }
    ]);

    setHTML("#assignmentsCaseList", pageRows.map((item) => renderCaseCard(item, "assignment", "assignments")).join(""));
    setHTML("#assignmentsTableBody", pageRows.map((item) => renderCaseTableRow(item, "assignment", "assignments")).join(""));

    show("#assignmentsCaseList", State.views.assignments === "cards");
    show("#assignmentsTableWrap", State.views.assignments === "table");
    show("#emptyAssignmentsState", !allRows.length);

    updatePaginationUI("assignments", "#assignmentsPaginationSummary", "#assignmentsCurrentPage");

    renderAi("#assignmentsAiSummary", buildAssignmentAi(allRows));
    renderChecklist("#assignmentsActionPlan", buildAssignmentPlan(allRows));

    bindCaseActions($("#assignmentsCaseList"));
    bindCaseActions($("#assignmentsTableBody"));
    updateBulkBars();
  } catch (error) {
    renderAi("#assignmentsAiSummary", [{ title: "No se pudieron cargar asignaciones", text: error.message }]);
    show("#emptyAssignmentsState", true);
  }
}

function getAssignmentBackendParams() {
  return {
    filtro: State.filters.assignments,
    busqueda: getValue("#assignmentsSearch"),
    fecha_desde: getValue("#assignmentsDateFrom"),
    fecha_hasta: getValue("#assignmentsDateTo"),
    asesor: getValue("#assignmentsAdvisorFilter"),
    area: getValue("#assignmentsAreaFilter"),
    prioridad: getValue("#assignmentsPriorityFilter"),
    estado: getValue("#assignmentsStatusFilter"),
    tipo: getValue("#assignmentsTypeFilter"),
    sla: getValue("#assignmentsSlaFilter")
  };
}

function assignmentFilteredCases() {
  const query = getValue("#assignmentsSearch").toLowerCase();

  return State.cases.map(normalizeCase).filter((item) => {
    const text = `${item.code} ${item.clientName} ${item.advisorName} ${item.area} ${item.priority} ${item.status} ${item.assignmentFlow}`.toLowerCase();
    const filter = State.filters.assignments;

    const matchesQuickFilter =
      filter === "todos" ||
      (filter === "sin_asesor" && item.assignmentStatus === "Sin asesor") ||
      (filter === "reasignar" && item.blocked) ||
      (filter === "derivados" && item.derived) ||
      (filter === "escalados" && item.escalated) ||
      (filter === "criticos" && priorityValue(item.priority) === 4);

    const matchesAdvanced =
      matchSelect(item.advisorId || item.advisorName, "#assignmentsAdvisorFilter") &&
      matchSelect(item.area, "#assignmentsAreaFilter") &&
      matchSelect(item.priority, "#assignmentsPriorityFilter") &&
      matchSelect(item.status, "#assignmentsStatusFilter") &&
      matchSelect(item.type, "#assignmentsTypeFilter") &&
      matchSlaRange(item, "#assignmentsSlaFilter");

    return (!query || text.includes(query)) && matchesQuickFilter && matchesAdvanced;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function buildAssignmentAi(rows) {
  return [
    { title: "Asignar primero", text: `${rows.filter((c) => c.assignmentStatus === "Sin asesor" && slaRisk(c)).length} caso(s) críticos sin asesor.` },
    { title: "Evitar sobrecarga", text: "No asignes nuevos casos a asesores con carga mayor a 85%." },
    { title: "Escalar", text: "Casos vencidos o bloqueados deben pasar a mesa crítica o jefatura." }
  ];
}

function buildAssignmentPlan(rows) {
  return [
    { icon: "1", title: "Resolver sin asesor", text: `${rows.filter((c) => c.assignmentStatus === "Sin asesor").length} caso(s) sin responsable.` },
    { icon: "2", title: "Reasignar sobrecarga", text: "Mover casos desde asesores saturados a disponibles." },
    { icon: "3", title: "Escalar vencidos", text: `${rows.filter((c) => c.slaHours < 0).length} caso(s) vencido(s).` }
  ];
}

function openAssignmentCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);

  setText("#assignmentCaseModalIcon", item.icon);
  setText("#assignmentCaseModalTitle", item.code);
  setText("#assignmentCaseModalText", item.description);
  setHTML("#assignmentCaseModalSummary", caseSummary(item));

  openModal("#assignmentCaseModal");
}

function openAssignAdvisorModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#assignAdvisorContext", caseSummary(item));
  renderAssignAdvisorCapacityPreview();
  openModal("#assignAdvisorModal");
}

function renderAssignAdvisorCapacityPreview() {
  const advisor = getAdvisor(getValue("#assignAdvisorSelect"));

  setHTML("#assignAdvisorCapacityPreview", advisor
    ? summaryHTML([
      ["Asesor seleccionado", advisor.name],
      ["Carga actual", `${advisor.capacity}%`],
      ["Casos críticos", advisor.critical],
      ["SLA en riesgo", advisor.slaRisk]
    ])
    : summaryHTML([
      ["Asesor seleccionado", "Pendiente"],
      ["Carga actual", "-"],
      ["Casos críticos", "-"],
      ["SLA en riesgo", "-"]
    ])
  );
}

function suggestAdvisorAssignment() {
  const advisor = State.advisors
    .map(normalizeAdvisor)
    .filter((item) => !String(item.status).toLowerCase().includes("no disponible"))
    .sort((a, b) => a.capacity - b.capacity)[0];

  if (!advisor) {
    toast("Sin asesor sugerido", "No hay asesores disponibles para sugerir.", "warning");
    return;
  }

  setValue("#assignAdvisorSelect", advisor.id);
  setValue("#assignCriterion", "menor_carga");
  setValue("#assignVisibility", "asesor");
  setValue("#assignComment", `Se sugiere asignar a ${advisor.name} por menor carga relativa y disponibilidad.`);
  renderAssignAdvisorCapacityPreview();

  toast("Asesor sugerido", `Se sugirió a ${advisor.name}.`, "success");
}

async function confirmAssignAdvisor() {
  if (!State.selectedCaseId) return;

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

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar asignación",
    text: "El caso quedará asignado al asesor seleccionado.",
    summary: caseSummary(item),
    action: "asignar",
    caseId: State.selectedCaseId,
    payload: {
      asesor_id: getValue("#assignAdvisorSelect"),
      cola: getValue("#assignQueueSelect"),
      criterio: getValue("#assignCriterion"),
      visibilidad: getValue("#assignVisibility"),
      comentario: getValue("#assignComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderAssignments();
    }
  });
}

function openReassignCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#reassignCaseContext", caseSummary(item));
  setValue("#reassignFromAdvisor", item.advisorName);
  renderReassignComparisonPreview();
  openModal("#reassignCaseModal");
}

function renderReassignComparisonPreview() {
  const item = getCase(State.selectedCaseId);
  const destination = getAdvisor(getValue("#reassignToAdvisor"));

  setHTML("#reassignComparisonPreview", summaryHTML([
    ["Origen", item?.advisorName || "Pendiente"],
    ["Destino", destination?.name || "Pendiente"],
    ["Impacto SLA", item?.slaText || "Por calcular"],
    ["Notificación", "Asesor origen y destino"]
  ]));
}

function suggestReassignment() {
  const advisor = State.advisors
    .map(normalizeAdvisor)
    .filter((item) => !String(item.status).toLowerCase().includes("no disponible"))
    .sort((a, b) => a.capacity - b.capacity)[0];

  if (!advisor) return;

  setValue("#reassignToAdvisor", advisor.id);
  setValue("#reassignReason", "sobrecarga");
  setValue("#reassignPriority", "alta");
  setValue("#reassignComment", `Se recomienda reasignar a ${advisor.name} para reducir concentración de carga y riesgo SLA.`);
  renderReassignComparisonPreview();

  toast("Destino sugerido", `Se sugirió a ${advisor.name}.`, "success");
}

async function confirmReassignCase() {
  if (!State.selectedCaseId) return;

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

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar reasignación",
    text: "El caso cambiará de responsable y se notificará el movimiento.",
    summary: caseSummary(item),
    action: "reasignar",
    caseId: State.selectedCaseId,
    payload: {
      asesor_id: getValue("#reassignToAdvisor"),
      motivo: getValue("#reassignReason"),
      prioridad: getValue("#reassignPriority"),
      comentario: getValue("#reassignComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderAssignments();
    }
  });
}

function openDeriveAreaModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#deriveAreaContext", caseSummary(item));
  openModal("#deriveAreaModal");
}

async function confirmDeriveArea() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#deriveAreaSelect") ||
    !getValue("#deriveAreaSla") ||
    !getValue("#deriveAreaReason") ||
    !isChecked("#deriveAreaDeclaration")
  ) {
    toast("Faltan datos", "Completa área, SLA, motivo y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar derivación",
    text: "El caso será enviado al área destino indicada.",
    summary: caseSummary(item),
    action: "derivar",
    caseId: State.selectedCaseId,
    payload: {
      area: getValue("#deriveAreaSelect"),
      sla: getValue("#deriveAreaSla"),
      visibilidad: getValue("#deriveAreaVisibility"),
      notificar: getValue("#deriveAreaNotify"),
      motivo: getValue("#deriveAreaReason")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderAssignments();
    }
  });
}

function openEscalateCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);
  setHTML("#escalateCaseContext", caseSummary(item));
  openModal("#escalateCaseModal");
}

async function confirmEscalateCase() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#escalateLevel") ||
    !getValue("#escalateReason") ||
    !getValue("#escalateComment") ||
    !isChecked("#escalateDeclaration")
  ) {
    toast("Faltan datos", "Completa nivel, motivo, comentario y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openBackendConfirm({
    title: "Confirmar escalamiento",
    text: "El caso será escalado y quedará marcado como evento crítico.",
    summary: caseSummary(item),
    action: "escalar",
    caseId: State.selectedCaseId,
    payload: {
      nivel: getValue("#escalateLevel"),
      motivo: getValue("#escalateReason"),
      urgencia: getValue("#escalateUrgency"),
      canal: getValue("#escalateNotifyChannel"),
      comentario: getValue("#escalateComment")
    },
    onSuccess: async () => {
      State.cases = [];
      await renderAssignments();
    }
  });
}

function suggestMassAssignment() {
  setValue("#massAssignmentCriteria", "menor_carga");
  setValue("#massAssignmentScope", getSelectedIds("assignments").length ? "seleccionados" : "sin_asesor");
  setValue("#massAssignmentComment", "Sugerencia basada en menor carga, disponibilidad y riesgo SLA.");
  toast("Criterio sugerido", "Se sugirió asignación por menor carga.", "success");
}

async function prepareMassAssignment() {
  if (
    !getValue("#massAssignmentCriteria") ||
    !getValue("#massAssignmentScope") ||
    !isChecked("#massAssignmentDeclaration")
  ) {
    toast("Faltan datos", "Completa criterio, alcance y confirmación.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/asignacion-masiva/preview", {
      method: "POST",
      body: JSON.stringify({
        criterio: getValue("#massAssignmentCriteria"),
        alcance: getValue("#massAssignmentScope"),
        cola: getValue("#massAssignmentQueue"),
        maximo_por_asesor: getValue("#massAssignmentMaxPerAdvisor"),
        comentario: getValue("#massAssignmentComment"),
        selected_ids: getSelectedIds("assignments"),
        filters: currentPageFilters()
      })
    });

    const rows = listFrom(response, ["items", "preview", "propuesta", "casos"]);
    State.lastMassAssignmentPreview = normalizePayload(response);

    setText("#massAssignmentPreviewText", `${rows.length} caso(s) incluidos en la propuesta.`);
    setHTML("#massAssignmentPreviewBody", rows.map((item) => `
      <tr>
        <td>${esc(item.codigo_caso || item.code || item.caso || "-")}</td>
        <td>${esc(item.cliente || item.cliente_nombre || "-")}</td>
        <td>${esc(item.asesor_sugerido || item.asesor || "-")}</td>
        <td>${esc(item.motivo || item.criterio || "-")}</td>
        <td>${esc(item.resultado || "Incluido")}</td>
      </tr>
    `).join(""));

    show("#massAssignmentPreviewPanel", true);
    show("#applyMassAssignmentBtn", true);

    toast("Vista previa generada", "Revisa la distribución antes de aplicarla.", "success");
  } catch (error) {
    genericModal("!", "No se pudo preparar asignación", error.message);
  }
}

async function applyMassAssignment() {
  if (!State.lastMassAssignmentPreview) {
    toast("Vista previa requerida", "Primero prepara la asignación masiva.", "warning");
    return;
  }

  openConfirmAction({
    title: "Aplicar asignación masiva",
    text: "La distribución propuesta será aplicada y auditada.",
    summary: summaryHTML([
      ["Criterio", getValue("#massAssignmentCriteria")],
      ["Alcance", getValue("#massAssignmentScope")],
      ["Seleccionados", getSelectedIds("assignments").length]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/asignacion-masiva/aplicar", {
        method: "POST",
        body: JSON.stringify({
          preview: State.lastMassAssignmentPreview,
          selected_ids: getSelectedIds("assignments"),
          filters: currentPageFilters()
        })
      });

      closeModals();
      clearSelection("assignments");
      State.cases = [];
      await renderAssignments();

      toast("Asignación masiva aplicada", "La asignación fue procesada correctamente.", "success");
    }
  });
}

async function confirmAssignmentsExport() {
  await requestExport({
    format: getValue("#assignmentsExportFormat"),
    scope: getValue("#assignmentsExportScope"),
    detail: getValue("#assignmentsExportDetail"),
    destination: getValue("#assignmentsExportDestination"),
    reason: getValue("#assignmentsExportReason"),
    selectedIds: getSelectedIds("assignments"),
    include: {
      client: isChecked("#assignmentsExportIncludeClient"),
      advisor: isChecked("#assignmentsExportIncludeAdvisor"),
      sla: isChecked("#assignmentsExportIncludeSla"),
      audit: isChecked("#assignmentsExportIncludeAudit")
    }
  });

  closeModals();
}

/* =========================================================
   ASESORES / CARGA DE ASESORES
========================================================= */

async function initAdvisorLoad() {
  bindAdvisorLoadEvents();
  await renderAdvisorLoadPage();
}

function bindAdvisorLoadEvents() {
  $("#advisorLoadSearch")?.addEventListener("input", () => {
    State.pagination.advisors.page = 1;
    renderAdvisorLoadPage();
  });

  $$("[data-load-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.advisors = button.dataset.loadFilter || "todos";
      State.pagination.advisors.page = 1;

      $$("[data-load-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderAdvisorLoadPage();
    });
  });

  $("#toggleAdvisorLoadViewBtn")?.addEventListener("click", () => {
    State.views.advisors = State.views.advisors === "cards" ? "table" : "cards";
    setText("#toggleAdvisorLoadViewBtn", State.views.advisors === "cards" ? "Vista tabla" : "Vista cards");
    renderAdvisorLoadPage();
  });

  $("#refreshAdvisorLoadPageBtn")?.addEventListener("click", async () => {
    State.advisors = [];
    await renderAdvisorLoadPage();
  });

  $("#refreshLoadMapBtn")?.addEventListener("click", renderAdvisorLoadMap);
  $("#applyAdvisorLoadFiltersBtn")?.addEventListener("click", renderAdvisorLoadPage);

  $("#resetAdvisorLoadFiltersBtn")?.addEventListener("click", () => {
    [
      "#advisorLoadAreaFilter",
      "#advisorLoadSpecialtyFilter",
      "#advisorLoadAvailabilityFilter",
      "#advisorLoadCapacityFilter",
      "#advisorLoadShiftFilter",
      "#advisorLoadProductivityFilter"
    ].forEach((selector) => setValue(selector, "todos"));

    setValue("#advisorLoadCriticalMinFilter", "");
    setValue("#advisorLoadSlaMinFilter", "");

    renderAdvisorLoadPage();
  });

  $("#openRedistributeLoadBtn")?.addEventListener("click", () => openRedistributeLoadModal());
  $("#bulkRedistributeLoadBtn")?.addEventListener("click", () => openRedistributeLoadModal());
  $("#prepareRedistributeLoadBtn")?.addEventListener("click", prepareRedistributionPreview);
  $("#confirmRedistributeLoadBtn")?.addEventListener("click", applyRedistribution);
  $("#redistributeLoadAiBtn")?.addEventListener("click", suggestRedistribution);

  $("#bulkChangeAvailabilityBtn")?.addEventListener("click", openBulkAdvisorAvailabilityModal);
  $("#confirmBulkAdvisorAvailabilityBtn")?.addEventListener("click", confirmBulkAdvisorAvailability);

  $("#confirmAdvisorAvailabilityBtn")?.addEventListener("click", confirmAdvisorAvailability);

  $("#exportAdvisorLoadBtn")?.addEventListener("click", () => openModal("#advisorLoadExportModal"));
  $("#bulkExportAdvisorLoadBtn")?.addEventListener("click", () => openModal("#advisorLoadExportModal"));
  $("#confirmAdvisorLoadExportBtn")?.addEventListener("click", confirmAdvisorLoadExport);

  $("#advisorDetailReassignBtn")?.addEventListener("click", () => {
    closeModals();
    openRedistributeLoadModal(State.selectedAdvisorId);
  });

  $("#advisorDetailAvailabilityBtn")?.addEventListener("click", () => {
    closeModals();
    openAdvisorAvailabilityModal(State.selectedAdvisorId);
  });

  $("#advisorDetailAuditBtn")?.addEventListener("click", () => {
    window.location.href = `auditoria-casos.html?advisor=${encodeURIComponent(State.selectedAdvisorId || "")}`;
  });

  $("#clearAdvisorLoadSelectionBtn")?.addEventListener("click", () => clearSelection("advisors"));

  bindPagination({
    key: "advisors",
    prevSelector: "#advisorLoadPrevPageBtn",
    nextSelector: "#advisorLoadNextPageBtn",
    pageSizeSelector: "#advisorLoadPageSize",
    render: renderAdvisorLoadPage
  });
}

async function renderAdvisorLoadPage() {
  try {
    if (!State.advisors.length) {
      const response = await apiRequest(`${State.config.mainEndpoint}${buildQuery(getAdvisorLoadBackendParams())}`);
      const payload = normalizePayload(response);

      State.advisors = listFrom(payload, [
        "items",
        "advisors",
        "asesores",
        "asesores_carga",
        "team",
        "equipo"
      ]);

      State.cases = listFrom(payload, [
        "cases",
        "casos",
        "assigned_cases",
        "casos_asignados"
      ]);
    }

    const allRows = advisorLoadFiltered();
    const pageRows = paginateRows(allRows, "advisors");

    setText("#advisorLoadSummaryTitle", `${allRows.length} asesores visibles`);
    setText("#advisorLoadSummaryText", `Filtro actual: ${State.filters.advisors}.`);

    renderKpis("#advisorLoadKpiGrid", [
      { icon: "👥", value: allRows.length, label: "Asesores visibles", description: "Resultado del filtro" },
      { icon: "🟢", value: allRows.filter((a) => advisorStatusType(a.status) === "success").length, label: "Disponibles", description: "Pueden recibir casos" },
      { icon: "⚠️", value: allRows.filter((a) => a.capacity >= 85).length, label: "Sobrecargados", description: "Carga alta" },
      { icon: "⏱️", value: allRows.reduce((acc, a) => acc + Number(a.slaRisk || 0), 0), label: "SLA en riesgo", description: "Casos bajo atención" }
    ]);

    setHTML("#advisorLoadList", pageRows.map((item) => advisorLoadCard(item, "advisors")).join(""));
    setHTML("#advisorLoadTableBody", pageRows.map((item) => advisorLoadTableRow(item, "advisors")).join(""));

    show("#advisorLoadList", State.views.advisors === "cards");
    show("#advisorLoadTableWrap", State.views.advisors === "table");
    show("#emptyAdvisorLoadPageState", !allRows.length);

    updatePaginationUI("advisors", "#advisorLoadPaginationSummary", "#advisorLoadCurrentPage");

    renderAi("#advisorLoadAiSummary", buildAdvisorLoadAi(allRows));
    renderChecklist("#advisorLoadActionPlan", buildAdvisorLoadPlan(allRows));
    renderAdvisorLoadMap();

    populateAdvisorSelects();
    bindAdvisorButtons(document);
    bindSelectionEvents(document);
    updateBulkBars();
  } catch (error) {
    renderAi("#advisorLoadAiSummary", [{ title: "No se pudo cargar la carga de asesores", text: error.message }]);
    show("#emptyAdvisorLoadPageState", true);
  }
}

function getAdvisorLoadBackendParams() {
  return {
    filtro: State.filters.advisors,
    busqueda: getValue("#advisorLoadSearch"),
    area: getValue("#advisorLoadAreaFilter"),
    especialidad: getValue("#advisorLoadSpecialtyFilter"),
    disponibilidad: getValue("#advisorLoadAvailabilityFilter"),
    carga: getValue("#advisorLoadCapacityFilter"),
    turno: getValue("#advisorLoadShiftFilter"),
    productividad: getValue("#advisorLoadProductivityFilter"),
    min_criticos: getValue("#advisorLoadCriticalMinFilter"),
    min_sla: getValue("#advisorLoadSlaMinFilter")
  };
}

function advisorLoadFiltered() {
  const query = getValue("#advisorLoadSearch").toLowerCase();

  return State.advisors.map(normalizeAdvisor).filter((advisor) => {
    const text = `${advisor.name} ${advisor.specialty} ${advisor.status} ${advisor.email} ${advisor.area} ${advisor.shift}`.toLowerCase();
    const filter = State.filters.advisors;

    const matchesQuickFilter =
      filter === "todos" ||
      (filter === "disponibles" && advisorStatusType(advisor.status) === "success") ||
      (filter === "sobrecargados" && advisor.capacity >= 85) ||
      (filter === "criticos" && advisor.critical > 0) ||
      (filter === "sla_riesgo" && advisor.slaRisk > 0) ||
      (filter === "no_disponibles" && advisorStatusType(advisor.status) === "danger");

    const minCritical = Number(getValue("#advisorLoadCriticalMinFilter") || 0);
    const minSla = Number(getValue("#advisorLoadSlaMinFilter") || 0);

    const matchesAdvanced =
      matchSelect(advisor.area, "#advisorLoadAreaFilter") &&
      matchSelect(advisor.specialty, "#advisorLoadSpecialtyFilter") &&
      matchSelect(advisor.status, "#advisorLoadAvailabilityFilter") &&
      matchAdvisorCapacity(advisor, "#advisorLoadCapacityFilter") &&
      matchSelect(advisor.shift, "#advisorLoadShiftFilter") &&
      matchAdvisorProductivity(advisor, "#advisorLoadProductivityFilter") &&
      advisor.critical >= minCritical &&
      advisor.slaRisk >= minSla;

    return (!query || text.includes(query)) && matchesQuickFilter && matchesAdvanced;
  }).sort((a, b) => b.capacity - a.capacity);
}

function matchAdvisorCapacity(advisor, selector) {
  const selected = getValue(selector);
  if (!selected || selected === "todos") return true;

  const value = String(selected).toLowerCase();

  if (value.includes("baja")) return advisor.capacity < 50;
  if (value.includes("media")) return advisor.capacity >= 50 && advisor.capacity < 75;
  if (value.includes("alta")) return advisor.capacity >= 75 && advisor.capacity < 90;
  if (value.includes("sobrecarga")) return advisor.capacity >= 90;

  return true;
}

function matchAdvisorProductivity(advisor, selector) {
  const selected = getValue(selector);
  if (!selected || selected === "todos") return true;

  const value = String(selected).toLowerCase();

  if (value.includes("baja")) return advisor.productivity < 70;
  if (value.includes("media")) return advisor.productivity >= 70 && advisor.productivity < 90;
  if (value.includes("alta")) return advisor.productivity >= 90;

  return true;
}

function advisorLoadCard(item, selectionGroup = "") {
  const advisor = normalizeAdvisor(item);

  const checkbox = selectionGroup
    ? `
      <label class="card-select">
        <input
          type="checkbox"
          data-select-id="${esc(advisor.id)}"
          data-selection-group="${esc(selectionGroup)}"
          ${State.selections[selectionGroup]?.has(String(advisor.id)) ? "checked" : ""}
          aria-label="Seleccionar asesor ${esc(advisor.name)}"
        />
      </label>
    `
    : "";

  return `
    <article class="advisor-load-card">
      ${checkbox}

      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(advisor.initials)}</span>
        <div>
          <h3>${esc(advisor.name)}</h3>
          <p>${esc(advisor.specialty)}</p>
        </div>
        <span class="${pillClass(advisorStatusType(advisor.status))}">${esc(advisor.status)}</span>
      </div>

      <div class="advisor-load-metrics">
        <div><span>Casos</span><strong>${esc(advisor.cases)}</strong></div>
        <div><span>Críticos</span><strong>${esc(advisor.critical)}</strong></div>
        <div><span>SLA</span><strong>${esc(advisor.slaRisk)}</strong></div>
        <div><span>Carga</span><strong>${esc(advisor.capacity)}%</strong></div>
      </div>

      <div class="advisor-load-progress">
        <span style="width:${Math.min(advisor.capacity, 100)}%"></span>
      </div>

      <div class="service-actions">
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(advisor.id)}">Ver</button>
        <button type="button" data-action="redistribute-advisor" data-advisor-id="${esc(advisor.id)}">Redistribuir</button>
        <button type="button" data-action="availability-advisor" data-advisor-id="${esc(advisor.id)}">Disponibilidad</button>
      </div>
    </article>
  `;
}

function advisorLoadTableRow(item, selectionGroup = "") {
  const advisor = normalizeAdvisor(item);

  return `
    <tr>
      <td>
        <input
          type="checkbox"
          data-select-id="${esc(advisor.id)}"
          data-selection-group="${esc(selectionGroup)}"
          ${State.selections[selectionGroup]?.has(String(advisor.id)) ? "checked" : ""}
          aria-label="Seleccionar asesor ${esc(advisor.name)}"
        />
      </td>
      <td>${esc(advisor.name)}</td>
      <td>${esc(advisor.specialty)}</td>
      <td><span class="${pillClass(advisorStatusType(advisor.status))}">${esc(advisor.status)}</span></td>
      <td>${esc(advisor.cases)}</td>
      <td>${esc(advisor.critical)}</td>
      <td>${esc(advisor.slaRisk)}</td>
      <td>${esc(advisor.productivity)}%</td>
      <td>
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(advisor.id)}">Ver</button>
        <button type="button" data-action="redistribute-advisor" data-advisor-id="${esc(advisor.id)}">Redistribuir</button>
      </td>
    </tr>
  `;
}

function bindAdvisorButtons(root = document) {
  $$('[data-action="view-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => openAdvisorDetailModal(button.dataset.advisorId));
  });

  $$('[data-action="redistribute-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => openRedistributeLoadModal(button.dataset.advisorId));
  });

  $$('[data-action="availability-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => openAdvisorAvailabilityModal(button.dataset.advisorId));
  });
}

function buildAdvisorLoadAi(rows) {
  const overloaded = rows.filter((a) => a.capacity >= 85);
  const available = rows.filter((a) => advisorStatusType(a.status) === "success" && a.capacity < 75);

  return [
    { title: "Sobrecarga", text: `${overloaded.length} asesor(es) superan el umbral de carga.` },
    { title: "Capacidad disponible", text: `${available.length} asesor(es) pueden recibir redistribución.` },
    { title: "Riesgo SLA", text: "Prioriza asesores con más casos críticos o SLA vencidos." }
  ];
}

function buildAdvisorLoadPlan(rows) {
  return [
    { icon: "1", title: "Identificar sobrecarga", text: `${rows.filter((a) => a.capacity >= 85).length} asesor(es) con carga alta.` },
    { icon: "2", title: "Elegir destino", text: "Usar asesores disponibles con menor carga." },
    { icon: "3", title: "Redistribuir con preview", text: "Revisar casos antes de aplicar el movimiento." }
  ];
}

function renderAdvisorLoadMap() {
  const rows = advisorLoadFiltered().slice(0, 16);

  setHTML("#advisorLoadMap", rows.map((advisor) => `
    <article class="load-map-card load-map-card--${advisorStatusType(advisor.status)}">
      <strong>${esc(advisor.name)}</strong>
      <span>${esc(advisor.capacity)}% carga</span>
      <small>${esc(advisor.cases)} casos · ${esc(advisor.slaRisk)} SLA</small>
    </article>
  `).join(""));

  show("#emptyAdvisorLoadMapState", !rows.length);
}

function openAdvisorDetailModal(id) {
  const advisor = getAdvisor(id);

  if (!advisor) return;

  saveSelectedAdvisor(id);

  setText("#advisorDetailIcon", "👤");
  setText("#advisorDetailTitle", advisor.name);
  setText("#advisorDetailText", `${advisor.specialty} · ${advisor.status}`);
  setHTML("#advisorDetailSummary", advisorSummary(advisor));

  const cases = State.cases.map(normalizeCase).filter((item) => String(item.advisorId) === String(id));

  setHTML("#advisorDetailCasesList", cases.map((item) => renderCaseCard(item, "assignment")).join(""));
  show("#emptyAdvisorDetailCasesState", !cases.length);

  const assignmentsLink = $("#advisorDetailAssignmentsLink");
  if (assignmentsLink) assignmentsLink.href = `asignaciones.html?advisor=${encodeURIComponent(id)}`;

  bindCaseActions($("#advisorDetailCasesList"));
  openModal("#advisorDetailModal");
}

function openRedistributeLoadModal(advisorId = "") {
  if (advisorId) {
    saveSelectedAdvisor(advisorId);
    setValue("#redistributeFromAdvisor", advisorId);
  }

  const advisor = advisorId ? getAdvisor(advisorId) : null;

  setHTML("#redistributeLoadContext", advisor
    ? advisorSummary(advisor)
    : summaryHTML([
      ["Asesor origen", "Pendiente"],
      ["Asesor destino", "Pendiente"],
      ["Vista previa", "Requerida antes de aplicar"]
    ])
  );

  show("#redistributePreviewPanel", false);
  show("#confirmRedistributeLoadBtn", false);
  State.lastRedistributionPreview = null;

  openModal("#redistributeLoadModal");
}

function suggestRedistribution() {
  const from = State.advisors.map(normalizeAdvisor).sort((a, b) => b.capacity - a.capacity)[0];
  const to = State.advisors
    .map(normalizeAdvisor)
    .filter((a) => a.id !== from?.id && advisorStatusType(a.status) === "success")
    .sort((a, b) => a.capacity - b.capacity)[0];

  if (!from || !to) {
    toast("No hay redistribución sugerida", "No se encontró origen y destino adecuados.", "warning");
    return;
  }

  setValue("#redistributeFromAdvisor", from.id);
  setValue("#redistributeToAdvisor", to.id);
  setValue("#redistributeCasesCount", "3");
  setValue("#redistributeCriteria", "menor_sla");
  setValue("#redistributeComment", `Se recomienda mover casos desde ${from.name} hacia ${to.name} para equilibrar carga.`);

  toast("Redistribución sugerida", "Se completó una propuesta inicial.", "success");
}

async function prepareRedistributionPreview() {
  if (
    !getValue("#redistributeFromAdvisor") ||
    !getValue("#redistributeToAdvisor") ||
    !getValue("#redistributeCriteria") ||
    !isChecked("#redistributeDeclaration")
  ) {
    toast("Faltan datos", "Completa origen, destino, criterio y confirmación.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/redistribuir-carga/preview", {
      method: "POST",
      body: JSON.stringify({
        asesor_origen_id: getValue("#redistributeFromAdvisor"),
        asesor_destino_id: getValue("#redistributeToAdvisor"),
        cantidad_maxima: getValue("#redistributeCasesCount"),
        criterio: getValue("#redistributeCriteria"),
        comentario: getValue("#redistributeComment")
      })
    });

    const payload = normalizePayload(response);
    const rows = listFrom(payload, ["items", "preview", "casos", "propuesta"]);

    State.lastRedistributionPreview = payload;

    setText("#redistributePreviewText", `${rows.length} caso(s) sugeridos para redistribución.`);
    setHTML("#redistributePreviewBody", rows.map((item) => `
      <tr>
        <td>
          <input type="checkbox" checked data-redistribute-case-id="${esc(item.id || item.caso_id || item.codigo_caso || item.code)}" />
        </td>
        <td>${esc(item.codigo_caso || item.code || item.caso || "-")}</td>
        <td>${esc(item.cliente || item.cliente_nombre || "-")}</td>
        <td>${esc(item.prioridad || item.priority || "-")}</td>
        <td>${esc(item.sla || item.sla_text || "-")}</td>
        <td>${esc(item.origen || item.asesor_origen || "-")}</td>
        <td>${esc(item.destino || item.asesor_destino || "-")}</td>
        <td>${esc(item.motivo || item.criterio || "-")}</td>
      </tr>
    `).join(""));

    show("#redistributePreviewPanel", true);
    show("#confirmRedistributeLoadBtn", true);

    toast("Vista previa generada", "Revisa los casos antes de aplicar la redistribución.", "success");
  } catch (error) {
    genericModal("!", "No se pudo preparar redistribución", error.message);
  }
}

async function applyRedistribution() {
  if (!State.lastRedistributionPreview) {
    toast("Vista previa requerida", "Primero prepara la redistribución.", "warning");
    return;
  }

  const selectedCases = $$("[data-redistribute-case-id]")
    .filter((input) => input.checked)
    .map((input) => input.dataset.redistributeCaseId);

  if (!selectedCases.length) {
    toast("Sin casos seleccionados", "Selecciona al menos un caso para redistribuir.", "warning");
    return;
  }

  openConfirmAction({
    title: "Aplicar redistribución",
    text: "Los casos seleccionados cambiarán de responsable.",
    summary: summaryHTML([
      ["Origen", getValue("#redistributeFromAdvisor")],
      ["Destino", getValue("#redistributeToAdvisor")],
      ["Casos", selectedCases.length],
      ["Criterio", getValue("#redistributeCriteria")]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/redistribuir-carga/aplicar", {
        method: "POST",
        body: JSON.stringify({
          preview: State.lastRedistributionPreview,
          selected_case_ids: selectedCases,
          comentario: getValue("#redistributeComment")
        })
      });

      closeModals();
      clearSelection("advisors");
      State.advisors = [];
      State.cases = [];
      await renderAdvisorLoadPage();

      toast("Redistribución aplicada", "Los casos seleccionados fueron redistribuidos.", "success");
    }
  });
}

function openAdvisorAvailabilityModal(advisorId) {
  const advisor = getAdvisor(advisorId);

  if (!advisor) return;

  saveSelectedAdvisor(advisorId);
  setHTML("#advisorAvailabilityContext", advisorSummary(advisor));
  openModal("#advisorAvailabilityModal");
}

async function confirmAdvisorAvailability() {
  if (!State.selectedAdvisorId) return;

  if (
    !getValue("#advisorAvailabilityStatus") ||
    !getValue("#advisorAvailabilityReason") ||
    !getValue("#advisorAvailabilityComment") ||
    !isChecked("#advisorAvailabilityDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, motivo, comentario y confirmación.", "warning");
    return;
  }

  const advisor = getAdvisor(State.selectedAdvisorId);

  openConfirmAction({
    title: "Confirmar disponibilidad",
    text: "El estado del asesor afectará las asignaciones operativas.",
    summary: advisorSummary(advisor),
    onConfirm: async () => {
      await apiRequest(`/supervisor/asesores/${encodeURIComponent(State.selectedAdvisorId)}/disponibilidad`, {
        method: "POST",
        body: JSON.stringify({
          estado: getValue("#advisorAvailabilityStatus"),
          motivo: getValue("#advisorAvailabilityReason"),
          hasta: getValue("#advisorAvailabilityUntil"),
          notificar: getValue("#advisorAvailabilityNotify"),
          comentario: getValue("#advisorAvailabilityComment")
        })
      });

      closeModals();
      State.advisors = [];
      await renderAdvisorLoadPage();

      toast("Disponibilidad actualizada", "El estado del asesor fue actualizado.", "success");
    }
  });
}

function openBulkAdvisorAvailabilityModal() {
  const selected = getSelectedIds("advisors");

  if (!selected.length) {
    toast("Selecciona asesores", "Debes seleccionar al menos un asesor.", "warning");
    return;
  }

  setHTML("#bulkAdvisorAvailabilitySummary", summaryHTML([
    ["Asesores seleccionados", selected.length],
    ["Cambio", "Disponibilidad masiva"]
  ]));

  openModal("#bulkAdvisorAvailabilityModal");
}

async function confirmBulkAdvisorAvailability() {
  const selected = getSelectedIds("advisors");

  if (
    !selected.length ||
    !getValue("#bulkAdvisorAvailabilityStatus") ||
    !getValue("#bulkAdvisorAvailabilityReason") ||
    !isChecked("#bulkAdvisorAvailabilityDeclaration")
  ) {
    toast("Faltan datos", "Selecciona asesores, estado, motivo y confirmación.", "warning");
    return;
  }

  openConfirmAction({
    title: "Confirmar disponibilidad masiva",
    text: "El cambio aplicará a todos los asesores seleccionados.",
    summary: summaryHTML([
      ["Asesores", selected.length],
      ["Estado", getValue("#bulkAdvisorAvailabilityStatus")],
      ["Motivo", getValue("#bulkAdvisorAvailabilityReason")]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/asesores/disponibilidad-masiva", {
        method: "POST",
        body: JSON.stringify({
          asesor_ids: selected,
          estado: getValue("#bulkAdvisorAvailabilityStatus"),
          motivo: getValue("#bulkAdvisorAvailabilityReason"),
          comentario: getValue("#bulkAdvisorAvailabilityComment")
        })
      });

      closeModals();
      clearSelection("advisors");
      State.advisors = [];
      await renderAdvisorLoadPage();

      toast("Disponibilidad actualizada", "El cambio masivo fue registrado.", "success");
    }
  });
}

async function confirmAdvisorLoadExport() {
  await requestExport({
    format: getValue("#advisorLoadExportFormat"),
    scope: getValue("#advisorLoadExportScope"),
    detail: getValue("#advisorLoadExportDetail"),
    destination: getValue("#advisorLoadExportDestination"),
    reason: getValue("#advisorLoadExportReason"),
    selectedIds: getSelectedIds("advisors"),
    include: {
      cases: isChecked("#advisorLoadExportIncludeCases"),
      sla: isChecked("#advisorLoadExportIncludeSla"),
      productivity: isChecked("#advisorLoadExportIncludeProductivity"),
      recommendations: isChecked("#advisorLoadExportIncludeRecommendations")
    }
  });

  closeModals();
}

/* =========================================================
   MONITOREO SLA
========================================================= */

async function initSlaMonitor() {
  bindSlaEvents();
  await Promise.all([loadAdvisors(), renderSlaMonitor()]);
  processCaseDeepLink();
}

function bindSlaEvents() {
  $("#slaMonitorSearch")?.addEventListener("input", () => {
    State.pagination.sla.page = 1;
    renderSlaMonitor();
  });

  $$("[data-sla-monitor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.sla = button.dataset.slaMonitorFilter || "todos";
      State.pagination.sla.page = 1;

      $$("[data-sla-monitor-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderSlaMonitor();
    });
  });

  $("#toggleSlaMonitorViewBtn")?.addEventListener("click", () => {
    State.views.sla = State.views.sla === "cards" ? "table" : "cards";
    setText("#toggleSlaMonitorViewBtn", State.views.sla === "cards" ? "Vista tabla" : "Vista cards");
    renderSlaMonitor();
  });

  $("#refreshSlaMonitorBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderSlaMonitor();
  });

  $("#applySlaAdvancedFiltersBtn")?.addEventListener("click", renderSlaMonitor);

  $("#resetSlaAdvancedFiltersBtn")?.addEventListener("click", () => {
    ["#slaDeadlineFrom", "#slaDeadlineTo"].forEach((selector) => setValue(selector, ""));

    [
      "#slaAdvisorFilter",
      "#slaAreaFilter",
      "#slaPriorityFilter",
      "#slaStatusFilter",
      "#slaTypeFilter",
      "#slaChannelFilter",
      "#slaRiskFilter",
      "#slaFollowupFilter"
    ].forEach((selector) => setValue(selector, "todos"));

    renderSlaMonitor();
  });

  $("#sendMassSlaAlertBtn")?.addEventListener("click", openMassSlaAlertModal);
  $("#bulkSendSlaAlertBtn")?.addEventListener("click", openMassSlaAlertModal);
  $("#previewMassSlaAlertBtn")?.addEventListener("click", previewMassSlaAlert);
  $("#confirmMassSlaAlertBtn")?.addEventListener("click", confirmMassSlaAlert);

  $("#bulkSlaFollowupBtn")?.addEventListener("click", () => openSlaFollowModal());
  $("#bulkSlaEscalateBtn")?.addEventListener("click", () => {
    const selected = getSelectedIds("sla");
    if (!selected.length) {
      toast("Selecciona casos", "Debes seleccionar al menos un caso.", "warning");
      return;
    }
    goToCaseAction(selected[0], "escalate");
  });

  $("#slaCaseReassignBtn")?.addEventListener("click", () => goToCaseAction(State.selectedCaseId, "reassign"));
  $("#slaCaseEscalateBtn")?.addEventListener("click", () => goToCaseAction(State.selectedCaseId, "escalate"));
  $("#slaCaseAlertBtn")?.addEventListener("click", () => {
    closeModals();
    openSendSlaAlertModal(State.selectedCaseId);
  });
  $("#slaCaseFollowBtn")?.addEventListener("click", () => {
    closeModals();
    openSlaFollowModal(State.selectedCaseId);
  });

  $("#confirmSendSlaAlertBtn")?.addEventListener("click", confirmSendSlaAlert);
  $("#confirmSlaSupervisorFollowBtn")?.addEventListener("click", confirmSlaFollow);

  $("#exportSlaMonitorBtn")?.addEventListener("click", () => openModal("#slaExportModal"));
  $("#bulkExportSlaBtn")?.addEventListener("click", () => openModal("#slaExportModal"));
  $("#confirmSlaExportBtn")?.addEventListener("click", confirmSlaExport);

  $("#clearSlaSelectionBtn")?.addEventListener("click", () => clearSelection("sla"));

  bindPagination({
    key: "sla",
    prevSelector: "#slaMonitorPrevPageBtn",
    nextSelector: "#slaMonitorNextPageBtn",
    pageSizeSelector: "#slaMonitorPageSize",
    render: renderSlaMonitor
  });
}

async function renderSlaMonitor() {
  try {
    if (!State.cases.length) {
      await loadCases({
        endpoint: State.config.mainEndpoint,
        ...getSlaBackendParams()
      });
    }

    const allRows = slaFilteredCases();
    const pageRows = paginateRows(allRows, "sla");

    setText("#slaMonitorSummaryTitle", `${allRows.length} casos SLA visibles`);
    setText("#slaMonitorSummaryText", `Filtro actual: ${State.filters.sla}.`);

    renderKpis("#slaMonitorKpiGrid", [
      { icon: "⏱️", value: allRows.length, label: "Casos monitoreados", description: "Resultado del filtro" },
      { icon: "🚨", value: allRows.filter((c) => c.slaHours < 0).length, label: "Vencidos", description: "Fuera de plazo" },
      { icon: "⚠️", value: allRows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8).length, label: "Riesgo alto", description: "Próximos a vencer" },
      { icon: "📣", value: allRows.filter((c) => String(c.followupStatus).toLowerCase().includes("alerta")).length, label: "Alertados", description: "Con aviso enviado" }
    ]);

    setHTML("#slaMonitorCaseList", pageRows.map((item) => renderCaseCard(item, "sla", "sla")).join(""));
    setHTML("#slaMonitorTableBody", pageRows.map((item) => renderCaseTableRow(item, "sla", "sla")).join(""));

    show("#slaMonitorCaseList", State.views.sla === "cards");
    show("#slaMonitorTableWrap", State.views.sla === "table");
    show("#emptySlaMonitorState", !allRows.length);

    updatePaginationUI("sla", "#slaMonitorPaginationSummary", "#slaMonitorCurrentPage");

    renderAi("#slaMonitorAiSummary", buildSlaAi(allRows));
    renderChecklist("#slaMonitorActionPlan", buildSlaPlan(allRows));
    renderPriorityMap(allRows);
    renderSlaByAdvisor(allRows);

    bindCaseActions($("#slaMonitorCaseList"));
    bindCaseActions($("#slaMonitorTableBody"));
    updateBulkBars();
  } catch (error) {
    renderAi("#slaMonitorAiSummary", [{ title: "No se pudo cargar SLA", text: error.message }]);
    show("#emptySlaMonitorState", true);
  }
}

function getSlaBackendParams() {
  return {
    filtro: State.filters.sla,
    busqueda: getValue("#slaMonitorSearch"),
    fecha_desde: getValue("#slaDeadlineFrom"),
    fecha_hasta: getValue("#slaDeadlineTo"),
    asesor: getValue("#slaAdvisorFilter"),
    area: getValue("#slaAreaFilter"),
    prioridad: getValue("#slaPriorityFilter"),
    estado: getValue("#slaStatusFilter"),
    tipo: getValue("#slaTypeFilter"),
    canal: getValue("#slaChannelFilter"),
    riesgo: getValue("#slaRiskFilter"),
    seguimiento: getValue("#slaFollowupFilter")
  };
}

function slaFilteredCases() {
  const query = getValue("#slaMonitorSearch").toLowerCase();

  return State.cases.map(normalizeCase).filter((item) => {
    const text = `${item.code} ${item.clientName} ${item.advisorName} ${item.priority} ${item.status} ${item.slaRisk} ${item.followupStatus}`.toLowerCase();
    const filter = State.filters.sla;

    const matchesQuickFilter =
      filter === "todos" ||
      (filter === "vencidos" && item.slaHours < 0) ||
      (filter === "riesgo_alto" && item.slaHours >= 0 && item.slaHours <= 8) ||
      (filter === "vence_hoy" && item.slaGroup === "vence_hoy") ||
      (filter === "bloqueados" && item.blocked) ||
      (filter === "derivados" && item.derived);

    const matchesAdvanced =
      matchSelect(item.advisorId || item.advisorName, "#slaAdvisorFilter") &&
      matchSelect(item.area, "#slaAreaFilter") &&
      matchSelect(item.priority, "#slaPriorityFilter") &&
      matchSelect(item.status, "#slaStatusFilter") &&
      matchSelect(item.type, "#slaTypeFilter") &&
      matchSelect(item.channel, "#slaChannelFilter") &&
      matchSelect(item.slaRisk, "#slaRiskFilter") &&
      matchSelect(item.followupStatus, "#slaFollowupFilter");

    return (!query || text.includes(query)) && matchesQuickFilter && matchesAdvanced;
  }).sort((a, b) => a.slaHours - b.slaHours);
}

function buildSlaAi(rows) {
  return [
    { title: "Atención inmediata", text: `${rows.filter((c) => c.slaHours < 0).length} caso(s) vencidos.` },
    { title: "Prevención", text: `${rows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8).length} caso(s) en riesgo alto.` },
    { title: "Acción sugerida", text: "Enviar alerta, registrar seguimiento o escalar según criticidad." }
  ];
}

function buildSlaPlan(rows) {
  return [
    { icon: "1", title: "Alertar vencidos", text: `${rows.filter((c) => c.slaHours < 0).length} caso(s) requieren alerta.` },
    { icon: "2", title: "Seguimiento", text: "Registrar avance en casos sin seguimiento." },
    { icon: "3", title: "Escalar críticos", text: "Enviar a asignaciones para escalamiento formal." }
  ];
}

function renderPriorityMap(rows) {
  const groups = [
    ["Vencidos", rows.filter((c) => c.slaHours < 0)],
    ["Riesgo alto", rows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8)],
    ["Vence hoy", rows.filter((c) => c.slaGroup === "vence_hoy")],
    ["Derivados", rows.filter((c) => c.derived)]
  ];

  setHTML("#priorityMapGrid", groups.map(([label, list]) => `
    <article class="priority-map-card">
      <strong>${esc(label)}</strong>
      <span>${esc(list.length)}</span>
      <small>${list.slice(0, 3).map((item) => esc(item.code)).join(" · ") || "Sin casos"}</small>
    </article>
  `).join(""));

  show("#emptyPriorityMapState", !rows.length);
}

function renderSlaByAdvisor(rows) {
  const map = new Map();

  rows.forEach((item) => {
    const key = item.advisorId || item.advisorName || "sin_asesor";
    const current = map.get(key) || {
      id: item.advisorId || key,
      name: item.advisorName || "Sin asesor",
      cases: 0,
      critical: 0,
      slaRisk: 0,
      capacity: 0,
      status: "Riesgo"
    };

    current.cases += 1;
    if (priorityValue(item.priority) === 4) current.critical += 1;
    if (slaRisk(item)) current.slaRisk += 1;
    current.capacity = Math.min(100, current.cases * 8);

    map.set(key, current);
  });

  const advisors = Array.from(map.values()).sort((a, b) => b.slaRisk - a.slaRisk);

  setHTML("#slaByAdvisorList", advisors.map((advisor) => advisorLoadMiniCard(normalizeAdvisor(advisor))).join(""));
  show("#emptySlaByAdvisorState", !advisors.length);
  bindAdvisorButtons($("#slaByAdvisorList"));
}

function openSlaCaseModal(id) {
  const item = getCase(id);

  if (!item) return;

  saveSelectedCase(id);

  setText("#slaCaseDetailIcon", item.icon);
  setText("#slaCaseDetailTitle", `${item.code} · ${item.slaText}`);
  setText("#slaCaseDetailText", item.description || item.action);
  setHTML("#slaCaseDetailSummary", caseSummary(item));

  const trace = item.raw?.trace || item.raw?.trazabilidad || item.raw?.historial || [];
  renderActivity("#slaCaseTraceTimeline", trace);
  show("#emptySlaCaseTraceState", !trace.length);

  openModal("#slaCaseDetailModal");
}

function openSendSlaAlertModal(caseId = "") {
  if (caseId) saveSelectedCase(caseId);

  const item = getCase(State.selectedCaseId);

  setHTML("#sendSlaAlertContext", item
    ? caseSummary(item)
    : summaryHTML([
      ["Alcance", "Selección o filtro"],
      ["Acción", "Alerta SLA"]
    ])
  );

  openModal("#sendSlaAlertModal");
}

async function confirmSendSlaAlert() {
  if (
    !getValue("#slaAlertTarget") ||
    !getValue("#slaAlertChannel") ||
    !getValue("#slaAlertMessage") ||
    !isChecked("#slaAlertDeclaration")
  ) {
    toast("Faltan datos", "Completa destinatario, canal, mensaje y confirmación.", "warning");
    return;
  }

  const item = getCase(State.selectedCaseId);

  openConfirmAction({
    title: "Confirmar alerta SLA",
    text: "La alerta será enviada y registrada en trazabilidad.",
    summary: item ? caseSummary(item) : summaryHTML([["Alcance", "SLA seleccionado"]]),
    onConfirm: async () => {
      await apiRequest("/supervisor/sla/alerta", {
        method: "POST",
        body: JSON.stringify({
          caso_id: State.selectedCaseId,
          destinatario: getValue("#slaAlertTarget"),
          canal: getValue("#slaAlertChannel"),
          plantilla: getValue("#slaAlertTemplate"),
          urgencia: getValue("#slaAlertUrgency"),
          mensaje: getValue("#slaAlertMessage")
        })
      });

      closeModals();
      State.cases = [];
      await renderSlaMonitor();

      toast("Alerta enviada", "La alerta SLA fue registrada correctamente.", "success");
    }
  });
}

function openMassSlaAlertModal() {
  const selected = getSelectedIds("sla");

  setHTML("#massSlaAlertSummary", summaryHTML([
    ["Casos seleccionados", selected.length],
    ["Filtro actual", State.filters.sla],
    ["Acción", "Alerta masiva SLA"]
  ]));

  show("#massSlaAlertPreviewPanel", false);
  show("#confirmMassSlaAlertBtn", false);
  State.lastMassSlaAlertPreview = null;

  openModal("#massSlaAlertModal");
}

async function previewMassSlaAlert() {
  if (
    !getValue("#massSlaAlertScope") ||
    !getValue("#massSlaAlertTarget") ||
    !getValue("#massSlaAlertChannel") ||
    !getValue("#massSlaAlertMessage") ||
    !isChecked("#massSlaAlertDeclaration")
  ) {
    toast("Faltan datos", "Completa alcance, destinatario, canal, mensaje y confirmación.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/sla/alerta-masiva/preview", {
      method: "POST",
      body: JSON.stringify({
        alcance: getValue("#massSlaAlertScope"),
        destinatario: getValue("#massSlaAlertTarget"),
        canal: getValue("#massSlaAlertChannel"),
        plantilla: getValue("#massSlaAlertTemplate"),
        mensaje: getValue("#massSlaAlertMessage"),
        selected_ids: getSelectedIds("sla"),
        filters: currentPageFilters()
      })
    });

    const payload = normalizePayload(response);
    const rows = listFrom(payload, ["items", "preview", "casos"]);

    State.lastMassSlaAlertPreview = payload;

    setText("#massSlaAlertPreviewText", `${rows.length} caso(s) incluidos en la alerta.`);
    setHTML("#massSlaAlertPreviewBody", rows.map((item) => `
      <tr>
        <td>${esc(item.codigo_caso || item.code || "-")}</td>
        <td>${esc(item.cliente || item.cliente_nombre || "-")}</td>
        <td>${esc(item.responsable || item.asesor || "-")}</td>
        <td>${esc(item.sla || item.sla_text || "-")}</td>
        <td>${esc(item.riesgo || item.riesgo_sla || "-")}</td>
        <td>${esc(item.destino || item.destinatario || "-")}</td>
      </tr>
    `).join(""));

    show("#massSlaAlertPreviewPanel", true);
    show("#confirmMassSlaAlertBtn", true);

    toast("Vista previa generada", "Revisa el alcance antes de enviar alertas.", "success");
  } catch (error) {
    genericModal("!", "No se pudo preparar alerta masiva", error.message);
  }
}

async function confirmMassSlaAlert() {
  if (!State.lastMassSlaAlertPreview) {
    toast("Vista previa requerida", "Primero prepara la vista previa.", "warning");
    return;
  }

  openConfirmAction({
    title: "Enviar alertas SLA",
    text: "Las alertas serán enviadas al alcance confirmado.",
    summary: summaryHTML([
      ["Alcance", getValue("#massSlaAlertScope")],
      ["Destinatario", getValue("#massSlaAlertTarget")],
      ["Canal", getValue("#massSlaAlertChannel")]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/sla/alerta-masiva", {
        method: "POST",
        body: JSON.stringify({
          preview: State.lastMassSlaAlertPreview,
          mensaje: getValue("#massSlaAlertMessage")
        })
      });

      closeModals();
      clearSelection("sla");
      State.cases = [];
      await renderSlaMonitor();

      toast("Alertas enviadas", "Las alertas fueron registradas correctamente.", "success");
    }
  });
}

function openSlaFollowModal(caseId = "") {
  if (caseId) saveSelectedCase(caseId);

  const item = getCase(State.selectedCaseId);

  setHTML("#slaSupervisorFollowContext", item
    ? caseSummary(item)
    : summaryHTML([
      ["Casos seleccionados", getSelectedIds("sla").length],
      ["Acción", "Seguimiento masivo"]
    ])
  );

  openModal("#slaSupervisorFollowModal");
}

async function confirmSlaFollow() {
  if (
    !getValue("#slaFollowAction") ||
    !getValue("#slaFollowResult") ||
    !getValue("#slaFollowComment") ||
    !isChecked("#slaFollowDeclaration")
  ) {
    toast("Faltan datos", "Completa acción, resultado, comentario y confirmación.", "warning");
    return;
  }

  openConfirmAction({
    title: "Registrar seguimiento SLA",
    text: "El seguimiento quedará registrado en la trazabilidad.",
    summary: summaryHTML([
      ["Caso", State.selectedCaseId || "Selección masiva"],
      ["Acción", getValue("#slaFollowAction")],
      ["Resultado", getValue("#slaFollowResult")]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/sla/seguimiento", {
        method: "POST",
        body: JSON.stringify({
          caso_id: State.selectedCaseId,
          selected_ids: getSelectedIds("sla"),
          accion: getValue("#slaFollowAction"),
          resultado: getValue("#slaFollowResult"),
          proxima_accion: getValue("#slaFollowNextAction"),
          proxima_fecha: getValue("#slaFollowNextDate"),
          comentario: getValue("#slaFollowComment")
        })
      });

      closeModals();
      clearSelection("sla");
      State.cases = [];
      await renderSlaMonitor();

      toast("Seguimiento registrado", "La acción fue registrada correctamente.", "success");
    }
  });
}

async function confirmSlaExport() {
  await requestExport({
    format: getValue("#slaExportFormat"),
    scope: getValue("#slaExportScope"),
    detail: getValue("#slaExportDetail"),
    destination: getValue("#slaExportDestination"),
    reason: getValue("#slaExportReason"),
    selectedIds: getSelectedIds("sla"),
    include: {
      client: isChecked("#slaExportIncludeClient"),
      advisor: isChecked("#slaExportIncludeAdvisor"),
      trace: isChecked("#slaExportIncludeTrace"),
      recommendations: isChecked("#slaExportIncludeRecommendations")
    }
  });

  closeModals();
}

/* =========================================================
   INDICADORES
========================================================= */

async function initIndicators() {
  bindIndicatorEvents();
  await renderIndicatorsPage();
}

function bindIndicatorEvents() {
  [
    "#indicatorPeriodFilter",
    "#indicatorDateFrom",
    "#indicatorDateTo",
    "#indicatorAdvisorFilter",
    "#indicatorAreaFilter",
    "#indicatorCaseTypeFilter",
    "#indicatorChannelFilter",
    "#indicatorPriorityFilter",
    "#indicatorStatusFilter",
    "#indicatorGroupFilter"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderIndicatorsPage);
  });

  $("#refreshIndicatorsBtn")?.addEventListener("click", async () => {
    State.indicators = [];
    await renderIndicatorsPage();
  });

  $("#resetIndicatorFiltersBtn")?.addEventListener("click", () => {
    setValue("#indicatorPeriodFilter", "semana");
    ["#indicatorDateFrom", "#indicatorDateTo"].forEach((selector) => setValue(selector, ""));
    [
      "#indicatorAdvisorFilter",
      "#indicatorAreaFilter",
      "#indicatorCaseTypeFilter",
      "#indicatorChannelFilter",
      "#indicatorPriorityFilter",
      "#indicatorStatusFilter",
      "#indicatorGroupFilter"
    ].forEach((selector) => setValue(selector, "todos"));

    renderIndicatorsPage();
  });

  $("#toggleIndicatorViewBtn")?.addEventListener("click", () => {
    State.views.indicatorsCompact = !State.views.indicatorsCompact;

    $("#mainIndicatorGrid")?.classList.toggle("indicator-grid--compact", State.views.indicatorsCompact);
    $("#mainIndicatorGrid")?.classList.toggle("indicator-grid--large", !State.views.indicatorsCompact);

    setText("#toggleIndicatorViewBtn", State.views.indicatorsCompact ? "Vista amplia" : "Vista compacta");
  });

  $("#compareIndicatorsBtn")?.addEventListener("click", () => openModal("#compareIndicatorsModal"));
  $("#confirmCompareIndicatorsBtn")?.addEventListener("click", confirmCompareIndicators);
  $("#exportCompareIndicatorsBtn")?.addEventListener("click", exportIndicatorComparison);

  $("#exportIndicatorsBtn")?.addEventListener("click", () => openModal("#indicatorsExportModal"));
  $("#confirmIndicatorsExportBtn")?.addEventListener("click", confirmIndicatorsExport);

  $("#indicatorDetailAiBtn")?.addEventListener("click", () => {
    const indicator = getIndicator(State.selectedIndicatorId);
    askBot(`Analiza el indicador ${indicator?.title || ""}`);
  });

  $("#indicatorDetailReportBtn")?.addEventListener("click", () => {
    window.location.href = `reportes.html?tipo=indicadores&indicador=${encodeURIComponent(State.selectedIndicatorId || "")}`;
  });

  $("#advisorPerformanceReportBtn")?.addEventListener("click", () => {
    window.location.href = `reportes.html?tipo=desempeno_asesor&asesor=${encodeURIComponent(State.selectedAdvisorId || "")}`;
  });

  bindPagination({
    key: "advisorPerformance",
    prevSelector: "#advisorPerformancePrevPageBtn",
    nextSelector: "#advisorPerformanceNextPageBtn",
    pageSizeSelector: "#advisorPerformancePageSize",
    render: renderAdvisorPerformanceTable
  });
}

async function renderIndicatorsPage() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint}${buildQuery(getIndicatorBackendParams())}`);
    const payload = normalizePayload(response);

    State.indicators = listFrom(payload, [
      "items",
      "indicators",
      "indicadores",
      "kpis",
      "metrics",
      "metricas"
    ]);

    State.advisors = listFrom(payload, [
      "advisors",
      "asesores",
      "advisor_performance",
      "desempeno_asesores",
      "performance"
    ]);

    setText("#indicatorsSummaryTitle", `${State.indicators.length} indicadores`);
    setText("#indicatorsSummaryText", `Periodo: ${getValue("#indicatorPeriodFilter") || "actual"}.`);

    renderKpis("#indicatorsKpiGrid", payload.kpis || State.indicators.slice(0, 4));
    renderMainIndicators(State.indicators);
    renderIndicatorCharts(payload);
    renderAdvisorPerformanceTable();
    renderAi("#indicatorsAiSummary", payload.ai_summary || payload.resumen_ia || buildIndicatorAi(State.indicators));
    renderChecklist("#indicatorActionPlan", payload.action_plan || payload.plan_accion || buildIndicatorPlan(State.indicators));

    populateAdvisorSelects();
  } catch (error) {
    renderAi("#indicatorsAiSummary", [{ title: "No se pudieron cargar indicadores", text: error.message }]);
    show("#emptyIndicatorsState", true);
  }
}

function getIndicatorBackendParams() {
  return {
    periodo: getValue("#indicatorPeriodFilter"),
    fecha_desde: getValue("#indicatorDateFrom"),
    fecha_hasta: getValue("#indicatorDateTo"),
    asesor: getValue("#indicatorAdvisorFilter"),
    area: getValue("#indicatorAreaFilter"),
    tipo_caso: getValue("#indicatorCaseTypeFilter"),
    canal: getValue("#indicatorChannelFilter"),
    prioridad: getValue("#indicatorPriorityFilter"),
    estado: getValue("#indicatorStatusFilter"),
    grupo: getValue("#indicatorGroupFilter")
  };
}

function renderMainIndicators(rows = []) {
  const indicators = rows.map(normalizeIndicator);

  setHTML("#mainIndicatorGrid", indicators.map(indicatorCard).join(""));
  show("#emptyIndicatorsState", !indicators.length);

  bindIndicatorButtons($("#mainIndicatorGrid"));
}

function indicatorCard(item) {
  const indicator = normalizeIndicator(item);

  return `
    <article class="indicator-card indicator-card--${indicatorStatusType(indicator.status)}">
      <button type="button" class="indicator-card__button" data-action="view-indicator" data-indicator-id="${esc(indicator.id)}">
        <span class="indicator-card__icon">${esc(indicator.icon)}</span>

        <div>
          <strong>${esc(indicator.value)}</strong>
          <h3>${esc(indicator.title)}</h3>
          <p>${esc(indicator.description || indicator.cause || "Indicador operativo")}</p>
        </div>

        <small>Meta: ${esc(indicator.target)} · Tendencia: ${esc(indicator.trend)}</small>

        <div class="indicator-progress">
          <span style="width:${Math.max(0, Math.min(100, indicator.progress))}%"></span>
        </div>
      </button>
    </article>
  `;
}

function bindIndicatorButtons(root = document) {
  $$('[data-action="view-indicator"]', root).forEach((button) => {
    button.addEventListener("click", () => openIndicatorDetailModal(button.dataset.indicatorId));
  });

  $$('[data-action="view-advisor-performance"]', root).forEach((button) => {
    button.addEventListener("click", () => openAdvisorPerformanceDetailModal(button.dataset.advisorId));
  });
}

function openIndicatorDetailModal(id) {
  const indicator = getIndicator(id);

  if (!indicator) return;

  saveSelectedIndicator(id);

  setText("#indicatorDetailIcon", indicator.icon);
  setText("#indicatorDetailTitle", indicator.title);
  setText("#indicatorDetailText", indicator.description || indicator.cause || "Detalle del indicador operativo.");
  setHTML("#indicatorDetailSummary", summaryHTML([
    ["Valor", indicator.value],
    ["Meta", indicator.target],
    ["Tendencia", indicator.trend],
    ["Avance", `${indicator.progress}%`],
    ["Estado", indicator.status],
    ["Causa", indicator.cause || "-"]
  ]));

  const related = (indicator.relatedCases || []).map(normalizeCase);
  setHTML("#indicatorRelatedCases", related.map((item) => renderCaseCard(item, "supervisor")).join(""));
  show("#emptyIndicatorRelatedCasesState", !related.length);

  bindCaseActions($("#indicatorRelatedCases"));
  openModal("#indicatorDetailModal");
}

function renderIndicatorCharts(payload = {}) {
  const trend = payload.trend || payload.tendencia || [];
  const priority = payload.priority_distribution || payload.prioridades || [];

  setHTML("#indicatorTrendChart", trend.length ? trend.map((item) => {
    const value = Number(item.value ?? item.valor ?? item.cerrados ?? item.casos ?? 0);
    const label = item.label ?? item.fecha ?? item.dia ?? "-";

    return `
      <div class="bar-chart__row">
        <span>${esc(label)}</span>
        <div><i style="width:${Math.min(100, value)}%"></i></div>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }).join("") : "");

  setHTML("#indicatorPriorityStack", priority.length ? priority.map((item) => {
    const value = Number(item.value ?? item.valor ?? item.cantidad ?? 0);
    const label = item.label ?? item.prioridad ?? item.nombre ?? "-";

    return `
      <article class="priority-stack__item">
        <strong>${esc(label)}</strong>
        <span>${esc(value)}</span>
      </article>
    `;
  }).join("") : "");

  show("#emptyIndicatorTrendState", !trend.length);
  show("#emptyIndicatorPriorityState", !priority.length);
}

function renderAdvisorPerformanceTable() {
  const rows = State.advisors.map(normalizeAdvisor).sort((a, b) => b.productivity - a.productivity);
  State.pagination.advisorPerformance.total = rows.length;

  const pagination = State.pagination.advisorPerformance;
  const start = (pagination.page - 1) * pagination.pageSize;
  const pageRows = rows.slice(start, start + pagination.pageSize);

  setHTML("#advisorPerformanceTableBody", pageRows.map((advisor) => `
    <tr>
      <td>${esc(advisor.name)}</td>
      <td>${esc(advisor.cases)}</td>
      <td>${esc(advisor.raw.cerrados ?? advisor.raw.closed ?? "-")}</td>
      <td>${esc(advisor.raw.sla_cumplido ?? advisor.raw.sla_ok ?? advisor.productivity + "%")}</td>
      <td>${esc(advisor.productivity)}%</td>
      <td><span class="${pillClass(advisorStatusType(advisor.status))}">${esc(advisor.status)}</span></td>
      <td>
        <button type="button" data-action="view-advisor-performance" data-advisor-id="${esc(advisor.id)}">
          Ver desempeño
        </button>
      </td>
    </tr>
  `).join(""));

  updatePaginationUI("advisorPerformance", "#advisorPerformancePaginationSummary", "#advisorPerformanceCurrentPage");
  show("#emptyAdvisorPerformanceState", !rows.length);

  bindIndicatorButtons($("#advisorPerformanceTableBody"));
}

async function openAdvisorPerformanceDetailModal(advisorId) {
  saveSelectedAdvisor(advisorId);

  let advisor = getAdvisor(advisorId);

  try {
    const response = await apiRequest(`/supervisor/indicadores/desempeno-asesor/${encodeURIComponent(advisorId)}${buildQuery(getIndicatorBackendParams())}`);
    const payload = normalizePayload(response);

    advisor = normalizeAdvisor(payload.advisor || payload.asesor || advisor || { id: advisorId });

    const kpis = payload.kpis || payload.indicadores || [
      { icon: "📋", value: advisor.cases, label: "Casos", description: "Casos activos" },
      { icon: "✅", value: payload.cerrados ?? advisor.raw?.cerrados ?? "-", label: "Cerrados", description: "Periodo" },
      { icon: "⏱️", value: payload.sla_cumplido ?? "-", label: "SLA cumplido", description: "Cumplimiento" },
      { icon: "📈", value: `${advisor.productivity}%`, label: "Productividad", description: "Score" }
    ];

    const cases = listFrom(payload, ["cases", "casos", "related_cases", "casos_relacionados"]).map(normalizeCase);

    setText("#advisorPerformanceDetailIcon", "👤");
    setText("#advisorPerformanceDetailTitle", advisor.name);
    setText("#advisorPerformanceDetailText", `${advisor.specialty} · ${advisor.status}`);
    setHTML("#advisorPerformanceDetailSummary", advisorSummary(advisor));
    renderKpis("#advisorPerformanceKpiGrid", kpis);
    renderAi("#advisorPerformanceInsight", payload.insight || payload.analisis || [
      { title: "Lectura del desempeño", text: payload.descripcion || "El análisis aparecerá según información devuelta por backend." }
    ]);

    setHTML("#advisorPerformanceCasesList", cases.map((item) => renderCaseCard(item, "assignment")).join(""));
    show("#emptyAdvisorPerformanceCasesState", !cases.length);

    const loadLink = $("#advisorPerformanceGoToLoadBtn");
    const assignLink = $("#advisorPerformanceGoToAssignmentsBtn");

    if (loadLink) loadLink.href = `carga-asesores.html?advisor=${encodeURIComponent(advisorId)}`;
    if (assignLink) assignLink.href = `asignaciones.html?advisor=${encodeURIComponent(advisorId)}`;

    bindCaseActions($("#advisorPerformanceCasesList"));
    openModal("#advisorPerformanceDetailModal");
  } catch (error) {
    genericModal("!", "No se pudo cargar desempeño", error.message);
  }
}

function buildIndicatorAi(rows) {
  const indicators = rows.map(normalizeIndicator);

  const risk = indicators.filter((item) => indicatorStatusType(item.status) === "danger" || indicatorStatusType(item.status) === "warning");

  return [
    { title: "Indicadores en riesgo", text: `${risk.length} indicador(es) requieren revisión.` },
    { title: "Análisis sugerido", text: "Contrasta productividad, SLA y cierre por asesor." }
  ];
}

function buildIndicatorPlan(rows) {
  return [
    { icon: "1", title: "Revisar desviaciones", text: "Abrir detalle de indicadores bajo meta." },
    { icon: "2", title: "Analizar asesor", text: "Usar Ver desempeño para explicar brechas." },
    { icon: "3", title: "Generar reporte", text: "Enviar resumen a Reportes con el periodo filtrado." }
  ];
}

async function confirmCompareIndicators() {
  if (
    !getValue("#compareBasePeriod") ||
    !getValue("#compareTargetPeriod") ||
    !isChecked("#compareIndicatorsDeclaration")
  ) {
    toast("Faltan datos", "Selecciona periodos y confirma la comparación.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/indicadores/comparar", {
      method: "POST",
      body: JSON.stringify({
        periodo_base: getValue("#compareBasePeriod"),
        periodo_comparativo: getValue("#compareTargetPeriod"),
        fecha_desde: getValue("#compareDateFrom"),
        fecha_hasta: getValue("#compareDateTo"),
        dimension: getValue("#compareDimension"),
        grupo: getValue("#compareMetricGroup"),
        filters: currentPageFilters()
      })
    });

    const payload = normalizePayload(response);
    const rows = listFrom(payload, ["items", "comparacion", "comparison", "resultados"]);

    State.lastIndicatorComparison = payload;

    setText("#compareIndicatorsResultText", `${rows.length} indicador(es) comparados.`);
    setHTML("#compareIndicatorsResultBody", rows.map((item) => `
      <tr>
        <td>${esc(item.indicador || item.name || item.nombre || "-")}</td>
        <td>${esc(item.base ?? item.valor_base ?? "-")}</td>
        <td>${esc(item.comparativo ?? item.target ?? item.valor_comparativo ?? "-")}</td>
        <td>${esc(item.variacion ?? item.variation ?? "-")}</td>
        <td><span class="${pillClass(indicatorStatusType(item.estado || item.status))}">${esc(item.estado || item.status || "Calculado")}</span></td>
      </tr>
    `).join(""));

    show("#compareIndicatorsResultPanel", true);
    show("#exportCompareIndicatorsBtn", true);

    toast("Comparación generada", "Revisa los resultados antes de exportar.", "success");
  } catch (error) {
    genericModal("!", "No se pudo comparar indicadores", error.message);
  }
}

async function exportIndicatorComparison() {
  if (!State.lastIndicatorComparison) {
    toast("Comparación requerida", "Primero genera una comparación.", "warning");
    return;
  }

  await requestExport({
    format: "xlsx",
    scope: "comparativo",
    detail: "operativo",
    destination: "descarga_local",
    reason: "Exportación de comparación de indicadores.",
    include: { comparison: true },
    module: "SUPERVISOR_INDICADORES_COMPARACION",
    endpoint: State.config.exportEndpoint
  });
}

async function confirmIndicatorsExport() {
  await requestExport({
    format: getValue("#indicatorsExportFormat"),
    scope: getValue("#indicatorsExportScope"),
    detail: getValue("#indicatorsExportDetail"),
    destination: getValue("#indicatorsExportDestination"),
    reason: getValue("#indicatorsExportReason"),
    include: {
      kpis: isChecked("#indicatorsExportIncludeKpis"),
      charts: isChecked("#indicatorsExportIncludeCharts"),
      advisorPerformance: isChecked("#indicatorsExportIncludeAdvisorPerformance"),
      aiAnalysis: isChecked("#indicatorsExportIncludeAiAnalysis")
    }
  });

  closeModals();
}

/* =========================================================
   REPORTES
========================================================= */

async function initReports() {
  bindReportEvents();
  await renderReportsPage();
}

function bindReportEvents() {
  $("#refreshReportsBtn")?.addEventListener("click", async () => {
    State.reports = [];
    await renderReportsPage();
  });

  $("#reportSearch")?.addEventListener("input", renderReportsPage);
  $("#reportsSearch")?.addEventListener("input", renderReportsPage);

  [
    "#reportTypeFilter",
    "#reportPeriodFilter",
    "#reportScopeFilter",
    "#reportStatusFilter",
    "#reportDateFrom",
    "#reportDateTo"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderReportsPage);
  });

  $("#resetReportFiltersBtn")?.addEventListener("click", () => {
    ["#reportSearch", "#reportsSearch", "#reportDateFrom", "#reportDateTo"].forEach((selector) => setValue(selector, ""));
    ["#reportTypeFilter", "#reportPeriodFilter", "#reportScopeFilter", "#reportStatusFilter"].forEach((selector) => setValue(selector, "todos"));
    renderReportsPage();
  });

  $("#openGenerateReportBtn")?.addEventListener("click", () => openModal("#generateReportModal"));
  $("#generateReportBtn")?.addEventListener("click", () => openModal("#generateReportModal"));
  $("#confirmGenerateReportBtn")?.addEventListener("click", confirmGenerateReport);

  $("#openScheduleReportBtn")?.addEventListener("click", () => openModal("#scheduleReportModal"));
  $("#scheduleReportBtn")?.addEventListener("click", () => openModal("#scheduleReportModal"));
  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);

  $("#openReportExportBtn")?.addEventListener("click", () => openModal("#reportsExportModal"));
  $("#exportReportsBtn")?.addEventListener("click", () => openModal("#reportsExportModal"));
  $("#confirmReportsExportBtn")?.addEventListener("click", confirmReportsExport);

  $("#reportPreviewBtn")?.addEventListener("click", previewReport);
  $("#previewReportBtn")?.addEventListener("click", previewReport);
}

async function renderReportsPage() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint || "/supervisor/reportes"}${buildQuery(getReportFilters())}`);
    const payload = normalizePayload(response);

    State.reports = listFrom(payload, [
      "items",
      "reports",
      "reportes",
      "recent_reports",
      "reportes_recientes",
      "historial"
    ]);

    const templates = listFrom(payload, [
      "templates",
      "plantillas",
      "report_templates",
      "plantillas_reporte"
    ]);

    renderKpis("#reportsKpiGrid", payload.kpis || buildReportKpis(State.reports));
    renderAi("#reportsAiSummary", payload.ai_summary || payload.resumen_ia || buildReportsAi(State.reports));
    renderChecklist("#reportsActionPlan", payload.action_plan || payload.plan_accion || buildReportsPlan(State.reports));

    renderReportTemplates(templates);
    renderReportsTable(State.reports);
    renderRecentReports(State.reports);
  } catch (error) {
    renderAi("#reportsAiSummary", [{ title: "No se pudieron cargar reportes", text: error.message }]);
    show("#emptyReportsState", true);
    show("#emptyRecentReportsState", true);
  }
}

function getReportFilters() {
  return {
    busqueda: getValue("#reportSearch") || getValue("#reportsSearch"),
    tipo: getValue("#reportTypeFilter"),
    periodo: getValue("#reportPeriodFilter"),
    alcance: getValue("#reportScopeFilter"),
    estado: getValue("#reportStatusFilter"),
    fecha_desde: getValue("#reportDateFrom"),
    fecha_hasta: getValue("#reportDateTo")
  };
}

function buildReportKpis(rows = []) {
  const reports = rows.map(normalizeReport);

  return [
    { icon: "📊", value: reports.length, label: "Reportes", description: "Historial visible" },
    { icon: "✅", value: reports.filter((r) => String(r.status).toLowerCase().includes("disponible")).length, label: "Disponibles", description: "Listos para descargar" },
    { icon: "⏳", value: reports.filter((r) => String(r.status).toLowerCase().includes("proceso")).length, label: "En proceso", description: "Pendientes de generación" },
    { icon: "🔁", value: reports.filter((r) => String(r.raw?.frecuencia || "").length).length, label: "Programados", description: "Automáticos" }
  ];
}

function buildReportsAi(rows = []) {
  return [
    { title: "Reporte recomendado", text: "Usa PDF ejecutivo para jefatura y Excel analítico para revisión operativa." },
    { title: "Control", text: `${rows.length} reporte(s) visibles en el historial actual.` }
  ];
}

function buildReportsPlan() {
  return [
    { icon: "1", title: "Seleccionar alcance", text: "Define si será dashboard, SLA, asignaciones, carga o indicadores." },
    { icon: "2", title: "Elegir formato", text: "PDF, Word, Excel, Imagen, CSV o dashboard compartible." },
    { icon: "3", title: "Registrar motivo", text: "Toda descarga debe quedar auditada." }
  ];
}

function renderReportTemplates(rows = []) {
  const container = $("#reportTemplatesGrid") || $("#reportsTemplateGrid") || $("#reportTemplateList");

  if (!container) return;

  container.innerHTML = rows.map((item) => `
    <article class="indicator-card">
      <button type="button" class="indicator-card__button" data-action="use-report-template" data-report-template="${esc(item.id || item.codigo || item.nombre)}">
        <span class="indicator-card__icon">${esc(item.icon || item.icono || "📄")}</span>
        <div>
          <strong>${esc(item.nombre || item.name || "Plantilla")}</strong>
          <h3>${esc(item.tipo || item.type || "Reporte")}</h3>
          <p>${esc(item.descripcion || item.description || "Plantilla disponible para generación.")}</p>
        </div>
      </button>
    </article>
  `).join("");

  $$('[data-action="use-report-template"]', container).forEach((button) => {
    button.addEventListener("click", () => {
      setValue("#generateReportType", button.dataset.reportTemplate || "");
      setValue("#reportGenerateType", button.dataset.reportTemplate || "");
      openModal("#generateReportModal");
    });
  });

  show("#emptyReportTemplatesState", !rows.length);
}

function renderReportsTable(rows = []) {
  const reports = rows.map(normalizeReport);
  const body = $("#reportsTableBody") || $("#recentReportsTableBody");

  if (!body) return;

  body.innerHTML = reports.map((item) => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.type)}</td>
      <td>${esc(item.period)}</td>
      <td>${esc(item.format)}</td>
      <td><span class="${pillClass(caseStatusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(formatDateTime(item.date))}</td>
      <td>
        <button type="button" data-action="view-report" data-report-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(item.id)}">Descargar</button>
      </td>
    </tr>
  `).join("");

  bindReportButtons(body);
  show("#emptyReportsState", !reports.length);
}

function renderRecentReports(rows = []) {
  const container = $("#recentReportsList") || $("#reportsHistoryList");

  if (!container) return;

  const reports = rows.map(normalizeReport).slice(0, 8);

  container.innerHTML = reports.map((item) => `
    <article class="activity-item">
      <span class="activity-icon">📊</span>
      <div class="activity-content">
        <strong>${esc(item.name)}</strong>
        <p>${esc(item.type)} · ${esc(item.format)} · ${esc(item.status)}</p>
        <small>${esc(formatDateTime(item.date))}</small>
      </div>
      <div class="service-actions">
        <button type="button" data-action="view-report" data-report-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(item.id)}">Descargar</button>
      </div>
    </article>
  `).join("");

  bindReportButtons(container);
  show("#emptyRecentReportsState", !reports.length);
}

function bindReportButtons(root = document) {
  $$('[data-action="view-report"]', root).forEach((button) => {
    button.addEventListener("click", () => openReportDetail(button.dataset.reportId));
  });

  $$('[data-action="download-report"]', root).forEach((button) => {
    button.addEventListener("click", () => downloadGeneratedReport(button.dataset.reportId));
  });
}

function openReportDetail(id) {
  const report = State.reports.map(normalizeReport).find((item) => String(item.id) === String(id));

  if (!report) return;

  saveSelectedReport(id);

  setText("#reportDetailTitle", report.name);
  setText("#reportDetailText", `${report.type} · ${report.period} · ${report.format}`);
  setHTML("#reportDetailSummary", summaryHTML([
    ["Reporte", report.name],
    ["Tipo", report.type],
    ["Periodo", report.period],
    ["Formato", report.format],
    ["Estado", report.status],
    ["Generado por", report.owner],
    ["Fecha", formatDateTime(report.date)]
  ]));

  openModal("#reportDetailModal");
}

async function downloadGeneratedReport(id) {
  const report = State.reports.map(normalizeReport).find((item) => String(item.id) === String(id));

  if (!report) {
    toast("Reporte no encontrado", "No se encontró el reporte seleccionado.", "warning");
    return;
  }

  try {
    const result = await apiRequest(`/supervisor/reportes/${encodeURIComponent(id)}/descargar`);

    if (result instanceof Blob) {
      const ext = extensionByFormat(report.format);
      downloadBlob(result, `${safeFileName(report.name, "reporte")}_${todayStamp()}.${ext}`);
      toast("Descarga iniciada", "El reporte fue descargado correctamente.", "success");
      return;
    }

    if (result.url || result.download_url) {
      window.open(result.url || result.download_url, "_blank");
      return;
    }

    toast("Descarga registrada", "El backend registró la solicitud de descarga.", "success");
  } catch (error) {
    genericModal("!", "No se pudo descargar reporte", error.message);
  }
}

async function previewReport() {
  try {
    const response = await apiRequest("/supervisor/reportes/preview", {
      method: "POST",
      body: JSON.stringify({
        tipo: getValue("#generateReportType") || getValue("#reportGenerateType"),
        periodo: getValue("#generateReportPeriod") || getValue("#reportGeneratePeriod"),
        alcance: getValue("#generateReportScope") || getValue("#reportGenerateScope"),
        detalle: getValue("#generateReportDetail") || getValue("#reportGenerateDetail"),
        filters: currentPageFilters()
      })
    });

    const payload = normalizePayload(response);

    setHTML("#reportPreviewSummary", summaryHTML([
      ["Tipo", payload.tipo || getValue("#generateReportType") || "-"],
      ["Registros estimados", payload.total || payload.registros || "-"],
      ["Formato sugerido", payload.formato_sugerido || "-"],
      ["Observación", payload.observacion || "Vista previa generada"]
    ]));

    show("#reportPreviewPanel", true);
    toast("Vista previa generada", "Revisa el alcance antes de generar el reporte.", "success");
  } catch (error) {
    genericModal("!", "No se pudo generar vista previa", error.message);
  }
}

async function confirmGenerateReport() {
  const format = getValue("#generateReportFormat") || getValue("#reportGenerateFormat");
  const type = getValue("#generateReportType") || getValue("#reportGenerateType");
  const period = getValue("#generateReportPeriod") || getValue("#reportGeneratePeriod");
  const scope = getValue("#generateReportScope") || getValue("#reportGenerateScope");
  const reason = getValue("#generateReportReason") || getValue("#reportGenerateReason");

  if (!type || !format || !period || !scope || !reason) {
    toast("Faltan datos", "Completa tipo, formato, periodo, alcance y motivo.", "warning");
    return;
  }

  const declaration =
    $("#generateReportDeclaration") ||
    $("#reportGenerateDeclaration");

  if (declaration && !declaration.checked) {
    toast("Confirmación requerida", "Marca la declaración antes de generar el reporte.", "warning");
    return;
  }

  openConfirmAction({
    title: "Generar reporte",
    text: "El reporte será generado desde backend y quedará registrado.",
    summary: summaryHTML([
      ["Tipo", type],
      ["Formato", format],
      ["Periodo", period],
      ["Alcance", scope],
      ["Motivo", reason]
    ]),
    onConfirm: async () => {
      const response = await apiRequest("/supervisor/reportes/generar", {
        method: "POST",
        body: JSON.stringify({
          tipo: type,
          formato: format,
          periodo: period,
          alcance: scope,
          detalle: getValue("#generateReportDetail") || getValue("#reportGenerateDetail"),
          destino: getValue("#generateReportDestination") || getValue("#reportGenerateDestination"),
          motivo: reason,
          filters: currentPageFilters()
        })
      });

      closeModals();

      if (response instanceof Blob) {
        downloadBlob(response, `reporte_${safeFileName(type)}_${todayStamp()}.${extensionByFormat(format)}`);
      }

      State.reports = [];
      await renderReportsPage();

      toast("Reporte generado", "El reporte fue generado correctamente.", "success");
    }
  });
}

async function confirmScheduleReport() {
  const type = getValue("#scheduleReportType");
  const frequency = getValue("#scheduleReportFrequency");
  const recipients = getValue("#scheduleReportRecipients");
  const reason = getValue("#scheduleReportReason");

  if (!type || !frequency || !recipients || !reason) {
    toast("Faltan datos", "Completa tipo, frecuencia, destinatarios y motivo.", "warning");
    return;
  }

  if ($("#scheduleReportDeclaration") && !isChecked("#scheduleReportDeclaration")) {
    toast("Confirmación requerida", "Confirma la programación del reporte.", "warning");
    return;
  }

  openConfirmAction({
    title: "Programar reporte",
    text: "La programación será enviada al backend.",
    summary: summaryHTML([
      ["Tipo", type],
      ["Frecuencia", frequency],
      ["Destinatarios", recipients],
      ["Motivo", reason]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/reportes/programar", {
        method: "POST",
        body: JSON.stringify({
          tipo: type,
          frecuencia: frequency,
          formato: getValue("#scheduleReportFormat"),
          alcance: getValue("#scheduleReportScope"),
          destinatarios: recipients,
          motivo: reason
        })
      });

      closeModals();
      toast("Reporte programado", "La programación fue registrada correctamente.", "success");
    }
  });
}

async function confirmReportsExport() {
  await requestExport({
    format: getValue("#reportsExportFormat"),
    scope: getValue("#reportsExportScope"),
    detail: getValue("#reportsExportDetail"),
    destination: getValue("#reportsExportDestination"),
    reason: getValue("#reportsExportReason"),
    module: "SUPERVISOR_REPORTES",
    endpoint: State.config.exportEndpoint || "/supervisor/exportar/reportes",
    include: {
      historial: isChecked("#reportsExportIncludeHistory"),
      programados: isChecked("#reportsExportIncludeScheduled"),
      plantillas: isChecked("#reportsExportIncludeTemplates"),
      auditoria: isChecked("#reportsExportIncludeAudit")
    }
  });

  closeModals();
}

/* =========================================================
   REPORTES - FLUJO DEFINITIVO CON BACKEND
   ---------------------------------------------------------
   JS NO genera archivos localmente.
   JS solo:
   - Lee opciones del formulario.
   - Valida periodo personalizado.
   - Envía todo al backend.
   - Descarga el archivo que devuelve FastAPI.
========================================================= */

async function initReports() {
  bindReportEvents();
  ensureReportCustomDates();
  await renderReportsPage();
}

function bindReportEvents() {
  $("#refreshReportsBtn")?.addEventListener("click", async () => {
    State.reports = [];
    await renderReportsPage();
  });

  $("#reportSearch")?.addEventListener("input", renderReportsPage);
  $("#reportsSearch")?.addEventListener("input", renderReportsPage);

  [
    "#reportTypeFilter",
    "#reportPeriodFilter",
    "#reportScopeFilter",
    "#reportStatusFilter",
    "#reportDateFrom",
    "#reportDateTo"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderReportsPage);
  });

  $("#generateReportBtn")?.addEventListener("click", () => {
    ensureReportCustomDates();
    $("#reportType")?.focus();
  });

  $("#scheduleReportBtn")?.addEventListener("click", () => {
    openModal("#scheduleReportModal");
  });

  $("#resetReportFiltersBtn")?.addEventListener("click", resetReportForm);
  $("#previewReportBtn")?.addEventListener("click", previewReport);

  $("#confirmGenerateReportBtn")?.addEventListener("click", confirmGenerateReport);
  $("#reportPreviewGenerateBtn")?.addEventListener("click", confirmGenerateReport);
  $("#reportPreviewExportBtn")?.addEventListener("click", confirmGenerateReport);

  $("#saveReportConfigBtn")?.addEventListener("click", saveReportConfigLocal);
  $("#refreshRecentReportsBtn")?.addEventListener("click", renderReportsPage);
  $("#exportRecentReportsBtn")?.addEventListener("click", exportReportsHistory);

  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);

  $("#reportPeriod")?.addEventListener("change", toggleReportCustomDates);
}

function reportKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", "-");
}

function ensureReportCustomDates() {
  if ($("#reportCustomDateRange")) {
    toggleReportCustomDates();
    return;
  }

  const periodSelect = $("#reportPeriod");
  const form = $("#reportGeneratorForm");

  if (!periodSelect || !form) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-grid hidden";
  wrapper.id = "reportCustomDateRange";

  wrapper.innerHTML = `
    <div class="form-group">
      <label for="reportCustomDateFrom">Fecha desde</label>
      <input id="reportCustomDateFrom" type="date" />
    </div>

    <div class="form-group">
      <label for="reportCustomDateTo">Fecha hasta</label>
      <input id="reportCustomDateTo" type="date" />
    </div>
  `;

  const periodGrid = periodSelect.closest(".form-grid");

  if (periodGrid?.parentNode) {
    periodGrid.parentNode.insertBefore(wrapper, periodGrid.nextSibling);
  } else {
    form.appendChild(wrapper);
  }

  toggleReportCustomDates();
}

function toggleReportCustomDates() {
  const period = reportKey(getValue("#reportPeriod"));
  const isCustom = period.includes("personalizado") || period.includes("rango");

  show("#reportCustomDateRange", isCustom);

  if (!isCustom) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  if ($("#reportCustomDateFrom") && !getValue("#reportCustomDateFrom")) {
    setValue("#reportCustomDateFrom", today);
  }

  if ($("#reportCustomDateTo") && !getValue("#reportCustomDateTo")) {
    setValue("#reportCustomDateTo", today);
  }
}

function getReportPayload() {
  ensureReportCustomDates();

  const type = getValue("#reportType");
  const period = getValue("#reportPeriod");
  const scope = getValue("#reportScope");
  const format = getValue("#reportFormat");
  const comment = getValue("#reportComment");

  const detail =
    getValue("#reportDetail") ||
    getValue("#generateReportDetail") ||
    getValue("#reportGenerateDetail") ||
    "operativo";

  const destination =
    getValue("#reportDestination") ||
    getValue("#generateReportDestination") ||
    getValue("#reportGenerateDestination") ||
    "descarga_local";

  const dateFrom = getValue("#reportCustomDateFrom");
  const dateTo = getValue("#reportCustomDateTo");

  return {
    type,
    tipo: type,

    period,
    periodo: period,

    scope,
    alcance: scope,

    format,
    formato: format,

    detail,
    detalle: detail,

    destination,
    destino: destination,

    comment,
    comentario: comment,
    reason: comment || "Generación formal de reporte supervisor",
    motivo: comment || "Generación formal de reporte supervisor",

    dateFrom,
    dateTo,
    fecha_desde: dateFrom,
    fecha_hasta: dateTo,

    includeKpis: isChecked("#includeKpis") || isChecked("#includeKpi") || true,
    includeCharts: isChecked("#includeCharts"),
    includeOperationalDetail: isChecked("#includeCases") || isChecked("#includeOperationalDetail"),
    includeSla: isChecked("#includeSla"),
    includeTrace: isChecked("#includeAudit") || isChecked("#includeTrace"),

    incluir_kpis: isChecked("#includeKpis") || isChecked("#includeKpi") || true,
    incluir_graficos: isChecked("#includeCharts"),
    incluir_detalle_operativo: isChecked("#includeCases") || isChecked("#includeOperationalDetail"),
    incluir_sla: isChecked("#includeSla"),
    incluir_trazabilidad: isChecked("#includeAudit") || isChecked("#includeTrace"),

    filters: getReportFilters()
  };
}

function getReportFilters() {
  return {
    busqueda: getValue("#reportSearch") || getValue("#reportsSearch"),
    tipo: getValue("#reportTypeFilter"),
    periodo: getValue("#reportPeriodFilter"),
    alcance: getValue("#reportScopeFilter"),
    estado: getValue("#reportStatusFilter"),
    fecha_desde: getValue("#reportDateFrom"),
    fecha_hasta: getValue("#reportDateTo")
  };
}

function validateReportPayload(payload) {
  if (!payload.type || !payload.period || !payload.scope || !payload.format) {
    toast("Faltan datos", "Completa tipo de reporte, periodo, alcance y formato.", "warning");
    return false;
  }

  const period = reportKey(payload.period);

  if (period.includes("personalizado") || period.includes("rango")) {
    if (!payload.dateFrom || !payload.dateTo) {
      toast("Fechas requeridas", "Selecciona fecha desde y fecha hasta.", "warning");
      return false;
    }

    if (new Date(payload.dateFrom) > new Date(payload.dateTo)) {
      toast("Rango inválido", "La fecha desde no puede ser mayor que la fecha hasta.", "warning");
      return false;
    }
  }

  return true;
}

function getReportExtension(format) {
  const text = reportKey(format);

  if (text.includes("pdf")) return "pdf";
  if (text.includes("word") || text.includes("doc")) return "doc";
  if (text.includes("excel") || text.includes("xls")) return "csv";
  if (text.includes("csv")) return "csv";
  if (text.includes("imagen") || text.includes("png")) return "png";
  if (text.includes("dashboard") || text.includes("html")) return "html";

  return "csv";
}

function getFilenameFromDisposition(disposition, fallback) {
  const header = String(disposition || "");

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replaceAll('"', ""));
    } catch {
      return utf8Match[1].replaceAll('"', "");
    }
  }

  const normalMatch = header.match(/filename="?([^";]+)"?/i);
  if (normalMatch?.[1]) return normalMatch[1].trim();

  return fallback;
}

async function downloadReportFromBackend(endpoint, payload, options = {}) {
  const token = getToken();
  const method = options.method || "POST";

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(payload) })
  });

  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok) {
    let message = "No se pudo generar el reporte.";

    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        message = getApiErrorMessage(data);
      } else {
        message = await response.text();
      }
    } catch {
      // Mantener mensaje estándar.
    }

    throw new Error(message || "No se pudo generar el reporte.");
  }

  if (contentType.includes("application/json")) {
    const data = await response.json();

    if (data?.url || data?.download_url || data?.link) {
      window.open(data.url || data.download_url || data.link, "_blank");
      return;
    }

    throw new Error(data?.message || data?.detail || "El backend no devolvió un archivo descargable.");
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error("El archivo generado está vacío.");
  }

  const fallbackName =
    `reporte_${safeFileName(payload.type || payload.tipo || "supervisor")}_${todayStamp()}.${getReportExtension(payload.format || payload.formato)}`;

  const filename = getFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackName
  );

  downloadBlob(blob, filename);
  toast("Reporte generado", `Se descargó ${filename}.`, "success");
}

async function previewReport() {
  const payload = getReportPayload();

  if (!validateReportPayload(payload)) return;

  try {
    const response = await apiRequest("/supervisor/reportes/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = normalizePayload(response);

    setHTML("#reportPreviewSummary", summaryHTML([
      ["Tipo", data.tipo || payload.type],
      ["Periodo", data.periodo || payload.period],
      ["Alcance", data.alcance || payload.scope],
      ["Detalle", data.detalle || payload.detail],
      ["Destino", data.destino || payload.destination],
      ["Formato", data.formato || payload.format],
      ["Fecha desde", payload.dateFrom || "-"],
      ["Fecha hasta", payload.dateTo || "-"],
      ["Registros estimados", data.total ?? data.registros ?? "-"],
      ["KPIs", payload.includeKpis ? "Sí" : "No"],
      ["Gráficos", payload.includeCharts ? "Sí" : "No"],
      ["Detalle operativo", payload.includeOperationalDetail ? "Sí" : "No"],
      ["Trazabilidad", payload.includeTrace ? "Sí" : "No"]
    ]));

    show("#reportPreviewPanel", true);
    openModal("#reportPreviewModal");

    toast("Vista previa generada", "El backend calculó el alcance del reporte.", "success");
  } catch (error) {
    genericModal("!", "No se pudo generar vista previa", error.message);
  }
}

async function confirmGenerateReport() {
  const payload = getReportPayload();

  if (!validateReportPayload(payload)) return;

  openConfirmAction({
    title: "Generar reporte",
    text: "El reporte se generará desde la base de datos usando los parámetros seleccionados.",
    summary: summaryHTML([
      ["Tipo", payload.type],
      ["Formato", payload.format],
      ["Periodo", payload.period],
      ["Alcance", payload.scope],
      ["Detalle", payload.detail],
      ["Destino", payload.destination],
      ["Fecha desde", payload.dateFrom || "-"],
      ["Fecha hasta", payload.dateTo || "-"],
      ["KPIs", payload.includeKpis ? "Sí" : "No"],
      ["Gráficos", payload.includeCharts ? "Sí" : "No"],
      ["Detalle operativo", payload.includeOperationalDetail ? "Sí" : "No"],
      ["Trazabilidad", payload.includeTrace ? "Sí" : "No"]
    ]),
    declaration: "Confirmo que deseo generar este reporte con los parámetros seleccionados.",
    onConfirm: async () => {
      await downloadReportFromBackend("/supervisor/reportes/generar", payload);

      closeModals();

      State.reports = [];

      try {
        await renderReportsPage();
      } catch {
        // No bloquear si la tabla visual no refresca.
      }
    }
  });
}

async function confirmScheduleReport() {
  const type = getValue("#scheduleReportType") || getValue("#reportType");
  const frequency = getValue("#scheduleReportFrequency") || getValue("#scheduleFrequency");
  const recipients = getValue("#scheduleReportRecipients") || getValue("#scheduleRecipients");
  const reason = getValue("#scheduleReportReason") || "Programación de reporte supervisor";

  if (!type || !frequency || !recipients || !reason) {
    toast("Faltan datos", "Completa tipo, frecuencia, destinatarios y motivo.", "warning");
    return;
  }

  if ($("#scheduleReportDeclaration") && !isChecked("#scheduleReportDeclaration")) {
    toast("Confirmación requerida", "Confirma la programación del reporte.", "warning");
    return;
  }

  const reportPayload = getReportPayload();

  openConfirmAction({
    title: "Programar reporte",
    text: "La programación será enviada al backend.",
    summary: summaryHTML([
      ["Tipo", type],
      ["Frecuencia", frequency],
      ["Destinatarios", recipients],
      ["Motivo", reason]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/reportes/programar", {
        method: "POST",
        body: JSON.stringify({
          ...reportPayload,
          tipo: type,
          frecuencia: frequency,
          destinatarios: recipients,
          motivo: reason,
          formato_programado: getValue("#scheduleReportFormat") || reportPayload.format,
          alcance_programado: getValue("#scheduleReportScope") || reportPayload.scope
        })
      });

      closeModals();
      toast("Reporte programado", "La programación fue registrada correctamente.", "success");
    }
  });
}

async function exportReportsHistory() {
  const payload = {
    type: "Historial de reportes",
    tipo: "Historial de reportes",
    period: getValue("#reportPeriodFilter") || "Filtro actual",
    periodo: getValue("#reportPeriodFilter") || "Filtro actual",
    scope: "Historial visible",
    alcance: "Historial visible",
    detail: "auditable",
    detalle: "auditable",
    destination: "descarga_local",
    destino: "descarga_local",
    format: getValue("#reportFormat") || "Excel",
    formato: getValue("#reportFormat") || "Excel",
    reason: "Exportación de historial de reportes filtrado",
    motivo: "Exportación de historial de reportes filtrado",
    filters: getReportFilters(),
    includeKpis: true,
    includeCharts: false,
    includeOperationalDetail: true,
    includeTrace: true,
    incluir_kpis: true,
    incluir_graficos: false,
    incluir_detalle_operativo: true,
    incluir_trazabilidad: true
  };

  await downloadReportFromBackend("/supervisor/exportar/reportes", payload);
}

async function renderReportsPage() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint || "/supervisor/reportes"}${buildQuery(getReportFilters())}`);
    const payload = normalizePayload(response);

    State.reports = listFrom(payload, [
      "items",
      "reports",
      "reportes",
      "recent_reports",
      "reportes_recientes",
      "historial"
    ]);

    const reports = State.reports.map(normalizeReport);

    setText("#reportsSummaryTitle", `${reports.length} reportes registrados`);
    setText("#reportsSummaryText", "Historial conectado al backend.");

    renderKpis("#reportsKpiGrid", payload.kpis || [
      { icon: "📊", value: reports.length, label: "Reportes", description: "Generados o programados" },
      { icon: "📄", value: reports.filter((r) => r.format === "PDF").length, label: "PDF", description: "Formato documental" },
      { icon: "📈", value: reports.filter((r) => r.format === "Excel").length, label: "Excel", description: "Formato analítico" },
      { icon: "🕵️", value: reports.filter((r) => reportKey(r.type).includes("auditoria")).length, label: "Auditoría", description: "Reportes auditables" }
    ]);

    renderAi("#reportsAiSummary", payload.ai_summary || payload.resumen_ia || [
      {
        title: "Reportes desde BD",
        text: "La generación formal se realiza desde backend aplicando tipo, periodo, alcance, detalle y campos seleccionados."
      }
    ]);

    renderFrequentReports(payload.frequent || payload.frecuentes || []);
    renderRecentReports(reports);
  } catch (error) {
    renderAi("#reportsAiSummary", [
      { title: "No se pudieron cargar reportes", text: error.message }
    ]);
  }
}

function renderRecentReports(rows = State.reports.map(normalizeReport)) {
  const reports = rows.map(normalizeReport);

  setHTML("#recentReportsTableBody", reports.map((report) => `
    <tr>
      <td>${esc(report.name)}</td>
      <td>${esc(report.type)}</td>
      <td>${esc(report.period)}</td>
      <td>${esc(report.format)}</td>
      <td>${esc(report.owner)}</td>
      <td>
        <span class="${pillClass(caseStatusType(report.status))}">
          ${esc(report.status)}
        </span>
      </td>
      <td>
        <button type="button" data-action="view-report" data-report-id="${esc(report.id)}">
          Ver
        </button>
        <button type="button" data-action="download-report" data-report-id="${esc(report.id)}">
          Descargar
        </button>
      </td>
    </tr>
  `).join(""));

  $$('[data-action="view-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      const report = reports.find((item) => String(item.id) === String(button.dataset.reportId));

      if (!report) return;

      setText("#reportPreviewTitle", report.name);
      setText("#reportPreviewText", `${report.type} · ${report.period} · ${report.format}`);

      setHTML("#reportPreviewSummary", summaryHTML([
        ["Reporte", report.name],
        ["Tipo", report.type],
        ["Periodo", report.period],
        ["Formato", report.format],
        ["Estado", report.status],
        ["Generado por", report.owner]
      ]));

      openModal("#reportPreviewModal");
    });
  });

  $$('[data-action="download-report"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const report = reports.find((item) => String(item.id) === String(button.dataset.reportId));

      if (!report) {
        toast("Reporte no encontrado", "No se encontró el reporte seleccionado.", "warning");
        return;
      }

      const payload = {
        type: report.type,
        tipo: report.type,
        period: report.period,
        periodo: report.period,
        scope: "Reporte seleccionado",
        alcance: "Reporte seleccionado",
        detail: "auditable",
        detalle: "auditable",
        destination: "descarga_local",
        destino: "descarga_local",
        format: report.format || "PDF",
        formato: report.format || "PDF",
        reason: report.name,
        motivo: report.name,
        report_id: report.id,
        includeKpis: true,
        includeCharts: false,
        includeOperationalDetail: true,
        includeTrace: true,
        incluir_kpis: true,
        incluir_graficos: false,
        incluir_detalle_operativo: true,
        incluir_trazabilidad: true
      };

      await downloadReportFromBackend("/supervisor/reportes/generar", payload);
    });
  });
}

function resetReportForm() {
  [
    "#reportType",
    "#reportPeriod",
    "#reportScope",
    "#reportFormat",
    "#reportComment",
    "#reportDetail",
    "#reportDestination",
    "#reportCustomDateFrom",
    "#reportCustomDateTo"
  ].forEach((selector) => setValue(selector, ""));

  [
    "#includeKpis",
    "#includeKpi",
    "#includeCharts",
    "#includeCases",
    "#includeOperationalDetail",
    "#includeSla",
    "#includeAudit",
    "#includeTrace"
  ].forEach((selector) => {
    const input = $(selector);
    if (input) input.checked = false;
  });

  setValue("#reportFormat", "PDF");
  toggleReportCustomDates();
}

function saveReportConfigLocal() {
  const payload = getReportPayload();

  if (!validateReportPayload(payload)) return;

  localStorage.setItem("claro360-supervisor-report-config", JSON.stringify(payload));
  toast("Configuración guardada", "La configuración del reporte quedó guardada localmente.", "success");
}

/* =========================================================
   AUDITORÍA DE CASOS
========================================================= */

async function initAudit() {
  bindAuditEvents();
  await renderAuditPage();
}

function bindAuditEvents() {
  $("#auditSearch")?.addEventListener("input", renderAuditPage);
  $("#auditCaseSearch")?.addEventListener("input", renderAuditPage);

  [
    "#auditDateFrom",
    "#auditDateTo",
    "#auditUserFilter",
    "#auditRoleFilter",
    "#auditActionFilter",
    "#auditSeverityFilter",
    "#auditResultFilter",
    "#auditModuleFilter"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderAuditPage);
  });

  $$("[data-audit-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.audit = button.dataset.auditFilter || "todos";

      $$("[data-audit-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderAuditPage();
    });
  });

  $("#refreshAuditBtn")?.addEventListener("click", async () => {
    State.audit = [];
    await renderAuditPage();
  });

  $("#resetAuditFiltersBtn")?.addEventListener("click", () => {
    ["#auditSearch", "#auditCaseSearch", "#auditDateFrom", "#auditDateTo"].forEach((selector) => setValue(selector, ""));
    [
      "#auditUserFilter",
      "#auditRoleFilter",
      "#auditActionFilter",
      "#auditSeverityFilter",
      "#auditResultFilter",
      "#auditModuleFilter"
    ].forEach((selector) => setValue(selector, "todos"));
    State.filters.audit = "todos";
    renderAuditPage();
  });

  $("#exportAuditBtn")?.addEventListener("click", () => openModal("#auditExportModal"));
  $("#openAuditExportBtn")?.addEventListener("click", () => openModal("#auditExportModal"));
  $("#confirmAuditExportBtn")?.addEventListener("click", confirmAuditExport);

  $("#compareAuditBtn")?.addEventListener("click", () => openModal("#auditCompareModal"));
  $("#confirmAuditCompareBtn")?.addEventListener("click", confirmAuditCompare);
}

async function renderAuditPage() {
  try {
    if (!State.audit.length) {
      await loadAudit(getAuditFilters());
    }

    const rows = auditFiltered();

    renderKpis("#auditKpiGrid", [
      { icon: "🕵️", value: rows.length, label: "Eventos visibles", description: "Resultado del filtro" },
      { icon: "⚠️", value: rows.filter((a) => String(a.severity).toLowerCase().includes("alta")).length, label: "Alta criticidad", description: "Eventos sensibles" },
      { icon: "👤", value: new Set(rows.map((a) => a.user)).size, label: "Usuarios", description: "Con actividad" },
      { icon: "✅", value: rows.filter((a) => String(a.result).toLowerCase().includes("correct")).length, label: "Correctos", description: "Procesados" }
    ]);

    renderAuditTimeline(rows);
    renderAuditTable(rows);
    renderAi("#auditAiSummary", buildAuditAi(rows));
    renderChecklist("#auditActionPlan", buildAuditPlan(rows));
  } catch (error) {
    renderAi("#auditAiSummary", [{ title: "No se pudo cargar auditoría", text: error.message }]);
    show("#emptyAuditState", true);
  }
}

function getAuditFilters() {
  return {
    filtro: State.filters.audit,
    busqueda: getValue("#auditSearch") || getValue("#auditCaseSearch"),
    fecha_desde: getValue("#auditDateFrom"),
    fecha_hasta: getValue("#auditDateTo"),
    usuario: getValue("#auditUserFilter"),
    rol: getValue("#auditRoleFilter"),
    accion: getValue("#auditActionFilter"),
    criticidad: getValue("#auditSeverityFilter"),
    resultado: getValue("#auditResultFilter"),
    modulo: getValue("#auditModuleFilter")
  };
}

function auditFiltered() {
  const query = (getValue("#auditSearch") || getValue("#auditCaseSearch")).toLowerCase();

  return State.audit.map(normalizeAudit).filter((item) => {
    const text = `${item.caseId} ${item.action} ${item.user} ${item.role} ${item.result} ${item.severity} ${item.detail}`.toLowerCase();
    const filter = State.filters.audit;

    const matchesQuick =
      filter === "todos" ||
      String(item.type).includes(filter) ||
      String(item.action).toLowerCase().includes(filter) ||
      String(item.severity).toLowerCase().includes(filter);

    const matchesAdvanced =
      matchSelect(item.user, "#auditUserFilter") &&
      matchSelect(item.role, "#auditRoleFilter") &&
      matchSelect(item.action, "#auditActionFilter") &&
      matchSelect(item.severity, "#auditSeverityFilter") &&
      matchSelect(item.result, "#auditResultFilter") &&
      matchSelect(item.type, "#auditModuleFilter");

    return (!query || text.includes(query)) && matchesQuick && matchesAdvanced;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderAuditTimeline(rows = []) {
  const container = $("#auditTimeline") || $("#auditActivityTimeline");

  if (!container) return;

  container.innerHTML = rows.slice(0, 20).map((item) => `
    <article class="activity-item">
      <span class="activity-icon">${auditIcon(item.type)}</span>
      <div class="activity-content">
        <strong>${esc(item.action)}</strong>
        <p>${esc(item.caseId)} · ${esc(item.user)} · ${esc(item.result)}</p>
        <small>${esc(formatDateTime(item.date))}</small>
      </div>
      <button type="button" data-action="view-audit" data-audit-id="${esc(item.id)}">Ver</button>
    </article>
  `).join("");

  bindAuditButtons(container);
  show("#emptyAuditTimelineState", !rows.length);
}

function renderAuditTable(rows = []) {
  const body = $("#auditTableBody");

  if (!body) return;

  body.innerHTML = rows.map((item) => `
    <tr>
      <td>${esc(formatDateTime(item.date))}</td>
      <td>${esc(item.caseId)}</td>
      <td>${esc(item.action)}</td>
      <td>${esc(item.user)}</td>
      <td>${esc(item.role)}</td>
      <td><span class="${pillClass(caseStatusType(item.severity))}">${esc(item.severity)}</span></td>
      <td>${esc(item.result)}</td>
      <td>
        <button type="button" data-action="view-audit" data-audit-id="${esc(item.id)}">Ver</button>
      </td>
    </tr>
  `).join("");

  bindAuditButtons(body);
  show("#emptyAuditState", !rows.length);
}

function auditIcon(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("asign")) return "👥";
  if (value.includes("sla")) return "⏱️";
  if (value.includes("config")) return "⚙️";
  if (value.includes("export")) return "📤";
  if (value.includes("escal")) return "🚨";

  return "🕵️";
}

function bindAuditButtons(root = document) {
  $$('[data-action="view-audit"]', root).forEach((button) => {
    button.addEventListener("click", () => openAuditDetail(button.dataset.auditId));
  });
}

function openAuditDetail(id) {
  const item = State.audit.map(normalizeAudit).find((row) => String(row.id) === String(id));

  if (!item) return;

  saveSelectedAudit(id);

  setText("#auditDetailTitle", item.action);
  setText("#auditDetailText", `${item.caseId} · ${formatDateTime(item.date)}`);
  setHTML("#auditDetailSummary", summaryHTML([
    ["Fecha", formatDateTime(item.date)],
    ["Caso", item.caseId],
    ["Acción", item.action],
    ["Usuario", item.user],
    ["Rol", item.role],
    ["Resultado", item.result],
    ["Criticidad", item.severity],
    ["Antes", item.before],
    ["Después", item.after],
    ["Detalle", item.detail]
  ]));

  openModal("#auditDetailModal");
}

function buildAuditAi(rows = []) {
  return [
    { title: "Eventos sensibles", text: `${rows.filter((a) => String(a.severity).toLowerCase().includes("alta")).length} evento(s) de criticidad alta.` },
    { title: "Trazabilidad", text: "Verifica acciones masivas, cambios de prioridad, reasignaciones y exportaciones." }
  ];
}

function buildAuditPlan() {
  return [
    { icon: "1", title: "Filtrar por criticidad", text: "Revisar eventos de alto impacto." },
    { icon: "2", title: "Validar cambios", text: "Comparar valor anterior y nuevo." },
    { icon: "3", title: "Exportar evidencia", text: "Generar reporte auditable si aplica." }
  ];
}

async function confirmAuditExport() {
  await requestExport({
    format: getValue("#auditExportFormat"),
    scope: getValue("#auditExportScope"),
    detail: getValue("#auditExportDetail"),
    destination: getValue("#auditExportDestination"),
    reason: getValue("#auditExportReason"),
    module: "SUPERVISOR_AUDITORIA",
    endpoint: State.config.exportEndpoint || "/supervisor/auditoria/exportar",
    include: {
      beforeAfter: isChecked("#auditExportIncludeBeforeAfter"),
      technical: isChecked("#auditExportIncludeTechnical"),
      sensitive: isChecked("#auditExportIncludeSensitive")
    }
  });

  closeModals();
}

async function confirmAuditCompare() {
  const caseId = getValue("#auditCompareCaseId") || State.selectedCaseId;

  if (!caseId) {
    toast("Caso requerido", "Ingresa o selecciona un caso para comparar.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/auditoria/comparar", {
      method: "POST",
      body: JSON.stringify({
        caso_id: caseId,
        fecha_desde: getValue("#auditCompareDateFrom"),
        fecha_hasta: getValue("#auditCompareDateTo")
      })
    });

    const payload = normalizePayload(response);
    const rows = listFrom(payload, ["items", "comparacion", "changes", "cambios"]);

    setHTML("#auditCompareResultBody", rows.map((item) => `
      <tr>
        <td>${esc(item.campo || item.field || "-")}</td>
        <td>${esc(item.antes || item.before || "-")}</td>
        <td>${esc(item.despues || item.after || "-")}</td>
        <td>${esc(item.usuario || item.user || "-")}</td>
        <td>${esc(formatDateTime(item.fecha || item.date))}</td>
      </tr>
    `).join(""));

    show("#auditCompareResultPanel", true);
    toast("Comparación generada", "Se generó la comparación de trazabilidad.", "success");
  } catch (error) {
    genericModal("!", "No se pudo comparar auditoría", error.message);
  }
}

/* =========================================================
   CONFIGURACIÓN DE SUPERVISIÓN
   Importante:
   El supervisor NO edita configuración global directamente.
   Puede consultar, simular y solicitar cambios al administrador.
========================================================= */

async function initConfig() {
  bindConfigEvents();
  await renderConfigPage();
}

function bindConfigEvents() {
  $("#refreshConfigBtn")?.addEventListener("click", async () => {
    State.configRules = [];
    State.routeRules = [];
    await renderConfigPage();
  });

  $("#configSearch")?.addEventListener("input", renderConfigPage);

  $$("[data-config-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.config = button.dataset.configFilter || "todos";

      $$("[data-config-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderConfigPage();
    });
  });

  [
    "#configCategoryFilter",
    "#configStatusFilter",
    "#configResponsibleFilter",
    "#configImpactFilter"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderConfigPage);
  });

  $("#resetConfigFiltersBtn")?.addEventListener("click", () => {
    setValue("#configSearch", "");
    ["#configCategoryFilter", "#configStatusFilter", "#configResponsibleFilter", "#configImpactFilter"].forEach((selector) => setValue(selector, "todos"));
    State.filters.config = "todos";
    renderConfigPage();
  });

  $("#simulatePriorityBtn")?.addEventListener("click", () => openModal("#simulatePriorityModal"));
  $("#confirmSimulatePriorityBtn")?.addEventListener("click", confirmSimulatePriority);

  $("#openConfigChangeRequestBtn")?.addEventListener("click", () => openConfigChangeRequestModal());
  $("#requestConfigChangeBtn")?.addEventListener("click", () => openConfigChangeRequestModal());
  $("#confirmConfigChangeRequestBtn")?.addEventListener("click", confirmConfigChangeRequest);

  $("#exportConfigBtn")?.addEventListener("click", () => openModal("#configExportModal"));
  $("#confirmConfigExportBtn")?.addEventListener("click", confirmConfigExport);

  $("#routeRuleRequestBtn")?.addEventListener("click", () => openConfigChangeRequestModal("ruta"));
  $("#slaRuleRequestBtn")?.addEventListener("click", () => openConfigChangeRequestModal("sla"));
}

async function renderConfigPage() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint || "/supervisor/configuracion"}${buildQuery(getConfigFilters())}`);
    const payload = normalizePayload(response);

    State.configRules = listFrom(payload, [
      "rules",
      "reglas",
      "config_rules",
      "configuraciones",
      "items"
    ]);

    State.routeRules = listFrom(payload, [
      "routes",
      "rutas",
      "route_rules",
      "reglas_ruta",
      "rutas_derivacion"
    ]);

    const requests = listFrom(payload, [
      "requests",
      "solicitudes",
      "change_requests",
      "solicitudes_cambio"
    ]);

    renderKpis("#configKpiGrid", payload.kpis || buildConfigKpis(State.configRules, State.routeRules, requests));
    renderConfigRules(State.configRules);
    renderRouteRules(State.routeRules);
    renderConfigRequests(requests);
    renderAi("#configAiSummary", payload.ai_summary || payload.resumen_ia || buildConfigAi(State.configRules, State.routeRules));
    renderChecklist("#configActionPlan", payload.action_plan || payload.plan_accion || buildConfigPlan());
  } catch (error) {
    renderAi("#configAiSummary", [{ title: "No se pudo cargar configuración", text: error.message }]);
    show("#emptyConfigRulesState", true);
  }
}

function getConfigFilters() {
  return {
    filtro: State.filters.config,
    busqueda: getValue("#configSearch"),
    categoria: getValue("#configCategoryFilter"),
    estado: getValue("#configStatusFilter"),
    responsable: getValue("#configResponsibleFilter"),
    impacto: getValue("#configImpactFilter")
  };
}

function buildConfigKpis(rules = [], routes = [], requests = []) {
  return [
    { icon: "⚙️", value: rules.length, label: "Reglas visibles", description: "Configuración activa" },
    { icon: "🧭", value: routes.length, label: "Rutas", description: "Rutas operativas" },
    { icon: "📝", value: requests.length, label: "Solicitudes", description: "Cambios solicitados" },
    { icon: "🔒", value: "Solo lectura", label: "Modo supervisor", description: "Los cambios van a Administrador" }
  ];
}

function configFiltered(rows = []) {
  const query = getValue("#configSearch").toLowerCase();
  const filter = State.filters.config;

  return rows.filter((item) => {
    const text = `${item.nombre || item.name || ""} ${item.descripcion || item.description || ""} ${item.categoria || item.category || ""} ${item.estado || item.status || ""}`.toLowerCase();

    const matchesQuick =
      filter === "todos" ||
      text.includes(filter);

    const matchesAdvanced =
      matchSelect(item.categoria || item.category, "#configCategoryFilter") &&
      matchSelect(item.estado || item.status, "#configStatusFilter") &&
      matchSelect(item.responsable || item.owner, "#configResponsibleFilter") &&
      matchSelect(item.impacto || item.impact, "#configImpactFilter");

    return (!query || text.includes(query)) && matchesQuick && matchesAdvanced;
  });
}

function renderConfigRules(rows = []) {
  const container = $("#configRulesList");
  const body = $("#configRulesTableBody");

  const list = configFiltered(rows);

  if (container) {
    container.innerHTML = list.map((item) => `
      <article class="case-card">
        <span class="case-card__icon">⚙️</span>
        <div>
          <h3>${esc(item.nombre || item.name || "Regla")}</h3>
          <p>${esc(item.descripcion || item.description || "Regla activa de supervisión.")}</p>
          <div class="case-meta">
            <span>${esc(item.categoria || item.category || "General")}</span>
            <span>${esc(item.estado || item.status || "Activo")}</span>
            <span>${esc(item.responsable || item.owner || "Administrador")}</span>
          </div>
        </div>
        <div class="case-actions">
          <span class="${pillClass(caseStatusType(item.estado || item.status || "Activo"))}">
            ${esc(item.estado || item.status || "Activo")}
          </span>
          <button type="button" data-action="view-config-rule" data-config-id="${esc(item.id || item.codigo || item.name)}">Ver</button>
          <button type="button" data-action="request-config-change" data-config-id="${esc(item.id || item.codigo || item.name)}">Solicitar cambio</button>
        </div>
      </article>
    `).join("");
  }

  if (body) {
    body.innerHTML = list.map((item) => `
      <tr>
        <td>${esc(item.nombre || item.name || "Regla")}</td>
        <td>${esc(item.categoria || item.category || "-")}</td>
        <td>${esc(item.valor || item.value || item.descripcion || "-")}</td>
        <td><span class="${pillClass(caseStatusType(item.estado || item.status || "Activo"))}">${esc(item.estado || item.status || "Activo")}</span></td>
        <td>${esc(item.responsable || item.owner || "Administrador")}</td>
        <td>
          <button type="button" data-action="view-config-rule" data-config-id="${esc(item.id || item.codigo || item.name)}">Ver</button>
          <button type="button" data-action="request-config-change" data-config-id="${esc(item.id || item.codigo || item.name)}">Solicitar</button>
        </td>
      </tr>
    `).join("");
  }

  bindConfigButtons(document);
  show("#emptyConfigRulesState", !list.length);
}

function renderRouteRules(rows = []) {
  const container = $("#routeRulesList");
  const body = $("#routeRulesTableBody");

  if (!container && !body) return;

  const list = configFiltered(rows);

  if (container) {
    container.innerHTML = list.map((item) => `
      <article class="case-card">
        <span class="case-card__icon">🧭</span>
        <div>
          <h3>${esc(item.nombre || item.name || item.origen || "Ruta operativa")}</h3>
          <p>${esc(item.descripcion || item.description || `${item.origen || "-"} → ${item.destino || "-"}`)}</p>
          <div class="case-meta">
            <span>Origen: ${esc(item.origen || "-")}</span>
            <span>Destino: ${esc(item.destino || "-")}</span>
            <span>SLA: ${esc(item.sla || item.sla_interno || "-")}</span>
          </div>
        </div>
        <div class="case-actions">
          <button type="button" data-action="request-config-change" data-config-id="${esc(item.id || item.codigo || item.name)}">Solicitar cambio</button>
        </div>
      </article>
    `).join("");
  }

  if (body) {
    body.innerHTML = list.map((item) => `
      <tr>
        <td>${esc(item.origen || item.from || "-")}</td>
        <td>${esc(item.destino || item.to || "-")}</td>
        <td>${esc(item.criterio || item.criteria || "-")}</td>
        <td>${esc(item.sla || item.sla_interno || "-")}</td>
        <td><span class="${pillClass(caseStatusType(item.estado || item.status || "Activo"))}">${esc(item.estado || item.status || "Activo")}</span></td>
        <td>
          <button type="button" data-action="request-config-change" data-config-id="${esc(item.id || item.codigo || item.name)}">Solicitar</button>
        </td>
      </tr>
    `).join("");
  }

  bindConfigButtons(document);
  show("#emptyRouteRulesState", !list.length);
}

function renderConfigRequests(rows = []) {
  const container = $("#configRequestsList");
  const body = $("#configRequestsTableBody");

  if (!container && !body) return;

  if (container) {
    container.innerHTML = rows.map((item) => `
      <article class="activity-item">
        <span class="activity-icon">📝</span>
        <div class="activity-content">
          <strong>${esc(item.titulo || item.title || item.tipo || "Solicitud de cambio")}</strong>
          <p>${esc(item.descripcion || item.description || item.motivo || "")}</p>
          <small>${esc(item.estado || item.status || "Registrada")} · ${esc(formatDateTime(item.fecha || item.date))}</small>
        </div>
      </article>
    `).join("");
  }

  if (body) {
    body.innerHTML = rows.map((item) => `
      <tr>
        <td>${esc(item.titulo || item.title || item.tipo || "Solicitud")}</td>
        <td>${esc(item.motivo || item.reason || "-")}</td>
        <td>${esc(item.estado || item.status || "Registrada")}</td>
        <td>${esc(formatDateTime(item.fecha || item.date))}</td>
      </tr>
    `).join("");
  }

  show("#emptyConfigRequestsState", !rows.length);
}

function bindConfigButtons(root = document) {
  $$('[data-action="view-config-rule"]', root).forEach((button) => {
    button.addEventListener("click", () => openConfigRuleDetail(button.dataset.configId));
  });

  $$('[data-action="request-config-change"]', root).forEach((button) => {
    button.addEventListener("click", () => openConfigChangeRequestModal("", button.dataset.configId));
  });
}

function openConfigRuleDetail(id) {
  const all = [...State.configRules, ...State.routeRules];
  const item = all.find((row) => String(row.id || row.codigo || row.name || row.nombre) === String(id));

  if (!item) return;

  setText("#configRuleDetailTitle", item.nombre || item.name || "Configuración");
  setText("#configRuleDetailText", item.descripcion || item.description || "Detalle de configuración operativa.");
  setHTML("#configRuleDetailSummary", summaryHTML([
    ["Nombre", item.nombre || item.name || "-"],
    ["Categoría", item.categoria || item.category || "-"],
    ["Valor", item.valor || item.value || item.sla || "-"],
    ["Estado", item.estado || item.status || "Activo"],
    ["Responsable", item.responsable || item.owner || "Administrador"],
    ["Última actualización", formatDateTime(item.fecha_actualizacion || item.updated_at || item.fecha)]
  ]));

  openModal("#configRuleDetailModal");
}

function openConfigChangeRequestModal(type = "", configId = "") {
  if (type) setValue("#configChangeType", type);
  if (configId) setValue("#configChangeRuleId", configId);

  openModal("#configChangeRequestModal");
}

async function confirmConfigChangeRequest() {
  const type = getValue("#configChangeType");
  const reason = getValue("#configChangeReason");
  const proposal = getValue("#configChangeProposal");

  if (!type || !reason || !proposal) {
    toast("Faltan datos", "Completa tipo, motivo y propuesta.", "warning");
    return;
  }

  if ($("#configChangeDeclaration") && !isChecked("#configChangeDeclaration")) {
    toast("Confirmación requerida", "Confirma la solicitud antes de enviarla.", "warning");
    return;
  }

  openConfirmAction({
    title: "Enviar solicitud de cambio",
    text: "La solicitud será enviada al Administrador. No modificará la configuración directamente.",
    summary: summaryHTML([
      ["Tipo", type],
      ["Regla", getValue("#configChangeRuleId") || "Nueva solicitud"],
      ["Motivo", reason],
      ["Propuesta", proposal]
    ]),
    onConfirm: async () => {
      await apiRequest("/supervisor/configuracion/solicitudes-cambio", {
        method: "POST",
        body: JSON.stringify({
          tipo: type,
          regla_id: getValue("#configChangeRuleId"),
          impacto: getValue("#configChangeImpact"),
          motivo: reason,
          propuesta: proposal,
          comentario: getValue("#configChangeComment")
        })
      });

      closeModals();
      await renderConfigPage();

      toast("Solicitud enviada", "El Administrador podrá revisar y aprobar el cambio.", "success");
    }
  });
}

async function confirmSimulatePriority() {
  const type = getValue("#simulateCaseType");
  const channel = getValue("#simulateChannel");
  const clientType = getValue("#simulateClientType");
  const impact = getValue("#simulateImpact");

  if (!type || !channel || !clientType || !impact) {
    toast("Faltan datos", "Completa tipo, canal, cliente e impacto.", "warning");
    return;
  }

  try {
    const response = await apiRequest("/supervisor/configuracion/simular-prioridad", {
      method: "POST",
      body: JSON.stringify({
        tipo_caso: type,
        canal: channel,
        tipo_cliente: clientType,
        impacto,
        sla: getValue("#simulateSla")
      })
    });

    const payload = normalizePayload(response);

    setHTML("#simulatePriorityResult", summaryHTML([
      ["Prioridad sugerida", payload.prioridad || payload.priority || "-"],
      ["SLA sugerido", payload.sla || payload.sla_sugerido || "-"],
      ["Ruta sugerida", payload.ruta || payload.route || "-"],
      ["Regla aplicada", payload.regla || payload.rule || "-"]
    ]));

    show("#simulatePriorityResultPanel", true);
    toast("Simulación generada", "La simulación se generó sin modificar reglas.", "success");
  } catch (error) {
    genericModal("!", "No se pudo simular prioridad", error.message);
  }
}

async function confirmConfigExport() {
  await requestExport({
    format: getValue("#configExportFormat"),
    scope: getValue("#configExportScope"),
    detail: getValue("#configExportDetail"),
    destination: getValue("#configExportDestination"),
    reason: getValue("#configExportReason"),
    module: "SUPERVISOR_CONFIGURACION",
    endpoint: State.config.exportEndpoint || "/supervisor/exportar/configuracion",
    include: {
      rules: isChecked("#configExportIncludeRules"),
      routes: isChecked("#configExportIncludeRoutes"),
      requests: isChecked("#configExportIncludeRequests")
    }
  });

  closeModals();
}

function buildConfigAi() {
  return [
    { title: "Modo seguro", text: "El Supervisor consulta y solicita cambios; no edita reglas globales directamente." },
    { title: "Recomendación", text: "Simula impacto antes de enviar una solicitud al Administrador." }
  ];
}

function buildConfigPlan() {
  return [
    { icon: "1", title: "Consultar regla activa", text: "Revisa la configuración vigente." },
    { icon: "2", title: "Simular impacto", text: "Valida prioridad o ruta antes de pedir cambios." },
    { icon: "3", title: "Solicitar cambio", text: "Envía la propuesta al Administrador para aprobación." }
  ];
}

/* =========================================================
   COMPATIBILIDAD CON BOTONES ANTIGUOS
   Evita que páginas aún no migradas queden sin respuesta.
========================================================= */

document.addEventListener("click", (event) => {
  const button = event.target.closest("button, a");

  if (!button) return;

  const text = (button.textContent || "").trim().toLowerCase();

  if (
    text.includes("acción no disponible") ||
    button.dataset.unavailable === "true"
  ) {
    event.preventDefault();
    toast("Acción pendiente", "Esta acción debe conectarse al flujo real del Supervisor.", "warning");
  }
});

/* =========================================================
   NOTA FINAL DE INTEGRACIÓN
========================================================= */

/*
  Este archivo reemplaza completamente supervisor.js.

  Requisitos esperados en backend:
  - GET  /api/supervisor/me
  - GET  /api/supervisor/resumen
  - GET  /api/supervisor/catalogos
  - GET  /api/supervisor/search?q=
  - POST /api/supervisor/asistente

  Pantallas:
  - GET  /api/supervisor/dashboard
  - GET  /api/supervisor/casos-pendientes
  - GET  /api/supervisor/asignaciones
  - GET  /api/supervisor/carga-asesores
  - GET  /api/supervisor/monitoreo-sla
  - GET  /api/supervisor/indicadores
  - GET  /api/supervisor/reportes
  - GET  /api/supervisor/auditoria
  - GET  /api/supervisor/configuracion

  Acciones:
  - POST /api/supervisor/casos/{id}/clasificar
  - POST /api/supervisor/casos/{id}/prioridad
  - POST /api/supervisor/casos/{id}/observar
  - POST /api/supervisor/casos/{id}/enviar-asignacion
  - POST /api/supervisor/casos/{id}/asignar
  - POST /api/supervisor/casos/{id}/reasignar
  - POST /api/supervisor/casos/{id}/derivar
  - POST /api/supervisor/casos/{id}/escalar

  Masivos / especiales:
  - POST /api/supervisor/asignacion-masiva/preview
  - POST /api/supervisor/asignacion-masiva/aplicar
  - POST /api/supervisor/redistribuir-carga/preview
  - POST /api/supervisor/redistribuir-carga/aplicar
  - POST /api/supervisor/asesores/{id}/disponibilidad
  - POST /api/supervisor/asesores/disponibilidad-masiva
  - POST /api/supervisor/sla/alerta
  - POST /api/supervisor/sla/alerta-masiva/preview
  - POST /api/supervisor/sla/alerta-masiva
  - POST /api/supervisor/sla/seguimiento
  - POST /api/supervisor/indicadores/comparar
  - GET  /api/supervisor/indicadores/desempeno-asesor/{asesor_id}
  - POST /api/supervisor/reportes/preview
  - POST /api/supervisor/reportes/generar
  - POST /api/supervisor/reportes/programar
  - GET  /api/supervisor/reportes/{id}/descargar
  - POST /api/supervisor/auditoria/comparar
  - POST /api/supervisor/configuracion/simular-prioridad
  - POST /api/supervisor/configuracion/solicitudes-cambio
  - POST /api/supervisor/exportar/{modulo}
*/

/* =========================================================
   REPORTES Y EXPORTACIONES - VERSIÓN ÚNICA LIMPIA
   CLARO ATENCIÓN 360 - SUPERVISOR

   Reemplaza todos los parches anteriores de exportación.
   No usa XLSX roto ni DOCX roto.
   Respeta filtros, periodo, alcance, tipo, checkboxes y fechas.
========================================================= */

function reportCleanText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;

  if (value instanceof Date) {
    return value.toLocaleString("es-PE");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return String(value)
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function reportPlainText(value, maxLength = 180) {
  let text = reportCleanText(value, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) text = "-";

  if (text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + "...";
  }

  return text;
}

function reportEscapeHtml(value) {
  return reportCleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportNormalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", "-");
}

function reportNormalizeFormat(value) {
  const text = reportNormalizeKey(value);

  if (text.includes("pdf")) return "pdf";
  if (text.includes("word") || text.includes("doc")) return "word";
  if (text.includes("excel") || text.includes("xlsx") || text.includes("xls")) return "excel";
  if (text.includes("csv")) return "csv";
  if (text.includes("imagen") || text.includes("image") || text.includes("png") || text.includes("jpg")) return "image";
  if (text.includes("dashboard") || text.includes("compartible") || text.includes("html")) return "dashboard";

  return "excel";
}

function reportFileName(value, fallback = "reporte_supervisor") {
  return String(value || fallback)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function reportNowStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function reportDownload(content, filename, mimeType) {
  const blob = content instanceof Blob
    ? content
    : new Blob([content], { type: mimeType || "application/octet-stream" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function reportColumnLabel(key) {
  const labels = {
    id: "ID",
    caseId: "ID caso",
    case_id: "ID caso",
    caso_id: "ID caso",
    code: "Código",
    codigo: "Código",
    codigo_caso: "Código de caso",
    clientName: "Cliente",
    cliente: "Cliente",
    cliente_nombre: "Cliente",
    type: "Tipo",
    tipo: "Tipo",
    tipo_caso: "Tipo de caso",
    category: "Categoría",
    categoria: "Categoría",
    priority: "Prioridad",
    prioridad: "Prioridad",
    status: "Estado",
    estado: "Estado",
    advisorName: "Asesor",
    asesor: "Asesor",
    asesor_nombre: "Asesor",
    area: "Área",
    channel: "Canal",
    canal: "Canal",
    service: "Servicio",
    servicio: "Servicio",
    title: "Título",
    titulo: "Título",
    description: "Descripción",
    descripcion: "Descripción",
    slaText: "SLA",
    sla: "SLA",
    slaRisk: "Riesgo SLA",
    riesgo_sla: "Riesgo SLA",
    slaHours: "Horas SLA",
    createdAt: "Fecha registro",
    fecha_registro: "Fecha registro",
    deadline: "Fecha límite",
    fecha_limite_resolucion: "Fecha límite",
    name: "Nombre",
    nombre: "Nombre",
    value: "Valor",
    valor: "Valor",
    label: "Indicador",
    target: "Meta",
    meta: "Meta",
    progress: "Avance",
    avance: "Avance",
    cases: "Casos",
    casos: "Casos",
    critical: "Críticos",
    criticos: "Críticos",
    capacity: "Capacidad",
    capacidad: "Capacidad",
    productivity: "Productividad",
    productividad: "Productividad",
    date: "Fecha",
    fecha: "Fecha",
    action: "Acción",
    accion: "Acción",
    user: "Usuario",
    usuario: "Usuario",
    role: "Rol",
    rol: "Rol",
    result: "Resultado",
    resultado: "Resultado",
    severity: "Criticidad",
    criticidad: "Criticidad",
    detail: "Detalle",
    detalle: "Detalle",
    reportType: "Tipo de reporte",
    reportPeriod: "Periodo",
    reportScope: "Alcance"
  };

  return labels[key] || String(key || "").replaceAll("_", " ").replaceAll("-", " ");
}

function reportPreferredColumns(rows) {
  const normalizedRows = reportNormalizeRows(rows);

  const priority = [
    "code",
    "codigo_caso",
    "clientName",
    "cliente_nombre",
    "type",
    "tipo",
    "category",
    "categoria",
    "priority",
    "prioridad",
    "status",
    "estado",
    "advisorName",
    "asesor_nombre",
    "area",
    "channel",
    "canal",
    "service",
    "servicio",
    "slaText",
    "sla",
    "slaRisk",
    "riesgo_sla",
    "slaHours",
    "createdAt",
    "fecha_registro",
    "deadline",
    "fecha_limite_resolucion",
    "name",
    "nombre",
    "value",
    "valor",
    "label",
    "target",
    "meta",
    "progress",
    "avance",
    "cases",
    "casos",
    "critical",
    "criticos",
    "capacity",
    "capacidad",
    "productivity",
    "productividad",
    "date",
    "fecha",
    "action",
    "accion",
    "user",
    "usuario",
    "role",
    "rol",
    "result",
    "resultado",
    "severity",
    "criticidad",
    "detail",
    "detalle"
  ];

  const excluded = new Set([
    "raw",
    "history",
    "historial",
    "trace",
    "trazabilidad",
    "evidence",
    "evidencias",
    "icon",
    "icono"
  ]);

  const columns = [];

  normalizedRows.forEach((row) => {
    if (!row || typeof row !== "object") return;

    priority.forEach((key) => {
      if (key in row && !columns.includes(key) && !excluded.has(key)) {
        columns.push(key);
      }
    });
  });

  normalizedRows.forEach((row) => {
    if (!row || typeof row !== "object") return;

    Object.keys(row).forEach((key) => {
      if (!columns.includes(key) && !excluded.has(key)) {
        columns.push(key);
      }
    });
  });

  return columns.length ? columns.slice(0, 14) : ["mensaje"];
}

function reportNormalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return [{ mensaje: "No hay registros disponibles para exportar con los filtros seleccionados." }];
  }

  return rows.map((row) => {
    if (row && typeof row === "object") return row;
    return { valor: row };
  });
}

function reportDateValue(row) {
  const value =
    row.createdAt ||
    row.fecha_registro ||
    row.deadline ||
    row.fecha_limite_resolucion ||
    row.date ||
    row.fecha ||
    row.fecha_evento ||
    row.fecha_generacion ||
    row.updatedAt ||
    row.fecha_actualizacion;

  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function reportDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function reportPeriodRange(payload = {}) {
  const period = reportNormalizeKey(payload.period || payload.periodo);
  const now = new Date();

  let from = "";
  let to = "";

  if (period.includes("hoy")) {
    const today = reportDateOnly(now);
    from = today;
    to = new Date(today);
    to.setDate(to.getDate() + 1);
  } else if (period.includes("semana")) {
    const today = reportDateOnly(now);
    const day = today.getDay() || 7;
    from = new Date(today);
    from.setDate(today.getDate() - day + 1);
    to = new Date(from);
    to.setDate(from.getDate() + 7);
  } else if (period.includes("mes")) {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (period.includes("personalizado") || period.includes("rango")) {
    const fromRaw =
      payload.dateFrom ||
      payload.fecha_desde ||
      getValue("#reportCustomDateFrom") ||
      getValue("#generateReportDateFrom") ||
      getValue("#reportDateFrom");

    const toRaw =
      payload.dateTo ||
      payload.fecha_hasta ||
      getValue("#reportCustomDateTo") ||
      getValue("#generateReportDateTo") ||
      getValue("#reportDateTo");

    from = fromRaw ? new Date(`${fromRaw}T00:00:00`) : "";
    to = toRaw ? new Date(`${toRaw}T00:00:00`) : "";

    if (to && !Number.isNaN(to.getTime())) {
      to.setDate(to.getDate() + 1);
    }
  }

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null
  };
}

function reportEnsureCustomDateControls() {
  if ($("#reportCustomDateRange")) {
    reportToggleCustomDates();
    return;
  }

  const periodSelect =
    $("#reportPeriod") ||
    $("#generateReportPeriod") ||
    $("#reportGeneratePeriod");

  if (!periodSelect) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-grid hidden";
  wrapper.id = "reportCustomDateRange";
  wrapper.innerHTML = `
    <div class="form-group">
      <label for="reportCustomDateFrom">Fecha desde</label>
      <input type="date" id="reportCustomDateFrom" />
    </div>

    <div class="form-group">
      <label for="reportCustomDateTo">Fecha hasta</label>
      <input type="date" id="reportCustomDateTo" />
    </div>
  `;

  const periodGroup = periodSelect.closest(".form-grid") || periodSelect.closest(".form-group") || $("#reportGeneratorForm");

  if (periodGroup?.parentNode) {
    periodGroup.parentNode.insertBefore(wrapper, periodGroup.nextSibling);
  } else {
    $("#reportGeneratorForm")?.appendChild(wrapper);
  }

  $("#reportCustomDateFrom")?.addEventListener("change", () => {});
  $("#reportCustomDateTo")?.addEventListener("change", () => {});
  periodSelect.addEventListener("change", reportToggleCustomDates);

  reportToggleCustomDates();
}

function reportToggleCustomDates() {
  const period =
    getValue("#reportPeriod") ||
    getValue("#generateReportPeriod") ||
    getValue("#reportGeneratePeriod");

  const isCustom =
    reportNormalizeKey(period).includes("personalizado") ||
    reportNormalizeKey(period).includes("rango");

  show("#reportCustomDateRange", isCustom);

  if (isCustom) {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const todayText = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const from = $("#reportCustomDateFrom");
    const to = $("#reportCustomDateTo");

    if (from && !from.value) from.value = todayText;
    if (to && !to.value) to.value = todayText;
  }
}

function reportPayload() {
  reportEnsureCustomDateControls();

  const type =
    getValue("#reportType") ||
    getValue("#generateReportType") ||
    getValue("#reportGenerateType") ||
    "Resumen ejecutivo";

  const period =
    getValue("#reportPeriod") ||
    getValue("#generateReportPeriod") ||
    getValue("#reportGeneratePeriod") ||
    "Semana actual";

  const scope =
    getValue("#reportScope") ||
    getValue("#generateReportScope") ||
    getValue("#reportGenerateScope") ||
    "Todos los casos";

  const format =
    getValue("#reportFormat") ||
    getValue("#generateReportFormat") ||
    getValue("#reportGenerateFormat") ||
    "PDF";

  const comment =
    getValue("#reportComment") ||
    getValue("#generateReportReason") ||
    getValue("#reportGenerateReason") ||
    "Generación formal de reporte supervisor";

  const dateFrom =
    getValue("#reportCustomDateFrom") ||
    getValue("#generateReportDateFrom") ||
    "";

  const dateTo =
    getValue("#reportCustomDateTo") ||
    getValue("#generateReportDateTo") ||
    "";

  return {
    type,
    tipo: type,
    period,
    periodo: period,
    scope,
    alcance: scope,
    format,
    formato: format,
    comment,
    comentario: comment,
    reason: comment,
    motivo: comment,
    dateFrom,
    dateTo,
    fecha_desde: dateFrom,
    fecha_hasta: dateTo,
    includeCharts: isChecked("#includeCharts"),
    includeCases: isChecked("#includeCases"),
    includeSla: isChecked("#includeSla"),
    includeAudit: isChecked("#includeAudit"),
    incluir_graficos: isChecked("#includeCharts"),
    incluir_casos: isChecked("#includeCases"),
    incluir_sla: isChecked("#includeSla"),
    incluir_auditoria: isChecked("#includeAudit")
  };
}

function getReportFilters() {
  return {
    busqueda: getValue("#reportSearch") || getValue("#reportsSearch"),
    tipo: getValue("#reportTypeFilter"),
    periodo: getValue("#reportPeriodFilter"),
    alcance: getValue("#reportScopeFilter"),
    estado: getValue("#reportStatusFilter"),
    fecha_desde: getValue("#reportDateFrom"),
    fecha_hasta: getValue("#reportDateTo")
  };
}

function currentPageFilters() {
  if (State.page === "supervisor-dashboard") {
    return getAdvancedFilters("dashboard");
  }

  if (State.page === "supervisor-casos-pendientes") {
    return {
      filtro_rapido: State.filters.pending,
      busqueda: getValue("#pendingCaseSearch"),
      ...getAdvancedFilters("pending")
    };
  }

  if (State.page === "supervisor-asignaciones") {
    return {
      filtro_rapido: State.filters.assignments,
      busqueda: getValue("#assignmentsSearch"),
      ...getAdvancedFilters("assignments")
    };
  }

  if (State.page === "supervisor-carga-asesores") {
    return {
      filtro_rapido: State.filters.advisors,
      busqueda: getValue("#advisorLoadSearch"),
      ...getAdvancedFilters("advisorLoad")
    };
  }

  if (State.page === "supervisor-monitoreo-sla") {
    return {
      filtro_rapido: State.filters.sla,
      busqueda: getValue("#slaMonitorSearch"),
      ...getAdvancedFilters("sla")
    };
  }

  if (State.page === "supervisor-indicadores") {
    return getAdvancedFilters("indicator");
  }

  if (State.page === "supervisor-reportes") {
    return {
      ...getReportFilters(),
      ...reportPayload()
    };
  }

  if (State.page === "supervisor-auditoria-casos") {
    return typeof getAuditFilters === "function" ? getAuditFilters() : {};
  }

  if (State.page === "supervisor-configuracion-supervision") {
    return typeof getConfigFilters === "function" ? getConfigFilters() : {};
  }

  return {};
}

function reportBackendParams(payload = {}) {
  const range = reportPeriodRange(payload);
  const scope = reportNormalizeKey(payload.scope || payload.alcance);

  const params = {
    periodo: payload.period || payload.periodo,
    alcance: payload.scope || payload.alcance,
    tipo: payload.type || payload.tipo,
    fecha_desde: range.from ? range.from.toISOString().slice(0, 10) : "",
    fecha_hasta: range.to ? new Date(range.to.getTime() - 86400000).toISOString().slice(0, 10) : ""
  };

  if (scope.includes("critico")) {
    params.prioridad = "Crítica";
  }

  if (scope.includes("vencido")) {
    params.sla = "vencido";
    params.riesgo = "vencido";
  }

  return params;
}

function reportMatchesDate(row, payload) {
  const range = reportPeriodRange(payload);

  if (!range.from && !range.to) return true;

  const date = reportDateValue(row);

  if (!date) return true;

  if (range.from && date < range.from) return false;
  if (range.to && date >= range.to) return false;

  return true;
}

function reportMatchesScope(row, payload) {
  const scope = reportNormalizeKey(payload.scope || payload.alcance);

  if (!scope || scope.includes("todos")) return true;

  const priority = reportNormalizeKey(row.priority || row.prioridad || row.severity || row.criticidad);
  const sla = reportNormalizeKey(row.slaText || row.sla || row.slaRisk || row.riesgo_sla || row.status || row.estado);
  const hours = Number(row.slaHours ?? row.horas_sla ?? 999);

  if (scope.includes("critico")) {
    return priority.includes("critica") || priority.includes("alta") || Number(row.critical || row.criticos || 0) > 0;
  }

  if (scope.includes("vencido")) {
    return hours < 0 || sla.includes("vencido");
  }

  return true;
}

function reportApplyLocalFilters(rows, payload) {
  const normalizedRows = reportNormalizeRows(rows);

  return normalizedRows.filter((row) => {
    return reportMatchesDate(row, payload) && reportMatchesScope(row, payload);
  });
}

function reportGroupByAdvisor(rows) {
  const map = new Map();

  reportNormalizeRows(rows).forEach((row) => {
    const key = row.advisorId || row.asesor_id || row.advisorName || row.asesor_nombre || row.asesor || "Sin asesor";
    const name = row.advisorName || row.asesor_nombre || row.asesor || key || "Sin asesor";

    const current = map.get(String(key)) || {
      asesor: name,
      advisorName: name,
      casos: 0,
      cases: 0,
      criticos: 0,
      critical: 0,
      vencidos: 0,
      sla_vencido: 0,
      riesgo_sla: 0
    };

    current.casos += 1;
    current.cases += 1;

    if (priorityValue(row.priority || row.prioridad) === 4) {
      current.criticos += 1;
      current.critical += 1;
    }

    const hours = Number(row.slaHours ?? row.horas_sla ?? 999);
    const sla = reportNormalizeKey(row.slaText || row.sla || row.slaRisk || row.riesgo_sla);

    if (hours < 0 || sla.includes("vencido")) {
      current.vencidos += 1;
      current.sla_vencido += 1;
    }

    if (hours <= 8 || sla.includes("riesgo")) {
      current.riesgo_sla += 1;
    }

    map.set(String(key), current);
  });

  return Array.from(map.values()).sort((a, b) => b.casos - a.casos);
}

function reportGroupByChannel(rows) {
  const map = new Map();

  reportNormalizeRows(rows).forEach((row) => {
    const channel = row.channel || row.canal || "Sin canal";

    const current = map.get(String(channel)) || {
      canal: channel,
      channel,
      casos: 0,
      cases: 0,
      criticos: 0,
      critical: 0,
      vencidos: 0,
      riesgo_sla: 0
    };

    current.casos += 1;
    current.cases += 1;

    if (priorityValue(row.priority || row.prioridad) === 4) {
      current.criticos += 1;
      current.critical += 1;
    }

    const hours = Number(row.slaHours ?? row.horas_sla ?? 999);
    const sla = reportNormalizeKey(row.slaText || row.sla || row.slaRisk || row.riesgo_sla);

    if (hours < 0 || sla.includes("vencido")) current.vencidos += 1;
    if (hours <= 8 || sla.includes("riesgo")) current.riesgo_sla += 1;

    map.set(String(channel), current);
  });

  return Array.from(map.values()).sort((a, b) => b.casos - a.casos);
}

async function reportFetchEndpoint(endpoint, params, keys, normalizer) {
  const response = await apiRequest(`${endpoint}${buildQuery(params)}`);
  const payload = normalizePayload(response);
  const rows = listFrom(payload, keys);

  if (!Array.isArray(rows)) return [];

  return typeof normalizer === "function" ? rows.map(normalizer) : rows;
}

function reportLocalFallbackRows(payload = {}) {
  const type = reportNormalizeKey(payload.type || payload.tipo);
  const scope = reportNormalizeKey(payload.scope || payload.alcance);

  if (type.includes("auditoria") || scope.includes("auditoria")) {
    return State.audit.map(normalizeAudit);
  }

  if (type.includes("asesor") || type.includes("productividad") || scope.includes("asesor")) {
    return State.advisors.map(normalizeAdvisor);
  }

  if (type.includes("indicador")) {
    return State.indicators.map(normalizeIndicator);
  }

  if (type.includes("reporte")) {
    return State.reports.map(normalizeReport);
  }

  return State.cases.map(normalizeCase);
}

async function reportFetchRows(payload = {}) {
  const type = reportNormalizeKey(payload.type || payload.tipo);
  const scope = reportNormalizeKey(payload.scope || payload.alcance);
  const params = reportBackendParams(payload);

  let rows = [];

  try {
    if (type.includes("auditoria") || scope.includes("auditoria")) {
      rows = await reportFetchEndpoint(
        "/supervisor/auditoria",
        params,
        ["items", "audit", "auditoria", "events", "eventos", "trace", "trazabilidad"],
        normalizeAudit
      );
    } else if (type.includes("asesor") || type.includes("productividad") || scope.includes("asesor")) {
      rows = await reportFetchEndpoint(
        "/supervisor/carga-asesores",
        params,
        ["items", "advisors", "asesores", "team", "equipo"],
        normalizeAdvisor
      );
    } else if (type.includes("sla") || scope.includes("vencido")) {
      rows = await reportFetchEndpoint(
        "/supervisor/monitoreo-sla",
        params,
        ["items", "cases", "casos", "sla_cases", "casos_sla"],
        normalizeCase
      );
    } else {
      rows = await reportFetchEndpoint(
        "/supervisor/casos",
        params,
        ["items", "cases", "casos", "critical_cases", "casos_criticos", "pending_cases", "casos_pendientes"],
        normalizeCase
      );
    }
  } catch (error) {
    console.warn("No se pudo consultar backend para reporte. Se usará información local.", error);
    rows = reportLocalFallbackRows(payload);
  }

  rows = reportApplyLocalFilters(rows, payload);

  if (type.includes("casos-por-asesor") || type.includes("casos por asesor") || scope.includes("por-asesor")) {
    rows = reportGroupByAdvisor(rows);
  }

  if (type.includes("canal") || scope.includes("por-canal")) {
    rows = reportGroupByChannel(rows);
  }

  return rows;
}

function reportHistoryFiltered() {
  const filters = getReportFilters();
  const query = reportNormalizeKey(filters.busqueda);
  const type = reportNormalizeKey(filters.tipo);
  const period = reportNormalizeKey(filters.periodo);
  const scope = reportNormalizeKey(filters.alcance);
  const status = reportNormalizeKey(filters.estado);

  const payload = {
    period: "Rango personalizado",
    dateFrom: filters.fecha_desde,
    dateTo: filters.fecha_hasta
  };

  return State.reports.map(normalizeReport).filter((row) => {
    const text = reportNormalizeKey(`${row.name} ${row.type} ${row.period} ${row.format} ${row.owner} ${row.status}`);

    if (query && !text.includes(query)) return false;
    if (type && type !== "todos" && !reportNormalizeKey(row.type).includes(type)) return false;
    if (period && period !== "todos" && !reportNormalizeKey(row.period).includes(period)) return false;
    if (scope && scope !== "todos" && !text.includes(scope)) return false;
    if (status && status !== "todos" && !reportNormalizeKey(row.status).includes(status)) return false;

    return reportMatchesDate(row, payload);
  });
}


function reportCsv(rows) {
  const safeRows = reportNormalizeRows(rows);
  const columns = reportPreferredColumns(safeRows);

  const quote = (value) => {
    const text = reportCleanText(value, "").replaceAll('"', '""');
    return `"${text}"`;
  };

  const lines = [];

  lines.push(columns.map((column) => quote(reportColumnLabel(column))).join(";"));

  safeRows.forEach((row) => {
    lines.push(columns.map((column) => quote(row[column])).join(";"));
  });

  return "\ufeff" + lines.join("\n");
}

function reportMetadata(title, rows) {
  const safeRows = reportNormalizeRows(rows);

  const critical = safeRows.filter((row) => {
    const priority = reportNormalizeKey(row.priority || row.prioridad || row.severity || row.criticidad);
    return priority.includes("critica") || priority.includes("alta") || Number(row.critical || row.criticos || 0) > 0;
  }).length;

  const slaRisk = safeRows.filter((row) => {
    const sla = reportNormalizeKey(row.slaText || row.sla || row.slaRisk || row.riesgo_sla);
    const hours = Number(row.slaHours ?? row.horas_sla ?? 999);
    return hours <= 8 || sla.includes("riesgo") || sla.includes("vencido");
  }).length;

  return {
    title,
    generatedAt: new Date().toLocaleString("es-PE"),
    total: safeRows.length,
    critical,
    slaRisk
  };
}

function reportHtmlDocument(title, rows, payload = {}) {
  const safeRows = reportNormalizeRows(rows);
  const columns = reportPreferredColumns(safeRows);
  const meta = reportMetadata(title, safeRows);

  const cards = [
    ["Generado", meta.generatedAt],
    ["Registros", meta.total],
    ["Críticos", meta.critical],
    ["Riesgo SLA", meta.slaRisk]
  ];

  const tableHead = columns
    .map((column) => `<th>${reportEscapeHtml(reportColumnLabel(column))}</th>`)
    .join("");

  const tableRows = safeRows.slice(0, 500).map((row) => `
    <tr>
      ${columns.map((column) => `<td>${reportEscapeHtml(row[column])}</td>`).join("")}
    </tr>
  `).join("");

  const customRangeText = payload.dateFrom || payload.dateTo
    ? ` · Fechas: ${payload.dateFrom || "-"} a ${payload.dateTo || "-"}`
    : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${reportEscapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      background: #f8fafc;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }

    header {
      padding: 30px 38px;
      color: #fff;
      background: linear-gradient(135deg, #e2231a, #8f1510);
    }

    header small {
      display: block;
      margin-bottom: 6px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      opacity: .9;
    }

    header h1 {
      margin: 0;
      font-size: 28px;
    }

    header p {
      margin: 8px 0 0;
      opacity: .95;
    }

    main {
      padding: 28px 38px 42px;
    }

    .meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      margin-bottom: 22px;
    }

    .meta article,
    .summary,
    .panel {
      border: 1px solid #e5e7eb;
      border-radius: 18px;
      background: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, .08);
    }

    .meta article {
      padding: 18px;
    }

    .meta span {
      display: block;
      color: #6b7280;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    .meta strong {
      display: block;
      margin-top: 8px;
      color: #e2231a;
      font-size: 22px;
    }

    .summary {
      margin-bottom: 22px;
      border-left: 6px solid #e2231a;
      padding: 18px 20px;
    }

    .summary h2 {
      margin: 0 0 8px;
      color: #e2231a;
      font-size: 18px;
    }

    .summary p {
      margin: 0;
      color: #4b5563;
      line-height: 1.5;
    }

    .panel {
      overflow: hidden;
    }

    .panel h2 {
      margin: 0;
      padding: 18px 20px;
      color: #e2231a;
      border-bottom: 1px solid #e5e7eb;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      width: 100%;
      min-width: 980px;
      border-collapse: collapse;
    }

    th {
      background: #e2231a;
      color: white;
      padding: 11px;
      font-size: 12px;
      text-align: left;
    }

    td {
      border-bottom: 1px solid #e5e7eb;
      padding: 10px 11px;
      font-size: 12px;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #f9fafb;
    }

    footer {
      margin-top: 24px;
      color: #6b7280;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <small>Claro Atención 360 · Supervisor</small>
    <h1>${reportEscapeHtml(title)}</h1>
    <p>
      Tipo: ${reportEscapeHtml(payload.type || "-")}
      · Periodo: ${reportEscapeHtml(payload.period || "-")}
      · Alcance: ${reportEscapeHtml(payload.scope || "-")}
      ${reportEscapeHtml(customRangeText)}
    </p>
  </header>

  <main>
    <section class="meta">
      ${cards.map(([label, value]) => `
        <article>
          <span>${reportEscapeHtml(label)}</span>
          <strong>${reportEscapeHtml(value)}</strong>
        </article>
      `).join("")}
    </section>

    <section class="summary">
      <h2>Resumen ejecutivo</h2>
      <p>
        El reporte consolida información filtrada del módulo de supervisión.
        Se respetan tipo, periodo, alcance, fechas personalizadas y campos marcados.
      </p>
    </section>

    <section class="panel">
      <h2>Detalle operativo</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${tableHead}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </section>

    <footer>
      Documento generado automáticamente. Uso interno operativo y auditable.
    </footer>
  </main>
</body>
</html>`;
}

function reportPdfEscape(value) {
  return reportPlainText(value, 220)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function reportPdfText(text, x, y, size = 8, bold = false, color = "111827") {
  const colors = {
    "111827": "0.067 0.094 0.153",
    "6B7280": "0.420 0.447 0.502",
    "E2231A": "0.886 0.137 0.102",
    "FFFFFF": "1 1 1"
  };

  const rgb = colors[color] || colors["111827"];
  const font = bold ? "F2" : "F1";

  return `
BT
${rgb} rg
/${font} ${size} Tf
${x} ${y} Td
(${reportPdfEscape(text)}) Tj
ET
`;
}

function reportPdfRect(x, y, w, h, color = "FFFFFF") {
  const colors = {
    "FFFFFF": "1 1 1",
    "F8FAFC": "0.973 0.980 0.988",
    "F3F4F6": "0.953 0.957 0.965",
    "FEE2E2": "0.996 0.886 0.886",
    "E2231A": "0.886 0.137 0.102",
    "8F1510": "0.561 0.082 0.063",
    "111827": "0.067 0.094 0.153",
    "E5E7EB": "0.898 0.906 0.922"
  };

  const rgb = colors[color] || colors["FFFFFF"];

  return `
q
${rgb} rg
${x} ${y} ${w} ${h} re
f
Q
`;
}

function reportPdfLine(x1, y1, x2, y2, color = "E5E7EB") {
  const colors = {
    "E5E7EB": "0.898 0.906 0.922",
    "D1D5DB": "0.820 0.835 0.859",
    "E2231A": "0.886 0.137 0.102"
  };

  const rgb = colors[color] || colors["E5E7EB"];

  return `
q
${rgb} RG
0.6 w
${x1} ${y1} m
${x2} ${y2} l
S
Q
`;
}

function reportPdfPages(title, rows, payload = {}) {
  const safeRows = reportNormalizeRows(rows);
  const columns = reportPreferredColumns(safeRows).slice(0, 6);
  const meta = reportMetadata(title, safeRows);

  const pageWidth = 842;
  const pageHeight = 595;

  const marginX = 34;
  const tableX = 34;
  const tableWidth = 774;
  const colWidth = tableWidth / Math.max(columns.length, 1);
  const rowHeight = 22;

  const firstPageRows = 14;
  const nextPageRows = 19;

  const pages = [];

  let cursor = 0;
  let pageIndex = 1;

  while (cursor < safeRows.length || pageIndex === 1) {
    const limit = pageIndex === 1 ? firstPageRows : nextPageRows;
    const pageRows = safeRows.slice(cursor, cursor + limit);
    cursor += limit;

    let content = "";

    content += reportPdfRect(0, 0, pageWidth, pageHeight, "F8FAFC");
    content += reportPdfRect(0, pageHeight - 92, pageWidth, 92, "E2231A");
    content += reportPdfRect(605, pageHeight - 92, 237, 92, "8F1510");

    content += reportPdfText("CLARO ATENCION 360", marginX, 555, 15, true, "FFFFFF");
    content += reportPdfText("MODULO SUPERVISOR", marginX, 535, 9, false, "FFFFFF");
    content += reportPdfText(reportPlainText(title, 90), marginX, 507, 14, true, "FFFFFF");

    content += reportPdfText(`Pagina ${pageIndex}`, 744, 555, 9, true, "FFFFFF");
    content += reportPdfText(new Date().toLocaleString("es-PE"), 660, 535, 8, false, "FFFFFF");

    if (pageIndex === 1) {
      const cards = [
        ["Registros", meta.total],
        ["Criticos", meta.critical],
        ["Riesgo SLA", meta.slaRisk],
        ["Control", "Auditado"]
      ];

      let cardX = marginX;
      const cardY = 434;

      cards.forEach(([label, value]) => {
        content += reportPdfRect(cardX, cardY, 180, 52, "FFFFFF");
        content += reportPdfRect(cardX, cardY + 45, 180, 7, "E2231A");
        content += reportPdfText(label.toUpperCase(), cardX + 10, cardY + 30, 7, true, "6B7280");
        content += reportPdfText(String(value), cardX + 10, cardY + 10, 14, true, "E2231A");
        cardX += 198;
      });

      content += reportPdfText("Resumen ejecutivo", marginX, 396, 12, true, "E2231A");
      content += reportPdfRect(marginX, 338, 774, 44, "FFFFFF");
      content += reportPdfRect(marginX, 338, 5, 44, "E2231A");
      content += reportPdfText(`Tipo: ${payload.type || "-"} | Periodo: ${payload.period || "-"} | Alcance: ${payload.scope || "-"}`, marginX + 16, 363, 8, false, "111827");
      content += reportPdfText("Se aplicaron filtros, fecha personalizada y alcance seleccionado.", marginX + 16, 348, 8, false, "6B7280");

      content += reportPdfText("Detalle operativo", marginX, 312, 12, true, "E2231A");
    } else {
      content += reportPdfText("Detalle operativo - continuacion", marginX, 474, 12, true, "E2231A");
    }

    const tableTop = pageIndex === 1 ? 286 : 448;
    const headerY = tableTop;

    content += reportPdfRect(tableX, headerY, tableWidth, rowHeight, "E2231A");

    columns.forEach((column, index) => {
      const x = tableX + index * colWidth;
      content += reportPdfText(reportColumnLabel(column), x + 5, headerY + 7, 7, true, "FFFFFF");

      if (index > 0) {
        content += reportPdfLine(x, headerY, x, headerY + rowHeight, "D1D5DB");
      }
    });

    let rowY = headerY - rowHeight;

    pageRows.forEach((row, rowIndex) => {
      content += reportPdfRect(tableX, rowY, tableWidth, rowHeight, rowIndex % 2 === 0 ? "FFFFFF" : "F3F4F6");
      content += reportPdfLine(tableX, rowY, tableX + tableWidth, rowY, "E5E7EB");

      columns.forEach((column, index) => {
        const x = tableX + index * colWidth;
        const approxChars = Math.max(10, Math.floor(colWidth / 5.2));
        content += reportPdfText(reportPlainText(row[column], approxChars), x + 5, rowY + 7, 6.5, false, "111827");

        if (index > 0) {
          content += reportPdfLine(x, rowY, x, rowY + rowHeight, "E5E7EB");
        }
      });

      rowY -= rowHeight;
    });

    if (cursor < safeRows.length) {
      content += reportPdfText(`Continua en la siguiente pagina. Registros restantes: ${safeRows.length - cursor}`, marginX, 34, 8, false, "6B7280");
    } else {
      content += reportPdfText("Documento generado automaticamente por Claro Atencion 360. Uso interno operativo y auditable.", marginX, 34, 8, false, "6B7280");
    }

    content += reportPdfText(`Pagina ${pageIndex}`, 760, 34, 8, false, "6B7280");

    pages.push(content);
    pageIndex += 1;
  }

  return pages;
}

function reportPdfBlob(title, rows, payload = {}) {
  const encoder = new TextEncoder();
  const pages = reportPdfPages(title, rows, payload);

  const objects = [];

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  objects[3] = "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  objects[4] = "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";

  const pageIds = [];
  let nextObjectId = 5;

  pages.forEach((pageContent) => {
    const pageId = nextObjectId;
    const contentId = nextObjectId + 1;
    nextObjectId += 2;

    pageIds.push(pageId);

    const contentBytes = encoder.encode(pageContent);

    objects[pageId] =
      `${pageId} 0 obj\n` +
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>\n` +
      `endobj\n`;

    objects[contentId] =
      `${contentId} 0 obj\n` +
      `<< /Length ${contentBytes.length} >>\n` +
      `stream\n` +
      pageContent +
      `\nendstream\n` +
      `endobj\n`;
  });

  objects[2] =
    `2 0 obj\n` +
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>\n` +
    `endobj\n`;

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  for (let i = 1; i < objects.length; i += 1) {
    if (!objects[i]) continue;
    offsets[i] = encoder.encode(pdf).length;
    pdf += objects[i];
  }

  const xrefStart = encoder.encode(pdf).length;

  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i += 1) {
    const offset = offsets[i] || 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function reportImageBlob(title, rows, payload = {}) {
  return new Promise((resolve) => {
    const safeRows = reportNormalizeRows(rows);
    const columns = reportPreferredColumns(safeRows).slice(0, 5);
    const meta = reportMetadata(title, safeRows);

    const maxRows = 100;
    const visibleRows = safeRows.slice(0, maxRows);
    const rowHeight = 36;

    const width = 1600;
    const height = Math.max(980, 640 + visibleRows.length * rowHeight);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#e2231a";
    ctx.fillRect(0, 0, width, 180);

    ctx.fillStyle = "#8f1510";
    ctx.fillRect(1060, 0, 540, 180);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.fillText("CLARO ATENCIÓN 360 · SUPERVISOR", 48, 50);

    ctx.font = "bold 40px Arial";
    ctx.fillText(reportCleanText(title).slice(0, 62), 48, 112);

    ctx.font = "16px Arial";
    ctx.fillText(`Generado: ${new Date().toLocaleString("es-PE")}`, 48, 148);

    const cards = [
      ["Registros", meta.total],
      ["Críticos", meta.critical],
      ["Riesgo SLA", meta.slaRisk],
      ["Periodo", payload.period || "-"]
    ];

    let cardX = 48;

    cards.forEach(([label, value]) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cardX, 230, 350, 120);

      ctx.fillStyle = "#e2231a";
      ctx.fillRect(cardX, 230, 350, 8);

      ctx.fillStyle = "#6b7280";
      ctx.font = "bold 14px Arial";
      ctx.fillText(String(label).toUpperCase(), cardX + 22, 270);

      ctx.fillStyle = "#e2231a";
      ctx.font = "bold 30px Arial";
      ctx.fillText(String(value).slice(0, 22), cardX + 22, 315);

      cardX += 378;
    });

    ctx.fillStyle = "#e2231a";
    ctx.font = "bold 28px Arial";
    ctx.fillText("Resumen ejecutivo", 48, 420);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(48, 450, width - 96, 86);

    ctx.fillStyle = "#e2231a";
    ctx.fillRect(48, 450, 8, 86);

    ctx.fillStyle = "#111827";
    ctx.font = "18px Arial";
    ctx.fillText(`Tipo: ${payload.type || "-"} · Alcance: ${payload.scope || "-"}`, 76, 482);

    ctx.fillStyle = "#6b7280";
    ctx.fillText("La imagen respeta los filtros, periodo, alcance y fechas seleccionadas.", 76, 512);

    ctx.fillStyle = "#e2231a";
    ctx.font = "bold 28px Arial";
    ctx.fillText("Detalle operativo", 48, 595);

    const tableX = 48;
    const tableY = 630;
    const tableWidth = width - 96;
    const colWidth = tableWidth / Math.max(columns.length, 1);

    ctx.fillStyle = "#e2231a";
    ctx.fillRect(tableX, tableY, tableWidth, rowHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px Arial";

    columns.forEach((column, index) => {
      ctx.fillText(reportColumnLabel(column).slice(0, 24), tableX + index * colWidth + 10, tableY + 24);
    });

    ctx.font = "14px Arial";

    visibleRows.forEach((row, rowIndex) => {
      const y = tableY + rowHeight + rowIndex * rowHeight;

      ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f3f4f6";
      ctx.fillRect(tableX, y, tableWidth, rowHeight);

      ctx.fillStyle = "#111827";

      columns.forEach((column, index) => {
        ctx.fillText(
          reportCleanText(row[column], "-").slice(0, 34),
          tableX + index * colWidth + 10,
          y + 23
        );
      });
    });

    ctx.fillStyle = "#6b7280";
    ctx.font = "15px Arial";

    if (safeRows.length > maxRows) {
      ctx.fillText(`Se muestran ${maxRows} de ${safeRows.length} registros. Usa Excel/CSV para el detalle completo.`, 48, height - 34);
    } else {
      ctx.fillText("Documento generado automáticamente. Uso interno operativo y auditable.", 48, height - 34);
    }

    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

async function reportExportFile({ title, format, rows, payload = {}, moduleName = "reportes" }) {
  const finalFormat = reportNormalizeFormat(format);
  const baseName = `${reportFileName(title || moduleName || "reporte_supervisor")}_${reportNowStamp()}`;

  if (finalFormat === "csv") {
    reportDownload(
      reportCsv(rows),
      `${baseName}.csv`,
      "text/csv;charset=utf-8"
    );

    toast("CSV generado", "Se descargó el archivo CSV correctamente.", "success");
    return;
  }

  if (finalFormat === "excel") {
    reportDownload(
      reportCsv(rows),
      `${baseName}_excel.csv`,
      "text/csv;charset=utf-8"
    );

    toast("Excel generado", "Se descargó un CSV profesional compatible con Excel.", "success");
    return;
  }

  if (finalFormat === "dashboard") {
    reportDownload(
      reportHtmlDocument(title, rows, payload),
      `${baseName}_dashboard.html`,
      "text/html;charset=utf-8"
    );

    toast("Dashboard generado", "Se descargó el dashboard compartible en HTML.", "success");
    return;
  }

  if (finalFormat === "word") {
    reportDownload(
      "\ufeff" + reportHtmlDocument(title, rows, payload),
      `${baseName}.doc`,
      "application/msword;charset=utf-8"
    );

    toast("Word generado", "Se descargó un archivo compatible con Word.", "success");
    return;
  }

  if (finalFormat === "image") {
    const imageBlob = await reportImageBlob(title, rows, payload);

    reportDownload(
      imageBlob,
      `${baseName}.png`,
      "image/png"
    );

    toast("Imagen generada", "Se descargó la imagen con el detalle filtrado.", "success");
    return;
  }

  if (finalFormat === "pdf") {
    reportDownload(
      reportPdfBlob(title, rows, payload),
      `${baseName}.pdf`,
      "application/pdf"
    );

    toast("PDF generado", "Se descargó el PDF con diseño ejecutivo y tabla filtrada.", "success");
    return;
  }
}

async function initReports() {
  bindReportEvents();
  reportEnsureCustomDateControls();
  await renderReportsPage();
}

function bindReportEvents() {
  $("#refreshReportsBtn")?.addEventListener("click", async () => {
    State.reports = [];
    await renderReportsPage();
  });

  $("#reportSearch")?.addEventListener("input", renderReportsPage);
  $("#reportsSearch")?.addEventListener("input", renderReportsPage);

  [
    "#reportTypeFilter",
    "#reportPeriodFilter",
    "#reportScopeFilter",
    "#reportStatusFilter",
    "#reportDateFrom",
    "#reportDateTo"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderReportsPage);
  });

  $("#reportPeriod")?.addEventListener("change", reportToggleCustomDates);
  $("#generateReportPeriod")?.addEventListener("change", reportToggleCustomDates);
  $("#reportGeneratePeriod")?.addEventListener("change", reportToggleCustomDates);

  $("#resetReportFiltersBtn")?.addEventListener("click", () => {
    [
      "#reportSearch",
      "#reportsSearch",
      "#reportDateFrom",
      "#reportDateTo",
      "#reportCustomDateFrom",
      "#reportCustomDateTo",
      "#reportComment"
    ].forEach((selector) => setValue(selector, ""));

    [
      "#reportTypeFilter",
      "#reportPeriodFilter",
      "#reportScopeFilter",
      "#reportStatusFilter"
    ].forEach((selector) => setValue(selector, "todos"));

    [
      "#reportType",
      "#reportPeriod",
      "#reportScope"
    ].forEach((selector) => setValue(selector, ""));

    setValue("#reportFormat", "PDF");

    [
      "#includeCharts",
      "#includeCases",
      "#includeSla",
      "#includeAudit"
    ].forEach((selector) => {
      const input = $(selector);
      if (input) input.checked = false;
    });

    reportToggleCustomDates();
    renderReportsPage();
  });

  $("#openGenerateReportBtn")?.addEventListener("click", () => {
    reportEnsureCustomDateControls();
    openModal("#generateReportModal");
  });

  $("#generateReportBtn")?.addEventListener("click", () => {
    reportEnsureCustomDateControls();
    openModal("#generateReportModal");
  });

  $("#confirmGenerateReportBtn")?.addEventListener("click", confirmGenerateReport);

  $("#openScheduleReportBtn")?.addEventListener("click", () => openModal("#scheduleReportModal"));
  $("#scheduleReportBtn")?.addEventListener("click", () => openModal("#scheduleReportModal"));
  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);

  $("#openReportExportBtn")?.addEventListener("click", () => openModal("#reportsExportModal"));
  $("#exportReportsBtn")?.addEventListener("click", () => openModal("#reportsExportModal"));
  $("#confirmReportsExportBtn")?.addEventListener("click", confirmReportsExport);

  $("#reportPreviewBtn")?.addEventListener("click", previewReport);
  $("#previewReportBtn")?.addEventListener("click", previewReport);
  $("#reportPreviewExportBtn")?.addEventListener("click", exportReportBySelectedFormat);
  $("#reportPreviewGenerateBtn")?.addEventListener("click", confirmGenerateReport);
}

async function renderReportsPage() {
  try {
    const response = await apiRequest(`${State.config.mainEndpoint || "/supervisor/reportes"}${buildQuery(getReportFilters())}`);
    const payload = normalizePayload(response);

    State.reports = listFrom(payload, [
      "items",
      "reports",
      "reportes",
      "recent_reports",
      "reportes_recientes",
      "historial"
    ]);

    const templates = listFrom(payload, [
      "templates",
      "plantillas",
      "report_templates",
      "plantillas_reporte"
    ]);

    const filteredReports = reportHistoryFiltered();

    renderKpis("#reportsKpiGrid", payload.kpis || buildReportKpis(filteredReports));
    renderAi("#reportsAiSummary", payload.ai_summary || payload.resumen_ia || buildReportsAi(filteredReports));
    renderChecklist("#reportsActionPlan", payload.action_plan || payload.plan_accion || buildReportsPlan(State.reports));

    renderReportTemplates(templates);
    renderReportsTable(filteredReports);
    renderRecentReports(filteredReports);
  } catch (error) {
    renderAi("#reportsAiSummary", [{ title: "No se pudieron cargar reportes", text: error.message }]);
    show("#emptyReportsState", true);
    show("#emptyRecentReportsState", true);
  }
}

function renderReportsTable(rows = []) {
  const reports = rows.map(normalizeReport);
  const body = $("#reportsTableBody") || $("#recentReportsTableBody");

  if (!body) return;

  body.innerHTML = reports.map((item) => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.type)}</td>
      <td>${esc(item.period)}</td>
      <td>${esc(item.format)}</td>
      <td><span class="${pillClass(caseStatusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(formatDateTime(item.date))}</td>
      <td>
        <button type="button" data-action="view-report" data-report-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(item.id)}">Descargar</button>
      </td>
    </tr>
  `).join("");

  bindReportButtons(body);
  show("#emptyReportsState", !reports.length);
}

function renderRecentReports(rows = []) {
  const container = $("#recentReportsList") || $("#reportsHistoryList");

  if (!container) return;

  const reports = rows.map(normalizeReport).slice(0, 8);

  container.innerHTML = reports.map((item) => `
    <article class="activity-item">
      <span class="activity-icon">📊</span>
      <div class="activity-content">
        <strong>${esc(item.name)}</strong>
        <p>${esc(item.type)} · ${esc(item.format)} · ${esc(item.status)}</p>
        <small>${esc(formatDateTime(item.date))}</small>
      </div>
      <div class="service-actions">
        <button type="button" data-action="view-report" data-report-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(item.id)}">Descargar</button>
      </div>
    </article>
  `).join("");

  bindReportButtons(container);
  show("#emptyRecentReportsState", !reports.length);
}

function bindReportButtons(root = document) {
  $$('[data-action="view-report"]', root).forEach((button) => {
    button.addEventListener("click", () => openReportDetail(button.dataset.reportId));
  });

  $$('[data-action="download-report"]', root).forEach((button) => {
    button.addEventListener("click", () => downloadGeneratedReport(button.dataset.reportId));
  });
}

function openReportDetail(id) {
  const report = State.reports.map(normalizeReport).find((item) => String(item.id) === String(id));

  if (!report) return;

  saveSelectedReport(id);

  setText("#reportDetailTitle", report.name);
  setText("#reportDetailText", `${report.type} · ${report.period} · ${report.format}`);
  setHTML("#reportDetailSummary", summaryHTML([
    ["Reporte", report.name],
    ["Tipo", report.type],
    ["Periodo", report.period],
    ["Formato", report.format],
    ["Estado", report.status],
    ["Generado por", report.owner],
    ["Fecha", formatDateTime(report.date)]
  ]));

  openModal("#reportDetailModal");
}

async function previewReport() {
  const payload = reportPayload();

  if (!payload.type || !payload.period || !payload.scope || !payload.format) {
    toast("Faltan datos", "Completa tipo, periodo, alcance y formato.", "warning");
    return;
  }

  const periodKey = reportNormalizeKey(payload.period);

  if (periodKey.includes("personalizado") || periodKey.includes("rango")) {
    if (!payload.dateFrom || !payload.dateTo) {
      toast("Fechas requeridas", "Selecciona fecha desde y fecha hasta para el rango personalizado.", "warning");
      return;
    }
  }

  const rows = await reportFetchRows(payload);

  setHTML("#reportPreviewSummary", summaryHTML([
    ["Tipo", payload.type],
    ["Formato", payload.format],
    ["Periodo", payload.period],
    ["Alcance", payload.scope],
    ["Fecha desde", payload.dateFrom || "-"],
    ["Fecha hasta", payload.dateTo || "-"],
    ["Registros estimados", rows.length],
    ["Salida", payload.format === "Excel" ? "CSV compatible con Excel" : payload.format]
  ]));

  show("#reportPreviewPanel", true);
  toast("Vista previa generada", "El conteo ya respeta filtros, periodo, alcance y fechas.", "success");
}

async function confirmGenerateReport() {
  const payload = reportPayload();

  if (!payload.type || !payload.period || !payload.scope || !payload.format) {
    toast("Faltan datos", "Completa tipo, periodo, alcance y formato.", "warning");
    return;
  }

  const periodKey = reportNormalizeKey(payload.period);

  if (periodKey.includes("personalizado") || periodKey.includes("rango")) {
    if (!payload.dateFrom || !payload.dateTo) {
      toast("Fechas requeridas", "Selecciona fecha desde y fecha hasta para el rango personalizado.", "warning");
      return;
    }

    if (new Date(payload.dateFrom) > new Date(payload.dateTo)) {
      toast("Rango inválido", "La fecha desde no puede ser mayor que la fecha hasta.", "warning");
      return;
    }
  }

  openConfirmAction({
    title: "Generar reporte",
    text: "El reporte se generará aplicando los filtros seleccionados.",
    summary: summaryHTML([
      ["Tipo", payload.type],
      ["Formato", payload.format],
      ["Periodo", payload.period],
      ["Alcance", payload.scope],
      ["Fecha desde", payload.dateFrom || "-"],
      ["Fecha hasta", payload.dateTo || "-"],
      ["Comentario", payload.comment]
    ]),
    onConfirm: async () => {
      const rows = await reportFetchRows(payload);

      await reportExportFile({
        title: `Reporte ${payload.type}`,
        format: payload.format,
        rows,
        payload,
        moduleName: "reportes"
      });

      closeModals();

      try {
        State.reports = [];
        await renderReportsPage();
      } catch {
        // No bloquear la descarga si falla el refresco visual.
      }
    }
  });
}

async function exportReportBySelectedFormat() {
  const payload = reportPayload();
  const rows = await reportFetchRows(payload);

  await reportExportFile({
    title: `Reporte ${payload.type}`,
    format: payload.format,
    rows,
    payload,
    moduleName: "reportes"
  });
}

async function confirmReportsExport() {
  const format =
    getValue("#reportsExportFormat") ||
    getValue("#reportExportFormat") ||
    getValue("#reportFormat") ||
    "Excel";

  const reason =
    getValue("#reportsExportReason") ||
    getValue("#reportExportReason") ||
    "Exportación del historial de reportes filtrado";

  const payload = {
    type: "Historial de reportes",
    period: getValue("#reportPeriodFilter") || "Filtro actual",
    scope: getValue("#reportScopeFilter") || "Historial visible",
    format,
    comment: reason,
    dateFrom: getValue("#reportDateFrom"),
    dateTo: getValue("#reportDateTo")
  };

  const rows = reportHistoryFiltered();

  await reportExportFile({
    title: "Historial de reportes",
    format,
    rows,
    payload,
    moduleName: "reportes"
  });

  closeModals();
}

async function downloadGeneratedReport(id) {
  const report = State.reports
    .map(normalizeReport)
    .find((item) => String(item.id) === String(id));

  if (!report) {
    toast("Reporte no encontrado", "No se encontró el reporte seleccionado.", "warning");
    return;
  }

  const payload = {
    type: report.type,
    period: report.period,
    scope: "Reporte seleccionado",
    format: report.format || "PDF",
    comment: report.name
  };

  await reportExportFile({
    title: report.name,
    format: report.format || "PDF",
    rows: [report],
    payload,
    moduleName: "reportes"
  });
}

async function requestExport({
  format,
  scope,
  detail,
  destination,
  reason,
  include = {},
  selectedIds = [],
  module = State.config?.module || State.page || "supervisor"
}) {
  if (!format || !scope || !reason) {
    toast("Faltan datos", "Completa formato, alcance y motivo de exportación.", "warning");
    return;
  }

  let rows = [];

  const moduleKey = reportNormalizeKey(module || State.page);

  if (moduleKey.includes("casos-pendientes")) {
    rows = typeof pendingFilteredCases === "function" ? pendingFilteredCases() : State.cases.map(normalizeCase);
  } else if (moduleKey.includes("asignaciones")) {
    rows = typeof assignmentFilteredCases === "function" ? assignmentFilteredCases() : State.cases.map(normalizeCase);
  } else if (moduleKey.includes("carga-asesores")) {
    rows = typeof advisorLoadFiltered === "function" ? advisorLoadFiltered() : State.advisors.map(normalizeAdvisor);
  } else if (moduleKey.includes("monitoreo-sla") || moduleKey.includes("sla")) {
    rows = typeof slaFilteredCases === "function" ? slaFilteredCases() : State.cases.map(normalizeCase);
  } else if (moduleKey.includes("indicadores")) {
    rows = [
      ...State.indicators.map(normalizeIndicator),
      ...State.advisors.map(normalizeAdvisor)
    ];
  } else if (moduleKey.includes("auditoria")) {
    rows = typeof auditFiltered === "function" ? auditFiltered() : State.audit.map(normalizeAudit);
  } else if (moduleKey.includes("configuracion")) {
    rows = [
      ...(typeof configFiltered === "function" ? configFiltered(State.configRules) : State.configRules),
      ...(typeof configFiltered === "function" ? configFiltered(State.routeRules) : State.routeRules)
    ];
  } else if (moduleKey.includes("reportes")) {
    rows = reportHistoryFiltered();
  } else {
    rows = State.cases.map(normalizeCase);
  }

  if (Array.isArray(selectedIds) && selectedIds.length) {
    const selected = new Set(selectedIds.map(String));

    rows = rows.filter((row) => {
      const id =
        row.id ||
        row.caseId ||
        row.case_id ||
        row.caso_id ||
        row.advisorId ||
        row.usuario_id ||
        row.auditoria_id;

      return selected.has(String(id));
    });
  }

  await reportExportFile({
    title: `Exportación ${module}`,
    format,
    rows,
    payload: {
      type: module,
      period: "Filtro actual",
      scope,
      detail,
      destination,
      reason,
      include
    },
    moduleName: module
  });
}

function reportReplaceButton(selector, handler) {
  const oldButton = document.querySelector(selector);

  if (!oldButton) return;

  const newButton = oldButton.cloneNode(true);
  oldButton.parentNode.replaceChild(newButton, oldButton);

  newButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      await handler(event);
    } catch (error) {
      console.error(error);
      toast("No se pudo exportar", error.message || "Error inesperado.", "danger");
    }
  });
}

function reportRebindExportButtons() {
  reportEnsureCustomDateControls();

  reportReplaceButton("#confirmGenerateReportBtn", confirmGenerateReport);
  reportReplaceButton("#reportPreviewGenerateBtn", confirmGenerateReport);
  reportReplaceButton("#reportPreviewExportBtn", exportReportBySelectedFormat);
  reportReplaceButton("#reportPreviewBtn", previewReport);
  reportReplaceButton("#previewReportBtn", previewReport);
  reportReplaceButton("#confirmReportsExportBtn", confirmReportsExport);
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(reportRebindExportButtons, 300);
  setTimeout(reportRebindExportButtons, 1200);
});


/* =========================================================
   INDICADORES - VISTA COMPACTA / AMPLIA + DESEMPEÑO ASESOR
   CLARO ATENCIÓN 360 - SUPERVISOR

   Pegar después del bloque limpio de Reportes.
   Corrige:
   - Botón vista compacta/amplia.
   - Botón Ver desempeño del asesor.
   - Filtros de indicadores.
   - Render estable de desempeño.
========================================================= */

function indicatorNormalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getIndicatorFilters() {
  return {
    periodo: getValue("#indicatorPeriod") || getValue("#indicatorsPeriod") || "semana",
    asesor: getValue("#indicatorAdvisor") || getValue("#indicatorsAdvisor") || "todos",
    area: getValue("#indicatorArea") || getValue("#indicatorsArea") || "todos",
    tipo_caso: getValue("#indicatorCaseType") || getValue("#indicatorsCaseType") || "todos",
    canal: getValue("#indicatorChannel") || getValue("#indicatorsChannel") || "todos",
    prioridad: getValue("#indicatorPriority") || getValue("#indicatorsPriority") || "todos",
    estado: getValue("#indicatorStatus") || getValue("#indicatorsStatus") || "todos",
    grupo: getValue("#indicatorGroup") || getValue("#indicatorsGroup") || "todos",
    fecha_desde: getValue("#indicatorDateFrom") || "",
    fecha_hasta: getValue("#indicatorDateTo") || ""
  };
}

function normalizeIndicatorCard(item = {}) {
  return {
    id: item.id || item.codigo || item.key || item.label || item.title || item.titulo || cryptoSafeId(),
    icon: item.icon || item.icono || "📊",
    title: item.title || item.titulo || item.label || item.nombre || "Indicador",
    value: item.value ?? item.valor ?? item.total ?? "-",
    target: item.target ?? item.meta ?? "-",
    progress: Number(item.progress ?? item.avance ?? item.porcentaje ?? 0),
    status: item.status || item.estado || "neutral",
    trend: item.trend || item.tendencia || "",
    description: item.description || item.descripcion || item.detail || item.detalle || "Indicador operativo de supervisión."
  };
}

function cryptoSafeId() {
  return `id_${Math.random().toString(36).slice(2, 10)}`;
}

function indicatorStatusClass(status) {
  const text = indicatorNormalizeText(status);

  if (text.includes("danger") || text.includes("critico") || text.includes("crítico") || text.includes("rojo")) {
    return "danger";
  }

  if (text.includes("warning") || text.includes("advertencia") || text.includes("riesgo") || text.includes("amarillo")) {
    return "warning";
  }

  if (text.includes("success") || text.includes("ok") || text.includes("verde") || text.includes("cumplido")) {
    return "success";
  }

  return "neutral";
}

function renderIndicatorCards(items = []) {
  const indicators = items.map(normalizeIndicatorCard);
  const grid = $("#mainIndicatorGrid") || $("#indicatorsGrid") || $("#indicatorGrid");

  if (!grid) return;

  grid.innerHTML = indicators.map((indicator) => {
    const statusClass = indicatorStatusClass(indicator.status);

    return `
      <article class="indicator-card indicator-card--${esc(statusClass)}" data-indicator-id="${esc(indicator.id)}">
        <div class="indicator-card__head">
          <span class="indicator-card__icon">${esc(indicator.icon)}</span>
          <span class="${pillClass(statusClass)}">${esc(indicator.status)}</span>
        </div>

        <div class="indicator-card__body">
          <h3>${esc(indicator.title)}</h3>
          <strong>${esc(indicator.value)}</strong>
          <p>${esc(indicator.description)}</p>
        </div>

        <div class="indicator-card__meta">
          <span>Meta: ${esc(indicator.target)}</span>
          <span>${esc(indicator.trend || "Sin tendencia")}</span>
        </div>

        <div class="progress-bar" aria-label="Avance ${esc(indicator.progress)}%">
          <span style="width:${Math.max(0, Math.min(100, indicator.progress))}%"></span>
        </div>

        <div class="indicator-card__actions">
          <button type="button" data-action="open-indicator-detail" data-indicator-id="${esc(indicator.id)}">
            Ver detalle
          </button>
        </div>
      </article>
    `;
  }).join("");

  $$('[data-action="open-indicator-detail"]', grid).forEach((button) => {
    button.addEventListener("click", () => {
      const indicator = indicators.find((item) => String(item.id) === String(button.dataset.indicatorId));

      if (!indicator) return;

      openIndicatorDetail(indicator);
    });
  });
}

function openIndicatorDetail(indicator) {
  setText("#indicatorDetailTitle", indicator.title);
  setText("#indicatorDetailText", indicator.description);

  setHTML("#indicatorDetailSummary", summaryHTML([
    ["Indicador", indicator.title],
    ["Valor", indicator.value],
    ["Meta", indicator.target],
    ["Avance", `${indicator.progress}%`],
    ["Estado", indicator.status],
    ["Tendencia", indicator.trend || "-"]
  ]));

  openModal("#indicatorDetailModal");
}

function renderAdvisorPerformanceTable(rows = []) {
  const advisors = rows.map((item) => ({
    id: item.id || item.advisor_id || item.asesor_id,
    name: item.name || item.nombre || item.advisorName || item.asesor_nombre || "Asesor",
    status: item.status || item.estado || "Disponible",
    cases: item.cases ?? item.casos ?? 0,
    closed: item.closed ?? item.cerrados ?? 0,
    critical: item.critical ?? item.criticos ?? 0,
    slaRisk: item.slaRisk ?? item.riesgo_sla ?? 0,
    capacity: item.capacity ?? item.capacidad ?? 0,
    productivity: item.productivity ?? item.productividad ?? 0,
    slaCompliance: item.slaCompliance ?? item.cumplimiento_sla ?? "-"
  }));

  const body =
    $("#advisorPerformanceTableBody") ||
    $("#indicatorAdvisorPerformanceBody") ||
    $("#advisorPerformanceBody");

  if (!body) return;

  body.innerHTML = advisors.map((advisor) => `
    <tr>
      <td>
        <strong>${esc(advisor.name)}</strong>
        <small>${esc(advisor.status)}</small>
      </td>
      <td>${esc(advisor.cases)}</td>
      <td>${esc(advisor.closed)}</td>
      <td>${esc(advisor.critical)}</td>
      <td>${esc(advisor.slaRisk)}</td>
      <td>${esc(advisor.capacity)}%</td>
      <td>${esc(advisor.productivity)}%</td>
      <td>${esc(advisor.slaCompliance)}${String(advisor.slaCompliance).includes("%") ? "" : "%"}</td>
      <td>
        <button type="button" data-action="view-advisor-performance" data-advisor-id="${esc(advisor.id)}">
          Ver desempeño
        </button>
      </td>
    </tr>
  `).join("");

  $$('[data-action="view-advisor-performance"]', body).forEach((button) => {
    button.addEventListener("click", () => {
      viewAdvisorPerformance(button.dataset.advisorId);
    });
  });
}

async function viewAdvisorPerformance(advisorId) {
  if (!advisorId) {
    toast("Asesor no seleccionado", "No se encontró el asesor para consultar desempeño.", "warning");
    return;
  }

  try {
    const filters = getIndicatorFilters();

    const response = await apiRequest(
      `/supervisor/indicadores/desempeno-asesor/${encodeURIComponent(advisorId)}${buildQuery({
        periodo: filters.periodo
      })}`
    );

    const payload = normalizePayload(response);

    const advisor = payload.advisor || payload.asesor || {};
    const metrics = payload.metrics || payload.metricas || {};
    const cases = listFrom(payload, ["cases", "casos", "items"]);

    setText("#advisorPerformanceTitle", advisor.name || advisor.nombre || "Desempeño del asesor");
    setText(
      "#advisorPerformanceText",
      `${advisor.status || advisor.estado || "Estado no indicado"} · ${advisor.specialty || advisor.especialidad || "Especialidad no indicada"}`
    );

    setHTML("#advisorPerformanceSummary", summaryHTML([
      ["Asesor", advisor.name || advisor.nombre || "-"],
      ["Casos totales", metrics.total_cases ?? metrics.casos_totales ?? cases.length],
      ["Casos cerrados", metrics.closed_cases ?? metrics.casos_cerrados ?? "-"],
      ["Casos críticos", metrics.critical_cases ?? metrics.casos_criticos ?? "-"],
      ["Riesgo SLA", metrics.sla_risk ?? metrics.riesgo_sla ?? "-"],
      ["SLA cumplido", metrics.sla_compliance ?? metrics.cumplimiento_sla ?? "-"],
      ["Capacidad", `${metrics.capacity ?? metrics.capacidad ?? advisor.capacity ?? advisor.capacidad ?? "-"}%`],
      ["Productividad", `${metrics.productivity ?? metrics.productividad ?? advisor.productivity ?? advisor.productividad ?? "-"}%`]
    ]));

    const caseBody = $("#advisorPerformanceCasesBody");

    if (caseBody) {
      caseBody.innerHTML = cases.map((item) => {
        const normalized = normalizeCase(item);

        return `
          <tr>
            <td>${esc(normalized.code)}</td>
            <td>${esc(normalized.clientName)}</td>
            <td>${esc(normalized.type)}</td>
            <td>${esc(normalized.priority)}</td>
            <td>${esc(normalized.status)}</td>
            <td>${esc(normalized.slaText || normalized.slaRisk || "-")}</td>
          </tr>
        `;
      }).join("");
    }

    const recommendations = payload.recommendations || payload.recomendaciones || [];

    setHTML(
      "#advisorPerformanceRecommendations",
      recommendations.length
        ? recommendations.map((item) => `<li>${esc(reportCleanText(item))}</li>`).join("")
        : "<li>Mantener monitoreo según evolución diaria.</li>"
    );

    openModal("#advisorPerformanceModal");
  } catch (error) {
    console.error(error);
    toast("No se pudo cargar desempeño", error.message, "danger");
  }
}

function toggleIndicatorView() {
  const grid = $("#mainIndicatorGrid") || $("#indicatorsGrid") || $("#indicatorGrid");
  const button = $("#toggleIndicatorViewBtn") || $("#compactIndicatorViewBtn") || $("#indicatorViewToggleBtn");

  if (!grid) return;

  const isCompact = grid.classList.toggle("indicator-grid--compact");

  if (button) {
    button.textContent = isCompact ? "Vista amplia" : "Vista compacta";
    button.classList.toggle("active", isCompact);
    button.setAttribute("aria-pressed", String(isCompact));
  }

  localStorage.setItem("claro360-supervisor-indicator-view", isCompact ? "compact" : "wide");
}

function restoreIndicatorView() {
  const grid = $("#mainIndicatorGrid") || $("#indicatorsGrid") || $("#indicatorGrid");
  const button = $("#toggleIndicatorViewBtn") || $("#compactIndicatorViewBtn") || $("#indicatorViewToggleBtn");

  if (!grid) return;

  const saved = localStorage.getItem("claro360-supervisor-indicator-view");

  if (saved === "compact") {
    grid.classList.add("indicator-grid--compact");

    if (button) {
      button.textContent = "Vista amplia";
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
    }
  } else if (button) {
    button.textContent = "Vista compacta";
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
  }
}

async function renderIndicatorsPage() {
  try {
    const filters = getIndicatorFilters();

    const response = await apiRequest(`/supervisor/indicadores${buildQuery(filters)}`);
    const payload = normalizePayload(response);

    const indicators = listFrom(payload, [
      "items",
      "indicators",
      "indicadores",
      "kpis"
    ]);

    const advisors = listFrom(payload, [
      "advisors",
      "asesores",
      "advisor_performance",
      "desempeno_asesores"
    ]);

    renderKpis("#indicatorsKpiGrid", payload.kpis || indicators.slice(0, 4));
    renderIndicatorCards(indicators);
    renderAdvisorPerformanceTable(advisors);

    renderAi(
      "#indicatorsAiSummary",
      payload.ai_summary || payload.resumen_ia || payload.insights || payload.recomendaciones || []
    );

    renderChecklist(
      "#indicatorsActionPlan",
      payload.action_plan || payload.plan_accion || []
    );

    restoreIndicatorView();

    show("#emptyIndicatorsState", !indicators.length);
  } catch (error) {
    console.error(error);
    renderAi("#indicatorsAiSummary", [
      {
        title: "No se pudieron cargar indicadores",
        text: error.message
      }
    ]);
  }
}

function bindIndicatorEventsClean() {
  [
    "#indicatorPeriod",
    "#indicatorsPeriod",
    "#indicatorAdvisor",
    "#indicatorsAdvisor",
    "#indicatorArea",
    "#indicatorsArea",
    "#indicatorCaseType",
    "#indicatorsCaseType",
    "#indicatorChannel",
    "#indicatorsChannel",
    "#indicatorPriority",
    "#indicatorsPriority",
    "#indicatorStatus",
    "#indicatorsStatus",
    "#indicatorGroup",
    "#indicatorsGroup",
    "#indicatorDateFrom",
    "#indicatorDateTo"
  ].forEach((selector) => {
    $(selector)?.addEventListener("change", renderIndicatorsPage);
  });

  $("#refreshIndicatorsBtn")?.addEventListener("click", renderIndicatorsPage);

  $("#resetIndicatorFiltersBtn")?.addEventListener("click", () => {
    [
      "#indicatorDateFrom",
      "#indicatorDateTo"
    ].forEach((selector) => setValue(selector, ""));

    [
      "#indicatorPeriod",
      "#indicatorsPeriod"
    ].forEach((selector) => setValue(selector, "semana"));

    [
      "#indicatorAdvisor",
      "#indicatorsAdvisor",
      "#indicatorArea",
      "#indicatorsArea",
      "#indicatorCaseType",
      "#indicatorsCaseType",
      "#indicatorChannel",
      "#indicatorsChannel",
      "#indicatorPriority",
      "#indicatorsPriority",
      "#indicatorStatus",
      "#indicatorsStatus",
      "#indicatorGroup",
      "#indicatorsGroup"
    ].forEach((selector) => setValue(selector, "todos"));

    renderIndicatorsPage();
  });

  const toggleButton =
    $("#toggleIndicatorViewBtn") ||
    $("#compactIndicatorViewBtn") ||
    $("#indicatorViewToggleBtn");

  if (toggleButton) {
    const cloned = toggleButton.cloneNode(true);
    toggleButton.parentNode.replaceChild(cloned, toggleButton);
    cloned.addEventListener("click", toggleIndicatorView);
  }
}

async function initIndicators() {
  bindIndicatorEventsClean();
  await renderIndicatorsPage();
}