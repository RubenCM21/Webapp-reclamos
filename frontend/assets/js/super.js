"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - SUPERVISOR.JS
   Versión funcional conectada a FastAPI + SQL Server
   Módulo Supervisor:
   - Dashboard
   - Casos pendientes
   - Asignaciones
   - Carga de asesores
   - Monitoreo SLA
   - Indicadores
   - Reportes
   - Auditoría
   - Configuración
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const State = {
  page: document.body.dataset.page || "",
  theme:
    localStorage.getItem("claro360-supervisor-theme") ||
    localStorage.getItem("claro360-theme") ||
    "light",

  user: null,
  supervisor: null,

  cases: [],
  advisors: [],
  indicators: [],
  reports: [],
  audit: [],
  configRules: [],
  routeRules: [],
  priorityMatrix: [],

  selectedCaseId: null,
  selectedAdvisorId: null,
  selectedIndicatorId: null,
  selectedAuditId: null,
  selectedConfigRuleId: null,
  selectedRouteRuleId: null,

  pendingFilter: "todos",
  pendingView: "cards",

  assignmentFilter: "todos",
  assignmentView: "cards",

  advisorLoadFilter: "todos",
  advisorLoadView: "cards",

  slaFilter: "todos",
  slaView: "cards",

  auditFilter: "todos",
  configFilter: "todos",

  indicatorCompact: false,
};

const PAGE_LINKS = [
  ["🏠", "Dashboard", "Centro de supervisión operativa.", "dashboard.html"],
  ["📋", "Casos pendientes", "Clasificación y decisión de casos.", "casos-pendientes.html"],
  ["👥", "Asignaciones", "Asignar, reasignar, derivar y escalar casos.", "asignaciones.html"],
  ["⚖️", "Carga de asesores", "Balance de capacidad del equipo.", "carga-asesores.html"],
  ["⏱️", "Monitoreo SLA", "Control de vencimientos y riesgo.", "monitoreo-sla.html"],
  ["📈", "Indicadores", "Métricas operativas.", "indicadores.html"],
  ["📊", "Reportes", "Generación formal de reportes.", "reportes.html"],
  ["🕵️", "Auditoría", "Trazabilidad de acciones.", "auditoria-casos.html"],
  ["⚙️", "Configuración", "Reglas operativas de supervisión.", "configuracion-supervision.html"],
];

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

/* =========================================================
   UTILIDADES BASE
========================================================= */

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

function getChecked(selector) {
  return Boolean($(selector)?.checked);
}

function show(element, condition) {
  if (!element) return;
  element.classList.toggle("hidden", !condition);
}

function debounce(fn, delay = 250) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function initials(name) {
  return (
    String(name || "Supervisor")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SU"
  );
}

function lower(value) {
  return String(value || "").toLowerCase();
}

/* =========================================================
   SESIÓN / API
========================================================= */

function getToken() {
  return (
    localStorage.getItem("claro360-access-token") ||
    localStorage.getItem("claro360-token") ||
    ""
  );
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
  localStorage.removeItem("claro360-token");
  localStorage.removeItem("claro360-session");
  localStorage.removeItem("claro360-supervisor-selected-case");
}

function requireSupervisorSession() {
  const token = getToken();
  const storedUser = getStoredUser();
  const role = String(storedUser?.rol || storedUser?.role || "").toUpperCase();

  if (!token) {
    window.location.href = "../login.html?role=supervisor";
    return false;
  }

  if (role && role !== "SUPERVISOR") {
    clearSession();
    window.location.href = "../login.html?role=supervisor";
    return false;
  }

  State.user = storedUser;
  return true;
}

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || "Dato inválido").join(" ");
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return "No se pudo completar la operación.";
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

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("No se pudo conectar con el backend. Verifica FastAPI en http://127.0.0.1:8000.");
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = "../login.html?role=supervisor";
      return {};
    }

    throw new Error(getApiErrorMessage(data));
  }

  return data;
}

/* =========================================================
   TOAST / MODALES
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
    setTimeout(() => item.remove(), 260);
  }, 3400);
}

function openModal(selector) {
  const modal = $(selector);

  if (!modal) {
    genericModal("⚠️", "Acción no disponible", "Esta ventana no existe en la pantalla actual.");
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
}

function genericModal(icon, title, text) {
  setText("#genericModalIcon", icon);
  setText("#genericModalTitle", title);
  setText("#genericModalText", text);
  openModal("#genericModal");
}

function confirmToast(message = "Operación realizada correctamente.") {
  toast("Acción completada", message, "success");
}

/* =========================================================
   CONFIRMACIONES, VALIDACIÓN Y HELPERS DE FORMULARIOS
========================================================= */

function ensureConfirmModal() {
  if ($("#confirmActionModal")) return;

  const modal = document.createElement("section");
  modal.className = "modal";
  modal.id = "confirmActionModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal__content modal__content--wide">
      <button type="button" class="modal__close" data-close-modal>×</button>
      <div class="modal__icon" id="confirmActionIcon">✅</div>
      <span class="eyebrow eyebrow--red" id="confirmActionEyebrow">Confirmación</span>
      <h3 id="confirmActionTitle">Confirmar acción</h3>
      <p id="confirmActionText">Revisa la información antes de continuar.</p>
      <div class="case-modal-summary" id="confirmActionSummary"></div>
      <div class="modal__actions">
        <button type="button" class="btn btn--primary" id="confirmActionAcceptBtn">Confirmar</button>
        <button type="button" class="btn btn--ghost-dark" data-close-modal>Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmAction({
  icon = "✅",
  eyebrow = "Confirmación",
  title = "Confirmar acción",
  text = "Revisa la información antes de continuar.",
  summary = "",
  confirmText = "Confirmar",
  onConfirm,
}) {
  ensureConfirmModal();

  setText("#confirmActionIcon", icon);
  setText("#confirmActionEyebrow", eyebrow);
  setText("#confirmActionTitle", title);
  setText("#confirmActionText", text);
  setHTML("#confirmActionSummary", summary || "");
  setText("#confirmActionAcceptBtn", confirmText);

  const oldButton = $("#confirmActionAcceptBtn");
  if (oldButton) {
    oldButton.replaceWith(oldButton.cloneNode(true));
    $("#confirmActionAcceptBtn")?.addEventListener("click", async () => {
      try {
        $("#confirmActionAcceptBtn").disabled = true;
        await onConfirm?.();
      } finally {
        const button = $("#confirmActionAcceptBtn");
        if (button) button.disabled = false;
      }
    });
  }

  openModal("#confirmActionModal");
}

function getAnyValue(...selectors) {
  for (const selector of selectors) {
    const value = getValue(selector);
    if (value) return value;
  }
  return "";
}

function setAnyValue(value, ...selectors) {
  selectors.forEach((selector) => setValue(selector, value));
}

function isCheckedAny(...selectors) {
  return selectors.some((selector) => getChecked(selector));
}

function requireValue(selector, label) {
  if (getValue(selector)) return true;

  toast("Validación requerida", `Completa el campo: ${label}.`, "warning");
  $(selector)?.focus();
  return false;
}

function requireAnyValue(selectors, label) {
  if (selectors.some((selector) => getValue(selector))) return true;

  toast("Validación requerida", `Completa el campo: ${label}.`, "warning");
  $(selectors[0])?.focus();
  return false;
}

function requireDeclaration(selector, message = "Debes confirmar la declaración antes de continuar.") {
  const checkbox = $(selector);
  if (!checkbox) return true;

  if (checkbox.checked) return true;

  toast("Confirmación requerida", message, "warning");
  checkbox.focus();
  return false;
}

function caseConfirmSummary(caseItem, extraRows = []) {
  const c = normalizeCase(caseItem);

  return summaryHTML([
    ["Caso", c.code],
    ["Cliente", c.clientName],
    ["Prioridad", c.priority],
    ["Estado", c.status],
    ["Responsable actual", c.advisorName],
    ["SLA", c.slaText],
    ...extraRows,
  ]);
}

function advisorNameById(id) {
  return getAdvisor(id)?.name || id || "-";
}

function closeOperationalModals() {
  closeModals();
}

/* =========================================================
   TEMA / SIDEBAR / TOPBAR
========================================================= */

function applyTheme(theme) {
  State.theme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = State.theme;
  localStorage.setItem("claro360-supervisor-theme", State.theme);
  localStorage.setItem("claro360-theme", State.theme);
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

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");

  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function logout() {
  confirmAction({
    icon: "↩",
    eyebrow: "Cerrar sesión",
    title: "¿Deseas cerrar sesión?",
    text: "Se cerrará tu sesión de supervisor y volverás a la pantalla de login.",
    summary: summaryHTML([
      ["Usuario", State.supervisor?.nombre || State.user?.nombre || "Supervisor"],
      ["Rol", "Supervisor"],
    ]),
    confirmText: "Cerrar sesión",
    onConfirm: async () => {
      clearSession();
      toast("Sesión cerrada", "Serás redirigido al login.", "success");
      setTimeout(() => {
        window.location.href = "../login.html?role=supervisor";
      }, 500);
    },
  });
}

function setupUserFromStorage() {
  const user = State.user || getStoredUser();
  const name =
    user.nombre ||
    user.name ||
    user.username ||
    user.correo ||
    "Supervisor";

  setText("#userNameTop", name);
  setText("#userRoleTop", "Supervisor de Atención");
  setText("#userTypeTop", "Supervisor de Atención");
  setText("#userAvatar", initials(name));
}

/* =========================================================
   NORMALIZADORES
========================================================= */

function priorityValue(priority) {
  const value = lower(priority);

  if (value.includes("crítica") || value.includes("critica")) return 4;
  if (value.includes("alta")) return 3;
  if (value.includes("media")) return 2;

  return 1;
}

function caseStatusType(status) {
  const value = lower(status);

  if (
    value.includes("vencido") ||
    value.includes("escalado") ||
    value.includes("crítica") ||
    value.includes("critica")
  ) {
    return "danger";
  }

  if (
    value.includes("pendiente") ||
    value.includes("observado") ||
    value.includes("riesgo") ||
    value.includes("registrado")
  ) {
    return "warning";
  }

  if (
    value.includes("cerrado") ||
    value.includes("resuelto") ||
    value.includes("controlado")
  ) {
    return "success";
  }

  if (value.includes("derivado")) {
    return "purple";
  }

  return "info";
}

function priorityType(priority) {
  const value = lower(priority);

  if (value.includes("crítica") || value.includes("critica")) return "danger";
  if (value.includes("alta")) return "warning";
  if (value.includes("media")) return "info";

  return "success";
}

function advisorStatusType(status) {
  const value = lower(status);

  if (value.includes("no disponible") || value.includes("inactivo") || value.includes("bloqueado")) {
    return "danger";
  }

  if (value.includes("ocupado") || value.includes("sobrecargado")) {
    return "warning";
  }

  if (value.includes("disponible") || value.includes("activo")) {
    return "success";
  }

  return "info";
}

function indicatorStatusType(status) {
  const value = lower(status);

  if (["danger", "warning", "success", "info", "purple"].includes(value)) {
    return value;
  }

  return caseStatusType(value);
}

function pillClass(type) {
  return `status-pill status-pill--${type || "info"}`;
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
      : asNumber(item.slaHours ?? item.sla_hours ?? item.horas_sla, 999);

  const type = item.type || item.tipo_caso || item.tipo || "Caso";
  const priority = item.priority || item.prioridad || "Media";
  const status = item.status || item.estado || item.estado_caso || "Registrado";

  const id =
    item.id ||
    item.case_id ||
    item.caso_id ||
    item.codigo_caso ||
    item.codigo ||
    "-";

  const code =
    item.code ||
    item.codigo_caso ||
    item.codigo ||
    String(id);

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
    lower(status).includes("derivado");

  const escalated =
    Boolean(item.escalated ?? item.escalado) ||
    lower(status).includes("escal");

  const observed =
    Boolean(item.observed ?? item.observado) ||
    lower(status).includes("observado") ||
    Boolean(item.pendiente_cliente);

  const blocked =
    Boolean(item.blocked ?? item.bloqueado) ||
    lower(status).includes("pendiente") ||
    Boolean(item.pendiente_cliente);

  const riskType =
    item.riskType ||
    item.risk_type ||
    item.tipo_riesgo ||
    (calculatedHours < 0
      ? "vencidos"
      : calculatedHours <= 8
      ? "riesgo_alto"
      : blocked
      ? "bloqueados"
      : derived
      ? "derivados"
      : escalated
      ? "escalados"
      : "todos");

  return {
    id,
    caseId: id,
    code,

    icon:
      item.icon ||
      (priorityValue(priority) === 4
        ? "🔥"
        : type === "Incidencia"
        ? "⚠️"
        : "📝"),

    type,
    category: item.category || item.categoria || "General",

    clientName:
      item.clientName ||
      item.cliente_nombre ||
      item.cliente ||
      item.nombre_cliente ||
      "Cliente",

    clientType:
      item.clientType ||
      item.tipo_cliente ||
      "Cliente",

    document:
      item.documento ||
      item.document ||
      "-",

    channel:
      item.channel ||
      item.canal ||
      "Portal cliente",

    service:
      item.service ||
      item.servicio ||
      item.servicio_nombre ||
      item.plan_nombre ||
      "Servicio asociado",

    title:
      item.title ||
      item.titulo ||
      code,

    description:
      item.description ||
      item.descripcion ||
      "",

    status,
    priority,

    classificationStatus,
    assignmentStatus,

    assignmentFlow:
      item.assignmentFlow ||
      item.flujo_asignacion ||
      (escalated
        ? "Escalado"
        : derived
        ? "Derivado"
        : assigned
        ? "Asignado"
        : "Pendiente asignación"),

    advisorId,
    advisorName,

    area:
      item.area ||
      item.area_nombre ||
      item.cola ||
      "Mesa de entrada",

    slaHours: calculatedHours,

    slaText:
      item.slaText ||
      item.sla ||
      item.sla_text ||
      (calculatedHours < 0
        ? "Vencido"
        : calculatedHours === 999
        ? "Sin plazo"
        : `${calculatedHours}h restantes`),

    slaRisk:
      item.slaRisk ||
      item.riesgo_sla ||
      (calculatedHours < 0
        ? "Vencido"
        : calculatedHours <= 8
        ? "Riesgo alto"
        : calculatedHours <= 24
        ? "Riesgo medio"
        : "Controlado"),

    slaGroup:
      item.slaGroup ||
      item.sla_group ||
      (calculatedHours < 0
        ? "vencido"
        : calculatedHours <= 8
        ? "vence_hoy"
        : calculatedHours <= 24
        ? "vence_manana"
        : "semana"),

    riskType,

    pendingType:
      item.pendingType ||
      item.tipo_pendiente ||
      (!assigned
        ? "sin_asignar"
        : classificationStatus === "Sin clasificar"
        ? "sin_clasificar"
        : observed
        ? "observados"
        : "todos"),

    blocked,
    escalated,
    derived,
    observed,

    createdAt:
      item.createdAt ||
      item.fecha_registro ||
      item.created_at ||
      "",

    updatedAt:
      item.updatedAt ||
      item.fecha_actualizacion ||
      item.updated_at ||
      "",

    deadline:
      item.deadline ||
      item.fecha_limite_resolucion ||
      "",

    action:
      item.action ||
      item.accion ||
      item.proximo_paso ||
      "Revisar caso y registrar decisión.",

    reason:
      item.reason ||
      item.motivo ||
      item.descripcion ||
      "",

    raw: item,
  };
}

function normalizeAdvisor(item = {}) {
  const cases = asNumber(item.cases ?? item.casos ?? item.casos_asignados, 0);
  const critical = asNumber(item.critical ?? item.criticos ?? item.casos_criticos, 0);
  const slaRisk = asNumber(item.slaRisk ?? item.riesgo_sla ?? item.casos_sla_riesgo, 0);
  const capacity = asNumber(item.capacity ?? item.capacidad, Math.min(100, cases * 7));
  const productivity = asNumber(item.productivity ?? item.productividad, 0);

  const name =
    item.name ||
    item.nombre ||
    item.asesor_nombre ||
    item.username ||
    "Asesor";

  return {
    id:
      item.id ||
      item.usuario_id ||
      item.asesor_id ||
      item.personal_id ||
      name,

    name,
    initials: item.initials || item.iniciales || initials(name),

    specialty:
      item.specialty ||
      item.especialidad ||
      item.area ||
      item.area_nombre ||
      "Atención al cliente",

    status:
      item.status ||
      item.estado ||
      (capacity >= 90 ? "Sobrecargado" : "Disponible"),

    userStatus:
      item.estado_usuario ||
      item.userStatus ||
      item.estado ||
      "ACTIVO",

    cases,
    critical,
    slaRisk,
    productivity,
    capacity,

    email:
      item.email ||
      item.correo ||
      "",

    raw: item,
  };
}

function normalizeIndicator(item = {}) {
  const title =
    item.title ||
    item.titulo ||
    item.nombre ||
    "Indicador";

  return {
    id:
      item.id ||
      item.indicador_id ||
      title,

    icon:
      item.icon ||
      item.icono ||
      "📈",

    title,

    value:
      item.value ??
      item.valor ??
      0,

    target:
      item.target ??
      item.meta ??
      "-",

    trend:
      item.trend ??
      item.tendencia ??
      "-",

    status:
      item.status ||
      item.estado_tipo ||
      item.estado ||
      "info",

    progress:
      asNumber(item.progress ?? item.avance ?? item.porcentaje, 0),

    description:
      item.description ||
      item.descripcion ||
      "",

    cause:
      item.cause ||
      item.causa ||
      "",

    relatedCases:
      item.relatedCases ||
      item.casos_relacionados ||
      [],

    raw: item,
  };
}

function normalizeReport(item = {}) {
  return {
    id:
      item.id ||
      item.reporte_id ||
      item.codigo ||
      item.name ||
      item.nombre,

    name:
      item.name ||
      item.nombre ||
      "Reporte",

    type:
      item.type ||
      item.tipo ||
      "Operativo",

    period:
      item.period ||
      item.periodo ||
      "-",

    scope:
      item.scope ||
      item.alcance ||
      "-",

    format:
      item.format ||
      item.formato ||
      "PDF",

    owner:
      item.owner ||
      item.generado_por ||
      item.usuario ||
      "Supervisor",

    status:
      item.status ||
      item.estado ||
      "Disponible",

    date:
      item.date ||
      item.fecha_generacion ||
      item.fecha ||
      "",

    comment:
      item.comment ||
      item.comentario ||
      "",

    raw: item,
  };
}

function normalizeAudit(item = {}) {
  return {
    id:
      item.id ||
      item.auditoria_id ||
      item.historial_id,

    date:
      item.date ||
      item.fecha ||
      item.fecha_evento ||
      "",

    caseId:
      item.caseId ||
      item.codigo_caso ||
      item.caso ||
      item.caso_id ||
      "-",

    type:
      String(item.type || item.tipo || item.accion_tipo || item.modulo || "general").toLowerCase(),

    action:
      item.action ||
      item.accion ||
      "Evento registrado",

    user:
      item.user ||
      item.usuario ||
      item.usuario_nombre ||
      item.username ||
      "Sistema",

    before:
      item.before ||
      item.valor_anterior ||
      item.antes ||
      "-",

    after:
      item.after ||
      item.valor_nuevo ||
      item.despues ||
      "-",

    detail:
      item.detail ||
      item.detalle ||
      item.observacion ||
      item.descripcion ||
      "",

    critical:
      Boolean(item.critical ?? item.critico),

    raw: item,
  };
}

function normalizeConfigRule(item = {}) {
  return {
    id:
      item.id ||
      item.configuracion_id ||
      item.regla_id ||
      item.clave,

    icon:
      item.icon ||
      item.icono ||
      "⚙️",

    category:
      String(item.category || item.categoria || item.tipo || "general").toLowerCase(),

    title:
      item.title ||
      item.titulo ||
      item.nombre ||
      item.clave ||
      "Regla",

    value:
      item.value ||
      item.valor ||
      "-",

    description:
      item.description ||
      item.descripcion ||
      "",

    status:
      item.status ||
      item.estado ||
      (item.activo === false ? "Inactivo" : "Activo"),

    raw: item,
  };
}

function normalizeRouteRule(item = {}) {
  return {
    id:
      item.id ||
      item.ruta_id ||
      item.regla_id ||
      item.route,

    route:
      item.route ||
      item.ruta ||
      item.nombre ||
      "Ruta",

    condition:
      item.condition ||
      item.condicion ||
      "-",

    area:
      item.area ||
      item.area_destino ||
      "-",

    internalSla:
      item.internalSla ||
      item.sla_interno ||
      item.internal_sla ||
      "-",

    escalation:
      item.escalation ||
      item.escalamiento ||
      "-",

    status:
      item.status ||
      item.estado ||
      "Activo",

    raw: item,
  };
}

/* =========================================================
   GETTERS / SELECCIÓN
========================================================= */

function getCase(id) {
  return (
    State.cases
      .map(normalizeCase)
      .find((item) => String(item.id) === String(id) || String(item.code) === String(id)) ||
    null
  );
}

function getAdvisor(id) {
  return (
    State.advisors
      .map(normalizeAdvisor)
      .find((item) => String(item.id) === String(id)) ||
    null
  );
}

function getIndicator(id) {
  return (
    State.indicators
      .map(normalizeIndicator)
      .find((item) => String(item.id) === String(id)) ||
    null
  );
}

function getAudit(id) {
  return (
    State.audit
      .map(normalizeAudit)
      .find((item) => String(item.id) === String(id)) ||
    null
  );
}

function getConfigRule(id) {
  return (
    State.configRules
      .map(normalizeConfigRule)
      .find((item) => String(item.id) === String(id)) ||
    null
  );
}

function getRouteRule(id) {
  return (
    State.routeRules
      .map(normalizeRouteRule)
      .find((item) => String(item.id) === String(id)) ||
    null
  );
}

function saveSelectedCase(id) {
  State.selectedCaseId = id;
  localStorage.setItem("claro360-supervisor-selected-case", id);
}

function saveSelectedAdvisor(id) {
  State.selectedAdvisorId = id;
}

function saveSelectedIndicator(id) {
  State.selectedIndicatorId = id;
}

function saveSelectedAudit(id) {
  State.selectedAuditId = id;
}

function saveSelectedConfigRule(id) {
  State.selectedConfigRuleId = id;
}

function saveSelectedRouteRule(id) {
  State.selectedRouteRuleId = id;
}

function slaRisk(item) {
  const c = normalizeCase(item);

  return (
    c.slaHours < 0 ||
    c.slaHours <= 8 ||
    c.riskType === "vencidos" ||
    c.riskType === "riesgo_alto" ||
    priorityValue(c.priority) === 4
  );
}

function getPendingCases() {
  return State.cases
    .map(normalizeCase)
    .filter((item) => {
      return (
        item.classificationStatus === "Sin clasificar" ||
        item.assignmentStatus === "Sin asesor" ||
        item.observed ||
        priorityValue(item.priority) === 4 ||
        item.slaHours <= 8
      );
    });
}

function getAssignmentCases() {
  return State.cases
    .map(normalizeCase)
    .filter((item) => {
      return (
        item.assignmentStatus === "Sin asesor" ||
        item.derived ||
        item.escalated ||
        item.observed ||
        priorityValue(item.priority) === 4
      );
    });
}

function getRiskCases() {
  return State.cases
    .map(normalizeCase)
    .filter(slaRisk);
}

/* =========================================================
   HTML PEQUEÑO / RESÚMENES
========================================================= */

function summaryHTML(items) {
  return items
    .map(
      ([label, value]) => `
        <div>
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
        </div>
      `
    )
    .join("");
}

function caseSummary(item) {
  const c = normalizeCase(item);

  return summaryHTML([
    ["Código", c.code],
    ["Cliente", c.clientName],
    ["Tipo", c.type],
    ["Categoría", c.category],
    ["Servicio", c.service],
    ["Prioridad", c.priority],
    ["Estado", c.status],
    ["Responsable", c.advisorName],
    ["SLA", c.slaText],
    ["Acción sugerida", c.action],
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
    ["Capacidad", `${advisor.capacity}%`],
  ]);
}

function renderKpis(selector, data = []) {
  const rows = Array.isArray(data) ? data : [];

  setHTML(
    selector,
    rows
      .map((item) => {
        const icon = item.icon ?? item[0] ?? "•";
        const value = item.value ?? item.valor ?? item[1] ?? 0;
        const title = item.title ?? item.label ?? item.titulo ?? item[2] ?? "Indicador";
        const text = item.text ?? item.description ?? item.descripcion ?? item[3] ?? "";

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
      })
      .join("")
  );
}

function renderAi(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(
    selector,
    list.length
      ? list
          .map((item) => {
            const title = item.title ?? item.titulo ?? item[0] ?? "Resumen";
            const text = item.text ?? item.descripcion ?? item.description ?? item[1] ?? "";

            return `
              <div class="ai-summary-item">
                <strong>${esc(title)}</strong>
                <p>${esc(text)}</p>
              </div>
            `;
          })
          .join("")
      : `
        <div class="ai-summary-item">
          <strong>Sin análisis disponible</strong>
          <p>El análisis se mostrará cuando existan datos cargados desde el sistema.</p>
        </div>
      `
  );
}

function renderChecklist(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(
    selector,
    list
      .map((item) => {
        const icon = item.icon ?? item[0] ?? "•";
        const title = item.title ?? item[1] ?? "Acción";
        const text = item.text ?? item.description ?? item[2] ?? "";

        return `
          <article class="check-item">
            <span class="check-icon">${esc(icon)}</span>
            <div>
              <strong>${esc(title)}</strong>
              <p>${esc(text)}</p>
            </div>
          </article>
        `;
      })
      .join("")
  );
}

function renderActivity(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(
    selector,
    list
      .map(
        (item) => `
          <article class="activity-item">
            <span class="activity-icon">${esc(item.icon || "🕘")}</span>
            <div class="activity-content">
              <strong>${esc(item.title || item.action || item.accion || "Movimiento")}</strong>
              <p>${esc(item.text || item.detail || item.detalle || item.observacion || item.descripcion || "")}</p>
              <small>${esc(formatDateTime(item.date || item.fecha || item.fecha_evento))}</small>
            </div>
          </article>
        `
      )
      .join("")
  );
}

/* =========================================================
   RENDER CASOS
========================================================= */

function renderCaseCard(item, mode = "supervisor") {
  const c = normalizeCase(item);
  const buttons = [];

  buttons.push(
    `<button type="button" data-action="${mode}-view-case" data-case-id="${esc(c.id)}">Ver</button>`
  );

  if (mode === "pending") {
    buttons.push(
      `<button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>`
    );
    buttons.push(
      `<button type="button" data-action="send-assignment" data-case-id="${esc(c.id)}">Enviar a asignación</button>`
    );
    buttons.push(
      `<button type="button" data-action="observe-case" data-case-id="${esc(c.id)}">Observar</button>`
    );
    buttons.push(
      `<button type="button" data-action="change-priority" data-case-id="${esc(c.id)}">Prioridad</button>`
    );
  }

  if (mode === "assignment") {
    buttons.push(
      `<button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>`
    );
    buttons.push(
      `<button type="button" data-action="reassign-case" data-case-id="${esc(c.id)}">Reasignar</button>`
    );
    buttons.push(
      `<button type="button" data-action="derive-case" data-case-id="${esc(c.id)}">Derivar</button>`
    );
    buttons.push(
      `<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`
    );
  }

  if (mode === "sla") {
    buttons.push(
      `<button type="button" data-action="sla-alert" data-case-id="${esc(c.id)}">Alertar</button>`
    );
    buttons.push(
      `<button type="button" data-action="sla-follow" data-case-id="${esc(c.id)}">Seguimiento</button>`
    );
    buttons.push(
      `<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`
    );
  }

  if (mode === "supervisor") {
    buttons.push(
      `<button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>`
    );
  }

  return `
    <article class="case-card">
      <span class="case-card__icon">${esc(c.icon)}</span>

      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description || c.action)}</p>

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

function renderCaseTableRow(item, mode = "pending") {
  const c = normalizeCase(item);

  if (mode === "pending") {
    return `
      <tr>
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
          <button type="button" data-action="send-assignment" data-case-id="${esc(c.id)}">Asignar</button>
          <button type="button" data-action="change-priority" data-case-id="${esc(c.id)}">Prioridad</button>
        </td>
      </tr>
    `;
  }

  if (mode === "assignment") {
    return `
      <tr>
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
          <button type="button" data-action="reassign-case" data-case-id="${esc(c.id)}">Reasignar</button>
        </td>
      </tr>
    `;
  }

  if (mode === "sla") {
    return `
      <tr>
        <td>${esc(c.code)}</td>
        <td>${esc(c.clientName)}</td>
        <td>${esc(c.advisorName)}</td>
        <td><span class="${pillClass(caseStatusType(c.status))}">${esc(c.status)}</span></td>
        <td><span class="${pillClass(priorityType(c.priority))}">${esc(c.priority)}</span></td>
        <td>${esc(c.slaText)}</td>
        <td>${esc(c.slaRisk)}</td>
        <td>
          <button type="button" data-action="sla-view-case" data-case-id="${esc(c.id)}">Ver</button>
          <button type="button" data-action="sla-alert" data-case-id="${esc(c.id)}">Alertar</button>
          <button type="button" data-action="sla-follow" data-case-id="${esc(c.id)}">Seguimiento</button>
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

      if (State.page === "supervisor-casos-pendientes") {
        openPendingCaseModal(id);
      } else if (State.page === "supervisor-asignaciones") {
        openAssignmentCaseModal(id);
      } else if (State.page === "supervisor-monitoreo-sla") {
        openSlaCaseModal(id);
      } else {
        openQuickCaseModal(id);
      }
    });
  });

  $$('[data-action="classify-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openClassifyCaseModal(button.dataset.caseId));
  });

  $$('[data-action="send-assignment"]', root).forEach((button) => {
    button.addEventListener("click", () => openSendToAssignmentModal(button.dataset.caseId));
  });

  $$('[data-action="observe-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openObserveCaseModal(button.dataset.caseId));
  });

  $$('[data-action="change-priority"]', root).forEach((button) => {
    button.addEventListener("click", () => openChangePriorityModal(button.dataset.caseId));
  });

  $$('[data-action="assign-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openAssignAdvisorModal(button.dataset.caseId));
  });

  $$('[data-action="reassign-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openReassignCaseModal(button.dataset.caseId));
  });

  $$('[data-action="derive-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openDeriveAreaModal(button.dataset.caseId));
  });

  $$('[data-action="escalate-case"]', root).forEach((button) => {
    button.addEventListener("click", () => openEscalateCaseModal(button.dataset.caseId));
  });

  $$('[data-action="sla-alert"]', root).forEach((button) => {
    button.addEventListener("click", () => openSendSlaAlertModal(button.dataset.caseId));
  });

  $$('[data-action="sla-follow"]', root).forEach((button) => {
    button.addEventListener("click", () => openSlaFollowModal(button.dataset.caseId));
  });
}

