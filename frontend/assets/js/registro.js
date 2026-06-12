"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - REGISTRO JS
   Preparado para backend
========================================================= */

const RegisterState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  accountType: "persona",
  currentStep: 1,
  maxStep: 4,
  otpValidated: false,
  documentValidated: false,
  selectedService: "movil",
  isSubmitting: false
};

const RegisterApi = {
  async verifyDocument({ accountType, documentType, documentNumber }) {
    await delay(600);

    if (!documentType || !documentNumber) {
      return {
        ok: false,
        message: "Selecciona el tipo de documento e ingresa el número."
      };
    }

    if (accountType === "persona" && documentType === "DNI" && documentNumber.length !== 8) {
      return {
        ok: false,
        message: "El DNI debe tener 8 dígitos."
      };
    }

    if (accountType === "empresa" && documentNumber.length !== 11) {
      return {
        ok: false,
        message: "El RUC debe tener 11 dígitos."
      };
    }

    return {
      ok: true,
      message: "Documento validado correctamente."
    };
  },

  async sendOtp() {
    await delay(500);

    return {
      ok: true,
      message: "OTP enviado correctamente."
    };
  },

  async register(payload) {
    const form = $("#registerForm");
    const endpoint = form?.dataset.endpoint || "/api/auth/register";
    const method = (form?.dataset.method || "POST").toUpperCase();

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        return { ok: false, message: data.detail || (data.message || "Error al crear la cuenta") };
      }

      return { ok: true, userId: data.id || null, accountType: data.account_type || payload.accountType, email: data.email };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(RegisterState.theme);
  bindTheme();
  bindAccountTabs();
  bindStepperButtons();
  bindServiceOptions();
  bindDocumentValidation();
  bindPasswordTools();
  bindOtp();
  bindRegisterForm();
  bindAssistant();
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
  RegisterState.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("claro360-theme", theme);
}

function bindTheme() {
  $("#themeToggle")?.addEventListener("click", () => {
    const next = RegisterState.theme === "light" ? "dark" : "light";
    applyTheme(next);

    showToast({
      title: "Tema actualizado",
      message: `Se activó el modo ${next === "dark" ? "oscuro" : "claro"}.`,
      type: "success"
    });
  });
}

function bindAccountTabs() {
  $all(".account-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const type = tab.dataset.accountType;
      if (!type) return;
      setAccountType(type);
    });
  });
}

function setAccountType(type) {
  RegisterState.accountType = type;
  RegisterState.documentValidated = false;

  $("#accountType").value = type;

  $all(".account-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.accountType === type);
  });

  $(".persona-fields")?.classList.toggle("hidden", type !== "persona");
  $(".empresa-fields")?.classList.toggle("hidden", type !== "empresa");

  const documentType = $("#documentType");
  const documentNumber = $("#documentNumber");

  if (type === "empresa") {
    if (documentType) {
      documentType.value = "RUC";
    }

    if (documentNumber) {
      documentNumber.placeholder = "Ejemplo: 20123456789";
    }

    setText("#documentTypeLabel", "Tipo de documento tributario");
    setText("#documentNumberLabel", "Número de RUC");
    setText("#previewClientType", "Cliente empresa");
  } else {
    if (documentType) {
      documentType.value = "";
    }

    if (documentNumber) {
      documentNumber.placeholder = "Ejemplo: 76543210";
    }

    setText("#documentTypeLabel", "Tipo de documento");
    setText("#documentNumberLabel", "Número de documento");
    setText("#previewClientType", "Persona natural");
  }

  showToast({
    title: type === "persona" ? "Cliente Persona" : "Cliente Empresa",
    message:
      type === "persona"
        ? "Se activó el registro para persona natural."
        : "Se activó el registro para empresa.",
    type: "info"
  });
}

function bindStepperButtons() {
  $("#nextStepBtn")?.addEventListener("click", () => {
    const validation = validateStep(RegisterState.currentStep);

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "Campos pendientes",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    clearErrors();
    RegisterState.currentStep += 1;
    updateStepUI();
  });

  $("#prevStepBtn")?.addEventListener("click", () => {
    RegisterState.currentStep -= 1;
    updateStepUI();
  });
}

