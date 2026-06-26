"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ESTADO DE SERVICIOS
   Conectado a FastAPI + SQL Server
   Sin StatusData, sin IncidentsData, sin simulación local
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const StatusState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  segment: "personas",
  activeIncidentFilter: "todos",
  search: "",
  services: [],
  incidents: [],
  alerts: [],
  zones: []
};

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(StatusState.theme);
  bindTheme();
  bindSegment();
  bindFilters();
  bindIncidentFilters();
  bindSearch();
  bindDiagnostic();
  bindBot();
  bindModals();

  await loadAndRender();
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

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const text = query.toString();
  return text ? `?${text}` : "";
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
  StatusState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = StatusState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function bindSegment() {
  $all(".segment-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const segment = button.dataset.segment;
      if (!segment || segment === StatusState.segment) return;

      StatusState.segment = segment;

      $all(".segment-btn").forEach(item => item.classList.remove("active"));
      button.classList.add("active");

      await loadAndRender();

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message: "Se cargó información registrada para el segmento seleccionado.",
        type: "info"
      });
    });
  });
}

async function loadAndRender() {
  try {
    const response = await apiRequest(`/public/estado-servicios${buildQuery({
      segment: StatusState.segment,
      district: $("#district")?.value || "todos",
      service_type: $("#serviceType")?.value || "todos"
    })}`);

    StatusState.services = response.services || [];
    StatusState.incidents = response.incidents || [];
    StatusState.alerts = response.alerts || [];
    StatusState.zones = response.zones || [];

    setText("#dashboardTitle", response.title || "Estado de servicios");
    setText("#dashboardSubtitle", response.subtitle || "Información registrada de servicios.");
    setText("#availabilityScore", `${response.availability ?? 0}%`);
    setText("#generalStatus", response.generalStatus || "Sin datos");

    renderKpis(response.kpis || {});
    renderServices(StatusState.services);
    renderAlerts(StatusState.alerts);
    renderZones(StatusState.zones);
    renderIncidents();
  } catch (error) {
    openGenericModal({
      icon: "!",
      title: "No se pudo cargar estado",
      text: error.message
    });
  }
}

function renderKpis(kpis) {
  setText("#kpiOperational", kpis.operational ?? 0);
  setText("#kpiWarnings", kpis.warnings ?? 0);
  setText("#kpiMaintenance", kpis.maintenance ?? 0);
  setText("#kpiIncidents", kpis.incidents ?? 0);
}

function renderServices(services) {
  const grid = $("#servicesGrid");
  if (!grid) return;

  if (!services.length) {
    grid.innerHTML = `
      <article class="service-card">
        <div class="service-card__top">
          <span class="service-icon">📭</span>
          <span class="status-pill status-pill--info">Sin datos</span>
        </div>
        <h3>No hay servicios registrados</h3>
        <p>No se encontraron servicios para los filtros seleccionados.</p>
      </article>
    `;
    return;
  }

  grid.innerHTML = services.map(service => `
    <article class="service-card">
      <div class="service-card__top">
        <span class="service-icon">${esc(service.icon || "📡")}</span>
        <span class="status-pill status-pill--${esc(service.type || "info")}">
          ${esc(service.status || "Sin estado")}
        </span>
      </div>

      <h3>${esc(service.name || "Servicio")}</h3>
      <p>${esc(service.description || "")}</p>

      <div class="health-bar">
        <span style="width:${Number(service.health || 0)}%; background:${getHealthColor(service.type)}"></span>
      </div>

      <div class="service-card__meta">
        <span>${esc(service.health || 0)}% salud</span>
        <span>${esc(service.area || "-")}</span>
      </div>
    </article>
  `).join("");
}

function getHealthColor(type) {
  if (type === "ok") return "linear-gradient(90deg, var(--success), #8ee8c4)";
  if (type === "warning") return "linear-gradient(90deg, var(--warning), #ffd98a)";
  if (type === "danger") return "linear-gradient(90deg, var(--danger), #ffb4b0)";
  if (type === "maintenance") return "linear-gradient(90deg, var(--maintenance), #c4b5fd)";
  return "linear-gradient(90deg, var(--info), #9ed8ff)";
}