/* =========================================================
   RENDER ASESORES
========================================================= */

function advisorLoadCard(item, detailed = true) {
  const advisor = normalizeAdvisor(item);
  const statusType = advisorStatusType(advisor.status);

  return `
    <article class="advisor-load-card">
      <div class="advisor-load-card__top">
        <span class="advisor-load-avatar">${esc(advisor.initials)}</span>

        <div>
          <h3>${esc(advisor.name)}</h3>
          <p>${esc(advisor.specialty)} · ${esc(advisor.email || "Sin correo registrado")}</p>
        </div>

        <span class="${pillClass(statusType)}">${esc(advisor.status)}</span>
      </div>

      <div class="advisor-load-metrics">
        <div>
          <span>Casos</span>
          <strong>${esc(advisor.cases)}</strong>
        </div>
        <div>
          <span>Críticos</span>
          <strong>${esc(advisor.critical)}</strong>
        </div>
        <div>
          <span>SLA riesgo</span>
          <strong>${esc(advisor.slaRisk)}</strong>
        </div>
        <div>
          <span>Productividad</span>
          <strong>${esc(advisor.productivity)}%</strong>
        </div>
      </div>

      <div class="advisor-load-progress" title="Capacidad utilizada">
        <span style="width:${Math.max(4, Math.min(100, advisor.capacity))}%"></span>
      </div>

      ${
        detailed
          ? `
            <div class="case-actions">
              <button type="button" data-advisor-id="${esc(advisor.id)}" data-action="view-advisor">Ver</button>
              <button type="button" data-advisor-id="${esc(advisor.id)}" data-action="toggle-advisor">Disponibilidad</button>
              <button type="button" data-advisor-id="${esc(advisor.id)}" data-action="redistribute-advisor">Redistribuir</button>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function bindAdvisorButtons(root = document) {
  $$('[data-action="view-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => openAdvisorDetailModal(button.dataset.advisorId));
  });

  $$('[data-action="toggle-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => openAdvisorAvailabilityModal(button.dataset.advisorId));
  });

  $$('[data-action="redistribute-advisor"]', root).forEach((button) => {
    button.addEventListener("click", () => {
      saveSelectedAdvisor(button.dataset.advisorId);
      openRedistributeLoadModal();
    });
  });
}

function populateAdvisorSelects() {
  const advisors = State.advisors.map(normalizeAdvisor);

  const selects = [
    "#assignAdvisorSelect",
    "#reassignToAdvisor",
    "#reassignAdvisorSelect",
    "#redistributeFromAdvisor",
    "#redistributeToAdvisor",
    "#massAssignmentAdvisorSelect",
    "#indicatorAdvisorFilter",
  ];

  selects.forEach((selector) => {
    const select = $(selector);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = selector === "#indicatorAdvisorFilter";

    select.innerHTML = `
      <option value="${isFilter ? "todos" : ""}">${isFilter ? "Todos" : "Seleccionar"}</option>
      ${advisors
        .map(
          (advisor) => `
            <option value="${esc(advisor.id)}">
              ${esc(advisor.name)} · ${esc(advisor.status)} · ${esc(advisor.cases)} casos
            </option>
          `
        )
        .join("")}
    `;

    if (currentValue) select.value = currentValue;
  });
}

/* =========================================================
   INDICADORES / REPORTES / AUDITORÍA / CONFIG
========================================================= */

function indicatorCard(item) {
  const indicator = normalizeIndicator(item);

  return `
    <article class="indicator-card">
      <div class="indicator-card__top">
        <span class="indicator-card__icon">${esc(indicator.icon)}</span>
        <span class="${pillClass(indicatorStatusType(indicator.status))}">${esc(indicator.trend)}</span>
      </div>

      <div>
        <h3>${esc(indicator.title)}</h3>
        <strong>${esc(indicator.value)}</strong>
      </div>

      <p>${esc(indicator.description)}</p>

      <div class="indicator-card__bar">
        <span style="width:${Math.max(4, Math.min(100, indicator.progress))}%"></span>
      </div>

      <div class="indicator-card__footer">
        <small>Meta: ${esc(indicator.target)}</small>
        <button type="button" data-action="view-indicator" data-indicator-id="${esc(indicator.id)}">Detalle</button>
      </div>
    </article>
  `;
}

function bindIndicatorButtons(root = document) {
  $$('[data-action="view-indicator"]', root).forEach((button) => {
    button.addEventListener("click", () => openIndicatorDetailModal(button.dataset.indicatorId));
  });
}

function reportTemplateCard(item) {
  return `
    <article class="template-card">
      <div class="template-card__header">
        <span>${esc(item.icon || "📊")}</span>
        <div>
          <strong>${esc(item.title || item.name || item.nombre || "Reporte")}</strong>
          <small>${esc(item.type || item.tipo || "Plantilla")}</small>
        </div>
      </div>
      <p>${esc(item.description || item.descripcion || "Plantilla de reporte operativo.")}</p>
      <button type="button" data-action="apply-report-template" data-template-id="${esc(item.id || item.title)}">
        Usar plantilla
      </button>
    </article>
  `;
}

function auditRow(item) {
  const audit = normalizeAudit(item);

  return `
    <tr>
      <td>${esc(formatDateTime(audit.date))}</td>
      <td>${esc(audit.caseId)}</td>
      <td><span class="${pillClass(audit.critical ? "danger" : "info")}">${esc(audit.action)}</span></td>
      <td>${esc(audit.user)}</td>
      <td>${esc(audit.before)}</td>
      <td>${esc(audit.after)}</td>
      <td>
        <button type="button" data-action="view-audit" data-audit-id="${esc(audit.id)}">Ver detalle</button>
      </td>
    </tr>
  `;
}

function configRuleCard(item) {
  const rule = normalizeConfigRule(item);

  return `
    <article class="config-rule-card">
      <div class="config-rule-card__top">
        <span class="map-score map-score--info">${esc(rule.icon)}</span>
        <span class="${pillClass(caseStatusType(rule.status))}">${esc(rule.status)}</span>
      </div>

      <div>
        <h3>${esc(rule.title)}</h3>
        <p>${esc(rule.description)}</p>
      </div>

      <strong>${esc(rule.value)}</strong>

      <button type="button" data-action="edit-config-rule" data-rule-id="${esc(rule.id)}">
        Editar regla
      </button>
    </article>
  `;
}

function routeRuleRow(item) {
  const route = normalizeRouteRule(item);

  return `
    <tr>
      <td>${esc(route.route)}</td>
      <td>${esc(route.condition)}</td>
      <td>${esc(route.area)}</td>
      <td>${esc(route.internalSla)}</td>
      <td>${esc(route.escalation)}</td>
      <td><span class="${pillClass(caseStatusType(route.status))}">${esc(route.status)}</span></td>
      <td>
        <button type="button" data-action="view-route-rule" data-route-id="${esc(route.id)}">Ver</button>
      </td>
    </tr>
  `;
}

function priorityMatrixCard(item) {
  return `
    <article class="priority-matrix-card">
      <div class="priority-matrix-card__top">
        <span class="map-score map-score--${esc(item.status || "info")}">${esc(item.score || "Media")}</span>
      </div>
      <h3>${esc(item.title || "Criterio")}</h3>
      <p>${esc(item.description || "")}</p>
    </article>
  `;
}

/* =========================================================
   DATA LOADERS
========================================================= */

async function loadShellData() {
  const response = await apiRequest("/supervisor/me");
  State.supervisor = response.supervisor || response.user || response;

  const name =
    State.supervisor.nombre ||
    State.supervisor.name ||
    State.supervisor.username ||
    State.user?.nombre ||
    "Supervisor";

  setText("#userNameTop", name);
  setText("#userRoleTop", State.supervisor.cargo || State.supervisor.role || "Supervisor de Atención");
  setText("#userAvatar", State.supervisor.initials || State.supervisor.iniciales || initials(name));

  await refreshGlobalBadges();
}

async function refreshGlobalBadges() {
  try {
    const response = await apiRequest("/supervisor/resumen");

    const pending = asNumber(response.pendientes ?? response.pending ?? response.casos_pendientes, 0);
    const sla = asNumber(response.sla_riesgo ?? response.slaRisk ?? response.sla, 0);

    setText("#sidebarPendingCount", pending);
    setText("#sidebarSlaCount", sla);
    setText("#notificationBadge", sla || "");
  } catch {
    setText("#sidebarPendingCount", "0");
    setText("#sidebarSlaCount", "0");
    setText("#notificationBadge", "");
  }
}

async function loadCases(params = {}) {
  const response = await apiRequest(`/supervisor/casos${buildQuery(params)}`);
  State.cases = response.items || response.cases || response.casos || [];
  await refreshGlobalBadges();
  return State.cases;
}

async function loadAdvisors() {
  const response = await apiRequest("/supervisor/asesores");
  State.advisors = response.items || response.advisors || response.asesores || [];
  populateAdvisorSelects();
  return State.advisors;
}

async function loadIndicators(params = {}) {
  const response = await apiRequest(`/supervisor/indicadores${buildQuery(params)}`);
  State.indicators = response.items || response.indicators || response.indicadores || [];
  return response;
}

async function loadReports() {
  const response = await apiRequest("/supervisor/reportes");
  State.reports = response.items || response.reports || response.reportes || [];
  return response;
}

async function loadAudit(params = {}) {
  const response = await apiRequest(`/supervisor/auditoria${buildQuery(params)}`);
  State.audit = response.items || response.audit || response.auditoria || [];
  return response;
}

async function loadConfig() {
  const response = await apiRequest("/supervisor/configuracion");

  State.configRules = response.rules || response.configRules || response.reglas || [];
  State.routeRules = response.routes || response.routeRules || response.rutas || [];
  State.priorityMatrix = response.priority_matrix || response.matriz_prioridad || [];

  return response;
}

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);
  $("#closeSearchBtn")?.addEventListener("click", closeSearch);
  $("#globalSearchInput")?.addEventListener("input", debounce(renderSearch, 250));
}

function openSearch() {
  $("#searchModal")?.classList.add("show");
  $("#searchModal")?.setAttribute("aria-hidden", "false");
  document.body.classList.add("search-open");

  setTimeout(() => $("#globalSearchInput")?.focus(), 60);
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
    box.innerHTML = PAGE_LINKS.map(
      ([icon, title, text, href]) => `
        <a href="${href}" class="search-result-item">
          <span>${icon}</span>
          <div>
            <strong>${esc(title)}</strong>
            <small>${esc(text)}</small>
          </div>
        </a>
      `
    ).join("");
    return;
  }

  box.innerHTML = `<p class="muted">Buscando información...</p>`;

  try {
    const response = await apiRequest(`/supervisor/search${buildQuery({ q })}`);
    const items = response.items || response.resultados || [];

    box.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <a href="${esc(item.href || "#")}" class="search-result-item">
                <span>${esc(item.icon || item.icono || "🔎")}</span>
                <div>
                  <strong>${esc(item.title || item.titulo || "Resultado")}</strong>
                  <small>${esc(item.text || item.descripcion || "")}</small>
                </div>
              </a>
            `
          )
          .join("")
      : `<p class="muted">No se encontraron resultados.</p>`;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

/* =========================================================
   BOT / ASISTENTE
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
    ["analyzeSupervisorWorkBtn", "Analiza la operación"],
    ["prioritizeCriticalCasesBtn", "Prioriza los casos críticos"],
    ["prioritizePendingBtn", "Prioriza casos pendientes"],
    ["analyzePendingCasesBtn", "Analiza casos pendientes"],
    ["smartAssignBtn", "Sugiere asignación para casos sin asesor"],
    ["analyzeAssignmentsBtn", "Analiza asignaciones"],
    ["balanceLoadAiBtn", "Recomienda balance de carga"],
    ["analyzeAdvisorLoadBtn", "Analiza carga de asesores"],
    ["loadMapAiBtn", "Interpreta mapa de carga"],
    ["prioritizeSlaMonitorBtn", "Prioriza SLA"],
    ["analyzeSlaMonitorBtn", "Analiza SLA"],
    ["priorityMapAiBtn", "Interpreta mapa de prioridades"],
    ["analyzeIndicatorsBtn", "Analiza indicadores principales"],
    ["generateIndicatorInsightBtn", "Genera análisis de indicadores"],
    ["analyzeReportsBtn", "Analiza reportes"],
    ["reportAiBtn", "Recomienda configuración del reporte"],
    ["auditAnalyzeBtn", "Analiza auditoría"],
    ["generateAuditInsightBtn", "Genera análisis de auditoría"],
    ["analyzeConfigBtn", "Revisa configuración"],
    ["configRuleAiBtn", "Sugiere valor para la regla"],
    ["priorityMatrixAiBtn", "Sugiere matriz de prioridad"],
    ["classifyCaseAiBtn", "Sugiere clasificación para el caso"],
    ["assignAdvisorAiBtn", "Sugiere asesor para el caso"],
    ["reassignAiBtn", "Sugiere reasignación"],
    ["slaAlertAiBtn", "Genera texto de alerta SLA"],
    ["redistributeLoadAiBtn", "Recomienda redistribución de carga"],
    ["validateRoutesBtn", "Valida rutas de escalamiento"],
  ];

  aiButtons.forEach(([id, prompt]) => {
    const button = $(`#${id}`);
    if (!button) return;

    button.addEventListener("click", () => askBot(prompt));
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
  if (!prompt) return;

  openBot();
  addMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando información del sistema...";
  $("#botMessages")?.appendChild(typing);

  try {
    const response = await apiRequest("/supervisor/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        prompt,
        case_id: State.selectedCaseId,
        advisor_id: State.selectedAdvisorId,
        indicator_id: State.selectedIndicatorId,
      }),
    });

    typing.remove();
    addMessage(response.answer || response.respuesta || "No se recibió respuesta del asistente.", "bot");
  } catch (error) {
    typing.remove();
    addMessage(`No se pudo consultar el asistente: ${error.message}`, "bot");
  }
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

/* =========================================================
   DASHBOARD
========================================================= */

async function initDashboard() {
  bindDashboardEvents();
  await renderDashboard();
}

function bindDashboardEvents() {
  $("#refreshCriticalCasesBtn")?.addEventListener("click", renderDashboard);
  $("#refreshAdvisorLoadBtn")?.addEventListener("click", renderDashboard);
  $("#refreshDashboardSlaBtn")?.addEventListener("click", renderDashboard);
  $("#refreshDashboardIndicatorsBtn")?.addEventListener("click", renderDashboard);
  $("#refreshSupervisorActivityBtn")?.addEventListener("click", renderDashboard);

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

  $("#indicatorDetailAiBtn")?.addEventListener("click", () => {
    askBot("Analiza el indicador seleccionado");
  });
}

async function renderDashboard() {
  try {
    const response = await apiRequest("/supervisor/dashboard");

    State.cases = response.cases || response.casos || response.critical_cases || [];
    State.advisors = response.advisors || response.asesores || [];
    State.indicators = response.indicators || response.indicadores || [];
    State.audit = response.activity || response.actividad || [];

    const supervisor = response.supervisor || State.supervisor || {};
    const name =
      supervisor.nombre ||
      supervisor.name ||
      State.supervisor?.nombre ||
      State.user?.nombre ||
      "Supervisor";

    setText("#dashboardHeroEyebrow", response.hero_eyebrow || "Supervisión operativa");
    setText("#dashboardHeroTitle", `Hola, ${name}`);
    setText(
      "#dashboardHeroText",
      response.hero_text ||
        "Controla pendientes, asignaciones, carga del equipo, SLA, indicadores y trazabilidad desde una vista ejecutiva."
    );

    setText("#supervisorStatus", supervisor.status || supervisor.estado || "Supervisión activa");
    setText(
      "#supervisorLastUpdate",
      response.last_update
        ? `Última actualización: ${formatDateTime(response.last_update)}`
        : `Actualizado: ${formatDateTime(new Date())}`
    );

    renderKpis("#supervisorKpiGrid", response.kpis || []);
    renderCriticalCases(response.critical_cases || response.casos_criticos || State.cases);
    renderAdvisorLoadSummary(response.advisors || response.asesores || State.advisors);
    renderDashboardSla(response.sla_alerts || response.alertas_sla || State.cases.filter(slaRisk));
    renderDashboardIndicators(response.indicators || response.indicadores || State.indicators);
    renderSupervisorActivity(response.activity || response.actividad || []);
    renderAi("#supervisorAiSummary", response.ai_summary || response.resumen_ia || []);

    await refreshGlobalBadges();
  } catch (error) {
    renderAi("#supervisorAiSummary", [
      {
        title: "No se pudo cargar dashboard",
        text: error.message,
      },
    ]);
  }
}

function renderCriticalCases(rows = []) {
  const cases = rows
    .map(normalizeCase)
    .filter((c) => slaRisk(c) || c.observed || priorityValue(c.priority) === 4 || !c.advisorId)
    .sort((a, b) => a.slaHours - b.slaHours);

  setHTML("#criticalCasesList", cases.map((c) => renderCaseCard(c, "supervisor")).join(""));
  show($("#emptyCriticalCasesState"), !cases.length);
  bindCaseActions($("#criticalCasesList"));
}

function renderAdvisorLoadSummary(rows = []) {
  const advisors = rows.map(normalizeAdvisor).sort((a, b) => b.capacity - a.capacity);

  setHTML("#advisorLoadSummary", advisors.map((a) => advisorLoadCard(a, false)).join(""));
  show($("#emptyAdvisorLoadState"), !advisors.length);
  bindAdvisorButtons($("#advisorLoadSummary"));
}

function renderDashboardSla(rows = []) {
  const cases = rows.map(normalizeCase).filter(slaRisk).sort((a, b) => a.slaHours - b.slaHours);

  setHTML(
    "#dashboardSlaList",
    cases
      .map(
        (c) => `
          <article class="sla-item">
            <span class="activity-icon">⏱️</span>
            <div>
              <strong>${esc(c.code)} · ${esc(c.priority)}</strong>
              <p>${esc(c.title)} · ${esc(c.slaText)} · ${esc(c.advisorName)}</p>
              <div class="sla-meter">
                <span style="width:${Math.max(12, Math.min(100, 100 - Math.max(c.slaHours, 0) * 8))}%"></span>
              </div>
            </div>
            <button type="button" data-action="sla-view-case" data-case-id="${esc(c.id)}">Ver</button>
          </article>
        `
      )
      .join("")
  );

  show($("#emptyDashboardSlaState"), !cases.length);
  bindCaseActions($("#dashboardSlaList"));
}

function renderDashboardIndicators(rows = []) {
  const indicators = rows.map(normalizeIndicator).slice(0, 4);

  setHTML("#dashboardIndicatorGrid", indicators.map(indicatorCard).join(""));
  bindIndicatorButtons($("#dashboardIndicatorGrid"));
}

function renderSupervisorActivity(rows = []) {
  const activity = rows.map((item) => ({
    icon: item.icon || "🕘",
    title: item.title || item.action || item.accion || "Movimiento",
    text: item.text || item.detail || item.detalle || item.observacion || "",
    date: item.date || item.fecha || item.fecha_evento,
  }));

  renderActivity("#supervisorActivityTimeline", activity);
  show($("#emptySupervisorActivityState"), !activity.length);
}

/* =========================================================
   CASOS PENDIENTES
========================================================= */

async function initPendingCases() {
  bindPendingEvents();
  await renderPendingCases();
}

