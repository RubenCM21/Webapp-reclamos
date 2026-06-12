"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - LOGIN JS
   Preparado para integración backend
========================================================= */

const LoginState = {
  role: "cliente-persona",
  theme: localStorage.getItem("claro360-theme") || "light",
  isLoading: false
};

const RoleConfig = {
  "cliente-persona": {
    title: "Acceso Cliente Persona",
    description: "Consulta tus reclamos, incidencias, servicios y notificaciones.",
    badge: "Personas",
    usernameLabel: "Correo, DNI o número de servicio",
    placeholder: "Ejemplo: usuario@correo.com",
    redirect: "cliente/dashboard.html",
    demoUser: "cliente.persona@demo.com"
  },

  "cliente-empresa": {
    title: "Acceso Cliente Empresa",
    description: "Gestiona tickets, incidencias empresariales, SLA y soporte especializado.",
    badge: "Empresas",
    usernameLabel: "Correo corporativo, RUC o código de cliente",
    placeholder: "Ejemplo: empresa@correo.com",
    redirect: "cliente/dashboard.html",
    demoUser: "cliente.empresa@demo.com"
  },

  asesor: {
    title: "Acceso Asesor de Atención",
    description: "Consulta tu bandeja, atiende casos, registra avances y solicita información.",
    badge: "Asesor",
    usernameLabel: "Usuario interno o correo corporativo",
    placeholder: "Ejemplo: asesor@claro.com.pe",
    redirect: "asesor/dashboard.html",
    demoUser: "asesor@demo.com"
  },

  supervisor: {
    title: "Acceso Supervisor",
    description: "Clasifica casos, asigna responsables, controla SLA y supervisa indicadores.",
    badge: "Supervisor",
    usernameLabel: "Usuario interno o correo corporativo",
    placeholder: "Ejemplo: supervisor@claro.com.pe",
    redirect: "supervisor/dashboard.html",
    demoUser: "supervisor@demo.com"
  },

  admin: {
    title: "Acceso Administrador",
    description: "Administra usuarios, roles, catálogos, SLA, auditoría e integraciones.",
    badge: "Admin",
    usernameLabel: "Usuario administrador",
    placeholder: "Ejemplo: admin@claro.com.pe",
    redirect: "admin/dashboard.html",
    demoUser: "admin@demo.com"
  }
};

const AuthApi = {
  async login(payload) {
    const endpoint = "/api/auth/login";

    if (!payload.username || !payload.password || !payload.role) {
      return { ok: false, message: "Completa todos los campos obligatorios." };
    }

    try {
      const body = new URLSearchParams();
      body.append("username", payload.username);
      body.append("password", payload.password);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, message: data.detail || data.message || "Credenciales inválidas" };
      }

      const token = data.access_token || data.token || null;

      return {
        ok: true,
        token,
        user: { id: data.user_id || null, name: payload.username, role: payload.role, username: payload.username },
        redirect: RoleConfig[payload.role].redirect
      };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(LoginState.theme);
  bindRoleTabs();
  loadSelectedRoleFromStorage();
  bindPasswordToggle();
  bindLoginForm();
  bindDemoAccess();
  bindThemeToggle();
  bindAssistant();
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
    setTimeout(() => toast.remove(), 260);
  }, 4200);
}

function bindThemeToggle() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = LoginState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function applyTheme(theme) {
  LoginState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindRoleTabs() {
  $all(".role-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const role = tab.dataset.role;
      if (!role) return;

      setRole(role);
    });
  });
}

function setRole(role) {
  LoginState.role = role;

  $all(".role-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.role === role);
  });

  const config = RoleConfig[role];

  $("#selectedRole").value = role;
  setText("#usernameLabel", config.usernameLabel);

  const username = $("#username");
  if (username) {
    username.placeholder = config.placeholder;
  }

  const context = $("#roleContext");
  if (context) {
    context.innerHTML = `
      <div>
        <strong>${config.title}</strong>
        <span>${config.description}</span>
      </div>
      <span class="context-badge">${config.badge}</span>
    `;
  }

  clearErrors();

  showToast({
    title: config.badge,
    message: config.description,
    type: "info"
  });
}

function loadSelectedRoleFromStorage() {
  const params = new URLSearchParams(window.location.search);
  const roleFromUrl = params.get("role");
  const roleFromStorage = localStorage.getItem("claro360-selected-role");

  const role = roleFromUrl || roleFromStorage;

  if (role && RoleConfig[role]) {
    setRole(role);
  }
}

function bindPasswordToggle() {
  $("#passwordToggle")?.addEventListener("click", () => {
    const password = $("#password");
    const button = $("#passwordToggle");

    if (!password || !button) return;

    const isPassword = password.type === "password";
    password.type = isPassword ? "text" : "password";
    button.textContent = isPassword ? "Ocultar" : "Ver";
  });
}

function bindLoginForm() {
  const form = $("#loginForm");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (LoginState.isLoading) return;

    const payload = getLoginPayload(form);
    const validation = validateLogin(payload);

    if (!validation.ok) {
      showValidationErrors(validation.errors);
      openLoginError(validation.firstMessage);
      return;
    }

    setLoading(true);

    const result = await AuthApi.login(payload);

    setLoading(false);

    if (!result.ok) {
      openLoginError(result.message);
      return;
    }

    localStorage.setItem("claro360-session", JSON.stringify(result.user));
    localStorage.setItem("claro360-token", result.token);

    setText(
      "#sessionModalText",
      `Bienvenido, ${result.user.name}. Estamos preparando tu panel.`
    );

    openModal("#sessionModal");

    setTimeout(() => {
      window.location.href = result.redirect;
    }, 1250);
  });
}

