"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 — API.JS  (versión global)
   ─────────────────────────────────────────────────────────
   Este archivo NO usa import/export.
   Cargarlo ANTES que cualquier otro JS de rol:

     <script src="../assets/js/api.js"></script>
     <script src="../assets/js/cliente.js"></script>

   Uso desde cualquier archivo:
     const data = await Api.Auth.perfil();
     const casos = await Api.Clientes.casos();
   ========================================================= */

const BASE_URL = "";   // "" = mismo origen. En dev: "http://localhost:8000"

// ── Clase de error ──────────────────────────────────────────────────────────
class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Error HTTP ${status}`);
    this.status  = status;
    this.detail  = detail;
  }
}

// ── Helper interno ──────────────────────────────────────────────────────────
async function _request(method, path, body = null, isForm = false) {
  const token = localStorage.getItem("claro360-token");
  const headers = {};

  if (token) headers["Authorization"] = `Bearer ${token}`;

  let fetchBody;
  if (body !== null) {
    if (isForm) {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) form.append(k, String(v));
      fetchBody = form.toString();
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      fetchBody = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: fetchBody });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Si es 401, limpiar sesión y redirigir
    if (res.status === 401) {
      localStorage.removeItem("claro360-token");
      localStorage.removeItem("claro360-session");
      // Solo redirigir si no estamos ya en login
      if (!window.location.pathname.includes("login")) {
        window.location.href = window.location.pathname.includes("/cliente/") ||
          window.location.pathname.includes("/asesor/") ||
          window.location.pathname.includes("/supervisor/") ||
          window.location.pathname.includes("/admin/")
          ? "../login.html" : "login.html";
      }
    }
    throw new ApiError(res.status, data?.detail || data?.message || `Error ${res.status}`);
  }

  return data;
}

const _get    = (path)            => _request("GET",    path);
const _post   = (path, body, f)   => _request("POST",   path, body, f);
const _put    = (path, body)      => _request("PUT",    path, body);
const _del    = (path)            => _request("DELETE", path);
const _patch  = (path, body)      => _request("PATCH",  path, body);

function _qs(params = {}) {
  const q = new URLSearchParams(params).toString();
  return q ? "?" + q : "";
}

// ── AUTH ────────────────────────────────────────────────────────────────────
const Auth = {
  login(credentials)           { return _post("/api/auth/login", credentials, true); },
  logout()                     { return _post("/api/auth/logout"); },
  perfil()                     { return _get("/api/auth/me"); },
  solicitarRecuperacion(p)     { return _post("/api/auth/recuperar-password", p); },
  restablecerPassword(p)       { return _post("/api/auth/restablecer-password", p); },
  verificarCuenta(p)           { return _post("/api/auth/verificar-cuenta", p); },
  reenviarCodigo(p)            { return _post("/api/auth/reenviar-codigo", p); },
  registrar(p)                 { return _post("/api/auth/register", p); },
  cambiarPassword(p)           { return _post("/api/auth/cambiar-password", p); },
};

// ── CLIENTES ────────────────────────────────────────────────────────────────
const Clientes = {
  perfil()                     { return _get("/api/clientes/me"); },
  actualizarPerfil(p)          { return _put("/api/clientes/me", p); },
  servicios(p = {})            { return _get("/api/clientes/me/servicios" + _qs(p)); },
  detalleServicio(id)          { return _get(`/api/clientes/me/servicios/${id}`); },
  casos(p = {})                { return _get("/api/clientes/me/casos" + _qs(p)); },
  detalleCaso(id)              { return _get(`/api/clientes/me/casos/${id}`); },
  notificaciones(p = {})       { return _get("/api/clientes/me/notificaciones" + _qs(p)); },
  marcarNotificacion(id)       { return _patch(`/api/clientes/me/notificaciones/${id}/leida`); },
  marcarTodasNotificaciones()  { return _patch("/api/clientes/me/notificaciones/todas-leidas"); },
};

// ── CASOS ───────────────────────────────────────────────────────────────────
const Casos = {
  crear(p)                     { return _post("/api/casos", p); },
  listar(p = {})               { return _get("/api/casos" + _qs(p)); },
  detalle(id)                  { return _get(`/api/casos/${id}`); },
  consultaPublica(p)           { return _get("/api/casos/consulta-publica" + _qs(p)); },
  actualizar(id, p)            { return _put(`/api/casos/${id}`, p); },
  cerrar(id, p)                { return _post(`/api/casos/${id}/cerrar`, p); },
  historial(id)                { return _get(`/api/casos/${id}/historial`); },
  agregarHistorial(id, p)      { return _post(`/api/casos/${id}/historial`, p); },
  asignar(id, p)               { return _post(`/api/casos/${id}/asignar`, p); },
  evidencias(id)               { return _get(`/api/casos/${id}/evidencias`); },
  subirEvidencia(id, formData) {
    const token = localStorage.getItem("claro360-token");
    return fetch(`${BASE_URL}/api/casos/${id}/evidencias`, {
      method: "POST",
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json());
  },
};

// ── ASESOR ──────────────────────────────────────────────────────────────────
const Asesor = {
  bandeja(p = {})              { return _get("/api/asesor/bandeja" + _qs(p)); },
  rendimiento(p = {})          { return _get("/api/asesor/rendimiento" + _qs(p)); },
  notificaciones(p = {})       { return _get("/api/asesor/notificaciones" + _qs(p)); },
  marcarNotificacion(id)       { return _patch(`/api/asesor/notificaciones/${id}/leida`); },
  marcarTodasNotificaciones()  { return _patch("/api/asesor/notificaciones/todas-leidas"); },
  plantillas(p = {})           { return _get("/api/asesor/plantillas" + _qs(p)); },
  calendarioSla(p = {})        { return _get("/api/asesor/calendario-sla" + _qs(p)); },
};

// ── SUPERVISOR ──────────────────────────────────────────────────────────────
const Supervisor = {
  indicadores(p = {})          { return _get("/api/supervisor/indicadores" + _qs(p)); },
  monitoreoSla(p = {})         { return _get("/api/supervisor/sla" + _qs(p)); },
  cargaAsesores(p = {})        { return _get("/api/supervisor/carga-asesores" + _qs(p)); },
  casosPendientes(p = {})      { return _get("/api/supervisor/casos-pendientes" + _qs(p)); },
  asesores(p = {})             { return _get("/api/supervisor/asesores" + _qs(p)); },
  reportes(p = {})             { return _get("/api/supervisor/reportes" + _qs(p)); },
  generarReporte(p)            { return _post("/api/supervisor/reportes", p); },
  auditoriaCasos(p = {})       { return _get("/api/supervisor/auditoria" + _qs(p)); },
};

// ── ADMIN ───────────────────────────────────────────────────────────────────
const Admin = {
  dashboard()                  { return _get("/api/admin/dashboard"); },
  // Usuarios
  usuarios(p = {})             { return _get("/api/admin/usuarios" + _qs(p)); },
  detalleUsuario(id)           { return _get(`/api/admin/usuarios/${id}`); },
  crearUsuario(p)              { return _post("/api/admin/usuarios", p); },
  actualizarUsuario(id, p)     { return _put(`/api/admin/usuarios/${id}`, p); },
  cambiarEstadoUsuario(id, e)  { return _patch(`/api/admin/usuarios/${id}/estado`, { estado: e }); },
  // Roles
  roles()                      { return _get("/api/admin/roles"); },
  permisos()                   { return _get("/api/admin/permisos"); },
  asignarPermisos(rid, pids)   { return _put(`/api/admin/roles/${rid}/permisos`, { permiso_ids: pids }); },
  // Catálogos
  catalogo(cat, p = {})        { return _get(`/api/admin/catalogos/${cat}` + _qs(p)); },
  crearCatalogo(cat, p)        { return _post(`/api/admin/catalogos/${cat}`, p); },
  actualizarCatalogo(cat, id, p){ return _put(`/api/admin/catalogos/${cat}/${id}`, p); },
  eliminarCatalogo(cat, id)    { return _del(`/api/admin/catalogos/${cat}/${id}`); },
  // SLA
  reglasSla(p = {})            { return _get("/api/admin/sla" + _qs(p)); },
  crearSla(p)                  { return _post("/api/admin/sla", p); },
  actualizarSla(id, p)         { return _put(`/api/admin/sla/${id}`, p); },
  // Auditoría
  auditoria(p = {})            { return _get("/api/admin/auditoria" + _qs(p)); },
  // Reportes
  reportes(p = {})             { return _get("/api/admin/reportes" + _qs(p)); },
  generarReporte(p)            { return _post("/api/admin/reportes", p); },
  // Integraciones
  integraciones()              { return _get("/api/admin/integraciones"); },
  guardarIntegracion(p)        { return _post("/api/admin/integraciones", p); },
  probarIntegracion(id)        { return _post(`/api/admin/integraciones/${id}/test`); },
  // Configuración
  configuracion()              { return _get("/api/admin/configuracion"); },
  guardarConfiguracion(p)      { return _put("/api/admin/configuracion", p); },
};

// ── PÚBLICO ─────────────────────────────────────────────────────────────────
const Publico = {
  consultarCaso(p)             { return _get("/api/publico/consultar-caso" + _qs(p)); },
  estadoServicios()            { return _get("/api/publico/estado-servicios"); },
  centroAyuda(p = {})          { return _get("/api/publico/centro-ayuda" + _qs(p)); },
  catalogosFormulario()        { return _get("/api/publico/catalogos-formulario"); },
};

// ── HELPERS de sesión ────────────────────────────────────────────────────────
const Session = {
  /** Guardar token y datos básicos de sesión tras el login */
  save(loginResponse, roleFromForm) {
    localStorage.setItem("claro360-token",   loginResponse.access_token);
    localStorage.setItem("claro360-session", JSON.stringify({
      id:       loginResponse.user_id,
      username: loginResponse.username,
      name:     loginResponse.nombre_completo,
      role:     loginResponse.role || roleFromForm,
    }));
  },

  /** Obtener datos de sesión guardados */
  get() {
    try {
      return JSON.parse(localStorage.getItem("claro360-session") || "null");
    } catch { return null; }
  },

  /** Verificar si hay token activo */
  isLoggedIn() {
    return Boolean(localStorage.getItem("claro360-token"));
  },

  /** Cerrar sesión: llama al backend + limpia localStorage */
  async logout() {
    try { await Auth.logout(); } catch {}
    localStorage.removeItem("claro360-token");
    localStorage.removeItem("claro360-session");
    window.location.href = this._loginUrl();
  },

  _loginUrl() {
    const depth = (window.location.pathname.match(/\//g) || []).length;
    return depth > 1 ? "../login.html" : "login.html";
  }
};

// ── Exponer globalmente ──────────────────────────────────────────────────────
window.Api = {
  Auth, Clientes, Casos, Asesor, Supervisor, Admin, Publico,
  Session, ApiError,
};
