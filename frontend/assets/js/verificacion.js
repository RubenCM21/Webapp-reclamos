"use strict";

/* =========================================================
   CLARO ATENCIÓN 360 - VERIFICACIÓN DE CUENTA
   Integrado con backend FastAPI + SQL Server
========================================================= */

const API_BASE_URL = "http://127.0.0.1:8000/api";

let verificationCountdown = 180;
let verificationInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initVerificationPage();
});

function initVerificationPage() {
  loadPendingVerificationData();
  bindVerificationInputs();
  bindVerificationForm();
  bindVerificationModals();
  bindResendCode();
  startVerificationTimer();

  const firstInput = $(".verification-input");
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 250);
  }
}

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

function loadPendingVerificationData() {
  const params = new URLSearchParams(window.location.search);

  const email =
    sessionStorage.getItem("pendingVerificationEmail") ||
    params.get("email") ||
    "";

  const purpose =
    sessionStorage.getItem("pendingVerificationPurpose") ||
    params.get("purpose") ||
    "REGISTRO";

  const emailInput = $("#verificationEmail");
  const purposeInput = $("#verificationPurpose");

  if (emailInput) emailInput.value = email;
  if (purposeInput) purposeInput.value = purpose;

  if (!email) {
    showToast({
      title: "Verificación no disponible",
      message: "No se encontró una cuenta pendiente de verificación.",
      type: "warning"
    });
  }
}

function bindVerificationInputs() {
  const inputs = $all(".verification-input");

  inputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      input.classList.toggle("filled", Boolean(input.value));

      if (input.value && inputs[index + 1]) {
        inputs[index + 1].focus();
      }

      setText("#verificationCodeError", "");
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && inputs[index - 1]) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowLeft" && inputs[index - 1]) {
        inputs[index - 1].focus();
      }

      if (event.key === "ArrowRight" && inputs[index + 1]) {
        inputs[index + 1].focus();
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
          inputs[pasteIndex].classList.add("filled");
        }
      });

      const nextIndex = Math.min(pasted.length, inputs.length - 1);

      if (inputs[nextIndex]) {
        inputs[nextIndex].focus();
      }

      setText("#verificationCodeError", "");
    });
  });
}

function getVerificationCode() {
  return $all(".verification-input")
    .map((input) => input.value)
    .join("");
}

function clearVerificationCode() {
  $all(".verification-input").forEach((input) => {
    input.value = "";
    input.classList.remove("filled");
  });

  $(".verification-input")?.focus();
}

function bindVerificationForm() {
  const form = $("#verificationForm");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const code = getVerificationCode();
    const email = $("#verificationEmail")?.value.trim();
    const purpose = $("#verificationPurpose")?.value.trim() || "REGISTRO";

    setText("#verificationCodeError", "");

    if (!email) {
      setText("#verificationCodeError", "No se encontró el correo pendiente de verificación.");
      return;
    }

    if (verificationCountdown <= 0) {
      setText("#verificationCodeError", "El código venció. Solicita uno nuevo.");
      return;
    }

    if (code.length !== 6) {
      setText("#verificationCodeError", "Ingresa el código completo de 6 dígitos.");
      return;
    }

    setButtonLoading("#verifyAccountBtn", true);

    try {
      const result = await apiRequest("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email,
          purpose,
          code
        })
      });

      if (!result.ok) {
        throw new Error(result.message || "No se pudo verificar la cuenta.");
      }

      sessionStorage.removeItem("pendingVerificationEmail");
      sessionStorage.removeItem("pendingVerificationPurpose");

      openModal("#verificationSuccessModal");
    } catch (error) {
      setText("#verificationCodeError", error.message);
      openModal("#verificationErrorModal");
    } finally {
      setButtonLoading("#verifyAccountBtn", false);
    }
  });
}

function setButtonLoading(selector, value) {
  const button = $(selector);

  if (!button) return;

  button.disabled = value;
  button.classList.toggle("loading", value);
}

function bindResendCode() {
  $("#resendCodeBtn")?.addEventListener("click", () => {
    resendVerificationCode();
  });
}

async function resendVerificationCode() {
  const email = $("#verificationEmail")?.value.trim();
  const purpose = $("#verificationPurpose")?.value.trim() || "REGISTRO";

  if (!email) {
    showToast({
      title: "Correo no encontrado",
      message: "No se pudo identificar la cuenta pendiente de verificación.",
      type: "warning"
    });
    return;
  }

  try {
    await apiRequest("/auth/resend-verification-code", {
      method: "POST",
      body: JSON.stringify({
        email,
        purpose
      })
    });

    verificationCountdown = 180;
    startVerificationTimer();
    clearVerificationCode();

    showToast({
      title: "Código reenviado",
      message: "Te enviamos un nuevo código de verificación.",
      type: "success"
    });
  } catch (error) {
    showToast({
      title: "No se pudo reenviar el código",
      message: error.message,
      type: "danger"
    });
  }
}

function startVerificationTimer() {
  clearInterval(verificationInterval);

  updateVerificationTimer();

  verificationInterval = setInterval(() => {
    verificationCountdown -= 1;

    if (verificationCountdown <= 0) {
      verificationCountdown = 0;
      clearInterval(verificationInterval);
      setText("#verificationCodeError", "El código venció. Solicita uno nuevo.");
    }

    updateVerificationTimer();
  }, 1000);
}

function updateVerificationTimer() {
  const minutes = String(Math.floor(verificationCountdown / 60)).padStart(2, "0");
  const seconds = String(verificationCountdown % 60).padStart(2, "0");

  setText("#verificationTimer", `${minutes}:${seconds}`);
}

function bindVerificationModals() {
  $all("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeAllModals);
  });

  $("#modalBackdrop")?.addEventListener("click", closeAllModals);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
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

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 4200);
}