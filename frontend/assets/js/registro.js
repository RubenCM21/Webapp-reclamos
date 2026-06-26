"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - REGISTRO JS
   Integrado con backend FastAPI + SQL Server
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

const RegisterState = {
  theme: localStorage.getItem("claro360-theme") || "light",
  accountType: "persona",
  currentStep: 1,
  maxStep: 4,
  documentValidated: false,
  selectedService: "movil",
  isSubmitting: false
};

const RegisterApi = {
  async verifyDocument(payload) {
    return apiRequest("/auth/validate-document", {
      method: "POST",
      body: JSON.stringify({
        account_type: payload.accountType,
        document_type: payload.documentType,
        document_number: payload.documentNumber
      })
    });
  },

  async register(payload) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        account_type: payload.accountType,
        document_type: payload.documentType,
        document_number: payload.documentNumber,
        first_name: payload.firstName,
        last_name: payload.lastName,
        business_name: payload.businessName,
        representative_name: payload.representativeName,
        business_area: payload.businessArea,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        service_type: payload.serviceType,
        service_number: payload.serviceNumber,
        plan_type: payload.planType,
        password: payload.password,
        notification_preferences: {
          email: payload.notifyEmail,
          sms: payload.notifySms,
          whatsapp: payload.notifyWhatsApp
        }
      })
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(RegisterState.theme);
  removeObsoleteVerificationBox();
  bindTheme();
  bindAccountTabs();
  bindStepperButtons();
  bindServiceOptions();
  bindDocumentValidation();
  bindPasswordTools();
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

function removeObsoleteVerificationBox() {
  $("#sendOtpBtn")?.closest(".otp-box")?.remove();
  $("#otpModal")?.remove();
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

  const hidden = $("#accountType");
  if (hidden) hidden.value = type;

  $all(".account-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.accountType === type);
  });

  $(".persona-fields")?.classList.toggle("hidden", type !== "persona");
  $(".empresa-fields")?.classList.toggle("hidden", type !== "empresa");

  const documentType = $("#documentType");
  const documentNumber = $("#documentNumber");

  if (type === "empresa") {
    if (documentType) documentType.value = "RUC";
    if (documentNumber) documentNumber.placeholder = "Ejemplo: 20123456789";

    setText("#documentTypeLabel", "Tipo de documento tributario");
    setText("#documentNumberLabel", "Número de RUC");
    setText("#previewClientType", "Cliente empresa");

    RegisterState.selectedService = "empresa";

    const serviceType = $("#serviceType");
    if (serviceType) serviceType.value = "empresa";

    $all(".service-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.serviceType === "empresa");
    });

    updateServiceDiagnostic("empresa");
  } else {
    if (documentType) documentType.value = "";
    if (documentNumber) documentNumber.placeholder = "Ejemplo: 76543210";

    setText("#documentTypeLabel", "Tipo de documento");
    setText("#documentNumberLabel", "Número de documento");
    setText("#previewClientType", "Persona natural");
  }

  clearErrors();

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

    if (RegisterState.currentStep < RegisterState.maxStep) {
      RegisterState.currentStep += 1;
      updateStepUI();
    }
  });

  $("#prevStepBtn")?.addEventListener("click", () => {
    if (RegisterState.currentStep <= 1) return;

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
    1: "Completa los datos de identidad. Estos datos permitirán registrar correctamente tu cuenta.",
    2: "Agrega correo y celular. El correo será usado para la verificación de cuenta.",
    3: "Relaciona tu cuenta con un servicio para facilitar futuros reclamos e incidencias.",
    4: "Crea una contraseña segura. Al finalizar, se enviará un código de verificación."
  };

  setText("#sideAssistantText", messages[step]);
}