function updateStepUI() {
  const step = RegisterState.currentStep;

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
  const submit = $("#submitRegisterBtn");

  if (prev) prev.disabled = step === 1;

  if (step === RegisterState.maxStep) {
    next?.classList.add("hidden");
    submit?.classList.remove("hidden");
  } else {
    next?.classList.remove("hidden");
    submit?.classList.add("hidden");
  }

  updateAssistantText(step);
}

function updateAssistantText(step) {
  const messages = {
    1: "Completa los datos de identidad. Puedo ayudarte a validar el tipo de cuenta y detectar campos faltantes.",
    2: "Agrega correo y celular. Estos medios servirán para notificaciones y validación OTP.",
    3: "Relaciona tu cuenta con un servicio. Esto facilitará el registro de reclamos e incidencias.",
    4: "Crea una contraseña segura y valida tu identidad con OTP antes de finalizar."
  };

  setText("#sideAssistantText", messages[step]);
}

function bindServiceOptions() {
  $all(".service-option").forEach((option) => {
    option.addEventListener("click", () => {
      const service = option.dataset.serviceType;
      if (!service) return;

      RegisterState.selectedService = service;
      $("#serviceType").value = service;

      $all(".service-option").forEach((item) => item.classList.remove("active"));
      option.classList.add("active");

      updateServiceDiagnostic(service);
    });
  });
}

function updateServiceDiagnostic(service) {
  const labels = {
    movil: "Se validará si la línea móvil está asociada al documento ingresado.",
    hogar: "Se verificará si el servicio hogar está activo en la dirección registrada.",
    tv: "Se validará si el servicio de TV está asociado a tu cuenta.",
    empresa: "Se verificará el servicio empresarial, RUC y contrato relacionado."
  };

  setText("#serviceDiagnosticText", labels[service] || labels.movil);
}

function bindDocumentValidation() {
  $("#verifyDocumentBtn")?.addEventListener("click", async () => {
    const payload = {
      accountType: RegisterState.accountType,
      documentType: $("#documentType")?.value.trim(),
      documentNumber: $("#documentNumber")?.value.trim()
    };

    const result = await RegisterApi.verifyDocument(payload);

    RegisterState.documentValidated = result.ok;

    if (result.ok) {
      showToast({
        title: "Documento validado",
        message: result.message,
        type: "success"
      });

      openGenericModal({
        icon: "✓",
        title: "Validación correcta",
        text: "El documento fue validado para continuar con el registro."
      });
    } else {
      showToast({
        title: "Validación no completada",
        message: result.message,
        type: "warning"
      });
    }
  });
}

function bindPasswordTools() {
  $("#togglePassword")?.addEventListener("click", () => {
    const input = $("#password");
    const button = $("#togglePassword");

    if (!input || !button) return;

    const visible = input.type === "text";

    input.type = visible ? "password" : "text";
    button.textContent = visible ? "Ver" : "Ocultar";
  });

  $("#password")?.addEventListener("input", () => {
    updatePasswordMeter($("#password").value);
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

function bindOtp() {
  $("#sendOtpBtn")?.addEventListener("click", async () => {
    const validation = validateStep(2);

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "Contacto requerido",
        message: "Completa correo y celular antes de enviar el OTP.",
        type: "warning"
      });
      return;
    }

    const result = await RegisterApi.sendOtp();

    if (result.ok) {
      openModal("#otpModal");
      showToast({
        title: "OTP enviado",
        message: "Usa el código demo 123456 para continuar.",
        type: "success"
      });
    }
  });

  const otpInputs = $all("#otpInputs input");

  otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");

      if (input.value && otpInputs[index + 1]) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && otpInputs[index - 1]) {
        otpInputs[index - 1].focus();
      }
    });
  });

  $("#validateOtpBtn")?.addEventListener("click", () => {
    const code = otpInputs.map((input) => input.value).join("");

    if (code !== "123456") {
      showToast({
        title: "OTP incorrecto",
        message: "El código demo válido es 123456.",
        type: "danger"
      });
      return;
    }

    RegisterState.otpValidated = true;
    closeAllModals();

    showToast({
      title: "OTP validado",
      message: "La validación de identidad fue completada.",
      type: "success"
    });
  });
}

