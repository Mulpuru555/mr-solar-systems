import { auth, db, storage } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

let uid = "";
let unsubscribe = null;

function initials(name) {
  if (!name) return "MR";
  const parts = name.trim().split(/\s+/);
  const chars = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || "");
  return chars.join("") || "MR";
}

function placeholderAvatar(name) {
  const label = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="108">
    <rect width="108" height="108" fill="#1a2332"/>
    <text x="50%" y="50%" fill="#ff9800" font-family="Montserrat,sans-serif"
      font-size="36" font-weight="700" text-anchor="middle" dominant-baseline="central">${label}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

function fmtDate(value) {
  if (!value) return "Not set by admin yet";
  if (typeof value === "string") return value;
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  }
  if (value.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  }
  return String(value);
}

onAuthStateChanged(auth, (user) => {

  if (!user) {
    if (unsubscribe) unsubscribe();
    location.href = "/index.html";
    return;
  }

  uid = user.uid;

  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(doc(db, "users", uid), (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    const name = data.name || "Employee";
    const role = data.role || "employee";
    const branch = data.branch || "Not set by admin yet";
    const department = data.department || "";
    const designation = data.designation || "";
    const joiningDate = data.joiningDate || null;
    const accountStatus = data.accountStatus || "active";
    const employeeCode = data.employeeCode || ("MRS-" + uid.slice(0, 6).toUpperCase());

    // ID card
    const idName = document.getElementById("idName");
    const idRole = document.getElementById("idRole");
    const idCode = document.getElementById("idCode");
    const idBranch = document.getElementById("idBranch");
    const idDept = document.getElementById("idDept");
    const idDesignation = document.getElementById("idDesignation");
    const photoEl = document.getElementById("profilePhoto");

    if (idName) idName.textContent = name;
    if (idRole) idRole.textContent = role;
    if (idCode) idCode.textContent = employeeCode;
    if (idBranch) idBranch.textContent = branch || "—";
    if (idDept) idDept.textContent = department || "—";
    if (idDesignation) idDesignation.textContent = designation || "—";
    if (photoEl) photoEl.src = data.photoURL || placeholderAvatar(name);

    // Account details
    const detName = document.getElementById("detName");
    const detEmail = document.getElementById("detEmail");
    const detRole = document.getElementById("detRole");
    const detBranch = document.getElementById("detBranch");
    const statusEl = document.getElementById("detStatus");

    if (detName) detName.textContent = name;
    if (detEmail) detEmail.textContent = user.email || "—";
    if (detRole) detRole.textContent = role;
    if (detBranch) detBranch.textContent = branch;

    if (statusEl) {
      statusEl.textContent = accountStatus;
      statusEl.className = accountStatus === "blocked" ? "mrs-dt-value mrs-badge-blocked" : "mrs-dt-value mrs-badge-active";
    }

    // Employment details
    const detDept = document.getElementById("detDept");
    const detDesignation = document.getElementById("detDesignation");
    const detJoining = document.getElementById("detJoining");

    if (detDept) detDept.textContent = department || "Not set by admin yet";
    if (detDesignation) detDesignation.textContent = designation || "Not set by admin yet";
    if (detJoining) detJoining.textContent = fmtDate(joiningDate);
  });

});

/* ===========================
   PHOTO UPLOAD (self-service)
=========================== */

function fileToDataUrl(file, maxWidth = 300, maxHeight = 300) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const uploadBtn = document.getElementById("photoUploadBtn");
const fileInput = document.getElementById("profilePhotoInput");
const statusBox = document.getElementById("photoUploadStatus");

if (uploadBtn && fileInput) {

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {

    const file = fileInput.files[0];
    if (!file || !uid) return;

    if (!file.type.startsWith("image/")) {
      if (statusBox) statusBox.textContent = "Please choose an image file.";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (statusBox) statusBox.textContent = "Image must be under 5MB.";
      return;
    }

    if (statusBox) statusBox.textContent = "Uploading…";

    let url = "";

    // 1. Try Firebase Storage
    try {
      const fileRef = ref(storage, `profilePhotos/${uid}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
      await uploadBytes(fileRef, file, { contentType: file.type });
      url = await getDownloadURL(fileRef);
    } catch (storageErr) {
      console.warn("Firebase Storage upload failed, falling back to DataURL:", storageErr);
      try {
        url = await fileToDataUrl(file);
      } catch (dataErr) {
        if (statusBox) statusBox.textContent = "Upload failed: " + dataErr.message;
        return;
      }
    }

    // 2. Update Firestore with setDoc merge
    try {
      await setDoc(doc(db, "users", uid), { photoURL: url }, { merge: true });

      const photoEl = document.getElementById("profilePhoto");
      if (photoEl) photoEl.src = url;
      if (statusBox) statusBox.textContent = "Photo updated.";
    } catch (err) {
      if (statusBox) statusBox.textContent = "Database update failed: " + err.message;
    }
  });
}

/* Print ID card */
window.printIdCard = () => window.print();
