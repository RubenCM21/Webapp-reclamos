"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - RECUPERAR CONTRASEÑA
   Integrado con backend FastAPI + SQL Server
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const RecoveryState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  currentStep: 1,
  maxStep: 3,
  codeValidated: false,
  resetToken: null,
  codeSeconds: 45,
  timerId: null,
  isSubmitting: false
};

const RecoveryApi = {
  async requestCode(payload) {
    return apiRequest("/auth/password/request-code", {
      method: "POST",
      body: JSON.stringify({
        account_type: payload.accountType,
        identifier: payload.identifier
      })
    });
  },

  async verifyCode(payload) {
    return apiRequest("/auth/password/verify-code", {
      method: "POST",
      body: JSON.stringify({
        account_type: payload.accountType,
        identifier: payload.identifier,
        code: payload.code
      })
    });
  },

  async resetPassword(payload) {
    return apiRequest("/auth/password/reset", {
      method: "POST",
      body: JSON.stringify({
        account_type: payload.accountType,
        identifier: payload.identifier,
        reset_token: payload.resetToken,
        new_password: payload.newPassword
      })
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(RecoveryState.theme);
  bindTheme();
  bindStepperButtons();
  bindCodeInputs();
  bindPasswordTools();
  bindRecoveryForm();
  bindBot();
  bindModals();
  updateStepUI();
});

function $(selector, parent = document) {
  return parent.querySelector(selector);
}

function $all(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("claro360-access-token");

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

function getApiErrorMessage(data) {
  if (!data) return "No se pudo completar la operación.";

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => item.msg || "Dato inválido")
      .join(" ");
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return "No se pudo completar la operación.";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
      <strong>${escapeHTML(title)}</strong>
      <p>${escapeHTML(message)}</p>
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
  RecoveryState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = RecoveryState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function bindStepperButtons() {
  $("#nextStepBtn")?.addEventListener("click", async () => {
    if (RecoveryState.currentStep === 1) {
      await handleRequestCode();
      return;
    }

    if (RecoveryState.currentStep === 2) {
      await handleVerifyCode();
    }
  });

  $("#prevStepBtn")?.addEventListener("click", () => {
    if (RecoveryState.currentStep <= 1) return;

    RecoveryState.currentStep -= 1;
    updateStepUI();
  });

  $("#resendOtpBtn")?.addEventListener("click", async () => {
    await handleResendCode();
  });
}

async function handleRequestCode() {
  const validation = validateStepOne();

  if (!validation.ok) {
    showErrors(validation.errors);
    showToast({
      title: "Datos incompletos",
      message: validation.firstMessage,
      type: "warning"
    });
    return;
  }

  clearErrors();

  try {
    const payload = getStepOnePayload();
    await RecoveryApi.requestCode(payload);

    showToast({
      title: "Código enviado",
      message: "Si la cuenta existe, enviaremos un código al medio registrado.",
      type: "success"
    });

    clearCodeInputs();
    startCodeTimer();

    RecoveryState.currentStep = 2;
    updateStepUI();
  } catch (error) {
    openGenericModal({
      icon: "!",
      title: "No se pudo iniciar recuperación",
      text: error.message
    });
  }
}

async function handleVerifyCode() {
  const code = getCode();

  if (code.length !== 6) {
    setText("#otpError", "Ingresa el código completo de 6 dígitos.");
    return;
  }

  try {
    const response = await RecoveryApi.verifyCode({
      ...getStepOnePayload(),
      code
    });

    RecoveryState.codeValidated = true;
    RecoveryState.resetToken = response.reset_token || null;

    if (!RecoveryState.resetToken) {
      throw new Error("No se recibió un token válido de recuperación.");
    }

    setText("#otpError", "");

    showToast({
      title: "Código validado",
      message: "Ahora puedes crear tu nueva contraseña.",
      type: "success"
    });

    RecoveryState.currentStep = 3;
    updateStepUI();
  } catch (error) {
    RecoveryState.codeValidated = false;
    RecoveryState.resetToken = null;

    setText("#otpError", error.message);

    showToast({
      title: "Código inválido",
      message: error.message,
      type: "danger"
    });
  }
}

async function handleResendCode() {
  const validation = validateStepOne();

  if (!validation.ok) {
    showErrors(validation.errors);
    return;
  }

  try {
    await RecoveryApi.requestCode(getStepOnePayload());

    showToast({
      title: "Código reenviado",
      message: "Se envió un nuevo código de verificación.",
      type: "success"
    });

    RecoveryState.codeValidated = false;
    RecoveryState.resetToken = null;

    clearCodeInputs();
    startCodeTimer();
  } catch (error) {
    showToast({
      title: "No se pudo reenviar",
      message: error.message,
      type: "danger"
    });
  }
}

function updateStepUI() {
  const step = RecoveryState.currentStep;

  $all(".form-step").forEach((section) => {
    section.classList.toggle("active", Number(section.dataset.step) === step);
  });

  $all(".stepper__item").forEach((item) => {
    const itemStep = Number(item.dataset.stepIndicator);
    item.classList.toggle("active", itemStep === step);
    item.classList.toggle("done", itemStep < step);
  });

  const prev = $("#prevStepBtn");
  const next = $("#nextStepBtn");
  const submit = $("#submitRecoveryBtn");

  if (prev) prev.disabled = step === 1;

  if (step === RecoveryState.maxStep) {
    next?.classList.add("hidden");
    submit?.classList.remove("hidden");
  } else {
    next?.classList.remove("hidden");
    submit?.classList.add("hidden");
  }

  const descriptions = {
    1: "Ingresa tu correo, DNI, RUC o usuario registrado.",
    2: "Valida el código enviado al medio registrado.",
    3: "Crea y confirma tu nueva contraseña."
  };

  setText("#stepDescription", descriptions[step]);
}

function getStepOnePayload() {
  return {
    accountType: $("#accountType")?.value.trim(),
    identifier: $("#identifier")?.value.trim()
  };
}

function validateStepOne() {
  const errors = {};

  if (!$("#accountType")?.value.trim()) {
    errors.accountType = "Selecciona el tipo de cuenta.";
  }

  if (!$("#identifier")?.value.trim()) {
    errors.identifier = "Ingresa tu correo, DNI, RUC o usuario.";
  }

  const messages = Object.values(errors);

  return {
    ok: messages.length === 0,
    errors,
    firstMessage: messages[0] || ""
  };
}

function validateStepThree() {
  const errors = {};
  const password = $("#newPassword")?.value || "";
  const confirmPassword = $("#confirmPassword")?.value || "";

  if (!password) {
    errors.newPassword = "Ingresa la nueva contraseña.";
  } else if (password.length < 8) {
    errors.newPassword = "La contraseña debe tener al menos 8 caracteres.";
  } else if (!/[A-Z]/.test(password)) {
    errors.newPassword = "La contraseña debe incluir al menos una mayúscula.";
  } else if (!/[0-9]/.test(password)) {
    errors.newPassword = "La contraseña debe incluir al menos un número.";
  } else if (!/[^A-Za-z0-9]/.test(password)) {
    errors.newPassword = "La contraseña debe incluir al menos un símbolo.";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirma la nueva contraseña.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
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

function bindCodeInputs() {
  const inputs = $all("#otpInputs input");

  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");

      if (input.value && inputs[index + 1]) {
        inputs[index + 1].focus();
      }

      setText("#otpError", "");
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();

      const pasted = event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, inputs.length);

      pasted.split("").forEach((char, pasteIndex) => {
        if (inputs[pasteIndex]) {
          inputs[pasteIndex].value = char;
        }
      });

      const nextIndex = Math.min(pasted.length, inputs.length - 1);
      inputs[nextIndex]?.focus();

      setText("#otpError", "");
    });
  });
}