function bindRegisterForm() {
  $("#registerForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (RegisterState.isSubmitting) return;

    const validation = validateStep(4);

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "No se pudo crear la cuenta",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    if (!RegisterState.otpValidated) {
      openGenericModal({
        icon: "🔐",
        title: "OTP pendiente",
        text: "Debes validar el código OTP antes de crear la cuenta."
      });
      return;
    }

    clearErrors();
    setSubmitting(true);

    const payload = getRegisterPayload();
    const result = await RegisterApi.register(payload);

    setSubmitting(false);

    if (result.ok) {
      renderSuccessSummary(payload);
      openModal("#successModal");

      localStorage.setItem(
        "claro360-last-register",
        JSON.stringify({
          accountType: payload.accountType,
          email: payload.email,
          createdAt: new Date().toISOString()
        })
      );
    }
  });
}

function getRegisterPayload() {
  const form = $("#registerForm");
  const formData = new FormData(form);

  return {
    accountType: String(formData.get("accountType") || ""),
    documentType: String(formData.get("documentType") || ""),
    documentNumber: String(formData.get("documentNumber") || ""),
    firstName: String(formData.get("firstName") || ""),
    lastName: String(formData.get("lastName") || ""),
    businessName: String(formData.get("businessName") || ""),
    representativeName: String(formData.get("representativeName") || ""),
    businessArea: String(formData.get("businessArea") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || ""),
    serviceType: String(formData.get("serviceType") || ""),
    serviceNumber: String(formData.get("serviceNumber") || ""),
    planType: String(formData.get("planType") || ""),
    password: String(formData.get("password") || ""),
    notifyEmail: Boolean(formData.get("notifyEmail")),
    notifySms: Boolean(formData.get("notifySms")),
    notifyWhatsApp: Boolean(formData.get("notifyWhatsApp"))
  };
}

function validateStep(step) {
  const errors = {};

  if (step === 1) {
    const documentType = $("#documentType")?.value.trim();
    const documentNumber = $("#documentNumber")?.value.trim();

    if (!documentType) {
      errors.documentType = "Selecciona el tipo de documento.";
    }

    if (!documentNumber) {
      errors.documentNumber = "Ingresa el número de documento.";
    }

    if (RegisterState.accountType === "persona") {
      if (!$("#firstName")?.value.trim()) {
        errors.firstName = "Ingresa tus nombres.";
      }

      if (!$("#lastName")?.value.trim()) {
        errors.lastName = "Ingresa tus apellidos.";
      }
    }

    if (RegisterState.accountType === "empresa") {
      if (!$("#businessName")?.value.trim()) {
        errors.businessName = "Ingresa la razón social.";
      }

      if (!$("#representativeName")?.value.trim()) {
        errors.representativeName = "Ingresa el representante.";
      }

      if (!$("#businessArea")?.value.trim()) {
        errors.businessArea = "Selecciona el área solicitante.";
      }
    }
  }

  if (step === 2) {
    const email = $("#email")?.value.trim();
    const phone = $("#phone")?.value.trim();

    if (!email) {
      errors.email = "Ingresa tu correo electrónico.";
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = "Ingresa un correo válido.";
    }

    if (!phone) {
      errors.phone = "Ingresa tu número de celular.";
    } else if (!/^\d{9}$/.test(phone)) {
      errors.phone = "El celular debe tener 9 dígitos.";
    }

    if (!$("#address")?.value.trim()) {
      errors.address = "Ingresa tu dirección.";
    }
  }

  if (step === 3) {
    if (!$("#serviceNumber")?.value.trim()) {
      errors.serviceNumber = "Ingresa el número o código de servicio.";
    }

    if (!$("#planType")?.value.trim()) {
      errors.planType = "Selecciona el tipo de plan.";
    }
  }

  if (step === 4) {
    const password = $("#password")?.value || "";
    const confirm = $("#confirmPassword")?.value || "";

    if (!password) {
      errors.password = "Ingresa una contraseña.";
    } else if (password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres.";
    }

    if (!confirm) {
      errors.confirmPassword = "Confirma tu contraseña.";
    } else if (password !== confirm) {
      errors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (!$("#acceptTerms")?.checked) {
      errors.acceptTerms = "Debes aceptar los términos para continuar.";
    }
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
    const errorElement = $(`#${key}Error`);
    if (errorElement) {
      errorElement.textContent = value;
    }
  });
}

