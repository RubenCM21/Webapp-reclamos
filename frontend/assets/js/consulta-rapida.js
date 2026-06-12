"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CONSULTA RÁPIDA JS
   Preparado para integración backend
========================================================= */

const QuickState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  currentCase: null,
  compactTimeline: false,
  isLoading: false
};

const MockCases = [
  {
    code: "CAS-2026-000123",
    documentNumber: "76543210",
    title: "Caso CAS-2026-000123",
    description: "Reclamo registrado por lentitud recurrente en Internet hogar.",
    type: "Reclamo",
    service: "Internet hogar",
    priority: "Alta",
    status: "En atención",
    statusType: "info",
    lastUpdate: "21/05/2026 09:30",
    responsible: "Atención técnica hogar",
    sla: "05h 42m",
    risk: 55,
    riskText: "Riesgo medio. El caso aún se encuentra dentro del plazo.",
    recommendation:
      "El caso está en atención. Recomendamos mantener evidencias disponibles por si el asesor solicita información adicional.",
    tracker: ["Registrado", "Clasificado", "En atención"],
    timeline: [
      {
        icon: "📝",
        title: "Caso registrado",
        description: "El cliente registró un reclamo por lentitud en el servicio de internet.",
        date: "20/05/2026 08:15"
      },
      {
        icon: "🏷️",
        title: "Caso clasificado",
        description: "El supervisor clasificó el caso como reclamo técnico de prioridad alta.",
        date: "20/05/2026 09:10"
      },
      {
        icon: "🎧",
        title: "Asignado a asesor",
        description: "El caso fue asignado al equipo de atención técnica hogar.",
        date: "20/05/2026 09:25"
      },
      {
        icon: "🔎",
        title: "Revisión en curso",
        description: "El asesor inició la validación de evidencias y estado del servicio.",
        date: "21/05/2026 09:30"
      }
    ],
    evidences: [
      {
        icon: "📷",
        name: "captura_velocidad.png",
        detail: "Subido por cliente · 20/05/2026"
      },
      {
        icon: "📄",
        name: "recibo_servicio.pdf",
        detail: "Subido por cliente · 20/05/2026"
      }
    ]
  },
  {
    code: "CAS-2026-000245",
    documentNumber: "20123456789",
    title: "Caso CAS-2026-000245",
    description: "Incidencia empresarial asociada a correo corporativo y servicio cloud.",
    type: "Incidencia",
    service: "Cloud empresarial",
    priority: "Crítica",
    status: "Pendiente por cliente",
    statusType: "warning",
    lastUpdate: "21/05/2026 08:15",
    responsible: "Mesa empresarial cloud",
    sla: "02h 10m",
    risk: 78,
    riskText: "Riesgo alto. Se requiere respuesta del cliente para evitar vencimiento.",
    recommendation:
      "El asesor solicitó información adicional. Debes responder la solicitud para continuar con la atención.",
    tracker: ["Registrado", "Clasificado", "En atención"],
    timeline: [
      {
        icon: "📝",
        title: "Ticket empresarial registrado",
        description: "Se registró incidencia por inconveniente en acceso a correo corporativo.",
        date: "20/05/2026 16:40"
      },
      {
        icon: "🏷️",
        title: "Clasificación crítica",
        description: "El supervisor clasificó el ticket como incidencia cloud crítica.",
        date: "20/05/2026 17:05"
      },
      {
        icon: "🏢",
        title: "Derivado a mesa empresarial",
        description: "El caso fue asignado a soporte especializado de servicios cloud.",
        date: "20/05/2026 17:20"
      },
      {
        icon: "💬",
        title: "Solicitud al cliente",
        description: "Se solicitó evidencia del mensaje de error y usuario afectado.",
        date: "21/05/2026 08:15"
      }
    ],
    evidences: [
      {
        icon: "📄",
        name: "detalle_error_correo.pdf",
        detail: "Subido por cliente · 20/05/2026"
      }
    ]
  }
];

const QuickApi = {
  async lookupCase({ caseCode, documentNumber }) {
    await delay(700);

    return MockCases.find((item) => {
      return (
        item.code.toLowerCase() === caseCode.toLowerCase() &&
        item.documentNumber === documentNumber
      );
    });
  },

  async refreshCase(caseCode) {
    await delay(600);
    return MockCases.find((item) => item.code === caseCode);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(QuickState.theme);
  bindTheme();
  bindLookupForm();
  bindDemoButtons();
  bindResultActions();
  bindBot();
  bindModals();
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
  QuickState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = QuickState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function bindLookupForm() {
  const form = $("#quickLookupForm");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (QuickState.isLoading) return;

    clearErrors();

    const payload = getLookupPayload(form);
    const validation = validateLookup(payload);

    if (!validation.ok) {
      showErrors(validation.errors);

      showToast({
        title: "Datos incompletos",
        message: validation.firstMessage,
        type: "warning"
      });

      return;
    }

    setLoading(true);

    const result = await QuickApi.lookupCase(payload);

    setLoading(false);

    if (!result) {
      openModal("#notFoundModal");
      return;
    }

    QuickState.currentCase = result;
    renderCase(result);

    showToast({
      title: "Caso encontrado",
      message: `Se cargó el seguimiento del caso ${result.code}.`,
      type: "success"
    });
  });
}

