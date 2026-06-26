"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ASESOR.JS
   Frontend profesional para módulo Asesor
   Preparado para FastAPI + SQL Server + catálogos desde BD
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

/* =========================================================
   ESTADO GLOBAL
========================================================= */

const State = {
  page: document.body.dataset.page || "",
  theme:
    localStorage.getItem("claro360-asesor-theme") ||
    localStorage.getItem("claro360-theme") ||
    "light",

  user: null,
  advisor: null,

  cases: [],
  templates: [],
  notifications: [],
  performance: null,

  catalogs: {
    estadosCaso: [],
    prioridades: [],
    canales: [],
    areasDerivacion: [],
    visibilidades: [],
    categoriasPlantilla: [],
    variablesPlantilla: [],
    tiposCaso: [],
    motivosReclamo: [],
    plazosRespuesta: [],
    formatosExportacion: []
  },

  selectedCaseId: null,
  selectedTemplateId: null,
  selectedNotificationId: null,
  selectedCase: null,
  selectedTemplateCase: null,

  inboxFilter: "todos",
  queueFilter: "todos",
  slaFilter: "todos",
  templateFilter: "todos",
  notificationFilter: "todas",

  queueView: "cards",
  performancePeriod: "semana",
  slaView: "semana",

  pendingConfirmAction: null,
  currentExport: null,

  loading: {
    catalogs: false,
    cases: false,
    templates: false,
    notifications: false,
    performance: false
  }
};

/* =========================================================
   CONSTANTES
========================================================= */

const PAGE_LINKS = [
  ["📊", "Dashboard", "Resumen operativo del asesor", "dashboard.html"],
  ["📥", "Bandeja", "Casos asignados y acciones rápidas", "bandeja.html"],
  ["🧾", "Detalle de atención", "Ficha integral del caso", "detalle-atencion.html"],
  ["🗂️", "Cola de trabajo", "Tablero Kanban operativo", "cola-trabajo.html"],
  ["⏱️", "Calendario SLA", "Vencimientos y alertas", "calendario-sla.html"],
  ["💬", "Plantillas", "Catálogo de respuestas", "plantillas-respuesta.html"],
  ["🔔", "Notificaciones", "Alertas operativas", "notificaciones.html"],
  ["📈", "Rendimiento", "Indicadores del asesor", "rendimiento.html"]
];

const CASE_STATUS = {
  NUEVO: "nuevo",
  EN_ATENCION: "en_atencion",
  PENDIENTE_CLIENTE: "pendiente_cliente",
  DERIVADO: "derivado",
  LISTO_CIERRE: "listo_cierre",
  CERRADO: "cerrado",
  VENCIDO: "vencido"
};

const CASE_STATUS_LABELS = {
  nuevo: "Nuevo",
  en_atencion: "En atención",
  pendiente_cliente: "Pendiente por cliente",
  derivado: "Derivado",
  listo_cierre: "Listo para cierre",
  cerrado: "Cerrado",
  vencido: "Vencido"
};

const QUEUE_GROUPS = [
  CASE_STATUS.NUEVO,
  CASE_STATUS.EN_ATENCION,
  CASE_STATUS.PENDIENTE_CLIENTE,
  CASE_STATUS.DERIVADO,
  CASE_STATUS.LISTO_CIERRE,
  CASE_STATUS.CERRADO
];

const EXPORT_ENDPOINTS = {
  bandeja: "/asesor/exportar/bandeja",
  cola: "/asesor/exportar/cola",
  sla: "/asesor/exportar/sla",
  plantillas: "/asesor/exportar/plantillas",
  rendimiento: "/asesor/exportar/rendimiento"
};

/* =========================================================
   SELECTORES Y HELPERS BÁSICOS
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

function isChecked(selector) {
  return Boolean($(selector)?.checked);
}

function show(element, condition) {
  if (element) element.classList.toggle("hidden", !condition);
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_")
    .replaceAll("-", "_")
    .replaceAll("/", "_");
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

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

function setButtonLoading(button, loading, text = "Procesando...") {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
    button.classList.add("is-loading");
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

/* =========================================================
   SESIÓN Y API
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
  localStorage.removeItem("claro360-selected-case");
  localStorage.removeItem("claro360-asesor-selected-case");
}

function requireAdvisorSession() {
  const token = getToken();
  const storedUser = getStoredUser();

  if (!token || !storedUser?.rol) {
    window.location.href = "../login.html?role=asesor";
    return false;
  }

  if (storedUser.rol !== "ASESOR") {
    clearSession();
    window.location.href = "../login.html?role=asesor";
    return false;
  }

  State.user = storedUser;
  return true;
}

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";
  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail.map((item) => item.msg || "Dato inválido").join(" ");
  }

  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  return "No se pudo completar la operación.";
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 25000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      if (response.status === 401 || response.status === 403) {
        clearSession();
        window.location.href = "../login.html?role=asesor";
        return {};
      }

      throw new Error(getApiErrorMessage(data));
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("El servidor tardó demasiado en responder.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   CATÁLOGOS DESDE BD
========================================================= */

function normalizeCatalogItems(rows = [], fallback = []) {
  const source = Array.isArray(rows) && rows.length ? rows : fallback;

  return source
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: item,
          codigo: normalizeCode(item),
          nombre: item,
          activo: true,
          orden: index + 1
        };
      }

      const nombre =
        item.nombre ||
        item.label ||
        item.descripcion ||
        item.name ||
        item.valor ||
        item.value ||
        item.codigo ||
        `Opción ${index + 1}`;

      const codigo =
        item.codigo ||
        item.code ||
        item.value ||
        normalizeCode(nombre);

      return {
        id: item.id ?? item.catalogo_id ?? item.value ?? codigo,
        codigo,
        nombre,
        activo: item.activo ?? item.active ?? true,
        orden: item.orden ?? item.order ?? index + 1,
        metadata: item
      };
    })
    .filter((item) => item.activo !== false)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

function fallbackCatalogs() {
  return {
    estadosCaso: normalizeCatalogItems([], [
      "Nuevo",
      "En atención",
      "Pendiente por cliente",
      "Derivado",
      "Listo para cierre",
      "Cerrado"
    ]),
    prioridades: normalizeCatalogItems([], [
      "Crítica",
      "Alta",
      "Media",
      "Baja"
    ]),
    canales: normalizeCatalogItems([], [
      "Portal cliente",
      "Correo electrónico",
      "SMS",
      "WhatsApp"
    ]),
    areasDerivacion: normalizeCatalogItems([], [
      "Soporte técnico",
      "Facturación",
      "Backoffice comercial",
      "Retenciones",
      "Legal / reclamos formales"
    ]),
    visibilidades: normalizeCatalogItems([], [
      "Interna",
      "Visible para cliente"
    ]),
    categoriasPlantilla: normalizeCatalogItems([], [
      "Evidencia",
      "Reclamo",
      "Derivación",
      "Seguimiento SLA",
      "Cierre",
      "Disculpa / compensación"
    ]),
    variablesPlantilla: normalizeCatalogItems([], [
      "{cliente_nombre}",
      "{codigo_caso}",
      "{servicio_afectado}",
      "{fecha_limite_sla}",
      "{asesor_nombre}",
      "{estado_caso}",
      "{motivo_reclamo}"
    ]),
    tiposCaso: normalizeCatalogItems([], [
      "Reclamo",
      "Incidencia",
      "Consulta",
      "Solicitud"
    ]),
    motivosReclamo: normalizeCatalogItems([], [
      "Facturación",
      "Falla de servicio",
      "Cobertura",
      "Instalación",
      "Cambio de plan",
      "Atención comercial"
    ]),
    plazosRespuesta: normalizeCatalogItems([], [
      "24 horas",
      "48 horas",
      "72 horas",
      "5 días hábiles"
    ]),
    formatosExportacion: normalizeCatalogItems([], [
      "PDF",
      "Excel",
      "CSV"
    ])
  };
}

async function loadCatalogs() {
  if (State.loading.catalogs) return State.catalogs;

  State.loading.catalogs = true;

  try {
    const response = await apiRequest("/asesor/catalogos");
    const fallback = fallbackCatalogs();

    State.catalogs = {
      estadosCaso: normalizeCatalogItems(
        response.estados_caso || response.estadosCaso,
        fallback.estadosCaso
      ),
      prioridades: normalizeCatalogItems(
        response.prioridades,
        fallback.prioridades
      ),
      canales: normalizeCatalogItems(
        response.canales || response.canales_comunicacion,
        fallback.canales
      ),
      areasDerivacion: normalizeCatalogItems(
        response.areas_derivacion || response.areasDerivacion,
        fallback.areasDerivacion
      ),
      visibilidades: normalizeCatalogItems(
        response.visibilidades || response.visibilidad_comentario,
        fallback.visibilidades
      ),
      categoriasPlantilla: normalizeCatalogItems(
        response.categorias_plantilla || response.categoriasPlantilla,
        fallback.categoriasPlantilla
      ),
      variablesPlantilla: normalizeCatalogItems(
        response.variables_plantilla || response.variablesPlantilla,
        fallback.variablesPlantilla
      ),
      tiposCaso: normalizeCatalogItems(
        response.tipos_caso || response.tiposCaso,
        fallback.tiposCaso
      ),
      motivosReclamo: normalizeCatalogItems(
        response.motivos_reclamo || response.motivosReclamo,
        fallback.motivosReclamo
      ),
      plazosRespuesta: normalizeCatalogItems(
        response.plazos_respuesta || response.plazosRespuesta,
        fallback.plazosRespuesta
      ),
      formatosExportacion: normalizeCatalogItems(
        response.formatos_exportacion || response.formatosExportacion,
        fallback.formatosExportacion
      )
    };
  } catch {
    State.catalogs = fallbackCatalogs();

    toast(
      "Catálogos temporales",
      "Cuando conectemos backend, estos desplegables se cargarán desde SQL Server.",
      "warning"
    );
  } finally {
    State.loading.catalogs = false;
  }

  return State.catalogs;
}

function getCatalog(name) {
  return State.catalogs?.[name] || fallbackCatalogs()[name] || [];
}

function populateSelect(selector, catalogName, options = {}) {
  const select = $(selector);
  if (!select) return;

  const {
    placeholder = "Seleccionar",
    valueField = "nombre",
    labelField = "nombre",
    keepValue = true
  } = options;

  const current = select.value;
  const rows = getCatalog(catalogName);

  select.innerHTML = `
    <option value="">${esc(placeholder)}</option>
    ${rows
      .map(
        (item) => `
        <option value="${esc(item[valueField] ?? item.nombre)}">
          ${esc(item[labelField] ?? item.nombre)}
        </option>
      `
      )
      .join("")}
  `;

  if (keepValue && current) {
    const exists = Array.from(select.options).some(
      (option) => option.value === current
    );

    if (exists) select.value = current;
  }
}

function populateCatalogDrivenUI() {
  [
    "#queueUpdateStatus",
    "#quickUpdateStatus",
    "#moveCaseStatus"
  ].forEach((selector) => populateSelect(selector, "estadosCaso"));

  [
    "#queueUpdateVisibility",
    "#quickUpdateVisibility",
    "#moveCaseVisibility"
  ].forEach((selector) => populateSelect(selector, "visibilidades"));

  [
    "#queueRequestChannel",
    "#quickRequestChannel",
    "#workQueueRequestChannel",
    "#slaReminderChannel",
    "#templateChannel"
  ].forEach((selector) => populateSelect(selector, "canales"));

  [
    "#queueRequestDeadline",
    "#quickRequestDeadline",
    "#workQueueRequestDeadline",
    "#slaReminderDeadline"
  ].forEach((selector) => populateSelect(selector, "plazosRespuesta"));

  [
    "#queueDeriveArea",
    "#deriveArea"
  ].forEach((selector) => populateSelect(selector, "areasDerivacion"));

  [
    "#queueDerivePriority",
    "#derivePriority"
  ].forEach((selector) => populateSelect(selector, "prioridades"));

  populateSelect("#newTemplateCategory", "categoriasPlantilla", {
    valueField: "codigo",
    labelField: "nombre"
  });
}

/* =========================================================
   NORMALIZACIÓN DE DATOS
========================================================= */

function normalizeStatusCode(value) {
  const code = normalizeCode(value);

  if (!code) return CASE_STATUS.NUEVO;
  if (["registrado", "nuevo"].includes(code)) return CASE_STATUS.NUEVO;
  if (["en_atencion", "atencion", "en_proceso"].includes(code)) return CASE_STATUS.EN_ATENCION;
  if (["pendiente_cliente", "pendiente_por_cliente", "pendiente"].includes(code)) return CASE_STATUS.PENDIENTE_CLIENTE;
  if (["derivado", "escalado"].includes(code)) return CASE_STATUS.DERIVADO;
  if (["listo_cierre", "listo_para_cierre"].includes(code)) return CASE_STATUS.LISTO_CIERRE;
  if (["cerrado", "resuelto", "finalizado"].includes(code)) return CASE_STATUS.CERRADO;
  if (["vencido"].includes(code)) return CASE_STATUS.VENCIDO;

  return code;
}

function displayStatus(value) {
  const code = normalizeStatusCode(value);
  return CASE_STATUS_LABELS[code] || String(value || "Nuevo");
}

function normalizePriorityCode(value) {
  const code = normalizeCode(value);

  if (["critica", "critico", "muy_alta"].includes(code)) return "critica";
  if (["alta"].includes(code)) return "alta";
  if (["media", "normal"].includes(code)) return "media";
  if (["baja"].includes(code)) return "baja";

  return code || "media";
}

function statusType(status) {
  const code = normalizeStatusCode(status);

  if ([CASE_STATUS.CERRADO, CASE_STATUS.LISTO_CIERRE].includes(code)) return "success";
  if (code === CASE_STATUS.PENDIENTE_CLIENTE) return "warning";
  if (code === CASE_STATUS.VENCIDO) return "danger";
  if (code === CASE_STATUS.DERIVADO) return "purple";

  return "info";
}

function priorityType(priority) {
  const code = normalizePriorityCode(priority);

  if (code === "critica") return "danger";
  if (code === "alta") return "warning";
  if (code === "media") return "info";

  return "success";
}

function priorityValue(priority) {
  const code = normalizePriorityCode(priority);

  if (code === "critica") return 4;
  if (code === "alta") return 3;
  if (code === "media") return 2;

  return 1;
}

function pillClass(type) {
  return `status-pill status-pill--${type || "info"}`;
}

function getSlaGroup(hours) {
  const value = Number(hours);

  if (value <= 0) return "vencido";
  if (value <= 8) return "hoy";
  if (value <= 24) return "mañana";

  return "semana";
}

function normalizeQueueStatus(status) {
  return normalizeStatusCode(status);
}

function normalizeCase(item = {}) {
  const rawDeadline =
    item.fecha_limite_resolucion ||
    item.fecha_limite_sla ||
    item.deadline ||
    item.sla_deadline;

  const deadline = rawDeadline ? new Date(rawDeadline) : null;
  const nowDate = new Date();

  const computedHours =
    deadline && !Number.isNaN(deadline.getTime())
      ? Math.ceil((deadline - nowDate) / 3600000)
      : Number(item.sla_hours ?? item.slaHours ?? item.horas_sla ?? 999);

  const rawStatus = item.status || item.estado || item.estado_caso || "Registrado";
  const statusCode = normalizeStatusCode(rawStatus);
  const status = displayStatus(rawStatus);

  const rawQueueStatus =
    item.queueStatus ||
    item.queue_status ||
    item.estado_cola ||
    rawStatus;

  const queueStatus = normalizeQueueStatus(rawQueueStatus);

  const code =
    item.code ||
    item.codigo_caso ||
    item.codigo ||
    item.id ||
    item.caso_id ||
    "-";

  const id = item.id || item.caso_id || code;
  const type = item.type || item.tipo_caso || item.tipo || "Caso";
  const priority = item.priority || item.prioridad || "Media";

  const clientName =
    item.clientName ||
    item.cliente_nombre ||
    item.cliente ||
    item.nombre_cliente ||
    "Cliente";

  const title = item.title || item.titulo || item.asunto || code;
  const description = item.description || item.descripcion || item.detalle || "";
  const service = item.service || item.servicio || item.servicio_nombre || "Servicio asociado";

  return {
    id,
    caseId: id,
    code,
    icon: item.icon || (String(type).toLowerCase().includes("incidencia") ? "⚠️" : "📝"),
    type,
    clientType: item.clientType || item.tipo_cliente || "Cliente",
    clientName,
    document: item.document || item.documento || item.documento_numero || "-",
    title,
    description,
    reason: item.reason || item.motivo || item.motivo_reclamo || description,
    service,
    channel: item.channel || item.canal || "Portal cliente",
    priority,
    priorityCode: normalizePriorityCode(priority),
    status,
    statusCode,
    queueStatus,
    queueStatusLabel: displayStatus(queueStatus),
    slaHours: computedHours,
    slaText:
      item.slaText ||
      item.sla ||
      item.sla_text ||
      item.tiempo_sla ||
      (computedHours === 999
        ? "Sin plazo"
        : computedHours <= 0
          ? "Vencido"
          : `${computedHours}h restantes`),
    slaGroup:
      item.slaGroup ||
      item.sla_group ||
      item.grupo_sla ||
      getSlaGroup(computedHours),
    createdAt: item.createdAt || item.fecha_registro || item.created_at || item.fecha || "",
    updatedAt: item.updatedAt || item.fecha_actualizacion || item.updated_at || "",
    deadline: rawDeadline || "",
    assignedTo: item.assignedTo || item.asesor || item.responsable || "Asesor",
    action: item.action || item.accion || item.proximo_paso || "Revisar seguimiento",
    evidence: item.evidence || item.evidencias || [],
    history: item.history || item.historial || item.timeline || [],
    raw: item
  };
}

function slaRisk(caseItem) {
  const c = normalizeCase(caseItem);

  return (
    Number(c.slaHours) <= 8 &&
    ![CASE_STATUS.CERRADO].includes(c.statusCode)
  );
}

function normalizeTemplate(item = {}) {
  return {
    id: item.id || item.plantilla_id || item.codigo || item.nombre,
    icon: item.icon || "💬",
    category: normalizeCode(item.category || item.categoria || "general"),
    categoryLabel: item.categoria_nombre || item.categoryLabel || item.categoria || "General",
    title: item.title || item.nombre || item.titulo || "Plantilla",
    channel: item.channel || item.canal || item.canal_nombre || "Portal cliente",
    description: item.description || item.descripcion || "",
    body: item.body || item.contenido || item.mensaje || "",
    active: item.active ?? item.activo ?? true,
    oficial: item.oficial ?? item.es_oficial ?? false,
    version: item.version || item.version_actual || "1.0",
    updatedAt: item.updatedAt || item.fecha_actualizacion || item.updated_at || "",
    raw: item
  };
}

