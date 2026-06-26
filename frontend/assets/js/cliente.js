"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CLIENTE.JS
   Módulo Cliente completo y conectado a backend FastAPI + SQL Server
   Reemplazar: frontend/assets/js/cliente.js
   Mantiene login existente. No modifica flujo de autenticación.
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const CONFIG = {
  maxFiles: 5,
  maxFileSizeMb: 10,
  allowedExtensions: ["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"],
  blockedExtensions: ["exe", "bat", "cmd", "sh", "js", "php", "py", "zip", "rar", "7z", "msi", "scr"],
  pageSize: 10
};

const ENDPOINTS = {
  me: ["/cliente/me"],
  dashboard: ["/cliente/dashboard"],
  search: ["/cliente/buscar", "/cliente/search"],

  claimCatalogs: ["/cliente/catalogos/reclamo", "/cliente/reclamos/catalogos", "/cliente/casos/catalogos"],
  incidentCatalogs: ["/cliente/catalogos/incidencia", "/cliente/incidencias/catalogos", "/cliente/casos/catalogos"],

  services: ["/cliente/servicios-contratados", "/cliente/servicios"],
  serviceSummary: ["/cliente/servicios-contratados/resumen", "/cliente/servicios/resumen"],
  serviceDiagnostic: ["/cliente/servicios-contratados/diagnostico", "/cliente/servicios/diagnostico"],
  serviceCases: (id) => [
    `/cliente/servicios-contratados/${encodeURIComponent(id)}/casos`,
    `/cliente/servicios/${encodeURIComponent(id)}/casos`
  ],

  cases: ["/cliente/casos"],
  casesSummary: ["/cliente/casos/resumen"],
  casesExport: ["/cliente/casos/exportar"],
  caseDetail: (codigo) => [`/cliente/casos/${encodeURIComponent(codigo)}`],
  caseEvidence: (codigo) => [`/cliente/casos/${encodeURIComponent(codigo)}/evidencias`],
  caseResponse: (codigo, requestId) =>
    requestId
      ? [
          `/cliente/casos/${encodeURIComponent(codigo)}/solicitudes/${encodeURIComponent(requestId)}/responder`,
          `/cliente/casos/${encodeURIComponent(codigo)}/respuestas`
        ]
      : [`/cliente/casos/${encodeURIComponent(codigo)}/respuestas`],
  caseSurvey: (codigo) => [`/cliente/casos/${encodeURIComponent(codigo)}/encuesta`],
  caseCertificate: (codigo) => `/cliente/casos/${encodeURIComponent(codigo)}/constancia`,
  caseShare: (codigo) => [`/cliente/casos/${encodeURIComponent(codigo)}/compartir`],

  createClaim: ["/cliente/reclamos"],
  validateClaim: ["/cliente/reclamos/validar"],
  claimDraft: ["/cliente/reclamos/borrador"],

  createIncident: ["/cliente/incidencias"],
  incidentDiagnostic: ["/cliente/incidencias/diagnostico"],
  incidentDraft: ["/cliente/incidencias/borrador"],

  notifications: ["/cliente/notificaciones"],
  notificationSummary: ["/cliente/notificaciones/resumen"],
  notificationRead: (id) => [
    `/cliente/notificaciones/${encodeURIComponent(id)}/leer`,
    `/cliente/notificaciones/${encodeURIComponent(id)}/read`
  ],
  notificationsReadAll: [
    "/cliente/notificaciones/marcar-todas-leidas",
    "/cliente/notificaciones/mark-all-read"
  ],
  notificationsHideRead: [
    "/cliente/notificaciones/ocultar-leidas",
    "/cliente/notificaciones/read"
  ],

  profile: ["/cliente/perfil"],
  profileSecurity: ["/cliente/perfil/seguridad"],
  profileAccess: ["/cliente/perfil/accesos"],
  assistant: ["/cliente/asistente"]
};

const State = {
  page: document.body.dataset.page || "",
  theme: localStorage.getItem("claro360-theme") || "light",

  user: null,
  profile: null,
  catalogs: {},
  dashboard: null,

  cases: [],
  services: [],
  notifications: [],
  activity: [],

  detail: null,
  detailRequests: [],
  detailRequest: null,

  selectedCase: null,
  selectedService: null,
  selectedNotification: null,
  selectedRating: 0,

  caseView: "cards",
  serviceView: "cards",
  notificationView: "list",

  submitting: Object.create(null),
  fileStore: Object.create(null),

  pagination: {
    cases: { page: 1, pageSize: CONFIG.pageSize, total: 0 },
    services: { page: 1, pageSize: CONFIG.pageSize, total: 0 },
    notifications: { page: 1, pageSize: CONFIG.pageSize, total: 0 }
  },

  filters: {
    caseChip: "todos",
    caseType: "todos",
    caseStatus: "todos",
    casePriority: "todos",
    caseSort: "reciente",
    caseDateFrom: "",
    caseDateTo: "",

    serviceChip: "todos",
    serviceType: "todos",
    serviceStatus: "todos",
    serviceSort: "reciente",

    notificationChip: "todas",
    notificationType: "todas",
    notificationStatus: "todas",
    notificationPriority: "todas",
    notificationSort: "reciente"
  }
};

/* =========================================================
   HELPERS GENERALES
========================================================= */

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function text(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value ?? "";
}

function setValue(selector, value) {
  const element = $(selector);
  if (element) element.value = value ?? "";
}

function value(selector) {
  return $(selector)?.value?.trim() || "";
}

function checked(selector) {
  return Boolean($(selector)?.checked);
}

function setChecked(selector, isChecked) {
  const element = $(selector);
  if (element) element.checked = Boolean(isChecked);
}

function esc(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toKey(input) {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}


function safeJsonParse(value, fallback = {}) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function storageGet(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}

  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function unwrapToken(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return "";

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return unwrapToken(safeJsonParse(trimmed, {}));
    }

    return trimmed.replace(/^Bearer\s+/i, "").trim();
  }

  if (typeof value === "object") {
    const candidates = [
      value.access_token,
      value.accessToken,
      value.token,
      value.jwt,
      value.id_token,
      value.idToken,
      value.bearer,

      value?.data?.access_token,
      value?.data?.accessToken,
      value?.data?.token,
      value?.data?.jwt,

      value?.auth?.access_token,
      value?.auth?.accessToken,
      value?.auth?.token,

      value?.session?.access_token,
      value?.session?.accessToken,
      value?.session?.token,

      value?.usuario?.access_token,
      value?.usuario?.token,

      value?.user?.access_token,
      value?.user?.token
    ];

    for (const candidate of candidates) {
      const token = unwrapToken(candidate);
      if (token) return token;
    }
  }

  return "";
}

function getToken() {
  const directKeys = [
    "claro360-access-token",
    "claro360-token",
    "claro360-auth-token",
    "access_token",
    "accessToken",
    "token",
    "auth_token",
    "jwt"
  ];

  for (const key of directKeys) {
    const token = unwrapToken(storageGet(key));

    if (token) {
      storageSet("claro360-access-token", token);
      return token;
    }
  }

  const objectKeys = [
    "claro360-session",
    "claro360-auth",
    "claro360-login",
    "claro360-user",
    "claro360-current-user",
    "claro360-auth-data",
    "session",
    "auth",
    "login",
    "user"
  ];

  for (const key of objectKeys) {
    const token = unwrapToken(storageGet(key));

    if (token) {
      storageSet("claro360-access-token", token);
      return token;
    }
  }

  for (const storage of [localStorage, sessionStorage]) {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i) || "";
      const keyNorm = normalizeText(key);

      if (keyNorm.includes("refresh")) continue;

      if (
        keyNorm.includes("token") ||
        keyNorm.includes("session") ||
        keyNorm.includes("auth") ||
        keyNorm.includes("login")
      ) {
        const token = unwrapToken(storage.getItem(key));

        if (token) {
          storageSet("claro360-access-token", token);
          return token;
        }
      }
    }
  }

  return "";
}

function extractUserFromObject(item = {}) {
  if (!item || typeof item !== "object") return {};

  const candidates = [
    item.user,
    item.usuario,
    item.cliente,
    item.data?.user,
    item.data?.usuario,
    item.data?.cliente,
    item.auth?.user,
    item.session?.user,
    item
  ];

  for (const user of candidates) {
    if (
      user &&
      typeof user === "object" &&
      (
        user.usuario_id ||
        user.user_id ||
        user.id ||
        user.username ||
        user.correo ||
        user.email ||
        user.rol ||
        user.role ||
        user.codigo_rol ||
        user.tipo_cliente
      )
    ) {
      return user;
    }
  }

  return {};
}

function getStoredUser() {
  const keys = [
    "claro360-user",
    "claro360-session",
    "claro360-auth",
    "claro360-login",
    "claro360-current-user",
    "claro360-auth-data",
    "user",
    "session",
    "auth",
    "login"
  ];

  for (const key of keys) {
    const user = extractUserFromObject(safeJsonParse(storageGet(key), {}));

    if (Object.keys(user).length) {
      return user;
    }
  }

  return {};
}

function normalizeStorageRole(role) {
  return normalizeText(role).replaceAll("-", "_").toUpperCase();
}

function getStoredSession() {
  const session = safeJsonParse(storageGet("claro360-session"), {});
  const auth = safeJsonParse(storageGet("claro360-auth"), {});
  const login = safeJsonParse(storageGet("claro360-login"), {});
  const currentUser = safeJsonParse(storageGet("claro360-user"), {});
  const user = getStoredUser();
  const token = getToken();

  const role =
    storageGet("claro360-role") ||
    storageGet("claro360-selected-role") ||

    session.role ||
    session.rol ||
    session.codigo_rol ||
    session.selectedRole ||
    session.selected_role ||
    session.frontend_role ||

    session.user?.role ||
    session.user?.rol ||
    session.user?.codigo_rol ||

    session.usuario?.role ||
    session.usuario?.rol ||
    session.usuario?.codigo_rol ||

    session.cliente?.role ||
    session.cliente?.rol ||
    session.cliente?.codigo_rol ||

    auth.role ||
    auth.rol ||
    auth.codigo_rol ||
    auth.user?.role ||
    auth.user?.rol ||
    auth.user?.codigo_rol ||

    login.role ||
    login.rol ||
    login.codigo_rol ||
    login.user?.role ||
    login.user?.rol ||
    login.user?.codigo_rol ||

    currentUser.role ||
    currentUser.rol ||
    currentUser.codigo_rol ||

    user.role ||
    user.rol ||
    user.codigo_rol ||
    user.tipo_rol ||
    "";

  const selectedRole =
    storageGet("claro360-selected-role") ||
    session.selectedRole ||
    session.selected_role ||
    session.frontend_role ||
    session.user?.selected_role ||
    session.user?.frontend_role ||
    currentUser.selected_role ||
    currentUser.frontend_role ||
    user.selected_role ||
    user.frontend_role ||
    user.role ||
    role ||
    "";

  const clientType =
    storageGet("claro360-client-type") ||
    session.clientType ||
    session.client_type ||
    session.tipo_cliente ||
    session.user?.tipo_cliente ||
    session.usuario?.tipo_cliente ||
    session.cliente?.tipo_cliente ||
    currentUser.tipo_cliente ||
    user.tipo_cliente ||
    user.client_type ||
    "";

  return {
    token,
    user,
    role,
    selectedRole,
    clientType
  };
}

function isValidClientSession() {
  const session = getStoredSession();

  if (!session.token) {
    return false;
  }

  const roles = [
    session.role,
    session.selectedRole,
    session.clientType,
    session.user?.role,
    session.user?.rol,
    session.user?.codigo_rol,
    session.user?.tipo_cliente
  ]
    .filter(Boolean)
    .map(normalizeStorageRole);

  if (!roles.length) {
    return true;
  }

  return roles.some((role) =>
    [
      "CLIENTE",
      "CLIENTE_PERSONA",
      "CLIENTE_EMPRESA",
      "PERSONA",
      "EMPRESA"
    ].includes(role)
  );
}

function validateClientSession() {
  const session = getStoredSession();

  if (!isValidClientSession()) {
    console.warn("Sesión cliente inválida o sin token", {
      tokenDetectado: Boolean(session.token),
      tokenPreview: session.token ? `${session.token.slice(0, 15)}...` : "SIN_TOKEN",
      role: session.role,
      selectedRole: session.selectedRole,
      clientType: session.clientType,
      user: session.user,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage)
    });

    window.location.href = "../login.html?role=cliente-persona";
    return false;
  }

  State.user = session.user || {};
  return true;
}

function clearClientSession() {
  [
    "claro360-access-token",
    "claro360-refresh-token",
    "claro360-user",
    "claro360-role",
    "claro360-selected-role",
    "claro360-client-type",
    "claro360-token",
    "claro360-auth-token",
    "claro360-session",
    "claro360-auth",
    "claro360-login",
    "claro360-current-user",
    "claro360-auth-data",
    "access_token",
    "accessToken",
    "token",
    "auth_token",
    "jwt",
    "session",
    "auth",
    "login",
    "user",
    "claro360-selected-case-id",
    "claro360-selected-case-code"
  ].forEach(storageRemove);
}

