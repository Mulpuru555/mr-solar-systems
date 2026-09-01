import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allLogs = [];

const auditTable = document.getElementById("auditTable");
const auditSearchInput = document.getElementById("auditSearchInput");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadAuditLogs() {
  if (!auditTable) return;

  try {
    const q = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(200));
    const snap = await getDocs(q);

    allLogs = [];
    snap.forEach(d => allLogs.push({ id: d.id, ...d.data() }));

    renderAuditLogs();
  } catch (err) {
    auditTable.innerHTML = `<tr><td colspan="4">No audit logs yet.</td></tr>`;
  }
}

function renderAuditLogs() {
  const search = (auditSearchInput?.value || "").toLowerCase();

  const filtered = allLogs.filter(l => {
    if (!search) return true;
    return (l.action || "").toLowerCase().includes(search) ||
           (l.performedByEmail || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    auditTable.innerHTML = `<tr><td colspan="4">No matching audit logs.</td></tr>`;
    return;
  }

  auditTable.innerHTML = filtered.map(l => {
    const when = l.timestamp?.seconds
      ? new Date(l.timestamp.seconds * 1000).toLocaleString("en-IN")
      : "-";
    return `<tr>
      <td>${escapeHtml(l.action || "-")}</td>
      <td>${escapeHtml(l.details || "-")}</td>
      <td>${escapeHtml(l.performedByEmail || "-")}</td>
      <td>${when}</td>
    </tr>`;
  }).join("");
}

if (auditSearchInput) {
  auditSearchInput.addEventListener("input", renderAuditLogs);
}

loadAuditLogs();
