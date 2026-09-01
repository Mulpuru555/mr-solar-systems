// ==============================================
// Login page UI helpers only — no auth/business logic here.
// All real authentication happens in auth.js (untouched).
// ==============================================

const REMEMBER_KEY = "mrs_remembered_email";

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const toggleBtn = document.getElementById("togglePasswordBtn");
  const rememberBox = document.getElementById("rememberMe");

  // Prefill remembered email
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (remembered && emailInput) {
    emailInput.value = remembered;
    if (rememberBox) rememberBox.checked = true;
  }

  // Show/hide password
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = passInput.type === "password";
      passInput.type = isHidden ? "text" : "password";
      toggleBtn.textContent = isHidden ? "Hide" : "Show";
    });
  }

  // Save/clear remembered email whenever the login button is used
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn && emailInput && rememberBox) {
    loginBtn.addEventListener("click", () => {
      if (rememberBox.checked && emailInput.value) {
        localStorage.setItem(REMEMBER_KEY, emailInput.value);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    });
  }

  // Enter key submits from either field
  [emailInput, passInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loginBtn?.click();
      }
    });
  });
});