function formatApiError(data, fallback = "No se pudo completar la operación.") {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        const loc = Array.isArray(item.loc) ? item.loc.join(".") : "";
        const msg = item.msg || "Dato inválido";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join(" | ");
  }

  return fallback;
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });
  } catch (error) {
    console.error("Error de conexión", endpoint, error);

    throw new Error(
      "No se pudo conectar con el backend. Verifica que FastAPI esté activo en http://127.0.0.1:8000."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  try {
    data = contentType.includes("application/json")
      ? await response.json()
      : { message: await response.text() };
  } catch {
    data = {};
  }

  if (response.status === 401 || response.status === 403) {
    console.warn("API CLIENTE RECHAZADA", {
      endpoint,
      status: response.status,
      tokenDetectado: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 15)}...` : "SIN_TOKEN",
      detail: data?.detail,
      data
    });

    const error = new Error(
      formatApiError(
        data,
        response.status === 401
          ? "Token no enviado, inválido o vencido. Vuelve a iniciar sesión como cliente."
          : "No tienes permisos para acceder a este módulo."
      )
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  if (!response.ok) {
    const error = new Error(formatApiError(data));

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

async function apiTry(endpoints, options = {}) {
  const list = Array.isArray(endpoints) ? endpoints : [endpoints];
  let lastError = null;

  for (const endpoint of list) {
    try {
      return await apiRequest(endpoint, options);
    } catch (error) {
      lastError = error;

      if (![404, 405].includes(Number(error.status))) {
        break;
      }
    }
  }

  throw lastError || new Error("No se pudo completar la operación.");
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, val]) => {
    if (
      val !== undefined &&
      val !== null &&
      val !== "" &&
      val !== "todos" &&
      val !== "todas"
    ) {
      query.append(key, val);
    }
  });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}

function getCaseCodeFromUrl() {
  return (
    getUrlParam("codigo") ||
    getUrlParam("code") ||
    getUrlParam("id") ||
    localStorage.getItem("claro360-selected-case-code") ||
    localStorage.getItem("claro360-selected-case-id") ||
    ""
  );
}

function getServiceIdFromUrl() {
  return (
    getUrlParam("servicio_contratado_id") ||
    getUrlParam("servicio") ||
    getUrlParam("service_id") ||
    ""
  );
}

function detailUrl(caseItem) {
  const c = normalizeCase(caseItem);
  const code = c.code && c.code !== "-" ? c.code : c.id;
  return `detalle-caso.html?codigo=${encodeURIComponent(code)}`;
}

function claimUrl(serviceId = "") {
  return serviceId
    ? `registrar-reclamo.html?servicio_contratado_id=${encodeURIComponent(serviceId)}`
    : "registrar-reclamo.html";
}

function incidentUrl(serviceId = "") {
  return serviceId
    ? `registrar-incidencia.html?servicio_contratado_id=${encodeURIComponent(serviceId)}`
    : "registrar-incidencia.html";
}

function formatDate(input) {
  if (!input) return "-";

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);

  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatDateTime(input) {
  if (!input) return "-";

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);

  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(input) {
  const amount = Number(String(input || "").replace(/[S/\s,]/g, ""));

  if (Number.isNaN(amount) || amount <= 0) {
    return "No aplica";
  }

  return amount.toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN"
  });
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);

  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }

  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function getInitials(name) {
  const parts = String(name || "Cliente").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "CL";
}

function statusType(status) {
  const v = normalizeText(status);

  if (
    v.includes("resuelto") ||
    v.includes("cerrado") ||
    v.includes("activo") ||
    v.includes("enviado") ||
    v.includes("verificado")
  ) {
    return "success";
  }

  if (
    v.includes("pendiente") ||
    v.includes("observ") ||
    v.includes("registrado") ||
    v.includes("borrador")
  ) {
    return "warning";
  }

  if (
    v.includes("critico") ||
    v.includes("vencido") ||
    v.includes("suspendido") ||
    v.includes("rechaz")
  ) {
    return "danger";
  }

  return "info";
}

function statusClass(status) {
  return (
    {
      success: "status-pill--success",
      warning: "status-pill--warning",
      danger: "status-pill--danger",
      info: "status-pill--info"
    }[statusType(status)] || "status-pill--info"
  );
}

function priorityClass(priority) {
  const v = normalizeText(priority);

  if (v.includes("critica")) return "status-pill--danger";
  if (v.includes("alta")) return "status-pill--warning";
  if (v.includes("media")) return "status-pill--info";

  return "status-pill--success";
}

function priorityValue(priority) {
  const v = normalizeText(priority);

  if (v.includes("critica")) return 4;
  if (v.includes("alta")) return 3;
  if (v.includes("media")) return 2;

  return 1;
}

function setButtonLoading(selector, loading, label = "Procesando...") {
  const button = $(selector);
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }

    button.disabled = true;
    button.classList.add("loading");

    const span = $(".btn-text", button);

    if (span) {
      span.textContent = label;
    } else {
      button.textContent = label;
    }
  } else {
    button.disabled = false;
    button.classList.remove("loading");

    const original = button.dataset.originalText || "";
    const span = $(".btn-text", button);

    if (span) {
      span.textContent = original;
    } else if (original) {
      button.textContent = original;
    }

    delete button.dataset.originalText;
  }
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

async function downloadFromApi(endpoint, filename, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = "No se pudo generar el archivo.";

    try {
      message = formatApiError(await response.json(), message);
    } catch {}

    throw new Error(message);
  }

  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const finalName = match ? decodeURIComponent(match[1]) : filename;

  downloadBlob(await response.blob(), finalName);
}

/* =========================================================
   INICIO
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(State.theme);
  setupLayout();
  setupTheme();
  setupUserMenu();
  setupSearch();
  setupBot();
  setupModals();
  setupLogout();

  if (!validateClientSession()) return;

  setupUserFromStorage();
  await loadShellData();

  try {
    if (State.page === "dashboard") await initDashboard();
    if (State.page === "registrar-reclamo") await initClaim();
    if (State.page === "registrar-incidencia") await initIncident();
    if (State.page === "mis-casos") await initCases();
    if (State.page === "detalle-caso") await initDetail();
    if (State.page === "servicios-contratados") await initServices();
    if (State.page === "notificaciones") await initNotifications();
    if (State.page === "perfil") await initProfile();
  } catch (error) {
    console.error("Error inicializando página cliente", error);
    genericModal(
      "!",
      "Error al cargar la pantalla",
      error.message || "No se pudo completar la carga inicial."
    );
  }
});

/* =========================================================
   UI BASE
========================================================= */

function setupLayout() {
  $("#menuBtn")?.addEventListener("click", () => {
    $("#sidebar")?.classList.add("open");
    $("#drawerBackdrop")?.classList.add("show");
    document.body.classList.add("drawer-open");
  });

  $("#drawerBackdrop")?.addEventListener("click", () => {
    closeSidebar();
    closeBot();
  });

  $("#notificationBtn")?.addEventListener("click", () => {
    window.location.href = "notificaciones.html";
  });
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");

  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function setupTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    applyTheme(State.theme === "light" ? "dark" : "light");
    toast(
      "Tema actualizado",
      `Se activó el modo ${State.theme === "dark" ? "oscuro" : "claro"}.`,
      "success"
    );
  });
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-theme", theme);
}

function setupUserMenu() {
  $("#userMenuButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    $("#userMenuDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    $("#userMenuDropdown")?.classList.remove("open");
  });
}

function setupLogout() {
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#logoutDropdownBtn")?.addEventListener("click", logout);
}

function logout() {
  const refreshToken = localStorage.getItem("claro360-refresh-token");

  if (refreshToken) {
    apiRequest("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => {});
  }

  clearClientSession();

  toast("Sesión cerrada", "Serás redirigido al inicio de sesión.", "success");

  setTimeout(() => {
    window.location.href = "../login.html?role=cliente-persona";
  }, 450);
}

function setupUserFromStorage() {
  const user = State.user || getStoredUser();

  const name =
    user.nombre_completo ||
    user.nombre ||
    user.nombres ||
    user.razon_social ||
    user.username ||
    "Cliente";

  const type =
    user.tipo_cliente === "EMPRESA" ||
    user.rol === "CLIENTE_EMPRESA" ||
    user.codigo_rol === "CLIENTE_EMPRESA"
      ? "Cliente Empresa"
      : "Cliente Persona";

  text("#userNameTop", name);
  text("#userTypeTop", type);
  text("#userAvatar", getInitials(name));
}

async function loadShellData() {
  try {
    const response = await apiTry(ENDPOINTS.me);

    State.profile =
      response.profile ||
      response.perfil ||
      response.cliente ||
      response.user ||
      response.usuario ||
      response;

    State.user = {
      ...(State.user || {}),
      ...(response.user || response.usuario || {})
    };

    renderShellProfile(State.profile);
    await refreshNotificationCount();
  } catch (error) {
    console.error("No se pudo sincronizar sesión cliente", error);

    if (Number(error.status) === 401 || Number(error.status) === 403) {
      genericModal(
        "!",
        "Sesión cliente no autorizada",
        error.message || "Vuelve a iniciar sesión como cliente."
      );

      setTimeout(() => {
        clearClientSession();
        window.location.href = "../login.html?role=cliente-persona";
      }, 900);

      throw error;
    }

    setupUserFromStorage();
    await refreshNotificationCount();
  }
}


function renderShellProfile(profile = {}) {
  const name =
    profile.nombre ||
    profile.nombres_completos ||
    profile.nombre_completo ||
    profile.razon_social ||
    State.user?.nombre_completo ||
    State.user?.nombre ||
    State.user?.username ||
    "Cliente";

  const type =
    profile.tipo_cliente === "EMPRESA" ||
    State.user?.tipo_cliente === "EMPRESA" ||
    State.user?.rol === "CLIENTE_EMPRESA" ||
    State.user?.codigo_rol === "CLIENTE_EMPRESA"
      ? "Cliente Empresa"
      : "Cliente Persona";

  text("#userNameTop", name);
  text("#userTypeTop", type);
  text("#userAvatar", getInitials(name));
}

async function refreshNotificationCount() {
  try {
    const response = await apiTry(ENDPOINTS.notificationSummary);
    const unread = Number(response.no_leidas ?? response.unread ?? response.noLeidas ?? 0);

    text("#notificationBadge", unread > 0 ? unread : "");
    text("#sidebarNotificationCount", unread > 0 ? unread : "");
  } catch {
    text("#notificationBadge", "");
    text("#sidebarNotificationCount", "");
  }
}

function toast(title, message, type = "info") {
  const container = $("#toastContainer");
  if (!container) return;

  const item = document.createElement("div");
  item.className = `toast toast--${type}`;
  item.innerHTML = `
    <span>${type === "success" ? "✓" : type === "warning" ? "!" : type === "danger" ? "×" : "ℹ"}</span>
    <div>
      <strong>${esc(title)}</strong>
      <p>${esc(message)}</p>
    </div>
  `;

  container.appendChild(item);

  setTimeout(() => {
    item.style.opacity = "0";
    item.style.transform = "translateX(18px)";
    setTimeout(() => item.remove(), 250);
  }, 3600);
}

/* =========================================================
   MODALES
========================================================= */

function setupModals() {
  ensureConfirmModal();
  ensureExportModal();

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) {
      closeModals();
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

function openModal(selector) {
  const modal = $(selector);
  const backdrop = $("#modalBackdrop");

  if (!modal || !backdrop) return;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  backdrop.classList.add("show");
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
  text("#genericModalIcon", icon);
  text("#genericModalTitle", title);
  text("#genericModalText", message);
  openModal("#genericModal");
}

function successModal(title, message) {
  if ($("#detailSuccessModal")) {
    text("#detailSuccessTitle", title);
    text("#detailSuccessText", message);
    openModal("#detailSuccessModal");
    return;
  }

  if ($("#notificationSuccessModal")) {
    text("#notificationSuccessTitle", title);
    text("#notificationSuccessText", message);
    openModal("#notificationSuccessModal");
    return;
  }

  if ($("#profileSuccessModal")) {
    openModal("#profileSuccessModal");
    return;
  }

  genericModal("✓", title, message);
}

function ensureConfirmModal() {
  if ($("#systemConfirmModal")) return;

  const modal = document.createElement("section");
  modal.className = "modal";
  modal.id = "systemConfirmModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal__content modal__content--wide">
      <button type="button" class="modal__close" data-close-modal>×</button>

      <div class="modal__icon modal__icon--warning" id="systemConfirmIcon">!</div>

      <span class="eyebrow eyebrow--red" id="systemConfirmEyebrow">
        Confirmación
      </span>

      <h3 id="systemConfirmTitle">Confirmar acción</h3>

      <p id="systemConfirmText">
        Revisa la información antes de continuar.
      </p>

      <div class="case-modal-summary case-modal-summary--grid hidden" id="systemConfirmSummary"></div>

      <div class="modal__actions">
        <button type="button" class="btn btn--ghost-dark" data-close-modal>
          Cancelar
        </button>

        <button type="button" class="btn btn--primary" id="systemConfirmAcceptBtn">
          Confirmar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openConfirm({
  icon = "!",
  eyebrow = "Confirmación",
  title,
  text: message,
  summary = [],
  acceptText = "Confirmar",
  onAccept
}) {
  ensureConfirmModal();

  text("#systemConfirmIcon", icon);
  text("#systemConfirmEyebrow", eyebrow);
  text("#systemConfirmTitle", title);
  text("#systemConfirmText", message);
  text("#systemConfirmAcceptBtn", acceptText);

  const summaryBox = $("#systemConfirmSummary");

  if (summaryBox) {
    summaryBox.innerHTML = summary.length
      ? summary
          .map(
            (item) => `
              <div class="${item.full ? "summary-full" : ""}">
                <span>${esc(item.label)}</span>
                <strong>${esc(item.value)}</strong>
              </div>
            `
          )
          .join("")
      : "";

    summaryBox.classList.toggle("hidden", !summary.length);
  }

  const accept = $("#systemConfirmAcceptBtn");

  if (accept) {
    accept.replaceWith(accept.cloneNode(true));

    $("#systemConfirmAcceptBtn")?.addEventListener("click", async () => {
      if (typeof onAccept === "function") {
        await onAccept();
      }
    });
  }

  openModal("#systemConfirmModal");
}

function ensureExportModal() {
  if ($("#systemExportModal")) return;

  const modal = document.createElement("section");
  modal.className = "modal";
  modal.id = "systemExportModal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="modal__content modal__content--wide">
      <button type="button" class="modal__close" data-close-modal>×</button>

      <div class="modal__icon">📄</div>

      <span class="eyebrow eyebrow--red">
        Exportación profesional
      </span>

      <h3 id="systemExportTitle">Generar reporte</h3>

      <p id="systemExportText">
        Selecciona el formato y el alcance del documento.
      </p>

      <div class="form-grid" style="margin-top:16px">
        <div class="form-group">
          <label for="systemExportFormat">Formato</label>
          <select id="systemExportFormat">
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel</option>
            <option value="csv">CSV</option>
            <option value="docx">Word</option>
          </select>
        </div>

        <div class="form-group">
          <label for="systemExportScope">Alcance</label>
          <select id="systemExportScope">
            <option value="filtrados">Registros filtrados</option>
            <option value="todos">Todos mis registros</option>
          </select>
        </div>
      </div>

      <div class="form-check" style="margin-top:14px">
        <input type="checkbox" id="systemExportIncludeDetail" checked />
        <label for="systemExportIncludeDetail">
          Incluir resumen, filtros aplicados, estado, SLA y acciones pendientes.
        </label>
      </div>

      <div class="modal__actions">
        <button type="button" class="btn btn--ghost-dark" data-close-modal>
          Cancelar
        </button>

        <button type="button" class="btn btn--primary" id="systemExportAcceptBtn">
          Generar reporte
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function openExportModal({ title, text: message, onAccept }) {
  ensureExportModal();

  text("#systemExportTitle", title || "Generar reporte");
  text("#systemExportText", message || "Selecciona el formato y confirma la exportación.");

  const button = $("#systemExportAcceptBtn");

  if (button) {
    button.replaceWith(button.cloneNode(true));

    $("#systemExportAcceptBtn")?.addEventListener("click", async () => {
      const format = value("#systemExportFormat") || "pdf";
      const scope = value("#systemExportScope") || "filtrados";
      const includeDetail = checked("#systemExportIncludeDetail");

      await onAccept?.({ format, scope, includeDetail });
    });
  }

  openModal("#systemExportModal");
}

/* =========================================================
   BUSCADOR GLOBAL
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

  setTimeout(() => $("#globalSearchInput")?.focus(), 80);
  renderSearch();
}

function closeSearch() {
  $("#searchModal")?.classList.remove("show");
  $("#searchModal")?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-open");
}

function debounce(fn, ms) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function renderSearch() {
  const box = $("#searchResults");
  if (!box) return;

  const q = value("#globalSearchInput");

  if (!q) {
    box.innerHTML = `
      <a href="registrar-reclamo.html" class="search-result-item">
        <span>📝</span>
        <div>
          <strong>Registrar reclamo</strong>
          <small>Cobros, facturación, atención o condiciones contratadas.</small>
        </div>
      </a>

      <a href="registrar-incidencia.html" class="search-result-item">
        <span>⚠️</span>
        <div>
          <strong>Registrar incidencia</strong>
          <small>Fallas técnicas, lentitud, señal o acceso.</small>
        </div>
      </a>

      <a href="mis-casos.html" class="search-result-item">
        <span>🎫</span>
        <div>
          <strong>Mis casos</strong>
          <small>Consulta seguimiento, SLA, solicitudes y evidencias.</small>
        </div>
      </a>

      <a href="servicios-contratados.html" class="search-result-item">
        <span>📡</span>
        <div>
          <strong>Servicios contratados</strong>
          <small>Revisa planes, estado y casos asociados.</small>
        </div>
      </a>
    `;
    return;
  }

  box.innerHTML = `<p class="muted">Buscando en casos, servicios, notificaciones y ayuda...</p>`;

  try {
    const response = await apiTry(ENDPOINTS.search.map((endpoint) => `${endpoint}${buildQuery({ q })}`));
    const items = response.items || response.resultados || [];

    box.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <a href="${esc(item.href || item.url || "#")}" class="search-result-item">
                <span>${esc(item.icon || item.icono || "🔎")}</span>
                <div>
                  <strong>${esc(item.title || item.titulo || "Resultado")}</strong>
                  <small>${esc(item.text || item.descripcion || item.mensaje || "")}</small>
                </div>
              </a>
            `
          )
          .join("")
      : `<p class="muted">No se encontraron resultados para “${esc(q)}”.</p>`;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

/* =========================================================
   BOT / IA GUIADA
========================================================= */

function setupBot() {
  const bindings = [
    ["#openBotSidebar", openBot],
    ["#openBotWelcome", openBot],
    ["#supportAskBotBtn", () => askBot("Orientación para resolver más rápido")],
    ["#quickActionAiBtn", () => askBot("Qué acción me recomiendas hoy")],
    ["#askAiAboutCases", () => askBot("Analiza mis casos")],
    ["#analyzeAllCasesBtn", () => askBot("Resume mis casos")],
    ["#detailAskAiBtn", () => askBot("Resume este caso")],
    ["#detailSummaryAiBtn", () => askBot("Genera resumen del caso")],
    ["#detailOpenBotBtn", openBot],
    ["#analyzeNotificationsBtn", () => askBot("Qué alerta es urgente")],
    ["#analyzeServicesBtn", () => askBot("Analiza mis servicios")],
    ["#profileAnalyzeBtn", () => askBot("Analiza mi perfil")],
    ["#claimAnalyzeBtn", () => askBot("Analiza mi reclamo")],
    ["#claimAnalyzeSideBtn", () => askBot("Analiza la información del reclamo")],
    ["#incidentAnalyzeSideBtn", () => askBot("Analiza la información de la incidencia")]
  ];

  bindings.forEach(([selector, handler]) => {
    $(selector)?.addEventListener("click", handler);
  });

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

  const typing = addTypingMessage();

  try {
    const response = await apiTry(ENDPOINTS.assistant, {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        prompt,
        contexto: buildAssistantContext()
      })
    });

    typing.remove();
    addBotMessage(response.answer || response.respuesta || buildLocalBotAnswer(prompt), "bot");
  } catch {
    typing.remove();
    addBotMessage(buildLocalBotAnswer(prompt), "bot");
  }
}

function addBotMessage(message, who) {
  const box = $("#botMessages");
  if (!box) return;

  const item = document.createElement("div");
  item.className = `message message--${who}`;
  item.textContent = message;

  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
}

function addTypingMessage() {
  const box = $("#botMessages");
  const item = document.createElement("div");

  item.className = "message message--bot typing";
  item.textContent = "ClaroBot está revisando la información disponible.";

  box?.appendChild(item);

  if (box) box.scrollTop = box.scrollHeight;

  return item;
}

function buildAssistantContext() {
  return {
    casos: State.cases.map(normalizeCase).slice(0, 8),
    servicios: State.services.map(normalizeService).slice(0, 8),
    notificaciones: State.notifications.map(normalizeNotification).slice(0, 8),
    detalle: State.detail ? normalizeCase(State.detail) : null
  };
}

