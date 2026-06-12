"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CENTRO DE AYUDA JS
   Preparado para integración backend
========================================================= */

const HelpState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  segment: "personas",
  activeFaqFilter: "todos"
};

const HelpData = {
  personas: {
    quickTitle: "¿Qué necesitas hacer?",
    quickSubtitle: "Accesos rápidos para resolver consultas de clientes personas.",
    categoriesTitle: "Temas frecuentes para Personas",
    quickActions: [
      {
        icon: "📝",
        title: "Registrar reclamo",
        text: "Presenta un reclamo por cobro, atención, servicio o facturación.",
        href: "cliente/registrar-reclamo.html"
      },
      {
        icon: "⚠️",
        title: "Reportar incidencia",
        text: "Informa fallas técnicas, lentitud o interrupciones.",
        href: "cliente/registrar-incidencia.html"
      },
      {
        icon: "🔎",
        title: "Consultar caso",
        text: "Revisa el estado de un reclamo o incidencia.",
        href: "consulta-rapida.html"
      },
      {
        icon: "📶",
        title: "Ver cobertura",
        text: "Consulta disponibilidad de red y servicios.",
        href: "estado-servicios.html"
      },
      {
        icon: "📄",
        title: "Conoce tu recibo",
        text: "Entiende cargos, consumos y fechas de pago.",
        href: "#faq"
      }
    ],
    categories: [
      {
        icon: "📱",
        title: "Móvil",
        text: "Líneas, señal, datos, roaming y beneficios.",
        count: 14,
        tag: "Personas"
      },
      {
        icon: "🏠",
        title: "Internet hogar",
        text: "Velocidad, cortes, router, cobertura y soporte.",
        count: 18,
        tag: "Hogar"
      },
      {
        icon: "📺",
        title: "Claro TV+",
        text: "Canales, paquetes, decodificador y señal.",
        count: 9,
        tag: "TV"
      },
      {
        icon: "💳",
        title: "Facturación",
        text: "Recibos, pagos, cobros, cargos y reclamos.",
        count: 20,
        tag: "Pagos"
      }
    ],
    articles: [
      {
        icon: "📶",
        tag: "Internet",
        title: "Qué hacer si tu internet está lento",
        text: "Revisa pasos básicos antes de reportar una incidencia.",
        steps: [
          "Verifica si otros dispositivos presentan la misma lentitud.",
          "Reinicia el router y espera dos minutos.",
          "Realiza una prueba de velocidad.",
          "Si continúa el problema, registra una incidencia."
        ]
      },
      {
        icon: "💳",
        tag: "Facturación",
        title: "Cómo revisar un cobro no reconocido",
        text: "Identifica el cargo, revisa tu recibo y registra un reclamo si corresponde.",
        steps: [
          "Identifica el cargo observado en tu recibo.",
          "Verifica fechas y servicios asociados.",
          "Adjunta captura o recibo.",
          "Registra el reclamo desde la plataforma."
        ]
      },
      {
        icon: "🎫",
        tag: "Seguimiento",
        title: "Cómo consultar el estado de un caso",
        text: "Usa el código CAS y tu documento para revisar el avance.",
        steps: [
          "Ingresa a Consulta rápida.",
          "Coloca el código de caso.",
          "Ingresa DNI o RUC asociado.",
          "Revisa estado, historial y SLA."
        ]
      }
    ]
  },

  empresas: {
    quickTitle: "¿Qué quiere hacer tu empresa?",
    quickSubtitle: "Accesos rápidos para soporte empresarial, cloud, conectividad y servicios gestionados.",
    categoriesTitle: "Temas frecuentes para Empresas",
    quickActions: [
      {
        icon: "🏢",
        title: "Reportar ticket",
        text: "Registra una incidencia empresarial con prioridad y SLA.",
        href: "cliente/registrar-incidencia.html"
      },
      {
        icon: "☁️",
        title: "Soporte cloud",
        text: "Ayuda para servicios cloud, correo, colaboración y backup.",
        href: "#diagnostico"
      },
      {
        icon: "🛡️",
        title: "Seguridad",
        text: "Consulta ayuda sobre ciberseguridad y continuidad.",
        href: "#categorias"
      },
      {
        icon: "📡",
        title: "Conectividad",
        text: "Atención para fibra óptica, telefonía fija y red corporativa.",
        href: "estado-servicios.html"
      },
      {
        icon: "🔎",
        title: "Consultar ticket",
        text: "Revisa el avance de una incidencia empresarial.",
        href: "consulta-rapida.html"
      }
    ],
    categories: [
      {
        icon: "☁️",
        title: "Cloud",
        text: "Infraestructura, almacenamiento, correo y colaboración.",
        count: 16,
        tag: "Empresa"
      },
      {
        icon: "📡",
        title: "Conectividad",
        text: "Fibra óptica, telefonía fija y red empresarial.",
        count: 12,
        tag: "Red"
      },
      {
        icon: "🛡️",
        title: "Ciberseguridad",
        text: "Servicios de seguridad, respaldo y continuidad.",
        count: 11,
        tag: "Seguridad"
      },
      {
        icon: "🎧",
        title: "Mesa de ayuda",
        text: "Tickets, escalamiento, SLA y soporte especializado.",
        count: 19,
        tag: "Soporte"
      }
    ],
    articles: [
      {
        icon: "📧",
        tag: "Correo",
        title: "Qué hacer si el correo empresa no funciona",
        text: "Pasos para validar acceso, credenciales y servicio.",
        steps: [
          "Verifica si el problema afecta a uno o varios usuarios.",
          "Valida credenciales y conexión.",
          "Adjunta captura del mensaje de error.",
          "Registra un ticket empresarial."
        ]
      },
      {
        icon: "☁️",
        tag: "Cloud",
        title: "Cómo reportar una incidencia cloud",
        text: "Registra un ticket con datos técnicos y evidencias.",
        steps: [
          "Identifica el servicio afectado.",
          "Registra fecha, hora y usuarios impactados.",
          "Adjunta evidencia técnica.",
          "Selecciona prioridad según impacto."
        ]
      },
      {
        icon: "🛡️",
        tag: "Seguridad",
        title: "Recomendaciones ante alerta de seguridad",
        text: "Acciones iniciales ante un evento sospechoso.",
        steps: [
          "No compartas credenciales.",
          "Documenta el evento detectado.",
          "Aísla el equipo afectado si corresponde.",
          "Reporta el incidente a soporte empresarial."
        ]
      }
    ]
  }
};