function getNotificationIcon(type) {
  const value = normalizeCode(type);

  if (value.includes("sla")) return "⏱️";
  if (value.includes("cliente")) return "📩";
  if (value.includes("asign")) return "📥";
  if (value.includes("deriv")) return "🔀";
  if (value.includes("cierre")) return "✅";

  return "🔔";
}

function normalizeNotification(item = {}) {
  const priority = normalizePriorityCode(item.priority || item.prioridad || "media");

  return {
    id: item.id || item.notificacion_id,
    icon: item.icon || getNotificationIcon(item.tipo || item.type),
    type: normalizeCode(item.type || item.tipo || "sistema"),
    typeLabel: item.tipo_nombre || item.typeLabel || item.tipo || "Sistema",
    priority,
    priorityLabel: item.prioridad || item.priority || "Media",
    unread: Boolean(item.unread ?? item.no_leida ?? item.leida === false ?? !item.leida),
    caseId: item.caseId || item.codigo_caso || item.caso_codigo || item.caso_id || "-",
    title: item.title || item.titulo || "Notificación",
    text: item.text || item.message || item.mensaje || "",
    date: item.date || item.fecha || item.fecha_generacion || "",
    raw: item
  };
}

/* =========================================================
   LOCAL STORAGE DE CASO
========================================================= */

function saveSelectedCase(id) {
  State.selectedCaseId = id;
  localStorage.setItem("claro360-selected-case", id);
  localStorage.setItem("claro360-asesor-selected-case", id);
}

function getCaseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return (
    params.get("caso") ||
    params.get("codigo") ||
    params.get("id") ||
    localStorage.getItem("claro360-asesor-selected-case") ||
    localStorage.getItem("claro360-selected-case") ||
    ""
  );
}

function getCase(id) {
  return (
    State.cases
      .map(normalizeCase)
      .find(
        (item) =>
          String(item.id) === String(id) ||
          String(item.code) === String(id)
      ) || null
  );
}

function getTemplate(id) {
  return (
    State.templates
      .map(normalizeTemplate)
      .find((item) => String(item.id) === String(id)) || null
  );
}

function getNotification(id) {
  return (
    State.notifications
      .map(normalizeNotification)
      .find((item) => String(item.id) === String(id)) || null
  );
}

function goToDetail(id) {
  if (!id) {
    genericModal("🧾", "Caso no seleccionado", "Selecciona un caso válido antes de abrir el detalle.");
    return;
  }

  saveSelectedCase(id);
  window.location.href = `detalle-atencion.html?caso=${encodeURIComponent(id)}`;
}

/* =========================================================
   TOAST Y MODALES GENERALES
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
  }, 3500);
}

function openModal(selector) {
  const modal = $(selector);

  if (!modal) {
    toast("Ventana no disponible", "La operación no está disponible en esta pantalla.", "warning");
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

function genericModal(icon, title, message) {
  setText("#genericModalIcon", icon);
  setText("#genericModalTitle", title);
  setText("#genericModalText", message);
  openModal("#genericModal");
}

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

function caseSummary(c) {
  const item = normalizeCase(c);

  return summaryHTML([
    ["Código", item.code],
    ["Cliente", item.clientName],
    ["Tipo", item.type],
    ["Servicio", item.service],
    ["Prioridad", item.priority],
    ["Estado", item.status],
    ["SLA", item.slaText],
    ["Acción sugerida", item.action]
  ]);
}

/* =========================================================
   MODALES PROFESIONALES INYECTADOS POR JS
========================================================= */

function ensureEnterpriseModals() {
  if (!$("#confirmActionModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <section class="modal" id="confirmActionModal" aria-hidden="true">
        <div class="modal__content modal__content--wide">
          <button type="button" class="modal__close" data-close-modal>×</button>

          <div class="modal__icon" id="confirmActionIcon">⚠️</div>
          <span class="eyebrow eyebrow--red" id="confirmActionEyebrow">Confirmación</span>
          <h3 id="confirmActionTitle">Confirmar operación</h3>
          <p id="confirmActionText">Revisa la información antes de continuar.</p>

          <div class="case-modal-summary" id="confirmActionSummary"></div>

          <label class="form-check" id="confirmActionCheckWrap">
            <input type="checkbox" id="confirmActionCheck" />
            <span id="confirmActionCheckText">Confirmo que deseo continuar con esta operación.</span>
          </label>

          <div class="modal__actions">
            <button type="button" class="btn btn--primary" id="confirmActionPrimaryBtn">
              Confirmar
            </button>

            <button type="button" class="btn btn--ghost-dark" data-close-modal>
              Cancelar
            </button>
          </div>
        </div>
      </section>
    `
    );
  }

  if (!$("#exportModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <section class="modal" id="exportModal" aria-hidden="true">
        <div class="modal__content modal__content--wide">
          <button type="button" class="modal__close" data-close-modal>×</button>

          <div class="modal__icon">📤</div>
          <span class="eyebrow eyebrow--red">Exportación</span>
          <h3 id="exportModalTitle">Exportar información</h3>
          <p id="exportModalText">Configura el reporte antes de descargarlo.</p>

          <div class="form-grid">
            <div class="form-group">
              <label for="exportFormat">Formato</label>
              <select id="exportFormat"></select>
            </div>

            <div class="form-group">
              <label for="exportScope">Alcance</label>
              <select id="exportScope">
                <option value="vista_actual">Vista actual</option>
                <option value="todos">Todos los registros</option>
                <option value="criticos">Solo críticos / riesgo SLA</option>
                <option value="personalizado">Rango personalizado</option>
              </select>
            </div>
          </div>

          <div class="form-grid hidden" id="exportDateRange">
            <div class="form-group">
              <label for="exportFrom">Desde</label>
              <input id="exportFrom" type="date" />
            </div>

            <div class="form-group">
              <label for="exportTo">Hasta</label>
              <input id="exportTo" type="date" />
            </div>
          </div>

          <label class="form-check">
            <input type="checkbox" id="exportIncludeDetail" checked />
            <span>Incluir detalle operativo y trazabilidad disponible.</span>
          </label>

          <label class="form-check">
            <input type="checkbox" id="exportDeclaration" />
            <span>Confirmo que la exportación será usada solo para gestión interna.</span>
          </label>

          <div class="case-modal-summary" id="exportModalSummary"></div>

          <div class="modal__actions">
            <button type="button" class="btn btn--primary" id="confirmExportBtn">
              Descargar
            </button>

            <button type="button" class="btn btn--ghost-dark" data-close-modal>
              Cancelar
            </button>
          </div>
        </div>
      </section>
    `
    );
  }

  if (!$("#shareCaseModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <section class="modal" id="shareCaseModal" aria-hidden="true">
        <div class="modal__content modal__content--wide">
          <button type="button" class="modal__close" data-close-modal>×</button>

          <div class="modal__icon">🔗</div>
          <span class="eyebrow eyebrow--red">Compartir caso</span>
          <h3>Compartir información del caso</h3>
          <p>Genera una referencia interna segura para continuar la atención.</p>

          <div class="case-modal-summary" id="shareCaseSummary"></div>

          <div class="form-group">
            <label for="shareCaseText">Resumen interno</label>
            <textarea id="shareCaseText" readonly></textarea>
          </div>

          <div class="modal__actions">
            <button type="button" class="btn btn--primary" id="copyShareCaseBtn">
              Copiar resumen
            </button>

            <button type="button" class="btn btn--soft" id="copyShareCaseLinkBtn">
              Copiar enlace
            </button>

            <button type="button" class="btn btn--ghost-dark" data-close-modal>
              Cerrar
            </button>
          </div>
        </div>
      </section>
    `
    );
  }

  $("#confirmActionPrimaryBtn")?.addEventListener("click", runPendingConfirmAction);
  $("#confirmExportBtn")?.addEventListener("click", confirmExportDownload);

  $("#exportScope")?.addEventListener("change", () => {
    show($("#exportDateRange"), getValue("#exportScope") === "personalizado");
  });

  $("#copyShareCaseBtn")?.addEventListener("click", copyCaseSummary);
  $("#copyShareCaseLinkBtn")?.addEventListener("click", copyCaseLink);
}

function openConfirmAction(config = {}) {
  const {
    icon = "⚠️",
    eyebrow = "Confirmación",
    title = "Confirmar operación",
    text = "Revisa la información antes de continuar.",
    summary = "",
    checkText = "Confirmo que deseo continuar con esta operación.",
    requireCheck = true,
    confirmLabel = "Confirmar",
    onConfirm = null
  } = config;

  State.pendingConfirmAction = onConfirm;

  setText("#confirmActionIcon", icon);
  setText("#confirmActionEyebrow", eyebrow);
  setText("#confirmActionTitle", title);
  setText("#confirmActionText", text);
  setText("#confirmActionCheckText", checkText);
  setText("#confirmActionPrimaryBtn", confirmLabel);
  setHTML("#confirmActionSummary", summary || "");

  const check = $("#confirmActionCheck");
  if (check) check.checked = false;

  show($("#confirmActionCheckWrap"), requireCheck);
  openModal("#confirmActionModal");
}

async function runPendingConfirmAction() {
  const checkRequired = !$("#confirmActionCheckWrap")?.classList.contains("hidden");

  if (checkRequired && !isChecked("#confirmActionCheck")) {
    toast("Confirmación requerida", "Marca la casilla de confirmación para continuar.", "warning");
    return;
  }

  if (typeof State.pendingConfirmAction !== "function") {
    closeModals();
    return;
  }

  const action = State.pendingConfirmAction;
  State.pendingConfirmAction = null;

  await action();
}

function openExportModal(type, config = {}) {
  State.currentExport = {
    type,
    endpoint: config.endpoint,
    filename: config.filename || `claro360-${type}`,
    params: config.params || {},
    title: config.title || "Exportar información",
    text: config.text || "Configura el archivo antes de descargarlo."
  };

  populateSelect("#exportFormat", "formatosExportacion", {
    valueField: "codigo",
    labelField: "nombre"
  });

  const formatSelect = $("#exportFormat");

  if (formatSelect && !formatSelect.value) {
    const pdfOption = Array.from(formatSelect.options).find(
      (option) => normalizeCode(option.textContent) === "pdf"
    );

    if (pdfOption) formatSelect.value = pdfOption.value;
  }

  setText("#exportModalTitle", State.currentExport.title);
  setText("#exportModalText", State.currentExport.text);

  setHTML(
    "#exportModalSummary",
    summaryHTML([
      ["Módulo", type],
      ["Filtro activo", config.activeFilter || "Vista actual"],
      ["Registros visibles", config.visibleCount ?? "-"],
      ["Usuario", State.advisor?.nombre || State.user?.nombre || "Asesor"]
    ])
  );

  if ($("#exportTo")) $("#exportTo").value = todayISO();
  if ($("#exportFrom")) $("#exportFrom").value = "";
  if ($("#exportDeclaration")) $("#exportDeclaration").checked = false;
  if ($("#exportScope")) $("#exportScope").value = "vista_actual";

  show($("#exportDateRange"), false);
  openModal("#exportModal");
}

async function confirmExportDownload() {
  if (!State.currentExport) return;

  if (!getValue("#exportFormat")) {
    toast("Formato requerido", "Selecciona un formato de exportación.", "warning");
    return;
  }

  if (!isChecked("#exportDeclaration")) {
    toast("Confirmación requerida", "Confirma el uso interno de la información.", "warning");
    return;
  }

  const scope = getValue("#exportScope");

  const params = {
    ...State.currentExport.params,
    formato: getValue("#exportFormat"),
    alcance: scope,
    incluir_detalle: isChecked("#exportIncludeDetail") ? "1" : "0",
    desde: scope === "personalizado" ? getValue("#exportFrom") : "",
    hasta: scope === "personalizado" ? getValue("#exportTo") : ""
  };

  if (scope === "personalizado" && (!params.desde || !params.hasta)) {
    toast("Rango requerido", "Selecciona fecha desde y hasta para exportación personalizada.", "warning");
    return;
  }

  await downloadFromApi(State.currentExport.endpoint, params, State.currentExport.filename);
  closeModals();
}

async function downloadFromApi(endpoint, params = {}, filename = "reporte") {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}${buildQuery(params)}`, {
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      }
    });

    if (!response.ok) {
      let message = "No se pudo generar el archivo.";

      try {
        const data = await response.json();
        message = getApiErrorMessage(data);
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();
    const format = normalizeCode(params.formato || "pdf");

    const extension = format.includes("excel") || format.includes("xlsx")
      ? "xlsx"
      : format.includes("csv")
        ? "csv"
        : "pdf";

    const safeName = `${filename}-${todayISO()}.${extension}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = safeName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    toast("Descarga iniciada", `Se generó el archivo ${safeName}.`, "success");
  } catch (error) {
    genericModal("📤", "Exportación no disponible", error.message);
  }
}

function openShareCaseModal() {
  const c = State.selectedCase || getCase(State.selectedCaseId);

  if (!c) {
    genericModal("🔗", "Caso no seleccionado", "Selecciona un caso antes de compartir.");
    return;
  }

  const url = `${window.location.origin}${window.location.pathname}?caso=${encodeURIComponent(c.id)}`;

  const summary = [
    `Caso: ${c.code}`,
    `Cliente: ${c.clientName}`,
    `Servicio: ${c.service}`,
    `Estado: ${c.status}`,
    `Prioridad: ${c.priority}`,
    `SLA: ${c.slaText}`,
    `Acción sugerida: ${c.action}`,
    `Enlace interno: ${url}`
  ].join("\n");

  setHTML("#shareCaseSummary", caseSummary(c));

  const textarea = $("#shareCaseText");
  if (textarea) textarea.value = summary;

  openModal("#shareCaseModal");
}

async function copyCaseSummary() {
  const text = getValue("#shareCaseText");
  if (!text) return;

  await navigator.clipboard.writeText(text);
  toast("Resumen copiado", "El resumen interno del caso fue copiado.", "success");
}

async function copyCaseLink() {
  const c = State.selectedCase || getCase(State.selectedCaseId);
  if (!c) return;

  const url = `${window.location.origin}${window.location.pathname}?caso=${encodeURIComponent(c.id)}`;

  await navigator.clipboard.writeText(url);
  toast("Enlace copiado", "El enlace interno del caso fue copiado.", "success");
}

/* =========================================================
   RENDERIZADORES GENERALES
========================================================= */

function initials(name) {
  return (
    String(name || "Asesor")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AS"
  );
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
            const text = item.text ?? item.descripcion ?? item[1] ?? "";

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
          <p>El análisis se mostrará cuando el sistema entregue información para esta pantalla.</p>
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
        const text = item.text ?? item[2] ?? "";

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
    list.length
      ? list
          .map(
            (item) => `
            <article class="activity-item">
              <span class="activity-icon">${esc(item.icon || "🕘")}</span>
              <div class="activity-content">
                <strong>${esc(item.title || item.accion || item.titulo || "Movimiento")}</strong>
                <p>${esc(item.text || item.observacion || item.descripcion || "")}</p>
                <small>${esc(formatDateTime(item.date || item.fecha_evento || item.fecha))}</small>
              </div>
            </article>
          `
          )
          .join("")
      : ""
  );
}

function caseCard(caseItem, actions = "default") {
  const c = normalizeCase(caseItem);

  const actionButtons =
    actions === "dashboard"
      ? `
        <button type="button" data-action="view-case" data-case-id="${esc(c.id)}">Vista rápida</button>
        <button type="button" data-action="open-detail" data-case-id="${esc(c.id)}">Detalle</button>
      `
      : actions === "queue"
        ? `
          <button type="button" data-action="open-detail" data-case-id="${esc(c.id)}">Detalle</button>
          <button type="button" data-action="move-case" data-case-id="${esc(c.id)}">Mover</button>
          ${
            c.queueStatus === CASE_STATUS.PENDIENTE_CLIENTE
              ? `<button type="button" data-action="request-case" data-case-id="${esc(c.id)}">Solicitar</button>`
              : ""
          }
          ${
            c.queueStatus === CASE_STATUS.LISTO_CIERRE
              ? `<button type="button" data-action="close-case" data-case-id="${esc(c.id)}">Cerrar</button>`
              : ""
          }
        `
        : `
          <button type="button" data-action="view-case" data-case-id="${esc(c.id)}">Vista rápida</button>
          <button type="button" data-action="open-detail" data-case-id="${esc(c.id)}">Detalle</button>
          <button type="button" data-action="update-case" data-case-id="${esc(c.id)}">Actualizar</button>
          <button type="button" data-action="request-case" data-case-id="${esc(c.id)}">Solicitar</button>
          <button type="button" data-action="derive-case" data-case-id="${esc(c.id)}">Derivar</button>
        `;

  return `
    <article class="case-card">
      <span class="case-card__icon">${esc(c.icon)}</span>

      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description || c.reason)}</p>

        <div class="case-meta">
          <span>${esc(c.code)}</span>
          <span>${esc(c.clientName)}</span>
          <span>${esc(c.type)}</span>
          <span>${esc(c.service)}</span>
          <span>${esc(c.priority)}</span>
          <span>${esc(c.slaText)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="${pillClass(statusType(c.statusCode))}">${esc(c.status)}</span>
        ${actionButtons}
      </div>
    </article>
  `;
}

function caseRow(caseItem) {
  const c = normalizeCase(caseItem);

  return `
    <tr>
      <td>${esc(c.code)}</td>
      <td>${esc(c.clientName)}</td>
      <td>${esc(c.type)}</td>
      <td>${esc(c.service)}</td>
      <td><span class="${pillClass(priorityType(c.priority))}">${esc(c.priority)}</span></td>
      <td><span class="${pillClass(statusType(c.statusCode))}">${esc(c.status)}</span></td>
      <td>${esc(c.slaText)}</td>
      <td>
        <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
        <button type="button" class="panel-action" data-action="update-case" data-case-id="${esc(c.id)}">Actualizar</button>
      </td>
    </tr>
  `;
}

function bindCaseActions(root = document) {
  $$('[data-action="view-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openCasePreview(btn.dataset.caseId));
  });

  $$('[data-action="queue-preview"]', root).forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      openQueueCasePreview(card.dataset.caseId);
    });
  });

  $$('[data-action="open-detail"]', root).forEach((btn) => {
    btn.addEventListener("click", () => goToDetail(btn.dataset.caseId));
  });

  $$('[data-action="update-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openQueueUpdate(btn.dataset.caseId));
  });

  $$('[data-action="request-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => {
      if (State.page === "asesor-cola-trabajo") {
        openWorkQueueRequest(btn.dataset.caseId);
      } else {
        openQueueRequest(btn.dataset.caseId);
      }
    });
  });

  $$('[data-action="derive-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openQueueDerive(btn.dataset.caseId));
  });

  $$('[data-action="move-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openMoveCase(btn.dataset.caseId));
  });

  $$('[data-action="close-case"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openWorkQueueClose(btn.dataset.caseId));
  });

  $$('[data-action="sla-reminder"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openSlaReminder(btn.dataset.caseId));
  });

  $$('[data-action="sla-follow"]', root).forEach((btn) => {
    btn.addEventListener("click", () => openSlaFollow(btn.dataset.caseId));
  });
}

function openCasePreview(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("🧾", "Caso no encontrado", "No se encontró información del caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setText("#caseModalIcon", c.icon);
  setText("#caseModalTitle", c.code);
  setText("#caseModalText", c.description || c.reason || c.title);
  setHTML("#caseModalSummary", caseSummary(c));

  const detailBtn = $("#caseModalOpenDetailBtn");
  const updateBtn = $("#caseModalUpdateBtn");

  if (detailBtn) detailBtn.onclick = () => goToDetail(c.id);

  if (updateBtn) {
    updateBtn.onclick = () => {
      closeModals();
      if ($("#queueUpdateModal")) openQueueUpdate(c.id);
      else goToDetail(c.id);
    };
  }

  if ($("#caseModal")) openModal("#caseModal");
  else goToDetail(c.id);
}

function openQueueCasePreview(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("🗂️", "Caso no encontrado", "No se encontró información del caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setText("#queueCaseModalIcon", c.icon);
  setText("#queueCaseModalTitle", c.code);
  setText("#queueCaseModalText", c.description || c.title);
  setHTML("#queueCaseModalSummary", caseSummary(c));

  const openBtn = $("#queueOpenDetailBtn");
  const moveBtn = $("#queueMoveCaseBtn");

  if (openBtn) openBtn.onclick = () => goToDetail(c.id);

  if (moveBtn) {
    moveBtn.onclick = () => {
      closeModals();
      openMoveCase(c.id);
    };
  }

  if ($("#queueCaseModal")) openModal("#queueCaseModal");
  else openCasePreview(id);
}

function renderSlaList(selector, rows = []) {
  const list = rows.map(normalizeCase).sort((a, b) => a.slaHours - b.slaHours);

  setHTML(
    selector,
    list
      .map((c) => {
        const meter = Math.max(8, Math.min(100, 100 - Math.max(Number(c.slaHours), 0) * 4));

        return `
          <article class="sla-item">
            <span class="activity-icon">⏱️</span>
            <div>
              <strong>${esc(c.code)} · ${esc(c.priority)}</strong>
              <p>${esc(c.title)} · ${esc(c.slaText)}</p>
              <div class="sla-meter"><span style="width:${meter}%"></span></div>
            </div>
            <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">
              Abrir
            </button>
          </article>
        `;
      })
      .join("")
  );

  bindCaseActions($(selector));
}

function renderQueueBoard(selector, rows = [], includeActions = true) {
  const items = rows.map(normalizeCase);

  setHTML(
    selector,
    QUEUE_GROUPS
      .map((groupCode) => {
        const groupLabel = CASE_STATUS_LABELS[groupCode] || groupCode;

        const groupCases = items.filter((c) => {
          const caseGroup = normalizeStatusCode(c.queueStatus || c.statusCode || c.status);
          return caseGroup === groupCode;
        });

        return `
          <article class="queue-column">
            <div class="queue-column__header">
              <h3>${esc(groupLabel)}</h3>
              <span class="${pillClass("info")}">${groupCases.length}</span>
            </div>

            ${
              groupCases.length
                ? groupCases
                    .map(
                      (c) => `
                      <div class="queue-mini-card" data-action="queue-preview" data-case-id="${esc(c.id)}">
                        <strong>${esc(c.code)}</strong>
                        <p>${esc(c.title)}</p>

                        <div class="case-meta">
                          <span>${esc(c.priority)}</span>
                          <span>${esc(c.slaText)}</span>
                          <span>${esc(c.clientName)}</span>
                        </div>

                        <div class="service-actions">
                          <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">
                            Detalle
                          </button>

                          ${
                            includeActions
                              ? `
                              <button type="button" class="panel-action" data-action="move-case" data-case-id="${esc(c.id)}">
                                Mover
                              </button>
                            `
                              : ""
                          }

                          ${
                            includeActions && groupCode === CASE_STATUS.PENDIENTE_CLIENTE
                              ? `
                              <button type="button" class="panel-action" data-action="request-case" data-case-id="${esc(c.id)}">
                                Solicitar
                              </button>
                            `
                              : ""
                          }

                          ${
                            includeActions && groupCode === CASE_STATUS.LISTO_CIERRE
                              ? `
                              <button type="button" class="panel-action" data-action="close-case" data-case-id="${esc(c.id)}">
                                Cerrar
                              </button>
                            `
                              : ""
                          }
                        </div>
                      </div>
                    `
                    )
                    .join("")
                : `<p class="muted">Sin casos en este estado.</p>`
            }
          </article>
        `;
      })
      .join("")
  );

  bindCaseActions($(selector));
}

function buildCaseKpis(cases) {
  const normalized = cases.map(normalizeCase);

  return [
    {
      icon: "📥",
      value: normalized.length,
      label: "Casos asignados",
      description: "Carga visible"
    },
    {
      icon: "🔥",
      value: normalized.filter((c) => c.priorityCode === "critica").length,
      label: "Críticos",
      description: "Atención inmediata"
    },
    {
      icon: "⏱️",
      value: normalized.filter(slaRisk).length,
      label: "Riesgo SLA",
      description: "Vencimiento cercano"
    },
    {
      icon: "✅",
      value: normalized.filter((c) => c.statusCode === CASE_STATUS.LISTO_CIERRE).length,
      label: "Listos cierre",
      description: "Validación final"
    }
  ];
}

function buildQueueSummary(rows) {
  const normalized = rows.map(normalizeCase);
  const first = normalized[0];

  return [
    {
      title: "Prioridad principal",
      text: first
        ? `Atender primero ${first.code}, por prioridad ${first.priority} y SLA ${first.slaText}.`
        : "No hay casos visibles con el filtro actual."
    },
    {
      title: "Bloqueos",
      text: `${normalized.filter((c) => c.statusCode === CASE_STATUS.PENDIENTE_CLIENTE).length} caso(s) requieren información o confirmación del cliente.`
    },
    {
      title: "Cierres",
      text: `${normalized.filter((c) => c.statusCode === CASE_STATUS.LISTO_CIERRE).length} caso(s) pueden revisarse para cierre.`
    }
  ];
}

function buildSuggestedActions(rows) {
  const normalized = rows.map(normalizeCase);
  const firstSla = normalized.find(slaRisk) || normalized[0];

  return [
    {
      icon: "1",
      title: "Atender primer SLA",
      text: firstSla ? `Abrir ${firstSla.code} y registrar avance.` : "Sin casos visibles."
    },
    {
      icon: "2",
      title: "Desbloquear pendientes",
      text: "Solicitar evidencia o confirmación cuando corresponda."
    },
    {
      icon: "3",
      title: "Validar cierres",
      text: "Cerrar solo con respuesta final, sustento y trazabilidad completa."
    }
  ];
}

function labelFilter(filter) {
  return (
    {
      todos: "Todos",
      todas: "Todas",
      critica: "Críticos",
      critico: "Críticos",
      alta: "Alta prioridad",
      pendiente_cliente: "Pendiente cliente",
      sla_riesgo: "Riesgo SLA",
      listo_cierre: "Listos cierre",
      hoy: "Vence hoy",
      no_leidas: "No leídas",
      cliente: "Respuesta cliente",
      asignacion: "Asignaciones"
    }[filter] || filter
  );
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(State.theme);
  setupBaseUI();
  setupGlobalEvents();
  setupBot();
  setupSearch();
  ensureEnterpriseModals();

  if (!requireAdvisorSession()) return;

  setupUserFromStorage();

  try {
    await loadShellData();
    await loadCatalogs();
    populateCatalogDrivenUI();
  } catch (error) {
    toast("Carga inicial incompleta", error.message, "warning");
  }

  if (State.page === "asesor-dashboard") await initDashboard();
  if (State.page === "asesor-bandeja") await initBandeja();
  if (State.page === "asesor-detalle-atencion") await initDetalleAtencion();
  if (State.page === "asesor-cola-trabajo") await initColaTrabajo();
  if (State.page === "asesor-calendario-sla") await initCalendarioSla();
  if (State.page === "asesor-plantillas-respuesta") await initPlantillas();
  if (State.page === "asesor-notificaciones") await initNotificaciones();
  if (State.page === "asesor-rendimiento") await initRendimiento();
});

/* =========================================================
   BASE UI
========================================================= */

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

function setupUserFromStorage() {
  const user = State.user || getStoredUser();
  const name = user.nombre || user.username || "Asesor";

  setText("#userNameTop", name);
  setText("#userRoleTop", "Asesor de Atención");
  setText("#userAvatar", initials(name));
}

async function loadShellData() {
  const response = await apiRequest("/asesor/me");

  State.advisor = response.advisor || response.asesor || response.user || response;

  const name =
    State.advisor.nombre ||
    State.advisor.name ||
    State.advisor.username ||
    State.user?.nombre ||
    "Asesor";

  setText("#userNameTop", name);
  setText("#userRoleTop", State.advisor.cargo || State.advisor.role || "Asesor de Atención");
  setText("#userAvatar", State.advisor.initials || initials(name));

  await refreshGlobalBadges();
}

async function refreshGlobalBadges() {
  try {
    const response = await apiRequest("/asesor/resumen");

    const assigned = Number(
      response.asignados ??
      response.assigned ??
      response.casos_asignados ??
      0
    );

    const unread = Number(
      response.no_leidas ??
      response.unread ??
      response.notificaciones_no_leidas ??
      0
    );

    setText("#sidebarAssignedCount", assigned);
    setText("#sidebarNotificationCount", unread);
    setText("#notificationBadge", unread || "");
  } catch {
    setText("#sidebarAssignedCount", "0");
    setText("#sidebarNotificationCount", "0");
    setText("#notificationBadge", "");
  }
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
  localStorage.setItem("claro360-theme", theme);
}

function logout() {
  openConfirmAction({
    icon: "↩",
    eyebrow: "Sesión",
    title: "Cerrar sesión",
    text: "Se cerrará tu sesión de asesor y volverás al inicio de sesión.",
    requireCheck: false,
    confirmLabel: "Cerrar sesión",
    onConfirm: async () => {
      clearSession();
      closeModals();
      toast("Sesión cerrada", "Serás redirigido al inicio de sesión.", "success");

      setTimeout(() => {
        window.location.href = "../login.html?role=asesor";
      }, 700);
    }
  });
}

function setupGlobalEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) closeModals();

    const modalBtn = event.target.closest("[data-open-modal]");

    if (modalBtn) {
      event.preventDefault();
      openModal(`#${modalBtn.dataset.openModal}`);
    }
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

/* =========================================================
   BUSCADOR GLOBAL
========================================================= */

function setupSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);
  $("#closeSearchBtn")?.addEventListener("click", closeSearch);

  const input = $("#globalSearchInput");

  if (input) {
    let timer = null;

    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(renderSearch, 280);
    });
  }
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
    box.innerHTML = PAGE_LINKS
      .map(
        ([icon, title, text, href]) => `
        <a href="${href}" class="search-result-item">
          <span>${icon}</span>
          <div>
            <strong>${esc(title)}</strong>
            <small>${esc(text)}</small>
          </div>
        </a>
      `
      )
      .join("");

    return;
  }

  box.innerHTML = `<p class="muted">Buscando información en el sistema...</p>`;

  try {
    const response = await apiRequest(`/asesor/search${buildQuery({ q })}`);
    const items = response.items || response.resultados || [];

    box.innerHTML = items.length
      ? items
          .map((item) => {
            const href =
              item.href ||
              (item.caso_id || item.codigo_caso
                ? `detalle-atencion.html?caso=${encodeURIComponent(item.caso_id || item.codigo_caso)}`
                : "#");

            return `
              <a href="${esc(href)}" class="search-result-item">
                <span>${esc(item.icon || "🔎")}</span>
                <div>
                  <strong>${esc(item.title || item.titulo || "Resultado")}</strong>
                  <small>${esc(item.text || item.descripcion || "")}</small>
                </div>
              </a>
            `;
          })
          .join("")
      : `<p class="muted">No se encontraron resultados.</p>`;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

/* =========================================================
   BOT / ASISTENTE IA
========================================================= */

function setupBot() {
  $("#openBotSidebar")?.addEventListener("click", openBot);
  $("#openBotWelcome")?.addEventListener("click", openBot);
  $("#attentionOpenBotBtn")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    input.value = "";
    await askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach((button) => {
    button.addEventListener("click", () => askBot(button.dataset.botPrompt || ""));
  });

  const buttons = [
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
    ["templateAiBtn", "Ayúdame a crear una plantilla profesional"],
    ["prioritizeQueueBtn", "Prioriza mi bandeja"],
    ["queueSmartOrderBtn", "Ordena mi cola de trabajo"],
    ["queueBalanceBtn", "Revisa balance de cola"]
  ];

  buttons.forEach(([id, prompt]) => {
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
  addMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando información del sistema...";
  $("#botMessages")?.appendChild(typing);

  try {
    const response = await apiRequest("/asesor/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        prompt,
        case_id: State.selectedCaseId,
        advisor_id: State.advisor?.id || State.user?.id || null
      })
    });

    typing.remove();
    addMessage(response.answer || response.respuesta || "No se recibió respuesta del asistente.", "bot");
  } catch (error) {
    typing.remove();
    addMessage(`No se pudo obtener respuesta del asistente: ${error.message}`, "bot");
  }
}