function bindServiceOptions() {
  $all(".service-option").forEach((option) => {
    option.addEventListener("click", () => {
      const service = option.dataset.serviceType;
      if (!service) return;

      RegisterState.selectedService = service;

      const serviceType = $("#serviceType");
      if (serviceType) serviceType.value = service;

      $all(".service-option").forEach((item) => item.classList.remove("active"));
      option.classList.add("active");

      updateServiceDiagnostic(service);
    });
  });
}

function updateServiceDiagnostic(service) {
  const labels = {
    movil: "El servicio móvil será asociado al documento ingresado.",
    hogar: "El servicio hogar será asociado a la dirección y documento registrados.",
    tv: "El servicio de TV será asociado a la cuenta del cliente.",
    empresa: "El servicio empresarial será asociado al RUC, contrato o código ingresado."
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

    const localValidation = validateDocumentFormat(payload);

    if (!localValidation.ok) {
      showErrors(localValidation.errors);
      showToast({
        title: "Documento inválido",
        message: localValidation.firstMessage,
        type: "warning"
      });
      return;
    }

    try {
      const result = await RegisterApi.verifyDocument(payload);

      RegisterState.documentValidated = true;

      showToast({
        title: "Documento validado",
        message: result.message || "Documento disponible para registro.",
        type: "success"
      });

      openGenericModal({
        icon: "✓",
        title: "Validación correcta",
        text: "El documento está disponible para continuar con el registro."
      });
    } catch (error) {
      RegisterState.documentValidated = false;

      showToast({
        title: "Validación no completada",
        message: error.message,
        type: "warning"
      });

      openGenericModal({
        icon: "!",
        title: "No se pudo validar",
        text: error.message
      });
    }
  });
}

function validateDocumentFormat(payload) {
  const errors = {};

  if (!payload.documentType) {
    errors.documentType = "Selecciona el tipo de documento.";
  }

  if (!payload.documentNumber) {
    errors.documentNumber = "Ingresa el número de documento.";
  } else if (!/^\d+$/.test(payload.documentNumber)) {
    errors.documentNumber = "El documento debe contener solo números.";
  } else if (payload.accountType === "persona" && payload.documentType === "DNI" && payload.documentNumber.length !== 8) {
    errors.documentNumber = "El DNI debe tener 8 dígitos.";
  } else if (payload.accountType === "empresa" && payload.documentNumber.length !== 11) {
    errors.documentNumber = "El RUC debe tener 11 dígitos.";
  }

  const messages = Object.values(errors);

  return {
    ok: messages.length === 0,
    errors,
    firstMessage: messages[0] || ""
  };
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

function bindRegisterForm() {
  const form = $("#registerForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (RegisterState.isSubmitting) return;

    const validation = validateAllForm();

    if (!validation.ok) {
      showErrors(validation.errors);
      showToast({
        title: "No se pudo crear la cuenta",
        message: validation.firstMessage,
        type: "warning"
      });
      return;
    }

    clearErrors();
    setSubmitting(true);

    const payload = getRegisterPayload();

    try {
      const result = await RegisterApi.register(payload);

      if (!result.ok) {
        throw new Error(result.message || "No se pudo registrar la cuenta.");
      }

      sessionStorage.setItem("pendingVerificationEmail", payload.email);
      sessionStorage.setItem("pendingVerificationPurpose", "REGISTRO");

      showToast({
        title: "Cuenta registrada",
        message: "Te enviaremos a la verificación de cuenta.",
        type: "success"
      });

      setTimeout(() => {
        window.location.href = "verificacion.html";
      }, 900);
    } catch (error) {
      openGenericModal({
        icon: "!",
        title: "Registro no completado",
        text: error.message
      });

      showToast({
        title: "Registro no completado",
        message: error.message,
        type: "danger"
      });
    } finally {
      setSubmitting(false);
    }
  });
}

