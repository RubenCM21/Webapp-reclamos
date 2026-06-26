"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - LOGIN JS
   Conectado a FastAPI + SQL Server
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

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
    placeholder: "Ejemplo: ana.lopez@gmail.com",
    redirect: "cliente/dashboard.html",
    demoUser: "ana.lopez@gmail.com"
  },

  "cliente-empresa": {
    title: "Acceso Cliente Empresa",
    description: "Gestiona tickets, incidencias empresariales, SLA y soporte especializado.",
    badge: "Empresas",
    usernameLabel: "Correo corporativo, RUC o código de cliente",
    placeholder: "Ejemplo: contacto@acmeperu.com",
    redirect: "cliente/dashboard.html",
    demoUser: "contacto@acmeperu.com"
  },

  asesor: {
    title: "Acceso Asesor de Atención",
    description: "Consulta tu bandeja, atiende casos, registra avances y solicita información.",
    badge: "Asesor",
    usernameLabel: "Usuario interno o correo corporativo",
    placeholder: "Ejemplo: luis.ramirez@claro.com.pe",
    redirect: "asesor/dashboard.html",
    demoUser: "luis.ramirez@claro.com.pe"
  },

  supervisor: {
    title: "Acceso Supervisor",
    description: "Clasifica casos, asigna responsables, controla SLA y supervisa indicadores.",
    badge: "Supervisor",
    usernameLabel: "Usuario interno o correo corporativo",
    placeholder: "Ejemplo: carolina.vargas@claro.com.pe",
    redirect: "supervisor/dashboard.html",
    demoUser: "carolina.vargas@claro.com.pe"
  },

  admin: {
    title: "Acceso Administrador",
    description: "Administra usuarios, roles, catálogos, SLA, auditoría e integraciones.",
    badge: "Admin",
    usernameLabel: "Usuario administrador",
    placeholder: "Ejemplo: admin.sistema@claro.com.pe",
    redirect: "admin/dashboard.html",
    demoUser: "admin.sistema@claro.com.pe"
  }
};

const FrontRoleToBackendRole = {
  "cliente-persona": "CLIENTE_PERSONA",
  "cliente-empresa": "CLIENTE_EMPRESA",
  asesor: "ASESOR",
  supervisor: "SUPERVISOR",
  admin: "ADMINISTRADOR"
};

const BackendRoleToFrontRole = {
  CLIENTE_PERSONA: "cliente-persona",
  CLIENTE_EMPRESA: "cliente-empresa",
  ASESOR: "asesor",
  SUPERVISOR: "supervisor",
  ADMINISTRADOR: "admin"
};

const AuthApi = {
  async login(payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier: payload.username,
          password: payload.password,
          selected_role: payload.role,
          remember_me: payload.rememberMe || false
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          message: formatApiError(data)
        };
      }

      return {
        ok: true,
        accessToken: data.access_token || data.accessToken || data.token || "",
        refreshToken: data.refresh_token || data.refreshToken || "",
        user: data.user || data.usuario || data.data?.user || {},
        redirect: data.redirect || data.redirect_url || RoleConfig[payload.role]?.redirect || "index.html",
        raw: data
      };
    } catch (error) {
      console.error("Error conectando con backend:", error);

      return {
        ok: false,
        message: "No se pudo conectar con el backend. Verifica que FastAPI esté activo en http://127.0.0.1:8000."
      };
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
  if (element) element.textContent = String(value || "");
}

function formatApiError(data) {
  if (!data) {
    return "No se pudo iniciar sesión.";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  if (typeof data.error === "string") {
    return data.error;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
        const msg = item.msg || "Dato inválido";
        return field ? `${field}: ${msg}` : msg;
      })
      .join(" | ");
  }

  if (typeof data.detail === "object" && data.detail !== null) {
    return JSON.stringify(data.detail);
  }

  if (typeof data.message === "object" && data.message !== null) {
    return JSON.stringify(data.message);
  }

  return "No se pudo iniciar sesión. Revisa las credenciales o el tipo de acceso.";
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
      if (!role || !RoleConfig[role]) return;
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

  const selectedRole = $("#selectedRole");
  if (selectedRole) selectedRole.value = role;

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

  const role = roleFromUrl || roleFromStorage || LoginState.role;

  if (role && RoleConfig[role]) {
    setRole(role);
  } else {
    setRole("cliente-persona");
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

    saveSession(result, payload.role);

    const userName =
      result.user?.nombre_completo ||
      result.user?.name ||
      result.user?.nombre ||
      result.user?.nombres ||
      result.user?.correo ||
      payload.username;

    setText(
      "#sessionModalText",
      `Bienvenido, ${userName}. Estamos preparando tu panel.`
    );

    openModal("#sessionModal");

    const redirectUrl = getRedirectUrl(result, payload.role);

    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 900);
  });
}

