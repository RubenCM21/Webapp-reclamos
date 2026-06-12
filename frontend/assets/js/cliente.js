"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - CLIENTE.JS
   Funcional para las 8 pantallas del módulo Cliente
   Reemplazar TODO assets/js/cliente.js por este archivo
========================================================= */

const State = {
  page: document.body.dataset.page || "",
  theme: localStorage.getItem("claro360-theme") || "light",
  caseView: "cards",
  serviceView: "cards",
  notificationView: "list",
  selectedCase: null,
  selectedService: null,
  selectedNotification: null,
  selectedRating: 0,
  filters: {
    caseChip: "todos",
    caseType: "todos",
    caseStatus: "todos",
    casePriority: "todos",
    caseSort: "reciente",
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
   MOCK DATA - reemplazar por API real cuando exista backend
========================================================= */

let Mock = {
  user: {
    name: "Cargando...",
    initials: "…",
    type: "Cliente",
    segment: "Personas",
    document: "—",
    email: "—",
    phone: "—",
    address: "—",
    channel: "Portal cliente",
    security: "Alta"
  },
  cases: [],
  services: [],
  notifications: [],
  activity: []
};

/* ── Transformadores ─────────────────────────────────────────────────────── */

function _mapUserFromApi(perfil) {
  return {
    name:     perfil.name || perfil.nombres || perfil.username || "Usuario",
    initials: perfil.initials || _initials(perfil.name || perfil.nombres || "U"),
    type:     perfil.type_label || "Cliente",
    segment:  perfil.segment || "Personas",
    document: perfil.document || `${perfil.documento_tipo || ""} ${perfil.documento_numero || ""}`.trim(),
    email:    perfil.email || perfil.correo || "—",
    phone:    perfil.phone || perfil.telefono || "—",
    address:  perfil.address || perfil.direccion || "—",
    channel:  "Portal cliente",
    security: "Alta",
  };
}

function _initials(name) {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2) || "??";
}

function _mapActividad(casos) {
  return (casos || []).slice(0, 5).map(c => ({
    icon: c.icon || "📋",
    title: c.code || c.codigo_caso || "—",
    text:  c.title || c.titulo || "—",
    date:  c.date  || "—",
  }));
}

/* ── Cargador principal ───────────────────────────────────────────────────── */

async function _cargarDatosCliente() {
  try {
    // Mostrar estado de carga opcional
    document.body.classList.add("loading-data");

    const [perfilResp, casosResp, serviciosResp, notifsResp] = await Promise.allSettled([
      Api.Clientes.perfil(),
      Api.Clientes.casos({ limit: 50 }),
      Api.Clientes.servicios(),
      Api.Clientes.notificaciones({ limit: 30 }),
    ]);

    if (perfilResp.status === "fulfilled" && perfilResp.value) {
      Mock.user = _mapUserFromApi(perfilResp.value);
    }

    if (casosResp.status === "fulfilled" && casosResp.value) {
      // El backend ya devuelve los casos en formato compatible con Mock
      Mock.cases = casosResp.value.casos || casosResp.value || [];
      Mock.activity = _mapActividad(Mock.cases);
    }

    if (serviciosResp.status === "fulfilled" && serviciosResp.value) {
      // El backend devuelve { servicios: [...] }
      Mock.services = serviciosResp.value.servicios || serviciosResp.value || [];
    }

    if (notifsResp.status === "fulfilled" && notifsResp.value) {
      // El backend devuelve { notificaciones: [...] }
      Mock.notifications = notifsResp.value.notificaciones || notifsResp.value || [];
    }

  } catch (err) {
    console.error("[Cliente] Error cargando datos:", err);
  } finally {
    document.body.classList.remove("loading-data");
  }
}

/* =========================================================
   HELPERS
========================================================= */

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

function text(selector, value) {
  const el = $(selector);
  if (el) el.textContent = value ?? "";
}

function value(selector) {
  return $(selector)?.value?.trim() || "";
}

function checked(selector) {
  return Boolean($(selector)?.checked);
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function statusClass(type) {
  return {
    success: "status-pill--success",
    warning: "status-pill--warning",
    danger: "status-pill--danger",
    info: "status-pill--info"
  }[type] || "status-pill--info";
}

function priorityClass(priority) {
  if (priority === "Crítica") return "status-pill--danger";
  if (priority === "Alta") return "status-pill--warning";
  if (priority === "Media") return "status-pill--info";
  return "status-pill--success";
}

function fileText(selector) {
  const input = $(selector);
  const files = input?.files ? Array.from(input.files) : [];
  if (!files.length) return "Sin archivos adjuntos";
  if (files.length === 1) return files[0].name;
  return `${files.length} archivos seleccionados`;
}

function formatBytes(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(State.theme);

  // ── Cargar datos reales antes de renderizar ──
  await _cargarDatosCliente();

  // ── Inicializar UI (igual que el original) ──
  setupBaseUI();
  setupGlobalEvents();
  setupBot();
  setupSearch();

  if (State.page === "cliente-dashboard")           initDashboard();
  if (State.page === "cliente-mis-casos")           initMisCasos();
  if (State.page === "cliente-detalle-caso")        initDetalleCaso();
  if (State.page === "cliente-servicios")           initServicios();
  if (State.page === "cliente-notificaciones")      initNotificaciones();
  if (State.page === "cliente-perfil")              initProfile();
  if (State.page === "cliente-registrar-reclamo")   initClaim();
  if (State.page === "cliente-registrar-incidencia") initIncident();
});

/* =========================================================
   GENERAL UI
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

  $("#refreshActivityBtn")?.addEventListener("click", () => {
    renderActivity();
    toast("Actividad actualizada", "Se actualizó la línea de tiempo.", "success");
  });
}

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  if (!$("#botDrawer")?.classList.contains("open")) {
    $("#drawerBackdrop")?.classList.remove("show");
    document.body.classList.remove("drawer-open");
  }
}

function setupUser() {
  text("#userNameTop", Mock.user.name);
  text("#userTypeTop", Mock.user.type);
  text("#userAvatar", Mock.user.initials);
}

function setupTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    applyTheme(State.theme === "light" ? "dark" : "light");
    toast("Tema actualizado", `Se activó el modo ${State.theme === "dark" ? "oscuro" : "claro"}.`, "success");
  });
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("claro360-theme", theme);
}

function setupUserMenu() {
  $("#userMenuButton")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("#userMenuDropdown")?.classList.toggle("open");
  });

  document.addEventListener("click", () => $("#userMenuDropdown")?.classList.remove("open"));
}

function setupLogout() {
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#logoutDropdownBtn")?.addEventListener("click", logout);
}

function logout() {
  Api.Session.logout();
}

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

/* =========================================================
   MODALS
========================================================= */

function setupModals() {
  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) closeModals();
  });

  $("#modalBackdrop")?.addEventListener("click", closeModals);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
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
  $$(".modal").forEach(m => {
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
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

/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {
  $("#globalSearchBtn")?.addEventListener("click", openSearch);
  $("#closeSearchBtn")?.addEventListener("click", closeSearch);
  $("#globalSearchInput")?.addEventListener("input", renderSearch);
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

function renderSearch() {
  const box = $("#searchResults");
  if (!box) return;

  const q = value("#globalSearchInput").toLowerCase();
  const items = [
    { icon:"📝", title:"Registrar reclamo", text:"Cobros, facturación, atención o servicio.", href:"registrar-reclamo.html", key:"reclamo cobro facturacion atención servicio" },
    { icon:"⚠️", title:"Registrar incidencia", text:"Falla técnica, lentitud, señal o acceso.", href:"registrar-incidencia.html", key:"incidencia falla tecnica internet señal" },
    ...Mock.cases.map(c => ({ icon:c.icon, title:c.code, text:c.title, href:"detalle-caso.html", key:`${c.code} ${c.title} ${c.service} ${c.status}` })),
    ...Mock.services.map(s => ({ icon:s.icon, title:s.name, text:s.plan, href:"servicios-contratados.html", key:`${s.name} ${s.type} ${s.plan} ${s.status}` })),
    ...Mock.notifications.map(n => ({ icon:n.icon, title:n.title, text:n.message, href:"notificaciones.html", key:`${n.title} ${n.message} ${n.type}` }))
  ];

  const filtered = q ? items.filter(i => i.key.toLowerCase().includes(q)) : items.slice(0, 8);

  box.innerHTML = filtered.length
    ? filtered.map(i => `
        <a href="${i.href}" class="search-result-item">
          <span>${i.icon}</span>
          <div>
            <strong>${esc(i.title)}</strong>
            <small>${esc(i.text)}</small>
          </div>
        </a>
      `).join("")
    : `<p class="muted">No se encontraron resultados.</p>`;
}

/* =========================================================
   BOT
========================================================= */

function setupBot() {
  $("#openBotSidebar")?.addEventListener("click", openBot);
  $("#openBotWelcome")?.addEventListener("click", openBot);
  $("#supportAskBotBtn")?.addEventListener("click", () => askBot("Orientación para resolver más rápido"));
  $("#quickActionAiBtn")?.addEventListener("click", () => askBot("Qué acción me recomiendas hoy"));
  $("#askAiAboutCases")?.addEventListener("click", () => askBot("Analiza mis casos"));
  $("#analyzeAllCasesBtn")?.addEventListener("click", () => askBot("Resume mis casos"));
  $("#detailAskAiBtn")?.addEventListener("click", () => askBot("Resume este caso"));
  $("#detailSummaryAiBtn")?.addEventListener("click", () => askBot("Genera resumen del caso"));
  $("#detailOpenBotBtn")?.addEventListener("click", openBot);
  $("#analyzeNotificationsBtn")?.addEventListener("click", () => askBot("Qué alerta es urgente"));
  $("#analyzeServicesBtn")?.addEventListener("click", () => askBot("Analiza mis servicios"));
  $("#profileAnalyzeBtn")?.addEventListener("click", () => askBot("Analiza mi perfil"));
  $("#claimAnalyzeBtn")?.addEventListener("click", () => askBot("Analiza mi reclamo"));
  $("#incidentDiagnosticBtn")?.addEventListener("click", () => askBot("Diagnóstico de incidencia"));

  $("#closeBotDrawer")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#botInput");
    const prompt = input?.value.trim();
    if (!prompt) return;
    input.value = "";
    await askBot(prompt);
  });

  $$("[data-bot-prompt]").forEach(btn => {
    btn.addEventListener("click", () => askBot(btn.dataset.botPrompt || ""));
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
  addBot(prompt, "user");
  const typing = addTyping();
  await wait(550);
  typing.remove();
  addBot(botAnswer(prompt), "bot");
}

function addBot(textMessage, who) {
  const box = $("#botMessages");
  if (!box) return;
  const msg = document.createElement("div");
  msg.className = `message message--${who}`;
  msg.textContent = textMessage;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function addTyping() {
  const box = $("#botMessages");
  const msg = document.createElement("div");
  msg.className = "message message--bot typing";
  msg.textContent = "ClaroBot está revisando tus datos";
  box?.appendChild(msg);
  if (box) box.scrollTop = box.scrollHeight;
  return msg;
}

function botAnswer(prompt) {
  const p = prompt.toLowerCase();
  const openCases = Mock.cases.filter(c => c.status !== "Resuelto" && c.status !== "Cerrado");
  const pending = Mock.cases.filter(c => c.status === "Pendiente por cliente");
  const urgent = Mock.cases.filter(c => c.priority === "Crítica" || c.slaHours <= 8);
  const unread = Mock.notifications.filter(n => !n.read);

  if (p.includes("reclamo") && p.includes("incidencia")) {
    return "Usa reclamo para disconformidad por cobros, facturación, atención o condiciones. Usa incidencia para fallas técnicas, cortes, lentitud, señal o errores de acceso.";
  }

  if (p.includes("evidencia") || p.includes("adjuntar")) {
    return "Adjunta recibos, capturas claras, fotos del equipo, pruebas de velocidad o mensajes de error. Agrega una breve explicación para que el asesor entienda el contexto.";
  }

  if (p.includes("sla") || p.includes("urgente")) {
    return urgent.length
      ? `El caso más urgente es ${urgent[0].code}, con prioridad ${urgent[0].priority} y SLA ${urgent[0].sla}. Te recomiendo abrir su detalle.`
      : "No hay casos con SLA crítico ahora. Mantén seguimiento a los casos en atención.";
  }

  if (p.includes("perfil") || p.includes("seguridad")) {
    return "Tu perfil debe tener celular, correo y canal preferido actualizados. Para cambios sensibles, conviene activar doble validación.";
  }

  if (p.includes("servicio") || p.includes("internet") || p.includes("señal")) {
    return "Primero revisa Servicios contratados. Si ya hay un caso abierto, evita duplicarlo. Si es falla técnica, registra una incidencia; si es cobro o atención, registra reclamo.";
  }

  if (p.includes("resumen") || p.includes("analiza") || p.includes("diagnóstico")) {
    if (State.page === "notificaciones") return `Tienes ${unread.length} notificaciones no leídas. Atiende primero solicitudes del asesor y alertas SLA.`;
    if (State.page === "servicios-contratados") return `Tienes ${Mock.services.length} servicios vinculados. Internet hogar aparece en observación; revisa casos asociados antes de registrar otro.`;
    if (State.page === "detalle-caso") return "El caso está en revisión. La mejor acción es verificar solicitudes del asesor y subir evidencia clara si corresponde.";
    if (State.page === "perfil") return "Tu perfil está verificado. Mejora la seguridad activando doble validación y mantén actualizado el canal de contacto.";
    return `Tienes ${Mock.cases.length} casos registrados, ${openCases.length} abiertos y ${pending.length} pendiente por acción del cliente.`;
  }

  if (pending.length) return `Tienes una acción pendiente en ${pending[0].code}: ${pending[0].action}. Atenderla evita retrasos.`;

  return "Puedo ayudarte a diferenciar reclamo e incidencia, resumir casos, revisar SLA, sugerir evidencias, analizar servicios o explicar tus notificaciones.";
}

/* =========================================================
   DASHBOARD
========================================================= */

function initDashboard() {
  text("#welcomeSegment", Mock.user.segment);
  text("#welcomeTitle", `Hola, ${Mock.user.name}`);
  text("#welcomeMessage", "Desde este panel puedes registrar reclamos, reportar incidencias, consultar seguimiento, revisar servicios y recibir orientación de ClaroBot IA.");
  text("#accountStatus", "Cuenta activa");
  text("#lastAccess", "Último acceso: hoy 09:45");
  text("#nextSlaStatus", "SLA monitoreado");
  text("#nextSlaText", "1 caso con plazo cercano");
  text("#heroOpenCases", `${Mock.cases.filter(c => c.status !== "Resuelto").length} casos activos`);

  renderKpis();
  renderRecentCases();
  renderAi("#aiSummary", [
    ["Caso con acción pendiente", "Tienes un caso que requiere información adicional para continuar."],
    ["Riesgo SLA", "Un caso técnico tiene plazo cercano. Conviene revisar su detalle."],
    ["Recomendación", "Adjunta evidencias claras para evitar observaciones del asesor."]
  ]);
  renderActivity();
  renderDashboardNotifications();
  renderServices("#servicesGrid", Mock.services);
}

function renderKpis() {
  const box = $("#kpiGrid");
  if (!box) return;

  const data = [
    ["🎫", Mock.cases.length, "Casos totales", "Registrados históricamente"],
    ["⏳", Mock.cases.filter(c => c.status === "En atención").length, "En atención", "Pendientes de resolución"],
    ["✅", Mock.cases.filter(c => c.status === "Resuelto").length, "Resueltos", "Cerrados correctamente"],
    ["🔔", Mock.notifications.filter(n => !n.read).length, "Notificaciones", "Alertas recientes"]
  ];

  box.innerHTML = data.map(i => `
    <article class="kpi-card">
      <span class="kpi-card__icon">${i[0]}</span>
      <div>
        <strong>${i[1]}</strong>
        <p>${i[2]}</p>
        <small>${i[3]}</small>
      </div>
    </article>
  `).join("");
}

function renderRecentCases() {
  const box = $("#recentCasesList");
  const empty = $("#emptyCasesState");
  if (!box) return;

  const list = Mock.cases.slice(0, 3);
  if (!list.length) {
    box.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  box.innerHTML = list.map(caseCard).join("");
  bindCaseButtons();
}

function renderDashboardNotifications() {
  const box = $("#notificationsList");
  if (!box) return;
  box.innerHTML = Mock.notifications.slice(0, 3).map(notificationMini).join("");
}

/* =========================================================
   CASES
========================================================= */

function initCases() {
  renderCases();
  renderAi("#casesAiSummary", [
    ["Caso que requiere acción", "Hay una incidencia pendiente por cliente. Responde la solicitud para evitar retrasos."],
    ["SLA cercano", "Un caso técnico tiene plazo menor a 8 horas. Revisa el detalle."],
    ["Sugerencia", "Usa la vista tabla para ordenar por prioridad o SLA."]
  ]);

  $("#casesSearchInput")?.addEventListener("input", renderCases);
  $("#casesCardViewBtn")?.addEventListener("click", () => switchCaseView("cards"));
  $("#casesTableViewBtn")?.addEventListener("click", () => switchCaseView("table"));
  $("#refreshCasesBtn")?.addEventListener("click", () => {
    renderCases();
    toast("Casos actualizados", "La lista fue actualizada correctamente.", "success");
  });
  $("#exportCasesBtn")?.addEventListener("click", () => openModal("#casesExportModal"));

  $$("[data-case-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.filters.caseChip = btn.dataset.caseFilter || "todos";
      $$("[data-case-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderCases();
    });
  });

  $("#applyAdvancedCasesFilter")?.addEventListener("click", () => {
    State.filters.caseType = value("#casesTypeFilter") || "todos";
    State.filters.caseStatus = value("#casesStatusFilter") || "todos";
    State.filters.casePriority = value("#casesPriorityFilter") || "todos";
    State.filters.caseSort = value("#casesSortSelect") || "reciente";
    renderCases();
  });

  $("#quickCaseAskAiBtn")?.addEventListener("click", () => askBot("Analiza este caso"));
}

function filteredCases() {
  const q = value("#casesSearchInput").toLowerCase();
  let items = [...Mock.cases];

  items = items.filter(c => {
    const all = `${c.code} ${c.type} ${c.title} ${c.service} ${c.status} ${c.priority}`.toLowerCase();
    const chip = State.filters.caseChip;
    return (!q || all.includes(q)) &&
      (chip === "todos" || c.type === chip || c.status === chip || c.priority === chip || (chip === "SLA crítico" && c.slaHours <= 8)) &&
      (State.filters.caseType === "todos" || c.type === State.filters.caseType) &&
      (State.filters.caseStatus === "todos" || c.status === State.filters.caseStatus) &&
      (State.filters.casePriority === "todos" || c.priority === State.filters.casePriority);
  });

  if (State.filters.caseSort === "sla") items.sort((a,b) => a.slaHours - b.slaHours);
  if (State.filters.caseSort === "prioridad") items.sort((a,b) => b.priorityValue - a.priorityValue);
  if (State.filters.caseSort === "estado") items.sort((a,b) => a.status.localeCompare(b.status));
  if (State.filters.caseSort === "reciente") items.sort((a,b) => b.id - a.id);

  return items;
}

function renderCases() {
  const items = filteredCases();
  text("#summaryTotalCases", items.length);
  text("#summaryInProgress", items.filter(c => c.status === "En atención").length);
  text("#summaryPendingClient", items.filter(c => c.status === "Pendiente por cliente").length);
  text("#summaryResolved", items.filter(c => c.status === "Resuelto").length);
  text("#casesHeroTotal", `${items.length} casos`);
  text("#casesHeroSla", `${items.filter(c => c.slaHours <= 8).length} SLA críticos`);

  const list = $("#allCasesList");
  const table = $("#casesTableBody");
  const empty = $("#emptyAllCasesState");

  if (!items.length) {
    if (list) list.innerHTML = "";
    if (table) table.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  if (list) list.innerHTML = items.map(caseCard).join("");
  if (table) table.innerHTML = items.map(caseRow).join("");

  bindCaseButtons();
  switchCaseView(State.caseView);
}

function caseCard(c) {
  return `
    <article class="case-item">
      <span class="case-icon">${c.icon}</span>
      <div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description)}</p>
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
        <span class="status-pill ${statusClass(c.statusType)}">${esc(c.status)}</span>
        <button type="button" data-case-id="${c.id}">Ver</button>
        <a href="detalle-caso.html" class="btn btn--soft">Detalle</a>
      </div>
    </article>
  `;
}

function caseRow(c) {
  return `
    <tr>
      <td>${esc(c.code)}</td>
      <td>${esc(c.type)}</td>
      <td>${esc(c.service)}</td>
      <td><span class="status-pill ${statusClass(c.statusType)}">${esc(c.status)}</span></td>
      <td><span class="status-pill ${priorityClass(c.priority)}">${esc(c.priority)}</span></td>
      <td>${esc(c.sla)}</td>
      <td>
        <button type="button" class="panel-action" data-case-id="${c.id}">Ver</button>
        <a href="detalle-caso.html" class="panel-link">Detalle</a>
      </td>
    </tr>
  `;
}

function bindCaseButtons() {
  $$("[data-case-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const c = Mock.cases.find(x => x.id === Number(btn.dataset.caseId));
      if (!c) return;
      State.selectedCase = c;
      text("#caseQuickViewIcon", c.icon);
      text("#caseQuickViewTitle", c.code);
      text("#caseQuickViewText", c.description);
      text("#quickCaseCode", c.code);
      text("#quickCaseType", c.type);
      text("#quickCaseService", c.service);
      text("#quickCaseStatus", c.status);
      text("#quickCasePriority", c.priority);
      text("#quickCaseSla", c.sla);
      text("#quickCaseLastUpdate", c.date);
      text("#quickCasePendingAction", c.action);
      text("#quickCaseDescription", c.description);
      openModal("#caseQuickViewModal");
    });
  });
}

function switchCaseView(view) {
  State.caseView = view;
  $("#casesCardViewBtn")?.classList.toggle("active", view === "cards");
  $("#casesTableViewBtn")?.classList.toggle("active", view === "table");
  $("#allCasesList")?.classList.toggle("hidden", view !== "cards");
  $("#casesTableWrap")?.classList.toggle("hidden", view !== "table");
}

/* =========================================================
   DETAIL
========================================================= */

function initDetail() {
  const c = Mock.cases.find(x => x.id === 101) || Mock.cases[0];
  State.selectedCase = c;
  renderDetail(c);
  renderDetailProgress();
  renderActivity("#detailTimeline");
  renderEvidence();
  renderAi("#detailAiSummary", [
    ["Estado actual", "El caso se encuentra en revisión y aún está dentro del plazo estimado."],
    ["Acción sugerida", "Mantén disponible la evidencia del recibo y revisa solicitudes del asesor."],
    ["Riesgo", "No hay vencimiento crítico, pero una respuesta rápida evita retrasos."]
  ]);
  bindDetail();
}

function renderDetail(c) {
  text("#detailCaseType", c.type);
  text("#detailCaseTitle", c.title);
  text("#detailCaseDescription", c.description);
  text("#detailCaseStatusText", c.status);
  text("#detailCaseSlaText", c.sla);
  text("#detailSummaryStatus", c.status);
  text("#detailSummaryAdvisor", c.advisor);
  text("#detailInfoCode", c.code);
  text("#detailInfoService", c.service);
  text("#detailInfoPriority", c.priority);
  text("#detailInfoChannel", c.channel);
  text("#detailFullDescription", c.description);
  text("#trackingSlaRemaining", c.sla);
  text("#trackingCurrentStage", "Validación");
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
}

function renderDetailProgress() {
  const box = $("#detailProgress");
  if (!box) return;
  box.innerHTML = Mock.detailSteps.map(s => `
    <article class="progress-step progress-step--${s.state}">
      <span>${s.icon}</span>
      <div>
        <strong>${esc(s.title)}</strong>
        <p>${esc(s.text)}</p>
      </div>
    </article>
  `).join("");
}

function renderEvidence() {
  const box = $("#detailEvidenceList");
  if (!box) return;
  box.innerHTML = Mock.evidences.map(e => `
    <article class="evidence-item">
      <span>${e.icon}</span>
      <div>
        <strong>${esc(e.name)}</strong>
        <p>${esc(e.status)} · ${esc(e.date)}</p>
      </div>
      <button type="button" class="panel-action">Ver</button>
    </article>
  `).join("");
}

function bindDetail() {
  $$("[data-detail-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.detailTab;
      $$("[data-detail-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".detail-tab-panel").forEach(panel => panel.classList.remove("active"));
      const id = `#detailTab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
      $(id)?.classList.add("active");
    });
  });

  bindFileInput("#detailEvidenceInput", "#detailFileList");
  bindFileInput("#advisorRequestEvidenceInput", "#advisorRequestFileList");

  $("#detailSendEvidenceBtn")?.addEventListener("click", () => {
    text("#summaryEvidenceFiles", fileText("#detailEvidenceInput"));
    openModal("#confirmEvidenceModal");
  });

  $("#acceptEvidenceConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    successModal("Evidencia enviada", "La evidencia fue registrada en el seguimiento del caso.");
  });

  $("#advisorRequestDraftBtn")?.addEventListener("click", () => toast("Respuesta guardada", "Tu respuesta quedó como borrador.", "success"));

  $("#advisorRequestSubmitBtn")?.addEventListener("click", () => {
    const response = value("#advisorRequestResponse");
    if (!response) {
      text("#advisorRequestResponseError", "Ingresa una respuesta para el asesor.");
      return;
    }
    text("#summaryAdvisorResponseText", response);
    text("#summaryAdvisorResponseFiles", fileText("#advisorRequestEvidenceInput"));
    openModal("#confirmAdvisorResponseModal");
  });

  $("#acceptAdvisorResponseConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    successModal("Respuesta enviada", "La respuesta fue enviada al asesor responsable.");
  });

  $$("[data-rating]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.selectedRating = Number(btn.dataset.rating);
      $$("[data-rating]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  $("#caseSurveySubmitBtn")?.addEventListener("click", () => {
    text("#summarySurveyRating", State.selectedRating ? `${State.selectedRating} estrella(s)` : "Sin calificación");
    text("#summarySurveyComment", value("#caseSurveyComment") || "Sin comentario");
    openModal("#confirmSurveyModal");
  });

  $("#acceptSurveyConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    successModal("Encuesta enviada", "Gracias por ayudarnos a mejorar la atención.");
  });

  $("#detailDownloadBtn")?.addEventListener("click", () => genericModal("📄", "Constancia preparada", "Cuando se conecte el backend, se generará una constancia PDF."));
  $("#detailShareBtn")?.addEventListener("click", () => genericModal("🔗", "Enlace preparado", "El enlace seguro estará disponible al conectar la autenticación real."));
  $("#detailRefreshBtn")?.addEventListener("click", () => toast("Caso actualizado", "Se actualizó la información del seguimiento.", "success"));
  $("#detailTimelineRefreshBtn")?.addEventListener("click", () => renderActivity("#detailTimeline"));
  $("#detailEvidenceHelpBtn")?.addEventListener("click", () => genericModal("📎", "Evidencia recomendada", "Adjunta recibos, capturas, pruebas o documentos que permitan validar el caso."));
}

/* =========================================================
   SERVICES
========================================================= */

function initServices() {
  renderServicesPage();
  setupServiceFilters();
  renderAi("#servicesAiSummary", [
    ["Servicio observado", "Internet hogar tiene casos asociados. Revisa si ya existe un caso abierto antes de registrar otro."],
    ["Acción sugerida", "Para fallas técnicas usa incidencia; para cobros o atención usa reclamo."],
    ["Estado general", "La mayoría de servicios se encuentra activa y sin alertas críticas."]
  ]);
}

function setupServiceFilters() {
  $("#servicesSearchInput")?.addEventListener("input", renderServicesPage);
  $("#servicesCardViewBtn")?.addEventListener("click", () => switchServiceView("cards"));
  $("#servicesTableViewBtn")?.addEventListener("click", () => switchServiceView("table"));

  $$("[data-service-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.filters.serviceChip = btn.dataset.serviceFilter || "todos";
      $$("[data-service-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderServicesPage();
    });
  });

  $("#applyServicesFilterBtn")?.addEventListener("click", () => {
    State.filters.serviceType = value("#serviceTypeFilter") || "todos";
    State.filters.serviceStatus = value("#serviceStatusFilter") || "todos";
    State.filters.serviceSort = value("#serviceSortSelect") || "reciente";
    renderServicesPage();
  });

  $("#refreshServicesBtn")?.addEventListener("click", () => {
    renderServicesPage();
    toast("Servicios actualizados", "La información fue actualizada.", "success");
  });

  $("#servicesHealthCheckBtn")?.addEventListener("click", openHealth);
}

function filteredServices() {
  const q = value("#servicesSearchInput").toLowerCase();
  let items = [...Mock.services];

  items = items.filter(s => {
    const all = `${s.code} ${s.name} ${s.type} ${s.plan} ${s.status} ${s.location}`.toLowerCase();
    const chip = State.filters.serviceChip;
    return (!q || all.includes(q)) &&
      (chip === "todos" || s.type === chip || (chip === "Con alertas" && s.status === "En observación")) &&
      (State.filters.serviceType === "todos" || s.type === State.filters.serviceType) &&
      (State.filters.serviceStatus === "todos" || s.status === State.filters.serviceStatus);
  });

  if (State.filters.serviceSort === "tipo") items.sort((a,b) => a.type.localeCompare(b.type));
  if (State.filters.serviceSort === "estado") items.sort((a,b) => a.status.localeCompare(b.status));
  if (State.filters.serviceSort === "casos") items.sort((a,b) => b.cases - a.cases);
  if (State.filters.serviceSort === "reciente") items.sort((a,b) => b.id - a.id);

  return items;
}

function renderServicesPage() {
  const items = filteredServices();
  text("#summaryActiveServices", items.filter(s => s.status === "Activo").length);
  text("#summaryServicesCases", items.reduce((a,s) => a + s.cases, 0));
  text("#summaryStableServices", items.filter(s => s.status === "Activo").length);
  text("#summaryObservedServices", items.filter(s => s.status === "En observación").length);
  text("#servicesHeroTotal", `${items.length} servicios`);

  const grid = $("#servicesFullGrid");
  const table = $("#servicesTableBody");
  const empty = $("#emptyServicesState");

  if (!items.length) {
    if (grid) grid.innerHTML = "";
    if (table) table.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  if (grid) grid.innerHTML = items.map(serviceCard).join("");
  if (table) table.innerHTML = items.map(serviceRow).join("");
  bindServiceButtons();
  switchServiceView(State.serviceView);
}

function renderServices(selector, items) {
  const grid = $(selector);
  if (!grid) return;
  grid.innerHTML = items.map(serviceSmallCard).join("");
  bindServiceButtons();
}

function serviceSmallCard(s) {
  return `
    <article class="service-card">
      <div class="service-card__top">
        <span class="service-icon">${s.icon}</span>
        <span class="status-pill ${statusClass(s.statusType)}">${esc(s.status)}</span>
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <small>${esc(s.code)}</small>
      <div class="service-actions">
        <button type="button" data-service-id="${s.id}">Ver</button>
      </div>
    </article>
  `;
}

function serviceCard(s) {
  return `
    <article class="service-card service-card--detailed">
      <div class="service-card__top">
        <span class="service-icon">${s.icon}</span>
        <span class="status-pill ${statusClass(s.statusType)}">${esc(s.status)}</span>
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.plan)} · ${esc(s.location)}</p>
      <div class="case-meta">
        <span>${esc(s.code)}</span>
        <span>${esc(s.type)}</span>
        <span>${s.cases} caso(s)</span>
      </div>
      <div class="service-actions">
        <button type="button" data-service-id="${s.id}">Ver detalle</button>
        <button type="button" data-service-cases-id="${s.id}">Casos</button>
      </div>
    </article>
  `;
}

function serviceRow(s) {
  return `
    <tr>
      <td>${esc(s.code)}</td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.plan)}</td>
      <td><span class="status-pill ${statusClass(s.statusType)}">${esc(s.status)}</span></td>
      <td>${esc(s.location)}</td>
      <td>${s.cases}</td>
      <td>
        <button type="button" class="panel-action" data-service-id="${s.id}">Ver</button>
        <button type="button" class="panel-action" data-service-cases-id="${s.id}">Casos</button>
      </td>
    </tr>
  `;
}

function bindServiceButtons() {
  $$("[data-service-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = Mock.services.find(x => x.id === Number(btn.dataset.serviceId));
      if (s) openService(s);
    });
  });

  $$("[data-service-cases-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = Mock.services.find(x => x.id === Number(btn.dataset.serviceCasesId));
      if (s) openServiceCases(s);
    });
  });
}

function openService(s) {
  State.selectedService = s;
  text("#serviceModalIcon", s.icon);
  text("#serviceModalType", s.type);
  text("#serviceModalTitle", s.name);
  text("#serviceModalText", s.description);
  text("#serviceModalCode", s.code);
  text("#serviceModalCategory", s.type);
  text("#serviceModalPlan", s.plan);
  text("#serviceModalStatus", s.status);
  text("#serviceModalLocation", s.location);
  text("#serviceModalCases", `${s.cases} caso(s)`);
  text("#serviceModalLastUpdate", s.last);
  text("#serviceModalRecommendation", s.recommendation);
  openModal("#serviceDetailModal");
}

function openServiceCases(s) {
  text("#serviceCasesTitle", `Casos vinculados a ${s.name}`);
  const linked = Mock.cases.filter(c => c.service === s.name || c.service === s.type);
  const box = $("#serviceLinkedCasesList");
  if (box) {
    box.innerHTML = linked.length ? linked.map(c => `
      <article class="linked-case-item">
        <span>${c.icon}</span>
        <div>
          <strong>${esc(c.code)}</strong>
          <p>${esc(c.title)}</p>
        </div>
        <a href="detalle-caso.html" class="panel-link">Ver</a>
      </article>
    `).join("") : `<div class="empty-state"><span>🎫</span><h3>Sin casos asociados</h3><p>Este servicio no tiene casos recientes.</p></div>`;
  }
  openModal("#serviceCasesModal");
}

function switchServiceView(view) {
  State.serviceView = view;
  $("#servicesCardViewBtn")?.classList.toggle("active", view === "cards");
  $("#servicesTableViewBtn")?.classList.toggle("active", view === "table");
  $("#servicesFullGrid")?.classList.toggle("hidden", view !== "cards");
  $("#servicesTableWrap")?.classList.toggle("hidden", view !== "table");
}

function openHealth() {
  text("#healthActiveServices", Mock.services.filter(s => s.status === "Activo").length);
  text("#healthObservedServices", Mock.services.filter(s => s.status === "En observación").length);
  text("#healthOpenCases", Mock.cases.filter(c => c.status !== "Resuelto").length);
  text("#healthSuggestedAction", "Revisar servicio observado");
  openModal("#servicesHealthModal");
}

/* =========================================================
   NOTIFICATIONS
========================================================= */

function initNotifications() {
  renderNotifications();
  renderAi("#notificationsAiSummary", [
    ["Prioridad alta", "Atiende solicitudes y alertas SLA antes que mensajes informativos."],
    ["Pendiente por cliente", "Una notificación requiere respuesta para continuar el caso."],
    ["Sugerencia", "Marca como leídas las alertas ya revisadas para mantener la bandeja limpia."]
  ]);

  $("#notificationsSearchInput")?.addEventListener("input", renderNotifications);
  $("#notificationsListViewBtn")?.addEventListener("click", () => switchNotificationView("list"));
  $("#notificationsCompactViewBtn")?.addEventListener("click", () => switchNotificationView("compact"));

  $$("[data-notification-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      State.filters.notificationChip = btn.dataset.notificationFilter || "todas";
      $$("[data-notification-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderNotifications();
    });
  });

  $("#applyNotificationFiltersBtn")?.addEventListener("click", () => {
    State.filters.notificationType = value("#notificationTypeFilter") || "todas";
    State.filters.notificationStatus = value("#notificationStatusFilter") || "todas";
    State.filters.notificationPriority = value("#notificationPriorityFilter") || "todas";
    State.filters.notificationSort = value("#notificationSortSelect") || "reciente";
    renderNotifications();
  });

  $("#refreshNotificationsBtn")?.addEventListener("click", () => {
    renderNotifications();
    toast("Notificaciones actualizadas", "La bandeja fue actualizada correctamente.", "success");
  });

  $("#markAllReadBtn")?.addEventListener("click", () => {
    Mock.notifications.forEach(n => n.read = true);
    renderNotifications();
    renderNotificationBadges();
    text("#notificationSuccessTitle", "Todo marcado como leído");
    text("#notificationSuccessText", "Las notificaciones fueron marcadas como leídas.");
    openModal("#notificationSuccessModal");
  });

  $("#deleteReadNotificationsBtn")?.addEventListener("click", () => openModal("#clearNotificationsModal"));
  $("#acceptClearNotificationsBtn")?.addEventListener("click", () => {
    Mock.notifications = Mock.notifications.filter(n => !n.read);
    closeModals();
    renderNotifications();
    renderNotificationBadges();
    text("#notificationSuccessTitle", "Notificaciones limpiadas");
    text("#notificationSuccessText", "Se ocultaron las notificaciones leídas.");
    openModal("#notificationSuccessModal");
  });

  $("#notificationMarkReadBtn")?.addEventListener("click", () => {
    if (!State.selectedNotification) return;
    State.selectedNotification.read = true;
    closeModals();
    renderNotifications();
    renderNotificationBadges();
    successModal("Notificación actualizada", "La notificación fue marcada como leída.");
  });
}

function filteredNotifications() {
  const q = value("#notificationsSearchInput").toLowerCase();
  let items = [...Mock.notifications];

  items = items.filter(n => {
    const all = `${n.title} ${n.message} ${n.type} ${n.case}`.toLowerCase();
    const chip = State.filters.notificationChip;
    return (!q || all.includes(q)) &&
      (chip === "todas" || n.type === chip || (chip === "no-leidas" && !n.read)) &&
      (State.filters.notificationType === "todas" || n.type === State.filters.notificationType) &&
      (State.filters.notificationStatus === "todas" || (State.filters.notificationStatus === "no-leidas" && !n.read) || (State.filters.notificationStatus === "leidas" && n.read)) &&
      (State.filters.notificationPriority === "todas" || n.priority === State.filters.notificationPriority);
  });

  if (State.filters.notificationSort === "prioridad") {
    const order = { alta: 3, media: 2, baja: 1 };
    items.sort((a,b) => order[b.priority] - order[a.priority]);
  }
  if (State.filters.notificationSort === "no-leidas") items.sort((a,b) => Number(a.read) - Number(b.read));
  if (State.filters.notificationSort === "tipo") items.sort((a,b) => a.type.localeCompare(b.type));

  return items;
}

function renderNotifications() {
  const items = filteredNotifications();
  text("#summaryTotalNotifications", items.length);
  text("#summaryUnreadNotifications", items.filter(n => !n.read).length);
  text("#summaryCaseNotifications", items.filter(n => n.type === "caso").length);
  text("#summarySlaNotifications", items.filter(n => n.type === "sla").length);
  text("#notificationHeroUnread", `${Mock.notifications.filter(n => !n.read).length} no leídas`);

  const box = $("#notificationsFullList");
  const empty = $("#emptyNotificationsState");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }

  empty?.classList.add("hidden");
  box.innerHTML = items.map(notificationFull).join("");
  $$("[data-notification-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const n = Mock.notifications.find(x => x.id === Number(btn.dataset.notificationId));
      if (n) openNotification(n);
    });
  });
  switchNotificationView(State.notificationView);
}

function notificationFull(n) {
  return `
    <article class="notification-full-item ${n.read ? "" : "is-unread"}">
      <span class="notification-item__icon">${n.icon}</span>
      <div>
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.message)}</p>
        <div class="case-meta">
          <span>${esc(n.type)}</span>
          <span>${esc(n.priority)}</span>
          <span>${esc(n.case)}</span>
          <span>${esc(n.date)}</span>
          <span>${n.read ? "Leída" : "No leída"}</span>
        </div>
      </div>
      <button type="button" data-notification-id="${n.id}">Ver</button>
    </article>
  `;
}

function notificationMini(n) {
  return `
    <article class="notification-item">
      <span class="notification-item__icon">${n.icon}</span>
      <div>
        <strong>${esc(n.title)}</strong>
        <p>${esc(n.message)}</p>
        <small>${esc(n.date)}</small>
      </div>
    </article>
  `;
}

function openNotification(n) {
  State.selectedNotification = n;
  text("#notificationModalIcon", n.icon);
  text("#notificationModalType", n.type);
  text("#notificationModalTitle", n.title);
  text("#notificationModalText", n.message);
  text("#notificationModalCase", n.case);
  text("#notificationModalCategory", n.type);
  text("#notificationModalPriority", n.priority);
  text("#notificationModalDate", n.date);
  text("#notificationModalStatus", n.read ? "Leída" : "No leída");
  text("#notificationModalAction", n.action);
  openModal("#notificationDetailModal");
}

function switchNotificationView(view) {
  State.notificationView = view;
  $("#notificationsListViewBtn")?.classList.toggle("active", view === "list");
  $("#notificationsCompactViewBtn")?.classList.toggle("active", view === "compact");
  $("#notificationsFullList")?.classList.toggle("notifications-full-list--compact", view === "compact");
}

function renderNotificationBadges() {
  const unread = Mock.notifications.filter(n => !n.read).length;
  text("#notificationBadge", unread ? unread : "");
  text("#sidebarNotificationCount", unread ? unread : "");
}

/* =========================================================
   FORMS: CLAIM / INCIDENT / PROFILE
========================================================= */

function initClaim() {
  bindFileInput("#claimEvidence", "#claimFileList");
  $("#claimAnalyzeSideBtn")?.addEventListener("click", () => askBot("Analiza mi reclamo"));
  $("#claimSaveDraft")?.addEventListener("click", () => openModal("#claimDraftModal"));
  $("#claimPreviewBtn")?.addEventListener("click", () => prepareClaim(false));
  $("#claimForm")?.addEventListener("submit", e => {
    e.preventDefault();
    prepareClaim(true);
  });
  $("#acceptClaimConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    text("#successClaimCode", `REC-2026-${Math.floor(100000 + Math.random() * 899999)}`);
    openModal("#successClaimModal");
  });
}

function claimPayload() {
  return {
    service: value("#claimService"),
    category: value("#claimCategory"),
    priority: value("#claimPriority"),
    contact: value("#claimContact"),
    title: value("#claimTitle"),
    amount: value("#claimAmount") || "No aplica",
    date: value("#claimDate") || "No registrada",
    description: value("#claimDescription"),
    evidence: fileText("#claimEvidence"),
    declaration: checked("#claimDeclaration")
  };
}

function prepareClaim(validate) {
  clearErrors();
  const p = claimPayload();
  if (validate) {
    const errors = {};
    if (!p.service) errors.claimService = "Selecciona el servicio asociado.";
    if (!p.category) errors.claimCategory = "Selecciona la categoría del reclamo.";
    if (!p.priority) errors.claimPriority = "Selecciona la prioridad.";
    if (!p.contact) errors.claimContact = "Selecciona el medio de contacto.";
    if (!p.title) errors.claimTitle = "Ingresa un título para el reclamo.";
    if (!p.description) errors.claimDescription = "Describe el reclamo.";
    if (!p.declaration) errors.claimDeclaration = "Debes aceptar la declaración.";
    if (Object.keys(errors).length) {
      showErrors(errors);
      toast("Formulario incompleto", Object.values(errors)[0], "warning");
      return;
    }
  }
  text("#summaryClaimService", p.service || "-");
  text("#summaryClaimCategory", p.category || "-");
  text("#summaryClaimPriority", p.priority || "-");
  text("#summaryClaimContact", p.contact || "-");
  text("#summaryClaimTitle", p.title || "-");
  text("#summaryClaimAmount", p.amount);
  text("#summaryClaimDate", p.date);
  text("#summaryClaimEvidence", p.evidence);
  text("#summaryClaimDescription", p.description || "-");
  openModal("#confirmClaimModal");
}

function initIncident() {
  bindFileInput("#incidentEvidence", "#incidentFileList");
  $("#incidentAnalyzeSideBtn")?.addEventListener("click", () => askBot("Diagnóstico de incidencia"));
  $("#incidentSaveDraft")?.addEventListener("click", () => openModal("#incidentDraftModal"));
  $("#incidentPreviewBtn")?.addEventListener("click", () => prepareIncident(false));
  $("#incidentForm")?.addEventListener("submit", e => {
    e.preventDefault();
    prepareIncident(true);
  });
  $("#acceptIncidentConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    text("#successIncidentCode", `INC-2026-${Math.floor(100000 + Math.random() * 899999)}`);
    openModal("#successIncidentModal");
  });
}

function incidentPayload() {
  return {
    service: value("#incidentService"),
    symptom: value("#incidentSymptom"),
    impact: value("#incidentImpact"),
    urgency: value("#incidentUrgency"),
    address: value("#incidentAddress"),
    startDate: value("#incidentStartDate") || "No registrado",
    description: value("#incidentDescription"),
    evidence: fileText("#incidentEvidence"),
    declaration: checked("#incidentDeclaration")
  };
}

function prepareIncident(validate) {
  clearErrors();
  const p = incidentPayload();
  if (validate) {
    const errors = {};
    if (!p.service) errors.incidentService = "Selecciona el servicio afectado.";
    if (!p.symptom) errors.incidentSymptom = "Selecciona el síntoma principal.";
    if (!p.impact) errors.incidentImpact = "Selecciona el impacto.";
    if (!p.urgency) errors.incidentUrgency = "Selecciona la urgencia.";
    if (!p.address) errors.incidentAddress = "Ingresa la ubicación afectada.";
    if (!p.description) errors.incidentDescription = "Describe la incidencia.";
    if (!p.declaration) errors.incidentDeclaration = "Debes aceptar la declaración.";
    if (Object.keys(errors).length) {
      showErrors(errors);
      toast("Formulario incompleto", Object.values(errors)[0], "warning");
      return;
    }
  }
  text("#summaryIncidentService", p.service || "-");
  text("#summaryIncidentSymptom", p.symptom || "-");
  text("#summaryIncidentImpact", p.impact || "-");
  text("#summaryIncidentUrgency", p.urgency || "-");
  text("#summaryIncidentAddress", p.address || "-");
  text("#summaryIncidentStartDate", p.startDate);
  text("#summaryIncidentEvidence", p.evidence);
  text("#summaryIncidentDiagnosis", incidentPriority(p));
  text("#summaryIncidentDescription", p.description || "-");
  openModal("#confirmIncidentModal");
}

function incidentPriority(p) {
  if (p.urgency === "Crítica" || p.impact === "Aparentemente masivo") return "Crítica";
  if (p.urgency === "Alta" || p.impact === "Varios usuarios de la empresa") return "Alta";
  if (p.urgency === "Media") return "Media";
  return "Baja";
}

function initProfile() {
  text("#profileHeroName", Mock.user.name);
  text("#profileHeroSecurity", `Seguridad ${Mock.user.security}`);
  text("#summaryProfileStatus", "Verificado");
  text("#summaryPreferredChannel", Mock.user.channel);
  text("#summaryNotificationStatus", "Activas");
  text("#summarySecurityStatus", Mock.user.security);

  $("#profileForm")?.addEventListener("submit", e => {
    e.preventDefault();
    prepareProfile();
  });
  $("#profileSaveTopBtn")?.addEventListener("click", prepareProfile);
  $("#profilePreviewBtn")?.addEventListener("click", prepareProfile);
  $("#profileSecurityReviewBtn")?.addEventListener("click", () => openModal("#profileSecurityModal"));
  $("#changePasswordBtn")?.addEventListener("click", () => openModal("#profileSecurityModal"));
  $("#verifyChannelBtn")?.addEventListener("click", () => openModal("#profileSecurityModal"));
  $("#enableMfaBtn")?.addEventListener("click", () => openModal("#profileSecurityModal"));
  $("#acceptProfileConfirmBtn")?.addEventListener("click", () => {
    closeModals();
    openModal("#profileSuccessModal");
  });
  $("#profileResetBtn")?.addEventListener("click", () => {
    $("#profileName").value = Mock.user.name;
    $("#profileDocument").value = Mock.user.document;
    $("#profileEmail").value = Mock.user.email;
    $("#profilePhone").value = Mock.user.phone;
    $("#profileAddress").value = Mock.user.address;
    toast("Datos restaurados", "Se restauró la información inicial del perfil.", "success");
  });
}

function prepareProfile() {
  clearErrors();
  const p = {
    name: value("#profileName"),
    document: value("#profileDocument"),
    clientType: value("#profileClientType"),
    segment: value("#profileSegment"),
    email: value("#profileEmail"),
    phone: value("#profilePhone"),
    address: value("#profileAddress"),
    preferences: [
      checked("#prefEmail") ? "Correo" : "",
      checked("#prefSms") ? "SMS" : "",
      checked("#prefWhatsapp") ? "WhatsApp" : "",
      checked("#prefCall") ? "Llamada" : ""
    ].filter(Boolean)
  };
  const errors = {};
  if (!p.name) errors.profileName = "Ingresa el nombre completo.";
  if (!p.document) errors.profileDocument = "Ingresa el documento.";
  if (!p.email) errors.profileEmail = "Ingresa el correo electrónico.";
  if (!p.phone) errors.profilePhone = "Ingresa el celular.";
  if (!p.address) errors.profileAddress = "Ingresa la dirección.";
  if (Object.keys(errors).length) {
    showErrors(errors);
    toast("Perfil incompleto", Object.values(errors)[0], "warning");
    return;
  }

  text("#summaryProfileName", p.name);
  text("#summaryProfileDocument", p.document);
  text("#summaryProfileClientType", p.clientType);
  text("#summaryProfileSegment", p.segment);
  text("#summaryProfileEmail", p.email);
  text("#summaryProfilePhone", p.phone);
  text("#summaryProfileAddress", p.address);
  text("#summaryProfilePreferences", p.preferences.join(", ") || "Sin preferencias");
  openModal("#confirmProfileModal");
}

/* =========================================================
   SHARED RENDERERS
========================================================= */

function renderAi(selector, items) {
  const box = $(selector);
  if (!box) return;
  box.innerHTML = items.map(([title, body]) => `
    <div class="ai-summary-item">
      <strong>${esc(title)}</strong>
      <p>${esc(body)}</p>
    </div>
  `).join("");
}

function renderActivity(selector = "#activityTimeline") {
  const box = $(selector);
  if (!box) return;
  box.innerHTML = Mock.activity.map(a => `
    <div class="activity-item">
      <span class="activity-icon">${a.icon}</span>
      <div class="activity-content">
        <strong>${esc(a.title)}</strong>
        <p>${esc(a.text)}</p>
        <small>${esc(a.date)}</small>
      </div>
    </div>
  `).join("");
}

function bindFileInput(inputSelector, listSelector) {
  const input = $(inputSelector);
  const list = $(listSelector);
  if (!input || !list) return;

  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    list.innerHTML = files.map((file, index) => `
      <article class="file-item">
        <span>📎</span>
        <div>
          <strong>${esc(file.name)}</strong>
          <small>${formatBytes(file.size)}</small>
        </div>
        <button type="button" data-file-index="${index}">Quitar</button>
      </article>
    `).join("");

    $$("[data-file-index]", list).forEach(btn => {
      btn.addEventListener("click", () => {
        toast("Archivo seleccionado", "En el backend real se permitirá quitar archivos individualmente.", "info");
      });
    });
  });
}

function clearErrors() {
  $$(".form-error").forEach(e => e.textContent = "");
}

function showErrors(errors) {
  Object.entries(errors).forEach(([key, val]) => text(`#${key}Error`, val));
}