function addMessage(text, who) {
  const box = $("#botMessages");
  if (!box) return;

  const item = document.createElement("div");
  item.className = `message message--${who}`;
  item.textContent = text;

  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
}

/* =========================================================
   DATA LOADERS
========================================================= */

async function loadCases(force = false) {
  if (State.loading.cases) return State.cases;
  if (State.cases.length && !force) return State.cases;

  State.loading.cases = true;

  try {
    const response = await apiRequest("/asesor/casos");

    State.cases = response.items || response.cases || response.casos || [];

    await refreshGlobalBadges();
  } finally {
    State.loading.cases = false;
  }

  return State.cases;
}

async function loadCaseDetail(caseId) {
  const response = await apiRequest(`/asesor/casos/${encodeURIComponent(caseId)}`);
  const detail = response.case || response.caso || response;

  State.selectedCase = normalizeCase(detail);
  State.selectedCase.raw = detail;

  saveSelectedCase(State.selectedCase.id);

  return detail;
}

async function loadTemplates(force = false) {
  if (State.loading.templates) return State.templates;
  if (State.templates.length && !force) return State.templates;

  State.loading.templates = true;

  try {
    const response = await apiRequest("/asesor/plantillas");

    State.templates = response.items || response.templates || response.plantillas || [];
  } finally {
    State.loading.templates = false;
  }

  return State.templates;
}

async function loadNotifications(force = false) {
  if (State.loading.notifications) return State.notifications;
  if (State.notifications.length && !force) return State.notifications;

  State.loading.notifications = true;

  try {
    const response = await apiRequest("/asesor/notificaciones");

    State.notifications =
      response.items ||
      response.notifications ||
      response.notificaciones ||
      [];

    await refreshGlobalBadges();
  } finally {
    State.loading.notifications = false;
  }

  return State.notifications;
}

/* =========================================================
   DASHBOARD
========================================================= */

async function initDashboard() {
  bindDashboardEvents();
  await renderDashboard();
}

function bindDashboardEvents() {
  $("#refreshPriorityBtn")?.addEventListener("click", async () => {
    await renderDashboard();
    toast("Dashboard actualizado", "La información operativa fue actualizada.", "success");
  });

  $("#sortPriorityBtn")?.addEventListener("click", async () => {
    await renderDashboard(true);
    toast("Priorización aplicada", "Los casos fueron ordenados por prioridad, SLA e impacto.", "success");
  });

  $("#refreshActivityBtn")?.addEventListener("click", renderDashboard);
  $("#refreshSlaBtn")?.addEventListener("click", renderDashboard);
}

async function renderDashboard(forceSort = false) {
  try {
    const response = await apiRequest("/asesor/dashboard");

    const advisor = response.advisor || State.advisor || {};
    State.cases = response.priority_cases || response.cases || response.casos_prioritarios || response.casos || [];

    const name =
      advisor.nombre ||
      advisor.name ||
      State.advisor?.nombre ||
      State.user?.nombre ||
      "Asesor";

    setText("#dashboardHeroEyebrow", advisor.shift || advisor.turno || "Turno operativo");
    setText("#dashboardHeroTitle", `Hola, ${name}`);
    setText(
      "#dashboardHeroText",
      response.hero_text ||
        "Visualiza tu carga operativa, casos críticos, alertas SLA y acciones pendientes."
    );

    setText("#advisorStatus", advisor.status || advisor.estado || "Disponible");
    setText(
      "#advisorLastAccess",
      advisor.last_access
        ? `Último acceso: ${formatDateTime(advisor.last_access)}`
        : "Último acceso registrado"
    );

    renderKpis("#advisorKpiGrid", response.kpis || buildCaseKpis(State.cases));

    let priority = (response.priority_cases || response.cases || State.cases)
      .map(normalizeCase)
      .sort(
        (a, b) =>
          a.slaHours - b.slaHours ||
          priorityValue(b.priority) - priorityValue(a.priority)
      );

    if (forceSort) {
      priority = priority.sort(
        (a, b) =>
          Number(slaRisk(b)) - Number(slaRisk(a)) ||
          priorityValue(b.priority) - priorityValue(a.priority) ||
          a.slaHours - b.slaHours
      );
    }

    setHTML(
      "#priorityCasesList",
      priority.length ? priority.map((c) => caseCard(c, "dashboard")).join("") : ""
    );

    show($("#emptyPriorityState"), !priority.length);
    bindCaseActions($("#priorityCasesList"));

    const activity = response.activity || response.actividad || [];
    renderActivity("#advisorActivityTimeline", activity);
    show($("#emptyActivityState"), !activity.length);

    const slaAlerts = response.sla_alerts || response.alertas_sla || priority.filter(slaRisk);
    renderSlaList("#advisorSlaList", slaAlerts);
    show($("#emptySlaState"), !slaAlerts.length);

    renderQueueBoard("#queueBoard", response.queue || response.cola || priority, false);
    show($("#emptyQueueBoardState"), !priority.length);

    renderAi("#advisorAiSummary", response.ai_summary || response.resumen_ia || buildQueueSummary(priority));
  } catch (error) {
    renderDashboardEmpty(error.message);
  }
}

