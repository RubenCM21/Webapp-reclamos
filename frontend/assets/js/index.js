/* =========================================================
   CLARO ATENCIÓN 360 - INDEX JS
   Simulación frontend lista para integración backend
========================================================= */

"use strict";

/* =========================================================
   STATE
========================================================= */

const AppState = {
  segment: "personas",
  currentHeroSlide: 0,
  theme: localStorage.getItem("claro360-theme") || "light",
  mockCases: [
    {
      code: "CAS-2026-000123",
      documentNumber: "76543210",
      type: "Reclamo",
      service: "Internet hogar",
      status: "En atención",
      lastUpdate: "21/05/2026 09:30",
      assignedArea: "Área de atención técnica"
    },
    {
      code: "CAS-2026-000245",
      documentNumber: "20123456789",
      type: "Incidencia",
      service: "Cloud empresarial",
      status: "Pendiente por cliente",
      lastUpdate: "21/05/2026 08:15",
      assignedArea: "Soporte empresarial"
    }
  ]
};

/* =========================================================
   DATA READY FOR BACKEND REPLACEMENT
   Después, estos arrays pueden venir de /api/public/home
========================================================= */

const HomeData = {
  personas: {
    hero: {
      eyebrow: "Personas | Atención inteligente",
      title: "Gestiona tus reclamos e incidencias en tiempo real",
      description:
        "Registra, consulta y haz seguimiento de tus casos desde una plataforma moderna, rápida y transparente, con asistencia inteligente en cada paso.",
      primaryText: "Registrar reclamo",
      primaryHref: "cliente/registrar-reclamo.html",
      panelTitle: "Centro de atención rápida",
      statusText: "Atención disponible"
    },
    navCloudLabel: "Tienda",
    quickTitle: "¿Qué necesitas hacer hoy?",
    quickSubtitle: "Accesos rápidos para gestionar tus servicios, reclamos e incidencias.",
    solutionsEyebrow: "Soluciones para personas",
    solutionsTitle: "Tenemos lo que estás buscando",
    solutionsSubtitle:
      "Explora servicios, gestiones digitales y herramientas para resolver tus necesidades.",
    quickActions: [
      {
        icon: "📝",
        title: "Registrar reclamo",
        description: "Inicia un reclamo por facturación, atención, servicio o cobro.",
        href: "cliente/registrar-reclamo.html"
      },
      {
        icon: "⚠️",
        title: "Registrar incidencia",
        description: "Reporta fallas técnicas, lentitud, interrupciones o problemas.",
        href: "cliente/registrar-incidencia.html"
      },
      {
        icon: "🔎",
        title: "Consultar caso",
        description: "Revisa el estado de tu reclamo o incidencia con tu código.",
        href: "consulta-rapida.html"
      },
      {
        icon: "📡",
        title: "Ver cobertura",
        description: "Consulta disponibilidad y estado estimado del servicio.",
        href: "#estado-servicios"
      },
      {
        icon: "🤖",
        title: "Centro de ayuda IA",
        description: "Recibe orientación rápida con ClaroBot IA.",
        href: "#buscador"
      }
    ],
    solutions: [
      {
        tag: "Hogar",
        title: "Internet hogar",
        description: "Consulta planes, reporta incidencias y revisa disponibilidad.",
        image:
          "https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?auto=format&fit=crop&w=900&q=80",
        href: "#"
      },
      {
        tag: "Móvil",
        title: "Servicios móviles",
        description: "Gestiona líneas, reclamos, cobertura y beneficios.",
        image:
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
        href: "#"
      },
      {
        tag: "Atención",
        title: "Seguimiento 360",
        description: "Visualiza el avance de tus casos en tiempo real.",
        image:
          "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80",
        href: "consulta-rapida.html"
      },
      {
        tag: "Ayuda",
        title: "Soporte guiado",
        description: "Preguntas frecuentes, chatbot y recomendaciones inteligentes.",
        image:
          "https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&w=900&q=80",
        href: "centro-ayuda.html"
      }
    ]
  },

  empresas: {
    hero: {
      eyebrow: "Empresas | Soluciones digitales",
      title: "Potencia tu empresa con atención y soporte inteligente",
      description:
        "Gestiona incidencias empresariales, servicios cloud, conectividad, seguridad y soporte con trazabilidad completa y control de SLA.",
      primaryText: "Solicitar atención",
      primaryHref: "cliente/registrar-incidencia.html",
      panelTitle: "Centro empresarial inteligente",
      statusText: "Mesa empresarial activa"
    },
    navCloudLabel: "Cloud",
    quickTitle: "¿Qué quieres hacer hoy?",
    quickSubtitle: "Accesos para soporte, servicios digitales y soluciones empresariales.",
    solutionsEyebrow: "Soluciones para empresas",
    solutionsTitle: "Herramientas digitales para tu negocio",
    solutionsSubtitle:
      "Conectividad, productividad, cloud, seguridad y atención especializada.",
    quickActions: [
      {
        icon: "🏢",
        title: "Reportar incidencia",
        description: "Registra un ticket empresarial por conectividad, cloud o soporte.",
        href: "cliente/registrar-incidencia.html"
      },
      {
        icon: "☁️",
        title: "Soluciones cloud",
        description: "Consulta servicios cloud, colaboración y productividad.",
        href: "#soluciones"
      },
      {
        icon: "📧",
        title: "Correo empresas",
        description: "Accede a soporte para correo y herramientas digitales.",
        href: "#"
      },
      {
        icon: "🛡️",
        title: "Seguridad empresarial",
        description: "Revisa opciones de ciberseguridad y continuidad.",
        href: "#"
      },
      {
        icon: "🎧",
        title: "Mesa de ayuda",
        description: "Consulta tickets, SLA y atención especializada.",
        href: "consulta-rapida.html"
      }
    ],
    solutions: [
      {
        tag: "Conectividad",
        title: "Fibra óptica empresarial",
        description: "Alta disponibilidad para operaciones críticas.",
        image:
          "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80",
        href: "#"
      },
      {
        tag: "Cloud",
        title: "Cloud empresarial",
        description: "Infraestructura, productividad y colaboración.",
        image:
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80",
        href: "#"
      },
      {
        tag: "Seguridad",
        title: "Ciberseguridad",
        description: "Protección, monitoreo y continuidad del negocio.",
        image:
          "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80",
        href: "#"
      },
      {
        tag: "Soporte",
        title: "Atención empresarial 360",
        description: "Tickets, SLA, seguimiento y reportes ejecutivos.",
        image:
          "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
        href: "consulta-rapida.html"
      }
    ]
  }
};