function buildLocalBotAnswer(prompt) {
  const p = normalizeText(prompt);

  const cases = State.cases.map(normalizeCase);
  const openCases = cases.filter((c) => !["RESUELTO", "CERRADO"].includes(toKey(c.status)));
  const pending = cases.filter((c) => normalizeText(c.status).includes("pendiente"));
  const unread = State.notifications.map(normalizeNotification).filter((n) => !n.read);

  if (p.includes("reclamo") && p.includes("incidencia")) {
    return "Usa reclamo para disconformidades por cobros, facturación, atención o condiciones contratadas. Usa incidencia para fallas técnicas como cortes, lentitud, señal o errores de acceso.";
  }

  if (p.includes("evidencia") || p.includes("adjuntar")) {
    return "Adjunta recibos, capturas claras, pruebas de velocidad, fotos del equipo o documentos. Evita archivos comprimidos y procura que el archivo no supere 10 MB.";
  }

  if (p.includes("notificacion") || p.includes("alerta")) {
    return unread.length
      ? `Tienes ${unread.length} alerta(s) no leída(s). Prioriza solicitudes del asesor, cambios de estado y alertas SLA.`
      : "No tienes alertas no leídas cargadas en este momento.";
  }

  if (p.includes("servicio")) {
    return "Desde Servicios contratados puedes revisar cada plan, ver casos asociados y registrar una incidencia o reclamo directamente vinculado al servicio.";
  }

  if (p.includes("perfil") || p.includes("seguridad")) {
    return "Mantén correo, celular y preferencias actualizados. Para cambios sensibles usa verificación o recuperación de contraseña.";
  }

  if (p.includes("resumen") || p.includes("analiza")) {
    return `Tienes ${cases.length} caso(s) cargado(s), ${openCases.length} abierto(s) y ${pending.length} con posible acción pendiente.`;
  }

  return "Puedo ayudarte a registrar reclamos o incidencias, revisar casos, interpretar estados, sugerir evidencias y priorizar alertas.";
}

/* =========================================================
   CATÁLOGOS Y SELECTS
========================================================= */

async function loadCatalogs(type) {
  const endpoints = type === "incidencia" ? ENDPOINTS.incidentCatalogs : ENDPOINTS.claimCatalogs;

  try {
    const response = await apiTry(endpoints);
    State.catalogs[type] = response;
    return response;
  } catch (error) {
    console.warn(`No se pudieron cargar catálogos de ${type}`, error);
    State.catalogs[type] = {};
    return {};
  }
}

function asArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function optionId(item) {
  return (
    item.id ??
    item.value ??
    item.codigo ??
    item.codigo_catalogo ??
    item.categoria_id ??
    item.prioridad_id ??
    item.motivo_id ??
    item.canal_id ??
    item.tipo_caso_id ??
    item.estado_id ??
    item.servicio_contratado_id ??
    item.servicio_id ??
    item.nombre ??
    item.name ??
    item.label
  );
}

function optionLabel(item) {
  return (
    item.label ||
    item.nombre ||
    item.name ||
    item.descripcion ||
    item.titulo ||
    item.codigo ||
    String(optionId(item) ?? "")
  );
}

function fillSelect(selector, items, placeholder = "Seleccionar", currentValue = "") {
  const select = $(selector);
  if (!select) return;

  const current = currentValue || select.value || "";

  select.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    items
      .map((item) => {
        const id = optionId(item);
        const label = optionLabel(item);

        return `<option value="${esc(id)}" data-label="${esc(label)}">${esc(label)}</option>`;
      })
      .join("");

  if (current) select.value = current;
}

function selectedText(selector) {
  const select = $(selector);
  if (!select) return "";

  return (
    select.selectedOptions?.[0]?.dataset?.label ||
    select.selectedOptions?.[0]?.textContent?.trim() ||
    select.value ||
    ""
  );
}

async function loadServicesIntoForms() {
  const serviceId = getServiceIdFromUrl();

  try {
    const response = await apiTry(
      ENDPOINTS.services.map((endpoint) => `${endpoint}${buildQuery({ estado: "ACTIVO" })}`)
    );

    const items = response.items || response.services || response.servicios || response.data || [];

    State.services = items;

    const options = items.map((item) => {
      const s = normalizeService(item);

      return {
        id: s.id,
        nombre: `${s.name} · ${s.plan} · ${s.code}`,
        raw: s
      };
    });

    fillSelect("#claimService", options, "Selecciona un servicio contratado", serviceId);
    fillSelect("#incidentService", options, "Selecciona un servicio contratado", serviceId);

    if (serviceId) {
      prefillServiceLocation(serviceId);
    }
  } catch (error) {
    console.warn("No se pudieron cargar servicios contratados", error);
  }
}

function prefillServiceLocation(serviceId) {
  const service = State.services
    .map(normalizeService)
    .find((item) => String(item.id) === String(serviceId));

  if (!service) return;

  if ($("#incidentAddress") && !value("#incidentAddress")) {
    setValue("#incidentAddress", service.location !== "-" ? service.location : "");
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

async function initDashboard() {
  $("#refreshActivityBtn")?.addEventListener("click", async () => {
    await loadDashboard();
    toast("Panel actualizado", "Se actualizó la actividad reciente.", "success");
  });

  await loadDashboard();
}

async function loadDashboard() {
  try {
    const response = await apiTry(ENDPOINTS.dashboard);

    State.dashboard = response;
    State.cases = response.recent_cases || response.casos_recientes || response.cases || response.casos || [];
    State.services = response.services || response.servicios || response.servicios_contratados || [];
    State.notifications = response.notifications || response.notificaciones || [];
    State.activity = response.activity || response.actividad || [];

    renderDashboard(response);
  } catch (error) {
    console.warn("No se pudo cargar dashboard", error);

    State.cases = [];
    State.services = [];
    State.notifications = [];
    State.activity = [];

    renderDashboardEmpty(error.message);
  }
}

function renderDashboard(data) {
  const profile = State.profile || data.profile || data.perfil || {};

  const name =
    profile.nombre ||
    profile.nombres_completos ||
    profile.nombre_completo ||
    profile.razon_social ||
    State.user?.nombre_completo ||
    State.user?.nombre ||
    "Cliente";

  const cases = State.cases.map(normalizeCase);
  const services = State.services.map(normalizeService);
  const notifications = State.notifications.map(normalizeNotification);

  const summaryCases =
    data.summary?.cases ||
    data.summary?.casos ||
    data.summary_cases ||
    {};

  const openCasesCount = Number(
    summaryCases.activos ??
    summaryCases.en_atencion ??
    summaryCases.active_cases ??
   0
  );

const openCases = cases.filter((c) => !["RESUELTO", "CERRADO"].includes(toKey(c.status)));

const criticalSla = cases.filter(
  (c) => Number(c.slaHours) <= 8 && !["RESUELTO", "CERRADO"].includes(toKey(c.status))
);

  text("#welcomeSegment", profile.tipo_cliente === "EMPRESA" ? "Cliente empresa" : "Cliente persona");
  text("#welcomeTitle", `Hola, ${name}`);
  text(
    "#welcomeMessage",
    "Gestiona reclamos, incidencias, servicios, alertas y evidencias desde un solo panel."
  );
  text("#accountStatus", profile.estado || data.account_status || "Cuenta activa");
  text(
    "#lastAccess",
    data.last_access || profile.ultimo_acceso
      ? `Último acceso: ${formatDateTime(data.last_access || profile.ultimo_acceso)}`
      : "Último acceso no registrado"
  );
  text("#nextSlaStatus", criticalSla.length ? "SLA requiere atención" : "SLA bajo control");
  text(
    "#nextSlaText",
    criticalSla.length ? `${criticalSla.length} caso(s) con vencimiento próximo` : "Sin vencimientos críticos"
  );

  text("#heroOpenCases", `${openCasesCount} casos activos`);
  
  renderKpis(
    data.kpis || [
      {
        icon: "🎫",
        value: openCases.length,
        label: "Casos activos",
        description: "Reclamos o incidencias en seguimiento"
      },
      {
        icon: "⏱️",
        value: criticalSla.length,
        label: "SLA crítico",
        description: "Vencimientos próximos o vencidos"
      },
      {
        icon: "📡",
        value: services.filter((s) => toKey(s.status) === "ACTIVO").length || services.length,
        label: "Servicios activos",
        description: "Vinculados a tu cuenta"
      },
      {
        icon: "🔔",
        value: notifications.filter((n) => !n.read).length,
        label: "Alertas no leídas",
        description: "Requieren revisión"
      }
    ]
  );

  renderRecentCases(cases);
  renderAi("#aiSummary", data.ai_summary || data.resumen_ia || buildDashboardAi());
  renderActivity("#activityTimeline", State.activity);
  renderDashboardNotifications(notifications);
  renderServices("#servicesGrid", services.slice(0, 4));
  refreshNotificationCount();
}

function renderDashboardEmpty(message) {
  renderKpis([]);
  renderRecentCases([]);
  renderAi("#aiSummary", [
    {
      title: "Panel no disponible",
      text: message || "No se pudo cargar la información del cliente."
    }
  ]);
  renderActivity("#activityTimeline", []);
  renderDashboardNotifications([]);
  renderServices("#servicesGrid", []);
}

function buildDashboardAi() {
  const cases = State.cases.map(normalizeCase);
  const pending = cases.filter((c) => normalizeText(c.status).includes("pendiente"));
  const critical = cases.filter((c) => Number(c.slaHours) <= 8);

  return [
    {
      title: "Casos abiertos",
      text: cases.length
        ? `Tienes ${cases.length} caso(s) reciente(s) registrados.`
        : "No se encontraron casos recientes."
    },
    {
      title: "Pendientes por cliente",
      text: pending.length
        ? `${pending.length} caso(s) podrían requerir respuesta o evidencia.`
        : "No se detectan pendientes por responder."
    },
    {
      title: "SLA",
      text: critical.length
        ? `${critical.length} caso(s) tienen SLA cercano o crítico.`
        : "Los tiempos de atención se encuentran bajo control."
    }
  ];
}

function renderKpis(kpis) {
  const box = $("#kpiGrid");
  if (!box) return;

  const items =
    Array.isArray(kpis) && kpis.length
      ? kpis
      : [
          {
            icon: "🎫",
            value: 0,
            label: "Casos activos",
            description: "Sin datos cargados"
          },
          {
            icon: "⏱️",
            value: 0,
            label: "SLA crítico",
            description: "Sin vencimientos"
          },
          {
            icon: "📡",
            value: 0,
            label: "Servicios",
            description: "Sin servicios cargados"
          },
          {
            icon: "🔔",
            value: 0,
            label: "Alertas",
            description: "Sin alertas"
          }
        ];

  box.innerHTML = items
    .map(
      (item) => `
        <article class="kpi-card">
          <span class="kpi-card__icon">${esc(item.icon || item.icono || "•")}</span>
          <div>
            <strong>${esc(item.value ?? item.valor ?? 0)}</strong>
            <p>${esc(item.label || item.titulo || "")}</p>
            <small>${esc(item.description || item.descripcion || "")}</small>
          </div>
        </article>
      `
    )
    .join("");
}

function renderRecentCases(cases) {
  const box = $("#recentCasesList");
  const empty = $("#emptyCasesState");

  if (!box) return;

  const list = cases.slice(0, 3);

  if (!list.length) {
    box.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  box.innerHTML = list.map(caseCard).join("");
  bindCaseButtons();
}

function renderDashboardNotifications(notifications) {
  const box = $("#notificationsList");
  if (!box) return;

  box.innerHTML = notifications.length
    ? notifications.slice(0, 4).map(notificationMini).join("")
    : `
      <div class="empty-state">
        <span>🔔</span>
        <h3>Sin alertas recientes</h3>
        <p>No hay notificaciones pendientes.</p>
      </div>
    `;
}

/* =========================================================
   CASOS
========================================================= */

async function initCases() {
  bindCaseFilters();
  await loadCases();
}

function bindCaseFilters() {
  $("#casesSearchInput")?.addEventListener(
    "input",
    debounce(() => {
      State.pagination.cases.page = 1;
      renderCases();
    }, 180)
  );

  $("#casesCardViewBtn")?.addEventListener("click", () => switchCaseView("cards"));
  $("#casesTableViewBtn")?.addEventListener("click", () => switchCaseView("table"));

  $("#refreshCasesBtn")?.addEventListener("click", async () => {
    await loadCases();
    toast("Casos actualizados", "La lista fue actualizada correctamente.", "success");
  });

  $("#exportCasesBtn")?.addEventListener("click", () => openCasesExport());

  $("#quickCaseAskAiBtn")?.addEventListener("click", () => askBot("Analiza este caso"));

  $$("[data-case-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.caseChip = button.dataset.caseFilter || "todos";

      $$("[data-case-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      State.pagination.cases.page = 1;
      renderCases();
    });
  });

  $("#applyAdvancedCasesFilter")?.addEventListener("click", () => {
    State.filters.caseType = value("#casesTypeFilter") || "todos";
    State.filters.caseStatus = value("#casesStatusFilter") || "todos";
    State.filters.casePriority = value("#casesPriorityFilter") || "todos";
    State.filters.caseSort = value("#casesSortSelect") || "reciente";
    State.filters.caseDateFrom = value("#casesDateFrom");
    State.filters.caseDateTo = value("#casesDateTo");

    State.pagination.cases.page = 1;
    renderCases();
  });
}

async function loadCases() {
  try {
    const response = await apiTry(ENDPOINTS.cases);

    State.cases = response.items || response.cases || response.casos || response.data || [];
    State.pagination.cases.total = Number(response.total || State.cases.length);

    renderCases();
    renderAi("#casesAiSummary", response.ai_summary || response.resumen_ia || buildCasesAi());
  } catch (error) {
    State.cases = [];
    renderCases();
    renderAi("#casesAiSummary", [
      {
        title: "No se pudieron cargar los casos",
        text: error.message
      }
    ]);
  }
}

function normalizeCase(item = {}) {
  const code = item.codigo_caso || item.codigo || item.code || item.case_code || "-";
  const id = item.caso_id || item.id || item.case_id || code;

  const type =
    item.tipo_caso ||
    item.tipo ||
    item.type ||
    item.tipo_nombre ||
    (String(code).startsWith("INC") ? "Incidencia" : "Reclamo");

  const status = item.estado_caso || item.estado || item.status || "Registrado";
  const priority = item.prioridad || item.priority || "Media";
  const rawDate = item.fecha_registro || item.created_at || item.fecha || item.date || "";
  const service = item.servicio_nombre || item.servicio || item.service || item.plan_nombre || "-";
  const description = item.descripcion || item.description || item.detalle || "";

  return {
    id,
    code,
    type,
    icon: item.icon || item.icono || (normalizeText(type).includes("incidencia") ? "⚠️" : "📝"),
    title: item.titulo || item.title || code,
    description,
    service,
    serviceId: item.servicio_contratado_id || item.service_id || item.servicio_id || "",
    status,
    priority,
    priorityValue: priorityValue(priority),
    date: formatDate(rawDate),
    rawDate,
    sla:
      item.sla ||
      item.sla_text ||
      item.tiempo_sla ||
      item.sla_restante ||
      item.sla_restante_texto ||
      "-",
    slaHours: Number(item.sla_hours ?? item.horas_sla ?? item.sla_restante_horas ?? 999),
    advisor: item.asesor || item.advisor || item.responsable || "Por asignar",
    channel: item.canal || item.channel || item.canal_ingreso || "Portal cliente",
    action: item.accion || item.action || item.proximo_paso || item.siguiente_paso || "Revisar seguimiento",
    progress: Number(item.avance || item.progress || 0),
    raw: item
  };
}

function filteredCases() {
  const q = normalizeText(value("#casesSearchInput"));
  let items = State.cases.map(normalizeCase);

  items = items.filter((c) => {
    const all = normalizeText(
      `${c.code} ${c.type} ${c.title} ${c.description} ${c.service} ${c.status} ${c.priority}`
    );

    const chip = State.filters.caseChip;
    const chipKey = normalizeText(chip);
    const statusKey = normalizeText(c.status);
    const typeKey = normalizeText(c.type);
    const priorityKey = normalizeText(c.priority);

    return (
      (!q || all.includes(q)) &&
      (chip === "todos" ||
        typeKey === chipKey ||
        statusKey === chipKey ||
        priorityKey === chipKey ||
        (chip === "SLA crítico" && Number(c.slaHours) <= 8)) &&
      (State.filters.caseType === "todos" || typeKey === normalizeText(State.filters.caseType)) &&
      (State.filters.caseStatus === "todos" || statusKey === normalizeText(State.filters.caseStatus)) &&
      (State.filters.casePriority === "todos" ||
        priorityKey === normalizeText(State.filters.casePriority))
    );
  });

  if (State.filters.caseSort === "sla") {
    items.sort((a, b) => a.slaHours - b.slaHours);
  }

  if (State.filters.caseSort === "prioridad") {
    items.sort((a, b) => b.priorityValue - a.priorityValue);
  }

  if (State.filters.caseSort === "estado") {
    items.sort((a, b) => a.status.localeCompare(b.status));
  }

  if (State.filters.caseSort === "reciente") {
    items.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
  }

  return items;
}

function renderCases() {
  const all = filteredCases();
  const items = paginate(all, State.pagination.cases);

  text("#summaryTotalCases", all.length);
  text(
    "#summaryInProgress",
    all.filter((c) => normalizeText(c.status).includes("atencion")).length
  );
  text(
    "#summaryPendingClient",
    all.filter((c) => normalizeText(c.status).includes("pendiente")).length
  );
  text(
    "#summaryResolved",
    all.filter((c) =>
      ["resuelto", "cerrado"].some((s) => normalizeText(c.status).includes(s))
    ).length
  );
  text("#casesHeroTotal", `${all.length} casos`);
  text("#casesHeroSla", `${all.filter((c) => Number(c.slaHours) <= 8).length} SLA críticos`);

  const list = $("#allCasesList");
  const table = $("#casesTableBody");
  const empty = $("#emptyAllCasesState");

  if (!items.length) {
    if (list) list.innerHTML = "";
    if (table) table.innerHTML = "";
    empty?.classList.remove("hidden");
    renderPagination("cases", all.length);
    return;
  }

  empty?.classList.add("hidden");

  if (list) list.innerHTML = items.map(caseCard).join("");
  if (table) table.innerHTML = items.map(caseRow).join("");

  bindCaseButtons();
  switchCaseView(State.caseView);
  renderPagination("cases", all.length);
}

function caseCard(caseItem) {
  const c = normalizeCase(caseItem);

  return `
    <article class="case-item">
      <span class="case-icon">${esc(c.icon)}</span>

      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description || "Caso registrado para seguimiento.")}</p>

        <div class="case-meta">
          <span>${esc(c.code)}</span>
          <span>${esc(c.type)}</span>
          <span>${esc(c.service)}</span>
          <span>Prioridad ${esc(c.priority)}</span>
          <span>${esc(c.date)}</span>
          <span>SLA: ${esc(c.sla)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="status-pill ${statusClass(c.status)}">${esc(c.status)}</span>
        <button type="button" data-case-id="${esc(c.id)}">Vista rápida</button>
        <a href="${esc(detailUrl(c))}" class="btn btn--soft" data-case-detail="${esc(c.code)}">
          Detalle
        </a>
      </div>
    </article>
  `;
}

function caseRow(caseItem) {
  const c = normalizeCase(caseItem);

  return `
    <tr>
      <td>${esc(c.code)}</td>
      <td>${esc(c.type)}</td>
      <td>${esc(c.service)}</td>
      <td><span class="status-pill ${statusClass(c.status)}">${esc(c.status)}</span></td>
      <td><span class="status-pill ${priorityClass(c.priority)}">${esc(c.priority)}</span></td>
      <td>${esc(c.sla)}</td>
      <td>
        <button type="button" class="panel-action" data-case-id="${esc(c.id)}">Ver</button>
        <a href="${esc(detailUrl(c))}" class="panel-link" data-case-detail="${esc(c.code)}">Detalle</a>
      </td>
    </tr>
  `;
}

function bindCaseButtons() {
  $$("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.caseId;

      const found = State.cases
        .map(normalizeCase)
        .find((item) => String(item.id) === String(id));

      if (!found) return;

      State.selectedCase = found;

      localStorage.setItem("claro360-selected-case-id", found.id);
      localStorage.setItem("claro360-selected-case-code", found.code);

      openCaseQuickView(found);
    });
  });

  $$("[data-case-detail]").forEach((link) => {
    link.addEventListener("click", () => {
      localStorage.setItem("claro360-selected-case-code", link.dataset.caseDetail || "");
    });
  });
}