function renderDashboardEmpty(message) {
  renderKpis("#advisorKpiGrid", []);

  setHTML("#priorityCasesList", "");
  show($("#emptyPriorityState"), true);

  setHTML("#advisorActivityTimeline", "");
  show($("#emptyActivityState"), true);

  setHTML("#advisorSlaList", "");
  show($("#emptySlaState"), true);

  setHTML("#queueBoard", "");
  show($("#emptyQueueBoardState"), true);

  renderAi("#advisorAiSummary", [
    {
      title: "Información no disponible",
      text: message
    }
  ]);
}

/* =========================================================
   BANDEJA
========================================================= */

async function initBandeja() {
  bindInboxEvents();
  await renderInbox(true);
}

function bindInboxEvents() {
  $("#advisorQueueSearch")?.addEventListener("input", () => renderInbox(false));

  $$("[data-advisor-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.inboxFilter = button.dataset.advisorFilter || "todos";

      $$("[data-advisor-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderInbox(false);
    });
  });

  $("#refreshQueueBtn")?.addEventListener("click", async () => {
    await renderInbox(true);
    toast("Bandeja actualizada", "La información fue actualizada correctamente.", "success");
  });

  $("#exportQueueBtn")?.addEventListener("click", () => {
    const rows = inboxFilteredCases();

    openExportModal("bandeja", {
      endpoint: EXPORT_ENDPOINTS.bandeja,
      filename: "bandeja-asesor",
      activeFilter: labelFilter(State.inboxFilter),
      visibleCount: rows.length,
      params: {
        filtro: State.inboxFilter,
        busqueda: getValue("#advisorQueueSearch")
      },
      title: "Exportar bandeja asignada",
      text: "Descarga la bandeja con los filtros actuales o el total de casos asignados."
    });
  });

  $("#toggleQueueViewBtn")?.addEventListener("click", () => {
    State.queueView = State.queueView === "cards" ? "table" : "cards";

    setText(
      "#toggleQueueViewBtn",
      State.queueView === "cards" ? "Vista tabla" : "Vista cards"
    );

    renderInbox(false);
  });

  $("#confirmQueueUpdateBtn")?.addEventListener("click", confirmQueueUpdate);
  $("#queueUpdateAiBtn")?.addEventListener("click", improveQueueUpdateText);

  $("#confirmQueueRequestBtn")?.addEventListener("click", confirmQueueRequest);
  $("#queueRequestAiBtn")?.addEventListener("click", generateQueueRequestText);

  $("#confirmQueueDeriveBtn")?.addEventListener("click", confirmQueueDerive);
}

async function renderInbox(force = false) {
  try {
    await loadCases(force);

    const rows = inboxFilteredCases();

    setText("#queueSummaryStatus", `${rows.length} casos visibles`);
    setText("#queueSummaryText", `Filtro aplicado: ${labelFilter(State.inboxFilter)}`);

    renderKpis("#inboxKpiGrid", buildCaseKpis(rows));

    setHTML("#advisorQueueList", rows.map((c) => caseCard(c, "default")).join(""));
    setHTML("#advisorQueueTableBody", rows.map(caseRow).join(""));

    show($("#advisorQueueList"), State.queueView === "cards");
    show($("#advisorQueueTableWrap"), State.queueView === "table");
    show($("#emptyAdvisorQueueState"), !rows.length);

    renderAi("#queueAiSummary", buildQueueSummary(rows));
    renderChecklist("#inboxSuggestedActions", buildSuggestedActions(rows));

    bindCaseActions($("#advisorQueueList"));
    bindCaseActions($("#advisorQueueTableBody"));
  } catch (error) {
    setHTML("#advisorQueueList", "");
    setHTML("#advisorQueueTableBody", "");
    show($("#emptyAdvisorQueueState"), true);

    renderAi("#queueAiSummary", [
      {
        title: "No se pudo cargar bandeja",
        text: error.message
      }
    ]);
  }
}

function inboxFilteredCases() {
  const q = getValue("#advisorQueueSearch").toLowerCase();

  return State.cases
    .map(normalizeCase)
    .filter((c) => {
      const text = `
        ${c.code}
        ${c.title}
        ${c.clientName}
        ${c.service}
        ${c.priority}
        ${c.status}
        ${c.type}
      `.toLowerCase();

      const filter = State.inboxFilter;

      const matchesFilter =
        filter === "todos" ||
        (filter === "critica" && c.priorityCode === "critica") ||
        (filter === "alta" && c.priorityCode === "alta") ||
        (filter === "pendiente_cliente" && c.statusCode === CASE_STATUS.PENDIENTE_CLIENTE) ||
        (filter === "sla_riesgo" && slaRisk(c)) ||
        (filter === "listo_cierre" && c.statusCode === CASE_STATUS.LISTO_CIERRE);

      return (!q || text.includes(q)) && matchesFilter;
    })
    .sort(
      (a, b) =>
        Number(slaRisk(b)) - Number(slaRisk(a)) ||
        a.slaHours - b.slaHours ||
        priorityValue(b.priority) - priorityValue(a.priority)
    );
}

function openQueueUpdate(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("✍️", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);
  setHTML("#queueUpdateContext", caseSummary(c));

  populateCatalogDrivenUI();
  openModal("#queueUpdateModal");
}

async function confirmQueueUpdate() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#queueUpdateStatus") ||
    !getValue("#queueUpdateVisibility") ||
    !getValue("#queueUpdateSummary") ||
    !getValue("#queueUpdateDetail") ||
    !isChecked("#queueUpdateDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, visibilidad, resumen, detalle y confirmación.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "✍️",
    eyebrow: "Actualizar caso",
    title: "Confirmar actualización",
    text: "Se registrará un avance en la trazabilidad del caso.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que la actualización corresponde al caso seleccionado.",
    confirmLabel: "Registrar actualización",
    onConfirm: async () => {
      await updateCase(State.selectedCaseId, {
        estado: getValue("#queueUpdateStatus"),
        visibilidad: getValue("#queueUpdateVisibility"),
        resumen: getValue("#queueUpdateSummary"),
        detalle: getValue("#queueUpdateDetail")
      });
    }
  });
}

function improveQueueUpdateText() {
  const base = getValue("#queueUpdateSummary") || "Actualización de atención";
  const input = $("#queueUpdateDetail");

  if (input) {
    input.value = `Se registra avance del caso: ${base}. Se deja constancia de la revisión realizada, sustento evaluado y siguiente paso operativo para mantener trazabilidad.`;
  }
}

function openQueueRequest(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("📩", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);
  setHTML("#queueRequestContext", caseSummary(c));

  populateCatalogDrivenUI();
  openModal("#queueRequestModal");
}

async function confirmQueueRequest() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#queueRequestChannel") ||
    !getValue("#queueRequestDeadline") ||
    !getValue("#queueRequestSubject") ||
    !getValue("#queueRequestMessage") ||
    !isChecked("#queueRequestDeclaration")
  ) {
    toast("Faltan datos", "Completa canal, plazo, asunto, mensaje y confirmación.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "📩",
    eyebrow: "Solicitud al cliente",
    title: "Confirmar envío de solicitud",
    text: "Se enviará una solicitud al cliente y quedará registrada en el historial.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que la solicitud es necesaria para continuar la atención.",
    confirmLabel: "Enviar solicitud",
    onConfirm: async () => {
      await requestCaseInfo(State.selectedCaseId, {
        canal: getValue("#queueRequestChannel"),
        plazo: getValue("#queueRequestDeadline"),
        asunto: getValue("#queueRequestSubject"),
        mensaje: getValue("#queueRequestMessage")
      });
    }
  });
}

function generateQueueRequestText() {
  const c = getCase(State.selectedCaseId);

  if ($("#queueRequestSubject")) {
    $("#queueRequestSubject").value = "Solicitud de información adicional";
  }

  if ($("#queueRequestMessage")) {
    $("#queueRequestMessage").value =
      `Estimado cliente, para continuar con la atención del caso ${c?.code || "seleccionado"}, necesitamos información o evidencia adicional relacionada con ${c?.service || "el servicio reportado"}. Agradecemos enviarla dentro del plazo indicado para evitar retrasos en la gestión.`;
  }
}

function openQueueDerive(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("🔀", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);
  setHTML("#queueDeriveContext", caseSummary(c));

  populateCatalogDrivenUI();
  openModal("#queueDeriveModal");
}

async function confirmQueueDerive() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#queueDeriveArea") ||
    !getValue("#queueDerivePriority") ||
    !getValue("#queueDeriveReason")
  ) {
    toast("Faltan datos", "Completa área, prioridad y motivo.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "🔀",
    eyebrow: "Derivar caso",
    title: "Confirmar derivación",
    text: "El caso será derivado al área seleccionada y se registrará trazabilidad.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que la derivación corresponde al análisis del caso.",
    confirmLabel: "Confirmar derivación",
    onConfirm: async () => {
      await deriveCase(State.selectedCaseId, {
        area: getValue("#queueDeriveArea"),
        prioridad: getValue("#queueDerivePriority"),
        motivo: getValue("#queueDeriveReason")
      });
    }
  });
}

/* =========================================================
   DETALLE DE ATENCIÓN
========================================================= */

async function initDetalleAtencion() {
  bindDetailEvents();

  const id = getCaseIdFromUrl();

  if (!id) {
    show($("#emptyCaseInfoState"), true);

    genericModal(
      "🧾",
      "Caso no seleccionado",
      "Selecciona un caso desde la bandeja, cola, calendario SLA o notificaciones."
    );

    return;
  }

  await renderCaseDetail(id);
}

function bindDetailEvents() {
  $("#openUpdateCaseModal")?.addEventListener("click", openDetailUpdate);
  $("#quickOpenUpdateBtn")?.addEventListener("click", openDetailUpdate);

  $("#openRequestInfoModal")?.addEventListener("click", openDetailRequest);
  $("#quickOpenRequestBtn")?.addEventListener("click", openDetailRequest);

  $("#quickOpenDeriveBtn")?.addEventListener("click", openDetailDerive);
  $("#quickOpenCloseBtn")?.addEventListener("click", openDetailClose);

  $("#refreshAttentionHistoryBtn")?.addEventListener("click", () => {
    if (State.selectedCaseId) renderCaseDetail(State.selectedCaseId);
  });

  $("#refreshDetailSlaBtn")?.addEventListener("click", () => {
    if (State.selectedCaseId) renderCaseDetail(State.selectedCaseId);
  });

  $("#attentionEvidenceHelpBtn")?.addEventListener("click", () => {
    genericModal(
      "📎",
      "Guía de evidencias",
      "Valida que cada archivo tenga relación directa con el caso, fecha, servicio afectado y sustento claro. Si se requiere nueva evidencia, usa Solicitar información."
    );
  });

  $("#detailShareBtn")?.addEventListener("click", openShareCaseModal);
  $("#detailDownloadBtn")?.addEventListener("click", openCertificateConfirm);

  $("#confirmQuickUpdateBtn")?.addEventListener("click", confirmDetailUpdate);
  $("#updateImproveTextBtn")?.addEventListener("click", improveDetailUpdateText);

  $("#confirmQuickRequestBtn")?.addEventListener("click", confirmDetailRequest);
  $("#requestGenerateTextBtn")?.addEventListener("click", generateDetailRequestText);

  $("#confirmDeriveBtn")?.addEventListener("click", confirmDetailDerive);

  $("#confirmCloseCaseBtn")?.addEventListener("click", confirmDetailClose);
  $("#closeCaseAiBtn")?.addEventListener("click", () => askBot("Qué debo validar antes de cerrar este caso"));
}

async function renderCaseDetail(id) {
  try {
    const detail = await loadCaseDetail(id);
    const c = normalizeCase(detail);

    const raw = detail.case || detail.caso || detail;
    const evidence = raw.evidence || raw.evidencias || [];
    const history = raw.history || raw.historial || raw.timeline || [];

    setText("#caseTypeLabel", c.type);
    setText("#caseTitle", c.title);
    setText("#caseDescription", c.description || c.reason);
    setText("#caseReasonText", c.reason || "Sin motivo registrado.");

    setText("#caseStatusBadge", c.status);

    const statusBadge = $("#caseStatusBadge");
    if (statusBadge) statusBadge.className = pillClass(statusType(c.statusCode));

    setHTML(
      "#caseMeta",
      `
      <span>${esc(c.code)}</span>
      <span>${esc(c.clientName)}</span>
      <span>${esc(c.service)}</span>
      <span>${esc(c.priority)}</span>
      <span>${esc(c.slaText)}</span>
    `
    );

    setHTML(
      "#customerInfoGrid",
      [
        ["👤", "Cliente", c.clientName],
        ["🪪", "Documento", c.document],
        ["📡", "Servicio", c.service],
        ["📬", "Canal", c.channel],
        ["⏱️", "SLA", c.slaText],
        ["📌", "Acción sugerida", c.action],
        ["🗓️", "Registro", formatDateTime(c.createdAt)],
        ["🏷️", "Prioridad", c.priority]
      ]
        .map(
          ([icon, title, value]) => `
          <article class="info-item">
            <span class="info-icon">${icon}</span>
            <div>
              <strong>${esc(title)}</strong>
              <p>${esc(value)}</p>
            </div>
          </article>
        `
        )
        .join("")
    );

    setHTML(
      "#attentionEvidenceList",
      evidence
        .map((item) => {
          const name =
            item.name ||
            item.nombre_archivo ||
            item.filename ||
            item.archivo ||
            "Archivo";

          const detail =
            item.detail ||
            item.descripcion ||
            item.status ||
            item.estado ||
            "Evidencia registrada";

          const url = item.url || item.ruta || item.download_url || "";

          return `
            <article class="evidence-item">
              <span class="evidence-icon">${esc(item.icon || "📎")}</span>
              <div>
                <strong>${esc(name)}</strong>
                <p>${esc(detail)}</p>
                <small>${esc(item.fecha ? formatDateTime(item.fecha) : item.tipo || "")}</small>
              </div>
              ${
                url
                  ? `<a class="panel-action" href="${esc(url)}" target="_blank" rel="noopener">Ver</a>`
                  : `<button type="button" class="panel-action" disabled>Registrado</button>`
              }
            </article>
          `;
        })
        .join("")
    );

    show($("#emptyEvidenceState"), !evidence.length);

    renderChecklist("#attentionChecklist", buildCaseChecklist(c, evidence, history));

    renderActivity("#attentionHistoryTimeline", history);
    show($("#emptyHistoryState"), !history.length);

    renderAi(
      "#attentionAiSummary",
      raw.ai_summary ||
        raw.resumen_ia || [
          {
            title: "Estado actual",
            text: `El caso se encuentra en estado ${c.status}, prioridad ${c.priority} y SLA ${c.slaText}.`
          },
          {
            title: "Siguiente paso recomendado",
            text: c.action
          }
        ]
    );

    renderSlaList("#detailSlaList", [c]);

    show($("#emptyCaseInfoState"), false);
  } catch (error) {
    show($("#emptyCaseInfoState"), true);
    genericModal("!", "No se pudo cargar el caso", error.message);
  }
}

function buildCaseChecklist(c, evidence = [], history = []) {
  return [
    {
      icon: "✅",
      title: "Cliente identificado",
      text: c.clientName && c.document !== "-" ? "Datos básicos disponibles." : "Faltan datos del cliente."
    },
    {
      icon: "📎",
      title: "Evidencia",
      text: evidence.length ? `${evidence.length} archivo(s) disponibles para revisión.` : "No hay evidencias cargadas."
    },
    {
      icon: "⏱️",
      title: "SLA",
      text: `Tiempo operativo: ${c.slaText}.`
    },
    {
      icon: "🕘",
      title: "Historial",
      text: history.length ? `${history.length} evento(s) registrados.` : "Aún no hay trazabilidad registrada."
    },
    {
      icon: "💬",
      title: "Respuesta final",
      text: c.statusCode === CASE_STATUS.LISTO_CIERRE ? "Validar respuesta final antes de cerrar." : "Registrar avance o solicitar información si corresponde."
    }
  ];
}

function openDetailUpdate() {
  if (!State.selectedCase) {
    genericModal("✍️", "Caso no seleccionado", "Carga un caso antes de actualizar atención.");
    return;
  }

  setHTML("#updateCaseContext", caseSummary(State.selectedCase));
  populateCatalogDrivenUI();
  openModal("#updateAttentionModal");
}

function openDetailRequest() {
  if (!State.selectedCase) {
    genericModal("📩", "Caso no seleccionado", "Carga un caso antes de solicitar información.");
    return;
  }

  setHTML("#requestCaseContext", caseSummary(State.selectedCase));
  populateCatalogDrivenUI();
  openModal("#requestInfoModal");
}

function openDetailDerive() {
  if (!State.selectedCase) {
    genericModal("🔀", "Caso no seleccionado", "Carga un caso antes de derivarlo.");
    return;
  }

  setHTML("#deriveCaseContext", caseSummary(State.selectedCase));
  populateCatalogDrivenUI();
  openModal("#deriveCaseModal");
}

function openDetailClose() {
  if (!State.selectedCase) {
    genericModal("✅", "Caso no seleccionado", "Carga un caso antes de cerrarlo.");
    return;
  }

  setHTML("#closeCaseContext", caseSummary(State.selectedCase));
  openModal("#closeCaseModal");
}