function getLoginPayload(form) {
  const formData = new FormData(form);

  return {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || "").trim(),
    role: String(formData.get("role") || LoginState.role || "").trim(),
    rememberMe: Boolean(formData.get("rememberMe"))
  };
}

function validateLogin(payload) {
  const errors = {};

  if (!payload.role || !RoleConfig[payload.role]) {
    errors.role = "Selecciona un tipo de acceso válido.";
  }

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

function saveSession(result, selectedRole) {
  localStorage.removeItem("claro360-token");
  localStorage.removeItem("claro360-session");

  const user = result.user || {};

  const FrontRoleToBackendRole = {
    "cliente-persona": "CLIENTE_PERSONA",
    "cliente-empresa": "CLIENTE_EMPRESA",
    asesor: "ASESOR",
    supervisor: "SUPERVISOR",
    admin: "ADMINISTRADOR"
  };

  const BackendRoleToFrontRole = {
    CLIENTE_PERSONA: "cliente-persona",
    CLIENTE_EMPRESA: "cliente-empresa",
    ASESOR: "asesor",
    SUPERVISOR: "supervisor",
    ADMINISTRADOR: "admin"
  };

  const backendRole =
    user.rol ||
    user.codigo_rol ||
    FrontRoleToBackendRole[selectedRole] ||
    selectedRole;

  const frontRole =
    user.frontend_role ||
    user.selected_role ||
    BackendRoleToFrontRole[backendRole] ||
    selectedRole;

  localStorage.setItem("claro360-access-token", result.accessToken || "");
  localStorage.setItem("claro360-refresh-token", result.refreshToken || "");
  localStorage.setItem("claro360-user", JSON.stringify(user));

  localStorage.setItem("claro360-role", backendRole);
  localStorage.setItem("claro360-selected-role", frontRole);

  if (backendRole === "CLIENTE_PERSONA") {
    localStorage.setItem("claro360-client-type", "PERSONA");
  } else if (backendRole === "CLIENTE_EMPRESA") {
    localStorage.setItem("claro360-client-type", "EMPRESA");
  } else {
    localStorage.removeItem("claro360-client-type");
  }
}

function getRedirectUrl(result, selectedRole) {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (next && !next.startsWith("http")) {
    return next;
  }

  if (result.redirect && !result.redirect.startsWith("http")) {
    return result.redirect;
  }

  return RoleConfig[selectedRole]?.redirect || "index.html";
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
      if (password) password.value = "Claro123*";

      showToast({
        title: "Credenciales cargadas",
        message: `Se cargó el acceso para ${RoleConfig[role].badge}.`,
        type: "success"
      });
    });
  });
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
  const text = String(prompt || "").toLowerCase();

  if (text.includes("rol")) {
    return "Elige Cliente Persona para consultas personales, Cliente Empresa para servicios corporativos, Asesor para atención, Supervisor para control operativo y Admin para configuración.";
  }

  if (text.includes("empresa")) {
    setRole("cliente-empresa");
    return "Activé el acceso Cliente Empresa. Puedes ingresar con correo corporativo o RUC.";
  }

  if (text.includes("contraseña") || text.includes("olvide") || text.includes("olvidé")) {
    return "Puedes usar la opción de recuperación de contraseña para validar tu acceso mediante correo u OTP.";
  }

  if (text.includes("asesor")) {
    setRole("asesor");
    return "Activé el perfil Asesor. Este acceso permite revisar bandeja, actualizar seguimiento y atender casos.";
  }

  if (text.includes("supervisor")) {
    setRole("supervisor");
    return "Activé el perfil Supervisor. Este acceso permite clasificar casos, asignar responsables y monitorear SLA.";
  }

  if (text.includes("admin") || text.includes("administrador")) {
    setRole("admin");
    return "Activé el perfil Administrador. Este acceso permite gestionar usuarios, roles, catálogos, SLA y auditoría.";
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