const FaqData = [
  {
    category: "reclamos",
    question: "¿Cómo registro un reclamo?",
    answer:
      "Debes ingresar al módulo de registro, seleccionar el servicio afectado, categoría, descripción y adjuntar evidencia si corresponde."
  },
  {
    category: "incidencias",
    question: "¿Cuál es la diferencia entre reclamo e incidencia?",
    answer:
      "Un reclamo expresa disconformidad por atención, cobro o servicio. Una incidencia reporta un problema técnico o evento que afecta el funcionamiento del servicio."
  },
  {
    category: "reclamos",
    question: "¿Qué significa Pendiente por cliente?",
    answer:
      "Significa que el asesor necesita información adicional para continuar la atención. Debes responder la solicitud o adjuntar la evidencia requerida."
  },
  {
    category: "facturacion",
    question: "¿Puedo reclamar un cobro no reconocido?",
    answer:
      "Sí. Debes adjuntar recibo, captura o detalle del cargo observado para que el asesor pueda revisar el caso."
  },
  {
    category: "empresas",
    question: "¿Cómo registro un ticket empresarial?",
    answer:
      "Debes seleccionar el servicio empresarial afectado, describir el impacto, indicar prioridad y adjuntar evidencia técnica."
  },
  {
    category: "empresas",
    question: "¿Los tickets empresariales tienen SLA?",
    answer:
      "Sí. El plazo depende de la prioridad, categoría, servicio afectado y reglas configuradas para la atención empresarial."
  }
];

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(HelpState.theme);
  bindTheme();
  bindSegment();
  bindSearch();
  bindDiagnostic();
  bindFaqFilters();
  bindBot();
  bindModals();
  renderSegment("personas");
  renderFaq("todos");
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
  HelpState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = HelpState.theme === "light" ? "dark" : "light";
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
      if (!segment || segment === HelpState.segment) return;

      renderSegment(segment);

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message:
          segment === "personas"
            ? "Se cargaron temas para clientes personas."
            : "Se cargaron temas para empresas.",
        type: "info"
      });
    });
  });
}

function renderSegment(segment) {
  HelpState.segment = segment;

  $all(".segment-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.segment === segment);
  });

  const data = HelpData[segment];

  setText("#quickTitle", data.quickTitle);
  setText("#quickSubtitle", data.quickSubtitle);
  setText("#categoriesTitle", data.categoriesTitle);
  setText("#articlesTitle", segment === "personas"
    ? "Guías útiles para resolver tus consultas"
    : "Guías empresariales recomendadas"
  );

  renderQuickActions(data.quickActions);
  renderCategories(data.categories);
  renderArticles(data.articles);
}

function renderQuickActions(items) {
  const grid = $("#quickGrid");
  if (!grid) return;

  grid.innerHTML = items
    .map((item) => {
      return `
        <article class="quick-card">
          <span>${item.icon}</span>
          <h3>${item.title}</h3>
          <p>${item.text}</p>
          <a href="${item.href}">Ir ahora ›</a>
        </article>
      `;
    })
    .join("");
}