function openCaseQuickView(c) {
  text("#caseQuickViewIcon", c.icon);
  text("#caseQuickViewTitle", c.code);
  text("#caseQuickViewText", c.description || "Revisa el estado general y el seguimiento del caso.");
  text("#quickCaseCode", c.code);
  text("#quickCaseType", c.type);
  text("#quickCaseService", c.service);
  text("#quickCaseStatus", c.status);
  text("#quickCasePriority", c.priority);
  text("#quickCaseSla", c.sla);
  text("#quickCaseLastUpdate", c.date);
  text("#quickCasePendingAction", c.action);
  text("#quickCaseDescription", c.description || "-");

  const detailLink = $("#caseQuickViewModal .btn--primary");
  if (detailLink) detailLink.href = detailUrl(c);

  openModal("#caseQuickViewModal");
}

function switchCaseView(viewName) {
  State.caseView = viewName;

  $("#casesCardViewBtn")?.classList.toggle("active", viewName === "cards");
  $("#casesTableViewBtn")?.classList.toggle("active", viewName === "table");
  $("#allCasesList")?.classList.toggle("hidden", viewName !== "cards");
  $("#casesTableWrap")?.classList.toggle("hidden", viewName !== "table");
}

function buildCasesAi() {
  const items = State.cases.map(normalizeCase);
  const pending = items.filter((c) => normalizeText(c.status).includes("pendiente"));
  const critical = items.filter((c) => c.slaHours <= 8);

  return [
    {
      title: "Casos filtrados",
      text: `${items.length} caso(s) disponibles para seguimiento.`
    },
    {
      title: "Acción pendiente",
      text: pending.length
        ? `${pending.length} caso(s) podrían requerir respuesta del cliente.`
        : "No se detectan pendientes por cliente."
    },
    {
      title: "SLA",
      text: critical.length
        ? `Prioriza ${critical.length} caso(s) con SLA crítico.`
        : "No hay casos con SLA crítico en la lista."
    }
  ];
}

function openCasesExport() {
  openExportModal({
    title: "Exportar mis casos",
    text: "Genera un reporte profesional con los filtros aplicados, estados, prioridades y SLA.",
    onAccept: exportCases
  });
}

async function exportCases({ format, scope, includeDetail }) {
  setButtonLoading("#systemExportAcceptBtn", true, "Generando...");

  try {
    const rows = scope === "todos" ? State.cases.map(normalizeCase) : filteredCases();

    const response = await apiTry(ENDPOINTS.casesExport, {
      method: "POST",
      body: JSON.stringify({
        formato: format,
        alcance: scope,
        incluir_detalle: includeDetail,
        filtros: State.filters,
        codigos: rows.map((r) => r.code)
      })
    });

    if (response.download_url || response.url) {
      window.open(response.download_url || response.url, "_blank", "noopener");
    } else if (response.filename && response.content_base64) {
      const byteCharacters = atob(response.content_base64);
      const bytes = new Uint8Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i += 1) {
        bytes[i] = byteCharacters.charCodeAt(i);
      }

      downloadBlob(
        new Blob([bytes], { type: response.mime_type || "application/octet-stream" }),
        response.filename
      );
    } else {
      exportCasesLocal(format, rows);
    }

    closeModals();
    toast("Reporte generado", "La exportación fue preparada correctamente.", "success");
  } catch (error) {
    if (format === "csv") {
      exportCasesLocal(format, filteredCases());
      closeModals();
      toast(
        "CSV generado localmente",
        "No se pudo usar el backend, pero se generó un CSV con los datos visibles.",
        "warning"
      );
    } else {
      genericModal("!", "No se pudo exportar", error.message);
    }
  } finally {
    setButtonLoading("#systemExportAcceptBtn", false);
  }
}

function exportCasesLocal(format, rows) {
  const data = rows.map(normalizeCase);

  if (!data.length) {
    throw new Error("No hay casos para exportar.");
  }

  const header = ["Código", "Tipo", "Servicio", "Estado", "Prioridad", "SLA", "Fecha"];

  const csv = [
    header.join(";"),
    ...data.map((r) =>
      [r.code, r.type, r.service, r.status, r.priority, r.sla, r.date]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(";")
    )
  ].join("\n");

  downloadBlob(
    new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
    `mis-casos.${format === "csv" ? "csv" : "csv"}`
  );
}

/* =========================================================
   DETALLE DE CASO
========================================================= */

async function initDetail() {
  bindDetail();

  const code = getCaseCodeFromUrl();

  if (!code) {
    openConfirm({
      icon: "🎫",
      title: "Caso no seleccionado",
      text: "No se encontró un código de caso para consultar. Volverás a Mis casos para seleccionar uno.",
      acceptText: "Ir a Mis casos",
      onAccept: () => {
        window.location.href = "mis-casos.html";
      }
    });
    return;
  }

  await loadCaseDetail(code);
}

async function loadCaseDetail(code) {
  try {
    const response = await apiTry(ENDPOINTS.caseDetail(code));

    State.detail = response.case || response.caso || response;
    State.selectedCase = normalizeCase(State.detail);

    renderDetail(State.detail);
  } catch (error) {
    openConfirm({
      icon: "!",
      title: "No se pudo cargar el caso",
      text: error.message,
      acceptText: "Volver a Mis casos",
      onAccept: () => {
        window.location.href = "mis-casos.html";
      }
    });
  }
}

