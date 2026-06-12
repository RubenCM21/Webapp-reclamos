"use strict";

const RoleState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  selectedRole: "cliente-persona"
};

const RoleData = {
  "cliente-persona": {
    icon: "👤",
    title: "Cliente Persona",
    label: "Personas",
    description:
      "Acceso para clientes individuales que desean gestionar reclamos, incidencias y seguimiento de servicios personales.",
    permissions: [
      "Registrar reclamos",
      "Consultar casos",
      "Adjuntar evidencias",
      "Recibir notificaciones"
    ],
    redirect: "login.html?role=cliente-persona",
    demoUser: "cliente.persona@demo.com"
  },

  "cliente-empresa": {
    icon: "🏢",
    title: "Cliente Empresa",
    label: "Empresas",
    description:
      "Acceso para representantes de empresas que gestionan tickets, incidencias, servicios cloud, correo, conectividad y SLA.",
    permissions: [
      "Reportar tickets",
      "Consultar SLA",
      "Gestionar servicios empresariales",
      "Ver historial corporativo"
    ],
    redirect: "login.html?role=cliente-empresa",
    demoUser: "cliente.empresa@demo.com"
  },

  asesor: {
    icon: "🎧",
    title: "Asesor de Atención",
    label: "Operativo",
    description:
      "Acceso para trabajadores responsables de atender casos asignados, registrar avances y responder solicitudes.",
    permissions: [
      "Ver bandeja asignada",
      "Actualizar atención",
      "Solicitar información",
      "Registrar avances"
    ],
    redirect: "login.html?role=asesor",
    demoUser: "asesor@demo.com"
  },

  supervisor: {
    icon: "📊",
    title: "Supervisor",
    label: "Gestión",
    description:
      "Acceso para supervisores que clasifican casos, asignan responsables, controlan SLA y revisan indicadores.",
    permissions: [
      "Clasificar casos",
      "Asignar asesores",
      "Monitorear SLA",
      "Supervisar reportes"
    ],
    redirect: "login.html?role=supervisor",
    demoUser: "supervisor@demo.com"
  },

  admin: {
    icon: "⚙️",
    title: "Administrador",
    label: "Sistema",
    description:
      "Acceso para usuarios autorizados que administran la configuración general de la plataforma.",
    permissions: [
      "Gestionar usuarios",
      "Configurar catálogos",
      "Administrar SLA",
      "Revisar auditoría"
    ],
    redirect: "login.html?role=admin",
    demoUser: "admin@demo.com"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(RoleState.theme);
  bindTheme();
  bindRoleCards();
  bindRecommendation();
  bindActions();
  bindBot();
  bindModals();
  readInitialRole();
  renderSelectedRole();
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
  RoleState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = RoleState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function readInitialRole() {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role");

  if (role && RoleData[role]) {
    selectRole(role, false);
  }
}

function bindRoleCards() {
  $all(".role-card").forEach((card) => {
    card.addEventListener("click", () => {
      const role = card.dataset.role;
      if (!role) return;

      selectRole(role, true);
    });

    const button = card.querySelector(".role-select-btn");

    button?.addEventListener("click", (event) => {
      event.stopPropagation();

      const role = card.dataset.role;
      if (!role) return;

      selectRole(role, true);
      openRoleModal(role);
    });
  });
}

function selectRole(role, notify = true) {
  RoleState.selectedRole = role;

  $all(".role-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.role === role);
  });

  renderSelectedRole();

  localStorage.setItem("claro360-selected-role", role);

  if (notify) {
    const data = RoleData[role];

    showToast({
      title: data.title,
      message: "Perfil seleccionado correctamente.",
      type: "success"
    });
  }
}

function renderSelectedRole() {
  const data = RoleData[RoleState.selectedRole];
  if (!data) return;

  setText("#selectedRoleTitle", data.title);
  setText("#selectedRoleDescription", data.description);

  const permissions = $("#selectedPermissions");

  if (permissions) {
    permissions.innerHTML = data.permissions
      .map((permission) => `<span>${permission}</span>`)
      .join("");
  }
}

function bindRecommendation() {
  $("#recommendRoleBtn")?.addEventListener("click", () => {
    const value = $("#roleQuestion")?.value;

    if (!value) {
      showToast({
        title: "Selecciona una opción",
        message: "Indica qué necesitas hacer para recomendarte un perfil.",
        type: "warning"
      });
      return;
    }

    const recommended = getRecommendedRole(value);
    const data = RoleData[recommended];

    setText("#recommendedRoleText", data.title);
    setText("#recommendedRoleDescription", data.description);

    $("#recommendationBox")?.classList.remove("hidden");

    selectRole(recommended, false);

    showToast({
      title: "Perfil recomendado",
      message: `ClaroBot recomienda: ${data.title}.`,
      type: "success"
    });
  });
}

function getRecommendedRole(value) {
  const rules = {
    "registrar-reclamo": "cliente-persona",
    empresa: "cliente-empresa",
    "atender-casos": "asesor",
    supervisar: "supervisor",
    administrar: "admin"
  };

  return rules[value] || "cliente-persona";
}

function bindActions() {
  $("#continueLoginBtn")?.addEventListener("click", () => {
    goToLogin();
  });

  $("#modalContinueLogin")?.addEventListener("click", () => {
    goToLogin();
  });

  $("#loadDemoBtn")?.addEventListener("click", () => {
    const role = RoleState.selectedRole;
    const data = RoleData[role];

    localStorage.setItem("claro360-demo-role", role);
    localStorage.setItem("claro360-demo-user", data.demoUser);

    showToast({
      title: "Demo preparada",
      message: `Se cargará el demo para ${data.title}.`,
      type: "success"
    });

    setTimeout(() => {
      goToLogin();
    }, 650);
  });

  $("#openBotFromPanel")?.addEventListener("click", openBot);
}

function goToLogin() {
  const data = RoleData[RoleState.selectedRole];

  localStorage.setItem("claro360-selected-role", RoleState.selectedRole);
  window.location.href = data.redirect;
}

function openRoleModal(role) {
  const data = RoleData[role];

  setText("#roleModalIcon", data.icon);
  setText("#roleModalTitle", data.title);
  setText("#roleModalText", data.description);

  const summary = $("#roleSummary");

  if (summary) {
    summary.innerHTML = `
      <div>
        <span>Perfil</span>
        <strong>${data.title}</strong>
      </div>
      <div>
        <span>Tipo</span>
        <strong>${data.label}</strong>
      </div>
      <div>
        <span>Acceso</span>
        <strong>${data.permissions.length} permisos principales</strong>
      </div>
    `;
  }

  openModal("#roleModal");
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
  message.textContent = "ClaroBot está evaluando el perfil recomendado...";

  container?.appendChild(message);

  if (container) container.scrollTop = container.scrollHeight;

  return message;
}

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("reclamo") || text.includes("cliente")) {
    selectRole("cliente-persona", false);
    return "Para registrar o consultar reclamos personales, el perfil recomendado es Cliente Persona.";
  }

  if (text.includes("empresa") || text.includes("corporativo") || text.includes("ticket")) {
    selectRole("cliente-empresa", false);
    return "Para gestionar tickets o servicios corporativos, el perfil recomendado es Cliente Empresa.";
  }

  if (text.includes("atiendo") || text.includes("atender") || text.includes("casos asignados")) {
    selectRole("asesor", false);
    return "Si atiendes casos asignados y registras avances, debes ingresar como Asesor de Atención.";
  }

  if (text.includes("sla") || text.includes("supervisar") || text.includes("asignar")) {
    selectRole("supervisor", false);
    return "Si necesitas clasificar, asignar o controlar SLA, el perfil recomendado es Supervisor.";
  }

  if (text.includes("admin") || text.includes("usuarios") || text.includes("roles") || text.includes("catálogos")) {
    selectRole("admin", false);
    return "Para configurar usuarios, roles, catálogos o auditoría, corresponde el perfil Administrador.";
  }

  return "Puedo ayudarte a elegir el perfil correcto. Dime si eres cliente, empresa, asesor, supervisor o administrador.";
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