function getLoginPayload(form) {
  const formData = new FormData(form);

  return {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    rememberMe: Boolean(formData.get("rememberMe"))
  };
}

function validateLogin(payload) {
  const errors = {};

  if (!payload.username) {
    errors.username = "Ingresa tu usuario, correo, DNI, RUC o código de cliente.";
  }

  if (!payload.password) {
    errors.password = "Ingresa tu contraseña.";
  } else if (payload.password.length < 4) {
    errors.password = "La contraseña debe tener al menos 4 caracteres.";
  }

  const messages = Object.values(errors);

  return {
    ok: messages.length === 0,
    errors,
    firstMessage: messages[0] || ""
  };
}

function showValidationErrors(errors) {
  clearErrors();

  if (errors.username) {
    setText("#usernameError", errors.username);
  }

  if (errors.password) {
    setText("#passwordError", errors.password);
  }
}

function clearErrors() {
  setText("#usernameError", "");
  setText("#passwordError", "");
}

function openLoginError(message) {
  setText("#loginErrorText", message || "Verifica tus credenciales e inténtalo nuevamente.");
  openModal("#loginErrorModal");
}

function setLoading(value) {
  LoginState.isLoading = value;

  const button = $("#loginButton");
  if (!button) return;

  button.classList.toggle("loading", value);
  button.disabled = value;
}

function bindDemoAccess() {
  $all(".demo-user").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.demoRole;
      if (!role || !RoleConfig[role]) return;

      setRole(role);

      const username = $("#username");
      const password = $("#password");

      if (username) username.value = RoleConfig[role].demoUser;
      if (password) password.value = "1234";

      showToast({
        title: "Credenciales demo cargadas",
        message: `Se cargó el acceso para ${RoleConfig[role].badge}.`,
        type: "success"
      });
    });
  });
}

function getRoleUserName(role) {
  const names = {
    "cliente-persona": "Cliente Persona",
    "cliente-empresa": "Cliente Empresa",
    asesor: "Asesor de Atención",
    supervisor: "Supervisor de Atención",
    admin: "Administrador del Sistema"
  };

  return names[role] || "Usuario";
}

function bindAssistant() {
  $("#openAssistant")?.addEventListener("click", openAssistant);
  $("#closeAssistant")?.addEventListener("click", closeAssistant);
  $("#drawerBackdrop")?.addEventListener("click", closeAssistant);

  $("#assistantForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#assistantInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addAssistantMessage(prompt, "user");
    input.value = "";

    const typing = addTypingMessage();
    await delay(500);
    typing.remove();

    addAssistantMessage(generateAssistantResponse(prompt), "bot");
  });

  $all("[data-ai-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.aiPrompt || "";

      addAssistantMessage(prompt, "user");

      const typing = addTypingMessage();
      await delay(500);
      typing.remove();

      addAssistantMessage(generateAssistantResponse(prompt), "bot");
    });
  });
}

function openAssistant() {
  $("#aiAssistant")?.classList.add("open");
  $("#drawerBackdrop")?.classList.add("show");
  document.body.classList.add("drawer-open");
}

function closeAssistant() {
  $("#aiAssistant")?.classList.remove("open");
  $("#drawerBackdrop")?.classList.remove("show");
  document.body.classList.remove("drawer-open");
}

function addAssistantMessage(text, sender) {
  const container = $("#assistantMessages");
  if (!container) return;

  const message = document.createElement("div");
  message.className = `message message--${sender}`;
  message.textContent = text;

  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function addTypingMessage() {
  const container = $("#assistantMessages");

  const message = document.createElement("div");
  message.className = "message message--bot";
  message.textContent = "ClaroBot está analizando tu consulta...";

  container?.appendChild(message);

  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  return message;
}

function generateAssistantResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("rol")) {
    return "Elige Cliente Persona si deseas consultar o registrar reclamos personales. Elige Cliente Empresa si gestionas servicios corporativos. Asesor, Supervisor y Admin son perfiles internos.";
  }

  if (text.includes("empresa")) {
    setRole("cliente-empresa");
    return "Activé el acceso Cliente Empresa. Puedes ingresar con correo corporativo, RUC o código de cliente.";
  }

  if (text.includes("contraseña") || text.includes("olvide") || text.includes("olvidé")) {
    return "Puedes usar la opción “¿Olvidaste tu contraseña?”. Se abrirá el flujo de recuperación con validación por correo u OTP.";
  }

  if (text.includes("asesor")) {
    setRole("asesor");
    return "Activé el perfil Asesor. Este acceso permite revisar bandeja, actualizar seguimiento y atender casos.";
  }

  if (text.includes("supervisor")) {
    setRole("supervisor");
    return "Activé el perfil Supervisor. Este acceso permite clasificar casos, asignar responsables y monitorear SLA.";
  }

  return "Puedo ayudarte a elegir perfil, recuperar contraseña o explicar para qué sirve cada acceso.";
}

function bindModals() {
  $all("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      closeAssistant();
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