function bindDetail() {
  $$("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.detailTab;

      $$("[data-detail-tab]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      $$(".detail-tab-panel").forEach((panel) => panel.classList.remove("active"));
      $(`#detailTab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)?.classList.add("active");
    });
  });

  bindFileInput("#detailEvidenceInput", "#detailFileList");
  bindFileInput("#advisorRequestEvidenceInput", "#advisorRequestFileList");

  $("#detailSendEvidenceBtn")?.addEventListener("click", () => {
    const valid = validateSelectedFiles("#detailEvidenceInput");

    if (!valid.ok) {
      genericModal("!", "Evidencia inválida", valid.message);
      return;
    }

    text("#summaryEvidenceFiles", fileText("#detailEvidenceInput"));
    text("#summaryEvidenceCaseCode", State.selectedCase?.code || getCaseCodeFromUrl());
    openModal("#confirmEvidenceModal");
  });

  $("#acceptEvidenceConfirmBtn")?.addEventListener("click", submitCaseEvidence);

  $("#advisorRequestDraftBtn")?.addEventListener("click", () => {
    localStorage.setItem(`claro360-advisor-draft-${getCaseCodeFromUrl()}`, value("#advisorRequestResponse"));
    toast("Respuesta guardada", "Tu respuesta quedó guardada como borrador local.", "success");
  });

  $("#advisorRequestSubmitBtn")?.addEventListener("click", () => {
    if (!value("#advisorRequestResponse")) {
      text("#advisorRequestResponseError", "Ingresa una respuesta para el asesor.");
      return;
    }

    const valid = validateSelectedFiles("#advisorRequestEvidenceInput", {
      allowEmpty: true
    });

    if (!valid.ok) {
      genericModal("!", "Archivos inválidos", valid.message);
      return;
    }

    text("#summaryAdvisorResponseCase", State.selectedCase?.code || getCaseCodeFromUrl());
    text(
      "#summaryAdvisorResponseTitle",
      State.detailRequest?.title || State.detailRequest?.asunto || "Solicitud de información"
    );
    text("#summaryAdvisorResponseText", value("#advisorRequestResponse"));
    text("#summaryAdvisorResponseFiles", fileText("#advisorRequestEvidenceInput"));

    openModal("#confirmAdvisorResponseModal");
  });

  $("#acceptAdvisorResponseConfirmBtn")?.addEventListener("click", submitAdvisorResponse);

  $$("[data-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      State.selectedRating = Number(button.dataset.rating || 0);

      $$("[data-rating]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  $("#caseSurveySubmitBtn")?.addEventListener("click", () => {
    if (!State.selectedRating) {
      genericModal("!", "Calificación requerida", "Selecciona una calificación antes de enviar la encuesta.");
      return;
    }

    text("#summarySurveyRating", `${State.selectedRating} estrella(s)`);
    text("#summarySurveyComment", value("#caseSurveyComment") || "Sin comentario");

    openModal("#confirmSurveyModal");
  });

  $("#acceptSurveyConfirmBtn")?.addEventListener("click", submitSurvey);
  $("#detailDownloadBtn")?.addEventListener("click", downloadCaseCertificate);
  $("#detailShareBtn")?.addEventListener("click", shareCase);

  $("#detailRefreshBtn")?.addEventListener("click", async () => {
    await loadCaseDetail(getCaseCodeFromUrl());
    toast("Caso actualizado", "Se actualizó el seguimiento.", "success");
  });

  $("#detailTimelineRefreshBtn")?.addEventListener("click", async () => {
    await loadCaseDetail(getCaseCodeFromUrl());
  });

  $("#detailEvidenceHelpBtn")?.addEventListener("click", () => {
    genericModal(
      "📎",
      "Evidencia recomendada",
      "Adjunta recibos, capturas, pruebas de velocidad, fotos del equipo o documentos relacionados. Máximo 5 archivos de 10 MB cada uno."
    );
  });
}

function renderDetail(detail) {
  const c = normalizeCase(detail);

  const historial = detail.historial || detail.timeline || detail.actividad || [];
  const evidences = detail.evidencias || detail.evidence || detail.files || [];
  const requests = detail.solicitudes || detail.requests || detail.solicitudes_informacion || [];

  State.detailRequests = requests;
  State.detailRequest =
    requests.find((r) => !normalizeText(r.estado || r.status).includes("respond")) ||
    requests[0] ||
    null;

  text("#detailCaseType", c.type);
  text("#detailCaseTitle", c.title);
  text("#detailCaseDescription", c.description || "Consulta el avance, historial, evidencias y solicitudes del caso.");
  text("#detailCaseStatusText", c.status);
  text("#detailCaseSlaText", c.sla);
  text("#detailSummaryStatus", c.status);
  text("#detailSummaryAdvisor", c.advisor);
  text("#detailSummaryEvidence", `${evidences.length} archivo(s)`);
  text(
    "#detailSummaryPending",
    `${requests.filter((r) => !normalizeText(r.estado || r.status).includes("respond")).length} pendiente(s)`
  );
  text("#detailInfoCode", c.code);
  text("#detailInfoService", c.service);
  text("#detailInfoPriority", c.priority);
  text("#detailInfoChannel", c.channel);
  text("#detailFullDescription", c.description || "-");
  text("#detailIaShort", detail.ai_short || detail.resumen_ia_corto || "El caso se encuentra en seguimiento.");
  text("#trackingSlaRemaining", c.sla);
  text("#trackingCurrentStage", detail.current_stage || detail.etapa_actual || c.status);
  text("#trackingNextStep", c.action);
  text("#summaryEvidenceCaseCode", c.code);
  text("#summaryAdvisorResponseCase", c.code);

  const meta = $("#detailCaseMeta");

  if (meta) {
    meta.innerHTML = `
      <span>${esc(c.code)}</span>
      <span>${esc(c.service)}</span>
      <span>Prioridad ${esc(c.priority)}</span>
      <span>SLA: ${esc(c.sla)}</span>
    `;
  }

  renderDetailProgress(detail.steps || detail.etapas || buildDefaultSteps(c.status));
  renderActivity("#detailTimeline", historial);
  renderEvidence(evidences);
  renderAdvisorRequest(State.detailRequest);
  renderSurveyState(c, detail);
  renderAi("#detailAiSummary", detail.ai_summary || detail.resumen_ia || buildDetailAi(c, requests, evidences));
}

function buildDefaultSteps(status) {
  const current = toKey(status);
  const steps = ["Registrado", "Clasificación", "En atención", "Respuesta", "Cierre"];

  const currentIndex = current.includes("REGISTR")
    ? 0
    : current.includes("ATENC")
      ? 2
      : current.includes("RESUEL")
        ? 3
        : current.includes("CERR")
          ? 4
          : 1;

  return steps.map((title, index) => ({
    title,
    text: index < currentIndex ? "Completado" : index === currentIndex ? "Etapa actual" : "Pendiente",
    icon: index < currentIndex ? "✓" : index === currentIndex ? "⏳" : "•",
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending"
  }));
}

function renderDetailProgress(steps) {
  const box = $("#detailProgress");
  if (!box) return;

  box.innerHTML = steps
    .map(
      (step) => `
        <article class="progress-step progress-step--${esc(step.state || step.estado || "pending")}">
          <span>${esc(step.icon || "•")}</span>
          <div>
            <strong>${esc(step.title || step.titulo || "Etapa")}</strong>
            <p>${esc(step.text || step.descripcion || "")}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderEvidence(evidences) {
  const box = $("#detailEvidenceList");
  if (!box) return;

  box.innerHTML = evidences.length
    ? evidences
        .map(
          (item) => `
            <article class="evidence-item">
              <span>${esc(item.icon || "📎")}</span>
              <div>
                <strong>${esc(item.name || item.nombre_archivo || item.filename || "Archivo")}</strong>
                <p>${esc(item.status || item.estado || "Registrado")} · ${esc(formatDateTime(item.date || item.fecha_carga || item.fecha_subida))}</p>
              </div>
              ${
                item.url || item.download_url
                  ? `<a class="panel-action" href="${esc(item.url || item.download_url)}" target="_blank" rel="noopener">Ver</a>`
                  : `<button type="button" class="panel-action" disabled>Registrado</button>`
              }
            </article>
          `
        )
        .join("")
    : `
      <div class="empty-state">
        <span>📎</span>
        <h3>Sin evidencias cargadas</h3>
        <p>Agrega archivos cuando el asesor los solicite o cuando ayuden a sustentar el caso.</p>
      </div>
    `;
}

function renderAdvisorRequest(request) {
  if (!request) {
    text("#requestPendingBadge", "Sin pendientes");
    text("#advisorRequestTitle", "Sin solicitudes pendientes");
    text("#advisorRequestDate", "");
    text("#advisorRequestText", "No hay solicitudes activas del asesor para este caso.");
    setValue("#advisorRequestResponse", "");

    ["#advisorRequestResponse", "#advisorRequestEvidenceInput", "#advisorRequestDraftBtn", "#advisorRequestSubmitBtn"].forEach(
      (selector) => {
        const element = $(selector);
        if (element) element.disabled = true;
      }
    );

    return;
  }

  ["#advisorRequestResponse", "#advisorRequestEvidenceInput", "#advisorRequestDraftBtn", "#advisorRequestSubmitBtn"].forEach(
    (selector) => {
      const element = $(selector);
      if (element) element.disabled = false;
    }
  );

  text(
    "#requestPendingBadge",
    normalizeText(request.estado || request.status).includes("respond") ? "Respondida" : "1 pendiente"
  );
  text("#advisorRequestTitle", request.title || request.titulo || request.asunto || "Solicitud de información adicional");
  text("#advisorRequestDate", formatDateTime(request.date || request.fecha || request.fecha_solicitud));
  text("#advisorRequestText", request.text || request.mensaje || request.descripcion || "");

  const draft = localStorage.getItem(`claro360-advisor-draft-${getCaseCodeFromUrl()}`);

  if (draft && !value("#advisorRequestResponse")) {
    setValue("#advisorRequestResponse", draft);
  }
}

function renderSurveyState(c, detail) {
  const canSurvey = ["RESUELTO", "CERRADO"].includes(toKey(c.status));
  const alreadyRated = Boolean(detail.calificacion_cliente || detail.rating || detail.encuesta_enviada);
  const disabled = !canSurvey || alreadyRated;

  $$("[data-rating]").forEach((button) => {
    button.disabled = disabled;
  });

  const comment = $("#caseSurveyComment");

  if (comment) {
    comment.disabled = disabled;
  }

  const submit = $("#caseSurveySubmitBtn");

  if (submit) {
    submit.disabled = disabled;
    submit.textContent = alreadyRated
      ? "Encuesta ya enviada"
      : canSurvey
        ? "Enviar encuesta"
        : "Encuesta disponible al resolver";
  }
}

function buildDetailAi(c, requests, evidences) {
  return [
    {
      title: "Estado actual",
      text: `El caso está en estado ${c.status}.`
    },
    {
      title: "Evidencias",
      text: evidences.length
        ? `Hay ${evidences.length} archivo(s) cargado(s).`
        : "Aún no se registran evidencias."
    },
    {
      title: "Solicitudes",
      text: requests.length
        ? "Revisa si existe información pendiente del asesor."
        : "No hay solicitudes activas del asesor."
    }
  ];
}

async function submitCaseEvidence() {
  if (State.submitting.evidence) return;

  const code = getCaseCodeFromUrl();
  const valid = validateSelectedFiles("#detailEvidenceInput");

  if (!valid.ok) {
    genericModal("!", "Evidencia inválida", valid.message);
    return;
  }

  State.submitting.evidence = true;
  setButtonLoading("#acceptEvidenceConfirmBtn", true, "Enviando...");

  const formData = new FormData();
  getStoredFiles("#detailEvidenceInput").forEach((file) => formData.append("files", file));

  try {
    await apiTry(ENDPOINTS.caseEvidence(code), {
      method: "POST",
      body: formData
    });

    closeModals();
    successModal("Evidencia enviada", "La evidencia fue registrada y asociada al seguimiento del caso.");
    clearFileInput("#detailEvidenceInput", "#detailFileList");

    await loadCaseDetail(code);
  } catch (error) {
    genericModal("!", "No se pudo enviar evidencia", error.message);
  } finally {
    State.submitting.evidence = false;
    setButtonLoading("#acceptEvidenceConfirmBtn", false);
  }
}

async function submitAdvisorResponse() {
  if (State.submitting.advisorResponse) return;

  const code = getCaseCodeFromUrl();
  const responseText = value("#advisorRequestResponse");

  if (!responseText) {
    genericModal("!", "Respuesta requerida", "Ingresa una respuesta para el asesor.");
    return;
  }

  const valid = validateSelectedFiles("#advisorRequestEvidenceInput", {
    allowEmpty: true
  });

  if (!valid.ok) {
    genericModal("!", "Archivos inválidos", valid.message);
    return;
  }

  State.submitting.advisorResponse = true;
  setButtonLoading("#acceptAdvisorResponseConfirmBtn", true, "Enviando...");

  const formData = new FormData();
  formData.append("respuesta", responseText);
  formData.append("response", responseText);

  getStoredFiles("#advisorRequestEvidenceInput").forEach((file) => formData.append("files", file));

  try {
    await apiTry(ENDPOINTS.caseResponse(code, State.detailRequest?.solicitud_id || State.detailRequest?.id), {
      method: "POST",
      body: formData
    });

    closeModals();
    successModal("Respuesta enviada", "La respuesta fue enviada al asesor responsable.");

    localStorage.removeItem(`claro360-advisor-draft-${code}`);
    clearFileInput("#advisorRequestEvidenceInput", "#advisorRequestFileList");
    setValue("#advisorRequestResponse", "");

    await loadCaseDetail(code);
  } catch (error) {
    genericModal("!", "No se pudo enviar la respuesta", error.message);
  } finally {
    State.submitting.advisorResponse = false;
    setButtonLoading("#acceptAdvisorResponseConfirmBtn", false);
  }
}

async function submitSurvey() {
  if (State.submitting.survey) return;

  const code = getCaseCodeFromUrl();

  State.submitting.survey = true;
  setButtonLoading("#acceptSurveyConfirmBtn", true, "Enviando...");

  try {
    await apiTry(ENDPOINTS.caseSurvey(code), {
      method: "POST",
      body: JSON.stringify({
        calificacion: State.selectedRating,
        rating: State.selectedRating,
        comentario: value("#caseSurveyComment"),
        comment: value("#caseSurveyComment")
      })
    });

    closeModals();
    successModal("Encuesta enviada", "Gracias por ayudarnos a mejorar la atención.");

    await loadCaseDetail(code);
  } catch (error) {
    genericModal("!", "No se pudo enviar la encuesta", error.message);
  } finally {
    State.submitting.survey = false;
    setButtonLoading("#acceptSurveyConfirmBtn", false);
  }
}

async function downloadCaseCertificate() {
  const code = getCaseCodeFromUrl();

  try {
    await downloadFromApi(`${ENDPOINTS.caseCertificate(code)}?formato=pdf`, `constancia-${code}.pdf`);
    toast("Constancia descargada", "Se generó la constancia del caso.", "success");
  } catch (error) {
    genericModal("!", "Constancia no disponible", error.message);
  }
}

async function shareCase() {
  const code = getCaseCodeFromUrl();

  openConfirm({
    icon: "🔗",
    eyebrow: "Compartir seguimiento",
    title: "Generar enlace seguro",
    text: "Se generará un enlace temporal de consulta asociado a este caso. No compartas el enlace con personas no autorizadas.",
    summary: [
      {
        label: "Caso",
        value: code
      },
      {
        label: "Vigencia sugerida",
        value: "24 horas"
      }
    ],
    acceptText: "Generar enlace",
    onAccept: async () => {
      setButtonLoading("#systemConfirmAcceptBtn", true, "Generando...");

      try {
        const response = await apiTry(ENDPOINTS.caseShare(code), {
          method: "POST",
          body: JSON.stringify({
            vigencia_horas: 24
          })
        });

        const link = response.url || response.enlace || response.link || window.location.href;

        await navigator.clipboard?.writeText(link).catch(() => {});

        closeModals();
        genericModal("🔗", "Enlace generado", `El enlace seguro fue generado y copiado al portapapeles: ${link}`);
      } catch (error) {
        genericModal("!", "No se pudo compartir", error.message);
      } finally {
        setButtonLoading("#systemConfirmAcceptBtn", false);
      }
    }
  });
}

/* =========================================================
   RECLAMOS
========================================================= */

async function initClaim() {
  bindFileInput("#claimEvidence", "#claimFileList");

  await Promise.all([loadServicesIntoForms(), loadClaimCatalogs()]);

  $("#claimSaveDraft")?.addEventListener("click", saveClaimDraft);

  $("#claimPreviewBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    prepareClaim();
  });

  $("#claimForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    prepareClaim();
  });

  $("#acceptClaimConfirmBtn")?.addEventListener("click", submitClaim);
  $("#cancelClaimConfirmBtn")?.addEventListener("click", closeModals);

  $("#claimCategory")?.addEventListener("change", () => filterMotivesByCategory("claim"));

  restoreClaimDraft();
}

async function loadClaimCatalogs() {
  const catalogs = await loadCatalogs("reclamo");

  const categories = asArray(catalogs.categorias, catalogs.categories, catalogs.claim_categories);
  const priorities = asArray(catalogs.prioridades, catalogs.priorities);
  const contacts = asArray(catalogs.canales_contacto, catalogs.contactos, catalogs.canales, catalogs.contact_channels);
  const motives = asArray(catalogs.motivos, catalogs.motivos_catalogo, catalogs.reasons);

  if (categories.length) fillSelect("#claimCategory", categories, "Selecciona la categoría");
  if (priorities.length) fillSelect("#claimPriority", priorities, "Selecciona prioridad");
  if (contacts.length) fillSelect("#claimContact", contacts, "Selecciona medio de contacto");
  if ($("#claimReason") && motives.length) fillSelect("#claimReason", motives, "Selecciona motivo");
}

function filterMotivesByCategory(prefix) {
  const catalogs = State.catalogs[prefix === "claim" ? "reclamo" : "incidencia"] || {};
  const motives = asArray(catalogs.motivos, catalogs.motivos_catalogo, catalogs.reasons);
  const category = value(prefix === "claim" ? "#claimCategory" : "#incidentCategory");

  if (!motives.length) return;

  const filtered = motives.filter(
    (m) =>
      !category ||
      String(m.categoria_id || m.category_id || m.categoria || "") === String(category) ||
      !m.categoria_id
  );

  fillSelect(prefix === "claim" ? "#claimReason" : "#incidentSymptom", filtered, "Selecciona motivo o síntoma");
}

function claimPayload() {
  return {
    servicio_contratado_id: value("#claimService"),
    servicio_texto: selectedText("#claimService"),
    categoria_id: value("#claimCategory"),
    categoria_texto: selectedText("#claimCategory"),
    motivo_id: value("#claimReason"),
    motivo_texto: selectedText("#claimReason"),
    prioridad_id: value("#claimPriority"),
    prioridad_texto: selectedText("#claimPriority"),
    canal_contacto_preferido: value("#claimContact"),
    canal_contacto_texto: selectedText("#claimContact"),
    titulo: value("#claimTitle"),
    monto_reclamado: value("#claimAmount"),
    fecha_hecho: value("#claimDate"),
    descripcion: value("#claimDescription"),
    pretension_cliente: value("#claimExpectedSolution")
  };
}

function validateClaim() {
  const errors = {};
  const files = validateSelectedFiles("#claimEvidence", { allowEmpty: true });

  if (!value("#claimService")) errors.claimService = "Selecciona el servicio asociado.";
  if (!value("#claimCategory")) errors.claimCategory = "Selecciona la categoría del reclamo.";
  if (!value("#claimPriority")) errors.claimPriority = "Selecciona la prioridad percibida.";
  if (!value("#claimContact")) errors.claimContact = "Selecciona el medio de contacto.";

  if (!value("#claimTitle") || value("#claimTitle").length < 8) {
    errors.claimTitle = "Ingresa un título claro de al menos 8 caracteres.";
  }

  if (value("#claimAmount") && !isValidAmount(value("#claimAmount"))) {
    errors.claimAmount = "Ingresa un monto válido. Ejemplo: 89.90";
  }

  if (value("#claimDate") && new Date(value("#claimDate")) > new Date()) {
    errors.claimDate = "La fecha del hecho no puede ser futura.";
  }

  if (!value("#claimDescription") || value("#claimDescription").length < 25) {
    errors.claimDescription = "Describe el reclamo con al menos 25 caracteres.";
  }

  if (!checked("#claimDeclaration")) {
    errors.claimDeclaration = "Debes confirmar la declaración.";
  }

  if (!files.ok) {
    errors.claimEvidence = files.message;
  }

  const messages = Object.values(errors);

  return {
    ok: !messages.length,
    errors,
    firstMessage: messages[0] || ""
  };
}

function isValidAmount(input) {
  const clean = String(input).replace(/[S/\s,]/g, "");
  return /^\d+(\.\d{1,2})?$/.test(clean) && Number(clean) >= 0;
}

function prepareClaim() {
  const validation = validateClaim();

  if (!validation.ok) {
    showErrors(validation.errors);
    toast("Datos incompletos", validation.firstMessage, "warning");
    return false;
  }

  clearErrors();
  fillClaimSummary();
  openModal("#confirmClaimModal");
  return true;
}

function fillClaimSummary() {
  text("#summaryClaimService", selectedText("#claimService"));
  text("#summaryClaimCategory", selectedText("#claimCategory"));
  text("#summaryClaimPriority", selectedText("#claimPriority"));
  text("#summaryClaimContact", selectedText("#claimContact"));
  text("#summaryClaimTitle", value("#claimTitle"));
  text("#summaryClaimAmount", formatMoney(value("#claimAmount")));
  text("#summaryClaimDate", value("#claimDate") || "No registrada");
  text("#summaryClaimEvidence", fileText("#claimEvidence"));
  text("#summaryClaimDescription", value("#claimDescription"));
}

async function submitClaim() {
  if (State.submitting.claim) return;

  const payload = claimPayload();
  const duplicate = findRecentDuplicate("RECLAMO", payload, 30);

  if (duplicate) {
    genericModal(
      "!",
      "Caso similar ya registrado",
      `Ya registraste un reclamo similar hace poco${duplicate.code ? ` con código ${duplicate.code}` : ""}. Revisa Mis casos antes de volver a enviarlo.`
    );
    return;
  }

  State.submitting.claim = true;
  setButtonLoading("#acceptClaimConfirmBtn", true, "Registrando...");
  setButtonLoading("#claimSubmitBtn", true, "Registrando...");

  const formData = new FormData();

  Object.entries(payload).forEach(([key, val]) => {
    formData.append(key, val || "");
  });

  formData.append("tipo_caso", "RECLAMO");

  getStoredFiles("#claimEvidence").forEach((file) => {
    formData.append("files", file);
  });

  try {
    const response = await apiTry(ENDPOINTS.createClaim, {
      method: "POST",
      body: formData
    });

    const code =
      response.codigo_caso ||
      response.code ||
      response.case_code ||
      response.caso?.codigo_caso ||
      "-";

    rememberCaseFingerprint("RECLAMO", payload, response);
    localStorage.removeItem("claro360-claim-draft");

    closeModals();

    text("#successClaimCode", code);
    text(
      "#successClaimText",
      `Tu reclamo fue registrado con el código ${code}. Podrás darle seguimiento desde Mis casos.`
    );

    const detailLink = $('#successClaimModal a[href^="detalle-caso"]');
    if (detailLink) detailLink.href = `detalle-caso.html?codigo=${encodeURIComponent(code)}`;

    openModal("#successClaimModal");

    $("#claimForm")?.reset();
    clearFileInput("#claimEvidence", "#claimFileList");
  } catch (error) {
    genericModal("!", "No se pudo registrar el reclamo", error.message);
  } finally {
    State.submitting.claim = false;
    setButtonLoading("#acceptClaimConfirmBtn", false);
    setButtonLoading("#claimSubmitBtn", false);
  }
}

async function saveClaimDraft() {
  const draft = claimPayload();

  localStorage.setItem("claro360-claim-draft", JSON.stringify(draft));

  apiTry(ENDPOINTS.claimDraft, {
    method: "POST",
    body: JSON.stringify(draft)
  }).catch(() => {});

  openModal("#claimDraftModal");
}

function restoreClaimDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem("claro360-claim-draft") || "{}");

    if (!Object.keys(draft).length) return;

    setValue("#claimService", draft.servicio_contratado_id);
    setValue("#claimCategory", draft.categoria_id);
    setValue("#claimReason", draft.motivo_id);
    setValue("#claimPriority", draft.prioridad_id);
    setValue("#claimContact", draft.canal_contacto_preferido);
    setValue("#claimTitle", draft.titulo);
    setValue("#claimAmount", draft.monto_reclamado);
    setValue("#claimDate", draft.fecha_hecho);
    setValue("#claimDescription", draft.descripcion);
    setValue("#claimExpectedSolution", draft.pretension_cliente);
  } catch {}
}

/* =========================================================
   INCIDENCIAS
========================================================= */

async function initIncident() {
  bindFileInput("#incidentEvidence", "#incidentFileList");

  await Promise.all([loadServicesIntoForms(), loadIncidentCatalogs()]);

  $("#incidentDiagnosticBtn")?.addEventListener("click", openIncidentDiagnostic);
  $("#incidentSaveDraft")?.addEventListener("click", saveIncidentDraft);

  $("#incidentPreviewBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    prepareIncident();
  });

  $("#incidentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    prepareIncident();
  });

  $("#acceptIncidentConfirmBtn")?.addEventListener("click", submitIncident);
  $("#cancelIncidentConfirmBtn")?.addEventListener("click", closeModals);

  $("#incidentService")?.addEventListener("change", () => {
    prefillServiceLocation(value("#incidentService"));
  });

  restoreIncidentDraft();
}

async function loadIncidentCatalogs() {
  const catalogs = await loadCatalogs("incidencia");

  const symptoms = asArray(catalogs.sintomas, catalogs.motivos, catalogs.motivos_catalogo, catalogs.symptoms);
  const impacts = asArray(catalogs.impactos, catalogs.impacts);
  const urgencies = asArray(catalogs.urgencias, catalogs.urgencies, catalogs.prioridades);

  if (symptoms.length) fillSelect("#incidentSymptom", symptoms, "Selecciona síntoma principal");
  if (impacts.length) fillSelect("#incidentImpact", impacts, "Selecciona impacto");
  if (urgencies.length) fillSelect("#incidentUrgency", urgencies, "Selecciona urgencia");
}