function renderCategories(items) {
  const grid = $("#categoriesGrid");
  if (!grid) return;

  grid.innerHTML = items
    .map((item) => {
      return `
        <article class="category-card">
          <div class="category-card__icon">${item.icon}</div>
          <h3>${item.title}</h3>
          <p>${item.text}</p>
          <div class="category-card__meta">
            <span>${item.count} artículos</span>
            <span>${item.tag}</span>
          </div>
          <button type="button" data-category="${item.title}">
            Ver temas
          </button>
        </article>
      `;
    })
    .join("");

  $all("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;

      openGenericModal({
        icon: "📚",
        title: `Temas de ${category}`,
        text: "En la versión backend se cargarán artículos filtrados por esta categoría."
      });
    });
  });
}

function renderArticles(items) {
  const grid = $("#articlesGrid");
  if (!grid) return;

  grid.innerHTML = items
    .map((item, index) => {
      return `
        <article class="article-card">
          <div class="article-card__icon">${item.icon}</div>
          <span class="article-card__tag">${item.tag}</span>
          <h3>${item.title}</h3>
          <p>${item.text}</p>
          <button type="button" data-article-index="${index}">
            Leer guía ›
          </button>
        </article>
      `;
    })
    .join("");

  $all("[data-article-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.articleIndex);
      const article = HelpData[HelpState.segment].articles[index];

      openArticle(article);
    });
  });
}

function openArticle(article) {
  setText("#articleModalTitle", article.title);
  setText("#articleModalText", article.text);

  const steps = $("#articleSteps");
  if (steps) {
    steps.innerHTML = article.steps
      .map((step, index) => {
        return `
          <div class="article-step">
            <span>${index + 1}</span>
            <p>${step}</p>
          </div>
        `;
      })
      .join("");
  }

  openModal("#articleModal");
}

function bindSearch() {
  $("#helpSearchBtn")?.addEventListener("click", handleHelpSearch);

  $("#helpSearchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleHelpSearch();
    }
  });

  $all("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      $("#helpSearchInput").value = prompt;
      handleHelpSearch();
    });
  });
}

function handleHelpSearch() {
  const query = $("#helpSearchInput")?.value.trim();

  if (!query) {
    showToast({
      title: "Búsqueda vacía",
      message: "Describe tu consulta o selecciona una sugerencia.",
      type: "warning"
    });
    return;
  }

  openBot();
  addBotMessage(query, "user");

  setTimeout(() => {
    addBotMessage(generateBotResponse(query), "bot");
  }, 500);
}

function bindDiagnostic() {
  $("#diagnosticForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearErrors();

    const payload = getDiagnosticPayload();
    const validation = validateDiagnostic(payload);

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "Diagnóstico incompleto",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    renderDiagnosticLoading();

    await delay(700);

    renderDiagnosticResult(payload);
  });
}

function getDiagnosticPayload() {
  return {
    service: $("#diagnosticService")?.value.trim(),
    problem: $("#diagnosticProblem")?.value.trim(),
    urgency: $("#diagnosticUrgency")?.value.trim()
  };
}

function validateDiagnostic(payload) {
  const errors = {};

  if (!payload.service) {
    errors.diagnosticService = "Selecciona el servicio afectado.";
  }

  if (!payload.problem) {
    errors.diagnosticProblem = "Describe el problema.";
  }

  if (!payload.urgency) {
    errors.diagnosticUrgency = "Selecciona la urgencia.";
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
    const element = $(`#${key}Error`);
    if (element) element.textContent = value;
  });
}

function clearErrors() {
  $all(".form-error").forEach((item) => {
    item.textContent = "";
  });
}

function renderDiagnosticLoading() {
  const result = $("#diagnosticResult");
  if (!result) return;

  result.innerHTML = `
    <div class="empty-diagnostic">
      <span>🤖</span>
      <h3>Analizando consulta...</h3>
      <p>ClaroBot IA está evaluando el servicio, problema y urgencia.</p>
    </div>
  `;
}