async function confirmDetailUpdate() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#quickUpdateStatus") ||
    !getValue("#quickUpdateVisibility") ||
    !getValue("#quickUpdateSummary") ||
    !getValue("#quickUpdateDetail") ||
    !isChecked("#quickUpdateDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, visibilidad, resumen, detalle y confirmación.", "warning");
    return;
  }

  openConfirmAction({
    icon: "✍️",
    eyebrow: "Actualizar atención",
    title: "Confirmar actualización",
    text: "El avance será guardado en la trazabilidad del caso.",
    summary: State.selectedCase ? caseSummary(State.selectedCase) : "",
    checkText: "Confirmo que esta actualización corresponde al caso seleccionado.",
    confirmLabel: "Registrar actualización",
    onConfirm: async () => {
      await updateCase(State.selectedCaseId, {
        estado: getValue("#quickUpdateStatus"),
        visibilidad: getValue("#quickUpdateVisibility"),
        resumen: getValue("#quickUpdateSummary"),
        detalle: getValue("#quickUpdateDetail")
      });
    }
  });
}

function improveDetailUpdateText() {
  const textArea = $("#quickUpdateDetail");

  if (textArea) {
    textArea.value =
      "Se registra avance de atención, indicando la revisión realizada, el sustento validado y el siguiente paso operativo para mantener trazabilidad del caso.";
  }
}

async function confirmDetailRequest() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#quickRequestChannel") ||
    !getValue("#quickRequestDeadline") ||
    !getValue("#quickRequestSubject") ||
    !getValue("#quickRequestMessage") ||
    !isChecked("#quickRequestDeclaration")
  ) {
    toast("Faltan datos", "Completa canal, plazo, asunto, mensaje y confirmación.", "warning");
    return;
  }

  openConfirmAction({
    icon: "📩",
    eyebrow: "Solicitud al cliente",
    title: "Confirmar solicitud de información",
    text: "Se notificará al cliente y se registrará el evento en el historial del caso.",
    summary: State.selectedCase ? caseSummary(State.selectedCase) : "",
    checkText: "Confirmo que la solicitud es necesaria para continuar la atención.",
    confirmLabel: "Enviar solicitud",
    onConfirm: async () => {
      await requestCaseInfo(State.selectedCaseId, {
        canal: getValue("#quickRequestChannel"),
        plazo: getValue("#quickRequestDeadline"),
        asunto: getValue("#quickRequestSubject"),
        mensaje: getValue("#quickRequestMessage")
      });
    }
  });
}

function generateDetailRequestText() {
  const c = State.selectedCase;

  if ($("#quickRequestSubject")) {
    $("#quickRequestSubject").value = "Solicitud de información adicional para continuar la atención";
  }

  if ($("#quickRequestMessage")) {
    $("#quickRequestMessage").value =
      `Estimado cliente, para continuar con la atención del caso ${c?.code || "seleccionado"}, necesitamos que nos envíe información adicional relacionada con ${c?.service || "el servicio reportado"}. Esta información nos permitirá validar el sustento y continuar con la resolución dentro del plazo establecido.`;
  }
}

async function confirmDetailDerive() {
  if (!State.selectedCaseId) return;

  if (!getValue("#deriveArea") || !getValue("#derivePriority") || !getValue("#deriveReason")) {
    toast("Faltan datos", "Completa área, prioridad y motivo.", "warning");
    return;
  }

  openConfirmAction({
    icon: "🔀",
    eyebrow: "Derivación",
    title: "Confirmar derivación del caso",
    text: "El caso será enviado al área destino y se registrará trazabilidad.",
    summary: State.selectedCase ? caseSummary(State.selectedCase) : "",
    checkText: "Confirmo que la derivación corresponde al análisis del caso.",
    confirmLabel: "Derivar caso",
    onConfirm: async () => {
      await deriveCase(State.selectedCaseId, {
        area: getValue("#deriveArea"),
        prioridad: getValue("#derivePriority"),
        motivo: getValue("#deriveReason")
      });
    }
  });
}

async function confirmDetailClose() {
  if (!State.selectedCaseId) return;

  const response = getValue("#closeCaseResponse");

  if (!response || !isChecked("#closeCaseDeclaration")) {
    toast("Validación pendiente", "Ingresa respuesta final y confirma la declaración.", "warning");
    return;
  }

  const c = State.selectedCase;

  if (response.length < 40) {
    toast("Respuesta muy breve", "La respuesta final debe tener mayor detalle para sustentar el cierre.", "warning");
    return;
  }

  if (c?.statusCode === CASE_STATUS.PENDIENTE_CLIENTE) {
    toast("Cierre no permitido", "No puedes cerrar un caso pendiente de respuesta del cliente.", "warning");
    return;
  }

  openConfirmAction({
    icon: "✅",
    eyebrow: "Cierre de atención",
    title: "Confirmar cierre del caso",
    text: "Esta acción cerrará el caso y dejará registrada la respuesta final.",
    summary: State.selectedCase ? caseSummary(State.selectedCase) : "",
    checkText: "Confirmo que el caso cuenta con sustento, respuesta final y trazabilidad suficiente.",
    confirmLabel: "Cerrar caso",
    onConfirm: async () => {
      await closeCase(State.selectedCaseId, {
        respuesta_final: response
      });
    }
  });
}

function openCertificateConfirm() {
  if (!State.selectedCaseId) return;

  openConfirmAction({
    icon: "📄",
    eyebrow: "Constancia",
    title: "Generar constancia del caso",
    text: "Se descargará una constancia con la información registrada del caso.",
    summary: State.selectedCase ? caseSummary(State.selectedCase) : "",
    checkText: "Confirmo que necesito generar la constancia para gestión interna.",
    confirmLabel: "Descargar constancia",
    onConfirm: async () => {
      await downloadCaseCertificate();
      closeModals();
    }
  });
}

async function downloadCaseCertificate() {
  if (!State.selectedCaseId) return;

  await downloadFromApi(
    `/asesor/casos/${encodeURIComponent(State.selectedCaseId)}/constancia`,
    { formato: "pdf" },
    `constancia-${State.selectedCaseId}`
  );
}

/* =========================================================
   ACCIONES API DEL CASO
========================================================= */

async function updateCase(caseId, payload) {
  try {
    await apiRequest(`/asesor/casos/${encodeURIComponent(caseId)}/actualizar`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    closeModals();
    toast("Actualización registrada", "El avance fue registrado correctamente.", "success");

    await afterCaseAction();
  } catch (error) {
    genericModal("!", "No se pudo actualizar", error.message);
  }
}

async function requestCaseInfo(caseId, payload) {
  try {
    await apiRequest(`/asesor/casos/${encodeURIComponent(caseId)}/solicitar-informacion`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeModals();
    toast("Solicitud enviada", "La solicitud fue registrada y enviada al cliente.", "success");

    await afterCaseAction();
  } catch (error) {
    genericModal("!", "No se pudo enviar solicitud", error.message);
  }
}

async function deriveCase(caseId, payload) {
  try {
    await apiRequest(`/asesor/casos/${encodeURIComponent(caseId)}/derivar`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeModals();
    toast("Caso derivado", "La derivación fue registrada correctamente.", "success");

    await afterCaseAction();
  } catch (error) {
    genericModal("!", "No se pudo derivar", error.message);
  }
}

async function closeCase(caseId, payload) {
  try {
    await apiRequest(`/asesor/casos/${encodeURIComponent(caseId)}/cerrar`, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    closeModals();
    toast("Caso cerrado", "El cierre fue registrado correctamente.", "success");

    await afterCaseAction();
  } catch (error) {
    genericModal("!", "No se pudo cerrar el caso", error.message);
  }
}

async function afterCaseAction() {
  await refreshGlobalBadges();

  if (State.page === "asesor-detalle-atencion" && State.selectedCaseId) {
    await renderCaseDetail(State.selectedCaseId);
  }

  if (State.page === "asesor-bandeja") {
    await renderInbox(true);
  }

  if (State.page === "asesor-cola-trabajo") {
    await renderWorkQueue(true);
  }

  if (State.page === "asesor-calendario-sla") {
    await renderSlaCalendar(true);
  }

  if (State.page === "asesor-dashboard") {
    await renderDashboard();
  }
}

/* =========================================================
   COLA DE TRABAJO
========================================================= */

async function initColaTrabajo() {
  bindWorkQueueEvents();
  await renderWorkQueue(true);
}

function bindWorkQueueEvents() {
  $("#workQueueSearch")?.addEventListener("input", () => renderWorkQueue(false));

  $$("[data-queue-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.queueFilter = button.dataset.queueFilter || "todos";

      $$("[data-queue-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderWorkQueue(false);
    });
  });

  $("#queueRefreshBtn")?.addEventListener("click", async () => {
    await renderWorkQueue(true);
    toast("Cola actualizada", "El tablero de trabajo fue actualizado.", "success");
  });

  $("#queueExportBtn")?.addEventListener("click", () => {
    const rows = workQueueFilteredCases();

    openExportModal("cola", {
      endpoint: EXPORT_ENDPOINTS.cola,
      filename: "cola-trabajo-asesor",
      activeFilter: labelFilter(State.queueFilter),
      visibleCount: rows.length,
      params: {
        filtro: State.queueFilter,
        busqueda: getValue("#workQueueSearch")
      },
      title: "Exportar cola de trabajo",
      text: "Descarga el tablero Kanban según estado, prioridad y SLA."
    });
  });

  $("#queueOpenDetailBtn")?.addEventListener("click", () => goToDetail(State.selectedCaseId));

  $("#queueMoveCaseBtn")?.addEventListener("click", () => {
    closeModals();
    openMoveCase(State.selectedCaseId);
  });

  $("#confirmMoveCaseBtn")?.addEventListener("click", confirmMoveCase);

  $("#confirmWorkQueueRequestBtn")?.addEventListener("click", confirmWorkQueueRequest);
  $("#workQueueGenerateRequestBtn")?.addEventListener("click", generateWorkQueueRequestText);

  $("#confirmWorkQueueCloseBtn")?.addEventListener("click", confirmWorkQueueClose);
  $("#queueCloseAiBtn")?.addEventListener("click", () => askBot("Qué debo validar antes de cerrar"));
}

async function renderWorkQueue(force = false) {
  try {
    await loadCases(force);

    const rows = workQueueFilteredCases();

    renderKpis("#workQueueKpiGrid", buildCaseKpis(rows));

    setText("#workQueueSummaryTitle", `${rows.length} casos visibles`);
    setText("#workQueueSummaryText", `Filtro actual: ${labelFilter(State.queueFilter)}`);

    renderQueueBoard("#workQueueBoard", rows, true);

    renderAi("#workQueueAiSummary", buildQueueSummary(rows));
    show($("#emptyWorkQueueState"), !rows.length);
  } catch (error) {
    renderAi("#workQueueAiSummary", [
      {
        title: "No se pudo cargar cola",
        text: error.message
      }
    ]);

    show($("#emptyWorkQueueState"), true);
  }
}

function workQueueFilteredCases() {
  const q = getValue("#workQueueSearch").toLowerCase();

  return State.cases
    .map(normalizeCase)
    .filter((c) => {
      const text = `
        ${c.code}
        ${c.title}
        ${c.clientName}
        ${c.service}
        ${c.priority}
        ${c.status}
        ${c.queueStatusLabel}
        ${c.type}
      `.toLowerCase();

      const f = State.queueFilter;

      const matchesFilter =
        f === "todos" ||
        (f === "critica" && c.priorityCode === "critica") ||
        (f === "sla_riesgo" && slaRisk(c)) ||
        (f === "pendiente_cliente" && c.statusCode === CASE_STATUS.PENDIENTE_CLIENTE) ||
        (f === "listo_cierre" && c.statusCode === CASE_STATUS.LISTO_CIERRE);

      return (!q || text.includes(q)) && matchesFilter;
    })
    .sort(
      (a, b) =>
        Number(slaRisk(b)) - Number(slaRisk(a)) ||
        a.slaHours - b.slaHours ||
        priorityValue(b.priority) - priorityValue(a.priority)
    );
}

function openMoveCase(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("🗂️", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setHTML("#moveCaseContext", caseSummary(c));
  populateCatalogDrivenUI();

  openModal("#moveCaseModal");
}

async function confirmMoveCase() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#moveCaseStatus") ||
    !getValue("#moveCaseVisibility") ||
    !getValue("#moveCaseReason") ||
    !isChecked("#moveCaseDeclaration")
  ) {
    toast("Faltan datos", "Completa estado, visibilidad, motivo y confirmación.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "🗂️",
    eyebrow: "Cambio de estado",
    title: "Confirmar movimiento en cola",
    text: "El estado operativo del caso será actualizado y quedará registrado.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que el movimiento corresponde al caso seleccionado.",
    confirmLabel: "Confirmar movimiento",
    onConfirm: async () => {
      await updateCase(State.selectedCaseId, {
        estado: getValue("#moveCaseStatus"),
        visibilidad: getValue("#moveCaseVisibility"),
        resumen: "Movimiento de cola",
        detalle: getValue("#moveCaseReason")
      });
    }
  });
}

function openWorkQueueRequest(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("📩", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setHTML("#workQueueRequestContext", caseSummary(c));
  populateCatalogDrivenUI();

  openModal("#queueRequestModal");
}

async function confirmWorkQueueRequest() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#workQueueRequestChannel") ||
    !getValue("#workQueueRequestDeadline") ||
    !getValue("#workQueueRequestMessage") ||
    !isChecked("#workQueueRequestDeclaration")
  ) {
    toast("Faltan datos", "Completa canal, plazo, mensaje y confirmación.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "📩",
    eyebrow: "Solicitud al cliente",
    title: "Confirmar solicitud desde cola",
    text: "El cliente será notificado y el caso quedará con trazabilidad.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que la solicitud corresponde al caso seleccionado.",
    confirmLabel: "Enviar solicitud",
    onConfirm: async () => {
      await requestCaseInfo(State.selectedCaseId, {
        canal: getValue("#workQueueRequestChannel"),
        plazo: getValue("#workQueueRequestDeadline"),
        asunto: "Solicitud de información adicional",
        mensaje: getValue("#workQueueRequestMessage")
      });
    }
  });
}

function generateWorkQueueRequestText() {
  const c = getCase(State.selectedCaseId);

  const input = $("#workQueueRequestMessage");

  if (input) {
    input.value =
      `Estimado cliente, necesitamos información adicional para continuar con la atención del caso ${c?.code || "seleccionado"}. Por favor adjunte evidencia relacionada con ${c?.service || "el servicio reportado"} dentro del plazo indicado.`;
  }
}

function openWorkQueueClose(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("✅", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setHTML("#workQueueCloseContext", caseSummary(c));

  openModal("#queueCloseModal");
}

async function confirmWorkQueueClose() {
  if (!State.selectedCaseId) return;

  const response = getValue("#workQueueCloseResponse");

  if (!response || !isChecked("#workQueueCloseDeclaration")) {
    toast("Validación pendiente", "Ingresa respuesta final y confirma la declaración.", "warning");
    return;
  }

  if (response.length < 40) {
    toast("Respuesta muy breve", "La respuesta final debe tener mayor detalle para sustentar el cierre.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  if (c?.statusCode === CASE_STATUS.PENDIENTE_CLIENTE) {
    toast("Cierre no permitido", "No puedes cerrar un caso pendiente de respuesta del cliente.", "warning");
    return;
  }

  openConfirmAction({
    icon: "✅",
    eyebrow: "Cierre de caso",
    title: "Confirmar cierre desde cola",
    text: "El caso será cerrado y se guardará la respuesta final.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que el caso cuenta con sustento suficiente para cierre.",
    confirmLabel: "Cerrar caso",
    onConfirm: async () => {
      await closeCase(State.selectedCaseId, {
        respuesta_final: response
      });
    }
  });
}

/* =========================================================
   CALENDARIO SLA
========================================================= */

async function initCalendarioSla() {
  bindSlaEvents();
  await renderSlaCalendar(true);
}

function bindSlaEvents() {
  $("#slaSearchInput")?.addEventListener("input", () => renderSlaCalendar(false));

  $$("[data-sla-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.slaFilter = button.dataset.slaFilter || "todos";

      $$("[data-sla-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderSlaCalendar(false);
    });
  });

  $("#slaRefreshBtn")?.addEventListener("click", async () => {
    await renderSlaCalendar(true);
    toast("Calendario actualizado", "Los vencimientos SLA fueron actualizados.", "success");
  });

  $("#slaTodayBtn")?.addEventListener("click", () => {
    State.slaView = "hoy";
    State.slaFilter = "hoy";
    renderSlaCalendar(false);
  });

  $("#slaWeekBtn")?.addEventListener("click", () => {
    State.slaView = "semana";
    State.slaFilter = "todos";
    renderSlaCalendar(false);
  });

  $("#slaExportBtn")?.addEventListener("click", () => {
    const rows = slaFilteredCases();

    openExportModal("sla", {
      endpoint: EXPORT_ENDPOINTS.sla,
      filename: "calendario-sla-asesor",
      activeFilter: labelFilter(State.slaFilter),
      visibleCount: rows.length,
      params: {
        filtro: State.slaFilter,
        vista: State.slaView,
        busqueda: getValue("#slaSearchInput")
      },
      title: "Exportar calendario SLA",
      text: "Descarga los vencimientos SLA según la vista y filtros aplicados."
    });
  });

  $("#confirmSlaReminderBtn")?.addEventListener("click", confirmSlaReminder);
  $("#improveSlaReminderBtn")?.addEventListener("click", improveSlaReminder);

  $("#confirmSlaFollowBtn")?.addEventListener("click", confirmSlaFollow);
}