function bindPendingEvents() {
  $("#pendingCaseSearch")?.addEventListener("input", debounce(renderPendingCases, 250));

  $$("[data-pending-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.pendingFilter = button.dataset.pendingFilter || "todos";
      $$("[data-pending-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderPendingCases();
    });
  });

  $("#togglePendingViewBtn")?.addEventListener("click", () => {
    State.pendingView = State.pendingView === "cards" ? "table" : "cards";
    setText("#togglePendingViewBtn", State.pendingView === "cards" ? "Vista tabla" : "Vista cards");
    renderPendingCases();
  });

  $("#refreshPendingCasesBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderPendingCases();
    toast("Pendientes actualizados", "Se actualizó la bandeja de casos pendientes.", "success");
  });

  $("#exportPendingCasesBtn")?.addEventListener("click", () => {
    exportCurrentTable("casos-pendientes");
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

  $("#pendingCasePriorityBtn")?.addEventListener("click", () => {
    closeModals();
    openChangePriorityModal(State.selectedCaseId);
  });

  $("#confirmClassifyCaseBtn")?.addEventListener("click", confirmClassifyCase);
  $("#confirmChangePriorityBtn")?.addEventListener("click", confirmChangePriority);
  $("#confirmObserveCaseBtn")?.addEventListener("click", confirmObserveCase);
  $("#confirmSendToAssignmentBtn")?.addEventListener("click", confirmSendToAssignment);

  $("#classifyCaseAiBtn")?.addEventListener("click", suggestClassification);
}

async function renderPendingCases() {
  try {
    if (!State.cases.length) {
      await loadCases({ scope: "pending" });
    }

    const rows = pendingFilteredCases();

    setText("#pendingSummaryTitle", `${rows.length} pendientes visibles`);
    setText("#pendingSummaryText", `Filtro actual: ${State.pendingFilter}.`);

    renderKpis("#pendingKpiGrid", [
      {
        icon: "📋",
        value: rows.length,
        label: "Pendientes visibles",
        description: "Resultado del filtro actual.",
      },
      {
        icon: "🧭",
        value: rows.filter((c) => c.classificationStatus === "Sin clasificar").length,
        label: "Sin clasificar",
        description: "Requieren tipificación.",
      },
      {
        icon: "👥",
        value: rows.filter((c) => c.assignmentStatus === "Sin asesor").length,
        label: "Sin asesor",
        description: "Requieren responsable.",
      },
      {
        icon: "🔥",
        value: rows.filter((c) => priorityValue(c.priority) === 4).length,
        label: "Críticos",
        description: "Atención inmediata.",
      },
    ]);

    setHTML("#pendingCasesList", rows.map((c) => renderCaseCard(c, "pending")).join(""));
    setHTML("#pendingCasesTableBody", rows.map((c) => renderCaseTableRow(c, "pending")).join(""));

    show($("#pendingCasesList"), State.pendingView === "cards");
    show($("#pendingCasesTableWrap"), State.pendingView === "table");
    show($("#emptyPendingCasesState"), !rows.length);

    renderAi("#pendingAiSummary", buildPendingAi(rows));
    renderChecklist("#pendingActionPlan", buildPendingPlan(rows));

    bindCaseActions($("#pendingCasesList"));
    bindCaseActions($("#pendingCasesTableBody"));
  } catch (error) {
    toast("Error al cargar pendientes", error.message, "danger");
  }
}

function pendingFilteredCases() {
  const search = lower(getValue("#pendingCaseSearch"));

  return getPendingCases()
    .filter((c) => {
      if (State.pendingFilter === "sin_clasificar") return c.classificationStatus === "Sin clasificar";
      if (State.pendingFilter === "sin_asignar") return c.assignmentStatus === "Sin asesor";
      if (State.pendingFilter === "observados") return c.observed;
      if (State.pendingFilter === "criticos") return priorityValue(c.priority) === 4;
      if (State.pendingFilter === "sla_riesgo") return c.slaHours <= 8;
      return true;
    })
    .filter((c) => {
      if (!search) return true;

      return [
        c.code,
        c.clientName,
        c.type,
        c.channel,
        c.priority,
        c.status,
        c.title,
        c.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => a.slaHours - b.slaHours);
}

function buildPendingAi(rows) {
  const unassigned = rows.filter((c) => c.assignmentStatus === "Sin asesor").length;
  const critical = rows.filter((c) => priorityValue(c.priority) === 4).length;
  const sla = rows.filter((c) => c.slaHours <= 8).length;

  return [
    {
      title: "Prioridad de revisión",
      text:
        sla > 0
          ? `${sla} casos están en riesgo SLA y deben revisarse primero.`
          : "No hay vencimientos inmediatos dentro del filtro actual.",
    },
    {
      title: "Asignación pendiente",
      text:
        unassigned > 0
          ? `${unassigned} casos no tienen asesor asignado.`
          : "Todos los casos visibles ya tienen responsable operativo.",
    },
    {
      title: "Criticidad",
      text:
        critical > 0
          ? `${critical} casos tienen prioridad crítica.`
          : "No hay casos críticos en la vista actual.",
    },
  ];
}

function buildPendingPlan(rows) {
  return [
    {
      icon: "1",
      title: "Atender SLA",
      text: "Revisar primero casos vencidos o con menos de 8 horas.",
    },
    {
      icon: "2",
      title: "Clasificar",
      text: "Completar tipo, categoría y prioridad en casos nuevos.",
    },
    {
      icon: "3",
      title: "Enviar a asignación",
      text: "Mover los casos listos hacia la cola de asignación.",
    },
    {
      icon: "4",
      title: "Observar solo si aplica",
      text: "Usar observación cuando falte información o exista bloqueo.",
    },
  ];
}

/* =========================================================
   ASIGNACIONES
========================================================= */

async function initAssignments() {
  bindAssignmentEvents();
  await renderAssignments();
}

function bindAssignmentEvents() {
  $("#assignmentsSearch")?.addEventListener("input", debounce(renderAssignments, 250));

  $$("[data-assignment-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.assignmentFilter = button.dataset.assignmentFilter || "todos";
      $$("[data-assignment-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderAssignments();
    });
  });

  $("#toggleAssignmentsViewBtn")?.addEventListener("click", () => {
    State.assignmentView = State.assignmentView === "cards" ? "table" : "cards";
    setText("#toggleAssignmentsViewBtn", State.assignmentView === "cards" ? "Vista tabla" : "Vista cards");
    renderAssignments();
  });

  $("#refreshAssignmentsBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderAssignments();
    toast("Asignaciones actualizadas", "Se actualizó la bandeja de asignación.", "success");
  });

  $("#exportAssignmentsBtn")?.addEventListener("click", () => exportCurrentTable("asignaciones"));

  $("#openMassAssignmentBtn")?.addEventListener("click", openMassAssignmentModal);
  $("#smartAssignBtn")?.addEventListener("click", () => askBot("Sugiere asignación para casos sin asesor"));

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
  $("#confirmReassignCaseBtn")?.addEventListener("click", confirmReassignCase);
  $("#confirmDeriveAreaBtn")?.addEventListener("click", confirmDeriveArea);
  $("#confirmEscalateCaseBtn")?.addEventListener("click", confirmEscalateCase);
  $("#confirmMassAssignmentBtn")?.addEventListener("click", confirmMassAssignment);

  $("#assignAdvisorAiBtn")?.addEventListener("click", suggestAdvisorAssignment);
  $("#reassignAiBtn")?.addEventListener("click", suggestReassignment);
}

async function renderAssignments() {
  try {
    await Promise.all([
      State.cases.length ? Promise.resolve(State.cases) : loadCases({ scope: "assignments" }),
      State.advisors.length ? Promise.resolve(State.advisors) : loadAdvisors(),
    ]);

    const rows = assignmentFilteredCases();

    setText("#assignmentsSummaryTitle", `${rows.length} casos en gestión`);
    setText("#assignmentsSummaryText", `Filtro actual: ${State.assignmentFilter}.`);

    renderKpis("#assignmentsKpiGrid", [
      {
        icon: "👥",
        value: rows.length,
        label: "Casos visibles",
        description: "Bandeja de asignación.",
      },
      {
        icon: "🧍",
        value: rows.filter((c) => c.assignmentStatus === "Sin asesor").length,
        label: "Sin asesor",
        description: "Requieren responsable.",
      },
      {
        icon: "🧭",
        value: rows.filter((c) => c.derived).length,
        label: "Derivados",
        description: "En ruta interna.",
      },
      {
        icon: "🚨",
        value: rows.filter((c) => c.escalated || priorityValue(c.priority) === 4).length,
        label: "Escalados/críticos",
        description: "Requieren control.",
      },
    ]);

    setHTML("#assignmentsCaseList", rows.map((c) => renderCaseCard(c, "assignment")).join(""));
    setHTML("#assignmentsTableBody", rows.map((c) => renderCaseTableRow(c, "assignment")).join(""));

    show($("#assignmentsCaseList"), State.assignmentView === "cards");
    show($("#assignmentsTableWrap"), State.assignmentView === "table");
    show($("#emptyAssignmentsState"), !rows.length);

    renderAi("#assignmentsAiSummary", buildAssignmentsAi(rows));
    renderChecklist("#assignmentsActionPlan", buildAssignmentsPlan(rows));

    bindCaseActions($("#assignmentsCaseList"));
    bindCaseActions($("#assignmentsTableBody"));
  } catch (error) {
    toast("Error al cargar asignaciones", error.message, "danger");
  }
}

function assignmentFilteredCases() {
  const search = lower(getValue("#assignmentsSearch"));

  return getAssignmentCases()
    .filter((c) => {
      if (State.assignmentFilter === "sin_asesor") return c.assignmentStatus === "Sin asesor";
      if (State.assignmentFilter === "reasignar") return c.advisorId && (c.slaHours <= 8 || c.observed);
      if (State.assignmentFilter === "derivados") return c.derived;
      if (State.assignmentFilter === "escalados") return c.escalated;
      if (State.assignmentFilter === "criticos") return priorityValue(c.priority) === 4;
      return true;
    })
    .filter((c) => {
      if (!search) return true;

      return [
        c.code,
        c.clientName,
        c.type,
        c.advisorName,
        c.area,
        c.priority,
        c.status,
        c.assignmentFlow,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => {
      if (!a.advisorId && b.advisorId) return -1;
      if (a.advisorId && !b.advisorId) return 1;
      return a.slaHours - b.slaHours;
    });
}

function buildAssignmentsAi(rows) {
  const unassigned = rows.filter((c) => c.assignmentStatus === "Sin asesor").length;
  const critical = rows.filter((c) => priorityValue(c.priority) === 4).length;
  const overloaded = State.advisors.map(normalizeAdvisor).filter((a) => a.capacity >= 90).length;

  return [
    {
      title: "Asignación inteligente",
      text:
        unassigned > 0
          ? `${unassigned} casos deberían asignarse por menor carga y especialidad.`
          : "No hay casos sin asesor en la vista actual.",
    },
    {
      title: "Carga del equipo",
      text:
        overloaded > 0
          ? `${overloaded} asesores están sobrecargados. Evita asignarles nuevos casos.`
          : "La carga actual permite asignaciones balanceadas.",
    },
    {
      title: "Control de criticidad",
      text:
        critical > 0
          ? `${critical} casos críticos requieren validación de responsable.`
          : "Sin casos críticos visibles.",
    },
  ];
}

function buildAssignmentsPlan(rows) {
  return [
    {
      icon: "1",
      title: "Asignar sin responsable",
      text: "Tomar primero casos sin asesor y con SLA menor.",
    },
    {
      icon: "2",
      title: "Reasignar carga riesgosa",
      text: "Mover casos desde asesores sobrecargados hacia disponibles.",
    },
    {
      icon: "3",
      title: "Derivar correctamente",
      text: "Enviar casos técnicos o administrativos al área responsable.",
    },
    {
      icon: "4",
      title: "Escalar críticos",
      text: "Escalar casos vencidos o de impacto alto.",
    },
  ];
}

/* =========================================================
   CARGA DE ASESORES
========================================================= */

async function initAdvisorLoad() {
  bindAdvisorLoadEvents();
  await renderAdvisorLoad();
}

function bindAdvisorLoadEvents() {
  $("#advisorLoadSearch")?.addEventListener("input", debounce(renderAdvisorLoad, 250));

  $$("[data-load-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.advisorLoadFilter = button.dataset.loadFilter || "todos";
      $$("[data-load-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderAdvisorLoad();
    });
  });

  $("#toggleAdvisorLoadViewBtn")?.addEventListener("click", () => {
    State.advisorLoadView = State.advisorLoadView === "cards" ? "table" : "cards";
    setText("#toggleAdvisorLoadViewBtn", State.advisorLoadView === "cards" ? "Vista tabla" : "Vista cards");
    renderAdvisorLoad();
  });

  $("#refreshAdvisorLoadPageBtn")?.addEventListener("click", async () => {
    State.advisors = [];
    await renderAdvisorLoad();
    toast("Carga actualizada", "Se actualizó la carga de asesores.", "success");
  });

  $("#refreshLoadMapBtn")?.addEventListener("click", renderAdvisorLoad);
  $("#exportAdvisorLoadBtn")?.addEventListener("click", () => exportCurrentTable("carga-asesores"));
  $("#openRedistributeLoadBtn")?.addEventListener("click", openRedistributeLoadModal);
  $("#confirmRedistributeLoadBtn")?.addEventListener("click", confirmRedistributeLoad);
  $("#confirmAdvisorAvailabilityBtn")?.addEventListener("click", confirmAdvisorAvailability);

  $("#advisorDetailReassignBtn")?.addEventListener("click", () => {
    closeModals();
    openRedistributeLoadModal();
  });

  $("#advisorDetailAvailabilityBtn")?.addEventListener("click", () => {
    closeModals();
    openAdvisorAvailabilityModal(State.selectedAdvisorId);
  });

  $("#advisorDetailAuditBtn")?.addEventListener("click", () => {
    window.location.href = `auditoria-casos.html?advisor=${encodeURIComponent(State.selectedAdvisorId || "")}`;
  });
}

async function renderAdvisorLoad() {
  try {
    if (!State.advisors.length) {
      await loadAdvisors();
    }

    const rows = filteredAdvisors();

    setText("#advisorLoadSummaryTitle", `${rows.length} asesores visibles`);
    setText("#advisorLoadSummaryText", `Filtro actual: ${State.advisorLoadFilter}.`);

    renderKpis("#advisorLoadKpiGrid", [
      {
        icon: "👥",
        value: rows.length,
        label: "Asesores visibles",
        description: "Equipo operativo.",
      },
      {
        icon: "✅",
        value: rows.filter((a) => lower(a.status).includes("disponible")).length,
        label: "Disponibles",
        description: "Con capacidad operativa.",
      },
      {
        icon: "⚠️",
        value: rows.filter((a) => a.capacity >= 90).length,
        label: "Sobrecargados",
        description: "Capacidad superior al 90%.",
      },
      {
        icon: "⏱️",
        value: rows.reduce((sum, a) => sum + a.slaRisk, 0),
        label: "Riesgo SLA",
        description: "Casos en riesgo por asesor.",
      },
    ]);

    setHTML("#advisorLoadList", rows.map((a) => advisorLoadCard(a, true)).join(""));
    setHTML("#advisorLoadTableBody", rows.map(advisorTableRow).join(""));

    show($("#advisorLoadList"), State.advisorLoadView === "cards");
    show($("#advisorLoadTableWrap"), State.advisorLoadView === "table");
    show($("#emptyAdvisorLoadPageState"), !rows.length);

    renderLoadMap(rows);
    renderAi("#advisorLoadAiSummary", buildAdvisorLoadAi(rows));
    renderChecklist("#advisorLoadActionPlan", buildAdvisorLoadPlan(rows));

    bindAdvisorButtons($("#advisorLoadList"));
    bindAdvisorButtons($("#advisorLoadTableBody"));
  } catch (error) {
    toast("Error al cargar asesores", error.message, "danger");
  }
}

function filteredAdvisors() {
  const search = lower(getValue("#advisorLoadSearch"));

  return State.advisors
    .map(normalizeAdvisor)
    .filter((a) => {
      if (State.advisorLoadFilter === "disponibles") return lower(a.status).includes("disponible");
      if (State.advisorLoadFilter === "sobrecargados") return a.capacity >= 90;
      if (State.advisorLoadFilter === "criticos") return a.critical > 0;
      if (State.advisorLoadFilter === "sla_riesgo") return a.slaRisk > 0;
      if (State.advisorLoadFilter === "no_disponibles") return !lower(a.status).includes("disponible");
      return true;
    })
    .filter((a) => {
      if (!search) return true;

      return [a.name, a.specialty, a.status, a.email]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => b.capacity - a.capacity);
}

function advisorTableRow(item) {
  const advisor = normalizeAdvisor(item);

  return `
    <tr>
      <td>${esc(advisor.name)}</td>
      <td>${esc(advisor.specialty)}</td>
      <td><span class="${pillClass(advisorStatusType(advisor.status))}">${esc(advisor.status)}</span></td>
      <td>${esc(advisor.cases)}</td>
      <td>${esc(advisor.critical)}</td>
      <td>${esc(advisor.slaRisk)}</td>
      <td>${esc(advisor.productivity)}%</td>
      <td>
        <button type="button" data-action="view-advisor" data-advisor-id="${esc(advisor.id)}">Ver</button>
        <button type="button" data-action="toggle-advisor" data-advisor-id="${esc(advisor.id)}">Disponibilidad</button>
        <button type="button" data-action="redistribute-advisor" data-advisor-id="${esc(advisor.id)}">Redistribuir</button>
      </td>
    </tr>
  `;
}

function renderLoadMap(rows) {
  const advisors = rows.map(normalizeAdvisor);

  setHTML(
    "#advisorLoadMap",
    advisors
      .map((advisor) => {
        const type =
          advisor.capacity >= 90
            ? "danger"
            : advisor.capacity >= 75
            ? "warning"
            : "success";

        return `
          <article class="load-map-card">
            <div class="load-map-card__top">
              <div>
                <h3>${esc(advisor.name)}</h3>
                <p>${esc(advisor.specialty)}</p>
              </div>
              <span class="map-score map-score--${type}">${esc(advisor.capacity)}%</span>
            </div>
            <p>${esc(advisor.cases)} casos activos · ${esc(advisor.slaRisk)} en riesgo SLA · ${esc(advisor.critical)} críticos.</p>
            <button type="button" data-action="view-advisor" data-advisor-id="${esc(advisor.id)}">Ver detalle</button>
          </article>
        `;
      })
      .join("")
  );

  bindAdvisorButtons($("#advisorLoadMap"));
}

function buildAdvisorLoadAi(rows) {
  const overloaded = rows.filter((a) => a.capacity >= 90).length;
  const available = rows.filter((a) => lower(a.status).includes("disponible")).length;
  const sla = rows.reduce((sum, a) => sum + a.slaRisk, 0);

  return [
    {
      title: "Balance de carga",
      text:
        overloaded > 0
          ? `${overloaded} asesores requieren redistribución de casos.`
          : "No se detecta sobrecarga severa en la vista actual.",
    },
    {
      title: "Disponibilidad",
      text: `${available} asesores aparecen disponibles para recibir nuevos casos.`,
    },
    {
      title: "Riesgo SLA",
      text:
        sla > 0
          ? `${sla} casos en riesgo SLA están distribuidos en el equipo.`
          : "Sin riesgo SLA concentrado en asesores visibles.",
    },
  ];
}

function buildAdvisorLoadPlan(rows) {
  return [
    {
      icon: "1",
      title: "Detectar sobrecarga",
      text: "Prioriza asesores con más de 90% de capacidad.",
    },
    {
      icon: "2",
      title: "Buscar receptor",
      text: "Identifica asesores disponibles con baja carga.",
    },
    {
      icon: "3",
      title: "Mover casos críticos",
      text: "Redistribuye primero casos con riesgo SLA.",
    },
    {
      icon: "4",
      title: "Monitorear",
      text: "Revisa nuevamente la carga después de reasignar.",
    },
  ];
}

/* =========================================================
   MONITOREO SLA
========================================================= */

async function initSlaMonitor() {
  bindSlaMonitorEvents();
  await renderSlaMonitor();
}

function bindSlaMonitorEvents() {
  $("#slaMonitorSearch")?.addEventListener("input", debounce(renderSlaMonitor, 250));

  $$("[data-sla-monitor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.slaFilter = button.dataset.slaMonitorFilter || "todos";
      $$("[data-sla-monitor-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderSlaMonitor();
    });
  });

  $("#toggleSlaMonitorViewBtn")?.addEventListener("click", () => {
    State.slaView = State.slaView === "cards" ? "table" : "cards";
    setText("#toggleSlaMonitorViewBtn", State.slaView === "cards" ? "Vista tabla" : "Vista cards");
    renderSlaMonitor();
  });

  $("#refreshSlaMonitorBtn")?.addEventListener("click", async () => {
    State.cases = [];
    await renderSlaMonitor();
    toast("SLA actualizado", "Se actualizó el monitoreo SLA.", "success");
  });

  $("#refreshPriorityMapBtn")?.addEventListener("click", renderSlaMonitor);
  $("#exportSlaMonitorBtn")?.addEventListener("click", () => exportCurrentTable("monitoreo-sla"));
  $("#sendMassSlaAlertBtn")?.addEventListener("click", openMassSlaAlertModal);

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

  $("#confirmSendSlaAlertBtn")?.addEventListener("click", confirmSlaAlert);
  $("#confirmSlaSupervisorFollowBtn")?.addEventListener("click", confirmSlaFollow);

  $("#slaAlertAiBtn")?.addEventListener("click", () => {
    const c = getCase(State.selectedCaseId);
    setValue(
      "#slaAlertMessage",
      c
        ? `Alerta preventiva: el caso ${c.code} presenta ${c.slaRisk}. Solicito priorizar atención y registrar avance en el sistema.`
        : "Alerta preventiva: se identificaron casos con riesgo SLA. Solicito priorizar atención y registrar avance."
    );
    toast("Texto generado", "Se preparó una alerta SLA sugerida.", "success");
  });
}

async function renderSlaMonitor() {
  try {
    await Promise.all([
      State.cases.length ? Promise.resolve(State.cases) : loadCases({ scope: "sla" }),
      State.advisors.length ? Promise.resolve(State.advisors) : loadAdvisors(),
    ]);

    const rows = slaFilteredCases();

    setText("#slaMonitorSummaryTitle", `${rows.length} alertas visibles`);
    setText("#slaMonitorSummaryText", `Filtro actual: ${State.slaFilter}.`);

    renderKpis("#slaMonitorKpiGrid", [
      {
        icon: "🚨",
        value: rows.filter((c) => c.slaHours < 0).length,
        label: "Vencidos",
        description: "SLA incumplido.",
      },
      {
        icon: "⏱️",
        value: rows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8).length,
        label: "Riesgo alto",
        description: "Vencen en menos de 8 horas.",
      },
      {
        icon: "📌",
        value: rows.filter((c) => c.blocked).length,
        label: "Bloqueados",
        description: "Pendientes de desbloqueo.",
      },
      {
        icon: "🔥",
        value: rows.filter((c) => priorityValue(c.priority) === 4).length,
        label: "Críticos",
        description: "Prioridad máxima.",
      },
    ]);

    setHTML("#slaMonitorCaseList", rows.map((c) => renderCaseCard(c, "sla")).join(""));
    setHTML("#slaMonitorTableBody", rows.map((c) => renderCaseTableRow(c, "sla")).join(""));

    show($("#slaMonitorCaseList"), State.slaView === "cards");
    show($("#slaMonitorTableWrap"), State.slaView === "table");
    show($("#emptySlaMonitorState"), !rows.length);

    renderAi("#slaMonitorAiSummary", buildSlaAi(rows));
    renderChecklist("#slaMonitorActionPlan", buildSlaPlan(rows));
    renderPriorityMap(rows);
    renderSlaByAdvisor(rows);

    bindCaseActions($("#slaMonitorCaseList"));
    bindCaseActions($("#slaMonitorTableBody"));
  } catch (error) {
    toast("Error al cargar SLA", error.message, "danger");
  }
}