function renderDiagnosticResult(payload) {
  const result = $("#diagnosticResult");
  if (!result) return;

  const problem = payload.problem.toLowerCase();

  let action = "Consultar centro de ayuda";
  let route = "centro-ayuda.html";
  let priority = payload.urgency;

  if (
    problem.includes("cobro") ||
    problem.includes("factura") ||
    problem.includes("recibo") ||
    problem.includes("reclamo")
  ) {
    action = "Registrar reclamo";
    route = "cliente/registrar-reclamo.html";
  }

  if (
    problem.includes("lento") ||
    problem.includes("no funciona") ||
    problem.includes("caído") ||
    problem.includes("falla") ||
    problem.includes("incidencia") ||
    payload.service === "cloud" ||
    payload.service === "correo"
  ) {
    action = "Registrar incidencia";
    route = "cliente/registrar-incidencia.html";
  }

  result.innerHTML = `
    <div class="diagnostic-recommendation">
      <div class="diagnostic-result-icon">🤖</div>
      <h3>Recomendación IA</h3>
      <p>
        Según tu descripción, la mejor acción sugerida es:
      </p>

      <div class="recommendation-box">
        <span>Acción recomendada</span>
        <strong>${action}</strong>
      </div>

      <div class="recommendation-box">
        <span>Prioridad estimada</span>
        <strong>${priority}</strong>
      </div>

      <div class="recommendation-box">
        <span>Evidencia sugerida</span>
        <strong>${getSuggestedEvidence(payload.service)}</strong>
      </div>

      <a href="${route}" class="btn btn--primary btn--full">
        Continuar
      </a>
    </div>
  `;

  showToast({
    title: "Diagnóstico completado",
    message: `ClaroBot recomienda: ${action}.`,
    type: "success"
  });
}

function getSuggestedEvidence(service) {
  const evidence = {
    movil: "Captura de señal, mensaje de error o detalle de línea.",
    hogar: "Prueba de velocidad, foto del router o captura del problema.",
    tv: "Foto del mensaje en pantalla o detalle del canal afectado.",
    cloud: "Captura técnica, usuario afectado y hora del evento.",
    correo: "Captura del error, cuenta afectada y fecha/hora.",
    facturacion: "Recibo, cargo observado y comprobante de pago."
  };

  return evidence[service] || "Captura o documento relacionado al problema.";
}

function bindFaqFilters() {
  $all(".faq-filter").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter || "todos";

      HelpState.activeFaqFilter = filter;

      $all(".faq-filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      renderFaq(filter);
    });
  });
}

function renderFaq(filter) {
  const list = $("#faqList");
  if (!list) return;

  const items =
    filter === "todos"
      ? FaqData
      : FaqData.filter((item) => item.category === filter);

  if (!items.length) {
    list.innerHTML = `
      <div class="faq-item">
        <button class="faq-question" type="button">
          <span>No hay preguntas para este filtro</span>
          <strong>—</strong>
        </button>
      </div>
    `;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      return `
        <article class="faq-item">
          <button class="faq-question" type="button">
            <span>${item.question}</span>
            <strong>+</strong>
          </button>
          <div class="faq-answer">
            ${item.answer}
          </div>
        </article>
      `;
    })
    .join("");

  $all(".faq-question").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".faq-item");
      item?.classList.toggle("open");

      const icon = button.querySelector("strong");
      if (icon) icon.textContent = item?.classList.contains("open") ? "−" : "+";
    });
  });
}

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#openBotContact")?.addEventListener("click", openBot);
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

  $("#articleAskBot")?.addEventListener("click", () => {
    closeAllModals();
    openBot();
    addBotMessage("Explícame este artículo de forma simple", "user");
    setTimeout(() => {
      addBotMessage(
        "Claro. La idea principal es identificar el problema, reunir evidencia y elegir la acción correcta: ayuda, reclamo o incidencia.",
        "bot"
      );
    }, 400);
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
  message.textContent = "ClaroBot está buscando la mejor respuesta...";

  container?.appendChild(message);

  if (container) container.scrollTop = container.scrollHeight;

  return message;
}

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("reclamo") && text.includes("incidencia")) {
    return "Un reclamo es una disconformidad por cobro, atención o servicio. Una incidencia es una falla técnica o evento que afecta el funcionamiento. Si hay cobro indebido, registra reclamo. Si hay falla técnica, registra incidencia.";
  }

  if (text.includes("pendiente por cliente")) {
    return "Pendiente por cliente significa que el asesor necesita información adicional. Debes responder la solicitud o adjuntar evidencia para que el caso continúe.";
  }

  if (text.includes("evidencia")) {
    return "Puedes adjuntar capturas, recibos, fotos del equipo, mensajes de error, pruebas de velocidad o documentos relacionados al problema.";
  }

  if (text.includes("internet") || text.includes("lento")) {
    return "Para internet lento, realiza una prueba de velocidad, reinicia el router, verifica si ocurre en varios dispositivos y registra una incidencia si el problema continúa.";
  }

  if (text.includes("cobro") || text.includes("recibo") || text.includes("factura")) {
    return "Para cobros observados, revisa tu recibo, identifica el cargo y registra un reclamo adjuntando evidencia.";
  }

  if (text.includes("empresa") || text.includes("cloud") || text.includes("correo")) {
    return "Para soporte empresarial, registra un ticket indicando servicio afectado, usuarios impactados, fecha/hora, prioridad y evidencia técnica.";
  }

  return "Puedo ayudarte a buscar artículos, diferenciar reclamo e incidencia, sugerir evidencias o guiarte hacia la mejor acción.";
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