async function renderSlaCalendar(force = false) {
  try {
    await loadCases(force);

    const rows = slaFilteredCases();

    renderKpis("#slaKpiGrid", [
      {
        icon: "🔥",
        value: rows.filter(slaRisk).length,
        label: "SLA críticos",
        description: "Vencimiento cercano"
      },
      {
        icon: "⏱️",
        value: rows.filter((c) => c.slaGroup === "hoy").length,
        label: "Vence hoy",
        description: "Monitoreo inmediato"
      },
      {
        icon: "📩",
        value: rows.filter((c) => c.statusCode === CASE_STATUS.PENDIENTE_CLIENTE).length,
        label: "Pendiente cliente",
        description: "Puede bloquear avance"
      },
      {
        icon: "✅",
        value: rows.filter((c) => c.statusCode === CASE_STATUS.LISTO_CIERRE).length,
        label: "Listos cierre",
        description: "Validación final"
      }
    ]);

    setText("#slaSummaryTitle", `${rows.filter(slaRisk).length} casos en riesgo`);
    setText("#slaSummaryText", `${rows.length} vencimientos visibles según filtro.`);

    const groups = [
      ["vencido", "Vencidos", "Casos fuera de plazo"],
      ["hoy", "Hoy", "Vencimientos críticos"],
      ["mañana", "Mañana", "Casos programados"],
      ["semana", "Esta semana", "Seguimientos preventivos"]
    ];

    setHTML(
      "#slaCalendarGrid",
      groups
        .map(([key, title, subtitle]) => {
          const items = rows.filter((c) => c.slaGroup === key);

          return `
            <article class="sla-day-card ${key === "hoy" || key === "vencido" ? "sla-day-card--critical" : ""}">
              <div class="sla-day-card__header">
                <div>
                  <span class="eyebrow">${esc(title)}</span>
                  <h3>${esc(subtitle)}</h3>
                </div>
                <span class="${pillClass(key === "hoy" || key === "vencido" ? "danger" : "info")}">
                  ${items.length} casos
                </span>
              </div>

              <div class="sla-list">
                ${
                  items.length
                    ? items
                        .map((c) => {
                          const meter = Math.max(8, Math.min(100, 100 - Math.max(Number(c.slaHours), 0) * 4));

                          return `
                            <article class="sla-item">
                              <span class="activity-icon">⏱️</span>
                              <div>
                                <strong>${esc(c.code)} · ${esc(c.title)}</strong>
                                <p>${esc(c.clientName)} · ${esc(c.priority)} · ${esc(c.slaText)}</p>
                                <div class="sla-meter"><span style="width:${meter}%"></span></div>
                              </div>
                              <button type="button" class="panel-action" data-action="open-detail" data-case-id="${esc(c.id)}">Abrir</button>
                              <button type="button" class="panel-action" data-action="sla-reminder" data-case-id="${esc(c.id)}">Recordar</button>
                              <button type="button" class="panel-action" data-action="sla-follow" data-case-id="${esc(c.id)}">Seguimiento</button>
                            </article>
                          `;
                        })
                        .join("")
                    : `<p class="muted">Sin casos en este periodo.</p>`
                }
              </div>
            </article>
          `;
        })
        .join("")
    );

    renderAi("#slaAiSummary", buildQueueSummary(rows));
    renderChecklist("#slaActionPlan", buildSuggestedActions(rows));

    show($("#emptySlaCalendarState"), !rows.length);

    bindCaseActions($("#slaCalendarGrid"));
  } catch (error) {
    renderAi("#slaAiSummary", [
      {
        title: "No se pudo cargar SLA",
        text: error.message
      }
    ]);

    show($("#emptySlaCalendarState"), true);
  }
}

function slaFilteredCases() {
  const q = getValue("#slaSearchInput").toLowerCase();

  return State.cases
    .map(normalizeCase)
    .filter((c) => {
      const text = `
        ${c.code}
        ${c.title}
        ${c.clientName}
        ${c.priority}
        ${c.status}
        ${c.slaText}
        ${c.service}
      `.toLowerCase();

      const f = State.slaFilter;

      const matchesFilter =
        f === "todos" ||
        (f === "critico" && slaRisk(c)) ||
        (f === "hoy" && c.slaGroup === "hoy") ||
        (f === "pendiente_cliente" && c.statusCode === CASE_STATUS.PENDIENTE_CLIENTE) ||
        (f === "listo_cierre" && c.statusCode === CASE_STATUS.LISTO_CIERRE);

      return (!q || text.includes(q)) && matchesFilter;
    })
    .sort(
      (a, b) =>
        Number(slaRisk(b)) - Number(slaRisk(a)) ||
        a.slaHours - b.slaHours ||
        priorityValue(b.priority) - priorityValue(a.priority)
    );
}

function openSlaReminder(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("⏱️", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setHTML("#slaReminderContext", caseSummary(c));
  populateCatalogDrivenUI();

  openModal("#slaReminderModal");
}

function openSlaFollow(id) {
  const c = getCase(id);

  if (!c) {
    genericModal("🔎", "Caso no encontrado", "No se encontró el caso seleccionado.");
    return;
  }

  saveSelectedCase(id);

  setHTML("#slaFollowContext", caseSummary(c));

  openModal("#slaFollowModal");
}

async function confirmSlaReminder() {
  if (!State.selectedCaseId) return;

  if (
    !getValue("#slaReminderChannel") ||
    !getValue("#slaReminderDeadline") ||
    !getValue("#slaReminderMessage") ||
    !isChecked("#slaReminderDeclaration")
  ) {
    toast("Faltan datos", "Completa canal, plazo, mensaje y confirmación.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "📩",
    eyebrow: "Recordatorio SLA",
    title: "Confirmar envío de recordatorio",
    text: "El recordatorio será enviado al cliente y registrado en el historial.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que el recordatorio corresponde al caso seleccionado.",
    confirmLabel: "Enviar recordatorio",
    onConfirm: async () => {
      try {
        await apiRequest(`/asesor/casos/${encodeURIComponent(State.selectedCaseId)}/recordatorio-sla`, {
          method: "POST",
          body: JSON.stringify({
            canal: getValue("#slaReminderChannel"),
            plazo: getValue("#slaReminderDeadline"),
            mensaje: getValue("#slaReminderMessage")
          })
        });

        closeModals();
        toast("Recordatorio enviado", "El recordatorio fue registrado correctamente.", "success");

        await renderSlaCalendar(true);
      } catch (error) {
        genericModal("!", "No se pudo enviar recordatorio", error.message);
      }
    }
  });
}

function improveSlaReminder() {
  const c = getCase(State.selectedCaseId);
  const input = $("#slaReminderMessage");

  if (input) {
    input.value =
      `Estimado cliente, le recordamos que necesitamos la información solicitada para continuar con la atención del caso ${c?.code || "seleccionado"}. Su respuesta dentro del plazo establecido nos permitirá evitar retrasos en la gestión.`;
  }
}

async function confirmSlaFollow() {
  if (!State.selectedCaseId) return;

  if (!getValue("#slaFollowText") || !isChecked("#slaFollowDeclaration")) {
    toast("Faltan datos", "Completa el seguimiento y confirma la declaración.", "warning");
    return;
  }

  const c = getCase(State.selectedCaseId);

  openConfirmAction({
    icon: "🔎",
    eyebrow: "Seguimiento SLA",
    title: "Confirmar seguimiento preventivo",
    text: "Se registrará un evento de seguimiento en la trazabilidad del caso.",
    summary: c ? caseSummary(c) : "",
    checkText: "Confirmo que el seguimiento corresponde al caso seleccionado.",
    confirmLabel: "Registrar seguimiento",
    onConfirm: async () => {
      try {
        await apiRequest(`/asesor/casos/${encodeURIComponent(State.selectedCaseId)}/seguimiento-sla`, {
          method: "POST",
          body: JSON.stringify({
            detalle: getValue("#slaFollowText")
          })
        });

        closeModals();
        toast("Seguimiento registrado", "El seguimiento SLA fue registrado correctamente.", "success");

        await renderSlaCalendar(true);
      } catch (error) {
        genericModal("!", "No se pudo registrar seguimiento", error.message);
      }
    }
  });
}

/* =========================================================
   PLANTILLAS DE RESPUESTA
========================================================= */

async function initPlantillas() {
  bindTemplateEvents();
  renderTemplateFilterChips();
  await renderTemplates(true);
}

function bindTemplateEvents() {
  $("#templateSearchInput")?.addEventListener("input", () => renderTemplates(false));

  $("#templateFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-template-filter]");
    if (!button) return;

    State.templateFilter = button.dataset.templateFilter || "todos";

    $$("[data-template-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    renderTemplates(false);
  });

  $("#newTemplateBtn")?.addEventListener("click", () => {
    populateCatalogDrivenUI();
    openModal("#newTemplateModal");
  });

  $("#manageVariablesBtn")?.addEventListener("click", openVariablesModal);

  $("#refreshTemplatesBtn")?.addEventListener("click", async () => {
    await renderTemplates(true);
    toast("Plantillas actualizadas", "El catálogo fue actualizado correctamente.", "success");
  });

  $("#templateExportBtn")?.addEventListener("click", () => {
    const rows = templateFiltered();

    openExportModal("plantillas", {
      endpoint: EXPORT_ENDPOINTS.plantillas,
      filename: "catalogo-plantillas-asesor",
      activeFilter: labelFilter(State.templateFilter),
      visibleCount: rows.length,
      params: {
        filtro: State.templateFilter,
        busqueda: getValue("#templateSearchInput")
      },
      title: "Exportar catálogo de plantillas",
      text: "Descarga las plantillas activas, personales u oficiales según el filtro aplicado."
    });
  });

  $("#previewUseTemplateBtn")?.addEventListener("click", () => {
    closeModals();
    openUseTemplate(State.selectedTemplateId);
  });

  $("#improveTemplateBtn")?.addEventListener("click", () => askBot("Mejora esta plantilla manteniendo tono profesional"));

  $("#sendTemplateBtn")?.addEventListener("click", sendTemplate);

  $("#templateToneBtn")?.addEventListener("click", improveTemplateTone);

  $("#saveTemplateBtn")?.addEventListener("click", saveNewTemplate);

  $("#generateNewTemplateBtn")?.addEventListener("click", generateNewTemplateBody);

  $("#templateCaseCode")?.addEventListener("input", handleTemplateCaseSearch);
}

function renderTemplateFilterChips() {
  const box = $("#templateFilters");
  if (!box) return;

  const categories = getCatalog("categoriasPlantilla");

  box.innerHTML = `
    <button type="button" class="filter-chip active" data-template-filter="todos">
      Todas
    </button>

    ${categories
      .map(
        (cat) => `
        <button type="button" class="filter-chip" data-template-filter="${esc(cat.codigo)}">
          ${esc(cat.nombre)}
        </button>
      `
      )
      .join("")}
  `;
}

async function renderTemplates(force = false) {
  try {
    await loadTemplates(force);

    const rows = templateFiltered();
    const all = State.templates.map(normalizeTemplate);

    renderKpis("#templateKpiGrid", [
      {
        icon: "📩",
        value: all.filter((t) => t.category.includes("evidencia")).length,
        label: "Evidencia",
        description: "Solicitudes"
      },
      {
        icon: "📝",
        value: all.filter((t) => t.category.includes("reclamo")).length,
        label: "Reclamo",
        description: "Respuestas"
      },
      {
        icon: "🔀",
        value: all.filter((t) => t.category.includes("deriv")).length,
        label: "Derivación",
        description: "Áreas"
      },
      {
        icon: "✅",
        value: all.filter((t) => t.category.includes("cierre")).length,
        label: "Cierre",
        description: "Finalización"
      }
    ]);

    setText("#templateSummaryTitle", `${rows.length} plantillas visibles`);
    setText("#templateSummaryText", `Filtro actual: ${labelFilter(State.templateFilter)}`);

    setHTML(
      "#templateGrid",
      rows
        .map(
          (t) => `
          <article class="template-card">
            <div class="template-card__header">
              <span>${esc(t.icon)}</span>
              <div>
                <strong>${esc(t.title)}</strong>
                <small>${esc(t.channel)} · v${esc(t.version)}</small>
              </div>
            </div>

            <p>${esc(t.description || "Plantilla disponible para gestión de atención.")}</p>

            <div class="case-meta">
              <span>${esc(t.categoryLabel || t.category)}</span>
              <span>${t.oficial ? "Oficial" : "Personal"}</span>
              <span>${t.active ? "Activa" : "Inactiva"}</span>
            </div>

            <div class="service-actions">
              <button type="button" data-template-preview="${esc(t.id)}">Previsualizar</button>
              <button type="button" data-template-use="${esc(t.id)}">Usar</button>
            </div>
          </article>
        `
        )
        .join("")
    );

    renderAi("#templatesAiSummary", [
      {
        title: "Tono recomendado",
        text: "Usa mensajes claros, neutrales, trazables y orientados a acción."
      },
      {
        title: "Variables",
        text: "Las variables deben venir de BD y reemplazarse con datos reales del caso seleccionado."
      },
      {
        title: "Control operativo",
        text: "Las plantillas oficiales deberían pasar por aprobación de supervisión o administración."
      }
    ]);

    renderChecklist("#templateVariablesList", getTemplateVariables());

    show($("#emptyTemplateState"), !rows.length);

    $$("[data-template-preview]").forEach((button) => {
      button.addEventListener("click", () => openPreviewTemplate(button.dataset.templatePreview));
    });

    $$("[data-template-use]").forEach((button) => {
      button.addEventListener("click", () => openUseTemplate(button.dataset.templateUse));
    });
  } catch (error) {
    renderAi("#templatesAiSummary", [
      {
        title: "No se pudieron cargar plantillas",
        text: error.message
      }
    ]);

    show($("#emptyTemplateState"), true);
  }
}

function templateFiltered() {
  const q = getValue("#templateSearchInput").toLowerCase();

  return State.templates
    .map(normalizeTemplate)
    .filter((t) => {
      const text = `
        ${t.title}
        ${t.category}
        ${t.categoryLabel}
        ${t.channel}
        ${t.description}
        ${t.body}
      `.toLowerCase();

      return (
        (!q || text.includes(q)) &&
        (State.templateFilter === "todos" || t.category === State.templateFilter)
      );
    })
    .sort((a, b) => Number(b.oficial) - Number(a.oficial) || String(a.title).localeCompare(String(b.title)));
}

function openPreviewTemplate(id) {
  const t = getTemplate(id);

  if (!t) {
    genericModal("💬", "Plantilla no encontrada", "No se encontró la plantilla seleccionada.");
    return;
  }

  State.selectedTemplateId = id;

  setText("#previewTemplateIcon", t.icon);
  setText("#previewTemplateTitle", t.title);
  setText("#previewTemplateDescription", t.description || "Vista previa del mensaje antes de usarlo en un caso real.");

  setHTML(
    "#previewTemplateSummary",
    summaryHTML([
      ["Canal sugerido", t.channel],
      ["Categoría", t.categoryLabel || t.category],
      ["Tipo", t.oficial ? "Oficial" : "Personal"],
      ["Versión", t.version],
      ["Mensaje base", t.body || "Sin contenido registrado."]
    ])
  );

  openModal("#previewTemplateModal");
}

function openUseTemplate(id) {
  const t = getTemplate(id);

  if (!t) {
    genericModal("💬", "Plantilla no encontrada", "No se encontró la plantilla seleccionada.");
    return;
  }

  State.selectedTemplateId = id;
  State.selectedTemplateCase = null;

  setHTML(
    "#useTemplateContext",
    summaryHTML([
      ["Plantilla", t.title],
      ["Categoría", t.categoryLabel || t.category],
      ["Canal sugerido", t.channel],
      ["Versión", t.version]
    ])
  );

  if ($("#templateCaseCode")) $("#templateCaseCode").value = "";
  if ($("#templateMessage")) $("#templateMessage").value = t.body || "";
  if ($("#templateDeclaration")) $("#templateDeclaration").checked = false;

  populateCatalogDrivenUI();
  ensureTemplateCaseResults();

  openModal("#useTemplateModal");
}

function ensureTemplateCaseResults() {
  const input = $("#templateCaseCode");
  if (!input) return;

  let results = $("#templateCaseResults");

  if (!results) {
    input.insertAdjacentHTML(
      "afterend",
      `<div class="search-results template-case-results" id="templateCaseResults"></div>`
    );

    results = $("#templateCaseResults");
  }

  results.innerHTML = `
    <p class="muted">Busca un caso por código, cliente, documento o servicio.</p>
  `;
}