/* =========================================================
   API MOCK LAYER
   En backend real, solo cambiar esta capa por fetch()
========================================================= */

const api = {
  async lookupCase({ caseCode, documentNumber }) {
    await delay(500);

    return AppState.mockCases.find((item) => {
      return (
        item.code.toLowerCase() === caseCode.toLowerCase() &&
        item.documentNumber === documentNumber
      );
    });
  },

  async askAI(prompt) {
    await delay(650);
    return generateAIResponse(prompt);
  },

  async getHomeData(segment) {
    await delay(120);
    return HomeData[segment];
  }
};

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(AppState.theme);
  bindNavigation();
  bindSegmentSwitch();
  bindHeroPanel();
  bindQuickCaseForm();
  bindAI();
  bindBot();
  bindModals();
  bindSearch();
  bindHelp();
  bindCounters();
  renderSegment("personas");
});

/* =========================================================
   UTILITIES
========================================================= */

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showToast({ title, message, type = "info" }) {
  const container = $("#toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : type === "warning" ? "!" : "ℹ"}</span>
    <div>
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 250);
  }, 4200);
}

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}

function setHref(selector, href) {
  const element = $(selector);
  if (element) element.setAttribute("href", href);
}

/* =========================================================
   NAVIGATION
========================================================= */

function bindNavigation() {
  const mainNav = $("#mainNav");
  const mobileBtn = $("#mobileMenuBtn");
  const mainMenu = $("#mainMenu");

  window.addEventListener("scroll", () => {
    if (window.scrollY > 12) {
      mainNav?.classList.add("scrolled");
    } else {
      mainNav?.classList.remove("scrolled");
    }
  });

  mobileBtn?.addEventListener("click", () => {
    mainMenu?.classList.toggle("open");
  });

  $all('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      mainMenu?.classList.remove("open");
    });
  });

  const themeBtn = $("#themeToggle");
  themeBtn?.addEventListener("click", () => {
    const nextTheme = AppState.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${nextTheme === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function applyTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

/* =========================================================
   SEGMENT SWITCH
========================================================= */

function bindSegmentSwitch() {
  $all(".segment-tab").forEach((button) => {
    button.addEventListener("click", () => {
      const segment = button.dataset.segment;
      if (!segment || segment === AppState.segment) return;

      $all(".segment-tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");

      renderSegment(segment);

      showToast({
        title: segment === "personas" ? "Vista Personas" : "Vista Empresas",
        message:
          segment === "personas"
            ? "Se cargaron accesos para clientes personas."
            : "Se cargaron soluciones y soporte empresarial.",
        type: "info"
      });
    });
  });
}

async function renderSegment(segment) {
  AppState.segment = segment;

  const data = await api.getHomeData(segment);

  setText("#heroEyebrow", data.hero.eyebrow);
  setText("#heroTitle", data.hero.title);
  setText("#heroDescription", data.hero.description);
  setText("#heroPrimaryBtn", data.hero.primaryText);
  setHref("#heroPrimaryBtn", data.hero.primaryHref);
  setText("#panelTitle", data.hero.panelTitle);
  setText("#heroStatusText", data.hero.statusText);

  const navCloud = $('[data-label-personas]');
  if (navCloud) {
    navCloud.textContent =
      segment === "personas"
        ? navCloud.dataset.labelPersonas
        : navCloud.dataset.labelEmpresas;
  }

  setText("#quickActionsTitle", data.quickTitle);
  setText("#quickActionsSubtitle", data.quickSubtitle);
  setText("#solutionsEyebrow", data.solutionsEyebrow);
  setText("#solutionsTitle", data.solutionsTitle);
  setText("#solutionsSubtitle", data.solutionsSubtitle);

  renderQuickActions(data.quickActions);
  renderSolutions(data.solutions);
  toggleMegaMenuContent(segment);
  toggleHeroSlide(segment);
}

function toggleMegaMenuContent(segment) {
  $all("[data-menu-content]").forEach((menu) => {
    menu.classList.toggle("hidden", menu.dataset.menuContent !== segment);
  });
}

function toggleHeroSlide(segment) {
  $all(".hero__slide").forEach((slide) => {
    slide.classList.toggle("active", slide.dataset.slide === segment);
  });
}

function renderQuickActions(actions) {
  const grid = $("#quickActionsGrid");
  if (!grid) return;

  grid.innerHTML = actions
    .map((item) => {
      return `
        <article class="quick-action-card">
          <span class="quick-action-card__icon">${item.icon}</span>
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <a href="${item.href}">Conoce más ›</a>
        </article>
      `;
    })
    .join("");
}

function renderSolutions(solutions) {
  const grid = $("#solutionsGrid");
  if (!grid) return;

  grid.innerHTML = solutions
    .map((item) => {
      return `
        <article class="solution-card">
          <img src="${item.image}" alt="${item.title}">
          <div class="solution-card__content">
            <span class="solution-card__tag">${item.tag}</span>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <a href="${item.href}" class="btn btn--primary">Ver más</a>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================================================
   HERO PANEL
========================================================= */

function bindHeroPanel() {
  const serviceButtons = $all(".service-toggle__item");

  serviceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      serviceButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      const service = button.dataset.service;
      updateHeroSelect(service);
    });
  });

  $("#heroPanelAction")?.addEventListener("click", () => {
    const action = $("#heroActionSelect")?.value;

    const routes = {
      "registrar-reclamo": "cliente/registrar-reclamo.html",
      "registrar-incidencia": "cliente/registrar-incidencia.html",
      "consultar-caso": "consulta-rapida.html",
      "centro-ayuda": "centro-ayuda.html"
    };

    if (routes[action]) {
      window.location.href = routes[action];
    }
  });

  $("#prevSlide")?.addEventListener("click", () => animateDots(-1));
  $("#nextSlide")?.addEventListener("click", () => animateDots(1));
}

function updateHeroSelect(service) {
  const select = $("#heroActionSelect");
  if (!select) return;

  const optionsByService = {
    movil: [
      ["registrar-reclamo", "Registrar reclamo móvil"],
      ["registrar-incidencia", "Reportar incidencia móvil"],
      ["consultar-caso", "Consultar caso móvil"],
      ["centro-ayuda", "Ayuda para mi línea"]
    ],
    hogar: [
      ["registrar-reclamo", "Registrar reclamo hogar"],
      ["registrar-incidencia", "Reportar falla de internet"],
      ["consultar-caso", "Consultar estado de caso"],
      ["centro-ayuda", "Ayuda para internet/TV"]
    ],
    empresa: [
      ["registrar-incidencia", "Reportar incidencia empresarial"],
      ["consultar-caso", "Consultar ticket empresarial"],
      ["centro-ayuda", "Mesa de ayuda empresarial"],
      ["registrar-reclamo", "Registrar reclamo corporativo"]
    ]
  };

  const options = optionsByService[service] || optionsByService.movil;
  select.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");

  const statusText = {
    movil: "Red móvil monitoreada",
    hogar: "Soporte hogar disponible",
    empresa: "Mesa empresarial activa"
  };

  setText("#heroStatusText", statusText[service] || "Atención disponible");
}

function animateDots(direction) {
  const dots = $all(".hero__dots .dot");
  if (!dots.length) return;

  dots[AppState.currentHeroSlide]?.classList.remove("active");

  AppState.currentHeroSlide += direction;

  if (AppState.currentHeroSlide < 0) {
    AppState.currentHeroSlide = dots.length - 1;
  }

  if (AppState.currentHeroSlide >= dots.length) {
    AppState.currentHeroSlide = 0;
  }

  dots[AppState.currentHeroSlide]?.classList.add("active");
}

/* =========================================================
   QUICK CASE LOOKUP
========================================================= */

function bindQuickCaseForm() {
  const form = $("#quickCaseForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const caseCode = String(formData.get("caseCode") || "").trim();
    const documentNumber = String(formData.get("documentNumber") || "").trim();

    if (!caseCode || !documentNumber) {
      openGenericModal({
        icon: "!",
        title: "Datos incompletos",
        text: "Ingresa el código de caso y el DNI/RUC para realizar la consulta."
      });
      return;
    }

    showToast({
      title: "Consultando caso",
      message: "Estamos validando la información ingresada.",
      type: "info"
    });

    const result = await api.lookupCase({ caseCode, documentNumber });

    if (!result) {
      openGenericModal({
        icon: "×",
        title: "Caso no encontrado",
        text: "No encontramos un caso con los datos ingresados. Verifica el código y documento."
      });
      return;
    }

    setText("#resultCaseCode", result.code);
    openModal("#caseResultModal");
  });
}

/* =========================================================
   AI SEARCH
========================================================= */

function bindAI() {
  $("#aiSearchBtn")?.addEventListener("click", handleAISearch);
  $("#aiSearchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleAISearch();
  });

  $("#aiVoiceBtn")?.addEventListener("click", () => {
    showToast({
      title: "Consulta por voz",
      message: "Función simulada. En backend real podría conectarse a reconocimiento de voz.",
      type: "info"
    });
  });

  $all(".quick-prompt").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      const input = $("#aiSearchInput");
      if (input) input.value = prompt;
      handleAISearch();
    });
  });

  $("#openBotFromHero")?.addEventListener("click", openBot);
  $("#openBotFromStatus")?.addEventListener("click", openBot);
  $("#openEvidenceAdvice")?.addEventListener("click", () => {
    openGenericModal({
      icon: "🤖",
      title: "Recomendación IA",
      text:
        "Para agilizar la atención, adjunta capturas, recibos, mensajes de error o evidencia del problema. Esto ayuda al asesor a clasificar y resolver el caso más rápido."
    });
  });
}

async function handleAISearch() {
  const input = $("#aiSearchInput");
  const prompt = input?.value.trim();

  if (!prompt) {
    openGenericModal({
      icon: "!",
      title: "Consulta vacía",
      text: "Escribe una consulta o selecciona una sugerencia rápida."
    });
    return;
  }

  openBot();
  addBotMessage(prompt, "user");

  const response = await api.askAI(prompt);
  addBotMessage(response, "bot");

  input.value = "";
}

/* =========================================================
   BOT DRAWER
========================================================= */

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#floatingHelp")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);
  $("#drawerBackdrop")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addBotMessage(prompt, "user");
    input.value = "";

    const typing = addTypingMessage();

    const response = await api.askAI(prompt);
    typing.remove();
    addBotMessage(response, "bot");
  });

  $all("[data-bot-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.botPrompt || "";
      addBotMessage(prompt, "user");

      const typing = addTypingMessage();
      const response = await api.askAI(prompt);
      typing.remove();
      addBotMessage(response, "bot");
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

function addBotMessage(message, sender) {
  const container = $("#botMessages");
  if (!container) return;

  const bubble = document.createElement("div");
  bubble.className = `bot-message bot-message--${sender}`;
  bubble.textContent = message;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function addTypingMessage() {
  const container = $("#botMessages");

  const bubble = document.createElement("div");
  bubble.className = "bot-message bot-message--bot";
  bubble.textContent = "ClaroBot está analizando tu consulta...";

  container?.appendChild(bubble);
  if (container) container.scrollTop = container.scrollHeight;

  return bubble;
}

function generateAIResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("reclamo")) {
    return "Para registrar un reclamo, te recomiendo indicar servicio afectado, categoría, descripción clara y evidencia. Puedo llevarte al formulario de registro.";
  }

  if (text.includes("incidencia") || text.includes("internet") || text.includes("lento")) {
    return "Parece una incidencia técnica. Te sugiero registrar el servicio afectado, fecha, frecuencia del problema y adjuntar una captura o evidencia.";
  }

  if (text.includes("estado") || text.includes("caso") || text.includes("ticket")) {
    return "Puedes consultar tu caso usando el código CAS y tu DNI/RUC. También podrás ver estado, responsable, historial y última actualización.";
  }

  if (text.includes("empresa") || text.includes("cloud") || text.includes("soporte")) {
    return "Para empresas, puedo ayudarte a reportar incidencias de conectividad, cloud, correo, seguridad o servicios gestionados con control de SLA.";
  }

  if (text.includes("pendiente por cliente")) {
    return "El estado Pendiente por cliente significa que el asesor necesita información adicional para continuar la atención. Debes responder la solicitud o adjuntar evidencia.";
  }

  return "Puedo ayudarte con registro de reclamos, incidencias, consulta de casos, seguimiento, cobertura, estado de servicios y soporte para Personas o Empresas.";
}

/* =========================================================
   MODALS
========================================================= */

function bindModals() {
  $all("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      closeSearch();
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

/* =========================================================
   GLOBAL SEARCH
========================================================= */

function bindSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);

  $all("[data-close-search]").forEach((button) => {
    button.addEventListener("click", closeSearch);
  });

  const input = $("#globalSearchInput");

  input?.addEventListener("input", () => {
    renderSearchResults(input.value);
  });

  document.addEventListener("keydown", (event) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const shortcut = isMac ? event.metaKey : event.ctrlKey;

    if (shortcut && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });
}

function openSearch() {
  const modal = $("#searchModal");
  modal?.classList.add("show");
  modal?.setAttribute("aria-hidden", "false");
  document.body.classList.add("search-open");

  setTimeout(() => $("#globalSearchInput")?.focus(), 100);
}

function closeSearch() {
  const modal = $("#searchModal");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-open");
}

function renderSearchResults(query) {
  const container = $("#globalSearchResults");
  if (!container) return;

  const clean = query.trim().toLowerCase();

  if (!clean) {
    container.innerHTML = `<p class="muted">Prueba buscando: reclamo, incidencia, SLA, internet, empresa.</p>`;
    return;
  }

  const results = [
    {
      icon: "📝",
      title: "Registrar reclamo",
      description: "Formulario guiado para registrar reclamos.",
      href: "cliente/registrar-reclamo.html",
      keywords: "reclamo registro facturación atención"
    },
    {
      icon: "⚠️",
      title: "Registrar incidencia",
      description: "Reporta problemas técnicos o interrupciones.",
      href: "cliente/registrar-incidencia.html",
      keywords: "incidencia internet lento falla soporte"
    },
    {
      icon: "🔎",
      title: "Consulta rápida de caso",
      description: "Busca un caso por código y documento.",
      href: "consulta-rapida.html",
      keywords: "caso ticket seguimiento estado"
    },
    {
      icon: "📊",
      title: "SLA y seguimiento",
      description: "Control de plazo, avance e historial.",
      href: "#reclamos",
      keywords: "sla tiempo vencimiento seguimiento"
    },
    {
      icon: "🏢",
      title: "Soporte empresas",
      description: "Atención para clientes empresariales.",
      href: "#soluciones",
      keywords: "empresa cloud correo seguridad"
    }
  ].filter((item) => {
    return (
      item.title.toLowerCase().includes(clean) ||
      item.description.toLowerCase().includes(clean) ||
      item.keywords.includes(clean)
    );
  });

  if (!results.length) {
    container.innerHTML = `
      <p class="muted">No se encontraron resultados. Prueba con otra palabra o consulta a ClaroBot IA.</p>
    `;
    return;
  }

  container.innerHTML = results
    .map((item) => {
      return `
        <a href="${item.href}" class="search-result-item">
          <span>${item.icon}</span>
          <div>
            <strong>${item.title}</strong>
            <small>${item.description}</small>
          </div>
        </a>
      `;
    })
    .join("");
}

/* =========================================================
   HELP
========================================================= */

function bindHelp() {
  $("#helpSearchBtn")?.addEventListener("click", () => {
    const query = $("#helpSearchInput")?.value.trim();

    if (!query) {
      showToast({
        title: "Centro de ayuda",
        message: "Escribe una palabra clave para buscar.",
        type: "warning"
      });
      return;
    }

    openGenericModal({
      icon: "🔎",
      title: "Resultado de ayuda",
      text: `Encontramos guías relacionadas con: "${query}". En la versión backend, aquí se cargarán artículos reales.`
    });
  });

  $all(".faq-item").forEach((item) => {
    item.addEventListener("click", () => {
      const question = item.querySelector("span")?.textContent || "Pregunta frecuente";

      openGenericModal({
        icon: "?",
        title: question,
        text:
          "Esta respuesta se mostrará desde la base de conocimiento. En el prototipo se presenta como modal informativo."
      });
    });
  });
}

/* =========================================================
   COUNTERS
========================================================= */

function bindCounters() {
  const counters = $all(".counter");
  if (!counters.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );

  counters.forEach((counter) => observer.observe(counter));
}

function animateCounter(element) {
  const target = Number(element.dataset.target || 0);
  const decimal = element.dataset.decimal === "true";
  const duration = 1100;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;

    if (decimal) {
      element.textContent = (value / 10).toFixed(1);
    } else {
      element.textContent = Math.round(value).toLocaleString("es-PE");
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      if (decimal) {
        element.textContent = (target / 10).toFixed(1);
      } else {
        element.textContent = target.toLocaleString("es-PE");
      }
    }
  }

  requestAnimationFrame(frame);
}