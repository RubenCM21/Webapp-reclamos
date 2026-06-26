"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ADMIN.JS
   Frontend Administrador profesional
   Preparado para FastAPI + SQL Server
   - Sin mocks obligatorios
   - Selects desde BD
   - Modales de confirmación globales
   - Exportaciones reales por formato
   - Acciones auditables
   - Filtros y tablas preparadas para backend
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const State = {
  page: document.body.dataset.page || "",
  theme:
    localStorage.getItem("claro360-admin-theme") ||
    localStorage.getItem("claro360-theme") ||
    "light",

  currentUser: null,
  admin: null,

  users: [],
  roles: [],
  permissions: [],
  catalogItems: [],
  slaRules: [],
  integrations: [],
  metrics: [],
  reports: [],
  audit: [],
  backups: [],
  alerts: [],
  webhooks: [],
  restoreEvents: [],

  options: {},
  filters: {},
  systemConfig: {},
  originalSystemConfig: {},

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
  selectedReportId: null,

  userFilter: "todos",
  usersView: "cards",
  selectedUserIds: new Set(),

  permissionFilter: "todos",

  catalogFilter: "todos",
  catalogView: "cards",

  slaRuleFilter: "todos",
  slaRuleView: "cards",

  integrationFilter: "todos",
  integrationView: "cards",

  adminMetricCompact: false,

  auditFilter: "todos",
  backupFilter: "todos",

  pagination: {
    users: { page: 1, pageSize: 20, total: 0 },
    audit: { page: 1, pageSize: 25, total: 0 },
    reports: { page: 1, pageSize: 15, total: 0 }
  }
};

const ADMIN_PAGES = [
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
];

const PAGE_OPTION_ENDPOINTS = {
  "admin-dashboard": "/admin/dashboard/opciones",
  "admin-usuarios": "/admin/usuarios/opciones",
  "admin-roles-permisos": "/admin/roles-permisos/opciones",
  "admin-catalogos": "/admin/catalogos/opciones",
  "admin-reglas-sla": "/admin/reglas-sla/opciones",
  "admin-indicadores-reportes": "/admin/indicadores-reportes/opciones",
  "admin-integraciones": "/admin/integraciones/opciones",
  "admin-auditoria": "/admin/auditoria/opciones",
  "admin-respaldo": "/admin/respaldo/opciones",
  "admin-configuracion-sistema": "/admin/configuracion-sistema/opciones"
};

const PAGE_EXPORT_CONFIG = {
  usuarios: {
    title: "Exportar usuarios",
    endpoint: "/admin/usuarios/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Todos", "Filtrados", "Seleccionados", "Activos", "Bloqueados", "Inactivos"],
    sections: ["Datos de acceso", "Roles y áreas", "Último acceso", "Auditoría reciente"]
  },
  roles: {
    title: "Exportar roles",
    endpoint: "/admin/roles/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Todos", "Roles activos", "Roles inactivos", "Roles con permisos sensibles"],
    sections: ["Resumen", "Usuarios asignados", "Permisos", "Auditoría"]
  },
  permisos: {
    title: "Exportar matriz de permisos",
    endpoint: "/admin/roles-permisos/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Matriz completa", "Permisos sensibles", "Rol seleccionado", "Cambios pendientes"],
    sections: ["Matriz", "Permisos sensibles", "Riesgos", "Auditoría"]
  },
  catalogos: {
    title: "Exportar catálogos",
    endpoint: "/admin/catalogos/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Todos", "Filtrados", "Activos", "Inactivos", "Con dependencia SLA"],
    sections: ["Resumen", "Dependencias", "Uso funcional", "Auditoría"]
  },
  sla: {
    title: "Exportar reglas SLA",
    endpoint: "/admin/reglas-sla/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Todas", "Filtradas", "Activas", "Críticas", "En revisión"],
    sections: ["Resumen", "Matriz SLA", "Escalamiento", "Auditoría"]
  },
  indicadores: {
    title: "Exportar indicadores",
    endpoint: "/admin/indicadores-reportes/exportar",
    formats: ["PDF", "Word", "Excel", "CSV", "Imagen PNG", "Dashboard compartible"],
    scopes: ["Panel actual", "Todos los módulos", "Usuarios y roles", "Casos y SLA", "Integraciones y respaldo"],
    sections: ["KPIs", "Gráficos", "Métricas", "Reportes recientes", "Auditoría"]
  },
  integraciones: {
    title: "Exportar integraciones",
    endpoint: "/admin/integraciones/exportar",
    formats: ["PDF", "Word", "Excel", "CSV", "JSON técnico"],
    scopes: ["Todas", "Filtradas", "Activas", "Con alerta", "En error", "Críticas"],
    sections: ["Estado", "Endpoints", "Healthcheck", "Logs recientes", "Auditoría"]
  },
  webhooks: {
    title: "Exportar eventos webhook",
    endpoint: "/admin/integraciones/webhooks/exportar",
    formats: ["PDF", "Excel", "CSV", "JSON técnico"],
    scopes: ["Eventos visibles", "Errores", "Reintentos", "Últimas 24 horas", "Últimos 7 días"],
    sections: ["Evento", "Payload resumido", "Código HTTP", "Resultado"]
  },
  logsIntegracion: {
    title: "Exportar logs de integración",
    endpoint: "/admin/integraciones/logs/exportar",
    formats: ["PDF", "Excel", "CSV", "JSON técnico"],
    scopes: ["Logs visibles", "Errores", "Advertencias", "Todos"],
    sections: ["Detalle técnico", "HTTP", "Latencia", "Resultado"]
  },
  auditoria: {
    title: "Exportar auditoría",
    endpoint: "/admin/auditoria/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Eventos filtrados", "Críticos", "Usuarios", "Roles y permisos", "Configuración", "Todo"],
    sections: ["Resumen ejecutivo", "Eventos", "Antes / después", "IP y origen", "Sensibilidad"]
  },
  auditoriaDetalle: {
    title: "Descargar detalle auditable",
    endpoint: "/admin/auditoria/eventos/descargar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Evento seleccionado"],
    sections: ["Detalle", "Antes / después", "Datos técnicos", "Trazabilidad"]
  },
  respaldo: {
    title: "Exportar historial de respaldo",
    endpoint: "/admin/respaldo/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Todos", "Filtrados", "Completados", "Fallidos", "Verificados"],
    sections: ["Historial", "Validaciones", "Restauraciones", "Logs", "Continuidad"]
  },
  logRespaldo: {
    title: "Descargar log de respaldo",
    endpoint: "/admin/respaldo/log/exportar",
    formats: ["PDF", "TXT", "CSV", "JSON técnico"],
    scopes: ["Respaldo seleccionado"],
    sections: ["Detalle técnico", "Errores", "Validación", "Trazabilidad"]
  },
  configuracion: {
    title: "Exportar configuración",
    endpoint: "/admin/configuracion-sistema/exportar",
    formats: ["PDF", "Word", "Excel", "CSV"],
    scopes: ["Configuración completa", "Seguridad", "Notificaciones", "Mantenimiento", "Auditoría"],
    sections: ["Parámetros", "Cambios recientes", "Impacto", "Auditoría"]
  }
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

/* =========================================================
   UTILIDADES GENERALES
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

function setValue(selector, value) {
  const el = $(selector);
  if (el) el.value = value ?? "";
}

function isChecked(selector) {
  return Boolean($(selector)?.checked);
}

function setChecked(selector, value) {
  const el = $(selector);
  if (el) el.checked = Boolean(value);
}

function show(el, condition) {
  if (!el) return;
  el.classList.toggle("hidden", !condition);
}

function showBySelector(selector, condition) {
  show($(selector), condition);
}

function debounce(fn, delay = 350) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatDate(value) {
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

function formatDateOnly(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function initials(name) {
  return String(name || "Administrador")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "AD";
}

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
}

function requireAdminSession() {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user?.rol) {
    window.location.href = "../login.html?role=admin";
    return false;
  }

  if (String(user.rol).toUpperCase() !== "ADMINISTRADOR") {
    clearSession();
    window.location.href = "../login.html?role=admin";
    return false;
  }

  State.currentUser = user;
  return true;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "todos" &&
      value !== "todas" &&
      value !== "Todos" &&
      value !== "Todas"
    ) {
      query.append(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
}

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";
  if (typeof data.detail === "string") return data.detail;

  if (Array.isArray(data.detail)) {
    return data.detail.map(item => item.msg || item.message || "Dato inválido").join(" ");
  }

  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;

  return "No se pudo completar la operación.";
}

function getFilenameFromHeaders(response, fallback = "archivo") {
  const disposition = response.headers.get("Content-Disposition") || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const normalMatch = disposition.match(/filename="?([^"]+)"?/i);

  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  if (normalMatch?.[1]) return normalMatch[1];

  return fallback;
}

function extensionByFormat(format) {
  const f = String(format || "").toLowerCase();

  if (f.includes("pdf")) return "pdf";
  if (f.includes("word")) return "docx";
  if (f.includes("excel")) return "xlsx";
  if (f.includes("csv")) return "csv";
  if (f.includes("png") || f.includes("imagen")) return "png";
  if (f.includes("json")) return "json";
  if (f.includes("txt")) return "txt";

  return "dat";
}

/* =========================================================
   API
========================================================= */

async function apiJson(endpoint, options = {}) {
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

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = "../login.html?role=admin";
      return {};
    }

    throw new Error(getApiErrorMessage(data));
  }

  return data;
}

async function apiBlob(endpoint, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.status === 401 || response.status === 403) {
      clearSession();
      window.location.href = "../login.html?role=admin";
      return null;
    }

    throw new Error(getApiErrorMessage(data));
  }

  return {
    blob: await response.blob(),
    filename: getFilenameFromHeaders(response, "descarga")
  };
}

/* Compatibilidad con el código anterior */
const apiRequest = apiJson;

async function downloadFile(endpoint, payload = {}, fallbackName = "descarga") {
  const result = await apiBlob(endpoint, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!result) return;

  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================================================
   TOAST
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
  }, 3300);
}

/* =========================================================
   ESTADOS VISUALES
========================================================= */

function statusType(status) {
  const s = String(status || "").toLowerCase();

  if (
    s.includes("error") ||
    s.includes("fallido") ||
    s.includes("bloqueado") ||
    s.includes("crítica") ||
    s.includes("critica") ||
    s.includes("vencido") ||
    s.includes("rechazado")
  ) {
    return "danger";
  }

  if (
    s.includes("alerta") ||
    s.includes("revisión") ||
    s.includes("revision") ||
    s.includes("pendiente") ||
    s.includes("programado") ||
    s.includes("cola")
  ) {
    return "warning";
  }

  if (
    s.includes("activo") ||
    s.includes("activa") ||
    s.includes("completado") ||
    s.includes("verificado") ||
    s.includes("generado") ||
    s.includes("exitoso") ||
    s.includes("ok")
  ) {
    return "success";
  }

  return "info";
}