function getLookupPayload(form) {
  const formData = new FormData(form);

  return {
    caseCode: String(formData.get("caseCode") || "").trim(),
    documentNumber: String(formData.get("documentNumber") || "").trim()
  };
}

function validateLookup(payload) {
  const errors = {};

  if (!payload.caseCode) {
    errors.caseCode = "Ingresa el código de caso.";
  }

  if (!payload.documentNumber) {
    errors.documentNumber = "Ingresa el DNI o RUC asociado.";
  }

  const messages = Object.values(errors);

  return {
    ok: messages.length === 0,
    errors,
    firstMessage: messages[0] || ""
  };
}

function showErrors(errors) {
  clearErrors();

  Object.entries(errors).forEach(([key, value]) => {
    const error = $(`#${key}Error`);
    if (error) error.textContent = value;
  });
}

function clearErrors() {
  $all(".form-error").forEach((item) => {
    item.textContent = "";
  });
}

function setLoading(value) {
  QuickState.isLoading = value;

  const button = $("#lookupButton");
  if (!button) return;

  button.disabled = value;
  button.classList.toggle("loading", value);
}

function bindDemoButtons() {
  $all("[data-demo-case]").forEach((button) => {
    button.addEventListener("click", () => {
      const caseCode = button.dataset.demoCase || "";
      const doc = button.dataset.demoDoc || "";

      $("#caseCode").value = caseCode;
      $("#documentNumber").value = doc;

      showToast({
        title: "Datos demo cargados",
        message: "Presiona consultar estado para ver el resultado.",
        type: "info"
      });
    });
  });
}

