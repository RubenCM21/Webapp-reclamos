"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - ESTADO DE SERVICIOS JS
   Preparado para integración backend
========================================================= */

const StatusState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  segment: "personas",
  activeIncidentFilter: "todos",
  search: ""
};

const StatusData = {
  personas: {
    title: "Estado de servicios para Personas",
    subtitle: "Servicios móviles, hogar y TV monitoreados con alertas simuladas.",
    availability: 94,
    generalStatus: "Operativo",
    services: [
      {
        id: "movil",
        icon: "📱",
        name: "Red móvil",
        description: "Llamadas, datos móviles, SMS y cobertura nacional.",
        status: "Operativo",
        type: "ok",
        health: 97,
        area: "Nacional"
      },
      {
        id: "internet",
        icon: "🏠",
        name: "Internet hogar",
        description: "Fibra óptica, internet fijo y servicios residenciales.",
        status: "Intermitencia",
        type: "warning",
        health: 78,
        area: "Lima Centro"
      },
      {
        id: "tv",
        icon: "📺",
        name: "Claro TV+",
        description: "Señal TV, decodificadores y paquetes premium.",
        status: "Mantenimiento",
        type: "maintenance",
        health: 84,
        area: "Provincias"
      },
      {
        id: "app",
        icon: "📲",
        name: "App Mi Claro",
        description: "Consultas, pagos, recibos y gestiones digitales.",
        status: "Operativo",
        type: "ok",
        health: 99,
        area: "Digital"
      }
    ]
  },

  empresas: {
    title: "Estado de servicios para Empresas",
    subtitle: "Conectividad, cloud, correo y seguridad empresarial monitoreados.",
    availability: 91,
    generalStatus: "Monitoreado",
    services: [
      {
        id: "fibra",
        icon: "📡",
        name: "Fibra empresarial",
        description: "Conectividad dedicada y enlaces corporativos.",
        status: "Operativo",
        type: "ok",
        health: 96,
        area: "Nacional"
      },
      {
        id: "cloud",
        icon: "☁️",
        name: "Cloud empresarial",
        description: "Infraestructura, almacenamiento y servicios cloud.",
        status: "Operativo",
        type: "ok",
        health: 98,
        area: "Digital"
      },
      {
        id: "correo",
        icon: "📧",
        name: "Correo empresas",
        description: "Correo corporativo, colaboración y productividad.",
        status: "Intermitencia",
        type: "warning",
        health: 74,
        area: "Lima Este"
      },
      {
        id: "seguridad",
        icon: "🛡️",
        name: "Seguridad empresas",
        description: "Backup, monitoreo, protección y continuidad.",
        status: "Mantenimiento",
        type: "maintenance",
        health: 82,
        area: "Ventana programada"
      }
    ]
  }
};

const IncidentsData = [
  {
    code: "EVT-2026-001",
    segment: "personas",
    service: "Internet hogar",
    zone: "Lima Centro",
    type: "incidencia",
    status: "En atención",
    statusType: "warning",
    start: "21/05/2026 08:20",
    eta: "21/05/2026 14:00",
    description: "Intermitencia temporal en servicio de internet hogar."
  },
  {
    code: "EVT-2026-002",
    segment: "personas",
    service: "Claro TV+",
    zone: "Provincias",
    type: "mantenimiento",
    status: "Programado",
    statusType: "maintenance",
    start: "21/05/2026 01:00",
    eta: "21/05/2026 05:00",
    description: "Mantenimiento programado de plataforma TV."
  },
  {
    code: "EVT-2026-003",
    segment: "empresas",
    service: "Correo empresas",
    zone: "Lima Este",
    type: "incidencia",
    status: "En atención",
    statusType: "warning",
    start: "21/05/2026 09:10",
    eta: "21/05/2026 12:30",
    description: "Intermitencia en acceso a correo corporativo."
  },
  {
    code: "EVT-2026-004",
    segment: "empresas",
    service: "Cloud empresarial",
    zone: "Digital",
    type: "resuelto",
    status: "Resuelto",
    statusType: "ok",
    start: "20/05/2026 19:00",
    eta: "20/05/2026 21:15",
    description: "Evento de latencia resuelto en servicios cloud."
  }
];

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(StatusState.theme);
  bindTheme();
  bindSegment();
  bindFilters();
  bindIncidentFilters();
  bindSearch();
  bindDiagnostic();
  bindBot();
  bindModals();
  renderSegment("personas");
  renderIncidents();
});

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function showToast({ title, message, type = "info" }) {
  const container = $("#toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : type === "warning" ? "!" : type === "danger" ? "×" : "ℹ"}</span>
    <div>
      <strong>${title}</strong>
      <p>${message}</p>
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
  $all(".segment-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const segment = button.dataset.segment;
      if (!segment || segment === StatusState.segment) return;

      renderSegment(segment);
      renderIncidents();

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message:
          segment === "personas"
            ? "Se cargaron servicios para clientes personas."
            : "Se cargaron servicios empresariales.",
        type: "info"
      });
    });
  });
}