function getCode() {
  return $all("#otpInputs input")
    .map((input) => input.value)
    .join("");
}

function clearCodeInputs() {
  $all("#otpInputs input").forEach((input) => {
    input.value = "";
  });

  $all("#otpInputs input")[0]?.focus();
}

function startCodeTimer() {
  clearInterval(RecoveryState.timerId);

  RecoveryState.codeSeconds = 45;

  const resendButton = $("#resendOtpBtn");
  const timer = $("#otpTimer");

  if (resendButton) resendButton.disabled = true;

  RecoveryState.timerId = setInterval(() => {
    RecoveryState.codeSeconds -= 1;

    if (timer) {
      timer.textContent = `Puedes reenviar el código en ${RecoveryState.codeSeconds}s`;
    }

    if (RecoveryState.codeSeconds <= 0) {
      clearInterval(RecoveryState.timerId);

      if (timer) {
        timer.textContent = "Puedes reenviar el código ahora.";
      }

      if (resendButton) {
        resendButton.disabled = false;
      }
    }
  }, 1000);
}

function bindPasswordTools() {
  $("#togglePassword")?.addEventListener("click", () => {
    const input = $("#newPassword");
    const button = $("#togglePassword");

    if (!input || !button) return;

    const visible = input.type === "text";

    input.type = visible ? "password" : "text";
    button.textContent = visible ? "Ver" : "Ocultar";
  });

  $("#newPassword")?.addEventListener("input", () => {
    updatePasswordMeter($("#newPassword").value);
  });
}

