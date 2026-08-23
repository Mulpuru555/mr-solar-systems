import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allLeads = [];

const tableEl = document.getElementById("websiteLeadsTable");
const searchInput = document.getElementById("leadsSearchInput");
const typeFilter = document.getElementById("leadsTypeFilter");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  if (!tableEl) return;

  const search = (searchInput?.value || "").toLowerCase();
  const typeVal = typeFilter?.value || "";

  const filtered = allLeads.filter(l => {
    if (typeVal && l.type !== typeVal) return false;
    if (!search) return true;
    return (l.name || "").toLowerCase().includes(search) ||
           (l.mobile || "").includes(search) ||
           (l.location || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tableEl.innerHTML = `<tr><td colspan="7">No website leads yet.</td></tr>`;
    return;
  }

  tableEl.innerHTML = filtered.map(l => {
    const when = l.createdAt?.seconds
      ? new Date(l.createdAt.seconds * 1000).toLocaleString("en-IN")
      : "-";
    const status = l.status || "New";

    return `<tr>
      <td>${escapeHtml(l.name)}</td>
      <td><a href="tel:${escapeHtml(l.mobile)}" style="color:#ff8c00;">${escapeHtml(l.mobile)}</a></td>
      <td>${escapeHtml(l.location)}</td>
      <td>${escapeHtml(l.type)}</td>
      <td>${escapeHtml(l.serviceType || "-")}</td>
      <td>
        <select data-status-for="${l.id}" style="width:auto;">
          <option value="New" ${status === "New" ? "selected" : ""}>New</option>
          <option value="Contacted" ${status === "Contacted" ? "selected" : ""}>Contacted</option>
          <option value="Converted" ${status === "Converted" ? "selected" : ""}>Converted</option>
          <option value="Not Interested" ${status === "Not Interested" ? "selected" : ""}>Not Interested</option>
        </select>
      </td>
      <td>${when}</td>
    </tr>`;
  }).join("");

  tableEl.querySelectorAll("[data-status-for]").forEach(sel => {
    sel.addEventListener("change", () => updateStatus(sel.dataset.statusFor, sel.value));
  });
}

async function updateStatus(id, status) {
  try {
    await updateDoc(doc(db, "websiteLeads", id), { status });
    logActivity("Updated website lead status", `id=${id}, status=${status}`);
  } catch (err) {
    alert("Failed to update: " + err.message);
  }
}

if (tableEl) {
  const fallbackListener = () => {
    onSnapshot(collection(db, "websiteLeads"), (snap) => {
      allLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allLeads.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA;
      });
      render();
    }, (err) => {
      console.warn("Website leads fallback listener warning:", err);
      tableEl.innerHTML = `<tr><td colspan="7">No leads available.</td></tr>`;
    });
  };

  try {
    const q = query(collection(db, "websiteLeads"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
      allLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    }, () => {
      fallbackListener();
    });
  } catch (err) {
    fallbackListener();
  }
}

if (searchInput) searchInput.addEventListener("input", render);
if (typeFilter) typeFilter.addEventListener("change", render);