function getRegisterPayload() {
  const form = $("#registerForm");
  const formData = new FormData(form);

  return {
    accountType: String(formData.get("accountType") || "").trim(),
    documentType: String(formData.get("documentType") || "").trim(),
    documentNumber: String(formData.get("documentNumber") || "").trim(),
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    businessName: String(formData.get("businessName") || "").trim(),
    representativeName: String(formData.get("representativeName") || "").trim(),
    businessArea: String(formData.get("businessArea") || "").trim(),
    email: String(formData.get("email") || "").trim().toLowerCase(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    serviceType: String(formData.get("serviceType") || "").trim(),
    serviceNumber: String(formData.get("serviceNumber") || "").trim(),
    planType: String(formData.get("planType") || "").trim(),
    password: String(formData.get("password") || ""),
    notifyEmail: Boolean(formData.get("notifyEmail")),
    notifySms: Boolean(formData.get("notifySms")),
    notifyWhatsApp: Boolean(formData.get("notifyWhatsApp"))
  };
}

function validateAllForm() {
  const finalErrors = {};

  for (let step = 1; step <= RegisterState.maxStep; step += 1) {
    const validation = validateStep(step);
    Object.assign(finalErrors, validation.errors);
  }

  const messages = Object.values(finalErrors);

  return {
    ok: messages.length === 0,
    errors: finalErrors,
    firstMessage: messages[0] || ""
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
    } else if (!/^\d+$/.test(documentNumber)) {
      errors.documentNumber = "El documento debe contener solo números.";
    } else if (RegisterState.accountType === "persona" && documentType === "DNI" && documentNumber.length !== 8) {
      errors.documentNumber = "El DNI debe tener 8 dígitos.";
    } else if (RegisterState.accountType === "empresa" && documentNumber.length !== 11) {
      errors.documentNumber = "El RUC debe tener 11 dígitos.";
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
    } else if (password.length < 8) {
      errors.password = "La contraseña debe tener al menos 8 caracteres.";
    } else if (!/[A-Z]/.test(password)) {
      errors.password = "La contraseña debe incluir al menos una mayúscula.";
    } else if (!/[0-9]/.test(password)) {
      errors.password = "La contraseña debe incluir al menos un número.";
    } else if (!/[^A-Za-z0-9]/.test(password)) {
      errors.password = "La contraseña debe incluir al menos un símbolo.";
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
    if (errorElement) errorElement.textContent = value;
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

/* =========================================================
   ASISTENTE DE REGISTRO
========================================================= */

function bindAssistant() {
  $("#openAiDrawer")?.addEventListener("click", openAiDrawer);
  $("#openAssistantFromPanel")?.addEventListener("click", openAiDrawer);
  $("#closeAiDrawer")?.addEventListener("click", closeAiDrawer);
  $("#drawerBackdrop")?.addEventListener("click", closeAiDrawer);

  $("#aiForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("#aiInput");
    const prompt = input?.value.trim();

    if (!prompt) return;

    addAiMessage(prompt, "user");
    input.value = "";

    addAiMessage(generateAiResponse(prompt), "bot");
  });

  $all("[data-ai-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.aiPrompt || "";

      addAiMessage(prompt, "user");
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

function generateAiResponse(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("persona")) {
    setAccountType("persona");
    return "Activé el registro para Persona. Debes ingresar documento, nombres, contacto, servicio asociado y contraseña.";
  }

  if (text.includes("empresa")) {
    setAccountType("empresa");
    return "Activé el registro para Empresa. Debes ingresar RUC, razón social, representante, contacto y servicio empresarial asociado.";
  }

  if (text.includes("datos")) {
    return "Para crear tu cuenta necesitas documento, correo, celular, dirección, servicio asociado y contraseña.";
  }

  if (text.includes("contraseña")) {
    return "Usa una contraseña de mínimo 8 caracteres, con mayúscula, número y símbolo.";
  }

  if (text.includes("código") || text.includes("verificación")) {
    return "Después del registro, se enviará un código de verificación al correo registrado.";
  }

  return "Puedo ayudarte a elegir tipo de cuenta, revisar campos obligatorios o crear una contraseña segura.";
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