function renderCase(data) {
  $("#emptyStateSection")?.classList.add("hidden");
  $("#resultSection")?.classList.remove("hidden");

  setText("#resultTitle", data.title);
  setText("#resultDescription", data.description);
  setText("#resultType", data.type);
  setText("#resultService", data.service);
  setText("#resultPriority", data.priority);
  setText("#resultLastUpdate", data.lastUpdate);
  setText("#resultResponsible", data.responsible);
  setText("#resultSla", data.sla);
  setText("#aiRecommendation", data.recommendation);
  setText("#riskText", data.riskText);
  setText("#evidenceCount", `${data.evidences.length} archivo${data.evidences.length === 1 ? "" : "s"}`);

  renderStatusBadge(data);
  renderRisk(data);
  renderTracker(data);
  renderTimeline(data.timeline);
  renderEvidences(data.evidences);

  $("#resultSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderStatusBadge(data) {
  const badge = $("#resultStatusBadge");
  if (!badge) return;

  badge.textContent = data.status;
  badge.className = "status-badge";

  if (data.statusType === "success") {
    badge.classList.add("status-badge--success");
  }

  if (data.statusType === "warning") {
    badge.classList.add("status-badge--warning");
  }

  if (data.statusType === "danger") {
    badge.classList.add("status-badge--danger");
  }
}

function renderRisk(data) {
  const bar = $("#riskMeterBar");
  if (!bar) return;

  bar.style.width = `${data.risk}%`;

  if (data.risk >= 75) {
    bar.style.background = "linear-gradient(90deg, var(--danger), #ffb4b0)";
  } else if (data.risk >= 45) {
    bar.style.background = "linear-gradient(90deg, var(--warning), #ffd98a)";
  } else {
    bar.style.background = "linear-gradient(90deg, var(--success), #8ee8c4)";
  }
}

function renderTracker(data) {
  const steps = $all(".tracker-step");

  steps.forEach((step) => {
    const title = step.querySelector("strong")?.textContent || "";

    step.classList.remove("done", "active");

    if (data.tracker.includes(title)) {
      step.classList.add("done");
    }

    if (title === data.status) {
      step.classList.remove("done");
      step.classList.add("active");
    }

    if (data.status === "Pendiente por cliente" && title === "En atención") {
      step.classList.remove("done");
      step.classList.add("active");
    }
  });
}

function renderTimeline(items) {
  const list = $("#timelineList");
  if (!list) return;

  const source = QuickState.compactTimeline ? items.slice(-2) : items;

  list.innerHTML = source
    .map((item) => {
      return `
        <div class="timeline-item">
          <div class="timeline-icon">${item.icon}</div>
          <div class="timeline-content">
            <strong>${item.title}</strong>
            <p>${item.description}</p>
            <small>${item.date}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderEvidences(items) {
  const list = $("#evidenceList");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <div class="evidence-item">
        <span>📭</span>
        <div>
          <strong>Sin evidencias</strong>
          <small>No se registraron archivos asociados.</small>
        </div>
      </div>
    `;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      return `
        <div class="evidence-item">
          <span>${item.icon}</span>
          <div>
            <strong>${item.name}</strong>
            <small>${item.detail}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function bindResultActions() {
  $("#toggleTimelineView")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    QuickState.compactTimeline = !QuickState.compactTimeline;

    $("#toggleTimelineView").textContent = QuickState.compactTimeline
      ? "Vista completa"
      : "Vista compacta";

    renderTimeline(QuickState.currentCase.timeline);
  });

  $("#refreshTracking")?.addEventListener("click", async () => {
    if (!QuickState.currentCase) return;

    showToast({
      title: "Actualizando seguimiento",
      message: "Consultando última información del caso.",
      type: "info"
    });

    const updated = await QuickApi.refreshCase(QuickState.currentCase.code);

    if (updated) {
      QuickState.currentCase = updated;
      renderCase(updated);

      showToast({
        title: "Seguimiento actualizado",
        message: "La información del caso está al día.",
        type: "success"
      });
    }
  });

  $("#openFullTracking")?.addEventListener("click", () => {
    showToast({
      title: "Redirección simulada",
      message: "En versión real se abrirá el detalle completo del caso autenticado.",
      type: "info"
    });

    setTimeout(() => {
      window.location.href = "cliente/detalle-caso.html";
    }, 650);
  });

  $("#downloadConstancy")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    renderConstancy(QuickState.currentCase);
    openModal("#constancyModal");
  });

  $("#openAiSummary")?.addEventListener("click", () => {
    if (!QuickState.currentCase) return;

    renderAiSummary(QuickState.currentCase);
    openModal("#aiSummaryModal");
  });

  $("#openBotFromResult")?.addEventListener("click", openBot);

  $("#uploadEvidenceBtn")?.addEventListener("click", () => {
    openGenericModal({
      icon: "📎",
      title: "Adjuntar evidencia",
      text:
        "Para adjuntar evidencias debes iniciar sesión. En el portal del cliente podrás subir archivos, imágenes o documentos asociados al caso."
    });
  });

  $("#respondRequestBtn")?.addEventListener("click", () => {
    openGenericModal({
      icon: "💬",
      title: "Responder solicitud",
      text:
        "Si el caso está pendiente por cliente, podrás responder la solicitud desde el panel autenticado."
    });
  });

  $("#goHelpBtn")?.addEventListener("click", () => {
    window.location.href = "centro-ayuda.html";
  });
}

function renderConstancy(data) {
  const preview = $("#constancyPreview");
  if (!preview) return;

  preview.innerHTML = `
    <div>
      <span>Código</span>
      <strong>${data.code}</strong>
    </div>
    <div>
      <span>Documento</span>
      <strong>${data.documentNumber}</strong>
    </div>
    <div>
      <span>Estado</span>
      <strong>${data.status}</strong>
    </div>
    <div>
      <span>Fecha de consulta</span>
      <strong>${new Date().toLocaleString("es-PE")}</strong>
    </div>
  `;
}

function renderAiSummary(data) {
  setText(
    "#aiSummaryText",
    `El caso ${data.code} corresponde a un ${data.type.toLowerCase()} sobre ${data.service}. Actualmente se encuentra en estado "${data.status}".`
  );

  const box = $("#aiSummaryBox");
  if (!box) return;

  box.innerHTML = `
    <div>
      <span>Estado actual</span>
      <strong>${data.status}</strong>
    </div>
    <div>
      <span>Prioridad</span>
      <strong>${data.priority}</strong>
    </div>
    <div>
      <span>Riesgo SLA</span>
      <strong>${data.risk}%</strong>
    </div>
    <div>
      <span>Recomendación</span>
      <strong>${data.status === "Pendiente por cliente" ? "Responder solicitud" : "Esperar actualización"}</strong>
    </div>
  `;
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
  message.textContent = "ClaroBot está analizando tu caso...";

  container?.appendChild(message);

  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  return message;
}

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();
  const current = QuickState.currentCase;

  if (!current) {
    return "Primero consulta un caso usando el código y documento asociado. Luego podré resumirlo o explicar su estado.";
  }

  if (text.includes("estado")) {
    return `Tu caso está en estado "${current.status}". Esto significa que ${current.status === "Pendiente por cliente" ? "el asesor necesita información adicional para continuar." : "el equipo responsable está revisando la atención."}`;
  }

  if (text.includes("resume") || text.includes("resumir")) {
    return `Resumen: ${current.type} sobre ${current.service}, prioridad ${current.priority}, estado actual ${current.status}, SLA restante ${current.sla}.`;
  }

  if (text.includes("hacer") || text.includes("siguiente")) {
    if (current.status === "Pendiente por cliente") {
      return "Debes ingresar al portal del cliente y responder la solicitud del asesor o adjuntar la evidencia solicitada.";
    }

    return "Por ahora debes esperar la siguiente actualización. Puedes descargar la constancia o revisar el historial resumido.";
  }

  return "Puedo explicar el estado, resumir el caso, revisar el riesgo SLA o sugerir el siguiente paso.";
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