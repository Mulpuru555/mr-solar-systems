import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allRequests = [];

const listEl = document.getElementById("managerServiceList");
const searchInput = document.getElementById("managerServiceSearchInput");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let cachedEmployees = [];

onSnapshot(collection(db, "users"), (snap) => {
  cachedEmployees = [];
  snap.forEach(d => {
    const u = d.data();
    const role = (u.role || "employee").toLowerCase();
    if (role !== "admin" && role !== "manager") {
      cachedEmployees.push({ uid: d.id, name: u.name || u.email || "Employee" });
    }
  });
  render();
});

function getTimestampMs(val) {
  if (!val) return 0;
  if (val.seconds) return val.seconds * 1000;
  if (typeof val === "string") return new Date(val).getTime() || 0;
  if (val.toDate && typeof val.toDate === "function") return val.toDate().getTime();
  return 0;
}

function render() {
  if (!listEl) return;

  const employees = cachedEmployees;
  const search = (searchInput?.value || "").toLowerCase();

  const filtered = allRequests.filter(r => {
    const cust = (r.customerName || r.name || "").toLowerCase();
    const st = (r.status || "Open").toLowerCase();
    const tech = (r.assignedTechnician?.name || "").toLowerCase();
    const issue = (r.issueDescription || r.description || r.serviceType || "").toLowerCase();
    if (!search) return true;
    return cust.includes(search) || st.includes(search) || tech.includes(search) || issue.includes(search);
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="erpTimelineEmpty">No service requests found.</div>`;
    return;
  }

  const employeeOptions = employees.map(e => `<option value="${e.uid}">${escapeHtml(e.name)}</option>`).join("");

  listEl.innerHTML = filtered.map(r => {
    const custName = r.customerName || r.name || "Customer";
    const phone = r.phone || r.mobile || "-";
    const issueDesc = r.issueDescription || r.description || r.serviceType || r.issue || "-";
    const status = r.status || "Open";
    const createdByLabel = r.createdByName || r.createdBy || "Staff";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");
    const notes = (r.internalNotes || []).map(n =>
      `<div style="font-size:11px;color:#8a97a6;margin-top:2px;">— ${escapeHtml(n.note)} (${escapeHtml(n.by)})</div>`
    ).join("");

    return `<div class="docItem" style="display:block;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <strong>${escapeHtml(custName)}</strong>
        <span class="statusPill ${statusClass}">${escapeHtml(status)}</span>
      </div>
      <div style="font-size:12px;color:#cfd8e3;margin-top:4px;">${escapeHtml(issueDesc)}</div>
      <div style="font-size:11px;color:#8a97a6;margin-top:4px;">
        Phone: ${escapeHtml(phone)} • Logged by ${escapeHtml(createdByLabel)}
      </div>
      ${notes}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        <select data-technician-for="${r.id}" style="width:auto;">
          <option value="">Unassigned</option>
          ${employeeOptions}
        </select>
        <select data-status-for="${r.id}" style="width:auto;">
          <option value="Open" ${status === "Open" ? "selected" : ""}>Open</option>
          <option value="In Progress" ${status === "In Progress" ? "selected" : ""}>In Progress</option>
          <option value="Resolved" ${status === "Resolved" ? "selected" : ""}>Resolved</option>
        </select>
        <input type="text" placeholder="Add internal note..." data-note-for="${r.id}" style="width:auto;flex:1;min-width:140px;">
        <button type="button" class="action" data-save-for="${r.id}">Save</button>
      </div>
    </div>`;
  }).join("");

  // Preselect the currently assigned technician
  filtered.forEach(r => {
    if (r.assignedTechnician?.uid) {
      const sel = listEl.querySelector(`select[data-technician-for="${r.id}"]`);
      if (sel) sel.value = r.assignedTechnician.uid;
    }
  });

  listEl.querySelectorAll("[data-save-for]").forEach(btn => {
    btn.addEventListener("click", () => saveRequest(btn.dataset.saveFor, employees));
  });
}

async function saveRequest(id, employees) {
  const techSelect = listEl.querySelector(`select[data-technician-for="${id}"]`);
  const statusSelect = listEl.querySelector(`select[data-status-for="${id}"]`);
  const noteInput = listEl.querySelector(`input[data-note-for="${id}"]`);

  const techUid = techSelect?.value || "";
  const newStatus = statusSelect?.value || "Open";
  const noteText = noteInput?.value.trim();

  const updates = { status: newStatus };

  const tech = employees.find(e => e.uid === techUid);
  updates.assignedTechnician = tech ? { uid: tech.uid, name: tech.name } : null;

  try {
    if (noteText) {
      const current = await getDoc(doc(db, "serviceRequests", id));
      const existingNotes = current.exists() ? (current.data().internalNotes || []) : [];
      updates.internalNotes = [...existingNotes, { note: noteText, by: "Manager", at: new Date().toISOString() }];
    }

    await updateDoc(doc(db, "serviceRequests", id), updates);
    logActivity("Updated service request", `id=${id}, status=${newStatus}, technician=${updates.assignedTechnician?.name || "none"}`);
  } catch (err) {
    alert("Failed to update: " + err.message);
  }
}

if (listEl) {
  try {
    onSnapshot(collection(db, "serviceRequests"), (snap) => {
      allRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allRequests.sort((a, b) => {
        return getTimestampMs(b.createdAt || b.timestamp) - getTimestampMs(a.createdAt || a.timestamp);
      });
      render();
    }, (err) => {
      console.error("serviceRequests listener error:", err);
      listEl.innerHTML = `<div class="erpTimelineEmpty">Could not load service requests.</div>`;
    });
  } catch (err) {
    listEl.innerHTML = `<div class="erpTimelineEmpty">Could not load service requests.</div>`;
  }
}

if (searchInput) {
  searchInput.addEventListener("input", render);
}