function slaFilteredCases() {
  const search = lower(getValue("#slaMonitorSearch"));

  return State.cases
    .map(normalizeCase)
    .filter((c) => {
      if (State.slaFilter === "vencidos") return c.slaHours < 0;
      if (State.slaFilter === "riesgo_alto") return c.slaHours >= 0 && c.slaHours <= 8;
      if (State.slaFilter === "vence_hoy") return c.slaGroup === "vence_hoy";
      if (State.slaFilter === "bloqueados") return c.blocked;
      if (State.slaFilter === "derivados") return c.derived;
      return true;
    })
    .filter((c) => {
      if (!search) return true;

      return [
        c.code,
        c.clientName,
        c.advisorName,
        c.priority,
        c.status,
        c.slaText,
        c.title,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort((a, b) => a.slaHours - b.slaHours);
}

function buildSlaAi(rows) {
  const expired = rows.filter((c) => c.slaHours < 0).length;
  const high = rows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8).length;
  const unassigned = rows.filter((c) => !c.advisorId).length;

  return [
    {
      title: "SLA crítico",
      text:
        expired > 0
          ? `${expired} casos ya vencieron. Deben escalarse o resolverse con prioridad.`
          : "No hay casos vencidos dentro de la vista actual.",
    },
    {
      title: "Riesgo alto",
      text:
        high > 0
          ? `${high} casos vencen en menos de 8 horas. Requieren seguimiento.`
          : "No hay vencimientos inmediatos.",
    },
    {
      title: "Responsable",
      text:
        unassigned > 0
          ? `${unassigned} casos con riesgo no tienen asesor asignado.`
          : "Los casos visibles cuentan con responsable o ruta operativa.",
    },
  ];
}

function buildSlaPlan(rows) {
  return [
    {
      icon: "1",
      title: "Vencidos primero",
      text: "Atiende casos con SLA negativo antes que cualquier otra cola.",
    },
    {
      icon: "2",
      title: "Alertar responsable",
      text: "Notifica al asesor en riesgo SLA y registra seguimiento.",
    },
    {
      icon: "3",
      title: "Reasignar si hay sobrecarga",
      text: "Mueve casos de asesores saturados hacia asesores disponibles.",
    },
    {
      icon: "4",
      title: "Escalar críticos",
      text: "Escala casos críticos o bloqueados por más de un ciclo.",
    },
  ];
}

function renderPriorityMap(rows) {
  const groups = [
    {
      id: "vencidos",
      title: "Vencidos",
      description: "Casos con SLA incumplido.",
      score: rows.filter((c) => c.slaHours < 0).length,
      status: "danger",
    },
    {
      id: "riesgo",
      title: "Riesgo alto",
      description: "Vencen dentro de las próximas 8 horas.",
      score: rows.filter((c) => c.slaHours >= 0 && c.slaHours <= 8).length,
      status: "warning",
    },
    {
      id: "criticos",
      title: "Críticos",
      description: "Prioridad crítica o alto impacto.",
      score: rows.filter((c) => priorityValue(c.priority) === 4).length,
      status: "danger",
    },
    {
      id: "controlados",
      title: "Controlados",
      description: "SLA mayor a 24 horas.",
      score: rows.filter((c) => c.slaHours > 24).length,
      status: "success",
    },
  ];

  setHTML(
    "#priorityMapGrid",
    groups
      .map(
        (item) => `
          <article class="priority-map-card">
            <div class="priority-map-card__top">
              <div>
                <h3>${esc(item.title)}</h3>
                <p>${esc(item.description)}</p>
              </div>
              <span class="map-score map-score--${esc(item.status)}">${esc(item.score)}</span>
            </div>
          </article>
        `
      )
      .join("")
  );
}

function renderSlaByAdvisor(rows) {
  const map = new Map();

  rows.forEach((item) => {
    const c = normalizeCase(item);
    const key = c.advisorId || "sin_asignar";
    const current = map.get(key) || {
      id: key,
      name: c.advisorName || "Sin asignar",
      cases: 0,
      critical: 0,
      slaRisk: 0,
      capacity: 0,
      productivity: 0,
      specialty: "SLA operativo",
      status: key === "sin_asignar" ? "No disponible" : "Disponible",
    };

    current.cases += 1;
    if (priorityValue(c.priority) === 4) current.critical += 1;
    if (c.slaHours <= 8) current.slaRisk += 1;
    current.capacity = Math.min(100, current.cases * 10);

    map.set(key, current);
  });

  setHTML("#slaByAdvisorList", Array.from(map.values()).map((a) => advisorLoadCard(a, false)).join(""));
}

/* =========================================================
   INDICADORES
========================================================= */

async function initIndicators() {
  bindIndicatorEvents();
  await renderIndicators();
}

function bindIndicatorEvents() {
  $("#refreshIndicatorsBtn")?.addEventListener("click", renderIndicators);
  $("#exportIndicatorsBtn")?.addEventListener("click", () => exportCurrentTable("indicadores"));

  $("#compareIndicatorsBtn")?.addEventListener("click", () => {
    openModal("#compareIndicatorsModal");
  });

  $("#confirmCompareIndicatorsBtn")?.addEventListener("click", confirmCompareIndicators);

  $("#indicatorPeriodFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorAdvisorFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorCaseTypeFilter")?.addEventListener("change", renderIndicators);
  $("#indicatorChannelFilter")?.addEventListener("change", renderIndicators);

  $("#toggleIndicatorViewBtn")?.addEventListener("click", () => {
    State.indicatorCompact = !State.indicatorCompact;
    $("#mainIndicatorGrid")?.classList.toggle("indicator-grid--compact", State.indicatorCompact);
    setText("#toggleIndicatorViewBtn", State.indicatorCompact ? "Vista completa" : "Vista compacta");
  });

  $("#resetIndicatorFiltersBtn")?.addEventListener("click", () => {
    setValue("#indicatorPeriodFilter", "semana");
    setValue("#indicatorAdvisorFilter", "todos");
    setValue("#indicatorCaseTypeFilter", "todos");
    setValue("#indicatorChannelFilter", "todos");
    renderIndicators();
  });

  $("#indicatorDetailAiBtn")?.addEventListener("click", () => {
    askBot("Analiza el indicador seleccionado y explica causas y acciones.");
  });

  $("#indicatorDetailReportBtn")?.addEventListener("click", () => {
    const indicator = getIndicator(State.selectedIndicatorId);
    closeModals();
    window.location.href = `reportes.html?indicador=${encodeURIComponent(indicator?.title || "")}`;
  });
}

async function renderIndicators() {
  try {
    if (!State.advisors.length) {
      await loadAdvisors();
    }

    const response = await loadIndicators({
      period: getValue("#indicatorPeriodFilter") || "semana",
      advisor: getValue("#indicatorAdvisorFilter") || "todos",
      type: getValue("#indicatorCaseTypeFilter") || "todos",
      channel: getValue("#indicatorChannelFilter") || "todos",
    });

    const indicators = response.items || response.indicators || response.indicadores || [];

    setText("#indicatorsSummaryTitle", `${indicators.length} indicadores activos`);
    setText("#indicatorsSummaryText", `Periodo: ${getValue("#indicatorPeriodFilter") || "semana"}.`);

    renderKpis("#indicatorsKpiGrid", response.kpis || indicators.slice(0, 4));
    setHTML("#mainIndicatorGrid", indicators.map(indicatorCard).join(""));
    show($("#emptyIndicatorsState"), !indicators.length);

    renderAi("#indicatorsAiSummary", response.ai_summary || response.resumen_ia || []);
    renderChecklist("#indicatorActionPlan", [
      {
        icon: "1",
        title: "Revisar desviaciones",
        text: "Atiende indicadores por debajo de meta.",
      },
      {
        icon: "2",
        title: "Cruzar con SLA",
        text: "Verifica si la desviación viene de vencimientos.",
      },
      {
        icon: "3",
        title: "Validar carga",
        text: "Cruza productividad con capacidad de asesores.",
      },
    ]);

    renderTrendChart(response.trend || response.tendencia || []);
    renderPriorityStack(response.priority_distribution || response.distribucion_prioridad || []);
    renderAdvisorPerformance(response.advisor_performance || response.desempeno_asesores || []);

    bindIndicatorButtons($("#mainIndicatorGrid"));
  } catch (error) {
    toast("Error al cargar indicadores", error.message, "danger");
  }
}

function renderTrendChart(rows = []) {
  const max = Math.max(1, ...rows.map((r) => asNumber(r.value ?? r.ingresados, 0)));

  setHTML(
    "#indicatorTrendChart",
    rows
      .map((row) => {
        const value = asNumber(row.value ?? row.ingresados, 0);

        return `
          <div class="bar-chart__row">
            <span>${esc(row.label || row.fecha || "-")}</span>
            <div><i style="width:${Math.max(4, (value / max) * 100)}%"></i></div>
            <strong>${esc(value)}</strong>
          </div>
        `;
      })
      .join("")
  );
}

function renderPriorityStack(rows = []) {
  setHTML(
    "#indicatorPriorityStack",
    rows
      .map(
        (row) => `
          <div>
            <span>${esc(row.label || row.prioridad || "Prioridad")}</span>
            <strong>${esc(row.value ?? row.total ?? 0)}</strong>
          </div>
        `
      )
      .join("")
  );
}

function renderAdvisorPerformance(rows = []) {
  setHTML(
    "#advisorPerformanceTableBody",
    rows
      .map(
        (row) => `
          <tr>
            <td>${esc(row.advisor || row.asesor || row.name || "-")}</td>
            <td>${esc(row.cases ?? row.casos ?? 0)}</td>
            <td>${esc(row.closed ?? row.cerrados ?? 0)}</td>
            <td>${esc(row.sla ?? row.sla_cumplido ?? 0)}%</td>
            <td>${esc(row.productivity ?? row.productividad ?? 0)}%</td>
            <td><span class="${pillClass(advisorStatusType(row.status || row.estado))}">${esc(row.status || row.estado || "Activo")}</span></td>
            <td>
              <button type="button" data-action="view-advisor" data-advisor-id="${esc(row.id || row.asesor_id || "")}">Ver</button>
            </td>
          </tr>
        `
      )
      .join("")
  );

  bindAdvisorButtons($("#advisorPerformanceTableBody"));
}

async function confirmCompareIndicators() {
  if (!requireValue("#compareBasePeriod", "periodo base")) return;
  if (!requireValue("#compareTargetPeriod", "periodo comparativo")) return;
  if (!requireDeclaration("#compareIndicatorsDeclaration")) return;

  const base = getValue("#compareBasePeriod");
  const target = getValue("#compareTargetPeriod");

  confirmAction({
    icon: "📊",
    eyebrow: "Comparación de indicadores",
    title: "¿Confirmas comparar los indicadores?",
    text: `Se comparará ${base} contra ${target}.`,
    summary: summaryHTML([
      ["Periodo base", base],
      ["Periodo comparativo", target],
      ["Alcance", getValue("#indicatorAdvisorFilter") || "Todos"],
    ]),
    confirmText: "Comparar",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/indicadores/comparar", {
          method: "POST",
          body: JSON.stringify({
            base_period: base,
            target_period: target,
            advisor: getValue("#indicatorAdvisorFilter") || "todos",
            type: getValue("#indicatorCaseTypeFilter") || "todos",
            channel: getValue("#indicatorChannelFilter") || "todos",
          }),
        });

        closeModals();
        genericModal(
          "📈",
          "Comparación generada",
          response.insight ||
            "Se generó la comparación del periodo. Revisa variaciones de SLA, productividad, cierres y casos vencidos."
        );
      } catch (error) {
        toast("No se pudo comparar", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   REPORTES
========================================================= */

async function initReports() {
  bindReportEvents();
  await renderReports();
}

function bindReportEvents() {
  $("#generateReportBtn")?.addEventListener("click", () => {
    $("#reportType")?.focus();
    previewReport();
  });

  $("#confirmGenerateReportBtn")?.addEventListener("click", confirmGenerateReport);
  $("#previewReportBtn")?.addEventListener("click", previewReport);
  $("#scheduleReportBtn")?.addEventListener("click", openScheduleReportModal);

  $("#saveReportConfigBtn")?.addEventListener("click", () => {
    const payload = getReportPayload();

    if (!payload.tipo || !payload.periodo || !payload.alcance || !payload.formato) {
      toast("Configuración incompleta", "Selecciona tipo, periodo, alcance y formato antes de guardar.", "warning");
      return;
    }

    confirmAction({
      icon: "💾",
      eyebrow: "Guardar configuración",
      title: "¿Guardar esta configuración de reporte?",
      text: "La configuración quedará disponible como plantilla para futuras generaciones.",
      summary: summaryHTML([
        ["Tipo", payload.tipo],
        ["Periodo", payload.periodo],
        ["Alcance", payload.alcance],
        ["Formato", payload.formato],
      ]),
      confirmText: "Guardar configuración",
      onConfirm: async () => {
        closeModals();
        toast("Configuración guardada", "La configuración del reporte quedó preparada.", "success");
      },
    });
  });

  $("#resetReportFiltersBtn")?.addEventListener("click", resetReportForm);
  $("#refreshRecentReportsBtn")?.addEventListener("click", renderReports);
  $("#exportRecentReportsBtn")?.addEventListener("click", () => exportCurrentTable("reportes"));
  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);

  $("#reportPreviewGenerateBtn")?.addEventListener("click", confirmGenerateReport);
  $("#reportPreviewExportBtn")?.addEventListener("click", () => {
    confirmAction({
      icon: "⬇️",
      eyebrow: "Exportar reporte",
      title: "¿Confirmas exportar el reporte?",
      text: "Se descargará un archivo con la configuración seleccionada.",
      summary: reportPreviewSummaryHTML(),
      confirmText: "Exportar",
      onConfirm: async () => {
        closeModals();
        exportCurrentTable("reporte-supervisor");
      },
    });
  });
}

async function renderReports() {
  try {
    const response = await loadReports();

    const reports = response.items || response.reports || response.reportes || [];

    setText("#reportsSummaryTitle", `${reports.length} reportes recientes`);
    setText("#reportsSummaryText", "Generación operativa disponible.");

    renderKpis("#reportsKpiGrid", response.kpis || []);
    renderAi("#reportsAiSummary", response.ai_summary || response.resumen_ia || []);
    setHTML("#frequentReportsList", (response.frequent || response.frecuentes || []).map(reportTemplateCard).join(""));
    setHTML("#recentReportsTableBody", reports.map(reportRow).join(""));

    bindReportTemplateButtons();
    bindReportRows();
  } catch (error) {
    toast("Error al cargar reportes", error.message, "danger");
  }
}

function reportRow(item) {
  const report = normalizeReport(item);

  return `
    <tr>
      <td>${esc(report.name)}</td>
      <td>${esc(report.type)}</td>
      <td>${esc(report.period)}</td>
      <td>${esc(report.format)}</td>
      <td>${esc(report.owner)}</td>
      <td><span class="${pillClass(caseStatusType(report.status))}">${esc(report.status)}</span></td>
      <td>
        <button type="button" data-action="preview-report" data-report-id="${esc(report.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(report.id)}">Descargar</button>
      </td>
    </tr>
  `;
}

function bindReportRows() {
  $$('[data-action="preview-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      const report = State.reports.map(normalizeReport).find((item) => String(item.id) === String(button.dataset.reportId));
      if (!report) return;

      setText("#reportPreviewTitle", report.name);
      setText("#reportPreviewText", `Reporte ${report.type} · ${report.period} · ${report.format}`);
      setHTML(
        "#reportPreviewSummary",
        summaryHTML([
          ["Reporte", report.name],
          ["Tipo", report.type],
          ["Periodo", report.period],
          ["Formato", report.format],
          ["Estado", report.status],
          ["Generado por", report.owner],
        ])
      );
      renderChecklist("#reportPreviewSections", [
        ["📊", "Resumen", "Incluye resumen ejecutivo del reporte."],
        ["📋", "Detalle", "Incluye registros relacionados al alcance."],
        ["🕵️", "Trazabilidad", "Incluye auditoría si corresponde."],
      ]);
      openModal("#reportPreviewModal");
    });
  });

  $$('[data-action="download-report"]').forEach((button) => {
    button.addEventListener("click", () => {
      const report = State.reports.map(normalizeReport).find((item) => String(item.id) === String(button.dataset.reportId));
      if (!report) return;

      confirmAction({
        icon: "⬇️",
        eyebrow: "Descargar reporte",
        title: `¿Descargar ${report.name}?`,
        text: "El archivo se generará con los datos disponibles en la tabla de reportes.",
        summary: summaryHTML([
          ["Reporte", report.name],
          ["Formato", report.format],
          ["Estado", report.status],
        ]),
        confirmText: "Descargar",
        onConfirm: async () => {
          closeModals();
          exportCurrentTable(`reporte-${String(report.name).toLowerCase().replace(/\s+/g, "-")}`);
        },
      });
    });
  });
}

function bindReportTemplateButtons() {
  $$('[data-action="apply-report-template"]').forEach((button) => {
    button.addEventListener("click", () => {
      const id = lower(button.dataset.templateId);

      if (id.includes("sla")) {
        setValue("#reportType", "Cumplimiento SLA");
        setValue("#reportScope", "Solo vencidos");
        setValue("#reportFormat", "PDF");
        if ($("#includeSla")) $("#includeSla").checked = true;
      } else if (id.includes("asesor")) {
        setValue("#reportType", "Casos por asesor");
        setValue("#reportScope", "Por asesor");
        setValue("#reportFormat", "Excel");
        if ($("#includeCases")) $("#includeCases").checked = true;
      } else {
        setValue("#reportType", "Resumen ejecutivo");
        setValue("#reportScope", "Todos los casos");
        setValue("#reportFormat", "PDF");
        if ($("#includeCharts")) $("#includeCharts").checked = true;
      }

      setValue("#reportPeriod", "Semana actual");
      toast("Plantilla aplicada", "Se cargó la configuración sugerida.", "success");
      previewReport();
    });
  });
}

function resetReportForm() {
  $("#reportGeneratorForm")?.reset();
  toast("Formulario limpio", "Se restauraron los parámetros del reporte.", "success");
}

function reportPreviewSummaryHTML() {
  const payload = getReportPayload();

  return summaryHTML([
    ["Tipo", payload.tipo || "No seleccionado"],
    ["Periodo", payload.periodo || "No seleccionado"],
    ["Alcance", payload.alcance || "No seleccionado"],
    ["Formato", payload.formato || "No seleccionado"],
    ["Gráficos", payload.includeCharts ? "Sí" : "No"],
    ["Detalle de casos", payload.includeCases ? "Sí" : "No"],
    ["SLA", payload.includeSla ? "Sí" : "No"],
    ["Trazabilidad", payload.includeAudit ? "Sí" : "No"],
  ]);
}

function previewReport() {
  const payload = getReportPayload();

  if (!payload.tipo || !payload.periodo || !payload.alcance || !payload.formato) {
    toast("Parámetros incompletos", "Selecciona tipo, periodo, alcance y formato para mostrar la vista previa.", "warning");
    return;
  }

  setText("#reportPreviewTitle", `${payload.tipo} · ${payload.periodo}`);
  setText("#reportPreviewText", "Revisa el contenido estimado antes de generar o exportar.");
  setHTML("#reportPreviewSummary", reportPreviewSummaryHTML());

  const sections = [
    ["📌", "Resumen ejecutivo", "Resumen de hallazgos y estado operativo."],
    payload.includeCharts ? ["📊", "Gráficos", "Incluye visualizaciones y tendencia del periodo."] : null,
    payload.includeCases ? ["📋", "Detalle de casos", "Incluye registros asociados al alcance seleccionado."] : null,
    payload.includeSla ? ["⏱️", "SLA", "Incluye vencimientos, riesgo y cumplimiento."] : null,
    payload.includeAudit ? ["🕵️", "Trazabilidad", "Incluye eventos auditables y cambios registrados."] : null,
  ].filter(Boolean);

  renderChecklist("#reportPreviewSections", sections);
  openModal("#reportPreviewModal");
}

async function confirmGenerateReport() {
  const payload = getReportPayload();

  if (!payload.tipo || !payload.periodo || !payload.alcance || !payload.formato) {
    toast("Parámetros incompletos", "Selecciona tipo, periodo, alcance y formato antes de generar.", "warning");
    return;
  }

  confirmAction({
    icon: "📊",
    eyebrow: "Generar reporte",
    title: "¿Confirmas generar el reporte?",
    text: "El reporte será registrado en el historial y quedará disponible para descarga.",
    summary: reportPreviewSummaryHTML(),
    confirmText: "Generar reporte",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/reportes/generar", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeModals();
        toast("Reporte generado", response.message || "El reporte fue generado correctamente.", "success");
        await renderReports();
      } catch (error) {
        toast("No se pudo generar", error.message, "danger");
      }
    },
  });
}

function openScheduleReportModal() {
  openModal("#scheduleReportModal");
}

async function confirmScheduleReport() {
  if (!requireValue("#scheduleFrequency", "frecuencia")) return;
  if (!requireValue("#scheduleFormat", "formato")) return;
  if (!requireValue("#scheduleRecipients", "destinatarios")) return;
  if (!requireDeclaration("#scheduleReportDeclaration")) return;

  const recipients = getValue("#scheduleRecipients");
  const invalidEmails = recipients
    .split(/[;,]/)
    .map((mail) => mail.trim())
    .filter(Boolean)
    .filter((mail) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail));

  if (invalidEmails.length) {
    toast("Correo inválido", `Revisa: ${invalidEmails.join(", ")}`, "warning");
    return;
  }

  const payload = {
    ...getReportPayload(),
    frecuencia: getValue("#scheduleFrequency"),
    formato_programado: getValue("#scheduleFormat"),
    destinatarios: recipients,
  };

  confirmAction({
    icon: "🗓️",
    eyebrow: "Programar reporte",
    title: "¿Confirmas programar este reporte?",
    text: "El sistema registrará la programación recurrente con los destinatarios indicados.",
    summary: summaryHTML([
      ["Frecuencia", payload.frecuencia],
      ["Formato", payload.formato_programado],
      ["Destinatarios", payload.destinatarios],
      ["Tipo de reporte", payload.tipo || "Según configuración actual"],
    ]),
    confirmText: "Programar",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/reportes/programar", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeModals();
        toast("Reporte programado", response.message || "El reporte quedó programado.", "success");
        await renderReports();
      } catch (error) {
        toast("No se pudo programar", error.message, "danger");
      }
    },
  });
}

function getReportPayload() {
  return {
    tipo: getValue("#reportType"),
    periodo: getValue("#reportPeriod"),
    alcance: getValue("#reportScope"),
    formato: getValue("#reportFormat"),
    comentario: getValue("#reportComment"),
    includeCharts: getChecked("#includeCharts"),
    includeCases: getChecked("#includeCases"),
    includeSla: getChecked("#includeSla"),
    includeAudit: getChecked("#includeAudit"),
  };
}

/* =========================================================
   AUDITORÍA
========================================================= */

async function initAudit() {
  bindAuditEvents();
  await renderAudit();
}

function bindAuditEvents() {
  $("#auditSearch")?.addEventListener("input", debounce(renderAudit, 250));

  $$("[data-audit-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.auditFilter = button.dataset.auditFilter || "todos";
      $$("[data-audit-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderAudit();
    });
  });

  $("#refreshAuditBtn")?.addEventListener("click", renderAudit);

  $("#exportAuditBtn")?.addEventListener("click", () => {
    confirmAction({
      icon: "⬇️",
      eyebrow: "Exportar auditoría",
      title: "¿Deseas exportar los eventos filtrados?",
      text: "Se descargará un archivo CSV con la trazabilidad visible.",
      summary: summaryHTML([
        ["Filtro", State.auditFilter],
        ["Búsqueda", getValue("#auditSearch") || "Sin búsqueda"],
        ["Eventos cargados", State.audit.length],
      ]),
      confirmText: "Exportar",
      onConfirm: async () => {
        closeModals();
        exportCurrentTable("auditoria");
      },
    });
  });

  $("#downloadAuditTraceBtn")?.addEventListener("click", () => {
    confirmAction({
      icon: "🕵️",
      eyebrow: "Descargar trazabilidad",
      title: "¿Descargar trazabilidad auditable?",
      text: "Se incluirán eventos, usuario responsable, fecha, estado anterior y nuevo estado.",
      summary: summaryHTML([
        ["Filtro", State.auditFilter],
        ["Búsqueda", getValue("#auditSearch") || "Sin búsqueda"],
        ["Eventos cargados", State.audit.length],
      ]),
      confirmText: "Descargar",
      onConfirm: async () => {
        closeModals();
        exportCurrentTable("trazabilidad");
      },
    });
  });

  $("#compareAuditBtn")?.addEventListener("click", () => {
    openModal("#compareAuditModal");
  });

  $("#confirmCompareAuditBtn")?.addEventListener("click", confirmCompareAudit);

  $("#auditDetailDownloadBtn")?.addEventListener("click", () => {
    const audit = getAudit(State.selectedAuditId);
    if (!audit) return;

    confirmAction({
      icon: "⬇️",
      eyebrow: "Descargar evento",
      title: "¿Descargar trazabilidad del evento?",
      text: "Se exportará la información auditable del evento seleccionado.",
      summary: summaryHTML([
        ["Caso", audit.caseId],
        ["Acción", audit.action],
        ["Usuario", audit.user],
        ["Fecha", formatDateTime(audit.date)],
      ]),
      confirmText: "Descargar",
      onConfirm: async () => {
        closeModals();
        exportRowsAsCsv(`trazabilidad-${audit.caseId}`, [audit]);
      },
    });
  });

  $("#auditDetailCompareBtn")?.addEventListener("click", () => {
    const audit = getAudit(State.selectedAuditId);
    closeModals();
    setValue("#compareAuditCase", audit?.caseId || "");
    openModal("#compareAuditModal");
  });
}

async function renderAudit() {
  try {
    const response = await loadAudit({
      q: getValue("#auditSearch"),
      type: State.auditFilter,
    });

    const rows = response.items || response.audit || response.auditoria || [];

    setText("#auditSummaryTitle", `${rows.length} eventos auditables`);
    setText("#auditSummaryText", `Filtro actual: ${State.auditFilter}.`);

    renderKpis("#auditKpiGrid", response.kpis || []);
    setHTML("#auditTableBody", rows.map(auditRow).join(""));
    show($("#emptyAuditState"), !rows.length);

    renderAi("#auditAiSummary", response.ai_summary || response.resumen_ia || []);
    renderChecklist("#auditActionPlan", [
      {
        icon: "1",
        title: "Ver cambios críticos",
        text: "Prioriza escalamientos, SLA y cambios de responsable.",
      },
      {
        icon: "2",
        title: "Validar usuario",
        text: "Revisa quién ejecutó cada acción sensible.",
      },
      {
        icon: "3",
        title: "Comparar antes/después",
        text: "Evalúa cambios de estado, prioridad o responsable.",
      },
    ]);

    bindAuditRows();
  } catch (error) {
    toast("Error al cargar auditoría", error.message, "danger");
  }
}

function bindAuditRows() {
  $$('[data-action="view-audit"]').forEach((button) => {
    button.addEventListener("click", () => openAuditDetailModal(button.dataset.auditId));
  });
}

function openAuditDetailModal(id) {
  const audit = getAudit(id);
  if (!audit) return;

  saveSelectedAudit(id);

  setText("#auditDetailIcon", audit.critical ? "🚨" : "🕵️");
  setText("#auditDetailTitle", `${audit.action} · ${audit.caseId}`);
  setText("#auditDetailText", audit.detail || "Evento registrado en trazabilidad.");
  setHTML(
    "#auditDetailSummary",
    summaryHTML([
      ["Fecha", formatDateTime(audit.date)],
      ["Caso", audit.caseId],
      ["Tipo", audit.type],
      ["Acción", audit.action],
      ["Usuario", audit.user],
      ["Antes", audit.before],
      ["Después", audit.after],
      ["Detalle", audit.detail || "Sin detalle adicional"],
    ])
  );

  openModal("#auditDetailModal");
}

async function confirmCompareAudit() {
  if (!requireValue("#compareAuditCase", "código de caso")) return;
  if (!requireValue("#compareAuditType", "tipo de comparación")) return;
  if (!requireDeclaration("#compareAuditDeclaration")) return;

  const caseId = getValue("#compareAuditCase");
  const type = getValue("#compareAuditType");

  confirmAction({
    icon: "🔍",
    eyebrow: "Comparar cambios",
    title: "¿Confirmas comparar los cambios del caso?",
    text: "Se consultará la trazabilidad del caso seleccionado para mostrar cambios antes/después.",
    summary: summaryHTML([
      ["Caso", caseId],
      ["Tipo de comparación", type],
    ]),
    confirmText: "Comparar",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/auditoria/comparar", {
          method: "POST",
          body: JSON.stringify({
            case_id: caseId,
            tipo: type,
          }),
        });

        closeModals();
        genericModal(
          "🕵️",
          "Comparación de auditoría",
          response.insight ||
            "Se generó la comparación de cambios del caso seleccionado. Revisa estado anterior, estado nuevo, usuario responsable y fecha del cambio."
        );
      } catch (error) {
        toast("No se pudo comparar", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   CONFIGURACIÓN
========================================================= */

async function initConfig() {
  bindConfigEvents();
  await renderConfig();
}

function bindConfigEvents() {
  $("#configSearch")?.addEventListener("input", debounce(renderConfig, 250));

  $$("[data-config-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.configFilter = button.dataset.configFilter || "todos";
      $$("[data-config-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderConfig();
    });
  });

  $("#refreshSupervisorConfigBtn")?.addEventListener("click", renderConfig);
  $("#exportSupervisorConfigBtn")?.addEventListener("click", () => {
    confirmAction({
      icon: "⬇️",
      eyebrow: "Exportar configuración",
      title: "¿Deseas exportar las reglas de supervisión?",
      text: "Se descargará un CSV con reglas, valores, estados y categorías.",
      summary: summaryHTML([
        ["Reglas cargadas", State.configRules.length],
        ["Rutas cargadas", State.routeRules.length],
      ]),
      confirmText: "Exportar",
      onConfirm: async () => {
        closeModals();
        exportCurrentTable("configuracion");
      },
    });
  });

  $("#saveSupervisorConfigBtn")?.addEventListener("click", () => {
    openModal("#confirmConfigSaveModal");
  });

  $("#confirmSaveSupervisorConfigBtn")?.addEventListener("click", confirmSaveConfig);

  $("#restoreSupervisorConfigBtn")?.addEventListener("click", confirmRestoreConfig);
  $("#editPriorityMatrixBtn")?.addEventListener("click", openPriorityMatrixModal);
  $("#simulatePriorityBtn")?.addEventListener("click", openSimulatePriorityModal);
  $("#addRouteRuleBtn")?.addEventListener("click", openRouteRuleModal);
  $("#validateRoutesBtn")?.addEventListener("click", validateRoutes);

  $("#confirmEditConfigRuleBtn")?.addEventListener("click", confirmEditConfigRule);
  $("#confirmPriorityMatrixBtn")?.addEventListener("click", confirmPriorityMatrix);
  $("#confirmSimulatePriorityBtn")?.addEventListener("click", simulatePriority);
  $("#confirmRouteRuleBtn")?.addEventListener("click", confirmRouteRule);

  $("#configRuleAiBtn")?.addEventListener("click", () => {
    const rule = getConfigRule(State.selectedConfigRuleId);
    if (!rule) return;

    if (rule.category === "sla") {
      setValue("#configRuleValue", "8 horas");
    } else if (rule.category === "capacidad") {
      setValue("#configRuleValue", "85%");
    } else if (rule.category === "prioridad") {
      setValue("#configRuleValue", "Impacto alto + SLA menor a 8 horas");
    } else {
      setValue("#configRuleValue", rule.value);
    }

    setValue("#configRuleReason", "Valor sugerido por IA según reglas operativas y riesgo actual.");
    toast("Sugerencia aplicada", "Se completó un valor sugerido para la regla.", "success");
  });
}