function updatePasswordMeter(password) {
  const bar = $("#passwordMeterBar");
  const text = $("#passwordMeterText");

  if (!bar || !text) return;

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const config = [
    { width: "0%", label: "Seguridad: pendiente", color: "var(--danger)" },
    { width: "25%", label: "Seguridad: débil", color: "var(--danger)" },
    { width: "45%", label: "Seguridad: básica", color: "var(--warning)" },
    { width: "65%", label: "Seguridad: media", color: "var(--info)" },
    { width: "85%", label: "Seguridad: buena", color: "var(--success)" },
    { width: "100%", label: "Seguridad: fuerte", color: "var(--success)" }
  ][score];

  bar.style.width = config.width;
  bar.style.background = config.color;
  text.textContent = config.label;
}

function bindRecoveryForm() {
  $("#recoveryForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (RecoveryState.isSubmitting) return;

    const validation = validateStepThree();

    if (!validation.ok) {
      showErrors(validation.errors);

      showToast({
        title: "Contraseña inválida",
        message: validation.firstMessage,
        type: "warning"
      });

      return;
    }

    if (!RecoveryState.codeValidated || !RecoveryState.resetToken) {
      openGenericModal({
        icon: "🔐",
        title: "Código pendiente",
        text: "Debes validar el código antes de cambiar la contraseña."
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      ...getStepOnePayload(),
      resetToken: RecoveryState.resetToken,
      newPassword: $("#newPassword")?.value
    };

    try {
      const response = await RecoveryApi.resetPassword(payload);

      if (!response.ok) {
        throw new Error(response.message || "No se pudo actualizar la contraseña.");
      }

      localStorage.removeItem("claro360-access-token");
      localStorage.removeItem("claro360-refresh-token");
      localStorage.removeItem("claro360-user");
      localStorage.removeItem("claro360-role");
      localStorage.removeItem("claro360-client-type");

      openModal("#successModal");
    } catch (error) {
      openGenericModal({
        icon: "!",
        title: "No se pudo cambiar la contraseña",
        text: error.message
      });
    } finally {
      setSubmitting(false);
    }
  });
}

function setSubmitting(value) {
  RecoveryState.isSubmitting = value;

  const button = $("#submitRecoveryBtn");
  if (!button) return;

  button.disabled = value;
  button.classList.toggle("loading", value);
}

/* =========================================================
   ASISTENTE DE RECUPERACIÓN
========================================================= */

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#openBotSupport")?.addEventListener("click", openBot);
  $("#closeBotDrawer")?.addEventListener("click", closeBot);
  $("#drawerBackdrop")?.addEventListener("click", closeBot);

  $("#botForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#botInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addBotMessage(prompt, "user");
    input.value = "";

    addBotMessage(generateBotResponse(prompt), "bot");
  });

  $all("[data-bot-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.botPrompt || "";

      addBotMessage(prompt, "user");
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

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("código") || text.includes("otp")) {
    return "Si no recibiste el código, espera a que termine el temporizador y usa Reenviar código. Revisa también el correo no deseado o el medio registrado.";
  }

  if (text.includes("contraseña")) {
    return "Usa una contraseña de mínimo 8 caracteres, con mayúscula, número y símbolo. Evita usar datos personales.";
  }

  if (text.includes("tipo") || text.includes("cuenta")) {
    return "Elige Cliente Persona si eres usuario individual, Cliente Empresa si gestionas servicios corporativos, y perfiles internos solo para trabajadores autorizados.";
  }

  return "Puedo ayudarte a identificar tu cuenta, validar el código o crear una contraseña segura.";
}

/* =========================================================
   MODALES
========================================================= */

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