function incidentPayload() {
  const serviceText = selectedText("#incidentService");
  const symptomText = selectedText("#incidentSymptom");
  const generatedTitle = value("#incidentTitle") || `${symptomText || "Falla técnica"} - ${serviceText || "Servicio"}`;

  return {
    servicio_contratado_id: value("#incidentService"),
    servicio_texto: serviceText,
    sintoma_id: value("#incidentSymptom"),
    sintoma_texto: symptomText,
    impacto_cliente: value("#incidentImpact"),
    impacto_texto: selectedText("#incidentImpact"),
    urgencia_cliente: value("#incidentUrgency"),
    urgencia_texto: selectedText("#incidentUrgency"),
    titulo: generatedTitle,
    ubicacion_referencial: value("#incidentAddress"),
    fecha_hecho: value("#incidentStartDate"),
    descripcion: value("#incidentDescription"),
    diagnostico_preliminar: buildIncidentDiagnosis()
  };
}

function validateIncident() {
  const errors = {};
  const files = validateSelectedFiles("#incidentEvidence", { allowEmpty: true });

  if (!value("#incidentService")) errors.incidentService = "Selecciona el servicio afectado.";
  if (!value("#incidentSymptom")) errors.incidentSymptom = "Selecciona el síntoma principal.";
  if (!value("#incidentImpact")) errors.incidentImpact = "Selecciona el impacto.";
  if (!value("#incidentUrgency")) errors.incidentUrgency = "Selecciona la urgencia.";
  if (!value("#incidentAddress")) errors.incidentAddress = "Ingresa la ubicación afectada.";

  if (value("#incidentStartDate") && new Date(value("#incidentStartDate")) > new Date()) {
    errors.incidentStartDate = "La fecha/hora de inicio no puede ser futura.";
  }

  if (!value("#incidentDescription") || value("#incidentDescription").length < 25) {
    errors.incidentDescription = "Describe la falla con al menos 25 caracteres.";
  }

  if (!checked("#incidentDeclaration")) {
    errors.incidentDeclaration = "Debes confirmar la declaración.";
  }

  if (!files.ok) {
    errors.incidentEvidence = files.message;
  }

  const messages = Object.values(errors);

  return {
    ok: !messages.length,
    errors,
    firstMessage: messages[0] || ""
  };
}

function prepareIncident() {
  const validation = validateIncident();

  if (!validation.ok) {
    showErrors(validation.errors);
    toast("Datos incompletos", validation.firstMessage, "warning");
    return false;
  }

  clearErrors();
  fillIncidentSummary();
  openModal("#confirmIncidentModal");
  return true;
}

function fillIncidentSummary() {
  text("#summaryIncidentService", selectedText("#incidentService"));
  text("#summaryIncidentSymptom", selectedText("#incidentSymptom"));
  text("#summaryIncidentImpact", selectedText("#incidentImpact"));
  text("#summaryIncidentUrgency", selectedText("#incidentUrgency"));
  text("#summaryIncidentAddress", value("#incidentAddress"));
  text("#summaryIncidentStartDate", value("#incidentStartDate") || "No registrado");
  text("#summaryIncidentEvidence", fileText("#incidentEvidence"));
  text("#summaryIncidentDiagnosis", buildIncidentDiagnosis());
  text("#summaryIncidentDescription", value("#incidentDescription"));
}

function buildIncidentDiagnosis() {
  const urgency = selectedText("#incidentUrgency") || value("#incidentUrgency");
  const impact = selectedText("#incidentImpact") || value("#incidentImpact");
  const textValue = normalizeText(`${urgency} ${impact}`);

  if (
    textValue.includes("critica") ||
    textValue.includes("masivo") ||
    textValue.includes("empresa") ||
    textValue.includes("varios usuarios")
  ) {
    return "Alta prioridad técnica";
  }

  if (textValue.includes("alta")) {
    return "Revisión prioritaria";
  }

  return "Revisión estándar";
}

async function openIncidentDiagnostic() {
  const payload = incidentPayload();

  try {
    const response = await apiTry(ENDPOINTS.incidentDiagnostic, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    text("#diagnosticPriority", response.prioridad || response.prioridad_estimada || buildIncidentDiagnosis());
    text("#diagnosticAffectation", response.afectacion || selectedText("#incidentImpact") || "No indicado");
    text("#diagnosticEvidence", response.evidencia_recomendada || "Captura, prueba técnica o foto del equipo");
    text("#diagnosticAction", response.accion_sugerida || "Completar datos y registrar incidencia.");
  } catch {
    text("#diagnosticPriority", buildIncidentDiagnosis());
    text("#diagnosticAffectation", selectedText("#incidentImpact") || "No indicado");
    text("#diagnosticEvidence", fileText("#incidentEvidence") || "Captura o prueba técnica");
    text("#diagnosticAction", "Completar datos técnicos y enviar registro para clasificación.");
  }

  openModal("#incidentDiagnosticModal");
}

async function submitIncident() {
  if (State.submitting.incident) return;

  const payload = incidentPayload();
  const duplicate = findRecentDuplicate("INCIDENCIA", payload, 30);

  if (duplicate) {
    genericModal(
      "!",
      "Caso similar ya registrado",
      `Ya registraste una incidencia similar hace poco${duplicate.code ? ` con código ${duplicate.code}` : ""}. Revisa Mis casos antes de volver a enviarla.`
    );
    return;
  }

  State.submitting.incident = true;
  setButtonLoading("#acceptIncidentConfirmBtn", true, "Registrando...");
  setButtonLoading("#incidentSubmitBtn", true, "Registrando...");

  const formData = new FormData();

  Object.entries(payload).forEach(([key, val]) => {
    formData.append(key, val || "");
  });

  formData.append("tipo_caso", "INCIDENCIA");

  getStoredFiles("#incidentEvidence").forEach((file) => {
    formData.append("files", file);
  });

  try {
    const response = await apiTry(ENDPOINTS.createIncident, {
      method: "POST",
      body: formData
    });

    const code =
      response.codigo_caso ||
      response.code ||
      response.case_code ||
      response.caso?.codigo_caso ||
      "-";

    rememberCaseFingerprint("INCIDENCIA", payload, response);
    localStorage.removeItem("claro360-incident-draft");

    closeModals();

    text("#successIncidentCode", code);
    text(
      "#successIncidentText",
      `Tu incidencia fue registrada con el código ${code}. Podrás darle seguimiento desde Mis casos.`
    );

    const detailLink = $('#successIncidentModal a[href^="detalle-caso"]');
    if (detailLink) detailLink.href = `detalle-caso.html?codigo=${encodeURIComponent(code)}`;

    openModal("#successIncidentModal");

    $("#incidentForm")?.reset();
    clearFileInput("#incidentEvidence", "#incidentFileList");
  } catch (error) {
    genericModal("!", "No se pudo registrar la incidencia", error.message);
  } finally {
    State.submitting.incident = false;
    setButtonLoading("#acceptIncidentConfirmBtn", false);
    setButtonLoading("#incidentSubmitBtn", false);
  }
}

async function saveIncidentDraft() {
  const draft = incidentPayload();

  localStorage.setItem("claro360-incident-draft", JSON.stringify(draft));

  apiTry(ENDPOINTS.incidentDraft, {
    method: "POST",
    body: JSON.stringify(draft)
  }).catch(() => {});

  openModal("#incidentDraftModal");
}

function restoreIncidentDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem("claro360-incident-draft") || "{}");

    if (!Object.keys(draft).length) return;

    setValue("#incidentService", draft.servicio_contratado_id);
    setValue("#incidentSymptom", draft.sintoma_id);
    setValue("#incidentImpact", draft.impacto_cliente);
    setValue("#incidentUrgency", draft.urgencia_cliente);
    setValue("#incidentTitle", draft.titulo);
    setValue("#incidentAddress", draft.ubicacion_referencial);
    setValue("#incidentStartDate", draft.fecha_hecho);
    setValue("#incidentDescription", draft.descripcion);
  } catch {}
}

/* =========================================================
   SERVICIOS CONTRATADOS
========================================================= */

async function initServices() {
  bindServiceFilters();
  await loadServicesPage();
}

function bindServiceFilters() {
  $("#servicesSearchInput")?.addEventListener(
    "input",
    debounce(() => {
      State.pagination.services.page = 1;
      renderServicesPage();
    }, 180)
  );

  $("#servicesCardViewBtn")?.addEventListener("click", () => switchServiceView("cards"));
  $("#servicesTableViewBtn")?.addEventListener("click", () => switchServiceView("table"));

  $("#refreshServicesBtn")?.addEventListener("click", async () => {
    await loadServicesPage();
    toast("Servicios actualizados", "La información fue actualizada.", "success");
  });

  $("#servicesHealthCheckBtn")?.addEventListener("click", openServicesHealth);

  $$("[data-service-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.serviceChip = button.dataset.serviceFilter || "todos";

      $$("[data-service-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      State.pagination.services.page = 1;
      renderServicesPage();
    });
  });

  $("#applyServicesFilterBtn")?.addEventListener("click", () => {
    State.filters.serviceType = value("#serviceTypeFilter") || "todos";
    State.filters.serviceStatus = value("#serviceStatusFilter") || "todos";
    State.filters.serviceSort = value("#serviceSortSelect") || "reciente";

    State.pagination.services.page = 1;
    renderServicesPage();
  });
}

async function loadServicesPage() {
  try {
    const response = await apiTry(ENDPOINTS.services);

    State.services = response.items || response.services || response.servicios || response.data || [];
    State.pagination.services.total = Number(response.total || State.services.length);

    renderServicesPage();
    renderAi("#servicesAiSummary", response.ai_summary || response.resumen_ia || buildServicesAi());
  } catch (error) {
    State.services = [];
    renderServicesPage();
    renderAi("#servicesAiSummary", [
      {
        title: "Servicios no disponibles",
        text: error.message
      }
    ]);
  }
}

function normalizeService(item = {}) {
  const name = item.nombre || item.name || item.servicio || item.servicio_nombre || "Servicio";
  const code = item.codigo_contrato || item.codigo || item.code || "-";

  return {
    id: item.servicio_contratado_id || item.id || item.servicio_id || code,
    icon: item.icon || item.icono || getServiceIcon(name),
    code,
    name,
    type: item.tipo_servicio || item.tipo || item.type || item.segmento || getServiceType(name),
    plan: item.plan_nombre || item.plan || "-",
    description: item.descripcion || item.description || "",
    status: normalizeServiceStatus(item.estado || item.status || "ACTIVO"),
    location: item.direccion_instalacion || item.direccion || item.ubicacion || item.location || item.distrito || "-",
    district: item.distrito || "",
    amount: item.monto_mensual || item.amount || "",
    cases: Number(item.casos_asociados || item.casos || item.cases || 0),
    last: item.ultima_atencion || item.fecha_actualizacion || item.fecha_inicio || item.last || "",
    recommendation: item.recomendacion || item.recommendation || "Revisar estado y casos asociados.",
    raw: item
  };
}

function normalizeServiceStatus(status) {
  const key = toKey(status);

  if (key === "ACTIVO") return "Activo";
  if (key === "SUSPENDIDO") return "Suspendido";
  if (key === "BAJA") return "Baja";
  if (key === "PENDIENTE") return "Pendiente";
  if (key.includes("OBSERV")) return "En observación";

  return status || "Activo";
}

function getServiceIcon(name) {
  const v = normalizeText(name);

  if (v.includes("movil") || v.includes("linea")) return "📱";
  if (v.includes("internet")) return "🏠";
  if (v.includes("tv")) return "📺";
  if (v.includes("empresa") || v.includes("cloud") || v.includes("correo")) return "🏢";

  return "📡";
}

function getServiceType(name) {
  const v = normalizeText(name);

  if (v.includes("movil") || v.includes("linea")) return "Móvil";
  if (v.includes("internet")) return "Internet hogar";
  if (v.includes("tv")) return "TV";
  if (v.includes("empresa") || v.includes("cloud") || v.includes("correo")) return "Empresa";

  return "Servicio";
}

function filteredServices() {
  const q = normalizeText(value("#servicesSearchInput"));
  let items = State.services.map(normalizeService);

  items = items.filter((s) => {
    const all = normalizeText(`${s.code} ${s.name} ${s.type} ${s.plan} ${s.status} ${s.location}`);
    const chip = State.filters.serviceChip;
    const chipKey = normalizeText(chip);

    return (
      (!q || all.includes(q)) &&
      (chip === "todos" ||
        normalizeText(s.type) === chipKey ||
        normalizeText(s.name).includes(chipKey) ||
        (chip === "Con alertas" && normalizeText(s.status).includes("observ"))) &&
      (State.filters.serviceType === "todos" || normalizeText(s.type) === normalizeText(State.filters.serviceType)) &&
      (State.filters.serviceStatus === "todos" ||
        normalizeText(s.status) === normalizeText(State.filters.serviceStatus))
    );
  });

  if (State.filters.serviceSort === "tipo") items.sort((a, b) => a.type.localeCompare(b.type));
  if (State.filters.serviceSort === "estado") items.sort((a, b) => a.status.localeCompare(b.status));
  if (State.filters.serviceSort === "casos") items.sort((a, b) => b.cases - a.cases);
  if (State.filters.serviceSort === "reciente") items.sort((a, b) => String(b.id).localeCompare(String(a.id)));

  return items;
}

function renderServicesPage() {
  const all = filteredServices();
  const items = paginate(all, State.pagination.services);

  const active = all.filter((s) => normalizeText(s.status).includes("activo"));
  const observed = all.filter((s) => normalizeText(s.status).includes("observ"));

  text("#summaryActiveServices", active.length);
  text("#summaryServicesCases", all.reduce((total, s) => total + s.cases, 0));
  text("#summaryStableServices", all.length - observed.length);
  text("#summaryObservedServices", observed.length);
  text("#servicesHeroTotal", `${active.length || all.length} servicios activos`);
  text("#servicesHeroStatus", observed.length ? "Servicios en observación" : "Operación estable");

  const grid = $("#servicesFullGrid");
  const table = $("#servicesTableBody");
  const empty = $("#emptyServicesState");

  if (!items.length) {
    if (grid) grid.innerHTML = "";
    if (table) table.innerHTML = "";
    empty?.classList.remove("hidden");
    renderPagination("services", all.length);
    return;
  }

  empty?.classList.add("hidden");

  if (grid) grid.innerHTML = items.map(serviceCard).join("");
  if (table) table.innerHTML = items.map(serviceRow).join("");

  bindServiceButtons();
  switchServiceView(State.serviceView);
  renderPagination("services", all.length);
}

function renderServices(selector, services) {
  const grid = $(selector);
  if (!grid) return;

  const items = (services || []).map(normalizeService);

  grid.innerHTML = items.length
    ? items.map(serviceSmallCard).join("")
    : `
      <div class="empty-state">
        <span>📡</span>
        <h3>Sin servicios cargados</h3>
        <p>No se encontraron servicios vinculados.</p>
      </div>
    `;

  bindServiceButtons();
}

function serviceSmallCard(service) {
  const s = normalizeService(service);

  return `
    <article class="service-card">
      <div class="service-card__top">
        <span class="service-icon">${esc(s.icon)}</span>
        <span class="status-pill ${statusClass(s.status)}">${esc(s.status)}</span>
      </div>

      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description || s.plan)}</p>
      <small>${esc(s.code)}</small>

      <div class="service-actions">
        <button type="button" data-service-id="${esc(s.id)}">Ver</button>
      </div>
    </article>
  `;
}

function serviceCard(service) {
  const s = normalizeService(service);

  return `
    <article class="service-card service-card--detailed">
      <div class="service-card__top">
        <span class="service-icon">${esc(s.icon)}</span>
        <span class="status-pill ${statusClass(s.status)}">${esc(s.status)}</span>
      </div>

      <h3>${esc(s.name)}</h3>
      <p>${esc(s.plan)} · ${esc(s.location)}</p>

      <div class="case-meta">
        <span>${esc(s.code)}</span>
        <span>${esc(s.type)}</span>
        <span>${esc(s.cases)} caso(s)</span>
      </div>

      <div class="service-actions">
        <button type="button" data-service-id="${esc(s.id)}">Ver detalle</button>
        <button type="button" data-service-cases-id="${esc(s.id)}">Casos</button>
        <a class="panel-link" href="${esc(incidentUrl(s.id))}">Incidencia</a>
        <a class="panel-link" href="${esc(claimUrl(s.id))}">Reclamo</a>
      </div>
    </article>
  `;
}

function serviceRow(service) {
  const s = normalizeService(service);

  return `
    <tr>
      <td>${esc(s.code)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.plan)}</td>
      <td><span class="status-pill ${statusClass(s.status)}">${esc(s.status)}</span></td>
      <td>${esc(s.location)}</td>
      <td>${esc(s.cases)}</td>
      <td>
        <button type="button" class="panel-action" data-service-id="${esc(s.id)}">Ver</button>
        <button type="button" class="panel-action" data-service-cases-id="${esc(s.id)}">Casos</button>
      </td>
    </tr>
  `;
}

function bindServiceButtons() {
  $$("[data-service-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const service = State.services
        .map(normalizeService)
        .find((item) => String(item.id) === String(button.dataset.serviceId));

      if (service) openService(service);
    });
  });

  $$("[data-service-cases-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const service = State.services
        .map(normalizeService)
        .find((item) => String(item.id) === String(button.dataset.serviceCasesId));

      if (service) openServiceCases(service);
    });
  });
}

function openService(service) {
  State.selectedService = service;

  text("#serviceModalIcon", service.icon);
  text("#serviceModalType", service.type);
  text("#serviceModalTitle", service.name);
  text("#serviceModalText", service.description || service.plan);
  text("#serviceModalCode", service.code);
  text("#serviceModalCategory", service.type);
  text("#serviceModalPlan", service.plan);
  text("#serviceModalStatus", service.status);
  text("#serviceModalLocation", service.location);
  text("#serviceModalCases", `${service.cases} caso(s)`);
  text("#serviceModalLastUpdate", formatDateTime(service.last));
  text("#serviceModalRecommendation", service.recommendation);

  const modal = $("#serviceDetailModal");
  const incident = modal?.querySelector('a[href^="registrar-incidencia"]');
  const claim = modal?.querySelector('a[href^="registrar-reclamo"]');

  if (incident) incident.href = incidentUrl(service.id);
  if (claim) claim.href = claimUrl(service.id);

  openModal("#serviceDetailModal");
}

