import { auth, db, storage } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

let uid = "";

const fileInput = document.getElementById("documentInput");
const uploadBtn = document.getElementById("documentUploadBtn");
const statusBox = document.getElementById("documentUploadStatus");
const listEl = document.getElementById("documentList");

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  uid = user.uid;
  loadDocuments();
});

if (uploadBtn && fileInput) {
  uploadBtn.addEventListener("click", async () => {

    const file = fileInput.files[0];
    if (!file || !uid) {
      statusBox.textContent = "Choose a file first.";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      statusBox.textContent = "File must be under 5MB.";
      return;
    }

    statusBox.textContent = "Uploading…";

    try {
      const path = `employeeDocuments/${uid}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "documents", uid, "files"), {
        name: file.name,
        url,
        size: file.size,
        uploadedAt: serverTimestamp()
      });

      statusBox.textContent = "Uploaded.";
      fileInput.value = "";
      loadDocuments();
    } catch (err) {
      statusBox.textContent = "Upload failed: " + err.message;
    }
  });
}

async function loadDocuments() {
  if (!listEl) return;

  try {
    const q = query(collection(db, "documents", uid, "files"), orderBy("uploadedAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      listEl.innerHTML = `<div class="docEmpty">No documents uploaded yet.</div>`;
      return;
    }

    let html = "";
    snap.forEach(d => {
      const data = d.data();
      html += `<div class="docItem">
        <span>${escapeHtml(data.name || "Document")}</span>
        <a href="${data.url}" target="_blank" rel="noopener">View</a>
      </div>`;
    });

    listEl.innerHTML = html;
  } catch (err) {
    listEl.innerHTML = `<div class="docEmpty">Could not load documents.</div>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
