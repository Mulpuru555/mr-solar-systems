import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function logLoginHistory(uid, email, role) {
  // Fire-and-forget — login history is a nice-to-have audit trail,
  // never something that should block or fail a login attempt.
  addDoc(collection(db, "loginHistory"), {
    uid,
    email,
    role,
    userAgent: navigator.userAgent,
    timestamp: serverTimestamp()
  }).catch(() => {});
}


// ==============================
// UI HELPERS (login page only — safe no-ops elsewhere)
// ==============================

function showLoginMessage(msg, type) {
  const box = document.getElementById("loginMessage");
  if (!box) {
    // No message box on this page (admin/employee/manager pages) —
    // preserve original behavior exactly.
    if (msg) alert(msg);
    return;
  }
  box.textContent = msg;
  box.className = "mrs-login-msg" + (type ? " mrs-msg-" + type : "");
  const card = box.closest(".mrs-login-card");
  if (card && type === "error") {
    card.classList.remove("mrs-anim-shake");
    void card.offsetWidth; // restart animation
    card.classList.add("mrs-anim-shake");
  }
}

function setLoginLoading(isLoading) {
  const btn = document.getElementById("loginBtn");
  const label = document.getElementById("loginBtnLabel");
  if (!btn || !label) return;
  btn.disabled = isLoading;
  label.innerHTML = isLoading
    ? '<span class="mrs-spinner"></span> Signing in…'
    : "Login";
}

// ==============================
// LOGIN FUNCTION
// ==============================

window.loginUser = async function () {

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showLoginMessage("Please enter email and password", "error");
    return;
  }

  setLoginLoading(true);

  try {

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      showLoginMessage("User role not found.", "error");
      await signOut(auth);
      setLoginLoading(false);
      return;
    }

    const userData = docSnap.data();
    const role = userData.role;
    const branch = userData.branch || "";
    const accountStatus = userData.accountStatus || "active";

    // 🔴 Block check (employees only)
    if (role === "employee" && accountStatus === "blocked") {
      showLoginMessage("Your account is blocked due to absence. Contact Admin.", "error");
      await signOut(auth);
      setLoginLoading(false);
      return;
    }

    showLoginMessage("Login successful. Redirecting…", "success");
    logLoginHistory(user.uid, user.email, role);

    // ======================
    // REDIRECT LOGIC
    // ======================

    if (role === "admin") {

      window.location.href = "/pages/admin.html";

    }

    else if (role === "manager") {

      window.location.href = "/pages/manager.html";

    }

    else if (role === "employee") {

      // ✅ NEW: branch check added

      if (branch === "chirala") {

        window.location.href = "/pages/chirala-attendance.html";

      } else {

        window.location.href = "/pages/employee.html";

      }

    }

    else {

      showLoginMessage("Invalid role", "error");
      await signOut(auth);
      setLoginLoading(false);

    }

  } catch (error) {
    showLoginMessage(error.message, "error");
    setLoginLoading(false);
  }
};


// ==============================
// FORGOT PASSWORD
// ==============================

window.resetPassword = async function () {

  const email = document.getElementById("loginEmail").value;

  if (!email) {
    showLoginMessage("Enter your email first.", "error");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showLoginMessage("Password reset email sent!", "success");
  } catch (error) {
    showLoginMessage(error.message, "error");
  }
};


// ==============================
// LOGOUT
// ==============================

window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "/index.html";
};


// ==============================
// SESSION CHECK (ROLE + BLOCK PROTECTION)
// ==============================

export function checkSession(requiredRole) {

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "/index.html";
      return;
    }

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await signOut(auth);
      window.location.href = "/index.html";
      return;
    }

    const userData = docSnap.data();
    const role = userData.role;
    const accountStatus = userData.accountStatus || "active";

    // 🔴 Block employees only
    if (role === "employee" && accountStatus === "blocked") {
      alert("Your account is blocked. Contact Admin.");
      await signOut(auth);
      window.location.href = "/index.html";
      return;
    }

    if (role !== requiredRole) {
      window.location.href = "/index.html";
    }

  });

}