async function handleTemplateCaseSearch() {
  const q = getValue("#templateCaseCode");
  const box = $("#templateCaseResults");

  if (!box) return;

  State.selectedTemplateCase = null;

  if (q.length < 3) {
    box.innerHTML = `<p class="muted">Escribe al menos 3 caracteres para buscar casos.</p>`;
    return;
  }

  box.innerHTML = `<p class="muted">Buscando casos relacionados...</p>`;

  try {
    const response = await apiRequest(`/asesor/casos/buscar${buildQuery({ q })}`);
    const rows = response.items || response.casos || response.results || [];

    box.innerHTML = rows.length
      ? rows
          .map((item) => {
            const c = normalizeCase(item);

            return `
              <button type="button" class="search-result-item" data-template-case="${esc(c.id)}">
                <span>🧾</span>
                <div>
                  <strong>${esc(c.code)} · ${esc(c.clientName)}</strong>
                  <small>${esc(c.service)} · ${esc(c.status)} · ${esc(c.slaText)}</small>
                </div>
              </button>
            `;
          })
          .join("")
      : `<p class="muted">No se encontraron casos.</p>`;

    $$("[data-template-case]", box).forEach((button) => {
      button.addEventListener("click", async () => {
        const caseId = button.dataset.templateCase;
        const item = rows.map(normalizeCase).find((c) => String(c.id) === String(caseId));

        State.selectedTemplateCase = item || null;

        if ($("#templateCaseCode")) {
          $("#templateCaseCode").value = item?.code || caseId;
        }

        box.innerHTML = item
          ? `
            <article class="check-item">
              <span class="check-icon">🧾</span>
              <div>
                <strong>${esc(item.code)} seleccionado</strong>
                <p>${esc(item.clientName)} · ${esc(item.service)} · ${esc(item.status)}</p>
              </div>
            </article>
          `
          : "";

        await renderSelectedTemplateForCase();
      });
    });
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

async function renderSelectedTemplateForCase() {
  if (!State.selectedTemplateId || !State.selectedTemplateCase) return;

  try {
    const response = await apiRequest(`/asesor/plantillas/${encodeURIComponent(State.selectedTemplateId)}/renderizar`, {
      method: "POST",
      body: JSON.stringify({
        caso_id: State.selectedTemplateCase.id,
        codigo_caso: State.selectedTemplateCase.code
      })
    });

    const rendered = response.mensaje || response.message || response.contenido || "";

    if (rendered && $("#templateMessage")) {
      $("#templateMessage").value = rendered;
    }
  } catch {
    const t = getTemplate(State.selectedTemplateId);
    const c = State.selectedTemplateCase;

    if (!t || !c || !$("#templateMessage")) return;

    $("#templateMessage").value = replaceTemplateVariables(t.body, c);
  }
}

function replaceTemplateVariables(text, c) {
  return String(text || "")
    .replaceAll("{cliente_nombre}", c.clientName || "")
    .replaceAll("{codigo_caso}", c.code || "")
    .replaceAll("{servicio_afectado}", c.service || "")
    .replaceAll("{fecha_limite_sla}", c.deadline ? formatDate(c.deadline) : c.slaText || "")
    .replaceAll("{asesor_nombre}", State.advisor?.nombre || State.user?.nombre || "Asesor")
    .replaceAll("{estado_caso}", c.status || "")
    .replaceAll("{motivo_reclamo}", c.reason || "");
}

async function sendTemplate() {
  if (
    !getValue("#templateCaseCode") ||
    !getValue("#templateChannel") ||
    !getValue("#templateMessage") ||
    !isChecked("#templateDeclaration")
  ) {
    toast("Faltan datos", "Completa caso, canal, mensaje y confirmación.", "warning");
    return;
  }

  const t = getTemplate(State.selectedTemplateId);

  openConfirmAction({
    icon: "📤",
    eyebrow: "Usar plantilla",
    title: "Confirmar envío de mensaje",
    text: "El mensaje será registrado como comunicación del caso y quedará en la trazabilidad.",
    summary: summaryHTML([
      ["Plantilla", t?.title || State.selectedTemplateId || "-"],
      ["Caso", getValue("#templateCaseCode")],
      ["Canal", getValue("#templateChannel")],
      ["Mensaje", getValue("#templateMessage").slice(0, 180) + (getValue("#templateMessage").length > 180 ? "..." : "")]
    ]),
    checkText: "Confirmo que revisé el mensaje y corresponde al caso seleccionado.",
    confirmLabel: "Enviar mensaje",
    onConfirm: async () => {
      try {
        await apiRequest(`/asesor/plantillas/${encodeURIComponent(State.selectedTemplateId)}/usar`, {
          method: "POST",
          body: JSON.stringify({
            codigo_caso: getValue("#templateCaseCode"),
            caso_id: State.selectedTemplateCase?.id || null,
            canal: getValue("#templateChannel"),
            mensaje: getValue("#templateMessage")
          })
        });

        closeModals();
        toast("Mensaje enviado", "La plantilla fue aplicada al caso correctamente.", "success");
      } catch (error) {
        genericModal("!", "No se pudo enviar", error.message);
      }
    }
  });
}

function improveTemplateTone() {
  const message = $("#templateMessage");
  if (!message) return;

  const base = message.value || "";
  message.value =
    `${base}\n\nQuedamos atentos a su respuesta para continuar con la atención dentro de los plazos establecidos.`;
}

async function saveNewTemplate() {
  if (
    !getValue("#newTemplateName") ||
    !getValue("#newTemplateCategory") ||
    !getValue("#newTemplateBody") ||
    !isChecked("#newTemplateDeclaration")
  ) {
    toast("Faltan datos", "Completa nombre, categoría, contenido y confirmación.", "warning");
    return;
  }

  openConfirmAction({
    icon: "➕",
    eyebrow: "Nueva plantilla",
    title: "Confirmar creación de plantilla",
    text: "La plantilla quedará registrada como borrador/personal hasta que backend defina el flujo de aprobación.",
    summary: summaryHTML([
      ["Nombre", getValue("#newTemplateName")],
      ["Categoría", getValue("#newTemplateCategory")],
      ["Contenido", getValue("#newTemplateBody").slice(0, 180) + (getValue("#newTemplateBody").length > 180 ? "..." : "")]
    ]),
    checkText: "Confirmo que la plantilla puede usarse como mensaje base de atención.",
    confirmLabel: "Guardar plantilla",
    onConfirm: async () => {
      try {
        await apiRequest("/asesor/plantillas", {
          method: "POST",
          body: JSON.stringify({
            nombre: getValue("#newTemplateName"),
            categoria: getValue("#newTemplateCategory"),
            contenido: getValue("#newTemplateBody"),
            estado: "borrador",
            origen: "asesor"
          })
        });

        closeModals();
        State.templates = [];
        await renderTemplates(true);

        toast("Plantilla guardada", "La plantilla fue registrada correctamente.", "success");
      } catch (error) {
        genericModal("!", "No se pudo guardar plantilla", error.message);
      }
    }
  });
}

function generateNewTemplateBody() {
  const category = getValue("#newTemplateCategory") || "general";
  const name = getValue("#newTemplateName") || "Plantilla de atención";

  const templates = {
    evidencia:
      "Estimado(a) {cliente_nombre}, para continuar con la atención del caso {codigo_caso}, solicitamos adjuntar evidencia relacionada con {servicio_afectado}. Esta información nos permitirá validar el sustento y continuar dentro del plazo establecido.",
    reclamo:
      "Estimado(a) {cliente_nombre}, hemos registrado la revisión del caso {codigo_caso} asociado al servicio {servicio_afectado}. Continuaremos con la evaluación y le informaremos el avance correspondiente.",
    derivacion:
      "Se deriva el caso {codigo_caso} al área responsable para evaluación especializada del servicio {servicio_afectado}. Se solicita priorizar la atención considerando el plazo SLA {fecha_limite_sla}.",
    cierre:
      "Estimado(a) {cliente_nombre}, luego de la revisión realizada sobre el caso {codigo_caso}, informamos que la atención ha sido completada. Se deja constancia de la respuesta final y trazabilidad correspondiente."
  };

  if ($("#newTemplateBody")) {
    $("#newTemplateBody").value = templates[category] || `Contenido sugerido para ${name}: incluir {cliente_nombre}, {codigo_caso}, detalle del caso, acción requerida y plazo.`;
  }
}

function getTemplateVariables() {
  const catalog = getCatalog("variablesPlantilla");

  return catalog.map((item) => ({
    icon: "{ }",
    title: item.nombre,
    text:
      item.metadata?.descripcion ||
      item.metadata?.detalle ||
      "Variable dinámica reemplazada con información del caso desde backend."
  }));
}

function openVariablesModal() {
  const variables = getTemplateVariables();

  setHTML(
    "#variablesModalSummary",
    summaryHTML(variables.map((v) => [v.title, v.text]))
  );

  openModal("#variablesModal");
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

async function initNotificaciones() {
  bindNotificationEvents();
  await renderNotifications(true);
}

function bindNotificationEvents() {
  $("#advisorNotificationSearch")?.addEventListener("input", () => renderNotifications(false));

  $$("[data-advisor-notification-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.notificationFilter = button.dataset.advisorNotificationFilter || "todas";

      $$("[data-advisor-notification-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderNotifications(false);
    });
  });

  $("#refreshAdvisorNotificationsBtn")?.addEventListener("click", async () => {
    await renderNotifications(true);
    toast("Notificaciones actualizadas", "Las alertas fueron actualizadas correctamente.", "success");
  });

  $("#markAllAdvisorNotificationsBtn")?.addEventListener("click", confirmMarkAllNotificationsRead);

  $("#clearAdvisorReadBtn")?.addEventListener("click", () => openModal("#clearNotificationsModal"));

  $("#confirmClearReadNotificationsBtn")?.addEventListener("click", confirmClearReadNotifications);

  $("#notificationOpenCaseBtn")?.addEventListener("click", openNotificationCase);

  $("#notificationMarkReadBtn")?.addEventListener("click", confirmMarkSelectedNotificationRead);
}

async function renderNotifications(force = false) {
  try {
    await loadNotifications(force);

    const rows = notificationFiltered();
    const all = State.notifications.map(normalizeNotification);

    renderKpis("#notificationsKpiGrid", [
      {
        icon: "🔥",
        value: all.filter((n) => n.priority === "critica").length,
        label: "Críticas",
        description: "SLA o urgencia"
      },
      {
        icon: "📥",
        value: all.filter((n) => n.type.includes("asign")).length,
        label: "Asignaciones",
        description: "Nuevos casos"
      },
      {
        icon: "📩",
        value: all.filter((n) => n.type.includes("cliente")).length,
        label: "Cliente",
        description: "Respuestas recibidas"
      },
      {
        icon: "🔔",
        value: all.filter((n) => n.unread).length,
        label: "No leídas",
        description: "Pendientes"
      }
    ]);

    setText("#notificationsSummaryTitle", `${all.filter((n) => n.unread).length} alertas pendientes`);
    setText("#notificationsSummaryText", `${rows.length} notificaciones visibles.`);

    setHTML(
      "#advisorNotificationList",
      rows
        .map(
          (n) => `
          <article class="notification-item ${n.unread ? "unread" : ""}">
            <span>${esc(n.icon)}</span>

            <div>
              <h3>${esc(n.title)}</h3>
              <p>${esc(n.text)}</p>

              <div class="case-meta">
                <span>${esc(n.caseId)}</span>
                <span>${esc(n.typeLabel)}</span>
                <span>${esc(n.priorityLabel)}</span>
                <span>${esc(formatDateTime(n.date))}</span>
              </div>
            </div>

            <div class="case-actions">
              <span class="${pillClass(n.unread ? "warning" : "success")}">
                ${n.unread ? "No leída" : "Leída"}
              </span>

              <button type="button" data-notification-id="${esc(n.id)}">
                Ver
              </button>
            </div>
          </article>
        `
        )
        .join("")
    );

    renderAi("#advisorNotificationsAiSummary", [
      {
        title: "Alertas no leídas",
        text: `${all.filter((n) => n.unread).length} requieren revisión.`
      },
      {
        title: "Siguiente acción",
        text: "Prioriza alertas SLA y respuestas de clientes asociadas a casos activos."
      }
    ]);

    renderChecklist("#advisorNotificationActionPlan", [
      {
        icon: "1",
        title: "Revisar SLA",
        text: "Abrir alertas críticas primero."
      },
      {
        icon: "2",
        title: "Responder cliente",
        text: "Continuar atención si llegó evidencia."
      },
      {
        icon: "3",
        title: "Limpiar revisadas",
        text: "Archivar alertas leídas sin perder trazabilidad."
      }
    ]);

    show($("#emptyAdvisorNotificationState"), !rows.length);

    $$("[data-notification-id]").forEach((button) => {
      button.addEventListener("click", () => openNotification(button.dataset.notificationId));
    });
  } catch (error) {
    renderAi("#advisorNotificationsAiSummary", [
      {
        title: "No se pudieron cargar alertas",
        text: error.message
      }
    ]);

    show($("#emptyAdvisorNotificationState"), true);
  }
}

function notificationFiltered() {
  const q = getValue("#advisorNotificationSearch").toLowerCase();

  return State.notifications
    .map(normalizeNotification)
    .filter((n) => {
      const text = `
        ${n.title}
        ${n.text}
        ${n.caseId}
        ${n.type}
        ${n.typeLabel}
        ${n.priority}
        ${n.priorityLabel}
      `.toLowerCase();

      const f = State.notificationFilter;

      const matchesFilter =
        f === "todas" ||
        (f === "critica" && n.priority === "critica") ||
        (f === "sla" && n.type.includes("sla")) ||
        (f === "cliente" && n.type.includes("cliente")) ||
        (f === "asignacion" && n.type.includes("asign")) ||
        (f === "no_leidas" && n.unread);

      return (!q || text.includes(q)) && matchesFilter;
    })
    .sort(
      (a, b) =>
        Number(b.unread) - Number(a.unread) ||
        priorityValue(b.priority) - priorityValue(a.priority) ||
        new Date(b.date || 0) - new Date(a.date || 0)
    );
}

function openNotification(id) {
  const n = getNotification(id);

  if (!n) {
    genericModal("🔔", "Notificación no encontrada", "No se encontró la notificación seleccionada.");
    return;
  }

  State.selectedNotificationId = id;

  setText("#notificationModalIcon", n.icon);
  setText("#notificationModalTitle", n.title);
  setText("#notificationModalText", n.text);

  setHTML(
    "#notificationModalSummary",
    summaryHTML([
      ["Caso", n.caseId],
      ["Tipo", n.typeLabel],
      ["Prioridad", n.priorityLabel],
      ["Fecha", formatDateTime(n.date)],
      ["Estado", n.unread ? "No leída" : "Leída"]
    ])
  );

  openModal("#advisorNotificationModal");
}

function confirmMarkAllNotificationsRead() {
  openConfirmAction({
    icon: "🔔",
    eyebrow: "Notificaciones",
    title: "Marcar todas como leídas",
    text: "Todas las notificaciones visibles del asesor pasarán a estado leído.",
    summary: summaryHTML([
      ["No leídas", State.notifications.map(normalizeNotification).filter((n) => n.unread).length],
      ["Filtro actual", labelFilter(State.notificationFilter)]
    ]),
    checkText: "Confirmo que deseo marcar todas las notificaciones como leídas.",
    confirmLabel: "Marcar leídas",
    onConfirm: markAllNotificationsRead
  });
}

async function markAllNotificationsRead() {
  try {
    await apiRequest("/asesor/notificaciones/marcar-todas-leidas", {
      method: "PATCH"
    });

    closeModals();
    State.notifications = [];

    await renderNotifications(true);

    toast("Notificaciones actualizadas", "Todas fueron marcadas como leídas.", "success");
  } catch (error) {
    genericModal("!", "No se pudo actualizar", error.message);
  }
}

function confirmMarkSelectedNotificationRead() {
  const n = getNotification(State.selectedNotificationId);

  if (!n) return;

  openConfirmAction({
    icon: "🔔",
    eyebrow: "Notificación",
    title: "Marcar notificación como leída",
    text: "La alerta seleccionada quedará marcada como revisada.",
    summary: summaryHTML([
      ["Título", n.title],
      ["Caso", n.caseId],
      ["Prioridad", n.priorityLabel]
    ]),
    checkText: "Confirmo que revisé esta notificación.",
    confirmLabel: "Marcar leída",
    onConfirm: markSelectedNotificationRead
  });
}

async function markSelectedNotificationRead() {
  if (!State.selectedNotificationId) return;

  try {
    await apiRequest(`/asesor/notificaciones/${encodeURIComponent(State.selectedNotificationId)}/leer`, {
      method: "PATCH"
    });

    closeModals();
    State.notifications = [];

    await renderNotifications(true);

    toast("Notificación actualizada", "La notificación fue marcada como leída.", "success");
  } catch (error) {
    genericModal("!", "No se pudo actualizar", error.message);
  }
}

async function openNotificationCase() {
  const n = getNotification(State.selectedNotificationId);

  if (!n?.caseId || n.caseId === "-") {
    genericModal("🧾", "Sin caso relacionado", "Esta notificación no tiene un caso asociado.");
    return;
  }

  try {
    await apiRequest(`/asesor/notificaciones/${encodeURIComponent(State.selectedNotificationId)}/leer`, {
      method: "PATCH"
    });
  } catch {}

  goToDetail(n.caseId);
}

function confirmClearReadNotifications() {
  openConfirmAction({
    icon: "🧹",
    eyebrow: "Limpiar notificaciones",
    title: "Confirmar limpieza de leídas",
    text: "Las notificaciones leídas se ocultarán de la vista activa, sin perder trazabilidad.",
    summary: summaryHTML([
      ["Leídas", State.notifications.map(normalizeNotification).filter((n) => !n.unread).length],
      ["No leídas", State.notifications.map(normalizeNotification).filter((n) => n.unread).length]
    ]),
    checkText: "Confirmo que deseo limpiar las notificaciones leídas.",
    confirmLabel: "Limpiar leídas",
    onConfirm: clearReadNotifications
  });
}

async function clearReadNotifications() {
  try {
    await apiRequest("/asesor/notificaciones/limpiar-leidas", {
      method: "PATCH"
    });

    closeModals();
    State.notifications = [];

    await renderNotifications(true);

    toast("Bandeja actualizada", "Las notificaciones leídas fueron ocultadas.", "success");
  } catch (error) {
    genericModal("!", "No se pudo limpiar", error.message);
  }
}

/* =========================================================
   RENDIMIENTO
========================================================= */

async function initRendimiento() {
  bindPerformanceEvents();
  await renderPerformance();
}

function bindPerformanceEvents() {
  bindPerformanceButton("#performanceWeekBtn", async () => {
    State.performancePeriod = "semana";
    await renderPerformance();
  });

  bindPerformanceButton("#performanceMonthBtn", async () => {
    State.performancePeriod = "mes";
    await renderPerformance();
  });

  bindPerformanceButton("#performanceAnalyzeBtn", async () => {
    await renderPerformance();
    toast("Rendimiento actualizado", "Se recalcularon los indicadores del periodo.", "success");
  });

  bindPerformanceButton("#performanceInsightBtn", () => {
    openPerformanceInsights();
  });

  bindPerformanceButton("#performanceExportBtn", () => {
    openPerformanceExport();
  });

  bindPerformanceButton("#performanceDownloadBtn", () => {
    openPerformanceExport();
  });
}

/*
  Se usa captura para evitar que setupBot también tome
  performanceInsightBtn / performanceAnalyzeBtn.
*/
function bindPerformanceButton(selector, handler) {
  const button = $(selector);
  if (!button) return;

  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      await handler(event);
    },
    true
  );
}

async function renderPerformance() {
  State.loading.performance = true;
  setPerformanceActiveButton();

  try {
    const response = await fetchPerformanceData(State.performancePeriod);

    State.performance = normalizePerformanceResponse(response);

    renderPerformanceKpis(State.performance);
    renderPerformanceHeader(State.performance);
    renderPerformanceChart(State.performance);
    renderPerformanceSla(State.performance);
    renderPerformancePriorities(State.performance);
    renderPerformanceTables(State.performance);
    renderPerformanceAi(State.performance);
    renderPerformancePlan(State.performance);

  } catch (error) {
    console.error("Error cargando rendimiento:", error);
    renderPerformanceError(error.message);
  } finally {
    State.loading.performance = false;
  }
}

async function fetchPerformanceData(period) {
  try {
    return await apiRequest(
      `/asesor/rendimiento${buildQuery({ period })}`
    );
  } catch (error) {
    return await apiRequest(
      `/asesor/rendimiento${buildQuery({ periodo: period })}`
    );
  }
}

