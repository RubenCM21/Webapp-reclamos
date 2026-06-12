"use strict";

/* =========================================================
   VERIFICACIÓN DE CUENTA — conectado al backend
========================================================= */

let verificationCountdown = 180;
let verificationInterval  = null;

// Obtener el correo de la sesión pendiente (guardado durante el registro)
const _correoVerificacion = (function () {
  try {
    const s = JSON.parse(localStorage.getItem("claro360-registro-pendiente") || "null");
    return s?.email || "";
  } catch { return ""; }
}());

document.addEventListener("DOMContentLoaded", () => {
  initVerificationPage();
});

function initVerificationPage() {
  bindVerificationInputs();
  bindVerificationForm();
  bindVerificationModals();
  bindResendCode();
  startVerificationTimer();

  const firstInput = document.querySelector(".verification-input");
  if (firstInput) setTimeout(() => firstInput.focus(), 250);
}

/* ── Helpers ───────────────────────────────────────────────────────────────*/

function $(selector, parent = document) { return parent.querySelector(selector); }
function $all(selector, parent = document) { return Array.from(parent.querySelectorAll(selector)); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function setText(selector, value) { const el = $(selector); if (el) el.textContent = value; }

/* ── Inputs de código ──────────────────────────────────────────────────────*/

function bindVerificationInputs() {
  const inputs = $all(".verification-input");
  inputs.forEach((input, i) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "");
      input.classList.toggle("filled", Boolean(input.value));
      if (input.value && inputs[i + 1]) inputs[i + 1].focus();
      setText("#verificationCodeError", "");
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !input.value && inputs[i - 1]) inputs[i - 1].focus();
      if (e.key === "ArrowLeft"  && inputs[i - 1]) inputs[i - 1].focus();
      if (e.key === "ArrowRight" && inputs[i + 1]) inputs[i + 1].focus();
    });
    input.addEventListener("paste", e => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, inputs.length);
      pasted.split("").forEach((char, j) => {
        if (inputs[j]) { inputs[j].value = char; inputs[j].classList.add("filled"); }
      });
      const next = Math.min(pasted.length, inputs.length - 1);
      if (inputs[next]) inputs[next].focus();
      setText("#verificationCodeError", "");
    });
  });
}

function getVerificationCode() {
  return $all(".verification-input").map(i => i.value).join("");
}

function clearVerificationCode() {
  $all(".verification-input").forEach(i => { i.value = ""; i.classList.remove("filled"); });
  const first = $(".verification-input");
  if (first) first.focus();
}

/* ── Formulario ─────────────────────────────────────────────────────────────*/

function bindVerificationForm() {
  const form = $("#verificationForm");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const code = getVerificationCode();
    setText("#verificationCodeError", "");

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
      // Llamada real al backend
      await Api.Auth.verificarCuenta({
        code: code,
        correo: _correoVerificacion || undefined,
      });

      // Éxito
      localStorage.removeItem("claro360-registro-pendiente");
      openModal("#verificationSuccessModal");

    } catch (err) {
      // Si el backend acepta 123456 en DEV, no llegará aquí
      setText("#verificationCodeError", err.message || "Código inválido o expirado.");
      openModal("#verificationErrorModal");
    } finally {
      setButtonLoading("#verifyAccountBtn", false);
    }
  });
}

function setButtonLoading(selector, value) {
  const btn = $(selector);
  if (!btn) return;
  btn.disabled = value;
  btn.classList.toggle("loading", value);
}

/* ── Reenviar código ────────────────────────────────────────────────────────*/

function bindResendCode() {
  $("#resendCodeBtn")?.addEventListener("click", async () => {
    try {
      await Api.Auth.reenviarCodigo({ correo: _correoVerificacion });
      showToast({ title: "Código reenviado", message: "Te enviamos un nuevo código.", type: "success" });
    } catch {
      showToast({ title: "Error", message: "No se pudo reenviar. Intenta de nuevo.", type: "danger" });
    }
    verificationCountdown = 180;
    startVerificationTimer();
    clearVerificationCode();
  });
}

/* ── Temporizador ───────────────────────────────────────────────────────────*/

function startVerificationTimer() {
  clearInterval(verificationInterval);
  updateVerificationTimer();
  verificationInterval = setInterval(() => {
    verificationCountdown -= 1;
    updateVerificationTimer();
    if (verificationCountdown <= 0) {
      clearInterval(verificationInterval);
      verificationCountdown = 0;
      updateVerificationTimer();
      setText("#verificationCodeError", "El código venció. Solicita uno nuevo.");
    }
  }, 1000);
}

function updateVerificationTimer() {
  const m = String(Math.floor(verificationCountdown / 60)).padStart(2, "0");
  const s = String(verificationCountdown % 60).padStart(2, "0");
  setText("#verificationTimer", `${m}:${s}`);
}

/* ── Modales ────────────────────────────────────────────────────────────────*/

function bindVerificationModals() {
  $all("[data-close-modal]").forEach(btn => btn.addEventListener("click", closeAllModals));
  $("#modalBackdrop")?.addEventListener("click", closeAllModals);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllModals(); });
}

function openModal(selector) {
  const modal = $(selector), backdrop = $("#modalBackdrop");
  if (!modal || !backdrop) return;
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
  backdrop.classList.add("show"); document.body.classList.add("modal-open");
}

function closeAllModals() {
  $all(".modal").forEach(m => { m.classList.remove("show"); m.setAttribute("aria-hidden", "true"); });
  $("#modalBackdrop")?.classList.remove("show");
  document.body.classList.remove("modal-open");
}

/* ── Toast ──────────────────────────────────────────────────────────────────*/

function showToast({ title, message, type = "info" }) {
  const box = $("#toastContainer");
  if (!box) return;
  const t = document.createElement("div");
  t.className = `toast toast--${type}`;
  t.innerHTML = `<span>${type === "success" ? "✓" : type === "danger" ? "×" : "ℹ"}</span><div><strong>${title}</strong><p>${message}</p></div>`;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 4200);
}