async function renderConfig() {
  try {
    const response = await loadConfig();

    const search = lower(getValue("#configSearch"));

    const rules = State.configRules
      .map(normalizeConfigRule)
      .filter((rule) => {
        if (State.configFilter !== "todos" && rule.category !== State.configFilter) return false;
        if (!search) return true;

        return [rule.title, rule.value, rule.description, rule.category]
          .join(" ")
          .toLowerCase()
          .includes(search);
      });

    setText("#configSummaryTitle", `${rules.length} reglas visibles`);
    setText("#configSummaryText", "Parámetros operativos listos para revisión.");

    renderKpis("#configKpiGrid", response.kpis || []);
    setHTML("#configRuleGrid", rules.map(configRuleCard).join(""));
    setHTML("#routeRulesTableBody", State.routeRules.map(routeRuleRow).join(""));
    setHTML("#priorityMatrixGrid", State.priorityMatrix.map(priorityMatrixCard).join(""));

    show($("#emptyConfigState"), !rules.length);

    renderAi("#configAiSummary", response.ai_summary || response.resumen_ia || []);
    renderChecklist("#configChecklist", [
      {
        icon: "✓",
        title: "SLA definido",
        text: "Existe umbral para riesgo alto y control de vencidos.",
      },
      {
        icon: "✓",
        title: "Capacidad controlada",
        text: "La carga máxima por asesor tiene un límite operativo.",
      },
      {
        icon: "✓",
        title: "Rutas activas",
        text: "Las derivaciones tienen área destino y SLA interno.",
      },
    ]);

    bindConfigButtons();
  } catch (error) {
    toast("Error al cargar configuración", error.message, "danger");
  }
}

function bindConfigButtons() {
  $$('[data-action="edit-config-rule"]').forEach((button) => {
    button.addEventListener("click", () => openEditConfigRuleModal(button.dataset.ruleId));
  });

  $$('[data-action="view-route-rule"]').forEach((button) => {
    button.addEventListener("click", () => {
      const route = getRouteRule(button.dataset.routeId);
      if (!route) return;

      genericModal(
        "🧭",
        route.route,
        `${route.condition}. Área destino: ${route.area}. SLA interno: ${route.internalSla}. Escalamiento: ${route.escalation}.`
      );
    });
  });
}

/* =========================================================
   MODALES DE CASO
========================================================= */

function openQuickCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#caseQuickViewIcon", item.icon);
  setText("#caseQuickViewTitle", item.code);
  setText("#caseQuickViewText", item.description || item.action);
  setHTML("#caseQuickViewSummary", caseSummary(item));

  openModal("#caseQuickViewModal");
}

function openPendingCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#pendingCaseModalIcon", item.icon);
  setText("#pendingCaseModalTitle", `${item.code} · ${item.title}`);
  setText("#pendingCaseModalText", item.description || item.action);
  setHTML("#pendingCaseModalSummary", caseSummary(item));

  openModal("#pendingCaseModal");
}

function openAssignmentCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#assignmentCaseModalIcon", item.icon);
  setText("#assignmentCaseModalTitle", `${item.code} · ${item.title}`);
  setText("#assignmentCaseModalText", item.description || item.action);
  setHTML("#assignmentCaseModalSummary", caseSummary(item));

  openModal("#assignmentCaseModal");
}

function openSlaCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setText("#slaCaseDetailIcon", item.icon);
  setText("#slaCaseDetailTitle", `${item.code} · ${item.slaText}`);
  setText("#slaCaseDetailText", item.description || item.action);
  setHTML("#slaCaseDetailSummary", caseSummary(item));

  openModal("#slaCaseDetailModal");
}

function openClassifyCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#classifyCaseContext", caseSummary(item));
  setValue("#classifyCaseType", item.type === "Caso" ? "Reclamo" : item.type);
  setValue("#classifyCaseCategory", item.category || "Atención comercial");
  setValue("#classifyCasePriority", item.priority || "Media");
  setValue("#classifyCaseRoute", item.area || "Asignación directa");
  setValue("#classifyCaseReason", "Clasificación validada por supervisión.");

  const declaration = $("#classifyCaseDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#classifyCaseModal");
}

function suggestClassification() {
  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const text = lower(`${item.title} ${item.description} ${item.service}`);

  if (text.includes("internet") || text.includes("señal") || text.includes("falla") || text.includes("lento")) {
    setValue("#classifyCaseType", "Incidencia");
    setValue("#classifyCaseCategory", "Soporte técnico");
    setValue("#classifyCasePriority", "Alta");
    setValue("#classifyCaseRoute", "Soporte técnico");
  } else if (text.includes("factura") || text.includes("cobro") || text.includes("recibo")) {
    setValue("#classifyCaseType", "Reclamo");
    setValue("#classifyCaseCategory", "Facturación");
    setValue("#classifyCasePriority", "Media");
    setValue("#classifyCaseRoute", "Backoffice");
  } else {
    setValue("#classifyCaseType", "Reclamo");
    setValue("#classifyCaseCategory", "Atención comercial");
    setValue("#classifyCasePriority", item.slaHours <= 8 ? "Alta" : "Media");
    setValue("#classifyCaseRoute", "Asignación directa");
  }

  setValue("#classifyCaseReason", "Clasificación sugerida por IA y validada por supervisión.");
  toast("Sugerencia aplicada", "La IA completó una clasificación sugerida.", "success");
}

async function confirmClassifyCase() {
  if (!requireValue("#classifyCaseType", "tipo de caso")) return;
  if (!requireValue("#classifyCaseCategory", "categoría")) return;
  if (!requireValue("#classifyCasePriority", "prioridad")) return;
  if (!requireValue("#classifyCaseRoute", "ruta")) return;
  if (!requireDeclaration("#classifyCaseDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    tipo_caso: getValue("#classifyCaseType"),
    categoria: getValue("#classifyCaseCategory"),
    prioridad: getValue("#classifyCasePriority"),
    ruta: getValue("#classifyCaseRoute"),
    motivo: getValue("#classifyCaseReason") || "Clasificación validada por supervisión.",
  };

  confirmAction({
    icon: "📋",
    eyebrow: "Clasificación de caso",
    title: `¿Confirmas clasificar el caso ${item.code}?`,
    text: "La clasificación actualizará la prioridad, categoría y ruta operativa del caso.",
    summary: caseConfirmSummary(item, [
      ["Tipo seleccionado", payload.tipo_caso],
      ["Categoría", payload.categoria],
      ["Prioridad", payload.prioridad],
      ["Ruta", payload.ruta],
    ]),
    confirmText: "Clasificar caso",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/clasificar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso clasificado correctamente.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo clasificar", error.message, "danger");
      }
    },
  });
}

function openChangePriorityModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#changePriorityContext", caseSummary(item));
  setValue("#newPriority", item.priority || "Media");
  setValue("#priorityReasonType", "Riesgo SLA");
  setValue("#priorityComment", "Cambio de prioridad validado por supervisión.");

  const declaration = $("#priorityDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#changePriorityModal");
}

async function confirmChangePriority() {
  if (!requireValue("#newPriority", "nueva prioridad")) return;
  if (!requireValue("#priorityReasonType", "motivo")) return;
  if (!requireDeclaration("#priorityDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    prioridad: getValue("#newPriority"),
    motivo: getValue("#priorityReasonType"),
    comentario: getValue("#priorityComment") || "Cambio de prioridad validado por supervisión.",
  };

  confirmAction({
    icon: "🚩",
    eyebrow: "Cambio de prioridad",
    title: `¿Confirmas cambiar la prioridad del caso ${item.code}?`,
    text: "Esta acción modificará la atención operativa y quedará registrada en auditoría.",
    summary: caseConfirmSummary(item, [
      ["Prioridad anterior", item.priority],
      ["Nueva prioridad", payload.prioridad],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Cambiar prioridad",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/prioridad`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Prioridad actualizada correctamente.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo cambiar prioridad", error.message, "danger");
      }
    },
  });
}

function openSendToAssignmentModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#sendToAssignmentContext", caseSummary(item));
  setValue("#assignmentQueue", item.priority === "Crítica" ? "Cola crítica" : "Cola comercial");
  setValue("#assignmentSuggestion", "Asignar por menor carga, especialidad y riesgo SLA.");

  const declaration = $("#assignmentDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#sendToAssignmentModal");
}

async function confirmSendToAssignment() {
  if (!requireValue("#assignmentQueue", "cola de asignación")) return;
  if (!requireDeclaration("#assignmentDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    cola: getValue("#assignmentQueue"),
    sugerencia: getValue("#assignmentSuggestion") || "Asignar por menor carga.",
  };

  confirmAction({
    icon: "👥",
    eyebrow: "Enviar a asignación",
    title: `¿Confirmas enviar el caso ${item.code} a asignación?`,
    text: "El caso pasará a la bandeja de asignaciones para que se defina un asesor responsable.",
    summary: caseConfirmSummary(item, [
      ["Cola destino", payload.cola],
      ["Sugerencia", payload.sugerencia],
    ]),
    confirmText: "Enviar a asignación",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/enviar-asignacion`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso enviado a asignación.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo enviar a asignación", error.message, "danger");
      }
    },
  });
}

function openObserveCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#observeCaseContext", caseSummary(item));
  setValue("#observeReason", "Información insuficiente");
  setValue("#observeReturnTo", "Mesa de entrada");
  setValue("#observeComment", "Se requiere validar información antes de continuar.");

  const declaration = $("#observeDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#observeCaseModal");
}

async function confirmObserveCase() {
  if (!requireValue("#observeReason", "motivo de observación")) return;
  if (!requireValue("#observeReturnTo", "retorno")) return;
  if (!requireValue("#observeComment", "comentario")) return;
  if (!requireDeclaration("#observeDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    motivo: getValue("#observeReason"),
    retorno: getValue("#observeReturnTo"),
    comentario: getValue("#observeComment"),
  };

  confirmAction({
    icon: "🔎",
    eyebrow: "Observar caso",
    title: `¿Confirmas observar el caso ${item.code}?`,
    text: "El caso quedará observado y se registrará el motivo en trazabilidad.",
    summary: caseConfirmSummary(item, [
      ["Motivo", payload.motivo],
      ["Retorno", payload.retorno],
      ["Comentario", payload.comentario],
    ]),
    confirmText: "Observar caso",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/observar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso observado correctamente.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo observar", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   MODALES DE ASIGNACIÓN
========================================================= */

function openAssignAdvisorModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  populateAdvisorSelects();

  setHTML("#assignCaseContext", caseSummary(item));
  setValue("#assignAdvisorSelect", "");
  setValue("#assignQueueSelect", item.priority === "Crítica" ? "Cola crítica" : "Cola comercial");
  setValue("#assignCriterion", "Menor carga + especialidad");
  setValue("#assignVisibility", "Visible para asesor");
  setValue("#assignComment", "Asignación validada por supervisión.");

  const declaration = $("#assignDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#assignAdvisorModal");
}

function suggestAdvisorAssignment() {
  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const advisors = State.advisors
    .map(normalizeAdvisor)
    .filter((advisor) => lower(advisor.status).includes("disponible"))
    .sort((a, b) => {
      if (a.capacity !== b.capacity) return a.capacity - b.capacity;
      return a.cases - b.cases;
    });

  const selected = advisors[0];

  if (selected) {
    setValue("#assignAdvisorSelect", selected.id);
    setValue("#assignCriterion", "Menor carga + disponibilidad + especialidad");
    setValue(
      "#assignComment",
      `Sugerencia IA: ${selected.name} tiene menor carga visible y disponibilidad operativa.`
    );
    toast("Asesor sugerido", `Se sugirió asignar a ${selected.name}.`, "success");
  } else {
    toast("Sin asesor sugerido", "No se encontraron asesores disponibles.", "warning");
  }
}

async function confirmAssignAdvisor() {
  if (!requireValue("#assignAdvisorSelect", "asesor")) return;
  if (!requireValue("#assignQueueSelect", "cola")) return;
  if (!requireValue("#assignCriterion", "criterio")) return;
  if (!requireDeclaration("#assignDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const advisorId = getValue("#assignAdvisorSelect");
  const advisorName = advisorNameById(advisorId);

  const payload = {
    asesor_id: advisorId,
    cola: getValue("#assignQueueSelect"),
    criterio: getValue("#assignCriterion"),
    visibilidad: getValue("#assignVisibility"),
    comentario: getValue("#assignComment") || "Asignación validada por supervisión.",
  };

  confirmAction({
    icon: "👤",
    eyebrow: "Asignar asesor",
    title: `¿Confirmas asignar el caso ${item.code}?`,
    text: `El caso será asignado a ${advisorName} y se actualizará la carga del asesor.`,
    summary: caseConfirmSummary(item, [
      ["Asesor destino", advisorName],
      ["Cola", payload.cola],
      ["Criterio", payload.criterio],
    ]),
    confirmText: "Asignar asesor",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/asignar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso asignado correctamente.");
        State.cases = [];
        State.advisors = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo asignar", error.message, "danger");
      }
    },
  });
}

function openReassignCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);
  populateAdvisorSelects();

  setHTML("#reassignCaseContext", caseSummary(item));
  setValue("#reassignFromAdvisor", item.advisorId || "");
  setValue("#reassignToAdvisor", "");
  setValue("#reassignReason", "Sobrecarga del asesor");
  setValue("#reassignPriority", item.priority || "Media");
  setValue("#reassignComment", "Reasignación validada por supervisión.");

  const declaration = $("#reassignDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#reassignCaseModal");
}

function suggestReassignment() {
  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const advisors = State.advisors
    .map(normalizeAdvisor)
    .filter(
      (advisor) =>
        lower(advisor.status).includes("disponible") &&
        String(advisor.id) !== String(item.advisorId)
    )
    .sort((a, b) => a.capacity - b.capacity);

  const selected = advisors[0];

  if (selected) {
    setValue("#reassignToAdvisor", selected.id);
    setValue("#reassignReason", item.slaHours <= 8 ? "Riesgo SLA" : "Balance de carga");
    setValue(
      "#reassignComment",
      `Sugerencia IA: reasignar a ${selected.name} por menor carga visible.`
    );
    toast("Reasignación sugerida", `Se sugirió reasignar a ${selected.name}.`, "success");
  } else {
    toast("Sin asesor alternativo", "No se encontró un asesor disponible para reasignar.", "warning");
  }
}

async function confirmReassignCase() {
  if (!requireValue("#reassignToAdvisor", "asesor destino")) return;
  if (!requireValue("#reassignReason", "motivo")) return;
  if (!requireDeclaration("#reassignDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const fromAdvisor = getValue("#reassignFromAdvisor") || item.advisorId || "";
  const toAdvisor = getValue("#reassignToAdvisor");

  if (fromAdvisor && String(fromAdvisor) === String(toAdvisor)) {
    toast("Reasignación inválida", "El asesor origen y destino no pueden ser el mismo.", "warning");
    return;
  }

  const payload = {
    asesor_origen_id: fromAdvisor,
    asesor_destino_id: toAdvisor,
    motivo: getValue("#reassignReason"),
    prioridad: getValue("#reassignPriority") || item.priority,
    comentario: getValue("#reassignComment") || "Reasignación validada por supervisión.",
  };

  confirmAction({
    icon: "🔁",
    eyebrow: "Reasignar caso",
    title: `¿Confirmas reasignar el caso ${item.code}?`,
    text: `El caso pasará de ${item.advisorName} hacia ${advisorNameById(toAdvisor)}.`,
    summary: caseConfirmSummary(item, [
      ["Asesor origen", advisorNameById(fromAdvisor) || item.advisorName],
      ["Asesor destino", advisorNameById(toAdvisor)],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Reasignar",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/reasignar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso reasignado correctamente.");
        State.cases = [];
        State.advisors = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo reasignar", error.message, "danger");
      }
    },
  });
}

function openDeriveAreaModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#deriveAreaContext", caseSummary(item));
  setValue("#deriveAreaSelect", item.area || "Soporte técnico");
  setValue("#deriveAreaSla", item.priority === "Crítica" ? "4 horas" : "8 horas");
  setValue("#deriveAreaReason", "Requiere atención de área especializada");
  setValue("#deriveAreaComment", "Derivación validada por supervisión.");

  const declaration = $("#deriveAreaDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#deriveAreaModal");
}

async function confirmDeriveArea() {
  if (!requireValue("#deriveAreaSelect", "área destino")) return;
  if (!requireValue("#deriveAreaSla", "SLA interno")) return;
  if (!requireValue("#deriveAreaReason", "motivo")) return;
  if (!requireDeclaration("#deriveAreaDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    area_destino: getValue("#deriveAreaSelect"),
    sla_interno: getValue("#deriveAreaSla"),
    motivo: getValue("#deriveAreaReason"),
    comentario: getValue("#deriveAreaComment") || "Derivación validada por supervisión.",
  };

  confirmAction({
    icon: "🧭",
    eyebrow: "Derivar caso",
    title: `¿Confirmas derivar el caso ${item.code}?`,
    text: `El caso será enviado al área ${payload.area_destino} con SLA interno ${payload.sla_interno}.`,
    summary: caseConfirmSummary(item, [
      ["Área destino", payload.area_destino],
      ["SLA interno", payload.sla_interno],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Derivar caso",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/derivar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso derivado correctamente.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo derivar", error.message, "danger");
      }
    },
  });
}

function openEscalateCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#escalateCaseContext", caseSummary(item));
  setValue("#escalateLevel", item.priority === "Crítica" ? "Mesa crítica" : "Supervisor senior");
  setValue("#escalateReason", item.slaHours <= 0 ? "SLA vencido" : "Riesgo SLA");
  setValue("#escalateComment", "Escalamiento validado por supervisión.");

  const declaration = $("#escalateDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#escalateCaseModal");
}

async function confirmEscalateCase() {
  if (!requireValue("#escalateLevel", "nivel de escalamiento")) return;
  if (!requireValue("#escalateReason", "motivo")) return;
  if (!requireDeclaration("#escalateDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    nivel: getValue("#escalateLevel"),
    motivo: getValue("#escalateReason"),
    comentario: getValue("#escalateComment") || "Escalamiento validado por supervisión.",
  };

  confirmAction({
    icon: "🚨",
    eyebrow: "Escalar caso",
    title: `¿Confirmas escalar el caso ${item.code}?`,
    text: `Se notificará a ${payload.nivel} y la acción quedará registrada en auditoría.`,
    summary: caseConfirmSummary(item, [
      ["Nivel", payload.nivel],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Escalar caso",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/escalar`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Caso escalado correctamente.");
        State.cases = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo escalar", error.message, "danger");
      }
    },
  });
}

function openMassAssignmentModal() {
  populateAdvisorSelects();

  setValue("#massAssignmentScope", "Casos sin asesor");
  setValue("#massAssignmentCriteria", "Menor carga + especialidad + SLA");
  const declaration = $("#massAssignmentDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#massAssignmentModal");
}

async function confirmMassAssignment() {
  if (!requireValue("#massAssignmentScope", "alcance")) return;
  if (!requireValue("#massAssignmentCriteria", "criterio")) return;
  if (!requireDeclaration("#massAssignmentDeclaration")) return;

  const payload = {
    alcance: getValue("#massAssignmentScope"),
    criterio: getValue("#massAssignmentCriteria"),
  };

  confirmAction({
    icon: "⚙️",
    eyebrow: "Asignación masiva",
    title: "¿Confirmas ejecutar asignación masiva?",
    text: "El sistema distribuirá casos según el alcance y criterio seleccionado.",
    summary: summaryHTML([
      ["Alcance", payload.alcance],
      ["Criterio", payload.criterio],
    ]),
    confirmText: "Ejecutar asignación",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/casos/asignacion-masiva", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Asignación masiva ejecutada.");
        State.cases = [];
        State.advisors = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo ejecutar asignación masiva", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   MODALES DE CARGA DE ASESORES
========================================================= */

function openAdvisorDetailModal(id) {
  const advisor = getAdvisor(id);
  if (!advisor) return;

  saveSelectedAdvisor(id);

  setText("#advisorDetailIcon", advisor.initials);
  setText("#advisorDetailTitle", advisor.name);
  setText("#advisorDetailText", `${advisor.specialty} · ${advisor.status}`);
  setHTML("#advisorDetailSummary", advisorSummary(advisor));

  openModal("#advisorDetailModal");
}

function openRedistributeLoadModal() {
  populateAdvisorSelects();

  if (State.selectedAdvisorId) {
    setValue("#redistributeFromAdvisor", State.selectedAdvisorId);
  }

  setValue("#redistributeToAdvisor", "");
  setValue("#redistributeCasesCount", "1");
  setValue("#redistributeCriteria", "Menor SLA");
  const declaration = $("#redistributeDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#redistributeLoadModal");
}

async function confirmRedistributeLoad() {
  if (!requireValue("#redistributeFromAdvisor", "asesor origen")) return;
  if (!requireValue("#redistributeToAdvisor", "asesor destino")) return;
  if (!requireValue("#redistributeCasesCount", "cantidad de casos")) return;
  if (!requireValue("#redistributeCriteria", "criterio de redistribución")) return;
  if (!requireDeclaration("#redistributeDeclaration")) return;

  const from = getValue("#redistributeFromAdvisor");
  const to = getValue("#redistributeToAdvisor");
  const count = asNumber(getValue("#redistributeCasesCount"), 0);

  if (String(from) === String(to)) {
    toast("Redistribución inválida", "El asesor origen y destino no pueden ser el mismo.", "warning");
    return;
  }

  if (count <= 0) {
    toast("Cantidad inválida", "La cantidad de casos debe ser mayor a cero.", "warning");
    return;
  }

  const payload = {
    asesor_origen_id: from,
    asesor_destino_id: to,
    cantidad: count,
    criterio: getValue("#redistributeCriteria"),
  };

  confirmAction({
    icon: "⚖️",
    eyebrow: "Redistribuir carga",
    title: "¿Confirmas redistribuir carga entre asesores?",
    text: `Se moverán ${count} casos de ${advisorNameById(from)} hacia ${advisorNameById(to)}.`,
    summary: summaryHTML([
      ["Asesor origen", advisorNameById(from)],
      ["Asesor destino", advisorNameById(to)],
      ["Cantidad", count],
      ["Criterio", payload.criterio],
    ]),
    confirmText: "Redistribuir",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/asesores/redistribuir", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Carga redistribuida correctamente.");
        State.cases = [];
        State.advisors = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo redistribuir", error.message, "danger");
      }
    },
  });
}

function openAdvisorAvailabilityModal(id) {
  const advisor = getAdvisor(id);
  if (!advisor) return;

  saveSelectedAdvisor(id);

  setHTML("#advisorAvailabilityContext", advisorSummary(advisor));
  setValue("#advisorAvailabilityStatus", advisor.status || "Disponible");
  setValue("#advisorAvailabilityReason", "Actualización operativa");
  setValue("#advisorAvailabilityComment", "Cambio de disponibilidad validado por supervisión.");

  const declaration = $("#advisorAvailabilityDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#advisorAvailabilityModal");
}