function renderSegment(segment) {
  StatusState.segment = segment;

  $all(".segment-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.segment === segment);
  });

  const data = StatusData[segment];

  setText("#dashboardTitle", data.title);
  setText("#dashboardSubtitle", data.subtitle);
  setText("#availabilityScore", `${data.availability}%`);
  setText("#generalStatus", data.generalStatus);

  renderServices(data.services);
  renderKpis(data.services);
  renderAlerts(data.services);
}

function renderKpis(services) {
  const operational = services.filter((service) => service.type === "ok").length;
  const warnings = services.filter((service) => service.type === "warning").length;
  const maintenance = services.filter((service) => service.type === "maintenance").length;
  const incidents = IncidentsData.filter((item) => {
    return item.segment === StatusState.segment && item.type === "incidencia";
  }).length;

  setText("#kpiOperational", operational);
  setText("#kpiWarnings", warnings);
  setText("#kpiMaintenance", maintenance);
  setText("#kpiIncidents", incidents);
}

function renderServices(services) {
  const grid = $("#servicesGrid");
  if (!grid) return;

  grid.innerHTML = services
    .map((service) => {
      return `
        <article class="service-card">
          <div class="service-card__top">
            <span class="service-icon">${service.icon}</span>
            <span class="status-pill status-pill--${service.type}">
              ${service.status}
            </span>
          </div>

          <h3>${service.name}</h3>
          <p>${service.description}</p>

          <div class="health-bar">
            <span style="width:${service.health}%; background:${getHealthColor(service.type)}"></span>
          </div>

          <div class="service-card__meta">
            <span>${service.health}% salud</span>
            <span>${service.area}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function getHealthColor(type) {
  if (type === "ok") return "linear-gradient(90deg, var(--success), #8ee8c4)";
  if (type === "warning") return "linear-gradient(90deg, var(--warning), #ffd98a)";
  if (type === "danger") return "linear-gradient(90deg, var(--danger), #ffb4b0)";
  return "linear-gradient(90deg, var(--maintenance), #c4b5fd)";
}

function renderAlerts(services) {
  const list = $("#alertsList");
  if (!list) return;

  const alerts = services.filter((service) => service.type !== "ok");

  if (!alerts.length) {
    list.innerHTML = `
      <article class="alert-item">
        <div class="alert-item__top">
          <strong>Sin alertas activas</strong>
          <span class="status-pill status-pill--ok">Normal</span>
        </div>
        <p>Todos los servicios se encuentran operativos.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = alerts
    .map((service) => {
      return `
        <article class="alert-item">
          <div class="alert-item__top">
            <strong>${service.name}</strong>
            <span class="status-pill status-pill--${service.type}">
              ${service.status}
            </span>
          </div>
          <p>${service.description} Zona afectada: ${service.area}.</p>
        </article>
      `;
    })
    .join("");
}

function bindFilters() {
  $("#statusFilterForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    showToast({
      title: "Consultando estado",
      message: "Actualizando información de servicios.",
      type: "info"
    });

    await delay(500);

    renderSegment(StatusState.segment);

    showToast({
      title: "Estado actualizado",
      message: "La información fue actualizada correctamente.",
      type: "success"
    });
  });

  $("#refreshMapBtn")?.addEventListener("click", async () => {
    showToast({
      title: "Mapa actualizado",
      message: "Se refrescó la vista geográfica simulada.",
      type: "success"
    });
  });
}

function bindIncidentFilters() {
  $all("[data-incident-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      StatusState.activeIncidentFilter = button.dataset.incidentFilter || "todos";

      $all("[data-incident-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderIncidents();
    });
  });
}

function bindSearch() {
  $("#incidentSearch")?.addEventListener("input", (event) => {
    StatusState.search = event.target.value.trim().toLowerCase();
    renderIncidents();
  });
}

