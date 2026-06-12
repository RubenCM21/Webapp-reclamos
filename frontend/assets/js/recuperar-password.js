"use strict";

const RecoveryState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  currentStep: 1,
  maxStep: 3,
  otpValidated: false,
  otpSeconds: 45,
  timerId: null,
  isSubmitting: false,
  correoUsado: ""          // ← guarda el correo para el paso 3
};

// ── RecoveryApi reemplazado por llamadas reales ──────────────────────────────
const RecoveryApi = {
  async requestOtp(payload) {
    if (!payload.accountType || !payload.identifier) {
      return { ok: false, message: "Completa el tipo de cuenta y el identificador." };
    }

    try {
      await Api.Auth.solicitarRecuperacion({ correo: payload.identifier });
      RecoveryState.correoUsado = payload.identifier;
      // El backend en DEV imprime el token real en consola.
      // En DEV también acepta "123456" como token universal.
      return {
        ok: true,
        maskedContact: payload.identifier.replace(/(.{2}).+(@.+)/, "$1***$2"),
        message: "Si el correo existe, recibirás un código de recuperación."
      };
    } catch (err) {
      return { ok: false, message: err.message || "No se pudo enviar el código." };
    }
  },

  async resetPassword(payload) {
    try {
      // El código OTP del paso 2 se usa como token de reset (backend DEV acepta "123456")
      await Api.Auth.restablecerPassword({
        token: payload.otpCode || "123456",
        nueva_password: payload.newPassword,
      });
      return { ok: true, message: "Contraseña actualizada correctamente." };
    } catch (err) {
      return { ok: false, message: err.message || "No se pudo restablecer la contraseña." };
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(RecoveryState.theme);
  bindTheme();
  bindStepperButtons();
  bindOtpInputs();
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

      const payload = getStepOnePayload();
      const response = await RecoveryApi.requestOtp(payload);

      if (!response.ok) {
        openGenericModal({
          icon: "!",
          title: "No se pudo enviar OTP",
          text: response.message
        });
        return;
      }

      showToast({
        title: "OTP enviado",
        message: "Usa el código demo 123456 para continuar.",
        type: "success"
      });

      startOtpTimer();
      RecoveryState.currentStep = 2;
      updateStepUI();
      return;
    }

    if (RecoveryState.currentStep === 2) {
      const code = getOtpCode();

      if (code !== "123456") {
        setText("#otpError", "El código OTP no es válido. Usa 123456 para el prototipo.");
        showToast({
          title: "OTP incorrecto",
          message: "Verifica el código de 6 dígitos.",
          type: "danger"
        });
        return;
      }

      setText("#otpError", "");
      RecoveryState.otpValidated = true;

      showToast({
        title: "OTP validado",
        message: "Ahora crea tu nueva contraseña.",
        type: "success"
      });

      RecoveryState.currentStep = 3;
      updateStepUI();
    }
  });

  $("#prevStepBtn")?.addEventListener("click", () => {
    if (RecoveryState.currentStep <= 1) return;

    RecoveryState.currentStep -= 1;
    updateStepUI();
  });

  $("#resendOtpBtn")?.addEventListener("click", async () => {
    const response = await RecoveryApi.requestOtp(getStepOnePayload());

    if (response.ok) {
      showToast({
        title: "OTP reenviado",
        message: "Se envió un nuevo código. Usa 123456 para el prototipo.",
        type: "success"
      });

      clearOtpInputs();
      startOtpTimer();
    }
  });
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
    2: "Valida el código OTP enviado a tu medio registrado.",
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
  } else if (password.length < 6) {
    errors.newPassword = "La contraseña debe tener al menos 6 caracteres.";
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

function bindOtpInputs() {
  const inputs = $all("#otpInputs input");

  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");

      if (input.value && inputs[index + 1]) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
        inputs[index - 1].focus();
      }
    });
  });
}

function getOtpCode() {
  return $all("#otpInputs input")
    .map((input) => input.value)
    .join("");
}

function clearOtpInputs() {
  $all("#otpInputs input").forEach((input) => {
    input.value = "";
  });

  $all("#otpInputs input")[0]?.focus();
}

function startOtpTimer() {
  clearInterval(RecoveryState.timerId);

  RecoveryState.otpSeconds = 45;

  const resendButton = $("#resendOtpBtn");
  const timer = $("#otpTimer");

  if (resendButton) resendButton.disabled = true;

  RecoveryState.timerId = setInterval(() => {
    RecoveryState.otpSeconds -= 1;

    if (timer) {
      timer.textContent = `Puedes reenviar el código en ${RecoveryState.otpSeconds}s`;
    }

    if (RecoveryState.otpSeconds <= 0) {
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

  if (password.length >= 6) score += 1;
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

    if (!RecoveryState.otpValidated) {
      openGenericModal({
        icon: "🔐",
        title: "OTP pendiente",
        text: "Debes validar el código OTP antes de cambiar la contraseña."
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      ...getStepOnePayload(),
      newPassword: $("#newPassword")?.value
    };

    const response = await RecoveryApi.resetPassword(payload);

    setSubmitting(false);

    if (response.ok) {
      localStorage.removeItem("claro360-token");
      localStorage.removeItem("claro360-session");
      openModal("#successModal");
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

function bindBot() {
  $("#floatingBot")?.addEventListener("click", openBot);
  $("#openBotSupport")?.addEventListener("click", openBot);
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
  message.textContent = "ClaroBot está revisando tu consulta...";

  container?.appendChild(message);

  if (container) container.scrollTop = container.scrollHeight;

  return message;
}

function generateBotResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("otp") || text.includes("código")) {
    return "Si no recibiste el OTP, espera a que termine el temporizador y usa Reenviar código. En este prototipo el código válido es 123456.";
  }

  if (text.includes("contraseña")) {
    return "Te recomiendo crear una contraseña de mínimo 10 caracteres, con mayúsculas, números y un símbolo. Evita usar tu DNI, RUC o fechas personales.";
  }

  if (text.includes("tipo") || text.includes("cuenta")) {
    return "Elige Cliente Persona si eres usuario individual, Cliente Empresa si gestionas servicios corporativos, y perfiles internos solo para trabajadores autorizados.";
  }

  return "Puedo ayudarte a identificar tu cuenta, validar el OTP o crear una contraseña segura.";
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