function metricStatusType(status) {
  if (["success", "warning", "danger", "info", "purple"].includes(status)) return status;
  return statusType(status);
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

function normalizeOption(item) {
  if (typeof item === "string" || typeof item === "number") {
    return {
      value: String(item),
      label: String(item)
    };
  }

  return {
    value:
      item.value ??
      item.id ??
      item.codigo ??
      item.nombre ??
      item.label ??
      "",
    label:
      item.label ??
      item.nombre ??
      item.descripcion ??
      item.value ??
      item.codigo ??
      "",
    disabled: Boolean(item.disabled ?? item.deshabilitado),
    raw: item
  };
}

/* =========================================================
   RENDERIZADORES BASE
========================================================= */

function renderKpis(selector, data = []) {
  const rows = Array.isArray(data) ? data : [];

  setHTML(selector, rows.map(item => {
    const icon = item.icon ?? item[0] ?? "•";
    const value = item.value ?? item.valor ?? item[1] ?? 0;
    const title = item.title ?? item.label ?? item.titulo ?? item[2] ?? "Indicador";
    const text = item.text ?? item.description ?? item.descripcion ?? item[3] ?? "";

    return `
      <article class="kpi-card fade-up">
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

  setHTML(selector, list.length ? list.map(item => {
    const title = item.title ?? item.titulo ?? item[0] ?? "Análisis";
    const text = item.text ?? item.descripcion ?? item[1] ?? "";

    return `
      <div class="ai-summary-item">
        <strong>${esc(title)}</strong>
        <p>${esc(text)}</p>
      </div>
    `;
  }).join("") : `
    <div class="ai-summary-item">
      <strong>Sin análisis disponible</strong>
      <p>El análisis aparecerá cuando el backend retorne información.</p>
    </div>
  `);
}

function renderChecklist(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(selector, list.map(item => {
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
  }).join(""));
}

function renderActivity(selector, rows = []) {
  const list = Array.isArray(rows) ? rows : [];

  setHTML(selector, list.length ? list.map(item => `
    <article class="activity-item">
      <span class="activity-icon">${esc(item.icon || "🕘")}</span>
      <div class="activity-content">
        <strong>${esc(item.title || item.action || item.accion || "Evento")}</strong>
        <p>${esc(item.text || item.detail || item.detalle || item.descripcion || "")}</p>
        <small>${esc(formatDate(item.date || item.fecha || item.fecha_evento))}</small>
      </div>
    </article>
  `).join("") : `
    <article class="activity-item">
      <span class="activity-icon">ℹ</span>
      <div class="activity-content">
        <strong>Sin eventos registrados</strong>
        <p>No se encontraron movimientos para este módulo.</p>
        <small>-</small>
      </div>
    </article>
  `);
}

function renderBarChart(selector, rows = []) {
  const data = Array.isArray(rows) ? rows : [];
  const max = Math.max(...data.map(row => Number(row.value ?? row.valor ?? row[1] ?? 0)), 1);

  setHTML(selector, data.length ? data.map(row => {
    const label = row.label ?? row.nombre ?? row[0] ?? "-";
    const value = Number(row.value ?? row.valor ?? row[1] ?? 0);

    return `
      <div class="bar-chart__row">
        <span title="${esc(label)}">${esc(label)}</span>
        <div>
          <i style="width:${Math.max(8, (value / max) * 100)}%"></i>
        </div>
        <strong>${esc(value)}</strong>
      </div>
    `;
  }).join("") : `
    <div class="empty-mini">
      <strong>Sin datos</strong>
      <span>El gráfico se cargará desde la base de datos.</span>
    </div>
  `);
}

function renderDonut(selector, legendSelector, rows = [], totalLabel = "Total") {
  const data = Array.isArray(rows) && rows.length ? rows : [{ label: "Sin datos", value: 1 }];
  const total = data.reduce((sum, row) => sum + Number(row.value ?? row.valor ?? 0), 0) || 1;
  let current = 0;

  const colors = [
    "var(--claro-red)",
    "var(--warning)",
    "var(--info)",
    "var(--success)",
    "var(--purple)"
  ];

  const slices = data.map((row, index) => {
    const value = Number(row.value ?? row.valor ?? 0);
    const start = current;
    const end = current + (value / total) * 100;
    current = end;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(", ");

  const donut = $(selector);
  if (donut) {
    donut.style.background = `conic-gradient(${slices})`;
    donut.dataset.label = `${total}\n${totalLabel}`;
  }

  setHTML(legendSelector, data.map((row, index) => `
    <div class="donut-legend__item">
      <span class="donut-legend__dot" style="background:${colors[index % colors.length]}"></span>
      <span>${esc(row.label ?? row.nombre ?? "-")}</span>
      <strong>${esc(row.value ?? row.valor ?? 0)}</strong>
    </div>
  `).join(""));
}

function renderTableFooter(selector, paginationKey, onPageChange) {
  const el = $(selector);
  if (!el) return;

  const p = State.pagination[paginationKey] || { page: 1, pageSize: 20, total: 0 };
  const totalPages = Math.max(1, Math.ceil((p.total || 0) / p.pageSize));

  el.innerHTML = `
    <div class="table-footer">
      <span class="records-summary">
        Página ${esc(p.page)} de ${esc(totalPages)} · ${esc(p.total)} registro(s)
      </span>
      <div class="pagination">
        <button type="button" data-page-prev ${p.page <= 1 ? "disabled" : ""}>Anterior</button>
        <button type="button" class="active">${esc(p.page)}</button>
        <button type="button" data-page-next ${p.page >= totalPages ? "disabled" : ""}>Siguiente</button>
      </div>
    </div>
  `;

  $("[data-page-prev]", el)?.addEventListener("click", () => {
    p.page = Math.max(1, p.page - 1);
    onPageChange?.();
  });

  $("[data-page-next]", el)?.addEventListener("click", () => {
    p.page = Math.min(totalPages, p.page + 1);
    onPageChange?.();
  });
}

/* =========================================================
   MODALES GLOBALES INYECTADOS
========================================================= */

function injectGlobalAdminModals() {
  if ($("#confirmActionModal")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <section class="modal" id="confirmActionModal" aria-hidden="true">
      <div class="modal__content modal__content--wide">
        <button type="button" class="modal__close" data-close-modal>×</button>

        <div class="modal__icon" id="confirmActionIcon">⚠️</div>
        <span class="eyebrow eyebrow--red" id="confirmActionEyebrow">Confirmación requerida</span>
        <h3 id="confirmActionTitle">Confirmar acción</h3>
        <p id="confirmActionText">Revisa la información antes de continuar.</p>

        <div class="confirm-warning-banner hidden" id="confirmActionWarning"></div>
        <div class="confirm-impact hidden" id="confirmActionImpact"></div>

        <div class="form-group hidden" id="confirmActionReasonWrap">
          <label for="confirmActionReason">Motivo administrativo</label>
          <textarea id="confirmActionReason" placeholder="Sustenta la acción para auditoría."></textarea>
        </div>

        <label class="form-check hidden" id="confirmActionCheckWrap">
          <input type="checkbox" id="confirmActionCheck" />
          <span id="confirmActionCheckText">Confirmo que revisé el impacto de esta acción.</span>
        </label>

        <div class="modal__actions">
          <button type="button" class="btn btn--primary" id="confirmActionAcceptBtn">
            Confirmar
          </button>
          <button type="button" class="btn btn--ghost-dark" data-close-modal>
            Cancelar
          </button>
        </div>
      </div>
    </section>

    <section class="modal" id="exportModal" aria-hidden="true">
      <div class="modal__content modal__content--wide">
        <button type="button" class="modal__close" data-close-modal>×</button>

        <div class="modal__icon">📤</div>
        <span class="eyebrow eyebrow--red">Exportación controlada</span>
        <h3 id="exportModalTitle">Exportar información</h3>
        <p id="exportModalText">
          Selecciona formato, alcance, secciones incluidas y registra un motivo para auditoría.
        </p>

        <div class="export-format-grid" id="exportFormatGrid"></div>

        <div class="form-grid">
          <div class="form-group">
            <label for="exportScope">Alcance</label>
            <select id="exportScope"></select>
          </div>

          <div class="form-group">
            <label for="exportFilename">Nombre del archivo</label>
            <input id="exportFilename" type="text" placeholder="reporte_administrativo" />
          </div>

          <div class="form-group">
            <label for="exportDateFrom">Fecha inicio</label>
            <input id="exportDateFrom" type="date" />
          </div>

          <div class="form-group">
            <label for="exportDateTo">Fecha fin</label>
            <input id="exportDateTo" type="date" />
          </div>
        </div>

        <div class="export-options-grid" id="exportSectionsGrid"></div>

        <div class="form-group">
          <label for="exportReason">Motivo de exportación</label>
          <textarea id="exportReason" placeholder="Ej. Sustento para revisión administrativa, auditoría interna o presentación ejecutiva."></textarea>
        </div>

        <label class="form-check">
          <input type="checkbox" id="exportDeclaration" />
          <span>Confirmo que la descarga será usada únicamente para fines administrativos autorizados.</span>
        </label>

        <div class="export-preview-card hidden" id="exportPreviewCard"></div>

        <div class="modal__actions">
          <button type="button" class="btn btn--primary" id="confirmExportBtn">
            Generar exportación
          </button>
          <button type="button" class="btn btn--ghost-dark" data-close-modal>
            Cancelar
          </button>
        </div>
      </div>
    </section>

    <section class="modal" id="resultModal" aria-hidden="true">
      <div class="modal__content modal__content--wide">
        <button type="button" class="modal__close" data-close-modal>×</button>

        <div class="modal__icon" id="resultModalIcon">✅</div>
        <span class="eyebrow eyebrow--red" id="resultModalEyebrow">Resultado</span>
        <h3 id="resultModalTitle">Operación completada</h3>
        <p id="resultModalText">Resultado de la operación.</p>

        <div class="result-grid" id="resultModalGrid"></div>
        <div class="technical-log-box hidden" id="resultModalLog"></div>

        <div class="modal__actions">
          <button type="button" class="btn btn--primary" data-close-modal>Aceptar</button>
        </div>
      </div>
    </section>

    <section class="modal" id="advancedFilterModal" aria-hidden="true">
      <div class="modal__content modal__content--wide">
        <button type="button" class="modal__close" data-close-modal>×</button>

        <div class="modal__icon">🔎</div>
        <span class="eyebrow eyebrow--red">Filtros avanzados</span>
        <h3 id="advancedFilterTitle">Filtrar información</h3>
        <p id="advancedFilterText">Ajusta criterios para consultar información desde la base de datos.</p>

        <div class="advanced-filter-panel" id="advancedFilterBody"></div>

        <div class="modal__actions">
          <button type="button" class="btn btn--primary" id="applyAdvancedFilterBtn">Aplicar filtros</button>
          <button type="button" class="btn btn--soft" id="clearAdvancedFilterBtn">Limpiar</button>
          <button type="button" class="btn btn--ghost-dark" data-close-modal>Cancelar</button>
        </div>
      </div>
    </section>

    <section class="modal" id="loadingModal" aria-hidden="true">
      <div class="modal__content">
        <div class="modal__icon">⏳</div>
        <h3 id="loadingModalTitle">Procesando</h3>
        <p id="loadingModalText">Estamos ejecutando la operación solicitada.</p>
        <div class="loading-panel">
          <span class="spinner"></span>
          <strong>Conectando con el servidor...</strong>
        </div>
      </div>
    </section>
  `);
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

function openLoading(title = "Procesando", text = "Estamos ejecutando la operación solicitada.") {
  setText("#loadingModalTitle", title);
  setText("#loadingModalText", text);
  openModal("#loadingModal");
}

function closeLoading() {
  $("#loadingModal")?.classList.remove("show");
}

function renderImpactHTML(items = []) {
  if (!items.length) return "";

  return items.map(item => `
    <div class="confirm-impact__row">
      <span>${esc(item.label || item.campo || "Campo")}</span>
      <strong>${esc(item.value || item.valor || "-")}</strong>
      ${item.impact ? `<em class="confirm-risk confirm-risk--${esc(item.level || "medium")}">${esc(item.impact)}</em>` : ""}
    </div>
  `).join("");
}

function confirmAction(config = {}) {
  return new Promise(resolve => {
    const {
      icon = "⚠️",
      eyebrow = "Confirmación requerida",
      title = "Confirmar acción",
      text = "Revisa la información antes de continuar.",
      warning = "",
      impact = [],
      requireReason = false,
      requireCheckbox = true,
      checkboxText = "Confirmo que revisé el impacto de esta acción.",
      confirmText = "Confirmar"
    } = config;

    setText("#confirmActionIcon", icon);
    setText("#confirmActionEyebrow", eyebrow);
    setText("#confirmActionTitle", title);
    setText("#confirmActionText", text);
    setText("#confirmActionCheckText", checkboxText);
    setText("#confirmActionAcceptBtn", confirmText);

    const warningBox = $("#confirmActionWarning");
    if (warningBox) {
      warningBox.textContent = warning;
      warningBox.classList.toggle("hidden", !warning);
    }

    const impactBox = $("#confirmActionImpact");
    if (impactBox) {
      impactBox.innerHTML = renderImpactHTML(impact);
      impactBox.classList.toggle("hidden", !impact.length);
    }

    showBySelector("#confirmActionReasonWrap", requireReason);
    showBySelector("#confirmActionCheckWrap", requireCheckbox);

    setValue("#confirmActionReason", "");
    setChecked("#confirmActionCheck", false);

    const accept = $("#confirmActionAcceptBtn");
    const backdrop = $("#modalBackdrop");

    const cleanup = () => {
      accept?.removeEventListener("click", onAccept);
      backdrop?.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onEscape);
    };

    const onCancel = () => {
      cleanup();
      resolve({ confirmed: false, reason: "" });
    };

    const onEscape = event => {
      if (event.key === "Escape") onCancel();
    };

    const onAccept = () => {
      const reason = getValue("#confirmActionReason");

      if (requireReason && !reason) {
        toast("Motivo requerido", "Debes ingresar un motivo para auditoría.", "warning");
        return;
      }

      if (requireCheckbox && !isChecked("#confirmActionCheck")) {
        toast("Confirmación requerida", "Debes marcar la confirmación antes de continuar.", "warning");
        return;
      }

      cleanup();
      closeModals();
      resolve({ confirmed: true, reason });
    };

    accept?.addEventListener("click", onAccept);
    backdrop?.addEventListener("click", onCancel);
    document.addEventListener("keydown", onEscape);

    openModal("#confirmActionModal");
  });
}

function showResultModal({
  icon = "✅",
  eyebrow = "Resultado",
  title = "Operación completada",
  text = "La acción fue procesada correctamente.",
  rows = [],
  log = ""
} = {}) {
  setText("#resultModalIcon", icon);
  setText("#resultModalEyebrow", eyebrow);
  setText("#resultModalTitle", title);
  setText("#resultModalText", text);

  setHTML("#resultModalGrid", rows.map(item => `
    <article class="result-card result-card--${esc(item.type || statusType(item.value))}">
      <span>${esc(item.icon || "•")}</span>
      <div>
        <strong>${esc(item.label || "Dato")}</strong>
        <p>${esc(item.value || "-")}</p>
      </div>
    </article>
  `).join(""));

  const logBox = $("#resultModalLog");
  if (logBox) {
    logBox.textContent = log;
    logBox.classList.toggle("hidden", !log);
  }

  openModal("#resultModal");
}

/* =========================================================
   EXPORTACIONES
========================================================= */

let CurrentExportConfig = null;
let CurrentExportFormat = "";

function openExportModal(key, extraPayload = {}) {
  const config = PAGE_EXPORT_CONFIG[key];

  if (!config) {
    toast("Exportación no configurada", "No se encontró configuración para esta descarga.", "warning");
    return;
  }

  CurrentExportConfig = { ...config, key, extraPayload };
  CurrentExportFormat = config.formats[0] || "PDF";

  setText("#exportModalTitle", config.title);
  setValue("#exportFilename", `${config.title.toLowerCase().replaceAll(" ", "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_${new Date().toISOString().slice(0, 10)}`);
  setValue("#exportReason", "");
  setValue("#exportDateFrom", "");
  setValue("#exportDateTo", "");
  setChecked("#exportDeclaration", false);

  setHTML("#exportFormatGrid", config.formats.map((format, index) => `
    <button type="button" class="export-format-card ${index === 0 ? "active" : ""}" data-export-format="${esc(format)}">
      <span>${esc(formatIcon(format))}</span>
      <strong>${esc(format)}</strong>
      <small>${esc(formatDescription(format))}</small>
    </button>
  `).join(""));

  setHTML("#exportScope", config.scopes.map(scope => `
    <option value="${esc(scope)}">${esc(scope)}</option>
  `).join(""));

  setHTML("#exportSectionsGrid", config.sections.map(section => `
    <label class="form-check">
      <input type="checkbox" class="export-section-check" value="${esc(section)}" checked />
      <span>${esc(section)}</span>
    </label>
  `).join(""));

  $$("#exportFormatGrid [data-export-format]").forEach(button => {
    button.addEventListener("click", () => {
      CurrentExportFormat = button.dataset.exportFormat;
      $$("#exportFormatGrid [data-export-format]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      updateExportPreview();
    });
  });

  $("#exportScope")?.addEventListener("change", updateExportPreview);
  $("#exportFilename")?.addEventListener("input", updateExportPreview);
  updateExportPreview();

  openModal("#exportModal");
}

function formatIcon(format) {
  const f = String(format || "").toLowerCase();

  if (f.includes("pdf")) return "📄";
  if (f.includes("word")) return "📝";
  if (f.includes("excel")) return "📊";
  if (f.includes("csv")) return "🧾";
  if (f.includes("png") || f.includes("imagen")) return "🖼️";
  if (f.includes("dashboard")) return "🔗";
  if (f.includes("json")) return "🧩";
  if (f.includes("txt")) return "📃";

  return "📤";
}

function formatDescription(format) {
  const f = String(format || "").toLowerCase();

  if (f.includes("pdf")) return "Informe formal";
  if (f.includes("word")) return "Documento editable";
  if (f.includes("excel")) return "Libro con hojas";
  if (f.includes("csv")) return "Datos planos";
  if (f.includes("png") || f.includes("imagen")) return "Imagen ejecutiva";
  if (f.includes("dashboard")) return "Link temporal";
  if (f.includes("json")) return "Datos técnicos";
  if (f.includes("txt")) return "Log plano";

  return "Exportación";
}

function updateExportPreview() {
  const config = CurrentExportConfig;
  if (!config) return;

  const format = CurrentExportFormat;
  const ext = extensionByFormat(format);

  setHTML("#exportPreviewCard", `
    <strong>Vista previa de salida</strong>
    <p>
      Se generará <b>${esc(format)}</b> con alcance <b>${esc(getValue("#exportScope"))}</b>.
      Archivo sugerido: <b>${esc(getValue("#exportFilename") || "descarga")}.${esc(ext)}</b>
    </p>
  `);

  showBySelector("#exportPreviewCard", true);
}

async function confirmExport() {
  const config = CurrentExportConfig;

  if (!config) {
    toast("Exportación no disponible", "No hay exportación activa.", "warning");
    return;
  }

  if (!getValue("#exportScope") || !getValue("#exportReason") || !isChecked("#exportDeclaration")) {
    toast("Faltan datos", "Selecciona alcance, ingresa motivo y confirma la declaración.", "warning");
    return;
  }

  const sections = $$(".export-section-check")
    .filter(input => input.checked)
    .map(input => input.value);

  if (!sections.length) {
    toast("Secciones requeridas", "Selecciona al menos una sección para exportar.", "warning");
    return;
  }

  const filename = getValue("#exportFilename") || "descarga";
  const format = CurrentExportFormat;
  const extension = extensionByFormat(format);

  const payload = {
    formato: format,
    alcance: getValue("#exportScope"),
    nombre_archivo: filename,
    fecha_inicio: getValue("#exportDateFrom"),
    fecha_fin: getValue("#exportDateTo"),
    secciones: sections,
    motivo: getValue("#exportReason"),
    pagina: State.page,
    filtros: collectCurrentFilters(),
    seleccion: collectCurrentSelection(),
    ...config.extraPayload
  };

  const confirmation = await confirmAction({
    icon: "📤",
    title: "Confirmar exportación",
    text: `Se generará una exportación en formato ${format}. Esta acción quedará registrada en auditoría.`,
    warning: "Verifica que el alcance y motivo sean correctos antes de descargar información administrativa.",
    impact: [
      { label: "Formato", value: format, impact: extension.toUpperCase(), level: "medium" },
      { label: "Alcance", value: payload.alcance, impact: "Auditable", level: "high" },
      { label: "Secciones", value: sections.length, impact: "Incluidas", level: "medium" }
    ],
    requireReason: false,
    requireCheckbox: true,
    checkboxText: "Confirmo que la exportación está autorizada."
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Generando exportación", "El servidor está preparando el archivo solicitado.");

    if (String(format).toLowerCase().includes("dashboard")) {
      const response = await apiJson(config.endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeLoading();
      closeModals();

      showResultModal({
        icon: "🔗",
        title: "Dashboard compartible generado",
        text: "Se generó un enlace temporal para compartir el dashboard.",
        rows: [
          { icon: "🔗", label: "Enlace", value: response.url || response.link || "Pendiente de backend", type: "info" },
          { icon: "⏳", label: "Expiración", value: response.expira || response.expiracion || "Según configuración", type: "warning" }
        ]
      });

      return;
    }

    await downloadFile(config.endpoint, payload, `${filename}.${extension}`);

    closeLoading();
    closeModals();

    toast("Exportación generada", `Se descargó el archivo ${filename}.${extension}.`, "success");
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo exportar", error.message);
  }
}

function collectCurrentFilters() {
  return {
    page: State.page,
    userFilter: State.userFilter,
    permissionFilter: State.permissionFilter,
    catalogFilter: State.catalogFilter,
    slaRuleFilter: State.slaRuleFilter,
    integrationFilter: State.integrationFilter,
    auditFilter: State.auditFilter,
    backupFilter: State.backupFilter,
    searches: {
      userSearch: getValue("#userSearch"),
      catalogSearch: getValue("#catalogSearch"),
      slaRuleSearch: getValue("#slaRuleSearch"),
      integrationSearch: getValue("#integrationSearch"),
      adminAuditSearch: getValue("#adminAuditSearch"),
      backupSearch: getValue("#backupSearch")
    },
    indicators: {
      period: getValue("#adminIndicatorPeriod"),
      module: getValue("#adminIndicatorModule"),
      role: getValue("#adminIndicatorRole"),
      channel: getValue("#adminIndicatorChannel")
    }
  };
}

function collectCurrentSelection() {
  return {
    selectedUserIds: Array.from(State.selectedUserIds || []),
    selectedUserId: State.selectedUserId,
    selectedRoleId: State.selectedRoleId,
    selectedPermissionId: State.selectedPermissionId,
    selectedCatalogId: State.selectedCatalogId,
    selectedSlaRuleId: State.selectedSlaRuleId,
    selectedIntegrationId: State.selectedIntegrationId,
    selectedMetricId: State.selectedMetricId,
    selectedAuditId: State.selectedAuditId,
    selectedBackupId: State.selectedBackupId,
    selectedReportId: State.selectedReportId
  };
}

/* =========================================================
   OPCIONES DESDE BD
========================================================= */

async function loadPageOptions() {
  const endpoint = PAGE_OPTION_ENDPOINTS[State.page];
  if (!endpoint) return {};

  try {
    const response = await apiJson(endpoint);
    State.options = response.options || response.opciones || response;
    State.filters = response.filters || response.filtros || {};
    applyOptionsToCurrentPage();
    applyDynamicFiltersToCurrentPage();
    return State.options;
  } catch (error) {
    toast(
      "Opciones no disponibles",
      "Los desplegables no pudieron cargarse desde la base de datos. Revisa el endpoint de opciones.",
      "warning"
    );

    return {};
  }
}

function getOptionList(...keys) {
  for (const key of keys) {
    const value = State.options?.[key];
    if (Array.isArray(value)) return value;
  }

  return [];
}

function fillSelect(selector, items = [], placeholder = "Seleccionar") {
  const select = $(selector);
  if (!select) return;

  const normalized = items.map(normalizeOption);

  select.innerHTML = `
    <option value="">${esc(placeholder)}</option>
    ${normalized.map(item => `
      <option value="${esc(item.value)}" ${item.disabled ? "disabled" : ""}>
        ${esc(item.label)}
      </option>
    `).join("")}
  `;

  if (!normalized.length) {
    select.innerHTML = `<option value="">Sin datos desde BD</option>`;
  }
}

function applyOptionsToCurrentPage() {
  if (State.page === "admin-usuarios") {
    fillSelect("#userRole", getOptionList("roles", "roles_usuario"), "Seleccionar rol");
    fillSelect("#userArea", getOptionList("areas", "areas_responsables", "areas_derivacion"), "Seleccionar área");
    fillSelect("#userStatus", getOptionList("estados_usuario", "estados"), "Seleccionar estado");
    fillSelect("#userAccessType", getOptionList("tipos_acceso", "accesos"), "Seleccionar acceso");
    fillSelect("#newUserStatus", getOptionList("estados_usuario", "estados"), "Seleccionar estado");
    fillSelect("#bulkUserScope", getOptionList("alcances_accion_masiva", "alcances"), "Seleccionar alcance");
    fillSelect("#bulkUserAction", getOptionList("acciones_masivas_usuario", "acciones"), "Seleccionar acción");
  }

  if (State.page === "admin-roles-permisos") {
    fillSelect("#roleScope", getOptionList("alcances_rol", "alcances"), "Seleccionar alcance");
    fillSelect("#roleAccessLevel", getOptionList("niveles_acceso", "niveles"), "Seleccionar nivel");
    fillSelect("#roleStatus", getOptionList("estados_rol", "estados"), "Seleccionar estado");
  }

  if (State.page === "admin-catalogos") {
    fillSelect("#catalogItemType", getOptionList("tipos_catalogo", "catalogos"), "Seleccionar tipo");
    fillSelect("#catalogItemStatus", getOptionList("estados_catalogo", "estados"), "Seleccionar estado");
    fillSelect("#catalogItemDependency", getOptionList("dependencias_funcionales", "dependencias"), "Seleccionar dependencia");
    fillSelect("#newCatalogStatus", getOptionList("estados_catalogo", "estados"), "Seleccionar estado");
  }

  if (State.page === "admin-reglas-sla") {
    fillSelect("#slaRuleCaseType", getOptionList("tipos_caso", "tipos"), "Seleccionar tipo");
    fillSelect("#slaRulePriority", getOptionList("prioridades"), "Seleccionar prioridad");
    fillSelect("#slaRuleChannel", getOptionList("canales"), "Seleccionar canal");
    fillSelect("#slaRuleTime", getOptionList("tiempos_sla", "plazos_respuesta"), "Seleccionar tiempo");
    fillSelect("#slaRuleAlert", getOptionList("alertas_preventivas", "umbrales_alerta"), "Seleccionar alerta");
    fillSelect("#slaRuleArea", getOptionList("areas_responsables", "areas_derivacion"), "Seleccionar área");
    fillSelect("#slaRuleStatus", getOptionList("estados_regla_sla", "estados"), "Seleccionar estado");
  }

  if (State.page === "admin-indicadores-reportes") {
    fillSelect("#adminIndicatorPeriod", getOptionList("periodos"), "Seleccionar periodo");
    fillSelect("#adminIndicatorModule", getOptionList("modulos"), "Seleccionar módulo");
    fillSelect("#adminIndicatorRole", getOptionList("roles"), "Seleccionar rol");
    fillSelect("#adminIndicatorChannel", getOptionList("canales"), "Seleccionar canal");

    fillSelect("#adminReportType", getOptionList("tipos_reporte"), "Seleccionar tipo");
    fillSelect("#adminReportPeriod", getOptionList("periodos_reporte", "periodos"), "Seleccionar periodo");
    fillSelect("#adminReportFormat", getOptionList("formatos_reporte", "formatos_exportacion"), "Seleccionar formato");
    fillSelect("#adminReportScope", getOptionList("alcances_reporte", "alcances"), "Seleccionar alcance");
    fillSelect("#scheduleAdminReportFrequency", getOptionList("frecuencias_reporte", "frecuencias"), "Seleccionar frecuencia");
  }

  if (State.page === "admin-integraciones") {
    fillSelect("#integrationType", getOptionList("tipos_integracion"), "Seleccionar tipo");
    fillSelect("#integrationStatus", getOptionList("estados_integracion", "estados"), "Seleccionar estado");
    fillSelect("#integrationCriticality", getOptionList("criticidades"), "Seleccionar criticidad");
  }

  if (State.page === "admin-auditoria") {
    fillSelect("#adminAuditCompareModule", getOptionList("modulos_auditables", "modulos"), "Seleccionar módulo");
    fillSelect("#adminAuditCompareType", getOptionList("tipos_comparacion", "comparaciones"), "Seleccionar comparación");
  }

  if (State.page === "admin-respaldo") {
    fillSelect("#backupFrequency", getOptionList("frecuencias_respaldo", "frecuencias"), "Seleccionar frecuencia");
    fillSelect("#backupType", getOptionList("tipos_respaldo"), "Seleccionar tipo");
    fillSelect("#backupWindow", getOptionList("ventanas_horarias", "ventanas"), "Seleccionar ventana");
    fillSelect("#backupRetention", getOptionList("retenciones"), "Seleccionar retención");
    fillSelect("#restoreTestType", getOptionList("tipos_prueba_restauracion"), "Seleccionar prueba");
    fillSelect("#restoreEnvironment", getOptionList("ambientes_restauracion", "ambientes"), "Seleccionar ambiente");
  }

  if (State.page === "admin-configuracion-sistema") {
    fillSelect("#platformEnvironment", getOptionList("ambientes"), "Seleccionar ambiente");
    fillSelect("#sessionTimeout", getOptionList("timeouts_sesion"), "Seleccionar expiración");
    fillSelect("#failedAttempts", getOptionList("intentos_fallidos"), "Seleccionar intentos");
    fillSelect("#mfaPolicy", getOptionList("politicas_mfa"), "Seleccionar MFA");
    fillSelect("#passwordPolicy", getOptionList("politicas_password"), "Seleccionar política");
    fillSelect("#maintenanceMode", getOptionList("modos_mantenimiento"), "Seleccionar modo");
    fillSelect("#maintenanceWindow", getOptionList("ventanas_mantenimiento"), "Seleccionar ventana");
  }
}

function applyDynamicFiltersToCurrentPage() {
  if (State.page === "admin-catalogos") {
    renderDynamicChips("#catalogFilters", State.filters.catalogos || State.options.tipos_catalogo, "catalog-filter", value => {
      State.catalogFilter = value;
      renderCatalogsPage();
    });
  }

  if (State.page === "admin-reglas-sla") {
    renderDynamicChips("#slaRuleFilters", State.filters.sla || State.options.filtros_sla, "sla-rule-filter", value => {
      State.slaRuleFilter = value;
      renderSlaRulesPage();
    });
  }

  if (State.page === "admin-integraciones") {
    renderDynamicChips("#integrationFilters", State.filters.integraciones || State.options.filtros_integracion, "integration-filter", value => {
      State.integrationFilter = value;
      renderIntegrationsPage();
    });
  }

  if (State.page === "admin-auditoria") {
    renderDynamicChips("#adminAuditFilters", State.filters.auditoria || State.options.modulos_auditables, "admin-audit-filter", value => {
      State.auditFilter = value;
      State.audit = [];
      renderAdminAuditPage();
    });
  }

  if (State.page === "admin-respaldo") {
    renderDynamicChips("#backupFilters", State.filters.respaldo || State.options.estados_respaldo, "backup-filter", value => {
      State.backupFilter = value;
      renderBackupPage();
    });
  }
}

function renderDynamicChips(selector, items, dataName, onClick) {
  const box = $(selector);
  if (!box || !Array.isArray(items) || !items.length) return;

  const normalized = [
    { value: "todos", label: "Todos" },
    ...items.map(normalizeOption)
  ];

  box.innerHTML = normalized.map((item, index) => `
    <button type="button" class="filter-chip ${index === 0 ? "active" : ""}" data-${dataName}="${esc(item.value)}">
      ${esc(item.label)}
    </button>
  `).join("");

  $$(`[data-${dataName}]`, box).forEach(button => {
    button.addEventListener("click", () => {
      $$(`[data-${dataName}]`, box).forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      onClick?.(button.getAttribute(`data-${dataName}`));
    });
  });
}

/* =========================================================
   UI BASE / SESIÓN
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  injectGlobalAdminModals();
  applyTheme(State.theme);
  setupBaseUI();
  setupGlobalEvents();
  setupSearch();
  setupBot();
  setupGlobalExportEvents();

  if (!requireAdminSession()) return;

  setupUserFromStorage();

  try {
    await loadShellData();
  } catch (error) {
    toast("Sesión administrativa", error.message, "warning");
  }

  await loadPageOptions();

  if (State.page === "admin-dashboard") await initDashboard();
  if (State.page === "admin-usuarios") await initUsers();
  if (State.page === "admin-roles-permisos") await initRolesPermissions();
  if (State.page === "admin-catalogos") await initCatalogs();
  if (State.page === "admin-reglas-sla") await initSlaRules();
  if (State.page === "admin-indicadores-reportes") await initAdminIndicatorsReports();
  if (State.page === "admin-integraciones") await initIntegrations();
  if (State.page === "admin-auditoria") await initAdminAudit();
  if (State.page === "admin-respaldo") await initBackup();
  if (State.page === "admin-configuracion-sistema") await initSystemConfig();
});

function setupUserFromStorage() {
  const user = State.currentUser || getStoredUser();
  const name = user.nombre || user.username || "Administrador";

  setText("#userNameTop", name);
  setText("#userRoleTop", "Administrador del sistema");
  setText("#userAvatar", initials(name));
}

async function loadShellData() {
  const response = await apiJson("/admin/me");

  State.admin = response.admin || response.user || response;
  const name = State.admin.nombre || State.admin.name || State.admin.username || "Administrador";

  setText("#userNameTop", name);
  setText("#userRoleTop", State.admin.cargo || State.admin.role || "Administrador del sistema");
  setText("#userAvatar", State.admin.initials || State.admin.iniciales || initials(name));

  await updateGlobalBadges();
}

async function updateGlobalBadges() {
  try {
    const response = await apiJson("/admin/resumen");

    setText("#sidebarUserCount", response.usuarios_activos ?? response.active_users ?? 0);
    setText("#sidebarIntegrationAlerts", response.integraciones_alerta ?? response.integration_alerts ?? 0);
    setText("#notificationBadge", response.alertas ?? response.alerts ?? 0);
  } catch {
    setText("#sidebarUserCount", "0");
    setText("#sidebarIntegrationAlerts", "0");
    setText("#notificationBadge", "0");
  }
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
    toast("Tema actualizado", `Se activó el modo ${State.theme === "dark" ? "oscuro" : "claro"}.`, "success");
  });

  $("#userMenuButton")?.addEventListener("click", event => {
    event.stopPropagation();
    $("#userMenuDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    $("#userMenuDropdown")?.classList.remove("open");
  });

  $("#logoutBtn")?.addEventListener("click", requestLogout);
  $("#logoutDropdownBtn")?.addEventListener("click", requestLogout);
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-admin-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");

  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

async function requestLogout() {
  const result = await confirmAction({
    icon: "↩",
    title: "Cerrar sesión",
    text: "Se cerrará tu sesión administrativa y volverás al login.",
    requireReason: false,
    requireCheckbox: true,
    checkboxText: "Confirmo que deseo cerrar sesión.",
    confirmText: "Cerrar sesión"
  });

  if (!result.confirmed) return;

  clearSession();
  toast("Sesión cerrada", "Serás redirigido al login.", "success");

  setTimeout(() => {
    window.location.href = "../login.html?role=admin";
  }, 650);
}

/* =========================================================
   EVENTOS GLOBALES
========================================================= */

function setupGlobalEvents() {
  document.addEventListener("click", event => {
    if (event.target.closest("[data-close-modal]")) closeModals();
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

function setupGlobalExportEvents() {
  $("#confirmExportBtn")?.addEventListener("click", confirmExport);
}

/* =========================================================
   NORMALIZADORES
========================================================= */

function normalizeUser(item = {}) {
  const name =
    item.name ||
    item.nombre ||
    item.nombre_completo ||
    item.username ||
    item.correo ||
    "Usuario";

  const role = item.role || item.rol || item.nombre_rol || "Sin rol";
  const status = item.status || item.estado || "Activo";

  return {
    id: item.id || item.usuario_id || item.user_id,
    initials: item.initials || item.iniciales || initials(name),
    name,
    email: item.email || item.correo || "",
    role,
    roleId: item.rol_id || item.role_id || null,
    area: item.area || item.area_nombre || "Sin área",
    areaId: item.area_id || null,
    status,
    accessType: item.accessType || item.tipo_acceso || item.acceso || "Acceso estándar",
    lastAccess: item.lastAccess || item.ultimo_acceso || item.fecha_ultimo_acceso || "-",
    createdAt: item.createdAt || item.fecha_creacion || "-",
    risk: item.risk || item.riesgo || (String(role).toLowerCase().includes("admin") ? "Alto" : "Medio"),
    activity: item.activity || item.actividad || 0,
    assignedCases: Number(item.assignedCases ?? item.casos_asignados ?? 0),
    raw: item
  };
}

function normalizeRole(item = {}) {
  const name = item.name || item.nombre || "Rol";

  return {
    id: item.id || item.rol_id || name,
    icon: item.icon || item.icono || "🔐",
    name,
    scope: item.scope || item.alcance || item.descripcion || "Sistema",
    accessLevel: item.accessLevel || item.nivel_acceso || item.nivel || name,
    status: item.status || item.estado || (item.activo === false ? "Inactivo" : "Activo"),
    users: Number(item.users ?? item.usuarios ?? item.cantidad_usuarios ?? 0),
    description: item.description || item.descripcion || "",
    sensitive: Boolean(item.sensitive ?? item.sensible ?? item.es_sensible),
    raw: item
  };
}

function normalizePermission(item = {}) {
  const roles = item.roles || item.permisos_por_rol || {};

  return {
    id: item.id || item.permiso_id || `${item.modulo || "modulo"}-${item.nombre || "permiso"}`,
    module: item.module || item.modulo || "Módulo",
    permission: item.permission || item.nombre || item.permiso || "Permiso",
    sensitive: Boolean(item.sensitive ?? item.sensible ?? item.es_sensible),
    description: item.description || item.descripcion || "",
    roles,
    cliente: Boolean(item.cliente ?? roles.cliente ?? roles.Cliente),
    asesor: Boolean(item.asesor ?? roles.asesor ?? roles.Asesor),
    supervisor: Boolean(item.supervisor ?? roles.supervisor ?? roles.Supervisor),
    administrador: Boolean(item.administrador ?? roles.administrador ?? roles.Administrador),
    raw: item
  };
}

function normalizeCatalog(item = {}) {
  const type = item.type || item.tipo || item.catalogo || "Catálogo";

  return {
    id: item.id || item.catalogo_id || item.item_id || item.codigo || item.nombre,
    icon: item.icon || item.icono || "🧩",
    name: item.name || item.nombre || "Elemento",
    type,
    filterType: item.filterType || item.tipo_filtro || String(type).toLowerCase(),
    status: item.status || item.estado || (item.activo === false ? "Inactivo" : "Activo"),
    usage: item.usage || item.uso || item.uso_funcional || "Uso funcional",
    dependency: item.dependency || item.dependencia || "-",
    updatedAt: item.updatedAt || item.fecha_actualizacion || item.fecha_creacion || "-",
    description: item.description || item.descripcion || "",
    activeDependencies: Number(item.activeDependencies ?? item.dependencias_activas ?? 0),
    raw: item
  };
}

function normalizeSlaRule(item = {}) {
  return {
    id: item.id || item.sla_id || item.regla_sla_id || item.codigo || item.nombre,
    icon: item.icon || item.icono || "⏱️",
    name: item.name || item.nombre || "Regla SLA",
    caseType: item.caseType || item.tipo_caso || "Todos",
    priority: item.priority || item.prioridad || "Media",
    channel: item.channel || item.canal || "Todos",
    time: item.time || item.tiempo || item.tiempo_sla || item.horas_sla || "-",
    slaMinutes: Number(item.slaMinutes ?? item.sla_minutos ?? item.tiempo_minutos ?? 0),
    alert: item.alert || item.alerta || item.umbral_alerta || "-",
    alertMinutes: Number(item.alertMinutes ?? item.alerta_minutos_antes ?? item.alerta_minutos ?? 0),
    area: item.area || item.area_responsable || item.area_destino || "-",
    escalationArea: item.escalationArea || item.area_escalamiento || "-",
    status: item.status || item.estado || (item.activo === false ? "Inactivo" : "Activo"),
    startDate: item.startDate || item.fecha_inicio_vigencia || "-",
    endDate: item.endDate || item.fecha_fin_vigencia || "-",
    description: item.description || item.descripcion || "",
    raw: item
  };
}

function normalizeIntegration(item = {}) {
  return {
    id: item.id || item.integracion_id || item.codigo || item.nombre,
    icon: item.icon || item.icono || "🔌",
    name: item.name || item.nombre || "Integración",
    type: item.type || item.tipo || "API",
    filterType: item.filterType || item.tipo_filtro || String(item.type || item.tipo || "api").toLowerCase(),
    status: item.status || item.estado || "Activa",
    lastSync: item.lastSync || item.ultima_sincronizacion || item.fecha_ultima_sincronizacion || "-",
    owner: item.owner || item.responsable || item.responsable_tecnico || "Administración",
    criticality: item.criticality || item.criticidad || "Media",
    endpoint: item.endpoint || item.url || "-",
    environment: item.environment || item.ambiente || "-",
    lastCode: item.lastCode || item.codigo_http || "-",
    latency: item.latency || item.latencia_ms || "-",
    description: item.description || item.descripcion || "",
    raw: item
  };
}

function normalizeMetric(item = {}) {
  return {
    id: item.id || item.metric_id || item.indicador_id || item.title || item.titulo,
    icon: item.icon || item.icono || "📈",
    title: item.title || item.titulo || item.nombre || "Indicador",
    value: item.value ?? item.valor ?? 0,
    target: item.target ?? item.meta ?? "-",
    progress: Number(item.progress ?? item.avance ?? item.porcentaje ?? 0),
    status: item.status || item.estado_tipo || item.estado || "info",
    description: item.description || item.descripcion || "",
    cause: item.cause || item.causa || "",
    raw: item
  };
}

function normalizeReport(item = {}) {
  return {
    id: item.id || item.reporte_id || item.codigo || item.name || item.nombre,
    name: item.name || item.nombre || "Reporte",
    type: item.type || item.tipo || "Administrativo",
    period: item.period || item.periodo || "-",
    format: item.format || item.formato || "PDF",
    status: item.status || item.estado || "Generado",
    owner: item.owner || item.responsable || item.generado_por || "Administrador",
    createdAt: item.createdAt || item.fecha_creacion || item.fecha_generacion || "-",
    downloadUrl: item.downloadUrl || item.url_descarga || "",
    raw: item
  };
}

function normalizeAudit(item = {}) {
  const sensitivity = item.sensitivity || item.sensibilidad || (item.critical || item.critico ? "Crítica" : "Media");

  return {
    id: item.id || item.auditoria_id || item.historial_id || item.codigo,
    date: item.date || item.fecha || item.fecha_evento || "-",
    module: item.module || item.modulo || "Sistema",
    type: String(item.type || item.tipo || item.modulo || "general").toLowerCase(),
    action: item.action || item.accion || "Evento registrado",
    user: item.user || item.usuario || item.username || "Sistema",
    before: item.before || item.antes || item.valor_anterior || "-",
    after: item.after || item.despues || item.valor_nuevo || "-",
    result: item.result || item.resultado || "Exitoso",
    critical: Boolean(item.critical ?? item.critico ?? String(sensitivity).toLowerCase().includes("crítica")),
    sensitivity,
    ip: item.ip || item.ip_address || "-",
    origin: item.origin || item.origen || "-",
    entity: item.entity || item.entidad || item.entidad_afectada || "-",
    detail: item.detail || item.detalle || item.observacion || "",
    diff: item.diff || item.diferencias || [],
    raw: item
  };
}

function normalizeBackup(item = {}) {
  return {
    id: item.id || item.respaldo_id || item.codigo,
    date: item.date || item.fecha || item.fecha_ejecucion || "-",
    type: item.type || item.tipo || "Completo",
    status: item.status || item.estado || "Programado",
    size: item.size || item.tamano || item.tamano_estimado || "-",
    location: item.location || item.ubicacion || "-",
    validation: item.validation || item.validacion || "Pendiente",
    owner: item.owner || item.responsable || "Sistema",
    duration: item.duration || item.duracion || "-",
    rpo: item.rpo || "No definido",
    rto: item.rto || "No definido",
    hash: item.hash || item.codigo_integridad || "-",
    raw: item
  };
}

function normalizeAlert(item = {}) {
  return {
    id: item.id || item.alerta_id || item.codigo,
    icon: item.icon || item.icono || "⚠️",
    title: item.title || item.titulo || "Alerta",
    text: item.text || item.mensaje || item.descripcion || "",
    module: item.module || item.modulo || "Sistema",
    severity: item.severity || item.severidad || "Media",
    date: item.date || item.fecha || "-",
    action: item.action || item.accion || "Revisar",
    href: item.href || item.url || "auditoria.html",
    raw: item
  };
}

function getItem(list, id, normalizer) {
  return list.map(normalizer).find(item => String(item.id) === String(id)) || null;
}

/* =========================================================
   BUSCADOR GLOBAL
========================================================= */

function setupSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);
  $("#closeSearchBtn")?.addEventListener("click", closeSearch);
  $("#globalSearchInput")?.addEventListener("input", debounce(renderSearch, 300));
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
    box.innerHTML = ADMIN_PAGES.map(([icon, title, text, href]) => `
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

  box.innerHTML = `
    <div class="loading-panel loading-panel--inline">
      <span class="spinner"></span>
      <strong>Buscando en el sistema...</strong>
    </div>
  `;

  try {
    const response = await apiJson(`/admin/search${buildQuery({ q, page: State.page })}`);
    const items = response.items || response.resultados || [];

    box.innerHTML = items.length
      ? items.map(item => {
          const href = sanitizeInternalHref(item.href || "#");

          return `
            <a href="${esc(href)}" class="search-result-item">
              <span>${esc(item.icon || "🔎")}</span>
              <div>
                <strong>${esc(item.title || item.titulo || "Resultado")}</strong>
                <small>${esc(item.text || item.descripcion || "")}</small>
              </div>
            </a>
          `;
        }).join("")
      : `<p class="muted">No se encontraron resultados.</p>`;
  } catch (error) {
    box.innerHTML = `<p class="muted">${esc(error.message)}</p>`;
  }
}

function sanitizeInternalHref(href) {
  const clean = String(href || "#");

  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("//")) {
    return "#";
  }

  return clean;
}

/* =========================================================
   ASISTENTE IA
========================================================= */

function setupBot() {
  $("#openBotSidebar")?.addEventListener("click", openBot);
  $("#openBotWelcome")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const prompt = getValue("#botInput");
    if (!prompt) return;

    setValue("#botInput", "");
    await askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach(button => {
    button.addEventListener("click", () => askBot(button.dataset.botPrompt || ""));
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

async function askBot(prompt) {
  openBot();
  addMessage(prompt, "user");

  const typing = document.createElement("div");
  typing.className = "message message--bot typing";
  typing.textContent = "Analizando información del sistema";
  $("#botMessages")?.appendChild(typing);

  try {
    const response = await apiJson("/admin/asistente", {
      method: "POST",
      body: JSON.stringify({
        page: State.page,
        prompt,
        selected_user_id: State.selectedUserId,
        selected_role_id: State.selectedRoleId,
        selected_catalog_id: State.selectedCatalogId,
        selected_sla_rule_id: State.selectedSlaRuleId,
        selected_integration_id: State.selectedIntegrationId,
        selected_metric_id: State.selectedMetricId,
        selected_audit_id: State.selectedAuditId,
        selected_backup_id: State.selectedBackupId,
        audit: true
      })
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
  $("#refreshCaseTrendBtn")?.addEventListener("click", renderDashboard);
  $("#caseTrendDetailBtn")?.addEventListener("click", () => openAdminMetricDetail(State.metrics[0]?.id));
  $("#refreshCaseStatusBtn")?.addEventListener("click", renderDashboard);
  $("#refreshAdminAlertsBtn")?.addEventListener("click", renderDashboard);

  $("#adminAlertResolveBtn")?.addEventListener("click", requestMarkSelectedAlertReviewed);

  $("#adminAlertGoBtn")?.addEventListener("click", () => {
    const alert = getItem(State.alerts, State.selectedAlertId, normalizeAlert);
    if (alert?.href) window.location.href = sanitizeInternalHref(alert.href);
  });

  $("#adminMetricAiBtn")?.addEventListener("click", () => askBot("Analiza la métrica seleccionada"));
}

async function renderDashboard() {
  try {
    const response = await apiJson("/admin/dashboard");

    State.users = response.users || response.usuarios || [];
    State.integrations = response.integrations || response.integraciones || [];
    State.metrics = response.metrics || response.indicadores || [];
    State.alerts = response.alerts || response.alertas || [];
    State.audit = response.audit || response.auditoria || [];
    State.backups = response.backups || response.respaldos || [];

    setText("#adminSystemStatus", response.system_status || response.estado_sistema || "Sistema operativo");
    setText(
      "#adminLastUpdate",
      response.last_update || response.ultima_actualizacion
        ? `Última actualización: ${formatDate(response.last_update || response.ultima_actualizacion)}`
        : "Última actualización pendiente"
    );

    renderKpis("#adminDashboardKpiGrid", response.kpis || []);

    renderBarChart("#adminCasesTrendChart", response.case_trend || response.tendencia_casos || []);
    renderDonut("#caseStatusDonut", "#caseStatusLegend", response.case_status || response.estado_casos || [], "Casos");
    renderBarChart("#roleActivityChart", response.role_activity || response.actividad_roles || []);

    renderDashboardIntegrations();
    renderDashboardAlerts();
    renderActivity("#adminAuditTimeline", State.audit.map(normalizeAudit).slice(0, 6).map(a => ({
      icon: a.critical ? "⚠️" : "🕵️",
      title: `${a.action} · ${a.module}`,
      text: `${a.before} → ${a.after}. ${a.detail}`,
      date: a.date
    })));

    renderDashboardBackup();

    renderAi("#adminDashboardAiSummary", response.ai_summary || []);
    renderChecklist("#adminActionPlan", response.action_plan || []);

    await updateGlobalBadges();
  } catch (error) {
    renderAi("#adminDashboardAiSummary", [{ title: "No se pudo cargar dashboard", text: error.message }]);
  }
}

function renderDashboardIntegrations() {
  const rows = State.integrations.map(normalizeIntegration);

  setHTML("#integrationStatusGrid", rows.map(item => `
    <article class="integration-status-item">
      <span class="integration-status-item__icon">${esc(item.icon)}</span>
      <div>
        <strong>${esc(item.name)}</strong>
        <p>${esc(item.type)} · ${esc(formatDate(item.lastSync))}</p>
      </div>
      <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
    </article>
  `).join(""));

  show($("#emptyIntegrationsState"), !rows.length);
}

function renderDashboardAlerts() {
  const alerts = State.alerts.map(normalizeAlert);

  setHTML("#adminAlertList", alerts.map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">${esc(item.icon)}</span>
      <div>
        <strong>${esc(item.title)}</strong>
        <p>${esc(item.text)}</p>
        <small>${esc(formatDate(item.date))} · Severidad ${esc(item.severity)}</small>
      </div>
      <button type="button" data-admin-alert-id="${esc(item.id)}">Revisar</button>
    </article>
  `).join(""));

  show($("#emptyAdminAlertsState"), !alerts.length);

  $$("[data-admin-alert-id]").forEach(button => {
    button.addEventListener("click", () => openAdminAlert(button.dataset.adminAlertId));
  });
}

function openAdminAlert(id) {
  const item = getItem(State.alerts, id, normalizeAlert);
  if (!item) return;

  State.selectedAlertId = id;

  setText("#adminAlertModalIcon", item.icon);
  setText("#adminAlertModalTitle", item.title);
  setText("#adminAlertModalText", item.text);
  setHTML("#adminAlertModalSummary", summaryHTML([
    ["Módulo", item.module],
    ["Severidad", item.severity],
    ["Fecha", formatDate(item.date)],
    ["Acción sugerida", item.action],
    ["Destino", item.href]
  ]));

  openModal("#adminAlertModal");
}

async function requestMarkSelectedAlertReviewed() {
  if (!State.selectedAlertId) return;

  const alert = getItem(State.alerts, State.selectedAlertId, normalizeAlert);

  const confirmation = await confirmAction({
    icon: "⚠️",
    title: "Marcar alerta como revisada",
    text: "Esta acción registrará que la alerta fue atendida por el administrador.",
    impact: [
      { label: "Alerta", value: alert?.title || State.selectedAlertId, impact: "Auditable", level: "medium" },
      { label: "Módulo", value: alert?.module || "-", impact: "Seguimiento", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson(`/admin/alertas/${encodeURIComponent(State.selectedAlertId)}/revisar`, {
      method: "PATCH",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeModals();
    await renderDashboard();
    toast("Alerta revisada", "La alerta fue marcada como revisada.", "success");
  } catch (error) {
    genericModal("!", "No se pudo marcar alerta", error.message);
  }
}

function renderDashboardBackup() {
  const latest = State.backups.map(normalizeBackup)[0];

  setHTML("#backupSummary", latest ? `
    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">💾</span>
      <div>
        <strong>Último respaldo</strong>
        <p>${esc(formatDate(latest.date))} · ${esc(latest.type)} · ${esc(latest.validation)}</p>
      </div>
    </article>

    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">📌</span>
      <div>
        <strong>Estado</strong>
        <p>${esc(latest.status)} · ${esc(latest.size)}</p>
      </div>
    </article>
  ` : `
    <article class="backup-summary-item">
      <span class="backup-summary-item__icon">💾</span>
      <div>
        <strong>Sin respaldo registrado</strong>
        <p>No se recibió historial de respaldo desde la base de datos.</p>
      </div>
    </article>
  `);
}

/* =========================================================
   USUARIOS
========================================================= */

async function initUsers() {
  bindUsersEvents();
  await renderUsersPage();
}

function bindUsersEvents() {
  $("#userSearch")?.addEventListener("input", debounce(() => {
    State.pagination.users.page = 1;
    renderUsersPage();
  }, 300));

  $$("[data-user-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.userFilter = button.dataset.userFilter || "todos";
      State.pagination.users.page = 1;
      $$("[data-user-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderUsersPage();
    });
  });

  $("#toggleUsersViewBtn")?.addEventListener("click", () => {
    State.usersView = State.usersView === "cards" ? "table" : "cards";
    setText("#toggleUsersViewBtn", State.usersView === "cards" ? "Vista tabla" : "Vista cards");
    renderUsersPage();
  });

  $("#refreshUsersBtn")?.addEventListener("click", async () => {
    State.users = [];
    await renderUsersPage();
  });

  $("#refreshUsersByRoleBtn")?.addEventListener("click", renderUsersPage);
  $("#refreshUserStatusChartBtn")?.addEventListener("click", renderUsersPage);
  $("#openCreateUserBtn")?.addEventListener("click", openCreateUserModal);
  $("#exportUsersBtn")?.addEventListener("click", () => openExportModal("usuarios"));

  $("#bulkUserActionBtn")?.addEventListener("click", () => {
    if (!State.selectedUserIds.size) {
      toast("Sin selección", "Selecciona al menos un usuario para ejecutar una acción masiva.", "warning");
      return;
    }

    openModal("#bulkUserActionModal");
  });

  $("#confirmBulkUserActionBtn")?.addEventListener("click", confirmBulkUserAction);
  $("#saveUserBtn")?.addEventListener("click", requestSaveUser);
  $("#suggestUserRoleBtn")?.addEventListener("click", suggestUserRole);
  $("#userEditBtn")?.addEventListener("click", () => { closeModals(); openEditUserModal(State.selectedUserId); });
  $("#userResetAccessBtn")?.addEventListener("click", () => { closeModals(); openResetAccessModal(State.selectedUserId); });
  $("#userToggleStatusBtn")?.addEventListener("click", () => { closeModals(); openChangeUserStatusModal(State.selectedUserId); });
  $("#userAuditBtn")?.addEventListener("click", () => { window.location.href = `auditoria.html?usuario=${encodeURIComponent(State.selectedUserId || "")}`; });
  $("#confirmResetAccessBtn")?.addEventListener("click", confirmResetAccess);
  $("#confirmChangeUserStatusBtn")?.addEventListener("click", confirmChangeUserStatus);
}

async function loadUsers() {
  const p = State.pagination.users;

  const response = await apiJson(`/admin/usuarios${buildQuery({
    q: getValue("#userSearch"),
    filtro: State.userFilter,
    page: p.page,
    page_size: p.pageSize
  })}`);

  State.users = response.items || response.users || response.usuarios || [];
  p.total = Number(response.total ?? State.users.length);

  return State.users;
}

function usersFiltered() {
  const query = getValue("#userSearch").toLowerCase();

  return State.users.map(normalizeUser).filter(user => {
    const text = `${user.name} ${user.email} ${user.role} ${user.area} ${user.status} ${user.lastAccess}`.toLowerCase();
    const filter = State.userFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "activos" && user.status === "Activo") ||
      (filter === "bloqueados" && user.status === "Bloqueado") ||
      (filter === "inactivos" && user.status === "Inactivo") ||
      (filter === "asesores" && String(user.role).toLowerCase().includes("asesor")) ||
      (filter === "supervisores" && String(user.role).toLowerCase().includes("supervisor")) ||
      (filter === "admins" && String(user.role).toLowerCase().includes("admin"));

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderUsersPage() {
  try {
    await loadUsers();

    const rows = usersFiltered();
    const all = State.users.map(normalizeUser);

    setText("#usersSummaryTitle", `${all.filter(u => u.status === "Activo").length} usuarios activos`);
    setText("#usersSummaryText", `${rows.length} usuarios visibles según filtro.`);

    renderKpis("#usersKpiGrid", [
      { icon: "👤", value: all.length, label: "Usuarios", description: "Total cargado" },
      { icon: "✅", value: all.filter(u => u.status === "Activo").length, label: "Activos", description: "Cuentas habilitadas" },
      { icon: "🔒", value: all.filter(u => u.status === "Bloqueado").length, label: "Bloqueados", description: "Requieren revisión" },
      { icon: "🕘", value: all.filter(u => u.status === "Inactivo").length, label: "Inactivos", description: "Sin actividad reciente" }
    ]);

    renderDonut("#usersByRoleDonut", "#usersByRoleLegend", Object.entries(countBy(all, "role")).map(([label, value]) => ({ label, value })), "Usuarios");
    renderBarChart("#userStatusChart", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })));

    setHTML("#usersCardList", rows.map(userCard).join(""));
    setHTML("#usersTableBody", rows.map(userTableRow).join(""));

    show($("#usersCardList"), State.usersView === "cards");
    show($("#usersTableWrap"), State.usersView === "table");
    show($("#emptyUsersState"), !rows.length);

    ensureTableFooter("#usersTableWrap", "users", renderUsersPage);

    renderAi("#usersAiSummary", [
      { title: "Control de accesos", text: "Revisa usuarios bloqueados, inactivos y cuentas con rol administrativo." },
      { title: "Trazabilidad", text: "Los cambios de rol, estado y acceso deben solicitar motivo y registrar auditoría." }
    ]);

    renderChecklist("#usersActionPlan", [
      { icon: "1", title: "Validar bloqueados", text: "Revisar motivo antes de reactivar cuentas." },
      { icon: "2", title: "Depurar inactivos", text: "Identificar cuentas sin uso reciente." },
      { icon: "3", title: "Revisar privilegios", text: "Confirmar que rol y área correspondan." }
    ]);

    bindUserActions($("#usersCardList"));
    bindUserActions($("#usersTableBody"));
  } catch (error) {
    renderAi("#usersAiSummary", [{ title: "No se pudieron cargar usuarios", text: error.message }]);
  }
}

function ensureTableFooter(tableWrapSelector, paginationKey, callback) {
  const wrap = $(tableWrapSelector);
  if (!wrap) return;

  let footer = wrap.nextElementSibling;
  if (!footer || !footer.classList.contains("table-footer-host")) {
    footer = document.createElement("div");
    footer.className = "table-footer-host";
    wrap.insertAdjacentElement("afterend", footer);
  }

  footer.id = `${paginationKey}PaginationHost`;
  renderTableFooter(`#${footer.id}`, paginationKey, callback);
}

function userCard(user) {
  const checked = State.selectedUserIds.has(String(user.id));

  return `
    <article class="user-card">
      <div class="user-card__top">
        <label class="row-select">
          <input type="checkbox" class="user-row-check" data-user-id="${esc(user.id)}" ${checked ? "checked" : ""}>
          <span></span>
        </label>
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
        <span>Último acceso: ${esc(formatDate(user.lastAccess))}</span>
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
  const checked = State.selectedUserIds.has(String(user.id));

  return `
    <tr>
      <td>
        <label class="table-select">
          <input type="checkbox" class="user-row-check" data-user-id="${esc(user.id)}" ${checked ? "checked" : ""}>
          <span></span>
        </label>
        <strong>${esc(user.name)}</strong>
      </td>
      <td>${esc(user.email)}</td>
      <td>${esc(user.role)}</td>
      <td>${esc(user.area)}</td>
      <td><span class="${pillClass(statusType(user.status))}">${esc(user.status)}</span></td>
      <td>${esc(formatDate(user.lastAccess))}</td>
      <td>
        <button type="button" data-action="view-user" data-user-id="${esc(user.id)}">Ver</button>
        <button type="button" data-action="edit-user" data-user-id="${esc(user.id)}">Editar</button>
        <button type="button" data-action="status-user" data-user-id="${esc(user.id)}">Estado</button>
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

  $$(".user-row-check", root).forEach(input => {
    input.addEventListener("change", () => {
      const id = String(input.dataset.userId);

      if (input.checked) State.selectedUserIds.add(id);
      else State.selectedUserIds.delete(id);

      setText("#bulkUserActionBtn", State.selectedUserIds.size ? `Acción masiva (${State.selectedUserIds.size})` : "Acción masiva");
    });
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
    ["Último acceso", formatDate(user.lastAccess)],
    ["Casos asignados", user.assignedCases],
    ["Riesgo", user.risk]
  ]);
}

function openUserDetail(id) {
  const user = getItem(State.users, id, normalizeUser);
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

  ["#userFullName", "#userEmail", "#userComment"].forEach(selector => setValue(selector, ""));
  ["#userRole", "#userArea", "#userStatus", "#userAccessType"].forEach(selector => setValue(selector, ""));
  setChecked("#userFormDeclaration", false);

  openModal("#userFormModal");
}

function openEditUserModal(id) {
  const user = getItem(State.users, id, normalizeUser);
  if (!user) return;

  State.selectedUserId = id;

  setText("#userFormEyebrow", "Editar usuario");
  setText("#userFormTitle", user.name);
  setText("#userFormText", "Modifica los datos administrativos de la cuenta seleccionada.");

  setValue("#userFullName", user.name);
  setValue("#userEmail", user.email);
  setValue("#userRole", user.roleId || user.role);
  setValue("#userArea", user.areaId || user.area);
  setValue("#userStatus", user.status);
  setValue("#userAccessType", user.accessType);
  setValue("#userComment", "");
  setChecked("#userFormDeclaration", false);

  openModal("#userFormModal");
}

async function suggestUserRole() {
  const area = getValue("#userArea");

  try {
    const response = await apiJson(`/admin/usuarios/sugerir-rol${buildQuery({ area })}`);

    setValue("#userRole", response.rol_id || response.rol || response.role || "");
    setValue("#userAccessType", response.tipo_acceso || response.access_type || "");

    toast("Rol sugerido", "El backend devolvió una propuesta de rol y acceso.", "success");
  } catch {
    toast("Sugerencia no disponible", "No se pudo obtener sugerencia desde backend.", "warning");
  }
}

function collectUserPayload() {
  return {
    nombre: getValue("#userFullName"),
    correo: getValue("#userEmail"),
    rol: getValue("#userRole"),
    area: getValue("#userArea"),
    estado: getValue("#userStatus"),
    tipo_acceso: getValue("#userAccessType"),
    comentario: getValue("#userComment")
  };
}

async function requestSaveUser() {
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

  const current = State.selectedUserId ? getItem(State.users, State.selectedUserId, normalizeUser) : null;
  const payload = collectUserPayload();

  const confirmation = await confirmAction({
    icon: State.selectedUserId ? "👤" : "➕",
    title: State.selectedUserId ? "Confirmar actualización de usuario" : "Confirmar creación de usuario",
    text: "Esta acción modificará información administrativa de acceso y quedará registrada en auditoría.",
    warning: "Verifica que el rol, área y tipo de acceso sean correctos.",
    impact: [
      { label: "Usuario", value: payload.nombre, impact: State.selectedUserId ? "Actualización" : "Nuevo", level: "medium" },
      { label: "Rol", value: current ? `${current.role} → ${payload.rol}` : payload.rol, impact: "Acceso", level: "high" },
      { label: "Estado", value: current ? `${current.status} → ${payload.estado}` : payload.estado, impact: "Operativo", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;

  await confirmSaveUser(payload);
}

async function confirmSaveUser(payload) {
  const endpoint = State.selectedUserId
    ? `/admin/usuarios/${encodeURIComponent(State.selectedUserId)}`
    : "/admin/usuarios";

  const method = State.selectedUserId ? "PUT" : "POST";

  try {
    await apiJson(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    closeModals();
    State.users = [];
    await renderUsersPage();
    await updateGlobalBadges();
    toast("Usuario guardado", "La cuenta fue registrada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar usuario", error.message);
  }
}

function openResetAccessModal(id) {
  const user = getItem(State.users, id, normalizeUser);
  if (!user) return;

  State.selectedUserId = id;
  setHTML("#resetAccessSummary", userSummary(user));
  setChecked("#resetAccessDeclaration", false);
  openModal("#resetAccessModal");
}

async function confirmResetAccess() {
  if (!State.selectedUserId) return;

  if (!isChecked("#resetAccessDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar el restablecimiento de acceso.", "warning");
    return;
  }

  const user = getItem(State.users, State.selectedUserId, normalizeUser);

  const confirmation = await confirmAction({
    icon: "🔑",
    title: "Confirmar restablecimiento de acceso",
    text: "Se generará un nuevo proceso de acceso para el usuario seleccionado.",
    impact: [
      { label: "Usuario", value: user?.name || State.selectedUserId, impact: "Acceso", level: "high" },
      { label: "Correo", value: user?.email || "-", impact: "Notificación", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson(`/admin/usuarios/${encodeURIComponent(State.selectedUserId)}/reset-acceso`, {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeModals();
    toast("Acceso restablecido", "Se generó el restablecimiento de acceso.", "success");
  } catch (error) {
    genericModal("!", "No se pudo restablecer acceso", error.message);
  }
}

function openChangeUserStatusModal(id) {
  const user = getItem(State.users, id, normalizeUser);
  if (!user) return;

  State.selectedUserId = id;
  setHTML("#changeUserStatusSummary", userSummary(user));
  setValue("#newUserStatus", "");
  setValue("#changeUserStatusReason", "");
  setChecked("#changeUserStatusDeclaration", false);
  openModal("#changeUserStatusModal");
}

async function confirmChangeUserStatus() {
  if (!State.selectedUserId) return;

  if (!getValue("#newUserStatus") || !getValue("#changeUserStatusReason") || !isChecked("#changeUserStatusDeclaration")) {
    toast("Faltan datos", "Completa nuevo estado, motivo y confirmación.", "warning");
    return;
  }

  const user = getItem(State.users, State.selectedUserId, normalizeUser);
  const newStatus = getValue("#newUserStatus");

  const confirmation = await confirmAction({
    icon: "🔐",
    title: "Confirmar cambio de estado",
    text: "Cambiar el estado puede afectar el acceso del usuario y su operación.",
    warning: user?.assignedCases ? "El usuario tiene casos asignados. Valida reasignación si corresponde." : "",
    impact: [
      { label: "Usuario", value: user?.name || State.selectedUserId, impact: "Cuenta", level: "medium" },
      { label: "Estado", value: `${user?.status || "-"} → ${newStatus}`, impact: "Acceso", level: "high" },
      { label: "Casos asignados", value: user?.assignedCases || 0, impact: "Impacto operativo", level: user?.assignedCases ? "high" : "low" }
    ],
    requireReason: false,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson(`/admin/usuarios/${encodeURIComponent(State.selectedUserId)}/estado`, {
      method: "PATCH",
      body: JSON.stringify({
        estado: newStatus,
        motivo: getValue("#changeUserStatusReason")
      })
    });

    closeModals();
    State.users = [];
    await renderUsersPage();
    await updateGlobalBadges();
    toast("Estado actualizado", "El cambio quedó registrado en auditoría.", "success");
  } catch (error) {
    genericModal("!", "No se pudo cambiar estado", error.message);
  }
}

async function confirmBulkUserAction() {
  if (!getValue("#bulkUserScope") || !getValue("#bulkUserAction") || !isChecked("#bulkUserDeclaration")) {
    toast("Faltan datos", "Selecciona alcance, acción y confirmación.", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "👥",
    title: "Confirmar acción masiva",
    text: "Esta acción puede modificar varias cuentas y quedará auditada.",
    impact: [
      { label: "Usuarios seleccionados", value: State.selectedUserIds.size, impact: "Masivo", level: "high" },
      { label: "Acción", value: getValue("#bulkUserAction"), impact: "Administrativo", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/usuarios/accion-masiva", {
      method: "POST",
      body: JSON.stringify({
        alcance: getValue("#bulkUserScope"),
        accion: getValue("#bulkUserAction"),
        usuarios_ids: Array.from(State.selectedUserIds),
        motivo: confirmation.reason
      })
    });

    closeModals();
    State.selectedUserIds.clear();
    State.users = [];
    await renderUsersPage();
    toast("Acción registrada", "La acción masiva fue registrada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo registrar acción masiva", error.message);
  }
}

/* =========================================================
   ROLES Y PERMISOS
========================================================= */

async function initRolesPermissions() {
  bindRolesEvents();
  await renderRolesPermissionsPage();
}

function bindRolesEvents() {
  $("#permissionSearch")?.addEventListener("input", debounce(renderPermissionMatrix, 250));

  $$("[data-permission-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.permissionFilter = button.dataset.permissionFilter || "todos";
      $$("[data-permission-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderPermissionMatrix();
    });
  });

  $("#openCreateRoleBtn")?.addEventListener("click", openCreateRoleModal);
  $("#savePermissionMatrixBtn")?.addEventListener("click", requestSavePermissionMatrix);
  $("#refreshPermissionMatrixBtn")?.addEventListener("click", renderRolesPermissionsPage);
  $("#resetPermissionMatrixBtn")?.addEventListener("click", requestResetPermissionMatrix);
  $("#exportPermissionMatrixBtn")?.addEventListener("click", () => openExportModal("permisos"));
  $("#refreshRolesChartBtn")?.addEventListener("click", renderRolesPermissionsPage);
  $("#refreshRoleCardsBtn")?.addEventListener("click", renderRolesPermissionsPage);
  $("#exportRolesBtn")?.addEventListener("click", () => openExportModal("roles"));
  $("#saveRoleBtn")?.addEventListener("click", requestSaveRole);
  $("#confirmSavePermissionMatrixBtn")?.addEventListener("click", confirmSavePermissionMatrix);
  $("#suggestRolePermissionsBtn")?.addEventListener("click", suggestRolePermissions);
  $("#editPermissionBtn")?.addEventListener("click", () => toast("Edición de permiso", "La edición de permisos se realizará desde la matriz.", "info"));
  $("#permissionAuditBtn")?.addEventListener("click", () => {
    window.location.href = `auditoria.html?permiso=${encodeURIComponent(State.selectedPermissionId || "")}`;
  });
}

async function loadRolesPermissions() {
  const response = await apiJson("/admin/roles-permisos");

  State.roles = response.roles || response.roles_items || [];
  State.permissions = response.permissions || response.permisos || [];

  return response;
}

async function renderRolesPermissionsPage() {
  try {
    await loadRolesPermissions();

    const roles = State.roles.map(normalizeRole);
    const permissions = State.permissions.map(normalizePermission);

    setText("#rolesSummaryTitle", `${roles.length} roles configurados`);
    setText("#rolesSummaryText", `${permissions.length} permisos administrables.`);

    renderKpis("#rolesKpiGrid", [
      { icon: "🔐", value: roles.length, label: "Roles", description: "Perfiles configurados" },
      { icon: "🧩", value: permissions.length, label: "Permisos", description: "Acciones disponibles" },
      { icon: "⚠️", value: permissions.filter(p => p.sensitive).length, label: "Sensibles", description: "Requieren control" },
      { icon: "👤", value: roles.reduce((sum, r) => sum + r.users, 0), label: "Usuarios", description: "Asignados a roles" }
    ]);

    renderBarChart("#rolesUsersChart", roles.map(r => ({ label: r.name, value: r.users })));
    renderPermissionRisk();
    renderPermissionMatrix();
    renderRoleCards();

    renderAi("#rolesAiSummary", [
      { title: "Permisos sensibles", text: "Controla gestión de usuarios, configuración global, auditoría y reportes." },
      { title: "Mínimo privilegio", text: "Cada rol debe tener solo permisos necesarios para su función." }
    ]);

    renderChecklist("#rolesActionPlan", [
      { icon: "1", title: "Validar sensibles", text: "Confirmar restricciones de permisos críticos." },
      { icon: "2", title: "Revisar roles activos", text: "Evitar roles sin propósito funcional." },
      { icon: "3", title: "Guardar con sustento", text: "Todo cambio debe tener motivo y auditoría." }
    ]);
  } catch (error) {
    renderAi("#rolesAiSummary", [{ title: "No se pudieron cargar roles", text: error.message }]);
  }
}

function renderPermissionRisk() {
  const sensitive = State.permissions.map(normalizePermission).filter(p => p.sensitive);

  setHTML("#permissionRiskList", sensitive.slice(0, 6).map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">⚠️</span>
      <div>
        <strong>${esc(item.permission)}</strong>
        <p>${esc(item.module)} · ${esc(item.description)}</p>
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

  return State.permissions.map(normalizePermission).filter(item => {
    const text = `${item.module} ${item.permission} ${item.description}`.toLowerCase();
    const filter = State.permissionFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "cliente" && item.cliente) ||
      (filter === "asesor" && item.asesor) ||
      (filter === "supervisor" && item.supervisor) ||
      (filter === "administrador" && item.administrador) ||
      (filter === "sensibles" && item.sensitive);

    return (!query || text.includes(query)) && matchesFilter;
  });
}

function renderPermissionMatrix() {
  const rows = permissionFiltered();
  const roles = State.roles.map(normalizeRole);

  const tbody = $("#permissionMatrixBody");
  if (!tbody) return;

  const table = tbody.closest("table");
  const header = table?.querySelector("thead tr");

  if (header && roles.length) {
    header.innerHTML = `
      <th>Módulo / permiso</th>
      ${roles.map(role => `<th>${esc(role.name)}</th>`).join("")}
      <th>Detalle</th>
    `;
  }

  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>
        <strong>${esc(item.module)}</strong>
        <small>${esc(item.permission)}</small>
        ${item.sensitive ? `<span class="status-pill status-pill--danger">Sensible</span>` : ""}
      </td>
      ${roles.map(role => {
        const key = role.id;
        const roleName = role.name;
        const active = Boolean(
          item.roles?.[key] ??
          item.roles?.[roleName] ??
          item.roles?.[String(roleName).toLowerCase()] ??
          item[String(roleName).toLowerCase()]
        );

        return `
          <td>
            <button
              type="button"
              class="permission-toggle ${active ? "is-on" : ""}"
              data-permission="${esc(item.id)}"
              data-role="${esc(role.id)}"
              data-role-name="${esc(role.name)}"
              aria-label="Cambiar permiso ${esc(item.permission)} para ${esc(role.name)}">
            </button>
          </td>
        `;
      }).join("")}
      <td>
        <button type="button" class="permission-detail-btn" data-permission-detail="${esc(item.id)}">Detalle</button>
      </td>
    </tr>
  `).join("");

  show($("#emptyPermissionState"), !rows.length);

  $$(".permission-toggle", tbody).forEach(button => {
    button.addEventListener("click", async () => {
      const permission = getItem(State.permissions, button.dataset.permission, normalizePermission);

      if (permission?.sensitive && !button.classList.contains("is-on")) {
        const confirmation = await confirmAction({
          icon: "⚠️",
          title: "Activar permiso sensible",
          text: "Estás habilitando un permiso sensible para un rol. Esta acción requiere sustento.",
          impact: [
            { label: "Permiso", value: permission.permission, impact: "Sensible", level: "high" },
            { label: "Rol", value: button.dataset.roleName, impact: "Acceso", level: "high" }
          ],
          requireReason: true,
          requireCheckbox: true
        });

        if (!confirmation.confirmed) return;
        button.dataset.reason = confirmation.reason;
      }

      button.classList.toggle("is-on");
    });
  });

  $$("[data-permission-detail]", tbody).forEach(button => {
    button.addEventListener("click", () => openPermissionDetail(button.dataset.permissionDetail));
  });
}

function openPermissionDetail(id) {
  const item = getItem(State.permissions, id, normalizePermission);
  if (!item) return;

  State.selectedPermissionId = id;

  setText("#permissionDetailIcon", item.sensitive ? "⚠️" : "🔐");
  setText("#permissionDetailTitle", item.permission);
  setText("#permissionDetailText", item.description);
  setHTML("#permissionDetailSummary", summaryHTML([
    ["Módulo", item.module],
    ["Sensible", item.sensitive ? "Sí" : "No"],
    ["Cliente", item.cliente ? "Sí" : "No"],
    ["Asesor", item.asesor ? "Sí" : "No"],
    ["Supervisor", item.supervisor ? "Sí" : "No"],
    ["Administrador", item.administrador ? "Sí" : "No"]
  ]));

  openModal("#permissionDetailModal");
}

function renderRoleCards() {
  const roles = State.roles.map(normalizeRole);

  setHTML("#roleCardGrid", roles.map(role => `
    <article class="role-card">
      <span class="role-card__icon">${esc(role.icon)}</span>
      <div>
        <h3>${esc(role.name)}</h3>
        <p>${esc(role.description)}</p>
        <small>${esc(role.scope)} · ${esc(role.accessLevel)} · ${esc(role.users)} usuario(s)</small>
      </div>
      <span class="${pillClass(statusType(role.status))}">${esc(role.status)}</span>
      <button type="button" data-role-id="${esc(role.id)}">Editar</button>
    </article>
  `).join(""));

  $$("[data-role-id]").forEach(button => {
    button.addEventListener("click", () => openEditRoleModal(button.dataset.roleId));
  });
}

function openCreateRoleModal() {
  State.selectedRoleId = null;

  setText("#roleFormEyebrow", "Nuevo rol");
  setText("#roleFormTitle", "Crear rol");
  setText("#roleFormText", "Completa información del perfil funcional.");

  ["#roleName", "#roleScope", "#roleAccessLevel", "#roleStatus", "#roleDescription"].forEach(selector => setValue(selector, ""));
  setChecked("#roleFormDeclaration", false);

  openModal("#roleFormModal");
}

function openEditRoleModal(id) {
  const role = getItem(State.roles, id, normalizeRole);
  if (!role) return;

  State.selectedRoleId = id;

  setText("#roleFormEyebrow", "Editar rol");
  setText("#roleFormTitle", role.name);
  setText("#roleFormText", "Modifica la configuración del rol seleccionado.");

  setValue("#roleName", role.name);
  setValue("#roleScope", role.scope);
  setValue("#roleAccessLevel", role.accessLevel);
  setValue("#roleStatus", role.status);
  setValue("#roleDescription", role.description);
  setChecked("#roleFormDeclaration", false);

  openModal("#roleFormModal");
}

function collectRolePayload() {
  return {
    nombre: getValue("#roleName"),
    alcance: getValue("#roleScope"),
    nivel_acceso: getValue("#roleAccessLevel"),
    estado: getValue("#roleStatus"),
    descripcion: getValue("#roleDescription")
  };
}

async function requestSaveRole() {
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

  const payload = collectRolePayload();
  const current = State.selectedRoleId ? getItem(State.roles, State.selectedRoleId, normalizeRole) : null;

  const confirmation = await confirmAction({
    icon: "🔐",
    title: State.selectedRoleId ? "Confirmar actualización de rol" : "Confirmar creación de rol",
    text: "Los cambios en roles afectan permisos y accesos del sistema.",
    impact: [
      { label: "Rol", value: payload.nombre, impact: State.selectedRoleId ? "Actualización" : "Nuevo", level: "medium" },
      { label: "Nivel", value: current ? `${current.accessLevel} → ${payload.nivel_acceso}` : payload.nivel_acceso, impact: "Acceso", level: "high" },
      { label: "Estado", value: current ? `${current.status} → ${payload.estado}` : payload.estado, impact: "Operativo", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;

  await confirmSaveRole(payload);
}

async function confirmSaveRole(payload) {
  const endpoint = State.selectedRoleId
    ? `/admin/roles/${encodeURIComponent(State.selectedRoleId)}`
    : "/admin/roles";

  const method = State.selectedRoleId ? "PUT" : "POST";

  try {
    await apiJson(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    closeModals();
    await renderRolesPermissionsPage();
    toast("Rol guardado", "El rol fue registrado correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar rol", error.message);
  }
}

async function requestSavePermissionMatrix() {
  const toggles = $$(".permission-toggle");
  const activeCount = toggles.filter(btn => btn.classList.contains("is-on")).length;

  const confirmation = await confirmAction({
    icon: "🔐",
    title: "Guardar matriz de permisos",
    text: "Se actualizarán permisos por rol. Esta acción puede afectar accesos de usuarios.",
    impact: [
      { label: "Permisos visibles", value: toggles.length, impact: "Matriz", level: "medium" },
      { label: "Permisos activos", value: activeCount, impact: "Accesos habilitados", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  setValue("#permissionMatrixReason", confirmation.reason);
  openModal("#savePermissionMatrixModal");
}

async function confirmSavePermissionMatrix() {
  if ($("#permissionMatrixDeclaration") && !isChecked("#permissionMatrixDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste la matriz.", "warning");
    return;
  }

  const matrix = $$(".permission-toggle").map(button => ({
    permiso_id: button.dataset.permission,
    rol_id: button.dataset.role,
    rol_nombre: button.dataset.roleName,
    activo: button.classList.contains("is-on"),
    motivo_sensible: button.dataset.reason || ""
  }));

  try {
    await apiJson("/admin/roles-permisos/matriz", {
      method: "PUT",
      body: JSON.stringify({
        matrix,
        motivo: getValue("#permissionMatrixReason") || "Actualización de matriz de permisos"
      })
    });

    closeModals();
    await renderRolesPermissionsPage();
    toast("Matriz guardada", "Los permisos fueron actualizados.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar matriz", error.message);
  }
}

async function requestResetPermissionMatrix() {
  const confirmation = await confirmAction({
    icon: "⚠️",
    title: "Restaurar matriz de permisos",
    text: "Se solicitará al backend restaurar la matriz según valores base configurados.",
    warning: "Esta acción puede retirar o activar permisos de varios roles.",
    impact: [
      { label: "Módulo", value: "Roles y permisos", impact: "Crítico", level: "high" },
      { label: "Alcance", value: "Matriz completa", impact: "Masivo", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/roles-permisos/matriz/restaurar", {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    await renderRolesPermissionsPage();
    toast("Matriz restaurada", "La matriz fue restaurada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo restaurar matriz", error.message);
  }
}

async function suggestRolePermissions() {
  try {
    const response = await apiJson("/admin/roles-permisos/sugerir", {
      method: "POST",
      body: JSON.stringify({
        rol_id: State.selectedRoleId,
        contexto: "matriz permisos administrador"
      })
    });

    showResultModal({
      icon: "🤖",
      title: "Sugerencia de permisos",
      text: response.mensaje || "El backend devolvió una sugerencia de configuración.",
      rows: (response.items || response.sugerencias || []).map(item => ({
        icon: "🔐",
        label: item.permiso || item.nombre || "Permiso",
        value: item.recomendacion || item.descripcion || "Revisar",
        type: item.riesgo ? statusType(item.riesgo) : "info"
      }))
    });
  } catch (error) {
    genericModal("!", "No se pudo sugerir permisos", error.message);
  }
}

/* =========================================================
   CATÁLOGOS
========================================================= */

async function initCatalogs() {
  bindCatalogEvents();
  await renderCatalogsPage();
}

function bindCatalogEvents() {
  $("#catalogSearch")?.addEventListener("input", debounce(renderCatalogsPage, 250));

  $$("[data-catalog-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.catalogFilter = button.dataset.catalogFilter || "todos";
      $$("[data-catalog-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderCatalogsPage();
    });
  });

  $("#toggleCatalogViewBtn")?.addEventListener("click", () => {
    State.catalogView = State.catalogView === "cards" ? "table" : "cards";
    setText("#toggleCatalogViewBtn", State.catalogView === "cards" ? "Vista tabla" : "Vista cards");
    renderCatalogsPage();
  });

  $("#refreshCatalogsBtn")?.addEventListener("click", async () => {
    State.catalogItems = [];
    await renderCatalogsPage();
  });

  $("#refreshCatalogChartBtn")?.addEventListener("click", renderCatalogsPage);
  $("#refreshCatalogStatusBtn")?.addEventListener("click", renderCatalogsPage);
  $("#openCreateCatalogItemBtn")?.addEventListener("click", openCreateCatalogModal);
  $("#exportCatalogsBtn")?.addEventListener("click", () => openExportModal("catalogos"));
  $("#validateCatalogsBtn")?.addEventListener("click", validateCatalogs);
  $("#catalogEditBtn")?.addEventListener("click", () => { closeModals(); openEditCatalogModal(State.selectedCatalogId); });
  $("#catalogToggleStatusBtn")?.addEventListener("click", () => { closeModals(); openCatalogStatusModal(State.selectedCatalogId); });
  $("#catalogAuditBtn")?.addEventListener("click", () => { window.location.href = `auditoria.html?catalogo=${encodeURIComponent(State.selectedCatalogId || "")}`; });
  $("#saveCatalogItemBtn")?.addEventListener("click", requestSaveCatalogItem);
  $("#catalogSuggestBtn")?.addEventListener("click", validateCatalogItemWithBackend);
  $("#confirmCatalogStatusBtn")?.addEventListener("click", confirmCatalogStatus);
}

async function loadCatalogs() {
  const response = await apiJson(`/admin/catalogos${buildQuery({
    q: getValue("#catalogSearch"),
    filtro: State.catalogFilter
  })}`);

  State.catalogItems = response.items || response.catalogos || [];
  return State.catalogItems;
}

function catalogFiltered() {
  const query = getValue("#catalogSearch").toLowerCase();

  return State.catalogItems.map(normalizeCatalog).filter(item => {
    const text = `${item.name} ${item.type} ${item.status} ${item.usage} ${item.dependency} ${item.description}`.toLowerCase();
    const filter = State.catalogFilter;

    const matchesFilter =
      filter === "todos" ||
      String(item.filterType).toLowerCase().includes(filter) ||
      String(item.type).toLowerCase().includes(filter.replace("categorias", "categor"));

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderCatalogsPage() {
  try {
    await loadCatalogs();

    const rows = catalogFiltered();
    const all = State.catalogItems.map(normalizeCatalog);

    setText("#catalogSummaryTitle", `${all.length} elementos configurados`);
    setText("#catalogSummaryText", `${rows.length} elementos visibles según filtro.`);

    renderKpis("#catalogKpiGrid", [
      { icon: "🧩", value: all.length, label: "Elementos", description: "Total configurado" },
      { icon: "✅", value: all.filter(i => i.status === "Activo").length, label: "Activos", description: "En uso" },
      { icon: "🕘", value: all.filter(i => i.status === "En revisión").length, label: "En revisión", description: "Pendientes" },
      { icon: "⛔", value: all.filter(i => i.status === "Inactivo").length, label: "Inactivos", description: "No disponibles" }
    ]);

    renderBarChart("#catalogDistributionChart", Object.entries(countBy(all, "type")).map(([label, value]) => ({ label, value })));
    renderDonut("#catalogStatusDonut", "#catalogStatusLegend", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })), "Elementos");

    setHTML("#catalogCardList", rows.map(catalogCard).join(""));
    setHTML("#catalogTableBody", rows.map(catalogTableRow).join(""));

    show($("#catalogCardList"), State.catalogView === "cards");
    show($("#catalogTableWrap"), State.catalogView === "table");
    show($("#emptyCatalogState"), !rows.length);

    renderAi("#catalogAiSummary", [
      { title: "Datos maestros", text: "Valida duplicados, elementos inactivos y dependencias con SLA, reportes o casos." },
      { title: "Impacto", text: "No inactives catálogos usados por reglas o casos activos." }
    ]);

    renderChecklist("#catalogActionPlan", [
      { icon: "1", title: "Validar uso", text: "Confirmar dependencias antes de editar." },
      { icon: "2", title: "Evitar duplicados", text: "Revisar nombres similares." },
      { icon: "3", title: "Auditar cambios", text: "Registrar motivo de modificación." }
    ]);

    bindCatalogActions($("#catalogCardList"));
    bindCatalogActions($("#catalogTableBody"));
  } catch (error) {
    renderAi("#catalogAiSummary", [{ title: "No se pudieron cargar catálogos", text: error.message }]);
  }
}

function catalogCard(item) {
  return `
    <article class="catalog-card">
      <span class="catalog-card__icon">${esc(item.icon)}</span>
      <div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.description)}</p>
        <small>${esc(item.type)} · ${esc(item.usage)} · ${esc(item.dependency)}</small>
      </div>
      <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
      <div class="service-actions">
        <button type="button" data-action="view-catalog" data-catalog-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-catalog" data-catalog-id="${esc(item.id)}">Editar</button>
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
      <td>${esc(formatDate(item.updatedAt))}</td>
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
}

function catalogSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Nombre", item.name],
    ["Catálogo", item.type],
    ["Estado", item.status],
    ["Uso", item.usage],
    ["Dependencia", item.dependency],
    ["Dependencias activas", item.activeDependencies],
    ["Actualización", formatDate(item.updatedAt)]
  ]);
}

function openCatalogDetail(id) {
  const item = getItem(State.catalogItems, id, normalizeCatalog);
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

  setText("#catalogFormEyebrow", "Nuevo elemento");
  setText("#catalogFormTitle", "Crear elemento de catálogo");
  setText("#catalogFormText", "Completa la información funcional del catálogo.");

  ["#catalogItemName", "#catalogItemType", "#catalogItemStatus", "#catalogItemDependency", "#catalogItemDescription"].forEach(selector => setValue(selector, ""));
  setChecked("#catalogFormDeclaration", false);

  openModal("#catalogFormModal");
}

function openEditCatalogModal(id) {
  const item = getItem(State.catalogItems, id, normalizeCatalog);
  if (!item) return;

  State.selectedCatalogId = id;

  setText("#catalogFormEyebrow", "Editar catálogo");
  setText("#catalogFormTitle", item.name);
  setText("#catalogFormText", "Modifica la información funcional del elemento.");

  setValue("#catalogItemName", item.name);
  setValue("#catalogItemType", item.type);
  setValue("#catalogItemStatus", item.status);
  setValue("#catalogItemDependency", item.dependency);
  setValue("#catalogItemDescription", item.description);
  setChecked("#catalogFormDeclaration", false);

  openModal("#catalogFormModal");
}

function collectCatalogPayload() {
  return {
    nombre: getValue("#catalogItemName"),
    tipo: getValue("#catalogItemType"),
    estado: getValue("#catalogItemStatus"),
    dependencia: getValue("#catalogItemDependency"),
    descripcion: getValue("#catalogItemDescription")
  };
}

async function requestSaveCatalogItem() {
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

  const payload = collectCatalogPayload();
  const current = State.selectedCatalogId ? getItem(State.catalogItems, State.selectedCatalogId, normalizeCatalog) : null;

  const validation = await validateCatalogPayload(payload);
  if (!validation.valid) {
    showResultModal({
      icon: "⚠️",
      title: "Validación de catálogo",
      text: "El backend encontró observaciones antes de guardar.",
      rows: validation.items.map(item => ({
        icon: "⚠️",
        label: item.campo || item.label || "Observación",
        value: item.mensaje || item.value || item.descripcion || "Revisar",
        type: "warning"
      }))
    });
    return;
  }

  const confirmation = await confirmAction({
    icon: "🧩",
    title: State.selectedCatalogId ? "Confirmar actualización de catálogo" : "Confirmar creación de catálogo",
    text: "Los catálogos son criterios maestros usados por casos, SLA, reportes y formularios.",
    impact: [
      { label: "Elemento", value: payload.nombre, impact: State.selectedCatalogId ? "Actualización" : "Nuevo", level: "medium" },
      { label: "Tipo", value: current ? `${current.type} → ${payload.tipo}` : payload.tipo, impact: "Dato maestro", level: "medium" },
      { label: "Estado", value: current ? `${current.status} → ${payload.estado}` : payload.estado, impact: "Uso funcional", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;
  await confirmSaveCatalogItem(payload);
}

async function validateCatalogPayload(payload) {
  try {
    const response = await apiJson("/admin/catalogos/validar-item", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        catalogo_id: State.selectedCatalogId
      })
    });

    return {
      valid: Boolean(response.valid ?? response.valido ?? true),
      items: response.items || response.observaciones || []
    };
  } catch {
    return { valid: true, items: [] };
  }
}

async function confirmSaveCatalogItem(payload) {
  const endpoint = State.selectedCatalogId
    ? `/admin/catalogos/${encodeURIComponent(State.selectedCatalogId)}`
    : "/admin/catalogos";

  const method = State.selectedCatalogId ? "PUT" : "POST";

  try {
    await apiJson(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    closeModals();
    State.catalogItems = [];
    await renderCatalogsPage();
    toast("Catálogo guardado", "El elemento fue registrado correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar catálogo", error.message);
  }
}

async function openCatalogStatusModal(id) {
  const item = getItem(State.catalogItems, id, normalizeCatalog);
  if (!item) return;

  State.selectedCatalogId = id;
  setHTML("#catalogStatusSummary", catalogSummary(item));
  setValue("#newCatalogStatus", "");
  setValue("#catalogStatusReason", "");
  setChecked("#catalogStatusDeclaration", false);

  try {
    const impact = await apiJson(`/admin/catalogos/${encodeURIComponent(id)}/impacto`);
    const impactItems = impact.items || impact.dependencias || [];

    if (impactItems.length) {
      setHTML("#catalogStatusSummary", catalogSummary(item) + `
        <div class="confirm-warning-banner">
          Este catálogo tiene dependencias activas. Revisa el impacto antes de cambiar estado.
        </div>
        <div class="confirm-impact">
          ${impactItems.map(dep => `
            <div class="confirm-impact__row">
              <span>${esc(dep.modulo || dep.tipo || "Dependencia")}</span>
              <strong>${esc(dep.cantidad ?? dep.descripcion ?? "-")}</strong>
              <em class="confirm-risk confirm-risk--high">Impacto</em>
            </div>
          `).join("")}
        </div>
      `);
    }
  } catch {
    /* Si backend aún no existe, solo abre modal normal */
  }

  openModal("#catalogStatusModal");
}

async function confirmCatalogStatus() {
  if (!State.selectedCatalogId) return;

  if (!getValue("#newCatalogStatus") || !getValue("#catalogStatusReason") || !isChecked("#catalogStatusDeclaration")) {
    toast("Faltan datos", "Completa nuevo estado, motivo y confirmación.", "warning");
    return;
  }

  const item = getItem(State.catalogItems, State.selectedCatalogId, normalizeCatalog);
  const newStatus = getValue("#newCatalogStatus");

  const confirmation = await confirmAction({
    icon: "🧩",
    title: "Confirmar cambio de estado de catálogo",
    text: "Cambiar el estado de un catálogo puede afectar formularios, reglas SLA, reportes y casos activos.",
    impact: [
      { label: "Catálogo", value: item?.name || State.selectedCatalogId, impact: "Dato maestro", level: "high" },
      { label: "Estado", value: `${item?.status || "-"} → ${newStatus}`, impact: "Funcional", level: "high" },
      { label: "Dependencias activas", value: item?.activeDependencies || 0, impact: "Impacto", level: item?.activeDependencies ? "high" : "low" }
    ],
    requireReason: false,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson(`/admin/catalogos/${encodeURIComponent(State.selectedCatalogId)}/estado`, {
      method: "PATCH",
      body: JSON.stringify({
        estado: newStatus,
        motivo: getValue("#catalogStatusReason")
      })
    });

    closeModals();
    State.catalogItems = [];
    await renderCatalogsPage();
    toast("Estado actualizado", "El estado del catálogo fue actualizado.", "success");
  } catch (error) {
    genericModal("!", "No se pudo cambiar estado", error.message);
  }
}

async function validateCatalogs() {
  const confirmation = await confirmAction({
    icon: "🔎",
    title: "Validar catálogos",
    text: "Se revisarán duplicados, dependencias, catálogos inactivos en uso y datos huérfanos.",
    requireReason: false,
    requireCheckbox: true,
    checkboxText: "Confirmo que deseo ejecutar la validación de catálogos."
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Validando catálogos", "El backend está revisando consistencia de datos maestros.");

    const response = await apiJson("/admin/catalogos/validar", {
      method: "POST",
      body: JSON.stringify({ filtros: collectCurrentFilters() })
    });

    closeLoading();

    const items = response.items || response.observaciones || response.resultados || [];

    showResultModal({
      icon: items.length ? "⚠️" : "✅",
      title: "Validación de catálogos",
      text: items.length ? "Se encontraron observaciones para revisar." : "No se encontraron inconsistencias.",
      rows: items.map(item => ({
        icon: item.icon || "🧩",
        label: item.titulo || item.campo || item.tipo || "Observación",
        value: item.mensaje || item.descripcion || item.detalle || "-",
        type: statusType(item.estado || item.severidad || "warning")
      }))
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo validar catálogos", error.message);
  }
}

async function validateCatalogItemWithBackend() {
  const payload = collectCatalogPayload();

  try {
    const response = await apiJson("/admin/catalogos/validar-item", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        catalogo_id: State.selectedCatalogId
      })
    });

    const items = response.items || response.observaciones || [];

    showResultModal({
      icon: items.length ? "⚠️" : "✅",
      title: "Validación de elemento",
      text: items.length ? "Se encontraron observaciones." : "El elemento no presenta observaciones.",
      rows: items.map(item => ({
        icon: "🧩",
        label: item.campo || item.tipo || "Validación",
        value: item.mensaje || item.descripcion || "-",
        type: statusType(item.severidad || "warning")
      }))
    });
  } catch (error) {
    genericModal("!", "No se pudo validar elemento", error.message);
  }
}

/* =========================================================
   REGLAS SLA
========================================================= */

async function initSlaRules() {
  bindSlaEvents();
  await renderSlaRulesPage();
}

function bindSlaEvents() {
  $("#slaRuleSearch")?.addEventListener("input", debounce(renderSlaRulesPage, 250));

  $$("[data-sla-rule-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.slaRuleFilter = button.datasetSlaRuleFilter || button.dataset.slaRuleFilter || "todos";
      $$("[data-sla-rule-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderSlaRulesPage();
    });
  });

  $("#toggleSlaRulesViewBtn")?.addEventListener("click", () => {
    State.slaRuleView = State.slaRuleView === "cards" ? "table" : "cards";
    setText("#toggleSlaRulesViewBtn", State.slaRuleView === "cards" ? "Vista tabla" : "Vista cards");
    renderSlaRulesPage();
  });

  $("#refreshSlaRulesBtn")?.addEventListener("click", async () => {
    State.slaRules = [];
    await renderSlaRulesPage();
  });

  $("#refreshSlaPriorityChartBtn")?.addEventListener("click", renderSlaRulesPage);
  $("#refreshSlaStatusChartBtn")?.addEventListener("click", renderSlaRulesPage);
  $("#openCreateSlaRuleBtn")?.addEventListener("click", openCreateSlaRuleModal);
  $("#validateSlaRulesBtn")?.addEventListener("click", validateSlaRules);
  $("#exportSlaRulesBtn")?.addEventListener("click", () => openExportModal("sla"));
  $("#slaRuleEditBtn")?.addEventListener("click", () => { closeModals(); openEditSlaRuleModal(State.selectedSlaRuleId); });
  $("#slaRuleDuplicateBtn")?.addEventListener("click", () => requestDuplicateSlaRule(State.selectedSlaRuleId));
  $("#slaRuleAuditBtn")?.addEventListener("click", () => { window.location.href = `auditoria.html?sla=${encodeURIComponent(State.selectedSlaRuleId || "")}`; });
  $("#saveSlaRuleBtn")?.addEventListener("click", requestSaveSlaRule);
  $("#suggestSlaRuleBtn")?.addEventListener("click", validateSlaRuleWithBackend);
}

async function loadSlaRules() {
  const response = await apiJson(`/admin/reglas-sla${buildQuery({
    q: getValue("#slaRuleSearch"),
    filtro: State.slaRuleFilter
  })}`);

  State.slaRules = response.items || response.rules || response.reglas || [];
  return State.slaRules;
}

function slaRulesFiltered() {
  const query = getValue("#slaRuleSearch").toLowerCase();

  return State.slaRules.map(normalizeSlaRule).filter(item => {
    const text = `${item.name} ${item.caseType} ${item.priority} ${item.channel} ${item.area} ${item.status}`.toLowerCase();
    const filter = State.slaRuleFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "reclamos" && item.caseType.toLowerCase().includes("reclamo")) ||
      (filter === "incidencias" && item.caseType.toLowerCase().includes("incidencia")) ||
      (filter === "criticas" && item.priority.toLowerCase().includes("crítica")) ||
      (filter === "activas" && item.status === "Activo") ||
      (filter === "revision" && item.status === "En revisión") ||
      text.includes(filter);

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderSlaRulesPage() {
  try {
    await loadSlaRules();

    const rows = slaRulesFiltered();
    const all = State.slaRules.map(normalizeSlaRule);

    setText("#slaRulesSummaryTitle", `${all.length} reglas SLA configuradas`);
    setText("#slaRulesSummaryText", `${rows.length} reglas visibles según filtro.`);

    renderKpis("#slaRulesKpiGrid", [
      { icon: "⏱️", value: all.length, label: "Reglas", description: "Total configurado" },
      { icon: "✅", value: all.filter(i => i.status === "Activo").length, label: "Activas", description: "En uso" },
      { icon: "🔥", value: all.filter(i => i.priority.toLowerCase().includes("crítica")).length, label: "Críticas", description: "Alta prioridad" },
      { icon: "🕘", value: all.filter(i => i.status === "En revisión").length, label: "En revisión", description: "Pendientes" }
    ]);

    renderBarChart("#slaPriorityChart", Object.entries(countBy(all, "priority")).map(([label, value]) => ({ label, value })));
    renderDonut("#slaStatusDonut", "#slaStatusLegend", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })), "Reglas");

    setHTML("#slaRuleCardList", rows.map(slaRuleCard).join(""));
    setHTML("#slaRuleTableBody", rows.map(slaRuleTableRow).join(""));

    show($("#slaRuleCardList"), State.slaRuleView === "cards");
    show($("#slaRuleTableWrap"), State.slaRuleView === "table");
    show($("#emptySlaRulesState"), !rows.length);

    renderAi("#slaRulesAiSummary", [
      { title: "Umbrales", text: "Revisa reglas críticas y alertas preventivas demasiado tardías." },
      { title: "Consistencia", text: "Evita duplicar reglas por mismo tipo, prioridad, canal y área." }
    ]);

    renderChecklist("#slaRulesActionPlan", [
      { icon: "1", title: "Validar prioridad", text: "Cada prioridad debe tener tiempo coherente." },
      { icon: "2", title: "Revisar alerta", text: "La alerta debe anticipar el vencimiento." },
      { icon: "3", title: "Confirmar área", text: "Toda regla debe tener responsable y escalamiento." }
    ]);

    bindSlaRuleActions($("#slaRuleCardList"));
    bindSlaRuleActions($("#slaRuleTableBody"));
  } catch (error) {
    renderAi("#slaRulesAiSummary", [{ title: "No se pudieron cargar reglas SLA", text: error.message }]);
  }
}

function slaRuleCard(item) {
  return `
    <article class="sla-rule-card">
      <span class="sla-rule-card__icon">${esc(item.icon)}</span>
      <div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.description)}</p>
        <small>${esc(item.caseType)} · ${esc(item.priority)} · ${esc(item.time)} · ${esc(item.area)}</small>
      </div>
      <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
      <div class="service-actions">
        <button type="button" data-action="view-sla" data-sla-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-sla" data-sla-id="${esc(item.id)}">Editar</button>
      </div>
    </article>
  `;
}

function slaRuleTableRow(item) {
  return `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.caseType)}</td>
      <td>${esc(item.priority)}</td>
      <td>${esc(item.channel)}</td>
      <td>${esc(item.time)}</td>
      <td>${esc(item.alert)}</td>
      <td><span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span></td>
      <td>
        <button type="button" data-action="view-sla" data-sla-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-sla" data-sla-id="${esc(item.id)}">Editar</button>
      </td>
    </tr>
  `;
}

function bindSlaRuleActions(root = document) {
  $$("[data-action='view-sla']", root).forEach(button => {
    button.addEventListener("click", () => openSlaRuleDetail(button.dataset.slaId));
  });

  $$("[data-action='edit-sla']", root).forEach(button => {
    button.addEventListener("click", () => openEditSlaRuleModal(button.dataset.slaId));
  });
}

function slaRuleSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Nombre", item.name],
    ["Tipo", item.caseType],
    ["Prioridad", item.priority],
    ["Canal", item.channel],
    ["Tiempo SLA", item.time],
    ["Alerta", item.alert],
    ["Área", item.area],
    ["Escalamiento", item.escalationArea],
    ["Estado", item.status],
    ["Vigencia inicio", formatDateOnly(item.startDate)],
    ["Vigencia fin", formatDateOnly(item.endDate)]
  ]);
}

function openSlaRuleDetail(id) {
  const item = getItem(State.slaRules, id, normalizeSlaRule);
  if (!item) return;

  State.selectedSlaRuleId = id;

  setText("#slaRuleDetailIcon", item.icon);
  setText("#slaRuleDetailTitle", item.name);
  setText("#slaRuleDetailText", item.description);
  setHTML("#slaRuleDetailSummary", slaRuleSummary(item));
  openModal("#slaRuleDetailModal");
}

function openCreateSlaRuleModal() {
  State.selectedSlaRuleId = null;

  setText("#slaRuleFormEyebrow", "Nueva regla");
  setText("#slaRuleFormTitle", "Crear regla SLA");
  setText("#slaRuleFormText", "Completa la matriz de tiempo, prioridad, canal y área.");

  [
    "#slaRuleName",
    "#slaRuleCaseType",
    "#slaRulePriority",
    "#slaRuleChannel",
    "#slaRuleTime",
    "#slaRuleAlert",
    "#slaRuleArea",
    "#slaRuleStatus",
    "#slaRuleDescription"
  ].forEach(selector => setValue(selector, ""));

  setChecked("#slaRuleDeclaration", false);
  openModal("#slaRuleFormModal");
}

function openEditSlaRuleModal(id) {
  const item = getItem(State.slaRules, id, normalizeSlaRule);
  if (!item) return;

  State.selectedSlaRuleId = id;

  setText("#slaRuleFormEyebrow", "Editar regla");
  setText("#slaRuleFormTitle", item.name);
  setText("#slaRuleFormText", "Modifica la regla SLA seleccionada.");

  setValue("#slaRuleName", item.name);
  setValue("#slaRuleCaseType", item.raw.tipo_caso_id || item.caseType);
  setValue("#slaRulePriority", item.raw.prioridad_id || item.priority);
  setValue("#slaRuleChannel", item.raw.canal_id || item.channel);
  setValue("#slaRuleTime", item.raw.tiempo_sla_id || item.time);
  setValue("#slaRuleAlert", item.raw.alerta_id || item.alert);
  setValue("#slaRuleArea", item.raw.area_id || item.area);
  setValue("#slaRuleStatus", item.status);
  setValue("#slaRuleDescription", item.description);
  setChecked("#slaRuleDeclaration", false);

  openModal("#slaRuleFormModal");
}

function collectSlaRulePayload() {
  return {
    nombre: getValue("#slaRuleName"),
    tipo_caso: getValue("#slaRuleCaseType"),
    prioridad: getValue("#slaRulePriority"),
    canal: getValue("#slaRuleChannel"),
    tiempo_sla: getValue("#slaRuleTime"),
    alerta: getValue("#slaRuleAlert"),
    area: getValue("#slaRuleArea"),
    estado: getValue("#slaRuleStatus"),
    descripcion: getValue("#slaRuleDescription")
  };
}

async function requestSaveSlaRule() {
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
    toast("Faltan datos", "Completa todos los campos y confirma la revisión.", "warning");
    return;
  }

  const payload = collectSlaRulePayload();

  const validation = await validateSlaPayload(payload);

  if (!validation.valid) {
    showResultModal({
      icon: "⚠️",
      title: "Validación SLA",
      text: "El backend encontró observaciones antes de guardar.",
      rows: validation.items.map(item => ({
        icon: "⏱️",
        label: item.campo || item.label || "Observación",
        value: item.mensaje || item.descripcion || "-",
        type: statusType(item.severidad || "warning")
      }))
    });

    return;
  }

  const current = State.selectedSlaRuleId ? getItem(State.slaRules, State.selectedSlaRuleId, normalizeSlaRule) : null;

  const confirmation = await confirmAction({
    icon: "⏱️",
    title: State.selectedSlaRuleId ? "Confirmar actualización de SLA" : "Confirmar creación de SLA",
    text: "Las reglas SLA afectan tiempos de atención, alertas y escalamiento.",
    warning: "Valida que la alerta preventiva sea menor al tiempo SLA.",
    impact: [
      { label: "Regla", value: payload.nombre, impact: State.selectedSlaRuleId ? "Actualización" : "Nueva", level: "medium" },
      { label: "Prioridad", value: current ? `${current.priority} → ${payload.prioridad}` : payload.prioridad, impact: "Atención", level: "high" },
      { label: "Estado", value: current ? `${current.status} → ${payload.estado}` : payload.estado, impact: "Aplicación", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;
  await confirmSaveSlaRule(payload);
}

async function validateSlaPayload(payload) {
  try {
    const response = await apiJson("/admin/reglas-sla/validar-item", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        regla_sla_id: State.selectedSlaRuleId
      })
    });

    return {
      valid: Boolean(response.valid ?? response.valido ?? true),
      items: response.items || response.observaciones || []
    };
  } catch {
    return { valid: true, items: [] };
  }
}

async function confirmSaveSlaRule(payload) {
  const endpoint = State.selectedSlaRuleId
    ? `/admin/reglas-sla/${encodeURIComponent(State.selectedSlaRuleId)}`
    : "/admin/reglas-sla";

  const method = State.selectedSlaRuleId ? "PUT" : "POST";

  try {
    await apiJson(endpoint, {
      method,
      body: JSON.stringify(payload)
    });

    closeModals();
    State.slaRules = [];
    await renderSlaRulesPage();
    toast("Regla guardada", "La regla SLA fue guardada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar regla SLA", error.message);
  }
}

async function requestDuplicateSlaRule(id) {
  if (!id) return;

  const item = getItem(State.slaRules, id, normalizeSlaRule);
  if (!item) return;

  const confirmation = await confirmAction({
    icon: "⏱️",
    title: "Duplicar regla SLA",
    text: "Se creará una nueva regla basada en la seleccionada. Deberás validar que no exista duplicidad funcional.",
    impact: [
      { label: "Regla base", value: item.name, impact: "Duplicado", level: "medium" },
      { label: "Tipo / prioridad", value: `${item.caseType} · ${item.priority}`, impact: "Validar", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson(`/admin/reglas-sla/${encodeURIComponent(id)}/duplicar`, {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeModals();
    State.slaRules = [];
    await renderSlaRulesPage();
    toast("Regla duplicada", "La regla fue duplicada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo duplicar regla", error.message);
  }
}

async function validateSlaRules() {
  const confirmation = await confirmAction({
    icon: "🔎",
    title: "Validar reglas SLA",
    text: "Se revisarán duplicados, alertas tardías, áreas faltantes, vigencias y reglas contradictorias.",
    requireReason: false,
    requireCheckbox: true,
    checkboxText: "Confirmo que deseo validar reglas SLA."
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Validando SLA", "El backend está revisando consistencia de reglas.");

    const response = await apiJson("/admin/reglas-sla/validar", {
      method: "POST",
      body: JSON.stringify({ filtros: collectCurrentFilters() })
    });

    closeLoading();

    const items = response.items || response.observaciones || response.resultados || [];

    showResultModal({
      icon: items.length ? "⚠️" : "✅",
      title: "Validación de reglas SLA",
      text: items.length ? "Se encontraron observaciones para revisar." : "No se encontraron inconsistencias.",
      rows: items.map(item => ({
        icon: "⏱️",
        label: item.titulo || item.campo || item.tipo || "Observación",
        value: item.mensaje || item.descripcion || item.detalle || "-",
        type: statusType(item.estado || item.severidad || "warning")
      }))
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo validar SLA", error.message);
  }
}

async function validateSlaRuleWithBackend() {
  const payload = collectSlaRulePayload();

  try {
    const response = await apiJson("/admin/reglas-sla/validar-item", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        regla_sla_id: State.selectedSlaRuleId
      })
    });

    const items = response.items || response.observaciones || [];

    showResultModal({
      icon: items.length ? "⚠️" : "✅",
      title: "Validación de regla SLA",
      text: items.length ? "Se encontraron observaciones." : "La regla no presenta observaciones.",
      rows: items.map(item => ({
        icon: "⏱️",
        label: item.campo || item.tipo || "Validación",
        value: item.mensaje || item.descripcion || "-",
        type: statusType(item.severidad || "warning")
      }))
    });
  } catch (error) {
    genericModal("!", "No se pudo validar regla SLA", error.message);
  }
}

/* =========================================================
   INDICADORES Y REPORTES
========================================================= */

async function initAdminIndicatorsReports() {
  ensureIndicatorCustomDateRange();
  bindIndicatorsEvents();
  await renderAdminIndicatorsPage();
}

function ensureIndicatorCustomDateRange() {
  if ($("#adminCustomDateRange")) return;

  const anchor =
    $("#adminIndicatorChannel")?.closest(".admin-filter-grid") ||
    $("#adminIndicatorChannel")?.closest(".form-grid") ||
    $("#adminIndicatorChannel")?.closest(".panel-card");

  if (!anchor) return;

  anchor.insertAdjacentHTML("afterend", `
    <div class="admin-filter-grid hidden" id="adminCustomDateRange">
      <div class="form-group">
        <label for="adminIndicatorStartDate">Fecha inicio</label>
        <input id="adminIndicatorStartDate" type="date" />
      </div>

      <div class="form-group">
        <label for="adminIndicatorEndDate">Fecha fin</label>
        <input id="adminIndicatorEndDate" type="date" />
      </div>
    </div>
  `);
}

function bindIndicatorsEvents() {
  ["#adminIndicatorPeriod", "#adminIndicatorModule", "#adminIndicatorRole", "#adminIndicatorChannel"].forEach(selector => {
    $(selector)?.addEventListener("change", () => {
      const isCustom = String(getValue("#adminIndicatorPeriod")).toLowerCase().includes("personal");
      showBySelector("#adminCustomDateRange", isCustom);
      renderAdminIndicatorsPage();
    });
  });

  $("#adminIndicatorStartDate")?.addEventListener("change", renderAdminIndicatorsPage);
  $("#adminIndicatorEndDate")?.addEventListener("change", renderAdminIndicatorsPage);

  $("#refreshAdminIndicatorsBtn")?.addEventListener("click", renderAdminIndicatorsPage);
  $("#refreshAdminCaseEvolutionBtn")?.addEventListener("click", renderAdminIndicatorsPage);
  $("#refreshAdminChannelDonutBtn")?.addEventListener("click", renderAdminIndicatorsPage);
  $("#refreshAdminMetricCardsBtn")?.addEventListener("click", renderAdminIndicatorsPage);
  $("#refreshAdminReportsBtn")?.addEventListener("click", renderAdminIndicatorsPage);

  $("#exportAdminIndicatorsBtn")?.addEventListener("click", () => openExportModal("indicadores"));

  $("#toggleAdminMetricViewBtn")?.addEventListener("click", () => {
    State.adminMetricCompact = !State.adminMetricCompact;
    $("#adminMetricGrid")?.classList.toggle("indicator-grid--compact", State.adminMetricCompact);
    setText("#toggleAdminMetricViewBtn", State.adminMetricCompact ? "Vista amplia" : "Vista compacta");
  });

  $("#openAdminReportModalBtn")?.addEventListener("click", openAdminReportModal);
  $("#compareAdminIndicatorsBtn")?.addEventListener("click", openCompareIndicatorsModal);
  $("#confirmGenerateAdminReportBtn")?.addEventListener("click", requestGenerateAdminReport);
  $("#suggestAdminReportBtn")?.addEventListener("click", suggestAdminReport);
  $("#scheduleAdminReportBtn")?.addEventListener("click", openScheduleAdminReportModal);
  $("#confirmScheduleAdminReportBtn")?.addEventListener("click", requestScheduleAdminReport);
  $("#adminIndicatorReportBtn")?.addEventListener("click", openAdminReportModal);
  $("#adminIndicatorAiBtn")?.addEventListener("click", () => askBot("Analiza indicador administrativo seleccionado"));
}

async function renderAdminIndicatorsPage() {
  try {
    const response = await apiJson(`/admin/indicadores-reportes${buildQuery({
      period: getValue("#adminIndicatorPeriod"),
      module: getValue("#adminIndicatorModule"),
      role: getValue("#adminIndicatorRole"),
      channel: getValue("#adminIndicatorChannel"),
      fecha_inicio: getValue("#adminIndicatorStartDate"),
      fecha_fin: getValue("#adminIndicatorEndDate")
    })}`);

    State.metrics = response.metrics || response.indicadores || [];
    State.reports = response.reports || response.reportes || [];

    const metrics = State.metrics.map(normalizeMetric);
    const reports = State.reports.map(normalizeReport);

    setText("#adminIndicatorsSummaryTitle", `${metrics.length} métricas cargadas`);
    setText("#adminIndicatorsSummaryText", `Periodo: ${getValue("#adminIndicatorPeriod") || "según backend"}.`);

    renderKpis("#adminIndicatorsKpiGrid", response.kpis || metrics.slice(0, 4).map(m => ({
      icon: m.icon,
      value: m.value,
      label: m.title,
      description: `Meta: ${m.target}`
    })));

    renderBarChart("#adminCaseEvolutionChart", response.case_evolution || response.evolucion_casos || []);
    renderDonut("#adminChannelDonut", "#adminChannelLegend", response.channel_distribution || response.canales || [], "Casos");
    renderAdminMetricCards(metrics);
    renderAdminReportsTable(reports);

    renderAi("#adminIndicatorsAiSummary", response.ai_summary || []);
    renderChecklist("#adminReportActionPlan", response.action_plan || []);

    show($("#emptyAdminMetricsState"), !metrics.length);
  } catch (error) {
    renderAi("#adminIndicatorsAiSummary", [{ title: "No se pudieron cargar indicadores", text: error.message }]);
  }
}

function renderAdminMetricCards(metrics) {
  setHTML("#adminMetricGrid", metrics.map(item => `
    <article class="indicator-card${State.adminMetricCompact ? " indicator-card--compact" : ""}">
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
  `).join(""));

  $$("[data-admin-metric-id]").forEach(button => {
    button.addEventListener("click", () => openAdminMetricDetail(button.dataset.adminMetricId));
  });
}

function openAdminMetricDetail(id) {
  const item = getItem(State.metrics, id, normalizeMetric);
  if (!item) return;

  State.selectedMetricId = id;

  const html = summaryHTML([
    ["Valor actual", item.value],
    ["Meta", item.target],
    ["Avance", `${item.progress}%`],
    ["Estado", item.status],
    ["Causa probable", item.cause],
    ["Recomendación", "Revisar módulo relacionado y generar reporte si la desviación persiste."]
  ]);

  setText("#adminMetricDetailIcon", item.icon);
  setText("#adminMetricDetailTitle", item.title);
  setText("#adminMetricDetailText", item.description);
  setHTML("#adminMetricDetailSummary", html);

  setText("#adminIndicatorDetailIcon", item.icon);
  setText("#adminIndicatorDetailTitle", item.title);
  setText("#adminIndicatorDetailText", item.description);
  setHTML("#adminIndicatorDetailSummary", html);

  if ($("#adminIndicatorDetailModal")) openModal("#adminIndicatorDetailModal");
  else openModal("#adminMetricDetailModal");
}

function renderAdminReportsTable(reports) {
  setHTML("#adminReportsTableBody", reports.map(item => `
    <tr>
      <td>
        <strong>${esc(item.name)}</strong>
        <small>${esc(formatDate(item.createdAt))}</small>
      </td>
      <td>${esc(item.type)}</td>
      <td>${esc(item.period)}</td>
      <td>${esc(item.format)}</td>
      <td><span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span></td>
      <td>${esc(item.owner)}</td>
      <td>
        <button type="button" data-action="view-report" data-report-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="download-report" data-report-id="${esc(item.id)}">Descargar</button>
      </td>
    </tr>
  `).join(""));

  $$("[data-action='view-report']").forEach(button => {
    button.addEventListener("click", () => openReportResult(button.dataset.reportId));
  });

  $$("[data-action='download-report']").forEach(button => {
    button.addEventListener("click", () => downloadExistingReport(button.dataset.reportId));
  });
}

function openAdminReportModal() {
  setValue("#adminReportType", "");
  setValue("#adminReportPeriod", "");
  setValue("#adminReportFormat", "");
  setValue("#adminReportScope", "");
  setValue("#adminReportComment", "");
  setChecked("#adminReportIncludeCharts", true);
  setChecked("#adminReportIncludeAudit", true);
  setChecked("#adminReportIncludeSla", true);
  setChecked("#adminReportIncludeSecurity", true);
  openModal("#adminReportModal");
}

function suggestAdminReport() {
  const types = getOptionList("tipos_reporte");
  const periods = getOptionList("periodos_reporte", "periodos");
  const formats = getOptionList("formatos_reporte", "formatos_exportacion");
  const scopes = getOptionList("alcances_reporte", "alcances");

  const firstValue = list => list.map(normalizeOption)[0]?.value || "";

  setValue("#adminReportType", firstValue(types) || "Resumen ejecutivo");
  setValue("#adminReportPeriod", getValue("#adminIndicatorPeriod") || firstValue(periods));
  setValue("#adminReportFormat", firstValue(formats) || "PDF");
  setValue("#adminReportScope", firstValue(scopes) || "Todos los módulos");

  setChecked("#adminReportIncludeCharts", true);
  setChecked("#adminReportIncludeAudit", true);
  setChecked("#adminReportIncludeSla", true);
  setChecked("#adminReportIncludeSecurity", true);
  setValue("#adminReportComment", "Reporte sugerido con métricas, auditoría, SLA, integraciones y seguridad.");

  toast("Reporte sugerido", "Se completó una configuración recomendada.", "success");
}

function collectAdminReportPayload() {
  return {
    tipo: getValue("#adminReportType"),
    periodo: getValue("#adminReportPeriod"),
    formato: getValue("#adminReportFormat"),
    alcance: getValue("#adminReportScope"),
    incluir_graficos: isChecked("#adminReportIncludeCharts"),
    incluir_auditoria: isChecked("#adminReportIncludeAudit"),
    incluir_sla: isChecked("#adminReportIncludeSla"),
    incluir_seguridad: isChecked("#adminReportIncludeSecurity"),
    comentario: getValue("#adminReportComment"),
    filtros: collectCurrentFilters()
  };
}

async function requestGenerateAdminReport() {
  const payload = collectAdminReportPayload();

  if (!payload.tipo || !payload.periodo || !payload.formato || !payload.alcance) {
    toast("Faltan datos", "Completa tipo, periodo, formato y alcance.", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "📈",
    title: "Generar reporte administrativo",
    text: "Se generará un reporte con los criterios seleccionados. La acción quedará registrada en auditoría.",
    impact: [
      { label: "Tipo", value: payload.tipo, impact: "Reporte", level: "medium" },
      { label: "Formato", value: payload.formato, impact: "Salida", level: "medium" },
      { label: "Alcance", value: payload.alcance, impact: "Información", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;

  try {
    openLoading("Generando reporte", "El backend está construyendo el archivo solicitado.");

    if (String(payload.formato).toLowerCase().includes("dashboard")) {
      const response = await apiJson("/admin/reportes/generar", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      closeLoading();
      closeModals();

      showResultModal({
        icon: "🔗",
        title: "Dashboard compartible generado",
        text: "Se generó un enlace temporal.",
        rows: [
          { icon: "🔗", label: "URL", value: response.url || response.link || "Pendiente de backend", type: "info" },
          { icon: "⏳", label: "Expiración", value: response.expiracion || response.expira || "Según configuración", type: "warning" }
        ]
      });

      await renderAdminIndicatorsPage();
      return;
    }

    await downloadFile(
      "/admin/reportes/generar",
      payload,
      `reporte_administrativo.${extensionByFormat(payload.formato)}`
    );

    closeLoading();
    closeModals();
    await renderAdminIndicatorsPage();

    toast("Reporte generado", "El reporte fue generado y descargado correctamente.", "success");
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo generar reporte", error.message);
  }
}

function openScheduleAdminReportModal() {
  openModal("#scheduleAdminReportModal");
}

async function requestScheduleAdminReport() {
  if (!getValue("#scheduleAdminReportFrequency") || !getValue("#scheduleAdminReportRecipients") || !isChecked("#scheduleAdminReportDeclaration")) {
    toast("Faltan datos", "Completa frecuencia, destinatarios y confirmación.", "warning");
    return;
  }

  const recipients = getValue("#scheduleAdminReportRecipients")
    .split(";")
    .map(x => x.trim())
    .filter(Boolean);

  const invalid = recipients.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  if (invalid) {
    toast("Correos inválidos", "Los destinatarios deben ser correos separados por punto y coma (;).", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "🗓️",
    title: "Programar reporte",
    text: "Se registrará una programación de envío de reporte.",
    impact: [
      { label: "Frecuencia", value: getValue("#scheduleAdminReportFrequency"), impact: "Automático", level: "medium" },
      { label: "Destinatarios", value: recipients.length, impact: "Notificación", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/reportes/programar", {
      method: "POST",
      body: JSON.stringify({
        frecuencia: getValue("#scheduleAdminReportFrequency"),
        destinatarios: recipients,
        motivo: confirmation.reason,
        filtros: collectCurrentFilters()
      })
    });

    closeModals();
    await renderAdminIndicatorsPage();
    toast("Reporte programado", "La programación fue registrada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo programar reporte", error.message);
  }
}

function openCompareIndicatorsModal() {
  setHTML("#advancedFilterBody", `
    <div class="form-grid">
      <div class="form-group">
        <label for="comparePeriodA">Periodo actual inicio</label>
        <input id="comparePeriodA" type="date" />
      </div>
      <div class="form-group">
        <label for="comparePeriodB">Periodo actual fin</label>
        <input id="comparePeriodB" type="date" />
      </div>
      <div class="form-group">
        <label for="comparePeriodC">Periodo anterior inicio</label>
        <input id="comparePeriodC" type="date" />
      </div>
      <div class="form-group">
        <label for="comparePeriodD">Periodo anterior fin</label>
        <input id="comparePeriodD" type="date" />
      </div>
      <div class="form-group">
        <label for="compareModule">Módulo</label>
        <select id="compareModule">
          ${(getOptionList("modulos").map(normalizeOption).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")) || `<option value="">Todos</option>`}
        </select>
      </div>
    </div>
  `);

  setText("#advancedFilterTitle", "Comparar indicadores");
  setText("#advancedFilterText", "Selecciona dos periodos para comparar variaciones.");
  openModal("#advancedFilterModal");

  $("#applyAdvancedFilterBtn").onclick = confirmCompareIndicators;
  $("#clearAdvancedFilterBtn").onclick = () => {
    ["#comparePeriodA", "#comparePeriodB", "#comparePeriodC", "#comparePeriodD"].forEach(selector => setValue(selector, ""));
  };
}

async function confirmCompareIndicators() {
  if (!getValue("#comparePeriodA") || !getValue("#comparePeriodB") || !getValue("#comparePeriodC") || !getValue("#comparePeriodD")) {
    toast("Fechas requeridas", "Completa ambos rangos de comparación.", "warning");
    return;
  }

  try {
    openLoading("Comparando indicadores", "El backend está calculando variaciones.");

    const response = await apiJson("/admin/indicadores-reportes/comparar", {
      method: "POST",
      body: JSON.stringify({
        periodo_actual_inicio: getValue("#comparePeriodA"),
        periodo_actual_fin: getValue("#comparePeriodB"),
        periodo_anterior_inicio: getValue("#comparePeriodC"),
        periodo_anterior_fin: getValue("#comparePeriodD"),
        modulo: getValue("#compareModule")
      })
    });

    closeLoading();
    closeModals();

    const rows = response.items || response.resultados || [];

    showResultModal({
      icon: "📊",
      title: "Comparación de indicadores",
      text: response.resumen || "Comparación generada correctamente.",
      rows: rows.map(item => ({
        icon: item.icon || "📈",
        label: item.indicador || item.nombre || "Indicador",
        value: item.variacion || item.resultado || item.valor || "-",
        type: statusType(item.estado || item.tipo || "info")
      }))
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo comparar indicadores", error.message);
  }
}

function openReportResult(id) {
  const report = getItem(State.reports, id, normalizeReport);
  if (!report) return;

  State.selectedReportId = id;

  showResultModal({
    icon: "📄",
    title: report.name,
    text: "Detalle del reporte administrativo.",
    rows: [
      { icon: "📌", label: "Tipo", value: report.type, type: "info" },
      { icon: "🗓️", label: "Periodo", value: report.period, type: "info" },
      { icon: "📤", label: "Formato", value: report.format, type: "warning" },
      { icon: "✅", label: "Estado", value: report.status, type: statusType(report.status) },
      { icon: "👤", label: "Responsable", value: report.owner, type: "info" }
    ]
  });
}

async function downloadExistingReport(id) {
  const report = getItem(State.reports, id, normalizeReport);
  if (!report) return;

  const confirmation = await confirmAction({
    icon: "📥",
    title: "Descargar reporte",
    text: "La descarga quedará registrada en auditoría.",
    impact: [
      { label: "Reporte", value: report.name, impact: report.format, level: "medium" },
      { label: "Estado", value: report.status, impact: "Descarga", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await downloadFile(`/admin/reportes/${encodeURIComponent(id)}/descargar`, {
      motivo: confirmation.reason
    }, `${report.name}.${extensionByFormat(report.format)}`);

    toast("Reporte descargado", "La descarga fue generada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo descargar reporte", error.message);
  }
}

/* =========================================================
   INTEGRACIONES
========================================================= */

async function initIntegrations() {
  bindIntegrationEvents();
  await renderIntegrationsPage();
}

function bindIntegrationEvents() {
  $("#integrationSearch")?.addEventListener("input", debounce(renderIntegrationsPage, 250));

  $$("[data-integration-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.integrationFilter = button.dataset.integrationFilter || "todos";
      $$("[data-integration-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderIntegrationsPage();
    });
  });

  $("#toggleIntegrationsViewBtn")?.addEventListener("click", () => {
    State.integrationView = State.integrationView === "cards" ? "table" : "cards";
    setText("#toggleIntegrationsViewBtn", State.integrationView === "cards" ? "Vista tabla" : "Vista cards");
    renderIntegrationsPage();
  });

  $("#refreshIntegrationsBtn")?.addEventListener("click", async () => {
    State.integrations = [];
    await renderIntegrationsPage();
  });

  $("#refreshIntegrationStatusBtn")?.addEventListener("click", renderIntegrationsPage);
  $("#refreshIntegrationSyncBtn")?.addEventListener("click", renderIntegrationsPage);
  $("#refreshWebhookEventsBtn")?.addEventListener("click", renderIntegrationsPage);
  $("#openCreateIntegrationBtn")?.addEventListener("click", openCreateIntegrationModal);
  $("#testAllIntegrationsBtn")?.addEventListener("click", requestTestAllIntegrations);
  $("#exportIntegrationsBtn")?.addEventListener("click", () => openExportModal("integraciones"));
  $("#exportWebhookEventsBtn")?.addEventListener("click", () => openExportModal("webhooks"));
  $("#integrationEditBtn")?.addEventListener("click", () => { closeModals(); openEditIntegrationModal(State.selectedIntegrationId); });
  $("#integrationTestBtn")?.addEventListener("click", () => requestTestIntegration(State.selectedIntegrationId));
  $("#integrationLogsBtn")?.addEventListener("click", () => openIntegrationLogsModal(State.selectedIntegrationId));
  $("#saveIntegrationBtn")?.addEventListener("click", requestSaveIntegration);
  $("#suggestIntegrationBtn")?.addEventListener("click", validateIntegrationWithBackend);
  $("#exportIntegrationLogsBtn")?.addEventListener("click", () => {
    openExportModal("logsIntegracion", { integracion_id: State.selectedIntegrationId });
  });
}

async function loadIntegrations() {
  const response = await apiJson(`/admin/integraciones${buildQuery({
    q: getValue("#integrationSearch"),
    filtro: State.integrationFilter
  })}`);

  State.integrations = response.items || response.integrations || response.integraciones || [];
  State.webhooks = response.webhooks || response.events || response.eventos || [];
  return response;
}

function integrationsFiltered() {
  const query = getValue("#integrationSearch").toLowerCase();

  return State.integrations.map(normalizeIntegration).filter(item => {
    const text = `${item.name} ${item.type} ${item.status} ${item.owner} ${item.endpoint} ${item.criticality}`.toLowerCase();
    const filter = State.integrationFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "activas" && item.status === "Activa") ||
      (filter === "alerta" && item.status === "Con alerta") ||
      (filter === "error" && item.status === "Error") ||
      item.filterType.toLowerCase().includes(filter) ||
      item.type.toLowerCase().includes(filter);

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderIntegrationsPage() {
  try {
    await loadIntegrations();

    const rows = integrationsFiltered();
    const all = State.integrations.map(normalizeIntegration);

    setText("#integrationsSummaryTitle", `${all.length} integraciones configuradas`);
    setText("#integrationsSummaryText", `${rows.length} integraciones visibles según filtro.`);

    renderKpis("#integrationsKpiGrid", [
      { icon: "🔌", value: all.length, label: "Integraciones", description: "Total configurado" },
      { icon: "✅", value: all.filter(i => i.status === "Activa").length, label: "Activas", description: "Operativas" },
      { icon: "⚠️", value: all.filter(i => i.status === "Con alerta").length, label: "Con alerta", description: "Requieren revisión" },
      { icon: "🚨", value: all.filter(i => i.status === "Error").length, label: "Error", description: "Fallas técnicas" }
    ]);

    renderDonut("#integrationStatusDonut", "#integrationStatusLegend", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })), "Integraciones");
    renderBarChart("#integrationSyncChart", all.map(i => ({
      label: i.name,
      value: i.status === "Activa" ? 3 : i.status === "Con alerta" ? 2 : 1
    })));

    setHTML("#integrationCardList", rows.map(integrationCard).join(""));
    setHTML("#integrationTableBody", rows.map(integrationTableRow).join(""));
    renderActivity("#webhookEventsTimeline", State.webhooks);

    show($("#integrationCardList"), State.integrationView === "cards");
    show($("#integrationTableWrap"), State.integrationView === "table");
    show($("#emptyIntegrationsState"), !rows.length);

    renderAi("#integrationsAiSummary", [
      { title: "Prioridad técnica", text: "Revisa integraciones en error y servicios de criticidad alta." },
      { title: "Seguridad", text: "No expongas credenciales en endpoint, descripción o logs visibles." }
    ]);

    renderChecklist("#integrationsActionPlan", [
      { icon: "1", title: "Probar conexión", text: "Validar endpoint, latencia y respuesta." },
      { icon: "2", title: "Revisar errores", text: "Corregir integraciones en estado Error." },
      { icon: "3", title: "Auditar cambios", text: "Registrar modificación de credenciales o endpoint." }
    ]);

    bindIntegrationActions($("#integrationCardList"));
    bindIntegrationActions($("#integrationTableBody"));
  } catch (error) {
    renderAi("#integrationsAiSummary", [{ title: "No se pudieron cargar integraciones", text: error.message }]);
  }
}

function integrationCard(item) {
  return `
    <article class="integration-card">
      <span class="integration-card__icon">${esc(item.icon)}</span>
      <div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.description)}</p>
        <small>${esc(item.type)} · ${esc(formatDate(item.lastSync))} · ${esc(item.owner)}</small>
      </div>
      <span class="${pillClass(statusType(item.status))}">${esc(item.status)}</span>
      <div class="service-actions">
        <button type="button" data-action="view-integration" data-integration-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="edit-integration" data-integration-id="${esc(item.id)}">Editar</button>
        <button type="button" data-action="test-integration" data-integration-id="${esc(item.id)}">Probar</button>
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
      <td>${esc(formatDate(item.lastSync))}</td>
      <td>${esc(item.owner)}</td>
      <td>${esc(item.criticality)}</td>
      <td>
        <button type="button" data-action="view-integration" data-integration-id="${esc(item.id)}">Ver</button>
        <button type="button" data-action="test-integration" data-integration-id="${esc(item.id)}">Probar</button>
      </td>
    </tr>
  `;
}

function bindIntegrationActions(root = document) {
  $$("[data-action='view-integration']", root).forEach(button => {
    button.addEventListener("click", () => openIntegrationDetail(button.dataset.integrationId));
  });

  $$("[data-action='edit-integration']", root).forEach(button => {
    button.addEventListener("click", () => openEditIntegrationModal(button.dataset.integrationId));
  });

  $$("[data-action='test-integration']", root).forEach(button => {
    button.addEventListener("click", () => requestTestIntegration(button.dataset.integrationId));
  });
}

function integrationSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Nombre", item.name],
    ["Tipo", item.type],
    ["Estado", item.status],
    ["Ambiente", item.environment],
    ["Última sincronización", formatDate(item.lastSync)],
    ["Responsable", item.owner],
    ["Criticidad", item.criticality],
    ["Código HTTP", item.lastCode],
    ["Latencia", item.latency],
    ["Endpoint", item.endpoint]
  ]);
}

function openIntegrationDetail(id) {
  const item = getItem(State.integrations, id, normalizeIntegration);
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
  setText("#integrationFormTitle", "Crear integración");
  setText("#integrationFormText", "Configura servicio externo, endpoint y criticidad.");

  ["#integrationName", "#integrationType", "#integrationStatus", "#integrationCriticality", "#integrationEndpoint", "#integrationDescription"].forEach(selector => setValue(selector, ""));
  setChecked("#integrationDeclaration", false);
  openModal("#integrationFormModal");
}

function openEditIntegrationModal(id) {
  const item = getItem(State.integrations, id, normalizeIntegration);
  if (!item) return;

  State.selectedIntegrationId = id;

  setText("#integrationFormEyebrow", "Editar integración");
  setText("#integrationFormTitle", item.name);
  setText("#integrationFormText", "Modifica la configuración técnica de la integración.");

  setValue("#integrationName", item.name);
  setValue("#integrationType", item.raw.tipo_id || item.type);
  setValue("#integrationStatus", item.raw.estado_id || item.status);
  setValue("#integrationCriticality", item.raw.criticidad_id || item.criticality);
  setValue("#integrationEndpoint", item.endpoint);
  setValue("#integrationDescription", item.description);
  setChecked("#integrationDeclaration", false);

  openModal("#integrationFormModal");
}

function collectIntegrationPayload() {
  return {
    nombre: getValue("#integrationName"),
    tipo: getValue("#integrationType"),
    estado: getValue("#integrationStatus"),
    criticidad: getValue("#integrationCriticality"),
    endpoint: getValue("#integrationEndpoint"),
    descripcion: getValue("#integrationDescription")
  };
}

async function requestSaveIntegration() {
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

  const payload = collectIntegrationPayload();
  const current = State.selectedIntegrationId ? getItem(State.integrations, State.selectedIntegrationId, normalizeIntegration) : null;

  const confirmation = await confirmAction({
    icon: "🔌",
    title: State.selectedIntegrationId ? "Confirmar actualización de integración" : "Confirmar creación de integración",
    text: "Los cambios en integraciones pueden afectar correo, CRM, webhooks, autenticación o notificaciones.",
    warning: "Verifica que no haya credenciales visibles en endpoint o descripción.",
    impact: [
      { label: "Integración", value: payload.nombre, impact: State.selectedIntegrationId ? "Actualización" : "Nueva", level: "medium" },
      { label: "Estado", value: current ? `${current.status} → ${payload.estado}` : payload.estado, impact: "Operativo", level: "high" },
      { label: "Criticidad", value: current ? `${current.criticality} → ${payload.criticidad}` : payload.criticidad, impact: "Riesgo", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;

  try {
    await apiJson(State.selectedIntegrationId
      ? `/admin/integraciones/${encodeURIComponent(State.selectedIntegrationId)}`
      : "/admin/integraciones", {
      method: State.selectedIntegrationId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModals();
    State.integrations = [];
    await renderIntegrationsPage();
    await updateGlobalBadges();
    toast("Integración guardada", "La integración fue registrada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar integración", error.message);
  }
}

async function validateIntegrationWithBackend() {
  try {
    const response = await apiJson("/admin/integraciones/validar-item", {
      method: "POST",
      body: JSON.stringify({
        ...collectIntegrationPayload(),
        integracion_id: State.selectedIntegrationId
      })
    });

    const items = response.items || response.observaciones || [];

    showResultModal({
      icon: items.length ? "⚠️" : "✅",
      title: "Validación de integración",
      text: items.length ? "Se encontraron observaciones." : "La integración no presenta observaciones.",
      rows: items.map(item => ({
        icon: "🔌",
        label: item.campo || item.tipo || "Validación",
        value: item.mensaje || item.descripcion || "-",
        type: statusType(item.severidad || "warning")
      }))
    });
  } catch (error) {
    genericModal("!", "No se pudo validar integración", error.message);
  }
}

async function requestTestIntegration(id) {
  if (!id) return;

  const item = getItem(State.integrations, id, normalizeIntegration);

  const confirmation = await confirmAction({
    icon: "🧪",
    title: "Probar conexión",
    text: "Se ejecutará una prueba técnica contra la integración seleccionada.",
    impact: [
      { label: "Integración", value: item?.name || id, impact: "Prueba", level: "medium" },
      { label: "Criticidad", value: item?.criticality || "-", impact: "Técnico", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  await testIntegration(id, confirmation.reason);
}

async function testIntegration(id, reason = "") {
  try {
    openLoading("Probando conexión", "El backend está ejecutando healthcheck de integración.");

    const response = await apiJson(`/admin/integraciones/${encodeURIComponent(id)}/probar`, {
      method: "POST",
      body: JSON.stringify({ motivo: reason })
    });

    closeLoading();

    State.integrations = [];
    await renderIntegrationsPage();

    showResultModal({
      icon: statusType(response.estado || response.status) === "danger" ? "🚨" : "✅",
      title: "Resultado de prueba de conexión",
      text: response.mensaje || response.message || "Prueba registrada correctamente.",
      rows: [
        { icon: "🔌", label: "Estado", value: response.estado || response.status || "Procesado", type: statusType(response.estado || response.status) },
        { icon: "🌐", label: "Código HTTP", value: response.codigo_http || response.http_code || "-", type: "info" },
        { icon: "⏱️", label: "Latencia", value: response.latencia_ms ? `${response.latencia_ms} ms` : "-", type: "info" },
        { icon: "🕘", label: "Fecha", value: formatDate(response.fecha || new Date()), type: "info" }
      ],
      log: response.log || ""
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo probar integración", error.message);
  }
}

async function requestTestAllIntegrations() {
  const confirmation = await confirmAction({
    icon: "🧪",
    title: "Probar todas las integraciones",
    text: "Se ejecutarán pruebas de conexión para todos los servicios configurados.",
    warning: "Esta acción puede tardar y generará eventos de auditoría técnica.",
    impact: [
      { label: "Integraciones", value: State.integrations.length, impact: "Masivo", level: "high" },
      { label: "Alcance", value: "Todas", impact: "Healthcheck", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Probando integraciones", "El backend está validando conexiones.");

    const response = await apiJson("/admin/integraciones/probar-todas", {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeLoading();

    State.integrations = [];
    await renderIntegrationsPage();

    const rows = response.resultados || response.items || [];

    showResultModal({
      icon: "🧪",
      title: "Pruebas ejecutadas",
      text: response.mensaje || "Se completó la validación de integraciones.",
      rows: rows.map(item => ({
        icon: "🔌",
        label: item.integracion || item.nombre || "Integración",
        value: `${item.estado || item.status || "-"} · ${item.codigo_http || "-"} · ${item.latencia_ms || "-"} ms`,
        type: statusType(item.estado || item.status)
      }))
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudieron probar integraciones", error.message);
  }
}

async function openIntegrationLogsModal(id) {
  const item = getItem(State.integrations, id, normalizeIntegration);
  if (!item) return;

  State.selectedIntegrationId = id;
  setText("#integrationLogsTitle", `Eventos de ${item.name}`);

  try {
    const response = await apiJson(`/admin/integraciones/${encodeURIComponent(id)}/logs`);
    renderActivity("#integrationLogsTimeline", response.items || response.logs || []);
  } catch (error) {
    renderActivity("#integrationLogsTimeline", [{ icon: "⚠️", title: "No se pudieron cargar logs", text: error.message, date: "" }]);
  }

  openModal("#integrationLogsModal");
}

/* =========================================================
   AUDITORÍA ADMIN
========================================================= */

async function initAdminAudit() {
  bindAuditEvents();
  await renderAdminAuditPage();
}

function bindAuditEvents() {
  $("#adminAuditSearch")?.addEventListener("input", debounce(() => {
    State.pagination.audit.page = 1;
    renderAdminAuditPage();
  }, 300));

  $$("[data-admin-audit-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.auditFilter = button.dataset.adminAuditFilter || "todos";
      State.pagination.audit.page = 1;
      $$("[data-admin-audit-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderAdminAuditPage();
    });
  });

  $("#refreshAuditTypeChartBtn")?.addEventListener("click", renderAdminAuditPage);
  $("#refreshAuditRiskBtn")?.addEventListener("click", renderAdminAuditPage);
  $("#refreshAuditEventsBtn")?.addEventListener("click", async () => {
    State.audit = [];
    await renderAdminAuditPage();
  });

  $("#compareAuditEventsBtn")?.addEventListener("click", () => openModal("#adminAuditCompareModal"));
  $("#downloadAuditEventsBtn")?.addEventListener("click", () => openExportModal("auditoria"));
  $("#exportAdminAuditBtn")?.addEventListener("click", () => openExportModal("auditoria"));
  $("#adminAuditDownloadDetailBtn")?.addEventListener("click", () => openExportModal("auditoriaDetalle", { auditoria_id: State.selectedAuditId }));
  $("#adminAuditCompareDetailBtn")?.addEventListener("click", () => openModal("#adminAuditCompareModal"));
  $("#confirmAdminAuditCompareBtn")?.addEventListener("click", requestAdminAuditCompare);
}

async function loadAudit() {
  const p = State.pagination.audit;

  const response = await apiJson(`/admin/auditoria${buildQuery({
    q: getValue("#adminAuditSearch"),
    filtro: State.auditFilter,
    page: p.page,
    page_size: p.pageSize
  })}`);

  State.audit = response.items || response.audit || response.auditoria || [];
  p.total = Number(response.total ?? State.audit.length);

  return State.audit;
}

function adminAuditFiltered() {
  const query = getValue("#adminAuditSearch").toLowerCase();

  return State.audit.map(normalizeAudit).filter(item => {
    const text = `${item.module} ${item.action} ${item.user} ${item.before} ${item.after} ${item.result} ${item.ip} ${item.detail} ${item.sensitivity}`.toLowerCase();
    const filter = State.auditFilter;

    const matchesFilter =
      filter === "todos" ||
      item.type.includes(filter) ||
      item.module.toLowerCase().includes(filter) ||
      (filter === "criticos" && item.critical);

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderAdminAuditPage() {
  try {
    await loadAudit();

    const rows = adminAuditFiltered();
    const all = State.audit.map(normalizeAudit);

    setText("#auditSummaryTitle", `${rows.length} eventos visibles`);
    setText("#auditSummaryText", "Auditoría administrativa conectada al sistema.");

    renderKpis("#adminAuditKpiGrid", [
      { icon: "🕵️", value: all.length, label: "Eventos", description: "Trazabilidad registrada" },
      { icon: "⚠️", value: all.filter(a => a.critical).length, label: "Críticos", description: "Requieren revisión" },
      { icon: "👤", value: all.filter(a => a.type.includes("usuario")).length, label: "Usuarios", description: "Cambios de acceso" },
      { icon: "🔐", value: all.filter(a => a.type.includes("rol")).length, label: "Roles", description: "Permisos o perfiles" }
    ]);

    renderBarChart("#adminAuditTypeChart", Object.entries(countBy(all, "module")).map(([label, value]) => ({ label, value })));
    renderAdminAuditRisk(all);
    renderAdminAuditTable(rows);
    ensureTableFooter("#adminAuditTableBody", "audit", renderAdminAuditPage);

    renderAi("#adminAuditAiSummary", [
      { title: "Eventos sensibles", text: "Prioriza cambios de usuarios, permisos, SLA, configuración e integraciones." },
      { title: "Trazabilidad", text: "Revisa antes/después, usuario ejecutor, resultado, IP y sensibilidad." }
    ]);

    renderChecklist("#adminAuditActionPlan", [
      { icon: "1", title: "Filtrar críticos", text: "Revisar eventos marcados como sensibles." },
      { icon: "2", title: "Comparar cambios", text: "Validar antes/después en permisos y SLA." },
      { icon: "3", title: "Exportar evidencia", text: "Guardar soporte para control administrativo." }
    ]);

    show($("#emptyAdminAuditState"), !rows.length);
  } catch (error) {
    renderAi("#adminAuditAiSummary", [{ title: "No se pudo cargar auditoría", text: error.message }]);
  }
}

function renderAdminAuditRisk(rows) {
  const critical = rows.filter(a => a.critical).slice(0, 6);

  setHTML("#adminAuditRiskList", critical.map(item => `
    <article class="admin-alert-item">
      <span class="admin-alert-item__icon">⚠️</span>
      <div>
        <strong>${esc(item.action)}</strong>
        <p>${esc(item.module)} · ${esc(item.detail)}</p>
        <small>${esc(formatDate(item.date))} · ${esc(item.user)} · ${esc(item.sensitivity)}</small>
      </div>
      <button type="button" data-audit-id="${esc(item.id)}">Ver</button>
    </article>
  `).join(""));

  $$("[data-audit-id]").forEach(button => {
    button.addEventListener("click", () => openAdminAuditDetail(button.dataset.auditId));
  });
}

function renderAdminAuditTable(rows) {
  setHTML("#adminAuditTableBody", rows.map(item => `
    <tr>
      <td>${esc(formatDate(item.date))}</td>
      <td>${esc(item.module)}</td>
      <td>${esc(item.action)}</td>
      <td>${esc(item.user)}</td>
      <td>${esc(shortAuditValue(item.before))}</td>
      <td>${esc(shortAuditValue(item.after))}</td>
      <td><span class="${pillClass(statusType(item.result))}">${esc(item.result)}</span></td>
      <td><button type="button" data-audit-detail="${esc(item.id)}">Ver</button></td>
    </tr>
  `).join(""));

  $$("[data-audit-detail]").forEach(button => {
    button.addEventListener("click", () => openAdminAuditDetail(button.dataset.auditDetail));
  });
}

function shortAuditValue(value) {
  const text = String(value ?? "-");
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function openAdminAuditDetail(id) {
  const item = getItem(State.audit, id, normalizeAudit);
  if (!item) return;

  State.selectedAuditId = id;

  setText("#adminAuditDetailIcon", item.critical ? "⚠️" : "🕵️");
  setText("#adminAuditDetailTitle", item.action);
  setText("#adminAuditDetailText", item.detail);

  const diff = Array.isArray(item.diff) && item.diff.length
    ? `
      <div class="diff-table">
        ${item.diff.map(row => `
          <div class="diff-row">
            <span>${esc(row.campo || row.field || "Campo")}</span>
            <strong class="diff-before">${esc(row.antes || row.before || "-")}</strong>
            <strong class="diff-after">${esc(row.despues || row.after || "-")}</strong>
            <em class="diff-impact">${esc(row.impacto || row.impact || "Cambio")}</em>
          </div>
        `).join("")}
      </div>
    `
    : "";

  setHTML("#adminAuditDetailSummary", summaryHTML([
    ["Fecha", formatDate(item.date)],
    ["Módulo", item.module],
    ["Usuario", item.user],
    ["Entidad", item.entity],
    ["Resultado", item.result],
    ["Sensibilidad", item.sensitivity],
    ["IP", item.ip],
    ["Origen", item.origin]
  ]) + diff);

  openModal("#adminAuditDetailModal");
}

async function requestAdminAuditCompare() {
  if (!getValue("#adminAuditCompareModule") || !getValue("#adminAuditCompareType") || !isChecked("#adminAuditCompareDeclaration")) {
    toast("Faltan datos", "Completa módulo, tipo de comparación y confirmación.", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "🔎",
    title: "Comparar eventos administrativos",
    text: "Se ejecutará una comparación de auditoría con los criterios seleccionados.",
    impact: [
      { label: "Módulo", value: getValue("#adminAuditCompareModule"), impact: "Auditoría", level: "medium" },
      { label: "Comparación", value: getValue("#adminAuditCompareType"), impact: "Análisis", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Comparando auditoría", "El backend está analizando eventos.");

    const response = await apiJson("/admin/auditoria/comparar", {
      method: "POST",
      body: JSON.stringify({
        modulo: getValue("#adminAuditCompareModule"),
        tipo: getValue("#adminAuditCompareType"),
        motivo: confirmation.reason
      })
    });

    closeLoading();
    closeModals();

    const rows = response.items || response.resultados || [];

    showResultModal({
      icon: "🔎",
      title: "Comparación generada",
      text: response.resumen || "La comparación fue generada correctamente.",
      rows: rows.map(item => ({
        icon: item.icon || "🕵️",
        label: item.titulo || item.nombre || "Resultado",
        value: item.valor || item.descripcion || item.detalle || "-",
        type: statusType(item.estado || item.severidad || "info")
      }))
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo comparar auditoría", error.message);
  }
}

/* =========================================================
   RESPALDO
========================================================= */

async function initBackup() {
  bindBackupEvents();
  await renderBackupPage();
}

function bindBackupEvents() {
  $("#backupSearch")?.addEventListener("input", debounce(renderBackupPage, 250));

  $$("[data-backup-filter]").forEach(button => {
    button.addEventListener("click", () => {
      State.backupFilter = button.dataset.backupFilter || "todos";
      $$("[data-backup-filter]").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      renderBackupPage();
    });
  });

  $("#refreshBackupChartBtn")?.addEventListener("click", renderBackupPage);
  $("#refreshBackupStatusBtn")?.addEventListener("click", renderBackupPage);
  $("#refreshBackupHistoryBtn")?.addEventListener("click", async () => {
    State.backups = [];
    await renderBackupPage();
  });

  $("#runBackupNowBtn")?.addEventListener("click", requestRunBackupNow);
  $("#scheduleBackupBtn")?.addEventListener("click", () => openModal("#scheduleBackupModal"));
  $("#validateBackupBtn")?.addEventListener("click", requestValidateLastBackup);
  $("#exportBackupHistoryBtn")?.addEventListener("click", () => openExportModal("respaldo"));
  $("#openRestoreTestBtn")?.addEventListener("click", () => openModal("#restoreTestModal"));
  $("#refreshRestoreTimelineBtn")?.addEventListener("click", renderBackupPage);
  $("#backupValidateBtn")?.addEventListener("click", requestValidateSelectedBackup);
  $("#backupRestoreBtn")?.addEventListener("click", requestPrepareBackupRestore);
  $("#backupDownloadLogBtn")?.addEventListener("click", () => openExportModal("logRespaldo", { respaldo_id: State.selectedBackupId }));
  $("#confirmScheduleBackupBtn")?.addEventListener("click", requestScheduleBackup);
  $("#confirmRestoreTestBtn")?.addEventListener("click", requestRestoreTest);
}

async function loadBackups() {
  const response = await apiJson(`/admin/respaldo${buildQuery({
    q: getValue("#backupSearch"),
    filtro: State.backupFilter
  })}`);

  State.backups = response.items || response.backups || response.respaldos || [];
  State.restoreEvents = response.restore_events || response.restauraciones || [];
  return response;
}

function backupFiltered() {
  const query = getValue("#backupSearch").toLowerCase();

  return State.backups.map(normalizeBackup).filter(item => {
    const text = `${item.date} ${item.type} ${item.status} ${item.size} ${item.location} ${item.validation}`.toLowerCase();
    const filter = State.backupFilter;

    const matchesFilter =
      filter === "todos" ||
      (filter === "completados" && item.status === "Completado") ||
      (filter === "fallidos" && item.status === "Fallido") ||
      (filter === "programados" && item.status === "Programado") ||
      (filter === "verificados" && item.validation === "Verificado") ||
      text.includes(filter);

    return (!query || text.includes(query)) && matchesFilter;
  });
}

async function renderBackupPage() {
  try {
    await loadBackups();

    const rows = backupFiltered();
    const all = State.backups.map(normalizeBackup);

    setText("#backupSummaryTitle", all[0] ? `Último respaldo: ${all[0].status}` : "Sin respaldos");
    setText("#backupSummaryText", all[0] ? `${formatDate(all[0].date)} · ${all[0].validation}` : "No hay historial disponible.");

    renderKpis("#backupKpiGrid", [
      { icon: "💾", value: all.length, label: "Respaldos", description: "Historial registrado" },
      { icon: "✅", value: all.filter(b => b.status === "Completado").length, label: "Completados", description: "Copias correctas" },
      { icon: "🚨", value: all.filter(b => b.status === "Fallido").length, label: "Fallidos", description: "Requieren revisión" },
      { icon: "🧪", value: all.filter(b => b.validation === "Verificado").length, label: "Verificados", description: "Validación completada" }
    ]);

    renderBarChart("#backupWeeklyChart", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })));
    renderDonut("#backupStatusDonut", "#backupStatusLegend", Object.entries(countBy(all, "status")).map(([label, value]) => ({ label, value })), "Copias");
    renderBackupTable(rows);
    renderActivity("#restoreTimeline", State.restoreEvents);

    renderAi("#backupAiSummary", [
      { title: "Continuidad", text: "Valida respaldos fallidos y confirma restauración periódica." },
      { title: "Prioridad", text: "Un respaldo completado no es suficiente si no fue verificado." }
    ]);

    renderChecklist("#backupActionPlan", [
      { icon: "1", title: "Validar último respaldo", text: "Confirmar integridad de la copia." },
      { icon: "2", title: "Revisar fallidos", text: "Corregir errores de ejecución." },
      { icon: "3", title: "Probar restauración", text: "Programar prueba en ambiente seguro." }
    ]);

    show($("#emptyBackupState"), !rows.length);
  } catch (error) {
    renderAi("#backupAiSummary", [{ title: "No se pudo cargar respaldo", text: error.message }]);
  }
}

function renderBackupTable(rows) {
  setHTML("#backupTableBody", rows.map(item => `
    <tr>
      <td>${esc(formatDate(item.date))}</td>
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

  $$("[data-backup-id]").forEach(button => {
    button.addEventListener("click", () => openBackupDetail(button.dataset.backupId));
  });
}

function backupSummary(item) {
  return summaryHTML([
    ["Código", item.id],
    ["Fecha", formatDate(item.date)],
    ["Tipo", item.type],
    ["Estado", item.status],
    ["Tamaño", item.size],
    ["Ubicación", item.location],
    ["Validación", item.validation],
    ["Duración", item.duration],
    ["RPO", item.rpo],
    ["RTO", item.rto],
    ["Integridad", item.hash],
    ["Responsable", item.owner]
  ]);
}

function openBackupDetail(id) {
  const item = getItem(State.backups, id, normalizeBackup);
  if (!item) return;

  State.selectedBackupId = id;

  setText("#backupDetailIcon", item.status === "Fallido" ? "🚨" : "💾");
  setText("#backupDetailTitle", `${item.type} · ${formatDate(item.date)}`);
  setText("#backupDetailText", `Estado: ${item.status}. Validación: ${item.validation}.`);
  setHTML("#backupDetailSummary", backupSummary(item));

  openModal("#backupDetailModal");
}

async function requestRunBackupNow() {
  const confirmation = await confirmAction({
    icon: "💾",
    title: "Ejecutar respaldo",
    text: "Se iniciará una ejecución de respaldo desde el sistema.",
    warning: "Verifica que no interfiera con operación crítica.",
    impact: [
      { label: "Acción", value: "Ejecución inmediata", impact: "Crítico", level: "high" },
      { label: "Módulo", value: "Respaldo", impact: "Continuidad", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Ejecutando respaldo", "El backend está iniciando la copia de seguridad.");

    const response = await apiJson("/admin/respaldo/ejecutar", {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeLoading();

    State.backups = [];
    await renderBackupPage();

    showResultModal({
      icon: "💾",
      title: "Respaldo iniciado",
      text: response.mensaje || "La ejecución fue registrada correctamente.",
      rows: [
        { icon: "📌", label: "Estado", value: response.estado || "Iniciado", type: statusType(response.estado || "success") },
        { icon: "🕘", label: "Fecha", value: formatDate(response.fecha || new Date()), type: "info" },
        { icon: "💽", label: "Tamaño estimado", value: response.tamano_estimado || "-", type: "info" }
      ]
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo ejecutar respaldo", error.message);
  }
}

async function requestValidateLastBackup() {
  const latest = State.backups.map(normalizeBackup)[0];

  if (!latest) {
    toast("Sin respaldos", "No existe un respaldo para validar.", "warning");
    return;
  }

  State.selectedBackupId = latest.id;
  await requestValidateSelectedBackup();
}

async function requestValidateSelectedBackup() {
  if (!State.selectedBackupId) return;

  const item = getItem(State.backups, State.selectedBackupId, normalizeBackup);

  const confirmation = await confirmAction({
    icon: "🧪",
    title: "Validar respaldo",
    text: "Se revisará integridad, disponibilidad y consistencia de la copia seleccionada.",
    impact: [
      { label: "Respaldo", value: item ? `${item.type} · ${formatDate(item.date)}` : State.selectedBackupId, impact: "Validación", level: "medium" },
      { label: "Estado actual", value: item?.validation || "-", impact: "Continuidad", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    openLoading("Validando respaldo", "El backend está revisando integridad.");

    const response = await apiJson(`/admin/respaldo/${encodeURIComponent(State.selectedBackupId)}/validar`, {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    closeLoading();

    State.backups = [];
    await renderBackupPage();

    showResultModal({
      icon: statusType(response.estado || response.status) === "danger" ? "🚨" : "✅",
      title: "Validación de respaldo",
      text: response.mensaje || "La validación fue registrada.",
      rows: [
        { icon: "✅", label: "Resultado", value: response.estado || response.status || "Validado", type: statusType(response.estado || response.status) },
        { icon: "💽", label: "Tamaño", value: response.tamano || "-", type: "info" },
        { icon: "🔐", label: "Integridad", value: response.hash || response.integridad || "-", type: "info" }
      ]
    });
  } catch (error) {
    closeLoading();
    genericModal("!", "No se pudo validar respaldo", error.message);
  }
}

async function requestScheduleBackup() {
  if (!getValue("#backupFrequency") || !getValue("#backupType") || !getValue("#backupWindow") || !getValue("#backupRetention") || !isChecked("#backupScheduleDeclaration")) {
    toast("Faltan datos", "Completa frecuencia, tipo, ventana, retención y confirmación.", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "🗓️",
    title: "Programar respaldo",
    text: "Se registrará una programación de respaldo.",
    impact: [
      { label: "Frecuencia", value: getValue("#backupFrequency"), impact: "Automático", level: "medium" },
      { label: "Tipo", value: getValue("#backupType"), impact: "Copia", level: "medium" },
      { label: "Ventana", value: getValue("#backupWindow"), impact: "Operación", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/respaldo/programar", {
      method: "POST",
      body: JSON.stringify({
        frecuencia: getValue("#backupFrequency"),
        tipo: getValue("#backupType"),
        ventana: getValue("#backupWindow"),
        retencion: getValue("#backupRetention"),
        motivo: confirmation.reason
      })
    });

    closeModals();
    State.backups = [];
    await renderBackupPage();
    toast("Respaldo programado", "La programación fue registrada correctamente.", "success");
  } catch (error) {
    genericModal("!", "No se pudo programar respaldo", error.message);
  }
}

async function requestPrepareBackupRestore() {
  const item = getItem(State.backups, State.selectedBackupId, normalizeBackup);

  const confirmation = await confirmAction({
    icon: "♻️",
    title: "Preparar restauración",
    text: "Se preparará una solicitud controlada de restauración. No se restaurará información directamente.",
    warning: "Toda restauración debe ejecutarse primero en ambiente seguro.",
    impact: [
      { label: "Respaldo", value: item ? `${item.type} · ${formatDate(item.date)}` : State.selectedBackupId, impact: "Recuperación", level: "high" },
      { label: "Ambiente recomendado", value: "Pruebas / Sandbox", impact: "Seguro", level: "medium" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  openModal("#restoreTestModal");
}

async function requestRestoreTest() {
  if (!getValue("#restoreTestType") || !getValue("#restoreEnvironment") || !isChecked("#restoreTestDeclaration")) {
    toast("Faltan datos", "Completa tipo de prueba, ambiente y confirmación.", "warning");
    return;
  }

  const confirmation = await confirmAction({
    icon: "🧪",
    title: "Programar prueba de restauración",
    text: "Se registrará una prueba controlada de recuperación.",
    impact: [
      { label: "Tipo", value: getValue("#restoreTestType"), impact: "Prueba", level: "medium" },
      { label: "Ambiente", value: getValue("#restoreEnvironment"), impact: "Seguridad", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/respaldo/prueba-restauracion", {
      method: "POST",
      body: JSON.stringify({
        tipo_prueba: getValue("#restoreTestType"),
        ambiente: getValue("#restoreEnvironment"),
        respaldo_id: State.selectedBackupId,
        motivo: confirmation.reason
      })
    });

    closeModals();
    await renderBackupPage();
    toast("Prueba programada", "La prueba de restauración fue registrada.", "success");
  } catch (error) {
    genericModal("!", "No se pudo programar prueba", error.message);
  }
}

/* =========================================================
   CONFIGURACIÓN DEL SISTEMA
========================================================= */

async function initSystemConfig() {
  bindSystemConfigEvents();
  await renderSystemConfigPage();
}

function bindSystemConfigEvents() {
  $("#saveSystemConfigBtn")?.addEventListener("click", requestSaveSystemConfig);
  $("#confirmSaveSystemConfigBtn")?.addEventListener("click", confirmSaveSystemConfig);
  $("#restoreSystemConfigBtn")?.addEventListener("click", requestRestoreSystemConfigDefaults);
  $("#refreshSystemConfigBtn")?.addEventListener("click", renderSystemConfigPage);
  $("#exportSystemConfigBtn")?.addEventListener("click", () => openExportModal("configuracion"));

  $("#maintenanceMode")?.addEventListener("change", () => {
    const active = String(getValue("#maintenanceMode")).toLowerCase().includes("activo");
    if (active && !getValue("#maintenanceMessage")) {
      toast("Mensaje requerido", "Si activas mantenimiento, ingresa un mensaje visible para usuarios.", "warning");
    }
  });
}

async function renderSystemConfigPage() {
  try {
    const response = await apiJson("/admin/configuracion-sistema");

    State.systemConfig = response.config || response.configuracion || response;
    State.originalSystemConfig = structuredClone ? structuredClone(State.systemConfig) : JSON.parse(JSON.stringify(State.systemConfig || {}));

    const cfg = State.systemConfig;

    setValue("#platformName", cfg.platformName || cfg.nombre_plataforma || "");
    setValue("#platformEnvironment", cfg.platformEnvironment || cfg.ambiente || "");
    setValue("#platformOwner", cfg.platformOwner || cfg.responsable || "");
    setValue("#platformSupportEmail", cfg.platformSupportEmail || cfg.correo_soporte || "");

    setValue("#sessionTimeout", cfg.sessionTimeout || cfg.expiracion_sesion || "");
    setValue("#failedAttempts", cfg.failedAttempts || cfg.intentos_fallidos || "");
    setValue("#mfaPolicy", cfg.mfaPolicy || cfg.mfa || "");
    setValue("#passwordPolicy", cfg.passwordPolicy || cfg.politica_password || "");

    setChecked("#notifySlaRisk", cfg.notifySlaRisk ?? cfg.alerta_sla ?? true);
    setChecked("#notifyUserBlocked", cfg.notifyUserBlocked ?? cfg.alerta_usuario_bloqueado ?? true);
    setChecked("#notifyIntegrationError", cfg.notifyIntegrationError ?? cfg.alerta_integracion ?? true);
    setChecked("#notifyBackupFailure", cfg.notifyBackupFailure ?? cfg.alerta_respaldo ?? true);

    setValue("#maintenanceMode", cfg.maintenanceMode || cfg.modo_mantenimiento || "");
    setValue("#maintenanceWindow", cfg.maintenanceWindow || cfg.ventana_mantenimiento || "");
    setValue("#maintenanceMessage", cfg.maintenanceMessage || cfg.mensaje_mantenimiento || "");

    setText("#systemConfigSummaryTitle", "Configuración activa");
    setText("#systemConfigSummaryText", `${getValue("#platformEnvironment") || "Ambiente no definido"} · ${getValue("#sessionTimeout") || "Sesión no definida"}`);

    renderKpis("#systemConfigKpiGrid", [
      { icon: "🏢", value: getValue("#platformEnvironment") || "-", label: "Ambiente", description: "Configuración actual" },
      { icon: "🔐", value: getValue("#sessionTimeout") || "-", label: "Sesión", description: "Expiración configurada" },
      { icon: "🔑", value: getValue("#passwordPolicy") || "-", label: "Contraseña", description: "Política vigente" },
      { icon: "🛠️", value: getValue("#maintenanceMode") || "-", label: "Mantenimiento", description: "Estado operativo" }
    ]);

    renderAi("#systemConfigAiSummary", [
      { title: "Seguridad", text: "Revisa expiración de sesión, intentos fallidos, MFA y política de contraseña." },
      { title: "Continuidad", text: "Mantén alertas activas para SLA, usuarios bloqueados, integraciones y respaldo." }
    ]);

    renderChecklist("#systemConfigActionPlan", [
      { icon: "1", title: "Validar seguridad", text: "Confirmar intentos fallidos y sesión." },
      { icon: "2", title: "Revisar alertas", text: "Mantener alertas críticas activas." },
      { icon: "3", title: "Auditar cambios", text: "Todo cambio global debe registrarse." }
    ]);
  } catch (error) {
    renderAi("#systemConfigAiSummary", [{ title: "No se pudo cargar configuración", text: error.message }]);
  }
}

function collectSystemConfigPayload() {
  return {
    platformName: getValue("#platformName"),
    platformEnvironment: getValue("#platformEnvironment"),
    platformOwner: getValue("#platformOwner"),
    platformSupportEmail: getValue("#platformSupportEmail"),
    sessionTimeout: getValue("#sessionTimeout"),
    failedAttempts: getValue("#failedAttempts"),
    mfaPolicy: getValue("#mfaPolicy"),
    passwordPolicy: getValue("#passwordPolicy"),
    notifySlaRisk: isChecked("#notifySlaRisk"),
    notifyUserBlocked: isChecked("#notifyUserBlocked"),
    notifyIntegrationError: isChecked("#notifyIntegrationError"),
    notifyBackupFailure: isChecked("#notifyBackupFailure"),
    maintenanceMode: getValue("#maintenanceMode"),
    maintenanceWindow: getValue("#maintenanceWindow"),
    maintenanceMessage: getValue("#maintenanceMessage")
  };
}

function getSystemConfigDiff(payload) {
  const original = State.originalSystemConfig || {};

  const map = [
    ["platformName", "Nombre de plataforma", original.platformName || original.nombre_plataforma],
    ["platformEnvironment", "Ambiente", original.platformEnvironment || original.ambiente],
    ["platformOwner", "Responsable", original.platformOwner || original.responsable],
    ["platformSupportEmail", "Correo soporte", original.platformSupportEmail || original.correo_soporte],
    ["sessionTimeout", "Expiración de sesión", original.sessionTimeout || original.expiracion_sesion],
    ["failedAttempts", "Intentos fallidos", original.failedAttempts || original.intentos_fallidos],
    ["mfaPolicy", "MFA", original.mfaPolicy || original.mfa],
    ["passwordPolicy", "Política de contraseña", original.passwordPolicy || original.politica_password],
    ["maintenanceMode", "Modo mantenimiento", original.maintenanceMode || original.modo_mantenimiento],
    ["maintenanceWindow", "Ventana mantenimiento", original.maintenanceWindow || original.ventana_mantenimiento],
    ["maintenanceMessage", "Mensaje mantenimiento", original.maintenanceMessage || original.mensaje_mantenimiento]
  ];

  return map
    .filter(([key, , oldValue]) => String(oldValue ?? "") !== String(payload[key] ?? ""))
    .map(([key, label, oldValue]) => ({
      key,
      label,
      before: oldValue ?? "",
      after: payload[key] ?? "",
      critical: ["mfaPolicy", "passwordPolicy", "maintenanceMode", "sessionTimeout", "failedAttempts"].includes(key)
    }));
}

async function requestSaveSystemConfig() {
  const payload = collectSystemConfigPayload();

  if (!payload.platformName || !payload.platformEnvironment || !payload.platformOwner || !payload.platformSupportEmail) {
    toast("Faltan datos", "Completa identidad de plataforma, ambiente, responsable y correo.", "warning");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.platformSupportEmail)) {
    toast("Correo inválido", "Ingresa un correo de soporte válido.", "warning");
    return;
  }

  if (String(payload.maintenanceMode).toLowerCase().includes("activo") && !payload.maintenanceMessage) {
    toast("Mensaje requerido", "Para activar mantenimiento debes ingresar un mensaje visible.", "warning");
    return;
  }

  const diff = getSystemConfigDiff(payload);

  if (!diff.length) {
    toast("Sin cambios", "No hay cambios pendientes para guardar.", "info");
    return;
  }

  const confirmation = await confirmAction({
    icon: "⚙️",
    title: "Guardar configuración del sistema",
    text: "Los cambios pueden afectar seguridad, sesión, notificaciones y comportamiento general.",
    warning: diff.some(item => item.critical) ? "Hay cambios críticos de seguridad o mantenimiento." : "",
    impact: diff.map(item => ({
      label: item.label,
      value: `${item.before || "-"} → ${item.after || "-"}`,
      impact: item.critical ? "Crítico" : "Cambio",
      level: item.critical ? "high" : "medium"
    })),
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  payload.motivo = confirmation.reason;
  setValue("#systemConfigPendingReason", confirmation.reason);

  openModal("#confirmSystemConfigModal");
}

async function confirmSaveSystemConfig() {
  if ($("#systemConfigDeclaration") && !isChecked("#systemConfigDeclaration")) {
    toast("Confirmación requerida", "Debes confirmar que revisaste los cambios.", "warning");
    return;
  }

  const payload = {
    ...collectSystemConfigPayload(),
    motivo: getValue("#systemConfigPendingReason") || "Actualización de configuración del sistema"
  };

  try {
    await apiJson("/admin/configuracion-sistema", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    closeModals();
    await renderSystemConfigPage();
    toast("Configuración guardada", "Los parámetros fueron actualizados.", "success");
  } catch (error) {
    genericModal("!", "No se pudo guardar configuración", error.message);
  }
}

async function requestRestoreSystemConfigDefaults() {
  const confirmation = await confirmAction({
    icon: "⚠️",
    title: "Restaurar valores de configuración",
    text: "Se solicitará al backend restaurar valores recomendados del sistema.",
    warning: "Esta acción puede modificar seguridad, sesión, notificaciones y mantenimiento.",
    impact: [
      { label: "Alcance", value: "Configuración global", impact: "Crítico", level: "high" },
      { label: "Módulo", value: "Sistema", impact: "Administrativo", level: "high" }
    ],
    requireReason: true,
    requireCheckbox: true
  });

  if (!confirmation.confirmed) return;

  try {
    await apiJson("/admin/configuracion-sistema/restaurar", {
      method: "POST",
      body: JSON.stringify({ motivo: confirmation.reason })
    });

    await renderSystemConfigPage();
    toast("Valores restaurados", "Se restauraron los valores recomendados.", "success");
  } catch (error) {
    genericModal("!", "No se pudo restaurar configuración", error.message);
  }
}

/* =========================================================
   FIX COMPATIBILIDAD DATASET SLA
========================================================= */

Object.defineProperty(DOMStringMap.prototype, "datasetSlaRuleFilter", {
  get() {
    return this.slaRuleFilter;
  },
  configurable: true
});