function getFilteredIncidents() {
  return IncidentsData.filter((item) => {
    const matchesSegment = item.segment === StatusState.segment;

    const matchesFilter =
      StatusState.activeIncidentFilter === "todos" ||
      item.type === StatusState.activeIncidentFilter;

    const search = StatusState.search;

    const matchesSearch =
      !search ||
      item.code.toLowerCase().includes(search) ||
      item.service.toLowerCase().includes(search) ||
      item.zone.toLowerCase().includes(search) ||
      item.status.toLowerCase().includes(search);

    return matchesSegment && matchesFilter && matchesSearch;
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

  body.innerHTML = incidents
    .map((item) => {
      return `
        <tr>
          <td><strong>${item.code}</strong></td>
          <td>${item.service}</td>
          <td>${item.zone}</td>
          <td>${formatType(item.type)}</td>
          <td>
            <span class="status-pill status-pill--${item.statusType}">
              ${item.status}
            </span>
          </td>
          <td>${item.start}</td>
          <td>${item.eta}</td>
          <td>
            <button type="button" class="table-action" data-incident-code="${item.code}">
              Ver detalle
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  $all("[data-incident-code]").forEach((button) => {
    button.addEventListener("click", () => {
      const code = button.dataset.incidentCode;
      const incident = IncidentsData.find((item) => item.code === code);

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

  return labels[type] || type;
}

function openIncidentModal(incident) {
  setText("#incidentModalTitle", incident.code);
  setText("#incidentModalText", incident.description);

  const box = $("#incidentDetailBox");
  if (box) {
    box.innerHTML = `
      <div>
        <span>Servicio</span>
        <strong>${incident.service}</strong>
      </div>
      <div>
        <span>Zona</span>
        <strong>${incident.zone}</strong>
      </div>
      <div>
        <span>Estado</span>
        <strong>${incident.status}</strong>
      </div>
      <div>
        <span>Inicio</span>
        <strong>${incident.start}</strong>
      </div>
      <div>
        <span>Estimación</span>
        <strong>${incident.eta}</strong>
      </div>
    `;
  }

  openModal("#incidentModal");
}

function bindDiagnostic() {
  $("#diagnosticForm")?.addEventListener("submit", (event) => {
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

    const result = getDiagnosticResult(service, symptom);

    openGenericModal({
      icon: "🤖",
      title: "Diagnóstico IA",
      text: result
    });
  });
}

function getDiagnosticResult(service, symptom) {
  if (symptom === "sin-servicio") {
    return "Se recomienda registrar una incidencia. Adjunta evidencia, zona afectada y hora aproximada del problema.";
  }

  if (symptom === "lento") {
    return "Primero verifica cobertura, reinicia el equipo y realiza una prueba. Si persiste, registra una incidencia técnica.";
  }

  if (symptom === "intermitente") {
    return "El síntoma puede estar asociado a intermitencia temporal. Revisa si existe alerta activa y registra incidencia si continúa.";
  }

  if (symptom === "error-acceso") {
    return "Para errores de acceso, adjunta captura del mensaje y datos del usuario afectado. Puede corresponder a incidencia de soporte.";
  }

  return "No se encontró una recomendación específica. Consulta el centro de ayuda o registra una incidencia.";
}

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);
  $("#drawerBackdrop")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addBotMessage(prompt, "user");
    input.value = "";

    const typing = addTyping();
    await delay(500);
    typing.remove();

    addBotMessage(generateBotResponse(prompt), "bot");
  });

  $all("[data-bot-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.botPrompt || "";

      addBotMessage(prompt, "user");

      const typing = addTyping();
      await delay(500);
      typing.remove();

      addBotMessage(generateBotResponse(prompt), "bot");
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
  message.textContent = "ClaroBot está revisando el estado de servicios...";

  container?.appendChild(message);

  if (container) container.scrollTop = container.scrollHeight;

  return message;
}

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("operativo")) {
    return "Operativo significa que no se registran incidencias relevantes en el servicio. Puede haber casos individuales no asociados a un evento masivo.";
  }

  if (text.includes("internet") || text.includes("lento")) {
    return "Si tu internet está lento, revisa si hay alerta activa en tu zona. Si no hay alerta y el problema continúa, registra una incidencia.";
  }

  if (text.includes("incidencia")) {
    return "Debes reportar una incidencia cuando el servicio presenta falla técnica, interrupción, lentitud persistente o error de acceso.";
  }

  if (text.includes("empresa") || text.includes("cloud") || text.includes("correo")) {
    return "Para empresas, revisa el servicio afectado, usuarios impactados y hora del evento. Luego registra un ticket con evidencia técnica.";
  }

  return "Puedo ayudarte a interpretar estados, revisar alertas, diferenciar intermitencia de incidencia o sugerir acciones.";
}

function bindModals() {
  $all("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", (event) => {
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
  $all(".modal").forEach((modal) => {
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