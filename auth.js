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


// ==============================
// LOGIN FUNCTION
// ==============================

window.loginUser = async function () {

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  try {

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("User role not found.");
      await signOut(auth);
      return;
    }

    const userData = docSnap.data();
    const role = userData.role;
    const accountStatus = userData.accountStatus || "active";

    // 🔴 Block check (employees only)
    if (role === "employee" && accountStatus === "blocked") {
      alert("Your account is blocked due to absence. Contact Admin.");
      await signOut(auth);
      return;
    }

    if (role === "admin") window.location.href = "admin.html";
    else if (role === "manager") window.location.href = "manager.html";
    else if (role === "employee") window.location.href = "employee.html";
    else {
      alert("Invalid role");
      await signOut(auth);
    }

  } catch (error) {
    alert(error.message);
  }
};


// ==============================
// FORGOT PASSWORD
// ==============================

window.resetPassword = async function () {

  const email = document.getElementById("loginEmail").value;

  if (!email) {
    alert("Enter your email first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    alert("Password reset email sent!");
  } catch (error) {
    alert(error.message);
  }
};


// ==============================
// LOGOUT
// ==============================

window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};


// ==============================
// SESSION CHECK (ROLE + BLOCK PROTECTION)
// ==============================

export function checkSession(requiredRole) {

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    const userData = docSnap.data();
    const role = userData.role;
    const accountStatus = userData.accountStatus || "active";

    // 🔴 Block employees only
    if (role === "employee" && accountStatus === "blocked") {
      alert("Your account is blocked. Contact Admin.");
      await signOut(auth);
      window.location.href = "index.html";
      return;
    }

    if (role !== requiredRole) {
      window.location.href = "index.html";
    }

  });

}