function clearErrors() {
  $all(".form-error").forEach((item) => {
    item.textContent = "";
  });
}

function setSubmitting(value) {
  RegisterState.isSubmitting = value;

  const button = $("#submitRegisterBtn");

  if (!button) return;

  button.classList.toggle("loading", value);
  button.disabled = value;
}

function renderSuccessSummary(payload) {
  const summary = $("#successSummary");

  if (!summary) return;

  const clientName =
    payload.accountType === "persona"
      ? `${payload.firstName} ${payload.lastName}`
      : payload.businessName;

  summary.innerHTML = `
    <div>
      <span>Tipo de cuenta</span>
      <strong>${payload.accountType === "persona" ? "Persona" : "Empresa"}</strong>
    </div>
    <div>
      <span>Cliente</span>
      <strong>${clientName}</strong>
    </div>
    <div>
      <span>Correo</span>
      <strong>${payload.email}</strong>
    </div>
    <div>
      <span>Servicio</span>
      <strong>${payload.serviceType}</strong>
    </div>
  `;
}

function bindAssistant() {
  $("#openAiDrawer")?.addEventListener("click", openAiDrawer);
  $("#openAssistantFromPanel")?.addEventListener("click", openAiDrawer);
  $("#closeAiDrawer")?.addEventListener("click", closeAiDrawer);
  $("#drawerBackdrop")?.addEventListener("click", closeAiDrawer);

  $("#aiForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const input = $("#aiInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addAiMessage(prompt, "user");
    input.value = "";

    const typing = addTyping();
    await delay(500);
    typing.remove();

    addAiMessage(generateAiResponse(prompt), "bot");
  });

  $all("[data-ai-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const prompt = button.dataset.aiPrompt || "";

      addAiMessage(prompt, "user");

      const typing = addTyping();
      await delay(500);
      typing.remove();

      addAiMessage(generateAiResponse(prompt), "bot");
    });
  });
}

function openAiDrawer() {
  $("#aiDrawer")?.classList.add("open");
  $("#drawerBackdrop")?.classList.add("show");
  document.body.classList.add("drawer-open");
}

function closeAiDrawer() {
  $("#aiDrawer")?.classList.remove("open");
  $("#drawerBackdrop")?.classList.remove("show");
  document.body.classList.remove("drawer-open");
}

function addAiMessage(text, sender) {
  const container = $("#aiMessages");

  if (!container) return;

  const message = document.createElement("div");
  message.className = `message message--${sender}`;
  message.textContent = text;

  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function addTyping() {
  const container = $("#aiMessages");
  const message = document.createElement("div");

  message.className = "message message--bot";
  message.textContent = "ClaroBot está analizando tu registro...";

  container?.appendChild(message);

  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  return message;
}

function generateAiResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("persona")) {
    setAccountType("persona");
    return "Activé el registro para Persona. Necesitarás documento, nombres, contacto, servicio asociado y contraseña.";
  }

  if (text.includes("empresa")) {
    setAccountType("empresa");
    return "Activé el registro para Empresa. Necesitarás RUC, razón social, representante, contacto y servicio empresarial asociado.";
  }

  if (text.includes("datos")) {
    return "Para crear tu cuenta necesitas documento, correo, celular, dirección, servicio asociado, contraseña y validación OTP.";
  }

  if (text.includes("contraseña")) {
    return "Te recomiendo una contraseña de mínimo 10 caracteres, con mayúsculas, números y un símbolo. Evita usar tu DNI o fecha de nacimiento.";
  }

  if (text.includes("otp")) {
    return "El OTP confirma que el correo o celular te pertenece. En este prototipo usa el código demo 123456.";
  }

  return "Puedo ayudarte a elegir tipo de cuenta, revisar campos obligatorios, crear una contraseña segura o validar el OTP.";
}

function bindModals() {
  $all("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      closeAiDrawer();
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