async function confirmAdvisorAvailability() {
  if (!requireValue("#advisorAvailabilityStatus", "estado de disponibilidad")) return;
  if (!requireValue("#advisorAvailabilityReason", "motivo")) return;
  if (!requireDeclaration("#advisorAvailabilityDeclaration")) return;

  const advisor = getAdvisor(State.selectedAdvisorId);
  if (!advisor) return;

  const payload = {
    estado: getValue("#advisorAvailabilityStatus"),
    motivo: getValue("#advisorAvailabilityReason"),
    comentario: getValue("#advisorAvailabilityComment") || "Cambio de disponibilidad validado por supervisión.",
  };

  confirmAction({
    icon: "🧍",
    eyebrow: "Disponibilidad de asesor",
    title: `¿Confirmas cambiar la disponibilidad de ${advisor.name}?`,
    text: "El estado afectará la asignación automática y manual de casos.",
    summary: summaryHTML([
      ["Asesor", advisor.name],
      ["Estado anterior", advisor.status],
      ["Nuevo estado", payload.estado],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Actualizar disponibilidad",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/asesores/${State.selectedAdvisorId}/disponibilidad`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Disponibilidad actualizada.");
        State.advisors = [];
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo actualizar disponibilidad", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   MODALES SLA
========================================================= */

function openSendSlaAlertModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#sendSlaAlertContext", caseSummary(item));
  setValue("#slaAlertTarget", item.advisorName || "Asesor responsable");
  setValue("#slaAlertChannel", "Notificación interna");
  setValue(
    "#slaAlertMessage",
    `Alerta SLA: el caso ${item.code} presenta ${item.slaRisk}. Priorizar atención y registrar avance.`
  );

  const declaration = $("#slaAlertDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#sendSlaAlertModal");
}

async function confirmSlaAlert() {
  if (!requireValue("#slaAlertTarget", "destinatario")) return;
  if (!requireValue("#slaAlertChannel", "canal")) return;
  if (!requireValue("#slaAlertMessage", "mensaje")) return;
  if (!requireDeclaration("#slaAlertDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    destinatario: getValue("#slaAlertTarget"),
    canal: getValue("#slaAlertChannel"),
    mensaje: getValue("#slaAlertMessage"),
  };

  confirmAction({
    icon: "⏱️",
    eyebrow: "Alerta SLA",
    title: `¿Confirmas enviar alerta por el caso ${item.code}?`,
    text: "La alerta será registrada en trazabilidad y enviada al responsable indicado.",
    summary: caseConfirmSummary(item, [
      ["Destinatario", payload.destinatario],
      ["Canal", payload.canal],
      ["Mensaje", payload.mensaje],
    ]),
    confirmText: "Enviar alerta",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/alerta-sla`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Alerta SLA enviada.");
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo enviar alerta", error.message, "danger");
      }
    },
  });
}

function openSlaFollowModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(id);

  setHTML("#slaSupervisorFollowContext", caseSummary(item));
  setValue("#slaFollowAction", "Seguimiento preventivo");
  setValue("#slaFollowResult", "Responsable notificado");
  setValue("#slaFollowComment", "Se registra seguimiento por riesgo SLA.");

  const declaration = $("#slaFollowDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#slaSupervisorFollowModal");
}

async function confirmSlaFollow() {
  if (!requireValue("#slaFollowAction", "acción realizada")) return;
  if (!requireValue("#slaFollowResult", "resultado")) return;
  if (!requireValue("#slaFollowComment", "comentario")) return;
  if (!requireDeclaration("#slaFollowDeclaration")) return;

  const item = getCase(State.selectedCaseId);
  if (!item) return;

  const payload = {
    accion: getValue("#slaFollowAction"),
    resultado: getValue("#slaFollowResult"),
    comentario: getValue("#slaFollowComment"),
  };

  confirmAction({
    icon: "📝",
    eyebrow: "Seguimiento SLA",
    title: `¿Confirmas registrar seguimiento del caso ${item.code}?`,
    text: "El seguimiento quedará registrado en el historial operativo del caso.",
    summary: caseConfirmSummary(item, [
      ["Acción", payload.accion],
      ["Resultado", payload.resultado],
      ["Comentario", payload.comentario],
    ]),
    confirmText: "Registrar seguimiento",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/casos/${State.selectedCaseId}/seguimiento-sla`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Seguimiento SLA registrado.");
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudo registrar seguimiento", error.message, "danger");
      }
    },
  });
}

function openMassSlaAlertModal() {
  const riskyCases = slaFilteredCases().filter((c) => c.slaHours <= 8);

  confirmAction({
    icon: "📣",
    eyebrow: "Alertas SLA masivas",
    title: "¿Confirmas enviar alertas SLA masivas?",
    text: "Se notificará a los responsables de los casos vencidos o en riesgo alto dentro del filtro actual.",
    summary: summaryHTML([
      ["Casos en riesgo", riskyCases.length],
      ["Filtro actual", State.slaFilter],
      ["Criterio", "SLA vencido o menor a 8 horas"],
    ]),
    confirmText: "Enviar alertas",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/casos/alerta-sla-masiva", {
          method: "POST",
          body: JSON.stringify({
            filtro: State.slaFilter,
            case_ids: riskyCases.map((c) => c.id),
          }),
        });

        closeOperationalModals();
        confirmToast(response.message || "Alertas SLA masivas enviadas.");
        await refreshCurrentPage();
      } catch (error) {
        toast("No se pudieron enviar alertas", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   MODALES INDICADORES
========================================================= */

function openIndicatorDetailModal(id) {
  const indicator = getIndicator(id);
  if (!indicator) return;

  saveSelectedIndicator(id);

  setText("#indicatorDetailIcon", indicator.icon);
  setText("#indicatorDetailTitle", indicator.title);
  setText("#indicatorDetailText", indicator.description || "Indicador operativo de supervisión.");
  setHTML(
    "#indicatorDetailSummary",
    summaryHTML([
      ["Valor actual", indicator.value],
      ["Meta", indicator.target],
      ["Tendencia", indicator.trend],
      ["Estado", indicator.status],
      ["Avance", `${indicator.progress}%`],
      ["Causa probable", indicator.cause || "Sin causa registrada"],
    ])
  );

  const related = Array.isArray(indicator.relatedCases) ? indicator.relatedCases : [];

  setHTML(
    "#indicatorRelatedCases",
    related.length
      ? related
          .map(
            (item) => `
              <article class="case-mini-card">
                <strong>${esc(item.code || item.codigo || item.caseId || "Caso")}</strong>
                <p>${esc(item.text || item.descripcion || item.estado || "")}</p>
              </article>
            `
          )
          .join("")
      : `<p class="muted">No hay casos relacionados registrados para este indicador.</p>`
  );

  openModal("#indicatorDetailModal");
}

/* =========================================================
   MODALES CONFIGURACIÓN
========================================================= */

function openEditConfigRuleModal(id) {
  const rule = getConfigRule(id);
  if (!rule) return;

  saveSelectedConfigRule(id);

  setHTML(
    "#editConfigRuleContext",
    summaryHTML([
      ["Regla", rule.title],
      ["Categoría", rule.category],
      ["Valor actual", rule.value],
      ["Estado", rule.status],
      ["Descripción", rule.description],
    ])
  );

  setValue("#configRuleValue", rule.value);
  setValue("#configRuleStatus", rule.status || "Activo");
  setValue("#configRuleReason", "Actualización validada por supervisión.");

  const declaration = $("#configRuleDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#editConfigRuleModal");
}

async function confirmEditConfigRule() {
  if (!requireValue("#configRuleValue", "valor de la regla")) return;
  if (!requireValue("#configRuleStatus", "estado")) return;
  if (!requireValue("#configRuleReason", "motivo")) return;
  if (!requireDeclaration("#configRuleDeclaration")) return;

  const rule = getConfigRule(State.selectedConfigRuleId);
  if (!rule) return;

  const payload = {
    valor: getValue("#configRuleValue"),
    estado: getValue("#configRuleStatus"),
    motivo: getValue("#configRuleReason"),
  };

  confirmAction({
    icon: "⚙️",
    eyebrow: "Editar regla",
    title: `¿Confirmas actualizar la regla ${rule.title}?`,
    text: "El nuevo valor afectará la lógica operativa del módulo Supervisor.",
    summary: summaryHTML([
      ["Regla", rule.title],
      ["Valor anterior", rule.value],
      ["Nuevo valor", payload.valor],
      ["Estado", payload.estado],
      ["Motivo", payload.motivo],
    ]),
    confirmText: "Actualizar regla",
    onConfirm: async () => {
      try {
        const response = await apiRequest(`/supervisor/configuracion/reglas/${State.selectedConfigRuleId}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Regla actualizada correctamente.");
        await renderConfig();
      } catch (error) {
        toast("No se pudo actualizar regla", error.message, "danger");
      }
    },
  });
}

function openPriorityMatrixModal() {
  const values = State.priorityMatrix || [];

  setValue("#priorityImpactWeight", values.find((v) => lower(v.title || v.nombre).includes("impacto"))?.weight || "35");
  setValue("#priorityUrgencyWeight", values.find((v) => lower(v.title || v.nombre).includes("urgencia"))?.weight || "30");
  setValue("#prioritySlaWeight", values.find((v) => lower(v.title || v.nombre).includes("sla"))?.weight || "25");
  setValue("#priorityClientWeight", values.find((v) => lower(v.title || v.nombre).includes("cliente"))?.weight || "10");

  const declaration = $("#priorityMatrixDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#priorityMatrixModal");
}

async function confirmPriorityMatrix() {
  if (!requireValue("#priorityImpactWeight", "peso impacto")) return;
  if (!requireValue("#priorityUrgencyWeight", "peso urgencia")) return;
  if (!requireValue("#prioritySlaWeight", "peso SLA")) return;
  if (!requireValue("#priorityClientWeight", "peso cliente")) return;
  if (!requireDeclaration("#priorityMatrixDeclaration")) return;

  const impacto = asNumber(getValue("#priorityImpactWeight"), 0);
  const urgencia = asNumber(getValue("#priorityUrgencyWeight"), 0);
  const sla = asNumber(getValue("#prioritySlaWeight"), 0);
  const cliente = asNumber(getValue("#priorityClientWeight"), 0);
  const total = impacto + urgencia + sla + cliente;

  if (total !== 100) {
    toast("Pesos inválidos", "La suma de pesos debe ser exactamente 100%.", "warning");
    return;
  }

  const payload = {
    impacto,
    urgencia,
    sla,
    cliente,
  };

  confirmAction({
    icon: "🧮",
    eyebrow: "Matriz de prioridad",
    title: "¿Confirmas actualizar la matriz de prioridad?",
    text: "La nueva matriz afectará la clasificación sugerida de casos.",
    summary: summaryHTML([
      ["Impacto", `${impacto}%`],
      ["Urgencia", `${urgencia}%`],
      ["SLA", `${sla}%`],
      ["Cliente", `${cliente}%`],
      ["Total", `${total}%`],
    ]),
    confirmText: "Guardar matriz",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/configuracion/matriz-prioridad", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Matriz de prioridad actualizada.");
        await renderConfig();
      } catch (error) {
        toast("No se pudo guardar matriz", error.message, "danger");
      }
    },
  });
}

function openSimulatePriorityModal() {
  setValue("#simulateImpact", "Medio");
  setValue("#simulateUrgency", "Media");
  setValue("#simulateSla", "Dentro de SLA");
  setValue("#simulateClientType", "Residencial");
  setHTML("#simulatePriorityResult", `<p class="muted">Completa los criterios y presiona “Simular”.</p>`);
  openModal("#simulatePriorityModal");
}

function simulatePriority() {
  const impact = getValue("#simulateImpact");
  const urgency = getValue("#simulateUrgency");
  const sla = getValue("#simulateSla");
  const client = getValue("#simulateClientType");

  if (!impact || !urgency || !sla || !client) {
    toast("Datos incompletos", "Completa impacto, urgencia, SLA y tipo de cliente.", "warning");
    return;
  }

  let score = 0;

  if (["Alto", "Masivo", "Crítico"].some((word) => lower(impact).includes(lower(word)))) score += 35;
  else if (lower(impact).includes("medio")) score += 22;
  else score += 10;

  if (lower(urgency).includes("alta") || lower(urgency).includes("inmediata")) score += 30;
  else if (lower(urgency).includes("media")) score += 18;
  else score += 8;

  if (lower(sla).includes("vencido")) score += 25;
  else if (lower(sla).includes("riesgo") || lower(sla).includes("próximo") || lower(sla).includes("proximo")) score += 18;
  else score += 5;

  if (lower(client).includes("empresa") || lower(client).includes("corporativo") || lower(client).includes("vip")) score += 10;
  else score += 4;

  const priority =
    score >= 80
      ? "Crítica"
      : score >= 60
      ? "Alta"
      : score >= 35
      ? "Media"
      : "Baja";

  setHTML(
    "#simulatePriorityResult",
    `
      <div class="case-modal-summary">
        ${summaryHTML([
          ["Puntaje", `${score}/100`],
          ["Prioridad sugerida", priority],
          ["Impacto", impact],
          ["Urgencia", urgency],
          ["SLA", sla],
          ["Cliente", client],
        ])}
      </div>
    `
  );

  toast("Simulación completada", `La prioridad sugerida es ${priority}.`, "success");
}

function openRouteRuleModal() {
  saveSelectedRouteRule(null);

  setValue("#routeRuleName", "");
  setValue("#routeRuleCondition", "");
  setValue("#routeRuleArea", "Soporte técnico");
  setValue("#routeRuleSla", "8 horas");

  const declaration = $("#routeRuleDeclaration");
  if (declaration) declaration.checked = false;

  openModal("#routeRuleModal");
}

async function confirmRouteRule() {
  if (!requireValue("#routeRuleName", "nombre de ruta")) return;
  if (!requireValue("#routeRuleCondition", "condición")) return;
  if (!requireValue("#routeRuleArea", "área destino")) return;
  if (!requireValue("#routeRuleSla", "SLA interno")) return;
  if (!requireDeclaration("#routeRuleDeclaration")) return;

  const payload = {
    nombre: getValue("#routeRuleName"),
    condicion: getValue("#routeRuleCondition"),
    area_destino: getValue("#routeRuleArea"),
    sla_interno: getValue("#routeRuleSla"),
  };

  confirmAction({
    icon: "🧭",
    eyebrow: "Ruta de derivación",
    title: "¿Confirmas guardar la ruta de derivación?",
    text: "La ruta podrá utilizarse en clasificación, derivación y escalamiento.",
    summary: summaryHTML([
      ["Ruta", payload.nombre],
      ["Condición", payload.condicion],
      ["Área destino", payload.area_destino],
      ["SLA interno", payload.sla_interno],
    ]),
    confirmText: "Guardar ruta",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/configuracion/rutas", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        closeOperationalModals();
        confirmToast(response.message || "Ruta guardada correctamente.");
        await renderConfig();
      } catch (error) {
        toast("No se pudo guardar ruta", error.message, "danger");
      }
    },
  });
}

async function validateRoutes() {
  confirmAction({
    icon: "🧪",
    eyebrow: "Validar rutas",
    title: "¿Deseas validar las rutas de supervisión?",
    text: "Se revisará si las rutas tienen condición, área destino y SLA interno definido.",
    summary: summaryHTML([
      ["Rutas cargadas", State.routeRules.length],
      ["Validación", "Condición + área destino + SLA interno"],
    ]),
    confirmText: "Validar rutas",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/configuracion/rutas/validar", {
          method: "POST",
          body: JSON.stringify({
            rutas: State.routeRules,
          }),
        });

        closeModals();
        genericModal(
          "✅",
          "Validación completada",
          response.message || "Las rutas fueron validadas correctamente. No se detectaron inconsistencias críticas."
        );
      } catch (error) {
        toast("No se pudo validar rutas", error.message, "danger");
      }
    },
  });
}

async function confirmSaveConfig() {
  if (!requireDeclaration("#confirmConfigSaveDeclaration")) return;

  confirmAction({
    icon: "💾",
    eyebrow: "Guardar configuración",
    title: "¿Confirmas guardar la configuración de supervisión?",
    text: "Los nuevos parámetros afectarán asignación, prioridad, SLA, escalamiento y rutas operativas.",
    summary: summaryHTML([
      ["Reglas", State.configRules.length],
      ["Rutas", State.routeRules.length],
      ["Matriz", State.priorityMatrix.length],
    ]),
    confirmText: "Guardar configuración",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/configuracion/guardar", {
          method: "POST",
          body: JSON.stringify({
            reglas: State.configRules,
            rutas: State.routeRules,
            matriz_prioridad: State.priorityMatrix,
          }),
        });

        closeOperationalModals();
        confirmToast(response.message || "Configuración guardada correctamente.");
        await renderConfig();
      } catch (error) {
        toast("No se pudo guardar configuración", error.message, "danger");
      }
    },
  });
}

function confirmRestoreConfig() {
  confirmAction({
    icon: "♻️",
    eyebrow: "Restaurar configuración",
    title: "¿Confirmas restaurar la configuración?",
    text: "Se restaurarán los parámetros por defecto del módulo Supervisor. Esta acción quedará registrada en auditoría.",
    summary: summaryHTML([
      ["Reglas actuales", State.configRules.length],
      ["Rutas actuales", State.routeRules.length],
      ["Acción", "Restaurar valores por defecto"],
    ]),
    confirmText: "Restaurar",
    onConfirm: async () => {
      try {
        const response = await apiRequest("/supervisor/configuracion/restaurar", {
          method: "POST",
          body: JSON.stringify({ confirmacion: true }),
        });

        closeOperationalModals();
        confirmToast(response.message || "Configuración restaurada correctamente.");
        await renderConfig();
      } catch (error) {
        toast("No se pudo restaurar configuración", error.message, "danger");
      }
    },
  });
}

/* =========================================================
   EXPORTACIÓN CSV SIMPLE
========================================================= */

function exportCurrentTable(name = "export") {
  const tables = $$("table");
  const table = tables.find((item) => item.offsetParent !== null) || tables[0];

  if (!table) {
    toast("Sin datos para exportar", "No se encontró una tabla visible.", "warning");
    return;
  }

  const rows = $$("tr", table).map((tr) =>
    $$("th,td", tr)
      .map((cell) => `"${cell.textContent.replaceAll('"', '""').trim()}"`)
      .join(",")
  );

  downloadCsv(`${name}.csv`, rows.join("\n"));
}

function exportRowsAsCsv(name, rows = []) {
  if (!rows.length) {
    toast("Sin datos", "No hay información para exportar.", "warning");
    return;
  }

  const keys = Object.keys(rows[0]);
  const csv = [
    keys.map((key) => `"${key}"`).join(","),
    ...rows.map((row) =>
      keys
        .map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`)
        .join(",")
    ),
  ].join("\n");

  downloadCsv(`${name}.csv`, csv);
}

function downloadCsv(filename, csv) {
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  toast("Exportación lista", `Se generó ${filename}.`, "success");
}

/* =========================================================
   REFRESH POR PÁGINA
========================================================= */

async function refreshCurrentPage() {
  await refreshGlobalBadges();

  switch (State.page) {
    case "supervisor-dashboard":
      await renderDashboard();
      break;

    case "supervisor-casos-pendientes":
      await renderPendingCases();
      break;

    case "supervisor-asignaciones":
      await renderAssignments();
      break;

    case "supervisor-carga-asesores":
      await renderAdvisorLoad();
      break;

    case "supervisor-monitoreo-sla":
      await renderSlaMonitor();
      break;

    case "supervisor-indicadores":
      await renderIndicators();
      break;

    case "supervisor-reportes":
      await renderReports();
      break;

    case "supervisor-auditoria":
      await renderAudit();
      break;

    case "supervisor-configuracion":
      await renderConfig();
      break;

    default:
      break;
  }
}

/* =========================================================
   INIT GENERAL
========================================================= */

async function initSupervisorApp() {
  applyTheme(State.theme);

  if (!requireSupervisorSession()) return;

  setupBaseUI();
  setupUserFromStorage();
  setupSearch();
  setupBot();
  ensureConfirmModal();

  try {
    await loadShellData();
  } catch (error) {
    toast("Sesión local activa", error.message, "warning");
  }

  try {
    switch (State.page) {
      case "supervisor-dashboard":
        await initDashboard();
        break;

      case "supervisor-casos-pendientes":
        await initPendingCases();
        break;

      case "supervisor-asignaciones":
        await initAssignments();
        break;

      case "supervisor-carga-asesores":
        await initAdvisorLoad();
        break;

      case "supervisor-monitoreo-sla":
        await initSlaMonitor();
        break;

      case "supervisor-indicadores":
        await initIndicators();
        break;

      case "supervisor-reportes":
        await initReports();
        break;

      case "supervisor-auditoria":
        await initAudit();
        break;

      case "supervisor-configuracion":
        await initConfig();
        break;

      default:
        toast("Pantalla no identificada", "No se reconoció el data-page de esta vista.", "warning");
        break;
    }
  } catch (error) {
    toast("Error de inicialización", error.message, "danger");
  }
}

document.addEventListener("DOMContentLoaded", initSupervisorApp);

/* =========================================================
   FIX CRÍTICO - DATASTORE BASE
   Debe ir ANTES del parche profesional.
   Evita error: Mock is not defined.
========================================================= */

globalThis.Mock = globalThis.Mock || {
  supervisor: {
    id: "SUP-001",
    name: "Supervisor",
    initials: "SU",
    role: "Supervisor de Atención",
    status: "Supervisión activa",
    lastUpdate: "Actualizado ahora"
  },
  advisors: [],
  cases: [],
  indicators: [],
  reports: [],
  audit: [],
  configRules: [],
  routeRules: []
};

/* =========================================================
   PARCHE PROFESIONAL SUPERVISOR - INTEGRACIÓN REAL
   Pegar al FINAL de frontend/assets/js/supervisor.js

   Corrige:
   - Dashboard sin modales operativos inexistentes
   - Redirección profesional entre módulos
   - Carga desde backend /api/supervisor con fallback seguro
   - Endpoints reales del backend
   - Indicadores / desempeño de asesores
   - Exportaciones Excel más limpias
   - Deep links entre pantallas: ?case=<id>&action=<accion>
========================================================= */

const SP_API_BASE = "http://127.0.0.1:8000/api";

const SP_Data = {
  backendReady: false,
  warningShown: false,
  fallbackReady: true,
  dashboard: null,
  indicatorResponse: null,
  reportResponse: null,
  auditResponse: null,
  configResponse: null,
  advisorPerformance: [],
};

function SP_token() {
  return (
    localStorage.getItem("claro360-access-token") ||
    localStorage.getItem("claro360-token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

async function SP_api(endpoint, options = {}) {
  const token = SP_token();

  const response = await fetch(`${SP_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const msg =
      typeof data.detail === "string"
        ? data.detail
        : data.message || `Error HTTP ${response.status}`;

    throw new Error(msg);
  }

  SP_Data.backendReady = true;
  return data;
}

function SP_warnBackend(error) {
  if (SP_Data.warningShown) return;

  SP_Data.warningShown = true;

  console.warn("Backend Supervisor no disponible:", error);

  toast(
    "Modo local activado",
    "No se pudo conectar con el backend de Supervisor. Se mostrará información local mientras se valida la conexión.",
    "warning"
  );
}

function SP_cleanText(value) {
  return String(value ?? "").trim();
}

function SP_lower(value) {
  return SP_cleanText(value).toLowerCase();
}

function SP_dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function SP_toArray(data, ...keys) {
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function SP_number(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function SP_initials(name) {
  return (
    SP_cleanText(name)
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "SU"
  );
}

function SP_normalizeCase(item = {}) {
  const id = item.id ?? item.caso_id ?? item.case_id ?? item.codigo_caso ?? item.codigo;
  const code = item.code ?? item.codigo_caso ?? item.codigo ?? id;
  const priority = item.priority ?? item.prioridad ?? "Media";
  const status = item.status ?? item.estado ?? "Registrado";
  const advisorId = item.advisorId ?? item.asesor_id ?? item.responsable_actual_usuario_id ?? null;
  const advisorName = item.advisorName ?? item.asesor_nombre ?? item.responsable ?? "Sin asignar";
  const type = item.type ?? item.tipo_caso ?? item.tipo ?? "Reclamo";
  const hours = SP_number(item.slaHours ?? item.sla_hours ?? item.horas_sla, 999);

  return {
    ...item,
    id: String(id ?? code ?? ""),
    code: String(code ?? id ?? ""),
    icon: item.icon || (priority === "Crítica" ? "🔥" : type === "Incidencia" ? "⚠️" : "📝"),
    type,
    category: item.category ?? item.categoria ?? "General",
    clientName: item.clientName ?? item.cliente_nombre ?? item.cliente ?? "Cliente",
    clientType: item.clientType ?? item.tipo_cliente ?? "Cliente",
    channel: item.channel ?? item.canal ?? "Portal cliente",
    service: item.service ?? item.servicio ?? item.plan_nombre ?? "Servicio asociado",
    title: item.title ?? item.titulo ?? String(code ?? id ?? "Caso"),
    description: item.description ?? item.descripcion ?? "",
    status,
    classificationStatus:
      item.classificationStatus ??
      item.estado_clasificacion ??
      (type ? "Clasificado" : "Sin clasificar"),
    assignmentStatus:
      item.assignmentStatus ??
      item.estado_asignacion ??
      (advisorId ? "Asignado" : "Sin asesor"),
    assignmentFlow:
      item.assignmentFlow ??
      item.flujo_asignacion ??
      (advisorId ? "Asignado" : "Pendiente asignación"),
    advisorId: advisorId ? String(advisorId) : null,
    advisorName,
    area: item.area ?? item.area_nombre ?? "Mesa de entrada",
    priority,
    slaHours: hours,
    slaText:
      item.slaText ??
      item.sla ??
      (hours < 0 ? "Vencido" : hours === 999 ? "Sin plazo" : `${hours}h restantes`),
    slaRisk:
      item.slaRisk ??
      item.riesgo_sla ??
      (hours < 0
        ? "Vencido"
        : hours <= 8
          ? "Riesgo alto"
          : hours <= 24
            ? "Riesgo medio"
            : "Controlado"),
    slaGroup:
      item.slaGroup ??
      item.sla_group ??
      (hours < 0 ? "vencido" : hours <= 8 ? "vence_hoy" : hours <= 24 ? "vence_manana" : "semana"),
    riskType: item.riskType ?? item.tipo_riesgo ?? "todos",
    pendingType: item.pendingType ?? item.tipo_pendiente ?? "todos",
    blocked: Boolean(item.blocked ?? item.bloqueado ?? SP_lower(status).includes("pendiente")),
    escalated: Boolean(item.escalated ?? item.escalado ?? SP_lower(status).includes("escal")),
    derived: Boolean(item.derived ?? item.derivado ?? SP_lower(status).includes("deriv")),
    observed: Boolean(item.observed ?? item.observado ?? SP_lower(status).includes("observ")),
    action: item.action ?? item.proximo_paso ?? "Revisar caso y registrar decisión.",
    reason: item.reason ?? item.motivo ?? item.description ?? item.descripcion ?? "",
  };
}

function SP_normalizeAdvisor(item = {}) {
  const name = item.name ?? item.nombre ?? item.asesor ?? item.username ?? "Asesor";
  const cases = SP_number(item.cases ?? item.casos ?? item.casos_asignados, 0);
  const critical = SP_number(item.critical ?? item.criticos ?? item.casos_criticos, 0);
  const slaRisk = SP_number(item.slaRisk ?? item.riesgo_sla ?? item.casos_sla_riesgo, 0);
  const capacity = SP_number(item.capacity ?? item.capacidad, Math.min(100, cases * 7));
  const status = item.status ?? item.estado ?? (capacity >= 90 ? "Sobrecargado" : "Disponible");

  return {
    ...item,
    id: String(item.id ?? item.usuario_id ?? item.asesor_id ?? name),
    name,
    initials: item.initials ?? item.iniciales ?? SP_initials(name),
    specialty: item.specialty ?? item.especialidad ?? item.area_nombre ?? item.cargo ?? "Atención al Cliente",
    status,
    userStatus: item.estado_usuario ?? item.userStatus ?? item.estado ?? "ACTIVO",
    cases,
    critical,
    slaRisk,
    productivity: SP_number(item.productivity ?? item.productividad, 0),
    capacity,
    email: item.email ?? item.correo ?? "",
  };
}

function SP_normalizeIndicator(item = {}) {
  return {
    ...item,
    id: String(item.id ?? item.indicador_id ?? item.title ?? item.titulo ?? "indicador"),
    icon: item.icon ?? item.icono ?? "📈",
    title: item.title ?? item.titulo ?? item.nombre ?? "Indicador",
    value: item.value ?? item.valor ?? 0,
    target: item.target ?? item.meta ?? "-",
    trend: item.trend ?? item.tendencia ?? "-",
    status: item.status ?? item.estado ?? "info",
    progress: SP_number(item.progress ?? item.avance ?? item.porcentaje, 0),
    description: item.description ?? item.descripcion ?? "",
    cause: item.cause ?? item.causa ?? "",
    relatedCases: item.relatedCases ?? item.casos_relacionados ?? [],
  };
}

function SP_findCase(id) {
  const wanted = String(id ?? "");

  return (
    (Mock.cases || [])
      .map(SP_normalizeCase)
      .find((c) => c.id === wanted || c.code === wanted) || null
  );
}

function SP_findAdvisor(id) {
  const wanted = String(id ?? "");

  return (
    (Mock.advisors || [])
      .map(SP_normalizeAdvisor)
      .find((a) => a.id === wanted || a.name === wanted) || null
  );
}

function getCase(id) {
  return SP_findCase(id);
}

function getAdvisor(id) {
  return SP_findAdvisor(id);
}

function getIndicator(id) {
  const wanted = String(id ?? "");

  return (
    (Mock.indicators || [])
      .map(SP_normalizeIndicator)
      .find((i) => i.id === wanted) || null
  );
}

function pendingCases() {
  return (Mock.cases || []).map(SP_normalizeCase).filter((c) =>
    c.classificationStatus === "Sin clasificar" ||
    c.assignmentStatus === "Sin asesor" ||
    c.observed ||
    c.priority === "Crítica" ||
    c.slaHours <= 8
  );
}

function riskCases() {
  return (Mock.cases || []).map(SP_normalizeCase).filter(
    (c) => c.slaHours <= 8 || c.priority === "Crítica" || c.escalated
  );
}

function caseSummary(item) {
  const c = SP_normalizeCase(item);

  return summaryHTML([
    ["Código", c.code],
    ["Cliente", c.clientName],
    ["Tipo", c.type],
    ["Categoría", c.category],
    ["Servicio", c.service],
    ["Prioridad", c.priority],
    ["Estado", c.status],
    ["Responsable", c.advisorName],
    ["SLA", c.slaText],
    ["Acción sugerida", c.action],
  ]);
}

function advisorSummary(item) {
  const a = SP_normalizeAdvisor(item);

  return summaryHTML([
    ["Asesor", a.name],
    ["Especialidad", a.specialty],
    ["Estado", a.status],
    ["Casos", a.cases],
    ["Críticos", a.critical],
    ["Riesgo SLA", a.slaRisk],
    ["Productividad", `${a.productivity}%`],
    ["Capacidad", `${a.capacity}%`],
  ]);
}

function renderKpis(selector, data = []) {
  const rows = Array.isArray(data) ? data : [];

  setHTML(
    selector,
    rows
      .map((item) => {
        const icon = Array.isArray(item) ? item[0] : item.icon ?? "•";
        const value = Array.isArray(item) ? item[1] : item.value ?? item.valor ?? 0;
        const title = Array.isArray(item)
          ? item[2]
          : item.title ?? item.label ?? item.titulo ?? "Indicador";
        const text = Array.isArray(item)
          ? item[3]
          : item.text ?? item.description ?? item.descripcion ?? "";

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
      })
      .join("")
  );
}

function renderAi(selector, rows = []) {
  setHTML(
    selector,
    (rows || [])
      .map((item) => {
        const title = Array.isArray(item) ? item[0] : item.title ?? item.titulo ?? "Análisis";
        const text = Array.isArray(item) ? item[1] : item.text ?? item.descripcion ?? item.description ?? "";

        return `
          <div class="ai-summary-item">
            <strong>${esc(title)}</strong>
            <p>${esc(text)}</p>
          </div>
        `;
      })
      .join("")
  );
}

function renderChecklist(selector, rows = []) {
  setHTML(
    selector,
    (rows || [])
      .map((item) => {
        const icon = Array.isArray(item) ? item[0] : item.icon ?? "✓";
        const title = Array.isArray(item) ? item[1] : item.title ?? item.titulo ?? "Acción";
        const text = Array.isArray(item) ? item[2] : item.text ?? item.description ?? item.descripcion ?? "";

        return `
          <article class="check-item">
            <span class="check-icon">${esc(icon)}</span>
            <div>
              <strong>${esc(title)}</strong>
              <p>${esc(text)}</p>
            </div>
          </article>
        `;
      })
      .join("")
  );
}

async function SP_loadDashboardData() {
  try {
    const data = await SP_api("/supervisor/dashboard");

    SP_Data.dashboard = data;

    Mock.supervisor = {
      ...(Mock.supervisor || {}),
      ...(data.supervisor || {}),
      name: data.supervisor?.nombre || data.supervisor?.name || Mock.supervisor?.name || "Supervisor",
      initials: data.supervisor?.initials || data.supervisor?.iniciales || Mock.supervisor?.initials || "SU",
      role: data.supervisor?.role || data.supervisor?.cargo || "Supervisor de Atención",
      status: data.supervisor?.status || data.supervisor?.estado || "Supervisión activa",
      lastUpdate: data.last_update
        ? `Última actualización: ${new Date(data.last_update).toLocaleString("es-PE")}`
        : "Actualizado ahora",
    };

    Mock.cases = SP_toArray(data, "cases", "casos", "critical_cases", "casos_criticos").map(SP_normalizeCase);
    Mock.advisors = SP_toArray(data, "advisors", "asesores").map(SP_normalizeAdvisor);
    Mock.indicators = SP_toArray(data, "indicators", "indicadores").map(SP_normalizeIndicator);
    Mock.audit = SP_toArray(data, "activity", "actividad", "audit", "auditoria");
  } catch (error) {
    SP_warnBackend(error);

    Mock.cases = (Mock.cases || []).map(SP_normalizeCase);
    Mock.advisors = (Mock.advisors || []).map(SP_normalizeAdvisor);
    Mock.indicators = (Mock.indicators || []).map(SP_normalizeIndicator);
  }
}

async function SP_loadCases(scope = "all") {
  try {
    const data = await SP_api(`/supervisor/casos?scope=${encodeURIComponent(scope)}`);
    Mock.cases = SP_toArray(data, "items", "cases", "casos").map(SP_normalizeCase);
  } catch (error) {
    SP_warnBackend(error);
    Mock.cases = (Mock.cases || []).map(SP_normalizeCase);
  }
}

async function SP_loadAdvisors() {
  try {
    const data = await SP_api("/supervisor/asesores");
    Mock.advisors = SP_toArray(data, "items", "advisors", "asesores").map(SP_normalizeAdvisor);
  } catch (error) {
    SP_warnBackend(error);
    Mock.advisors = (Mock.advisors || []).map(SP_normalizeAdvisor);
  }

  populateAdvisorSelects();
}

async function SP_loadIndicators() {
  try {
    const period = getValue("#indicatorPeriodFilter") || "semana";
    const advisor = getValue("#indicatorAdvisorFilter") || "todos";
    const type = getValue("#indicatorCaseTypeFilter") || "todos";
    const channel = getValue("#indicatorChannelFilter") || "todos";

    const data = await SP_api(
      `/supervisor/indicadores?period=${encodeURIComponent(period)}&advisor=${encodeURIComponent(advisor)}&type=${encodeURIComponent(type)}&channel=${encodeURIComponent(channel)}`
    );

    SP_Data.indicatorResponse = data;
    Mock.indicators = SP_toArray(data, "items", "indicators", "indicadores").map(SP_normalizeIndicator);
    SP_Data.advisorPerformance = SP_toArray(data, "advisor_performance", "desempeno_asesores");
  } catch (error) {
    SP_warnBackend(error);
    Mock.indicators = (Mock.indicators || []).map(SP_normalizeIndicator);
    SP_Data.advisorPerformance = [];
  }
}

async function SP_loadReports() {
  try {
    const data = await SP_api("/supervisor/reportes");
    SP_Data.reportResponse = data;
    Mock.reports = SP_toArray(data, "items", "reports", "reportes");
  } catch (error) {
    SP_warnBackend(error);
  }
}

async function SP_loadAudit() {
  try {
    const q = getValue("#auditSearch") || "";
    const data = await SP_api(
      `/supervisor/auditoria?q=${encodeURIComponent(q)}&type=${encodeURIComponent(State.auditFilter || "todos")}`
    );

    SP_Data.auditResponse = data;
    Mock.audit = SP_toArray(data, "items", "audit", "auditoria");
  } catch (error) {
    SP_warnBackend(error);
  }
}

async function SP_loadConfig() {
  try {
    const data = await SP_api("/supervisor/configuracion");

    SP_Data.configResponse = data;
    Mock.configRules = SP_toArray(data, "rules", "configRules", "reglas");
    Mock.routeRules = SP_toArray(data, "routes", "routeRules", "rutas");
  } catch (error) {
    SP_warnBackend(error);
  }
}

function updateGlobalBadges() {
  setText("#sidebarPendingCount", pendingCases().length);
  setText("#sidebarSlaCount", riskCases().length);
  setText("#notificationBadge", riskCases().length || "");

  SP_api("/supervisor/resumen")
    .then((data) => {
      setText(
        "#sidebarPendingCount",
        data.pendientes ?? data.pending ?? data.casos_pendientes ?? pendingCases().length
      );
      setText(
        "#sidebarSlaCount",
        data.sla_riesgo ?? data.slaRisk ?? data.sla ?? riskCases().length
      );
      setText(
        "#notificationBadge",
        data.sla_riesgo ?? data.slaRisk ?? data.sla ?? riskCases().length
      );
    })
    .catch(() => {});
}

function populateAdvisorSelects() {
  const advisors = (Mock.advisors || []).map(SP_normalizeAdvisor);

  const options =
    `<option value="">Seleccionar asesor</option>` +
    advisors
      .map(
        (item) => `
          <option value="${esc(item.id)}">
            ${esc(item.name)} · ${esc(item.specialty)} · ${esc(item.capacity)}% carga
          </option>
        `
      )
      .join("");

  [
    "#assignAdvisorSelect",
    "#reassignToAdvisor",
    "#reassignAdvisorSelect",
    "#redistributeFromAdvisor",
    "#redistributeToAdvisor",
    "#massAssignmentAdvisorSelect",
  ].forEach((selector) => {
    const select = $(selector);
    if (!select) return;

    const current = select.value;
    select.innerHTML = options;
    if (current) select.value = current;
  });

  const indicatorSelect = $("#indicatorAdvisorFilter");

  if (indicatorSelect) {
    const current = indicatorSelect.value;

    indicatorSelect.innerHTML =
      `<option value="todos">Todos los asesores</option>` +
      advisors.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");

    if (current) indicatorSelect.value = current;
  }
}

function SP_dashboardTarget(action) {
  if (action === "classify" || action === "priority" || action === "observe") {
    return "casos-pendientes.html";
  }

  if (action === "alert" || action === "follow") {
    return "monitoreo-sla.html";
  }

  return "asignaciones.html";
}

function SP_goToCaseAction(caseId, action) {
  if (!caseId) return;

  localStorage.setItem("claro360-supervisor-selected-case", String(caseId));

  window.location.href = `${SP_dashboardTarget(action)}?case=${encodeURIComponent(caseId)}&action=${encodeURIComponent(action)}`;
}

function SP_openActionOrRedirect(action, caseId) {
  if (State.page === "supervisor-dashboard" || State.page === "supervisor-indicadores") {
    SP_goToCaseAction(caseId, action);
    return;
  }

  const map = {
    classify: () => openClassifyCaseModal(caseId),
    priority: () => openChangePriorityModal(caseId),
    observe: () => openObserveCaseModal(caseId),
    sendAssignment: () => openSendToAssignmentModal(caseId),
    assign: () => openAssignAdvisorModal(caseId),
    reassign: () => openReassignCaseModal(caseId),
    derive: () => openDeriveAreaModal(caseId),
    escalate: () => openEscalateCaseModal(caseId),
    alert: () => openSendSlaAlertModal(caseId),
    follow: () => openSlaFollowModal(caseId),
  };

  if (map[action]) map[action]();
}

function SP_handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case") || localStorage.getItem("claro360-supervisor-selected-case");
  const action = params.get("action");

  if (!caseId || !action) return;

  setTimeout(() => {
    SP_openActionOrRedirect(action, caseId);
  }, 180);
}

function renderCaseCard(item, mode = "supervisor") {
  const c = SP_normalizeCase(item);

  const buttons = [
    `<button type="button" data-action="${mode}-view-case" data-case-id="${esc(c.id)}">Ver</button>`,
  ];

  if (mode === "supervisor") {
    buttons.push(`<button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>`);
    buttons.push(`<button type="button" data-action="assign-case" data-case-id="${esc(c.id)}">Asignar</button>`);
    buttons.push(`<button type="button" data-action="escalate-case" data-case-id="${esc(c.id)}">Escalar</button>`);
  }

  if (mode === "pending") {
    buttons.push(`<button type="button" data-action="classify-case" data-case-id="${esc(c.id)}">Clasificar</button>`);
    buttons.push(`<button type="button" data-action="send-assignment" data-case-id="${esc(c.id)}">Enviar a asignación</button>`);
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

  return `
    <article class="case-card">
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

  $$('[data-action="classify-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("classify", button.dataset.caseId))
  );

  $$('[data-action="change-priority"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("priority", button.dataset.caseId))
  );

  $$('[data-action="observe-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("observe", button.dataset.caseId))
  );

  $$('[data-action="send-assignment"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("sendAssignment", button.dataset.caseId))
  );

  $$('[data-action="assign-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("assign", button.dataset.caseId))
  );

  $$('[data-action="reassign-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("reassign", button.dataset.caseId))
  );

  $$('[data-action="derive-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("derive", button.dataset.caseId))
  );

  $$('[data-action="escalate-case"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("escalate", button.dataset.caseId))
  );

  $$('[data-action="sla-alert"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("alert", button.dataset.caseId))
  );

  $$('[data-action="sla-follow"]', root).forEach((button) =>
    button.addEventListener("click", () => SP_openActionOrRedirect("follow", button.dataset.caseId))
  );
}

function openQuickCaseModal(id) {
  const item = getCase(id);
  if (!item) return;

  saveSelectedCase(item.id);

  setText("#caseQuickViewIcon", item.icon);
  setText("#caseQuickViewTitle", item.code || item.id);
  setText("#caseQuickViewText", item.description || item.action || item.reason);
  setHTML("#caseQuickViewSummary", caseSummary(item));

  openModal("#caseQuickViewModal");
}

async function initDashboard() {
  await SP_loadDashboardData();

  setText("#userNameTop", Mock.supervisor.name);
  setText("#userRoleTop", Mock.supervisor.role);
  setText("#userAvatar", Mock.supervisor.initials || SP_initials(Mock.supervisor.name));

  setText("#dashboardHeroEyebrow", "Supervisión operativa");
  setText("#dashboardHeroTitle", `Hola, ${Mock.supervisor.name}`);
  setText(
    "#dashboardHeroText",
    "Controla pendientes, asignaciones, carga del equipo, SLA, indicadores y trazabilidad desde una vista ejecutiva."
  );

  setText("#supervisorStatus", Mock.supervisor.status);
  setText("#supervisorLastUpdate", Mock.supervisor.lastUpdate || "Actualizado ahora");

  renderDashboardKpis();
  renderCriticalCases();
  renderAdvisorLoadSummary();
  renderDashboardSla();
  renderDashboardIndicators();
  renderSupervisorActivity();
  updateGlobalBadges();

  const ai = SP_Data.dashboard?.ai_summary || SP_Data.dashboard?.resumen_ia || [
    ["Prioridad inmediata", "Atender casos críticos con SLA vencido o menor a 8 horas."],
    ["Carga del equipo", "Evitar asignar nuevos casos a asesores con ocupación alta."],
    ["Decisión sugerida", "Clasificar y asignar primero los casos sin responsable."],
  ];

  renderAi("#supervisorAiSummary", ai);

  $("#refreshCriticalCasesBtn")?.addEventListener("click", async () => {
    await SP_loadDashboardData();
    renderCriticalCases();
    toast("Casos actualizados", "Se refrescó la lista de casos críticos.", "success");
  });

  $("#refreshAdvisorLoadBtn")?.addEventListener("click", async () => {
    await SP_loadDashboardData();
    renderAdvisorLoadSummary();
    toast("Carga actualizada", "Se actualizó la distribución del equipo.", "success");
  });

  $("#refreshDashboardSlaBtn")?.addEventListener("click", async () => {
    await SP_loadDashboardData();
    renderDashboardSla();
    toast("SLA actualizado", "Se actualizó el resumen de vencimientos.", "success");
  });

  $("#refreshDashboardIndicatorsBtn")?.addEventListener("click", async () => {
    await SP_loadDashboardData();
    renderDashboardIndicators();
    toast("Indicadores actualizados", "Se recalcularon los indicadores principales.", "success");
  });

  $("#refreshSupervisorActivityBtn")?.addEventListener("click", async () => {
    await SP_loadDashboardData();
    renderSupervisorActivity();
    toast("Actividad actualizada", "Se actualizó la trazabilidad reciente.", "success");
  });

  $("#caseQuickViewAssignBtn")?.addEventListener("click", () => {
    SP_goToCaseAction(State.selectedCaseId, "assign");
  });

  $("#caseQuickViewClassifyBtn")?.addEventListener("click", () => {
    SP_goToCaseAction(State.selectedCaseId, "classify");
  });

  $("#caseQuickViewEscalateBtn")?.addEventListener("click", () => {
    SP_goToCaseAction(State.selectedCaseId, "escalate");
  });
}

async function initPendingCases() {
  await SP_loadCases("pending");

  renderPendingCases();
  updateGlobalBadges();

  $("#pendingCaseSearch")?.addEventListener("input", renderPendingCases);

  $$("[data-pending-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.pendingFilter = button.dataset.pendingFilter || "todos";
      $$("[data-pending-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderPendingCases();
    });
  });

  $("#togglePendingViewBtn")?.addEventListener("click", () => {
    State.pendingView = State.pendingView === "cards" ? "table" : "cards";
    setText("#togglePendingViewBtn", State.pendingView === "cards" ? "Vista tabla" : "Vista cards");
    renderPendingCases();
  });

  $("#refreshPendingCasesBtn")?.addEventListener("click", async () => {
    await SP_loadCases("pending");
    renderPendingCases();
    toast("Pendientes actualizados", "Se actualizó la bandeja de casos pendientes.", "success");
  });

  $("#exportPendingCasesBtn")?.addEventListener("click", () => {
    SP_exportCases("casos_pendientes", pendingFilteredCases());
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

  $("#pendingCasePriorityBtn")?.addEventListener("click", () => {
    closeModals();
    openChangePriorityModal(State.selectedCaseId);
  });

  $("#confirmClassifyCaseBtn")?.addEventListener("click", confirmClassifyCase);
  $("#confirmChangePriorityBtn")?.addEventListener("click", confirmChangePriority);
  $("#confirmObserveCaseBtn")?.addEventListener("click", confirmObserveCase);
  $("#confirmSendToAssignmentBtn")?.addEventListener("click", confirmSendToAssignment);

  SP_handleDeepLink();
}

async function initAssignments() {
  await Promise.all([SP_loadCases("assignments"), SP_loadAdvisors()]);

  renderAssignments();
  updateGlobalBadges();

  $("#assignmentsSearch")?.addEventListener("input", renderAssignments);

  $$("[data-assignment-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.assignmentFilter = button.dataset.assignmentFilter || "todos";
      $$("[data-assignment-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderAssignments();
    });
  });

  $("#toggleAssignmentsViewBtn")?.addEventListener("click", () => {
    State.assignmentView = State.assignmentView === "cards" ? "table" : "cards";
    setText("#toggleAssignmentsViewBtn", State.assignmentView === "cards" ? "Vista tabla" : "Vista cards");
    renderAssignments();
  });

  $("#refreshAssignmentsBtn")?.addEventListener("click", async () => {
    await Promise.all([SP_loadCases("assignments"), SP_loadAdvisors()]);
    renderAssignments();
    toast("Asignaciones actualizadas", "Se refrescó la bandeja de asignaciones.", "success");
  });

  $("#exportAssignmentsBtn")?.addEventListener("click", () => {
    SP_exportCases("asignaciones", assignmentFilteredCases());
  });

  $("#openMassAssignmentBtn")?.addEventListener("click", () => openModal("#massAssignmentModal"));

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
  $("#confirmReassignCaseBtn")?.addEventListener("click", confirmReassignCase);
  $("#confirmDeriveAreaBtn")?.addEventListener("click", confirmDeriveArea);
  $("#confirmEscalateCaseBtn")?.addEventListener("click", confirmEscalateCase);
  $("#confirmMassAssignmentBtn")?.addEventListener("click", confirmMassAssignment);

  SP_handleDeepLink();
}

async function initAdvisorLoad() {
  await SP_loadAdvisors();

  renderAdvisorLoadPage();

  $("#advisorLoadSearch")?.addEventListener("input", renderAdvisorLoadPage);

  $$("[data-load-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.advisorLoadFilter = button.dataset.loadFilter || "todos";
      $$("[data-load-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderAdvisorLoadPage();
    });
  });

  $("#toggleAdvisorLoadViewBtn")?.addEventListener("click", () => {
    State.advisorLoadView = State.advisorLoadView === "cards" ? "table" : "cards";
    setText("#toggleAdvisorLoadViewBtn", State.advisorLoadView === "cards" ? "Vista tabla" : "Vista cards");
    renderAdvisorLoadPage();
  });

  $("#refreshAdvisorLoadPageBtn")?.addEventListener("click", async () => {
    await SP_loadAdvisors();
    renderAdvisorLoadPage();
    toast("Carga actualizada", "Se actualizó la información del equipo.", "success");
  });

  $("#exportAdvisorLoadBtn")?.addEventListener("click", () => {
    SP_exportAdvisors("carga_asesores", advisorLoadFiltered());
  });

  $("#openRedistributeLoadBtn")?.addEventListener("click", () => openRedistributeLoadModal());
  $("#confirmRedistributeLoadBtn")?.addEventListener("click", confirmRedistributeLoad);
  $("#confirmAdvisorAvailabilityBtn")?.addEventListener("click", confirmAdvisorAvailability);
}

async function initSlaMonitor() {
  await Promise.all([SP_loadCases("sla"), SP_loadAdvisors()]);

  renderSlaMonitor();
  updateGlobalBadges();

  $("#slaMonitorSearch")?.addEventListener("input", renderSlaMonitor);

  $$("[data-sla-monitor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.slaFilter = button.dataset.slaMonitorFilter || "todos";
      $$("[data-sla-monitor-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderSlaMonitor();
    });
  });

  $("#toggleSlaMonitorViewBtn")?.addEventListener("click", () => {
    State.slaView = State.slaView === "cards" ? "table" : "cards";
    setText("#toggleSlaMonitorViewBtn", State.slaView === "cards" ? "Vista tabla" : "Vista cards");
    renderSlaMonitor();
  });

  $("#refreshSlaMonitorBtn")?.addEventListener("click", async () => {
    await SP_loadCases("sla");
    renderSlaMonitor();
    toast("SLA actualizado", "Se actualizaron las alertas de vencimiento.", "success");
  });

  $("#exportSlaMonitorBtn")?.addEventListener("click", () => {
    SP_exportCases("monitoreo_sla", slaFilteredCases());
  });

  $("#sendMassSlaAlertBtn")?.addEventListener("click", () => SP_confirmMassSlaAlert());

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
  $("#confirmSlaSupervisorFollowBtn")?.addEventListener("click", confirmSlaFollow);

  SP_handleDeepLink();
}

async function initIndicators() {
  await Promise.all([SP_loadAdvisors(), SP_loadIndicators()]);

  renderIndicators();

  $("#indicatorPeriodFilter")?.addEventListener("change", async () => {
    await SP_loadIndicators();
    renderIndicators();
  });

  $("#indicatorAdvisorFilter")?.addEventListener("change", async () => {
    await SP_loadIndicators();
    renderIndicators();
  });

  $("#indicatorCaseTypeFilter")?.addEventListener("change", async () => {
    await SP_loadIndicators();
    renderIndicators();
  });

  $("#indicatorChannelFilter")?.addEventListener("change", async () => {
    await SP_loadIndicators();
    renderIndicators();
  });

  $("#refreshIndicatorsBtn")?.addEventListener("click", async () => {
    await SP_loadIndicators();
    renderIndicators();
    toast("Indicadores actualizados", "Se recalcularon las métricas operativas.", "success");
  });

  $("#exportIndicatorsBtn")?.addEventListener("click", () => SP_exportIndicators());
  $("#compareIndicatorsBtn")?.addEventListener("click", () => openModal("#compareIndicatorsModal"));
  $("#confirmCompareIndicatorsBtn")?.addEventListener("click", confirmCompareIndicators);

  $("#toggleIndicatorViewBtn")?.addEventListener("click", () => {
    State.indicatorCompact = !State.indicatorCompact;
    setText("#toggleIndicatorViewBtn", State.indicatorCompact ? "Vista amplia" : "Vista compacta");
    renderIndicators();
  });

  $("#resetIndicatorFiltersBtn")?.addEventListener("click", async () => {
    setValueIfExists("#indicatorPeriodFilter", "semana");
    setValueIfExists("#indicatorAdvisorFilter", "todos");
    setValueIfExists("#indicatorCaseTypeFilter", "todos");
    setValueIfExists("#indicatorChannelFilter", "todos");

    await SP_loadIndicators();
    renderIndicators();
  });
}

function setValueIfExists(selector, value) {
  const el = $(selector);
  if (el) el.value = value;
}

function renderIndicators() {
  const indicators = (Mock.indicators || []).map(SP_normalizeIndicator);
  const response = SP_Data.indicatorResponse || {};

  setText("#indicatorsSummaryTitle", `${indicators.length} indicadores actualizados`);
  setText(
    "#indicatorsSummaryText",
    `Periodo: ${getValue("#indicatorPeriodFilter") || "semana"}. Datos ${SP_Data.backendReady ? "del backend" : "locales"}.`
  );

  renderKpis("#indicatorsKpiGrid", response.kpis || indicators.slice(0, 4));
  setHTML("#mainIndicatorGrid", indicators.map(indicatorCard).join(""));

  show($("#emptyIndicatorsState"), !indicators.length);

  renderIndicatorTrend(response.trend || response.tendencia || null);
  renderIndicatorPriorityStack(response.priority_distribution || response.distribucion_prioridad || null);
  renderAdvisorPerformanceTable(
    response.advisor_performance ||
    response.desempeno_asesores ||
    SP_Data.advisorPerformance
  );

  renderAi("#indicatorsAiSummary", response.ai_summary || response.resumen_ia || [
    ["Lectura operativa", "Los indicadores combinan SLA, cierres, criticidad y carga del equipo."],
    ["Acción recomendada", "Revisar desempeño por asesor y priorizar casos con vencimiento cercano."],
  ]);

  renderChecklist("#indicatorActionPlan", [
    ["1", "Revisar SLA", "Abrir casos que explican la caída del indicador."],
    ["2", "Balancear carga", "Reducir concentración en asesores saturados."],
    ["3", "Auditar cierres", "Revisar casos reabiertos o cierres con baja satisfacción."],
  ]);

  bindIndicatorButtons($("#mainIndicatorGrid"));
}

function renderIndicatorTrend(rows = null) {
  const data =
    rows && rows.length
      ? rows.map((r) => [r.label || r.fecha || "-", SP_number(r.value ?? r.ingresados, 0)])
      : [
          ["Lun", 18],
          ["Mar", 24],
          ["Mié", 20],
          ["Jue", 29],
          ["Vie", 26],
        ];

  const max = Math.max(1, ...data.map((row) => row[1]));

  setHTML(
    "#indicatorTrendChart",
    data
      .map(
        ([day, value]) => `
          <div class="bar-chart__row">
            <span>${esc(day)}</span>
            <div><i style="width:${Math.max(4, (value / max) * 100)}%"></i></div>
            <strong>${esc(value)}</strong>
          </div>
        `
      )
      .join("")
  );
}

function renderIndicatorPriorityStack(rows = null) {
  const data =
    rows && rows.length
      ? rows.map((r) => [r.label || r.prioridad || "-", r.value ?? r.total ?? 0])
      : [
          ["Crítica", Mock.cases.filter((c) => SP_normalizeCase(c).priority === "Crítica").length],
          ["Alta", Mock.cases.filter((c) => SP_normalizeCase(c).priority === "Alta").length],
          ["Media", Mock.cases.filter((c) => SP_normalizeCase(c).priority === "Media").length],
          ["Baja", Mock.cases.filter((c) => SP_normalizeCase(c).priority === "Baja").length],
        ];

  setHTML(
    "#indicatorPriorityStack",
    data
      .map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`)
      .join("")
  );
}

function renderAdvisorPerformanceTable(rows = null) {
  const data =
    rows && rows.length
      ? rows
      : (Mock.advisors || []).map((a) => {
          const advisor = SP_normalizeAdvisor(a);

          return {
            id: advisor.id,
            advisor: advisor.name,
            cases: advisor.cases,
            closed: Math.max(0, Math.round(advisor.productivity / 20)),
            sla: Math.max(0, 100 - advisor.slaRisk * 8),
            productivity: advisor.productivity,
            status: advisor.status,
          };
        });

  setHTML(
    "#advisorPerformanceTableBody",
    data
      .map(
        (row) => `
          <tr>
            <td>${esc(row.advisor || row.asesor || row.name || "-")}</td>
            <td>${esc(row.cases ?? row.casos ?? 0)}</td>
            <td>${esc(row.closed ?? row.cerrados ?? 0)}</td>
            <td>${esc(row.sla ?? row.sla_cumplido ?? 0)}%</td>
            <td>${esc(row.productivity ?? row.productividad ?? 0)}%</td>
            <td>
              <span class="${pillClass(advisorStatusType(row.status || row.estado))}">
                ${esc(row.status || row.estado || "Activo")}
              </span>
            </td>
            <td>
              <button type="button" data-action="view-advisor" data-advisor-id="${esc(row.id || row.asesor_id || "")}">
                Ver
              </button>
            </td>
          </tr>
        `
      )
      .join("")
  );

  bindAdvisorButtons($("#advisorPerformanceTableBody"));
}

async function initReports() {
  await SP_loadReports();

  renderReports();

  $("#generateReportBtn")?.addEventListener("click", openReportPreview);
  $("#confirmGenerateReportBtn")?.addEventListener("click", confirmGenerateReport);
  $("#previewReportBtn")?.addEventListener("click", openReportPreview);
  $("#reportPreviewGenerateBtn")?.addEventListener("click", confirmGenerateReport);
  $("#reportPreviewExportBtn")?.addEventListener("click", () => SP_exportReports());
  $("#scheduleReportBtn")?.addEventListener("click", () => openModal("#scheduleReportModal"));
  $("#confirmScheduleReportBtn")?.addEventListener("click", confirmScheduleReport);
  $("#resetReportFiltersBtn")?.addEventListener("click", resetReportForm);

  $("#refreshRecentReportsBtn")?.addEventListener("click", async () => {
    await SP_loadReports();
    renderReports();
  });

  $("#exportRecentReportsBtn")?.addEventListener("click", () => SP_exportReports());
}

async function initAudit() {
  await SP_loadAudit();

  renderAudit();

  $("#auditSearch")?.addEventListener("input", async () => {
    await SP_loadAudit();
    renderAudit();
  });

  $$("[data-audit-filter]").forEach((button) => {
    button.addEventListener("click", async () => {
      State.auditFilter = button.dataset.auditFilter || "todos";
      $$("[data-audit-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      await SP_loadAudit();
      renderAudit();
    });
  });

  $("#refreshAuditBtn")?.addEventListener("click", async () => {
    await SP_loadAudit();
    renderAudit();
  });

  $("#exportAuditBtn")?.addEventListener("click", () => SP_exportAudit());
  $("#downloadAuditTraceBtn")?.addEventListener("click", () => SP_exportAudit());
  $("#compareAuditBtn")?.addEventListener("click", () => openModal("#compareAuditModal"));
  $("#confirmCompareAuditBtn")?.addEventListener("click", confirmCompareAudit);
}

async function initConfig() {
  await SP_loadConfig();

  renderConfig();

  $("#configSearch")?.addEventListener("input", renderConfig);

  $$("[data-config-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.configFilter = button.dataset.configFilter || "todos";
      $$("[data-config-filter]").forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      renderConfig();
    });
  });

  $("#refreshSupervisorConfigBtn")?.addEventListener("click", async () => {
    await SP_loadConfig();
    renderConfig();
  });

  $("#exportSupervisorConfigBtn")?.addEventListener("click", () => SP_exportConfig());
  $("#saveSupervisorConfigBtn")?.addEventListener("click", () => openModal("#confirmConfigSaveModal"));
  $("#confirmSaveSupervisorConfigBtn")?.addEventListener("click", confirmSaveConfig);
  $("#confirmEditConfigRuleBtn")?.addEventListener("click", confirmEditConfigRule);
  $("#confirmPriorityMatrixBtn")?.addEventListener("click", confirmPriorityMatrix);
  $("#confirmRouteRuleBtn")?.addEventListener("click", confirmRouteRule);
}

function SP_caseId() {
  return State.selectedCaseId || localStorage.getItem("claro360-supervisor-selected-case");
}

async function SP_casePost(path, payload, okMessage) {
  const id = SP_caseId();

  if (!id) {
    toast("Caso no seleccionado", "Selecciona un caso antes de ejecutar la acción.", "warning");
    return;
  }

  try {
    const response = await SP_api(`/supervisor/casos/${encodeURIComponent(id)}${path}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    closeModals();

    toast("Acción registrada", response.message || okMessage, "success");

    if (State.page === "supervisor-casos-pendientes") await SP_loadCases("pending");
    if (State.page === "supervisor-asignaciones") await Promise.all([SP_loadCases("assignments"), SP_loadAdvisors()]);
    if (State.page === "supervisor-monitoreo-sla") await SP_loadCases("sla");

    if (typeof renderPendingCases === "function" && State.page === "supervisor-casos-pendientes") renderPendingCases();
    if (typeof renderAssignments === "function" && State.page === "supervisor-asignaciones") renderAssignments();
    if (typeof renderSlaMonitor === "function" && State.page === "supervisor-monitoreo-sla") renderSlaMonitor();

    updateGlobalBadges();
  } catch (error) {
    toast("No se pudo completar", error.message, "danger");
  }
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

  SP_casePost(
    "/clasificar",
    {
      tipo_caso: getValue("#classifyCaseType"),
      categoria: getValue("#classifyCaseCategory"),
      prioridad: getValue("#classifyCasePriority"),
      ruta: getValue("#classifyCaseRoute"),
      motivo: getValue("#classifyCaseReason"),
    },
    "Caso clasificado correctamente."
  );
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

  SP_casePost(
    "/prioridad",
    {
      prioridad: getValue("#newPriority"),
      motivo: getValue("#priorityReasonType"),
      comentario: getValue("#priorityComment"),
    },
    "Prioridad actualizada correctamente."
  );
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

  SP_casePost(
    "/observar",
    {
      motivo: getValue("#observeReason"),
      retorno: getValue("#observeReturnTo"),
      comentario: getValue("#observeComment"),
    },
    "Caso observado correctamente."
  );
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

  SP_casePost(
    "/enviar-asignacion",
    {
      sugerencia: getValue("#assignmentSuggestion"),
      cola: getValue("#assignmentQueue"),
    },
    "Caso enviado a asignación."
  );
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

  SP_casePost(
    "/asignar",
    {
      asesor_id: getValue("#assignAdvisorSelect"),
      cola: getValue("#assignQueueSelect"),
      criterio: getValue("#assignCriterion"),
      visibilidad: getValue("#assignVisibility"),
      comentario: getValue("#assignComment"),
    },
    "Caso asignado correctamente."
  );
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

  SP_casePost(
    "/reasignar",
    {
      asesor_id: getValue("#reassignToAdvisor"),
      motivo: getValue("#reassignReason"),
      prioridad: getValue("#reassignPriority"),
      comentario: getValue("#reassignComment"),
    },
    "Caso reasignado correctamente."
  );
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

  SP_casePost(
    "/derivar",
    {
      area_destino: getValue("#deriveAreaSelect"),
      sla_interno: getValue("#deriveAreaSla"),
      motivo: getValue("#deriveAreaReason"),
      comentario: getValue("#deriveAreaComment"),
    },
    "Caso derivado correctamente."
  );
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

  SP_casePost(
    "/escalar",
    {
      nivel: getValue("#escalateLevel"),
      motivo: getValue("#escalateReason"),
      comentario: getValue("#escalateComment"),
    },
    "Caso escalado correctamente."
  );
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

  SP_casePost(
    "/alerta-sla",
    {
      destinatario: getValue("#slaAlertTarget"),
      canal: getValue("#slaAlertChannel"),
      mensaje: getValue("#slaAlertMessage"),
    },
    "Alerta SLA enviada correctamente."
  );
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

  SP_casePost(
    "/seguimiento-sla",
    {
      accion: getValue("#slaFollowAction"),
      resultado: getValue("#slaFollowResult"),
      comentario: getValue("#slaFollowComment"),
    },
    "Seguimiento SLA registrado."
  );
}

async function confirmMassAssignment() {
  if (
    !getValue("#massAssignmentCriteria") ||
    !getValue("#massAssignmentScope") ||
    !isChecked("#massAssignmentDeclaration")
  ) {
    toast("Faltan datos", "Selecciona criterio, alcance y confirmación.", "warning");
    return;
  }

  try {
    const response = await SP_api("/supervisor/asignaciones/masiva", {
      method: "POST",
      body: JSON.stringify({
        criterio: getValue("#massAssignmentCriteria"),
        alcance: getValue("#massAssignmentScope"),
      }),
    });

    closeModals();

    toast("Asignación masiva ejecutada", response.message || "Se ejecutó la asignación masiva.", "success");

    await Promise.all([SP_loadCases("assignments"), SP_loadAdvisors()]);
    renderAssignments();
  } catch (error) {
    toast("No se pudo ejecutar", error.message, "danger");
  }
}

async function SP_confirmMassSlaAlert() {
  const rows = slaFilteredCases().filter((c) => SP_normalizeCase(c).slaHours <= 8);

  try {
    const response = await SP_api("/supervisor/sla/alerta-masiva", {
      method: "POST",
      body: JSON.stringify({
        scope: State.slaFilter || "riesgo",
        case_ids: rows.map((c) => SP_normalizeCase(c).id),
      }),
    });

    toast("Alertas enviadas", response.message || "Se enviaron alertas SLA masivas.", "success");
  } catch (error) {
    toast("No se pudo alertar", error.message, "danger");
  }
}

async function confirmRedistributeLoad() {
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

  try {
    const response = await SP_api("/supervisor/asesores/redistribuir", {
      method: "POST",
      body: JSON.stringify({
        asesor_origen_id: getValue("#redistributeFromAdvisor"),
        asesor_destino_id: getValue("#redistributeToAdvisor"),
        cantidad: getValue("#redistributeCasesCount"),
        motivo: getValue("#redistributeCriteria"),
        criterio: getValue("#redistributeCriteria"),
      }),
    });

    closeModals();

    toast("Redistribución registrada", response.message || "La redistribución fue registrada correctamente.", "success");

    await SP_loadAdvisors();
    renderAdvisorLoadPage();
  } catch (error) {
    toast("No se pudo redistribuir", error.message, "danger");
  }
}

async function confirmAdvisorAvailability() {
  if (
    !getValue("#advisorAvailabilityStatus") ||
    !getValue("#advisorAvailabilityReason") ||
    !getValue("#advisorAvailabilityComment") ||
    !isChecked("#advisorAvailabilityDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, motivo, comentario y confirmación.", "warning");
    return;
  }

  try {
    const response = await SP_api(`/supervisor/asesores/${encodeURIComponent(State.selectedAdvisorId)}/disponibilidad`, {
      method: "PATCH",
      body: JSON.stringify({
        estado: getValue("#advisorAvailabilityStatus"),
        motivo: getValue("#advisorAvailabilityReason"),
        comentario: getValue("#advisorAvailabilityComment"),
      }),
    });

    closeModals();

    toast("Disponibilidad actualizada", response.message || "El estado del asesor fue actualizado.", "success");

    await SP_loadAdvisors();
    renderAdvisorLoadPage();
  } catch (error) {
    toast("No se pudo actualizar", error.message, "danger");
  }
}

async function confirmCompareIndicators() {
  if (
    !getValue("#compareBasePeriod") ||
    !getValue("#compareTargetPeriod") ||
    !isChecked("#compareIndicatorsDeclaration")
  ) {
    toast("Faltan datos", "Selecciona periodo base, comparativo y confirmación.", "warning");
    return;
  }

  try {
    const response = await SP_api("/supervisor/indicadores/comparar", {
      method: "POST",
      body: JSON.stringify({
        base_period: getValue("#compareBasePeriod"),
        target_period: getValue("#compareTargetPeriod"),
        advisor: getValue("#indicatorAdvisorFilter") || "todos",
        type: getValue("#indicatorCaseTypeFilter") || "todos",
        channel: getValue("#indicatorChannelFilter") || "todos",
      }),
    });

    closeModals();

    genericModal(
      "📈",
      "Comparación generada",
      response.insight || "Se generó la comparación de indicadores."
    );
  } catch (error) {
    toast("No se pudo comparar", error.message, "danger");
  }
}

async function confirmGenerateReport() {
  const payload = {
    tipo: getValue("#reportType"),
    periodo: getValue("#reportPeriod"),
    alcance: getValue("#reportScope"),
    formato: getValue("#reportFormat"),
    comentario: getValue("#reportComment"),
    includeCharts: isChecked("#includeCharts"),
    includeCases: isChecked("#includeCases"),
    includeSla: isChecked("#includeSla"),
    includeAudit: isChecked("#includeAudit"),
  };

  if (!payload.tipo || !payload.periodo || !payload.alcance || !payload.formato) {
    toast("Faltan datos", "Completa tipo, periodo, alcance y formato.", "warning");
    return;
  }

  try {
    const response = await SP_api("/supervisor/reportes/generar", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    closeModals();

    toast("Reporte generado", response.message || "El reporte fue generado correctamente.", "success");

    await SP_loadReports();
    renderReports();
  } catch (error) {
    toast("No se pudo generar", error.message, "danger");
  }
}

async function confirmScheduleReport() {
  if (
    !getValue("#scheduleFrequency") ||
    !getValue("#scheduleFormat") ||
    !getValue("#scheduleRecipients") ||
    !isChecked("#scheduleReportDeclaration")
  ) {
    toast("Faltan datos", "Completa frecuencia, formato, destinatarios y confirmación.", "warning");
    return;
  }

  try {
    const response = await SP_api("/supervisor/reportes/programar", {
      method: "POST",
      body: JSON.stringify({
        tipo: getValue("#reportType") || "Resumen ejecutivo",
        periodo: getValue("#reportPeriod") || "Semanal",
        alcance: getValue("#reportScope") || "Todos los casos",
        formato: getValue("#scheduleFormat"),
        frecuencia: getValue("#scheduleFrequency"),
        destinatarios: getValue("#scheduleRecipients"),
      }),
    });

    closeModals();

    toast("Reporte programado", response.message || "El reporte fue programado correctamente.", "success");

    await SP_loadReports();
    renderReports();
  } catch (error) {
    toast("No se pudo programar", error.message, "danger");
  }
}

async function confirmEditConfigRule() {
  if (
    !getValue("#configRuleValue") ||
    !getValue("#configRuleStatus") ||
    !getValue("#configRuleReason") ||
    !isChecked("#configRuleDeclaration")
  ) {
    toast("Faltan datos", "Completa nuevo valor, estado, sustento y confirmación.", "warning");
    return;
  }

  try {
    const response = await SP_api(`/supervisor/configuracion/reglas/${encodeURIComponent(State.selectedConfigRuleId)}`, {
      method: "PUT",
      body: JSON.stringify({
        valor: getValue("#configRuleValue"),
        estado: getValue("#configRuleStatus"),
        motivo: getValue("#configRuleReason"),
      }),
    });

    closeModals();

    toast("Regla actualizada", response.message || "La regla fue guardada correctamente.", "success");

    await SP_loadConfig();
    renderConfig();
  } catch (error) {
    toast("No se pudo guardar", error.message, "danger");
  }
}

async function confirmPriorityMatrix() {
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

  try {
    const response = await SP_api("/supervisor/configuracion/matriz-prioridad", {
      method: "PUT",
      body: JSON.stringify({
        impacto: getValue("#priorityImpactWeight"),
        urgencia: getValue("#priorityUrgencyWeight"),
        sla: getValue("#prioritySlaWeight"),
        cliente: getValue("#priorityClientWeight"),
      }),
    });

    closeModals();

    toast("Matriz guardada", response.message || "Los criterios de prioridad fueron actualizados.", "success");

    await SP_loadConfig();
    renderConfig();
  } catch (error) {
    toast("No se pudo guardar", error.message, "danger");
  }
}

async function confirmRouteRule() {
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

  try {
    const response = await SP_api("/supervisor/configuracion/rutas", {
      method: "POST",
      body: JSON.stringify({
        nombre: getValue("#routeRuleName"),
        condicion: getValue("#routeRuleCondition"),
        area_destino: getValue("#routeRuleArea"),
        sla_interno: getValue("#routeRuleSla"),
      }),
    });

    closeModals();

    toast("Ruta guardada", response.message || "La ruta operativa fue guardada correctamente.", "success");

    await SP_loadConfig();
    renderConfig();
  } catch (error) {
    toast("No se pudo guardar", error.message, "danger");
  }
}

async function confirmSaveConfig() {
  if (!isChecked("#confirmConfigSaveDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste los cambios.", "warning");
    return;
  }

  try {
    const response = await SP_api("/supervisor/configuracion/guardar", {
      method: "POST",
      body: JSON.stringify({ confirmacion: true }),
    });

    closeModals();

    toast("Configuración guardada", response.message || "Los parámetros de supervisión fueron actualizados.", "success");
  } catch (error) {
    toast("No se pudo guardar", error.message, "danger");
  }
}

function SP_exportExcel(filename, title, columns, rows) {
  const th = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");

  const trs = rows
    .map(
      (row) => `
        <tr>
          ${columns
            .map((c) => `<td>${esc(typeof c.value === "function" ? c.value(row) : row[c.key])}</td>`)
            .join("")}
        </tr>
      `
    )
    .join("");

  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1f2937;
          }

          h1 {
            font-size: 20px;
            color: #b91c1c;
          }

          table {
            border-collapse: collapse;
            width: 100%;
          }

          th {
            background: #e2231a;
            color: #fff;
            text-align: left;
            padding: 9px;
            border: 1px solid #b91c1c;
          }

          td {
            padding: 8px;
            border: 1px solid #d1d5db;
          }

          tr:nth-child(even) {
            background: #f9fafb;
          }

          .meta {
            color: #667085;
            font-size: 12px;
            margin-bottom: 12px;
          }
        </style>
      </head>
      <body>
        <h1>${esc(title)}</h1>
        <p class="meta">Exportado: ${new Date().toLocaleString("es-PE")}</p>
        <table>
          <thead>
            <tr>${th}</tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${filename}_${SP_dateStamp()}.xls`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  toast("Exportación lista", `Se generó ${filename}.xls con formato Excel.`, "success");
}

function SP_exportCases(filename, rows) {
  SP_exportExcel(
    filename,
    "Reporte de casos - Supervisor",
    [
      { label: "Código", value: (r) => SP_normalizeCase(r).code },
      { label: "Cliente", value: (r) => SP_normalizeCase(r).clientName },
      { label: "Tipo", value: (r) => SP_normalizeCase(r).type },
      { label: "Prioridad", value: (r) => SP_normalizeCase(r).priority },
      { label: "Estado", value: (r) => SP_normalizeCase(r).status },
      { label: "Responsable", value: (r) => SP_normalizeCase(r).advisorName },
      { label: "SLA", value: (r) => SP_normalizeCase(r).slaText },
      { label: "Acción sugerida", value: (r) => SP_normalizeCase(r).action },
    ],
    rows || []
  );
}

function SP_exportAdvisors(filename, rows) {
  SP_exportExcel(
    filename,
    "Carga de asesores - Supervisor",
    [
      { label: "Asesor", value: (r) => SP_normalizeAdvisor(r).name },
      { label: "Especialidad", value: (r) => SP_normalizeAdvisor(r).specialty },
      { label: "Estado", value: (r) => SP_normalizeAdvisor(r).status },
      { label: "Casos", value: (r) => SP_normalizeAdvisor(r).cases },
      { label: "Críticos", value: (r) => SP_normalizeAdvisor(r).critical },
      { label: "Riesgo SLA", value: (r) => SP_normalizeAdvisor(r).slaRisk },
      { label: "Productividad", value: (r) => `${SP_normalizeAdvisor(r).productivity}%` },
      { label: "Capacidad", value: (r) => `${SP_normalizeAdvisor(r).capacity}%` },
    ],
    rows || []
  );
}

function SP_exportIndicators() {
  SP_exportExcel(
    "indicadores_supervisor",
    "Indicadores operativos - Supervisor",
    [
      { label: "Indicador", value: (r) => SP_normalizeIndicator(r).title },
      { label: "Valor", value: (r) => SP_normalizeIndicator(r).value },
      { label: "Meta", value: (r) => SP_normalizeIndicator(r).target },
      { label: "Tendencia", value: (r) => SP_normalizeIndicator(r).trend },
      { label: "Estado", value: (r) => SP_normalizeIndicator(r).status },
      { label: "Descripción", value: (r) => SP_normalizeIndicator(r).description },
    ],
    Mock.indicators || []
  );
}

function SP_exportReports() {
  SP_exportExcel(
    "reportes_supervisor",
    "Historial de reportes - Supervisor",
    [
      { label: "Reporte", value: (r) => r.name || r.nombre },
      { label: "Tipo", value: (r) => r.type || r.tipo },
      { label: "Periodo", value: (r) => r.period || r.periodo },
      { label: "Formato", value: (r) => r.format || r.formato },
      { label: "Estado", value: (r) => r.status || r.estado },
      { label: "Generado por", value: (r) => r.owner || r.generado_por },
    ],
    Mock.reports || []
  );
}

function SP_exportAudit() {
  SP_exportExcel(
    "auditoria_supervisor",
    "Trazabilidad de auditoría - Supervisor",
    [
      { label: "Fecha", value: (r) => r.date || r.fecha },
      { label: "Caso", value: (r) => r.caseId || r.codigo_caso },
      { label: "Tipo", value: (r) => r.type || r.tipo },
      { label: "Acción", value: (r) => r.action || r.accion },
      { label: "Usuario", value: (r) => r.user || r.usuario },
      { label: "Antes", value: (r) => r.before || r.valor_anterior },
      { label: "Después", value: (r) => r.after || r.valor_nuevo },
      { label: "Detalle", value: (r) => r.detail || r.detalle },
    ],
    Mock.audit || []
  );
}

function SP_exportConfig() {
  SP_exportExcel(
    "configuracion_supervisor",
    "Configuración de supervisión",
    [
      { label: "Regla", value: (r) => r.title || r.titulo || r.clave },
      { label: "Categoría", value: (r) => r.category || r.categoria },
      { label: "Valor", value: (r) => r.value || r.valor },
      { label: "Estado", value: (r) => r.status || r.estado },
      { label: "Descripción", value: (r) => r.description || r.descripcion },
    ],
    Mock.configRules || []
  );
}

async function askBot(prompt) {
  openBot();
  addMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando";

  $("#botMessages")?.appendChild(typing);

  try {
    const response = await SP_api("/supervisor/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        prompt,
        case_id: State.selectedCaseId,
        advisor_id: State.selectedAdvisorId,
        indicator_id: State.selectedIndicatorId,
      }),
    });

    typing.remove();

    addMessage(response.answer || response.respuesta || "No se recibió respuesta del asistente.", "bot");
  } catch {
    typing.remove();
    addMessage(botAnswer(prompt), "bot");
  }
}