function normalizePerformanceResponse(data = {}) {
  const table =
    data.table ||
    data.tabla ||
    data.tiempos_tipo ||
    data.detalle_tipo ||
    [];

  const priorities =
    data.priorities ||
    data.prioridades ||
    data.carga_prioridad ||
    [];

  const chart =
    data.chart ||
    data.grafico ||
    data.evolucion ||
    [];

  const slaPercent = toNumber(
    data.sla_percent ??
    data.sla ??
    data.cumplimiento_sla ??
    0
  );

  return {
    ...data,
    period: data.period || data.periodo || State.performancePeriod,
    total_cases: toNumber(
      data.total_cases ??
      data.casos ??
      data.total_casos ??
      data.cases ??
      0
    ),
    closed_cases: toNumber(
      data.closed_cases ??
      data.casos_cerrados ??
      data.cerrados ??
      0
    ),
    history_events: toNumber(
      data.history_events ??
      data.eventos_historial ??
      data.eventos ??
      0
    ),
    critical_cases: toNumber(
      data.critical_cases ??
      data.criticos_activos ??
      data.criticos ??
      0
    ),
    risk_cases: toNumber(
      data.risk_cases ??
      data.riesgo_sla ??
      data.sla_riesgo ??
      0
    ),
    sla_percent: Math.max(0, Math.min(100, slaPercent)),
    chart,
    table,
    priorities,
    ai_summary:
      data.ai_summary ||
      data.resumen_ia ||
      buildPerformanceInsights(data),
    action_plan:
      data.action_plan ||
      data.plan_accion ||
      buildPerformancePlan(data)
  };
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  const normalized = String(value)
    .replace("%", "")
    .replace(",", ".")
    .trim();

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function setPerformanceActiveButton() {
  $("#performanceWeekBtn")?.classList.toggle(
    "is-active",
    State.performancePeriod === "semana"
  );

  $("#performanceMonthBtn")?.classList.toggle(
    "is-active",
    State.performancePeriod === "mes"
  );
}

function renderPerformanceKpis(data) {
  const kpis = Array.isArray(data.kpis) && data.kpis.length
    ? data.kpis
    : [
        {
          icon: "📥",
          value: data.total_cases,
          label: "Casos atendidos",
          description: `Periodo ${State.performancePeriod}`
        },
        {
          icon: "✅",
          value: data.closed_cases,
          label: "Casos cerrados",
          description: "Con respuesta final"
        },
        {
          icon: "🕘",
          value: data.history_events,
          label: "Eventos registrados",
          description: "Historial operativo"
        },
        {
          icon: "⏱️",
          value: `${data.sla_percent}%`,
          label: "SLA cumplido",
          description: "Estimación operativa"
        },
        {
          icon: "🔥",
          value: data.critical_cases,
          label: "Críticos activos",
          description: "Mayor prioridad"
        },
        {
          icon: "🚨",
          value: data.risk_cases,
          label: "Riesgo SLA",
          description: "Vencen pronto o vencidos"
        }
      ];

  renderKpis("#performanceKpiGrid", kpis);
}

function renderPerformanceHeader(data) {
  setText(
    "#performanceSummaryTitle",
    data.summary_title ||
      data.titulo_resumen ||
      "Rendimiento operativo"
  );

  setText(
    "#performanceSummaryText",
    data.summary_text ||
      `Periodo actual: ${State.performancePeriod}. Se consideran casos atendidos, cierres, historial y SLA.`
  );

  setText(
    "#performanceTrendBadge",
    data.trend ||
      data.tendencia ||
      "Actualizado"
  );
}

function getPerformanceChartRows(data) {
  if (Array.isArray(data.chart) && data.chart.length) {
    return data.chart.map((item) => ({
      label: item.label || item.day || item.fecha || item[0] || "-",
      value: toNumber(item.value ?? item.total ?? item.casos ?? item[1] ?? 0)
    }));
  }

  const tableRows = getPerformanceTableRows(data);

  if (tableRows.length) {
    return tableRows.map((item) => ({
      label: item.tipo,
      value: toNumber(item.casos)
    }));
  }

  if (Array.isArray(data.priorities) && data.priorities.length) {
    return data.priorities.map((item) => ({
      label: item.label || item.prioridad || item[0] || "Prioridad",
      value: toNumber(item.value ?? item.cantidad ?? item.total ?? item[1] ?? 0)
    }));
  }

  return [
    {
      label: "Atendidos",
      value: data.total_cases
    },
    {
      label: "Cerrados",
      value: data.closed_cases
    },
    {
      label: "Eventos",
      value: data.history_events
    },
    {
      label: "Riesgo SLA",
      value: data.risk_cases
    }
  ].filter((item) => Number(item.value) > 0);
}

function renderPerformanceChart(data) {
  const rows = getPerformanceChartRows(data);
  const max = Math.max(...rows.map((item) => Number(item.value || 0)), 1);

  const html = rows.length
    ? rows.map((item) => {
        const width = Math.max(8, Math.round((Number(item.value || 0) / max) * 100));

        return `
          <div class="bar-chart__row performance-chart-row">
            <span>${esc(item.label)}</span>
            <div class="performance-chart-bar">
              <i style="width:${width}%"></i>
            </div>
            <strong>${esc(item.value)}</strong>
          </div>
        `;
      }).join("")
    : `
      <div class="empty-state">
        <span>📊</span>
        <h3>Sin actividad registrada</h3>
        <p>No hay suficiente información para construir la evolución del periodo.</p>
      </div>
    `;

  setHTML("#performanceChart", html);
  setHTML("#performanceChartList", html);
  setHTML("#performanceChartPatch", html);
}

function renderPerformanceSla(data) {
  const sla = Math.max(0, Math.min(100, toNumber(data.sla_percent)));

  setHTML(
    "#performanceSlaDonut",
    `
      <div class="donut-metric__ring" style="--progress:${sla}">
        <span>${esc(sla)}%</span>
      </div>
      <p>${esc(data.sla_text || "Cumplimiento SLA del periodo seleccionado.")}</p>
    `
  );
}

function renderPerformancePriorities(data) {
  const priorities = Array.isArray(data.priorities) ? data.priorities : [];

  if (!priorities.length) {
    setHTML(
      "#performancePriorityStack",
      `
        <div>
          <span>Sin prioridad</span>
          <strong>0</strong>
        </div>
      `
    );
    return;
  }

  setHTML(
    "#performancePriorityStack",
    priorities
      .map((item) => {
        const label = item.label || item.prioridad || item[0] || "-";
        const value = item.value ?? item.cantidad ?? item.total ?? item[1] ?? 0;

        return `
          <div>
            <span>${esc(label)}</span>
            <strong>${esc(value)}</strong>
          </div>
        `;
      })
      .join("")
  );
}

function getPerformanceTableRows(data) {
  const table = Array.isArray(data.table) ? data.table : [];

  if (table.length) {
    return table.map((row) => ({
      tipo: row.tipo || row.type || row.categoria || row[0] || "-",
      casos: row.casos ?? row.cases ?? row.total ?? row[1] ?? 0,
      tiempo_promedio: row.tiempo_promedio || row.avg_time || row.tiempo || row[2] || "Según historial",
      sla: row.sla || row.sla_percent || row[3] || `${data.sla_percent ?? 0}%`,
      estado: row.estado || row.status || row[4] || "En revisión",
      status_type: row.status_type || row.estado_tipo || row[5] || "info"
    }));
  }

  const priorities = Array.isArray(data.priorities) ? data.priorities : [];

  if (priorities.length) {
    return priorities.map((item) => {
      const value = toNumber(item.value ?? item.cantidad ?? item.total ?? item[1] ?? 0);

      return {
        tipo: item.label || item.prioridad || item[0] || "Prioridad",
        casos: value,
        tiempo_promedio: "Según historial",
        sla: `${data.sla_percent ?? 0}%`,
        estado: value > 0 ? "Controlado" : "Sin carga",
        status_type: value > 0 ? "success" : "info"
      };
    });
  }

  return [
    {
      tipo: "Atención general",
      casos: data.total_cases ?? 0,
      tiempo_promedio: "Según historial",
      sla: `${data.sla_percent ?? 0}%`,
      estado: data.total_cases > 0 ? "En revisión" : "Sin carga",
      status_type: data.total_cases > 0 ? "info" : "warning"
    }
  ];
}

function getPerformanceStatusClass(type) {
  const value = normalizeCode(type);

  if (value.includes("success") || value.includes("control")) {
    return "status-tag status-tag--success";
  }

  if (value.includes("warning") || value.includes("vigilar")) {
    return "status-tag status-tag--warning";
  }

  if (value.includes("danger") || value.includes("riesgo")) {
    return "status-tag status-tag--warning";
  }

  return "status-tag status-tag--info";
}

function renderPerformanceTables(data) {
  const rows = getPerformanceTableRows(data);

  const htmlFiveColumns = rows
    .map(
      (row) => `
        <tr>
          <td>${esc(row.tipo)}</td>
          <td>${esc(row.casos)}</td>
          <td>${esc(row.tiempo_promedio)}</td>
          <td>${esc(row.sla)}</td>
          <td>
            <span class="${getPerformanceStatusClass(row.status_type)}">
              ${esc(row.estado)}
            </span>
          </td>
        </tr>
      `
    )
    .join("");

  const htmlFourColumns = rows
    .map(
      (row) => `
        <tr>
          <td>${esc(row.tipo)}</td>
          <td>${esc(row.casos)}</td>
          <td>${esc(row.tiempo_promedio)}</td>
          <td>${esc(row.sla)}</td>
        </tr>
      `
    )
    .join("");

  [
    "#performanceTableBody",
    "#performanceTypeTableBody",
    "#performanceDetailTableBody",
    "#performanceTablePatch"
  ].forEach((selector) => {
    const tbody = $(selector);
    if (!tbody) return;

    const thCount = tbody.closest("table")?.querySelectorAll("thead th").length || 5;
    tbody.innerHTML = thCount >= 5 ? htmlFiveColumns : htmlFourColumns;
  });

  /*
    Respaldo para tablas que no tengan ID pero tengan los encabezados:
    Tipo / Categoría, Casos, Tiempo Promedio, SLA.
  */
  $$("table").forEach((table) => {
    const headerText = table.textContent.toLowerCase();

    const isPerformanceTable =
      headerText.includes("tipo / categoría") ||
      headerText.includes("tiempo promedio") ||
      headerText.includes("tiempos, casos y sla") ||
      headerText.includes("detalle operativo");

    if (!isPerformanceTable) return;

    const tbody =
      table.querySelector("tbody") ||
      table.appendChild(document.createElement("tbody"));

    const thCount = table.querySelectorAll("thead th").length || 4;
    tbody.innerHTML = thCount >= 5 ? htmlFiveColumns : htmlFourColumns;
  });
}

function renderPerformanceAi(data) {
  const list = Array.isArray(data.ai_summary) && data.ai_summary.length
    ? data.ai_summary
    : buildPerformanceInsights(data);

  renderAi("#performanceAiSummary", list);

  setHTML(
    "#performanceAiSummaryList",
    list
      .map(
        (item) => `
          <div class="performance-mini-item">
            <strong>${esc(item.title || "Resumen")}</strong>
            <p>${esc(item.text || "-")}</p>
          </div>
        `
      )
      .join("")
  );

  setHTML(
    "#performanceSummaryPatch",
    list
      .map(
        (item) => `
          <div class="performance-mini-item">
            <strong>${esc(item.title || "Resumen")}</strong>
            <p>${esc(item.text || "-")}</p>
          </div>
        `
      )
      .join("")
  );
}

function renderPerformancePlan(data) {
  const list = Array.isArray(data.action_plan) && data.action_plan.length
    ? data.action_plan
    : buildPerformancePlan(data);

  renderChecklist("#performanceActionPlan", list);

  const html = list
    .map(
      (item) => `
        <div class="performance-plan-item">
          <span>${esc(item.icon || "•")}</span>
          <div>
            <strong>${esc(item.title || "Acción")}</strong>
            <p>${esc(item.text || "-")}</p>
          </div>
        </div>
      `
    )
    .join("");

  setHTML("#performanceActionPlanList", html);
  setHTML("#performancePlanPatch", html);
}

function renderPerformanceError(message) {
  renderKpis("#performanceKpiGrid", [
    {
      icon: "!",
      value: "-",
      label: "Sin conexión",
      description: "No se pudo consultar rendimiento"
    }
  ]);

  setHTML(
    "#performanceChart",
    `
      <div class="empty-state">
        <span>📉</span>
        <h3>No se pudo cargar el gráfico</h3>
        <p>${esc(message || "Revisa backend, sesión o endpoint.")}</p>
      </div>
    `
  );

  setHTML(
    "#performanceTableBody",
    `
      <tr>
        <td colspan="5">No se pudo cargar la tabla de rendimiento.</td>
      </tr>
    `
  );

  renderAi("#performanceAiSummary", [
    {
      title: "Error de carga",
      text: message || "No se pudo consultar el rendimiento."
    }
  ]);

  renderChecklist("#performanceActionPlan", [
    {
      icon: "!",
      title: "Validar backend",
      text: "Prueba el endpoint /api/asesor/rendimiento desde Swagger con sesión activa."
    }
  ]);
}

function buildPerformanceInsights(data = {}) {
  const sla = toNumber(data.sla_percent ?? data.sla ?? data.cumplimiento_sla ?? 0);
  const total = data.total_cases ?? data.casos ?? data.total_casos ?? 0;
  const closed = data.closed_cases ?? data.casos_cerrados ?? data.cerrados ?? 0;
  const risk = data.risk_cases ?? data.riesgo_sla ?? data.sla_riesgo ?? 0;

  let recommendation = "Mantener priorización por SLA, criticidad y trazabilidad de cierre.";

  if (sla && sla < 80) {
    recommendation = "Priorizar casos con vencimiento cercano y reducir pendientes por cliente.";
  } else if (risk > 0) {
    recommendation = "Atender primero los casos con riesgo SLA antes de tomar nuevos casos.";
  }

  return [
    {
      title: "Lectura del periodo",
      text: `Periodo ${State.performancePeriod}: ${total} caso(s) considerados y ${closed} cierre(s) registrados.`
    },
    {
      title: "Cumplimiento SLA",
      text: `Cumplimiento operativo estimado: ${sla}%.`
    },
    {
      title: "Recomendación",
      text: recommendation
    }
  ];
}

function buildPerformancePlan(data = {}) {
  const sla = toNumber(data.sla_percent ?? data.sla ?? data.cumplimiento_sla ?? 0);
  const risk = data.risk_cases ?? data.riesgo_sla ?? data.sla_riesgo ?? 0;

  return [
    {
      icon: "1",
      title: "Priorizar SLA",
      text: risk > 0
        ? `Atender ${risk} caso(s) con riesgo SLA antes de continuar con casos de menor prioridad.`
        : "Mantener revisión diaria de vencimientos."
    },
    {
      icon: "2",
      title: "Reducir bloqueos",
      text: "Solicitar evidencias temprano y registrar seguimiento preventivo."
    },
    {
      icon: "3",
      title: "Validar cierres",
      text: sla < 80
        ? "Cerrar casos con sustento suficiente para recuperar cumplimiento operativo."
        : "Cerrar solo con respuesta final, evidencia suficiente y trazabilidad completa."
    }
  ];
}

function openPerformanceInsights() {
  const p = State.performance;

  if (!p) {
    toast("Sin datos", "Primero carga o analiza el rendimiento.", "warning");
    return;
  }

  setText("#genericModalIcon", "🤖");
  setText("#genericModalTitle", "Insights de rendimiento");

  const ai = Array.isArray(p.ai_summary) && p.ai_summary.length
    ? p.ai_summary
    : buildPerformanceInsights(p);

  const plan = Array.isArray(p.action_plan) && p.action_plan.length
    ? p.action_plan
    : buildPerformancePlan(p);

  const html = `
    <div class="case-modal-summary">
      ${summaryHTML([
        ["Periodo", State.performancePeriod],
        ["SLA", `${p.sla_percent ?? 0}%`],
        ["Casos atendidos", p.total_cases ?? "-"],
        ["Casos cerrados", p.closed_cases ?? "-"]
      ])}
    </div>

    <div class="ai-summary" style="margin-top:14px">
      ${ai
        .map(
          (item) => `
            <article>
              <strong>${esc(item.title || "Insight")}</strong>
              <p>${esc(item.text || "-")}</p>
            </article>
          `
        )
        .join("")}
    </div>

    <div class="checklist-grid" style="margin-top:14px">
      ${plan
        .map(
          (item) => `
            <article>
              <span>${esc(item.icon || "•")}</span>
              <div>
                <strong>${esc(item.title || "Acción")}</strong>
                <p>${esc(item.text || "-")}</p>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  setHTML("#genericModalText", html);
  openModal("#genericModal");
}

function openPerformanceExport() {
  const p = State.performance || {};

  openExportModal("rendimiento", {
    endpoint: EXPORT_ENDPOINTS.rendimiento,
    filename: "rendimiento-asesor",
    activeFilter: State.performancePeriod,
    visibleCount: p.total_cases ?? p.casos ?? "-",
    params: {
      period: State.performancePeriod,
      periodo: State.performancePeriod
    },
    title: "Exportar reporte de rendimiento",
    text: "Descarga un reporte profesional con indicadores, SLA, productividad y plan de mejora."
  });

  ensurePerformanceExportFormats();
}

function ensurePerformanceExportFormats() {
  const select = $("#exportFormat");
  if (!select) return;

  const requiredFormats = [
    ["pdf", "PDF"],
    ["word", "Word"],
    ["excel", "Excel"],
    ["csv", "CSV"],
    ["imagen", "Imagen"]
  ];

  const currentValues = Array.from(select.options).map((option) =>
    normalizeCode(option.value || option.textContent)
  );

  requiredFormats.forEach(([value, label]) => {
    if (!currentValues.includes(normalizeCode(value))) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  });

  if (!select.value) select.value = "pdf";
}

/* =========================================================
   OVERRIDE LIMPIO DE DESCARGA
   Corrige extensiones PDF/Word/Excel/CSV/Imagen
========================================================= */

async function downloadFromApi(endpoint, params = {}, filename = "reporte") {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}${buildQuery(params)}`, {
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      }
    });

    if (!response.ok) {
      let message = "No se pudo generar el archivo.";

      try {
        const data = await response.json();
        message = getApiErrorMessage(data);
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);

    const format = normalizeCode(params.formato || "pdf");

    const extensionMap = {
      pdf: "pdf",
      word: "doc",
      doc: "doc",
      docx: "doc",
      excel: "xls",
      xls: "xls",
      xlsx: "xls",
      csv: "csv",
      imagen: "svg",
      image: "svg",
      svg: "svg"
    };

    const extension = extensionMap[format] || "xls";

    const safeName =
      match?.[1] ||
      `${filename}-${todayISO()}.${extension}`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = safeName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    toast("Descarga iniciada", `Se generó el archivo ${safeName}.`, "success");
  } catch (error) {
    genericModal("📤", "Exportación no disponible", error.message);
  }
}