async function openServiceCases(service) {
  text("#serviceCasesTitle", `Casos vinculados a ${service.name}`);

  const box = $("#serviceLinkedCasesList");
  if (!box) return;

  box.innerHTML = `<p class="muted">Cargando casos asociados...</p>`;

  try {
    const response = await apiTry(ENDPOINTS.serviceCases(service.id));
    const cases = response.items || response.cases || response.casos || [];

    box.innerHTML = cases.length
      ? cases
          .map((item) => {
            const c = normalizeCase(item);

            return `
              <article class="linked-case-item">
                <span>${esc(c.icon)}</span>
                <div>
                  <strong>${esc(c.code)}</strong>
                  <p>${esc(c.title)} · ${esc(c.status)}</p>
                </div>
                <a href="${esc(detailUrl(c))}" class="panel-link">Ver</a>
              </article>
            `;
          })
          .join("")
      : `
        <div class="empty-state">
          <span>🎫</span>
          <h3>Sin casos asociados</h3>
          <p>Este servicio no tiene casos recientes.</p>
        </div>
      `;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }

  openModal("#serviceCasesModal");
}

function switchServiceView(viewName) {
  State.serviceView = viewName;

  $("#servicesCardViewBtn")?.classList.toggle("active", viewName === "cards");
  $("#servicesTableViewBtn")?.classList.toggle("active", viewName === "table");
  $("#servicesFullGrid")?.classList.toggle("hidden", viewName !== "cards");
  $("#servicesTableWrap")?.classList.toggle("hidden", viewName !== "table");
}

function buildServicesAi() {
  const items = State.services.map(normalizeService);
  const observed = items.filter((s) => normalizeText(s.status).includes("observ"));

  return [
    {
      title: "Servicios vinculados",
      text: `${items.length} servicio(s) asociados a tu cuenta.`
    },
    {
      title: "Observaciones",
      text: observed.length
        ? `${observed.length} servicio(s) requieren revisión.`
        : "No se detectan observaciones en servicios."
    },
    {
      title: "Acción sugerida",
      text: "Antes de registrar un nuevo caso, revisa si el servicio ya tiene casos asociados."
    }
  ];
}

async function openServicesHealth() {
  const items = State.services.map(normalizeService);

  try {
    const response = await apiTry(ENDPOINTS.serviceDiagnostic);

    text(
      "#healthActiveServices",
      response.activos ?? items.filter((s) => normalizeText(s.status).includes("activo")).length
    );
    text(
      "#healthObservedServices",
      response.observados ?? items.filter((s) => normalizeText(s.status).includes("observ")).length
    );
    text("#healthOpenCases", response.casos_abiertos ?? items.reduce((sum, s) => sum + s.cases, 0));
    text("#healthSuggestedAction", response.accion_sugerida || "Revisar servicios con casos abiertos o alertas.");
  } catch {
    text("#healthActiveServices", items.filter((s) => normalizeText(s.status).includes("activo")).length);
    text("#healthObservedServices", items.filter((s) => normalizeText(s.status).includes("observ")).length);
    text("#healthOpenCases", items.reduce((sum, s) => sum + s.cases, 0));
    text("#healthSuggestedAction", "Revisar servicios con casos abiertos o alertas.");
  }

  openModal("#servicesHealthModal");
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

async function initNotifications() {
  bindNotificationFilters();
  await loadNotifications();
}

function bindNotificationFilters() {
  $("#notificationsSearchInput")?.addEventListener(
    "input",
    debounce(() => {
      State.pagination.notifications.page = 1;
      renderNotifications();
    }, 180)
  );

  $("#notificationsListViewBtn")?.addEventListener("click", () => switchNotificationView("list"));
  $("#notificationsCompactViewBtn")?.addEventListener("click", () => switchNotificationView("compact"));

  $("#refreshNotificationsBtn")?.addEventListener("click", async () => {
    await loadNotifications();
    toast("Notificaciones actualizadas", "La bandeja fue actualizada.", "success");
  });

  $("#markAllReadBtn")?.addEventListener("click", confirmMarkAllNotificationsRead);
  $("#notificationMarkReadBtn")?.addEventListener("click", markSelectedNotificationRead);
  $("#deleteReadNotificationsBtn")?.addEventListener("click", () => openModal("#clearNotificationsModal"));
  $("#acceptClearNotificationsBtn")?.addEventListener("click", clearReadNotifications);

  $$("[data-notification-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      State.filters.notificationChip = button.dataset.notificationFilter || "todas";

      $$("[data-notification-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      State.pagination.notifications.page = 1;
      renderNotifications();
    });
  });

  $("#applyNotificationFiltersBtn")?.addEventListener("click", () => {
    State.filters.notificationType = value("#notificationTypeFilter") || "todas";
    State.filters.notificationStatus = value("#notificationStatusFilter") || "todas";
    State.filters.notificationPriority = value("#notificationPriorityFilter") || "todas";
    State.filters.notificationSort = value("#notificationSortSelect") || "reciente";

    State.pagination.notifications.page = 1;
    renderNotifications();
  });
}

async function loadNotifications() {
  try {
    const response = await apiTry(ENDPOINTS.notifications);

    State.notifications = response.items || response.notifications || response.notificaciones || response.data || [];
    State.pagination.notifications.total = Number(response.total || State.notifications.length);

    renderNotifications();
    renderAi("#notificationsAiSummary", response.ai_summary || response.resumen_ia || buildNotificationsAi());
    refreshNotificationCount();
  } catch (error) {
    State.notifications = [];
    renderNotifications();
    renderAi("#notificationsAiSummary", [
      {
        title: "No se pudieron cargar alertas",
        text: error.message
      }
    ]);
  }
}

function normalizeNotification(item = {}) {
  const caseCode = item.codigo_caso || item.case_code || item.case || item.caso || "-";
  const typeRaw = item.tipo || item.type || "SISTEMA";
  const type = normalizeNotificationType(typeRaw);

  return {
    id: item.notificacion_id || item.id,
    icon: item.icon || item.icono || getNotificationIcon(type),
    title: item.titulo || item.title || "Notificación",
    message: item.mensaje || item.message || "",
    type,
    priority: normalizeText(item.prioridad || item.priority || item.severidad || deriveNotificationPriority(item)),
    caseCode,
    date: item.fecha_generacion || item.fecha || item.date || "",
    rawDate: item.fecha_generacion || item.fecha || item.date || "",
    read: Boolean(item.leida ?? item.read),
    action: item.accion || item.action || getNotificationAction(type),
    url: item.url_accion || item.url || (caseCode && caseCode !== "-" ? detailUrl({ codigo_caso: caseCode }) : "")
  };
}

function normalizeNotificationType(type) {
  const key = toKey(type);

  if (key.includes("SLA")) return "sla";
  if (key.includes("SOLIC")) return "solicitud";
  if (key.includes("EVID")) return "evidencia";
  if (key.includes("CIER")) return "cierre";
  if (key.includes("CASO") || key.includes("SEGUIMIENTO") || key.includes("ASIGN")) return "caso";

  return "sistema";
}

function getNotificationIcon(type) {
  return (
    {
      sla: "⏱️",
      solicitud: "📩",
      evidencia: "📎",
      cierre: "✅",
      caso: "🎫",
      sistema: "🔔"
    }[type] || "🔔"
  );
}

function deriveNotificationPriority(item) {
  const textValue = normalizeText(`${item.tipo || ""} ${item.titulo || ""} ${item.mensaje || ""}`);

  if (textValue.includes("venc") || textValue.includes("crit") || textValue.includes("urg")) {
    return "alta";
  }

  if (textValue.includes("solic")) {
    return "media";
  }

  return "baja";
}

function getNotificationAction(type) {
  return (
    {
      sla: "Ver seguimiento",
      solicitud: "Responder solicitud",
      evidencia: "Ver evidencias",
      cierre: "Ver cierre",
      caso: "Ver caso",
      sistema: "Revisar"
    }[type] || "Revisar"
  );
}

function filteredNotifications() {
  const q = normalizeText(value("#notificationsSearchInput"));
  let items = State.notifications.map(normalizeNotification);

  items = items.filter((n) => {
    const all = normalizeText(`${n.title} ${n.message} ${n.type} ${n.caseCode} ${n.priority}`);
    const chip = State.filters.notificationChip;

    return (
      (!q || all.includes(q)) &&
      (chip === "todas" || n.type === chip || (chip === "no-leidas" && !n.read)) &&
      (State.filters.notificationType === "todas" || n.type === State.filters.notificationType) &&
      (State.filters.notificationStatus === "todas" ||
        (State.filters.notificationStatus === "no-leidas" && !n.read) ||
        (State.filters.notificationStatus === "leidas" && n.read)) &&
      (State.filters.notificationPriority === "todas" ||
        n.priority === normalizeText(State.filters.notificationPriority))
    );
  });

  if (State.filters.notificationSort === "prioridad") {
    items.sort((a, b) => notificationPriorityValue(b.priority) - notificationPriorityValue(a.priority));
  }

  if (State.filters.notificationSort === "no-leidas") {
    items.sort((a, b) => Number(a.read) - Number(b.read));
  }

  if (State.filters.notificationSort === "tipo") {
    items.sort((a, b) => a.type.localeCompare(b.type));
  }

  if (State.filters.notificationSort === "reciente") {
    items.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
  }

  return items;
}

function notificationPriorityValue(priority) {
  const p = normalizeText(priority);

  if (p.includes("alta")) return 3;
  if (p.includes("media")) return 2;

  return 1;
}

function renderNotifications() {
  const all = filteredNotifications();
  const items = paginate(all, State.pagination.notifications);
  const normalizedAll = State.notifications.map(normalizeNotification);

  text("#summaryTotalNotifications", normalizedAll.length);
  text("#summaryUnreadNotifications", normalizedAll.filter((n) => !n.read).length);
  text("#summaryCaseNotifications", normalizedAll.filter((n) => n.type === "caso" || n.caseCode !== "-").length);
  text("#summarySlaNotifications", normalizedAll.filter((n) => n.type === "sla").length);
  text("#notificationHeroUnread", `${normalizedAll.filter((n) => !n.read).length} no leídas`);

  const box = $("#notificationsFullList");
  const empty = $("#emptyNotificationsState");

  if (!box) return;

  if (!items.length) {
    box.innerHTML = "";
    empty?.classList.remove("hidden");
    renderPagination("notifications", all.length);
    return;
  }

  empty?.classList.add("hidden");
  box.innerHTML = items.map(notificationFull).join("");

  bindNotificationButtons();
  switchNotificationView(State.notificationView);
  renderPagination("notifications", all.length);
}

function notificationMini(item) {
  const n = normalizeNotification(item);

  return `
    <article class="notification-item ${n.read ? "" : "unread"}">
      <span class="notification-item__icon">${esc(n.icon)}</span>
      <div>
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.message)}</p>
        <small>${esc(formatDateTime(n.date))}</small>
      </div>
    </article>
  `;
}

function notificationFull(item) {
  const n = normalizeNotification(item);

  return `
    <article class="notification-full-item ${n.read ? "" : "unread is-unread"}">
      <span class="notification-full-icon">${esc(n.icon)}</span>

      <div>
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.message)}</p>

        <div class="case-meta">
          <span>${esc(n.type)}</span>
          <span>${esc(n.caseCode)}</span>
          <span>${esc(formatDateTime(n.date))}</span>
          <span>Prioridad ${esc(n.priority)}</span>
        </div>
      </div>

      <div class="case-actions">
        <span class="status-pill ${n.read ? "status-pill--success" : "status-pill--warning"}">
          ${n.read ? "Leída" : "No leída"}
        </span>
        <button type="button" data-notification-id="${esc(n.id)}">Ver</button>
      </div>
    </article>
  `;
}

function bindNotificationButtons() {
  $$("[data-notification-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const found = State.notifications
        .map(normalizeNotification)
        .find((item) => String(item.id) === String(button.dataset.notificationId));

      if (!found) return;

      State.selectedNotification = found;
      openNotification(found);
    });
  });
}

function openNotification(n) {
  text("#notificationModalIcon", n.icon);
  text("#notificationModalType", n.type);
  text("#notificationModalTitle", n.title);
  text("#notificationModalText", n.message);
  text("#notificationModalCase", n.caseCode);
  text("#notificationModalCategory", n.type);
  text("#notificationModalPriority", n.priority);
  text("#notificationModalDate", formatDateTime(n.date));
  text("#notificationModalStatus", n.read ? "Leída" : "No leída");
  text("#notificationModalAction", n.action);

  const goCase = $("#notificationGoCaseBtn");

  if (goCase) {
    if (n.caseCode && n.caseCode !== "-") {
      goCase.href = detailUrl({ codigo_caso: n.caseCode });
      goCase.classList.remove("hidden");
    } else {
      goCase.href = "#";
      goCase.classList.add("hidden");
    }
  }

  const markBtn = $("#notificationMarkReadBtn");

  if (markBtn) {
    markBtn.disabled = n.read;
  }

  openModal("#notificationDetailModal");
}

function switchNotificationView(viewName) {
  State.notificationView = viewName;

  $("#notificationsListViewBtn")?.classList.toggle("active", viewName === "list");
  $("#notificationsCompactViewBtn")?.classList.toggle("active", viewName === "compact");
  $("#notificationsFullList")?.classList.toggle("notifications-full-list--compact", viewName === "compact");
}

function confirmMarkAllNotificationsRead() {
  const count = State.notifications.map(normalizeNotification).filter((n) => !n.read).length;

  if (!count) {
    genericModal("🔔", "Sin pendientes", "No tienes notificaciones no leídas.");
    return;
  }

  openConfirm({
    icon: "🔔",
    title: "Marcar todo como leído",
    text: "Esta acción actualizará tu bandeja, pero no eliminará el historial asociado a tus casos.",
    summary: [
      {
        label: "Notificaciones no leídas",
        value: count
      }
    ],
    acceptText: "Marcar como leídas",
    onAccept: markAllNotificationsRead
  });
}

async function markAllNotificationsRead() {
  if (State.submitting.notifications) return;

  State.submitting.notifications = true;
  setButtonLoading("#systemConfirmAcceptBtn", true, "Actualizando...");

  try {
    await apiTry(ENDPOINTS.notificationsReadAll, {
      method: "PATCH"
    });

    closeModals();
    await loadNotifications();

    toast("Notificaciones actualizadas", "Todas las notificaciones fueron marcadas como leídas.", "success");
  } catch (error) {
    genericModal("!", "No se pudo actualizar", error.message);
  } finally {
    State.submitting.notifications = false;
    setButtonLoading("#systemConfirmAcceptBtn", false);
  }
}

async function markSelectedNotificationRead() {
  if (!State.selectedNotification || State.selectedNotification.read) return;

  try {
    await apiTry(ENDPOINTS.notificationRead(State.selectedNotification.id), {
      method: "PATCH"
    });

    closeModals();
    await loadNotifications();

    successModal("Notificación actualizada", "La notificación fue marcada como leída.");
  } catch (error) {
    genericModal("!", "No se pudo actualizar", error.message);
  }
}

async function clearReadNotifications() {
  try {
    await apiTry(ENDPOINTS.notificationsHideRead, {
      method: "PATCH"
    });

    closeModals();
    await loadNotifications();

    successModal("Bandeja actualizada", "Las notificaciones leídas fueron ocultadas de la bandeja.");
  } catch (error) {
    genericModal("!", "No se pudo limpiar", error.message);
  }
}

function buildNotificationsAi() {
  const items = State.notifications.map(normalizeNotification);
  const unread = items.filter((n) => !n.read);
  const requests = items.filter((n) => n.type === "solicitud");
  const sla = items.filter((n) => n.type === "sla");

  return [
    {
      title: "No leídas",
      text: unread.length
        ? `Tienes ${unread.length} alerta(s) pendientes de revisión.`
        : "No tienes alertas no leídas."
    },
    {
      title: "Solicitudes",
      text: requests.length
        ? `Hay ${requests.length} solicitud(es) relacionadas a casos.`
        : "No hay solicitudes pendientes detectadas."
    },
    {
      title: "SLA",
      text: sla.length
        ? `Revisa ${sla.length} alerta(s) de SLA.`
        : "No se detectan alertas SLA activas."
    }
  ];
}

/* =========================================================
   PERFIL
========================================================= */

async function initProfile() {
  bindProfile();
  await loadProfile();
}

function bindProfile() {
  $("#profileSaveTopBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    prepareProfile();
  });

  $("#profilePreviewBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    prepareProfile();
  });

  $("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    prepareProfile();
  });

  $("#profileResetBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    fillProfileForm();
  });

  $("#acceptProfileConfirmBtn")?.addEventListener("click", saveProfile);
  $("#cancelProfileConfirmBtn")?.addEventListener("click", closeModals);
  $("#profileSecurityReviewBtn")?.addEventListener("click", openSecurityReview);
  $("#changePasswordBtn")?.addEventListener("click", () => {
    window.location.href = "../recuperar-password.html";
  });
  $("#verifyChannelBtn")?.addEventListener("click", () => {
    genericModal(
      "✅",
      "Canales de verificación",
      "Se validará el correo y celular registrados para comunicaciones de seguimiento."
    );
  });
  $("#enableMfaBtn")?.addEventListener("click", () => {
    genericModal(
      "🛡️",
      "Doble validación",
      "La doble validación protegerá cambios sensibles de perfil y seguridad."
    );
  });
}

