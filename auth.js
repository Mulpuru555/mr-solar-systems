import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= GLOBAL FUNCTIONS (WINDOW) ================= */
window.loginUser = async function() {
  const email = document.getElementById("loginEmail")?.value?.trim();
  const password = document.getElementById("loginPassword")?.value;

  if (!email || !password) {
    alert("⚠️ Enter Email & Password");
    return;
  }

  // 🔥 AI LOADER ANIMATION
  const modal = document.getElementById("loginModal");
  const loader = document.getElementById("aiLoader");
  const statusText = document.getElementById("aiStatus");

  if (loader) {
    modal.style.display = "none";
    loader.style.display = "flex";
  }

  const steps = [
    "🔍 Scanning credentials...",
    "🔗 Connecting to secure server...",
    "✅ Verifying identity...",
    "🔐 Checking access level...",
    "🎉 Login successful!"
  ];

  let i = 0;
  let interval;

  if (statusText) {
    interval = setInterval(() => {
      statusText.innerText = steps[i];
      i++;
      if (i >= steps.length) {
        clearInterval(interval);
      }
    }, 600);
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    
    // SUCCESS - Stay on loader for 2.5s then redirect
    setTimeout(() => {
      if (loader) loader.style.display = "none";
      window.location.href = "employee.html";
    }, 2500);

  } catch (err) {
    console.error("Login error:", err);
    
    // HIDE LOADER + SHOW ERROR
    if (loader) {
      loader.style.display = "none";
      modal.style.display = "flex";
    }
    
    if (interval) clearInterval(interval);
    
    // User-friendly error messages
    let errorMsg = "Login Failed";
    if (err.code === 'auth/user-not-found') errorMsg = "❌ User not found";
    else if (err.code === 'auth/wrong-password') errorMsg = "❌ Wrong password";
    else if (err.code === 'auth/invalid-email') errorMsg = "❌ Invalid email";
    else errorMsg += ": " + err.message;
    
    alert(errorMsg);
    
    // Reset status text
    if (statusText) statusText.innerText = "Login Failed";
  }
};

/* ================= RESET PASSWORD ================= */
window.resetPassword = async function() {
  const email = document.getElementById("loginEmail")?.value?.trim();
  
  if (!email) {
    alert("⚠️ Enter email first");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("✅ Password reset link sent to " + email);
  } catch (err) {
    console.error("Reset error:", err);
    alert("❌ Error: " + err.message);
  }
};

/* ================= CLOSE LOGIN ================= */
window.closeLogin = function() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "none";
    // Clear inputs
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";
  }
};

/* ================= OPEN LOGIN (NEW) ================= */
window.openLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "flex";
  }
};

/* ================= DOM READY - AUTO CONNECT BUTTON ================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ auth.js loaded - DOM ready");
  
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    console.log("✅ Login button connected");
    // Double connection (onclick + event listener)
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loginUser();
    });
  } else {
    console.warn("⚠️ Login button NOT found");
  }

  // Enter key support
  document.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && document.getElementById("loginModal").style.display === "flex") {
      loginUser();
    }
  });
});

// Export for global use
window.auth = auth;
