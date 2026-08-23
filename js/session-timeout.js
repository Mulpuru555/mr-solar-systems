import { auth } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WARNING_MS = 2 * 60 * 1000;  // warn 2 minutes before logging out

let timeoutTimer = null;
let warningTimer = null;
let isLoggedIn = false;

function clearTimers() {
  if (timeoutTimer) clearTimeout(timeoutTimer);
  if (warningTimer) clearTimeout(warningTimer);
}

function showWarning() {
  const existing = document.getElementById("sessionTimeoutWarning");
  if (existing) return;

  const box = document.createElement("div");
  box.id = "sessionTimeoutWarning";
  box.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    background: #1a1a1a; border: 1px solid #ff8c00; color: white;
    padding: 14px 18px; border-radius: 10px; font-family: 'Montserrat', sans-serif;
    font-size: 13px; max-width: 260px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  `;
  box.innerHTML = `You've been inactive. You'll be logged out soon for security — move your mouse or click anywhere to stay signed in.`;
  document.body.appendChild(box);
}

function hideWarning() {
  document.getElementById("sessionTimeoutWarning")?.remove();
}

function resetTimers() {
  if (!isLoggedIn) return;

  clearTimers();
  hideWarning();

  warningTimer = setTimeout(showWarning, TIMEOUT_MS - WARNING_MS);
  timeoutTimer = setTimeout(async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.href = "/index.html";
    }
  }, TIMEOUT_MS);
}

["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(evt => {
  document.addEventListener(evt, resetTimers, { passive: true });
});

onAuthStateChanged(auth, (user) => {
  isLoggedIn = !!user;
  if (isLoggedIn) {
    resetTimers();
  } else {
    clearTimers();
    hideWarning();
  }
});
