import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allLeaves = [];

const tableBody = document.getElementById("adminLeaveTable");
const searchInput = document.getElementById("leaveSearchInput");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadLeaves() {
  if (!tableBody) return;

  try {
    const snap = await getDocs(query(collection(db, "leaveRequests"), orderBy("createdAt", "desc")));
    allLeaves = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7">Could not load leave requests.</td></tr>`;
  }
}

function render() {
  const search = (searchInput?.value || "").toLowerCase();
  const filtered = allLeaves.filter(r => {
    if (!search) return true;
    return (r.employeeName || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7">No leave requests found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered.map(r => {
    const status = (r.status || "pending").toLowerCase();
    const actionCell = status === "pending"
      ? `<button class="action" data-approve="${r.id}" style="background:#22c55e;">Approve</button>
         <button class="action" data-reject="${r.id}" style="background:#ef4444;">Reject</button>`
      : `<span style="color:#8a97a6;font-size:12px;">Decided</span>`;

    return `<tr>
      <td>${escapeHtml(r.employeeName || "-")}</td>
      <td>${escapeHtml(r.type || "-")}</td>
      <td>${escapeHtml(r.fromDate || "-")}</td>
      <td>${escapeHtml(r.toDate || "-")}</td>
      <td>${escapeHtml(r.reason || "-")}</td>
      <td><span class="statusPill ${status}">${escapeHtml(status)}</span></td>
      <td>${actionCell}</td>
    </tr>`;
  }).join("");

  tableBody.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => decideLeave(btn.dataset.approve, "approved"));
  });
  tableBody.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => decideLeave(btn.dataset.reject, "rejected"));
  });
}

async function decideLeave(id, decision) {
  if (!confirm(`Mark this leave request as ${decision}?`)) return;

  try {
    await updateDoc(doc(db, "leaveRequests", id), { status: decision });
    logActivity(decision === "approved" ? "Approved leave request" : "Rejected leave request", `id=${id}`);
    loadLeaves();
  } catch (err) {
    alert("Failed to update request: " + err.message);
  }
}

if (searchInput) searchInput.addEventListener("input", render);

loadLeaves();