async function loadProfile() {
  try {
    const response = await apiTry(ENDPOINTS.profile);

    State.profile = response.profile || response.perfil || response.cliente || response;
    renderProfile(State.profile);
  } catch (error) {
    genericModal("!", "No se pudo cargar el perfil", error.message);
    setupUserFromStorage();
  }
}

function renderProfile(profile = {}) {
  const name =
    profile.nombre ||
    profile.nombres_completos ||
    profile.nombre_completo ||
    profile.razon_social ||
    State.user?.nombre_completo ||
    "Cliente";

  const documentText =
    profile.documento || `${profile.documento_tipo || ""} ${profile.documento_numero || ""}`.trim();

  const type = profile.tipo_cliente === "EMPRESA" ? "Empresa" : "Persona";
  const segment = profile.segmento_cliente || profile.segmento || (type === "Empresa" ? "Empresa" : "Residencial");

  text("#profileHeroName", name);
  text("#profileHeroSecurity", profile.seguridad || "Seguridad activa");
  text("#summaryProfileStatus", profile.estado || "Verificado");
  text("#summaryPreferredChannel", profile.canal_preferido || "Correo");
  text("#summaryNotificationStatus", profile.notificaciones_activas === false ? "Inactivas" : "Activas");
  text("#summarySecurityStatus", profile.nivel_seguridad || "Media");
  text("#profileStatusPill", profile.estado || "Cuenta activa");

  setValue("#profileName", name);
  setValue("#profileDocument", documentText);
  setValue("#profileClientType", type);
  setValue("#profileSegment", segment);
  setValue("#profileEmail", profile.correo || profile.email || State.user?.correo || "");
  setValue("#profilePhone", profile.telefono || profile.celular || "");
  setValue("#profileAddress", profile.direccion || profile.direccion_principal || "");

  ["#profileName", "#profileDocument", "#profileClientType", "#profileSegment"].forEach((selector) => {
    const el = $(selector);

    if (el) {
      el.readOnly = el.tagName !== "SELECT";

      if (el.tagName === "SELECT") {
        el.disabled = true;
      }

      el.classList.add("is-readonly");
    }
  });

  const prefs = profile.preferencias || profile.preferences || {};

  setChecked("#prefEmail", prefs.email ?? profile.pref_email ?? true);
  setChecked("#prefSms", prefs.sms ?? profile.pref_sms ?? false);
  setChecked("#prefWhatsapp", prefs.whatsapp ?? profile.pref_whatsapp ?? false);
  setChecked("#prefCall", prefs.llamada ?? prefs.call ?? profile.pref_call ?? false);

  renderProfileAccess(profile.accesos_recientes || profile.access_logs || []);
  renderAi("#profileAiSummary", profile.ai_summary || profile.resumen_ia || buildProfileAi(profile));
}

function fillProfileForm() {
  if (State.profile) renderProfile(State.profile);
}

function renderProfileAccess(items) {
  const box = $("#profileAccessList");
  if (!box) return;

  box.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article>
              <span>${esc(item.icon || item.icono || "💻")}</span>
              <div>
                <strong>${esc(item.title || item.dispositivo || item.canal || "Acceso")}</strong>
                <p>${esc(
                  item.text ||
                    item.descripcion ||
                    `${item.ubicacion_aproximada || ""} · ${formatDateTime(item.fecha_acceso || item.fecha)}`
                )}</p>
              </div>
            </article>
          `
        )
        .join("")
    : `
      <article>
        <span>🔐</span>
        <div>
          <strong>Sin accesos recientes</strong>
          <p>No hay registros recientes para mostrar.</p>
        </div>
      </article>
    `;
}

function validateProfile() {
  const errors = {};

  if (!value("#profileEmail")) {
    errors.profileEmail = "Ingresa el correo.";
  } else if (!/^\S+@\S+\.\S+$/.test(value("#profileEmail"))) {
    errors.profileEmail = "Ingresa un correo válido.";
  }

  if (!value("#profilePhone")) {
    errors.profilePhone = "Ingresa el celular.";
  } else if (!/^(\+?51\s?)?9\d{8}$/.test(value("#profilePhone").replace(/[\s-]/g, ""))) {
    errors.profilePhone = "Ingresa un celular peruano válido.";
  }

  if (!value("#profileAddress")) {
    errors.profileAddress = "Ingresa la dirección principal o referencia.";
  }

  if (!checked("#prefEmail") && !checked("#prefSms") && !checked("#prefWhatsapp") && !checked("#prefCall")) {
    errors.prefEmail = "Activa al menos un canal de comunicación.";
  }

  const messages = Object.values(errors);

  return {
    ok: !messages.length,
    errors,
    firstMessage: messages[0] || ""
  };
}

function prepareProfile() {
  const validation = validateProfile();

  if (!validation.ok) {
    showErrors(validation.errors);
    toast("Datos incompletos", validation.firstMessage, "warning");
    return false;
  }

  clearErrors();
  fillProfileSummary();
  openModal("#confirmProfileModal");
  return true;
}

function fillProfileSummary() {
  text("#summaryProfileName", value("#profileName"));
  text("#summaryProfileDocument", value("#profileDocument"));
  text("#summaryProfileClientType", value("#profileClientType"));
  text("#summaryProfileSegment", value("#profileSegment"));
  text("#summaryProfileEmail", value("#profileEmail"));
  text("#summaryProfilePhone", value("#profilePhone"));
  text("#summaryProfileAddress", value("#profileAddress"));

  const preferences = [];

  if (checked("#prefEmail")) preferences.push("Correo");
  if (checked("#prefSms")) preferences.push("SMS");
  if (checked("#prefWhatsapp")) preferences.push("WhatsApp");
  if (checked("#prefCall")) preferences.push("Llamada");

  text("#summaryProfilePreferences", preferences.join(", ") || "Sin preferencias activas");
}

async function saveProfile() {
  if (State.submitting.profile) return;

  State.submitting.profile = true;
  setButtonLoading("#acceptProfileConfirmBtn", true, "Guardando...");
  setButtonLoading("#profileSubmitBtn", true, "Guardando...");

  const payload = {
    correo: value("#profileEmail"),
    telefono: value("#profilePhone"),
    direccion: value("#profileAddress"),
    canal_preferido: checked("#prefWhatsapp")
      ? "WhatsApp"
      : checked("#prefEmail")
        ? "Correo"
        : checked("#prefSms")
          ? "SMS"
          : "Llamada",
    preferencias: {
      email: checked("#prefEmail"),
      sms: checked("#prefSms"),
      whatsapp: checked("#prefWhatsapp"),
      llamada: checked("#prefCall")
    }
  };

  try {
    const response = await apiTry(ENDPOINTS.profile, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    closeModals();

    if (response.profile || response.perfil) {
      State.profile = response.profile || response.perfil;
    }

    await loadProfile();
    openModal("#profileSuccessModal");
  } catch (error) {
    genericModal("!", "No se pudo guardar el perfil", error.message);
  } finally {
    State.submitting.profile = false;
    setButtonLoading("#acceptProfileConfirmBtn", false);
    setButtonLoading("#profileSubmitBtn", false);
  }
}

async function openSecurityReview() {
  try {
    const response = await apiTry(ENDPOINTS.profileSecurity);
    const summary = response.summary || response;

    genericModal(
      "🔐",
      "Revisión de seguridad",
      summary.mensaje ||
        "La cuenta está verificada. Revisa accesos recientes y mantén tus canales actualizados."
    );
  } catch {
    openModal("#profileSecurityModal");
  }
}

function buildProfileAi(profile) {
  return [
    {
      title: "Contacto",
      text:
        profile.correo || profile.telefono
          ? "Tus canales principales están registrados."
          : "Completa correo y celular para recibir alertas."
    },
    {
      title: "Preferencias",
      text: "Activa al menos un canal rápido y uno formal para seguimiento."
    },
    {
      title: "Seguridad",
      text: "Usa recuperación de contraseña para cambios sensibles y revisa accesos recientes."
    }
  ];
}

/* =========================================================
   ARCHIVOS, ERRORES, PAGINACIÓN Y DUPLICADOS
========================================================= */

function bindFileInput(inputSelector, listSelector) {
  const input = $(inputSelector);
  const list = $(listSelector);

  if (!input || !list) return;

  input.setAttribute("accept", CONFIG.allowedExtensions.map((ext) => `.${ext}`).join(","));

  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    State.fileStore[inputSelector] = files;

    const validation = validateFiles(files, { allowEmpty: true });

    renderFileList(inputSelector, listSelector, validation);

    if (!validation.ok) {
      toast("Archivo no permitido", validation.message, "warning");
    }
  });
}

function getStoredFiles(inputSelector) {
  return State.fileStore[inputSelector] || Array.from($(inputSelector)?.files || []);
}

function validateSelectedFiles(inputSelector, options = {}) {
  return validateFiles(getStoredFiles(inputSelector), options);
}

function validateFiles(files, options = {}) {
  const allowEmpty = options.allowEmpty ?? false;

  if (!files.length && !allowEmpty) {
    return {
      ok: false,
      message: "Selecciona al menos un archivo."
    };
  }

  if (files.length > CONFIG.maxFiles) {
    return {
      ok: false,
      message: `Solo puedes adjuntar hasta ${CONFIG.maxFiles} archivos por envío.`
    };
  }

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (CONFIG.blockedExtensions.includes(ext) || !CONFIG.allowedExtensions.includes(ext)) {
      return {
        ok: false,
        message: `El archivo ${file.name} no tiene un formato permitido.`
      };
    }

    if (file.size > CONFIG.maxFileSizeMb * 1024 * 1024) {
      return {
        ok: false,
        message: `El archivo ${file.name} supera ${CONFIG.maxFileSizeMb} MB.`
      };
    }
  }

  return {
    ok: true,
    message: ""
  };
}

function renderFileList(inputSelector, listSelector, validation = { ok: true }) {
  const list = $(listSelector);
  if (!list) return;

  const files = getStoredFiles(inputSelector);

  list.innerHTML = files.length
    ? files
        .map((file, index) => {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const validExt = CONFIG.allowedExtensions.includes(ext) && !CONFIG.blockedExtensions.includes(ext);
          const validSize = file.size <= CONFIG.maxFileSizeMb * 1024 * 1024;
          const isValid = validExt && validSize;

          return `
            <article class="file-item ${isValid ? "" : "file-item--error"}">
              <span>${isValid ? "📎" : "!"}</span>
              <div>
                <strong>${esc(file.name)}</strong>
                <p>${esc(formatBytes(file.size))}${isValid ? "" : " · Revisar formato o tamaño"}</p>
              </div>
              <button type="button" data-remove-file="${esc(inputSelector)}" data-file-index="${index}">
                Quitar
              </button>
            </article>
          `;
        })
        .join("") + (validation.ok ? "" : `<small class="form-error">${esc(validation.message)}</small>`)
    : "";

  $$("[data-remove-file]", list).forEach((button) => {
    button.addEventListener("click", () => {
      removeStoredFile(button.dataset.removeFile, Number(button.dataset.fileIndex), listSelector);
    });
  });
}

function removeStoredFile(inputSelector, index, listSelector) {
  const current = getStoredFiles(inputSelector);

  current.splice(index, 1);
  State.fileStore[inputSelector] = current;

  const input = $(inputSelector);

  if (input) {
    const dt = new DataTransfer();

    current.forEach((file) => dt.items.add(file));
    input.files = dt.files;
  }

  renderFileList(inputSelector, listSelector, validateFiles(current, { allowEmpty: true }));
}

function clearFileInput(inputSelector, listSelector) {
  const input = $(inputSelector);

  if (input) input.value = "";

  State.fileStore[inputSelector] = [];

  const list = $(listSelector);

  if (list) list.innerHTML = "";
}

function fileText(inputSelector) {
  const files = getStoredFiles(inputSelector);

  if (!files.length) return "Sin archivos adjuntos";
  if (files.length === 1) return files[0].name;

  return `${files.length} archivos seleccionados`;
}

function showErrors(errors) {
  clearErrors();

  Object.entries(errors).forEach(([key, message]) => {
    const element = $(`#${key}Error`);

    if (element) element.textContent = message;
  });
}

function clearErrors() {
  $$(".form-error").forEach((item) => {
    item.textContent = "";
  });
}

function renderAi(selector, items) {
  const box = $(selector);
  if (!box) return;

  const list = Array.isArray(items) ? items : [];

  box.innerHTML = list.length
    ? list
        .map(
          (item) => `
            <div class="ai-summary-item">
              <strong>${esc(item.title || item.titulo || item[0] || "Resumen")}</strong>
              <p>${esc(item.text || item.descripcion || item[1] || "")}</p>
            </div>
          `
        )
        .join("")
    : `
      <div class="ai-summary-item">
        <strong>Resumen pendiente</strong>
        <p>La lectura inteligente aparecerá cuando existan datos cargados.</p>
      </div>
    `;
}

function renderActivity(selector = "#activityTimeline", activity = State.activity) {
  const box = $(selector);
  if (!box) return;

  box.innerHTML = activity.length
    ? activity
        .map(
          (item) => `
            <article class="activity-item timeline-item">
              <span class="activity-icon">${esc(item.icon || item.icono || "•")}</span>
              <div class="activity-content">
                <strong>${esc(item.title || item.titulo || item.accion || "Movimiento")}</strong>
                <p>${esc(item.text || item.descripcion || item.observacion || "")}</p>
                <small>${esc(formatDateTime(item.date || item.fecha_evento || item.fecha))}</small>
              </div>
            </article>
          `
        )
        .join("")
    : `
      <div class="empty-state">
        <span>🕘</span>
        <h3>Sin movimientos registrados</h3>
        <p>La actividad aparecerá cuando existan actualizaciones.</p>
      </div>
    `;
}

function paginate(items, config) {
  const page = Math.max(1, Number(config.page || 1));
  const size = Math.max(1, Number(config.pageSize || CONFIG.pageSize));
  const start = (page - 1) * size;

  return items.slice(start, start + size);
}

function renderPagination(scope, total) {
  const map = {
    cases: ["#allCasesList", "casos"],
    services: ["#servicesFullGrid", "servicios"],
    notifications: ["#notificationsFullList", "notificaciones"]
  };

  const [anchorSelector, label] = map[scope] || [];
  const anchor = $(anchorSelector);

  if (!anchor) return;

  let container = $(`#${scope}Pagination`);

  if (!container) {
    container = document.createElement("div");
    container.id = `${scope}Pagination`;
    container.className = "pagination-bar";
    anchor.insertAdjacentElement("afterend", container);
  }

  const cfg = State.pagination[scope];
  const pages = Math.max(1, Math.ceil(total / cfg.pageSize));

  cfg.page = Math.min(cfg.page, pages);

  container.innerHTML = `
    <div>
      <strong>${esc(total)}</strong> ${esc(label)} encontrados · Página ${esc(cfg.page)} de ${esc(pages)}
    </div>

    <div class="pagination-actions">
      <button type="button" class="panel-action" data-page-prev="${scope}" ${cfg.page <= 1 ? "disabled" : ""}>
        Anterior
      </button>

      <button type="button" class="panel-action" data-page-next="${scope}" ${cfg.page >= pages ? "disabled" : ""}>
        Siguiente
      </button>
    </div>
  `;

  $(`[data-page-prev="${scope}"]`, container)?.addEventListener("click", () => {
    cfg.page = Math.max(1, cfg.page - 1);
    rerenderScope(scope);
  });

  $(`[data-page-next="${scope}"]`, container)?.addEventListener("click", () => {
    cfg.page = Math.min(pages, cfg.page + 1);
    rerenderScope(scope);
  });
}

function rerenderScope(scope) {
  if (scope === "cases") renderCases();
  if (scope === "services") renderServicesPage();
  if (scope === "notifications") renderNotifications();
}

function getCaseFingerprints() {
  try {
    return JSON.parse(localStorage.getItem("claro360-case-fingerprints") || "[]");
  } catch {
    return [];
  }
}

function setCaseFingerprints(items) {
  localStorage.setItem("claro360-case-fingerprints", JSON.stringify(items.slice(-30)));
}

function buildCaseFingerprint(type, payload) {
  return normalizeText(
    [
      type,
      payload.servicio_contratado_id,
      payload.categoria_id || payload.sintoma_id,
      payload.titulo,
      payload.descripcion
    ].join("|")
  ).slice(0, 280);
}

function findRecentDuplicate(type, payload, minutes = 30) {
  const fingerprint = buildCaseFingerprint(type, payload);
  const now = Date.now();

  return getCaseFingerprints().find((item) => {
    return item.fingerprint === fingerprint && now - Number(item.createdAt || 0) <= minutes * 60 * 1000;
  });
}

function rememberCaseFingerprint(type, payload, result) {
  const items = getCaseFingerprints();
  const fingerprint = buildCaseFingerprint(type, payload);

  items.push({
    fingerprint,
    type,
    createdAt: Date.now(),
    code:
      result.codigo_caso ||
      result.code ||
      result.case_code ||
      result.caso?.codigo_caso ||
      "",
    id: result.caso_id || result.id || result.caso?.caso_id || ""
  });

  setCaseFingerprints(items);
}


