import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let uid = "";
let userName = "Employee";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) userName = snap.data().name || "Employee";
  } catch (err) {
    // keep default
  }

  loadMyRequests();
});

/* ---------- Submit new request ---------- */

const form = document.getElementById("serviceRequestForm");
const statusBox = document.getElementById("serviceFormStatus");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const customerName = document.getElementById("serviceCustomerName").value.trim();
    const phone = document.getElementById("serviceCustomerPhone").value.trim();
    const issueDescription = document.getElementById("serviceIssueDescription").value.trim();

    if (!customerName || !phone || !issueDescription) {
      statusBox.textContent = "Please fill in all fields.";
      return;
    }

    statusBox.textContent = "Submitting…";

    try {
      await addDoc(collection(db, "serviceRequests"), {
        customerName,
        phone,
        issueDescription,
        status: "Open",
        assignedTechnician: null,
        internalNotes: [],
        createdBy: uid,
        createdByName: userName,
        createdAt: serverTimestamp()
      });

      statusBox.textContent = "Service request submitted.";
      form.reset();
      loadMyRequests();
    } catch (err) {
      statusBox.textContent = "Failed to submit: " + err.message;
    }
  });
}

/* ---------- My requests (created by me OR assigned to me) ---------- */

let unsubscribeRequests = null;

function loadMyRequests() {
  const listEl = document.getElementById("myServiceRequestsList");
  if (!listEl || !uid) return;

  listEl.innerHTML = "Loading…";

  if (unsubscribeRequests) unsubscribeRequests();

  try {
    unsubscribeRequests = onSnapshot(collection(db, "serviceRequests"), (snap) => {
      const requests = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.createdBy === uid || data.assignedTechnician?.uid === uid) {
          requests.push({ id: d.id, ...data });
        }
      });

      requests.sort((a, b) => {
        const tA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });

      if (requests.length === 0) {
        listEl.innerHTML = `<div class="docEmpty">No service requests yet.</div>`;
        return;
      }

      listEl.innerHTML = requests.map(r => {
        const custName = r.customerName || r.name || "Customer";
        const phone = r.phone || r.mobile || "-";
        const issueDesc = r.issueDescription || r.description || r.serviceType || r.issue || "-";
        const status = r.status || "Open";
        const statusClass = status.toLowerCase().replace(/\s+/g, "-");
        const isAssignedToMe = r.assignedTechnician?.uid === uid;
        const notes = (r.internalNotes || []).map(n =>
          `<div style="font-size:11px;color:#8a97a6;margin-top:2px;">— ${escapeHtml(n.note)} (${escapeHtml(n.by)})</div>`
        ).join("");

        return `<div class="docItem" style="display:block;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <strong>${escapeHtml(custName)}</strong>
            <span class="statusPill ${statusClass}">${escapeHtml(status)}</span>
          </div>
          <div style="font-size:12px;color:#cfd8e3;margin-top:4px;">${escapeHtml(issueDesc)}</div>
          <div style="font-size:11px;color:#8a97a6;margin-top:4px;">Phone: ${escapeHtml(phone)}</div>
          ${r.assignedTechnician ? `<div style="font-size:11px;color:#8a97a6;">Assigned to: ${escapeHtml(r.assignedTechnician.name)}</div>` : ""}
          ${notes}
          ${isAssignedToMe ? `
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
              <select data-status-for="${r.id}" style="width:auto;">
                <option value="Open" ${status === "Open" ? "selected" : ""}>Open</option>
                <option value="In Progress" ${status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option value="Resolved" ${status === "Resolved" ? "selected" : ""}>Resolved</option>
              </select>
              <input type="text" placeholder="Add a note..." data-note-for="${r.id}" style="width:auto;flex:1;min-width:140px;">
              <button type="button" class="leaveSubmitBtn" data-save-for="${r.id}">Update</button>
            </div>
          ` : ""}
        </div>`;
      }).join("");

      listEl.querySelectorAll("[data-save-for]").forEach(btn => {
        btn.addEventListener("click", () => updateAssignedRequest(btn.dataset.saveFor));
      });
    }, (err) => {
      listEl.innerHTML = `<div class="docEmpty">Could not load service requests.</div>`;
    });
  } catch (err) {
    listEl.innerHTML = `<div class="docEmpty">Could not load service requests.</div>`;
  }
}

async function updateAssignedRequest(id) {
  const statusSelect = document.querySelector(`select[data-status-for="${id}"]`);
  const noteInput = document.querySelector(`input[data-note-for="${id}"]`);

  const newStatus = statusSelect?.value;
  const noteText = noteInput?.value.trim();

  const updates = { status: newStatus };

  try {
    if (noteText) {
      // Read-modify-write on the notes array (small array, fine at this scale)
      const current = await getDoc(doc(db, "serviceRequests", id));
      const existingNotes = current.exists() ? (current.data().internalNotes || []) : [];
      updates.internalNotes = [...existingNotes, { note: noteText, by: userName, at: new Date().toISOString() }];
    }

    await updateDoc(doc(db, "serviceRequests", id), updates);
    if (noteInput) noteInput.value = "";
    loadMyRequests();
  } catch (err) {
    alert("Failed to update: " + err.message);
  }
}
