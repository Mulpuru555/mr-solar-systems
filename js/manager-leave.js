import { db } from "./firebase-config.js";

import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tableBody = document.getElementById("leaveApprovalTable");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTimestampMs(val) {
  if (!val) return 0;
  if (val.seconds) return val.seconds * 1000;
  if (typeof val === "string") return new Date(val).getTime() || 0;
  if (val.toDate && typeof val.toDate === "function") return val.toDate().getTime();
  return 0;
}

let usersMap = {};
let leavesList = [];

function renderLeaves() {
  if (!tableBody) return;

  if (leavesList.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a97a6;padding:16px;">No leave requests found.</td></tr>`;
    return;
  }

  const rows = leavesList.map(r => {
    const status = (r.status || "pending").toLowerCase();
    const empName = r.employeeName || usersMap[r.employeeId || r.userId]?.name || "Employee";
    return `<tr>
      <td>${escapeHtml(empName)}</td>
      <td>${escapeHtml(r.type || "-")}</td>
      <td>${escapeHtml(r.fromDate || "-")}</td>
      <td>${escapeHtml(r.toDate || "-")}</td>
      <td>${escapeHtml(r.reason || "-")}</td>
      <td><span class="statusPill ${status}">${escapeHtml(r.status || "Pending")}</span></td>
    </tr>`;
  });

  tableBody.innerHTML = rows.join("");
}

if (tableBody) {
  // Listen to users for name resolution
  onSnapshot(collection(db, "users"), (snap) => {
    usersMap = {};
    snap.forEach(d => {
      usersMap[d.id] = d.data();
    });
    renderLeaves();
  });

  // Listen to leave requests in real time
  onSnapshot(collection(db, "leaveRequests"), (snap) => {
    leavesList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    leavesList.sort((a, b) => {
      return getTimestampMs(b.createdAt || b.timestamp) - getTimestampMs(a.createdAt || a.timestamp);
    });
    renderLeaves();
  }, (err) => {
    console.error("manager-leave error:", err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a97a6;">Could not load leave requests.</td></tr>`;
  });
}