function renderAlerts(alerts) {
  const list = $("#alertsList");
  if (!list) return;

  if (!alerts.length) {
    list.innerHTML = `
      <article class="alert-item">
        <div class="alert-item__top">
          <strong>Sin alertas activas</strong>
          <span class="status-pill status-pill--ok">Normal</span>
        </div>
        <p>No se registran eventos activos para los filtros seleccionados.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = alerts.map(alert => `
    <article class="alert-item">
      <div class="alert-item__top">
        <strong>${esc(alert.title || "Evento")}</strong>
        <span class="status-pill status-pill--${esc(alert.type || "info")}">
          ${esc(alert.status || "Sin estado")}
        </span>
      </div>
      <p>${esc(alert.text || "")} Zona afectada: ${esc(alert.zone || "-")}.</p>
    </article>
  `).join("");
}

function renderZones(zones) {
  const map = $("#coverageMap");
  if (!map) return;

  if (!zones.length) return;

  map.innerHTML = zones.map(zone => `
    <div class="map-zone zone-${esc(zone.type || "ok")}" style="top:${Number(zone.top || 20)}%; left:${Number(zone.left || 20)}%;">
      <span>${esc(zone.name || "Zona")}</span>
    </div>
  `).join("") + `<div class="map-radar"></div>`;
}

function bindFilters() {
  $("#statusFilterForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    showToast({
      title: "Consultando estado",
      message: "Actualizando información registrada de servicios.",
      type: "info"
    });

    await loadAndRender();

    showToast({
      title: "Estado actualizado",
      message: "La información fue actualizada correctamente.",
      type: "success"
    });
  });

  $("#refreshMapBtn")?.addEventListener("click", async () => {
    await loadAndRender();

    showToast({
      title: "Mapa actualizado",
      message: "Se refrescó la vista geográfica.",
      type: "success"
    });
  });
}

function bindIncidentFilters() {
  $all("[data-incident-filter]").forEach(button => {
    button.addEventListener("click", () => {
      StatusState.activeIncidentFilter = button.dataset.incidentFilter || "todos";

      $all("[data-incident-filter]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");

      renderIncidents();
    });
  });
}

function bindSearch() {
  $("#incidentSearch")?.addEventListener("input", event => {
    StatusState.search = event.target.value.trim().toLowerCase();
    renderIncidents();
  });
}

function getFilteredIncidents() {
  return StatusState.incidents.filter(item => {
    const matchesFilter =
      StatusState.activeIncidentFilter === "todos" ||
      item.type === StatusState.activeIncidentFilter;

    const search = StatusState.search;

    const matchesSearch =
      !search ||
      String(item.code || "").toLowerCase().includes(search) ||
      String(item.service || "").toLowerCase().includes(search) ||
      String(item.zone || "").toLowerCase().includes(search) ||
      String(item.status || "").toLowerCase().includes(search);

    return matchesFilter && matchesSearch;
  });
}

function renderIncidents() {
  const body = $("#incidentsTableBody");
  if (!body) return;

  const incidents = getFilteredIncidents();

  if (!incidents.length) {
    body.innerHTML = `
      <tr>
        <td colspan="8">
          No se encontraron eventos para los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = incidents.map(item => `
    <tr>
      <td><strong>${esc(item.code)}</strong></td>
      <td>${esc(item.service)}</td>
      <td>${esc(item.zone)}</td>
      <td>${esc(formatType(item.type))}</td>
      <td>
        <span class="status-pill status-pill--${esc(item.statusType || "info")}">
          ${esc(item.status)}
        </span>
      </td>
      <td>${esc(item.start)}</td>
      <td>${esc(item.eta)}</td>
      <td>
        <button type="button" class="table-action" data-incident-code="${esc(item.code)}">
          Ver detalle
        </button>
      </td>
    </tr>
  `).join("");

  $all("[data-incident-code]").forEach(button => {
    button.addEventListener("click", () => {
      const code = button.dataset.incidentCode;
      const incident = StatusState.incidents.find(item => item.code === code);

      if (incident) {
        openIncidentModal(incident);
      }
    });
  });
}

function formatType(type) {
  const labels = {
    incidencia: "Incidencia",
    mantenimiento: "Mantenimiento",
    resuelto: "Resuelto"
  };

  return labels[type] || type || "-";
}

function openIncidentModal(incident) {
  setText("#incidentModalTitle", incident.code);
  setText("#incidentModalText", incident.description);

  const box = $("#incidentDetailBox");

  if (box) {
    box.innerHTML = `
      <div>
        <span>Servicio</span>
        <strong>${esc(incident.service)}</strong>
      </div>
      <div>
        <span>Zona</span>
        <strong>${esc(incident.zone)}</strong>
      </div>
      <div>
        <span>Estado</span>
        <strong>${esc(incident.status)}</strong>
      </div>
      <div>
        <span>Inicio</span>
        <strong>${esc(incident.start)}</strong>
      </div>
      <div>
        <span>Estimación</span>
        <strong>${esc(incident.eta)}</strong>
      </div>
    `;
  }

  openModal("#incidentModal");
}

function bindDiagnostic() {
  $("#diagnosticForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const service = $("#diagnosticService")?.value;
    const symptom = $("#diagnosticSymptom")?.value;

    if (!service || !symptom) {
      openGenericModal({
        icon: "!",
        title: "Datos incompletos",
        text: "Selecciona el servicio afectado y el síntoma para ejecutar el diagnóstico."
      });
      return;
    }

    try {
      const response = await apiRequest("/public/estado-servicios/diagnostico", {
        method: "POST",
        body: JSON.stringify({
          service,
          symptom
        })
      });

      openGenericModal({
        icon: "🤖",
        title: response.title || "Diagnóstico",
        text: response.recommendation || "No se recibió recomendación."
      });
    } catch (error) {
      openGenericModal({
        icon: "!",
        title: "No se pudo diagnosticar",
        text: error.message
      });
    }
  });
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
          page: "estado-servicios",
          prompt,
          services: StatusState.services,
          incidents: StatusState.incidents
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
  message.textContent = "ClaroBot está revisando el estado registrado...";

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