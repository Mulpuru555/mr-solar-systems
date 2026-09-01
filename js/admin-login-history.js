import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allLogins = [];

const tableEl = document.getElementById("loginHistoryTable");
const searchInput = document.getElementById("loginHistorySearchInput");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortenUserAgent(ua) {
  if (!ua) return "-";
  // Just surface browser + OS hints rather than the full raw string.
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os = /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return [browser, os].filter(Boolean).join(" • ");
}

async function loadLoginHistory() {
  if (!tableEl) return;

  try {
    const q = query(collection(db, "loginHistory"), orderBy("timestamp", "desc"), limit(200));
    const snap = await getDocs(q);
    allLogins = snap.docs.map(d => d.data());
    render();
  } catch (err) {
    tableEl.innerHTML = `<tr><td colspan="4">No login history yet.</td></tr>`;
  }
}

function render() {
  const search = (searchInput?.value || "").toLowerCase();
  const filtered = allLogins.filter(l => {
    if (!search) return true;
    return (l.email || "").toLowerCase().includes(search) || (l.role || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tableEl.innerHTML = `<tr><td colspan="4">No matching logins.</td></tr>`;
    return;
  }

  tableEl.innerHTML = filtered.map(l => {
    const when = l.timestamp?.seconds
      ? new Date(l.timestamp.seconds * 1000).toLocaleString("en-IN")
      : "-";
    return `<tr>
      <td>${escapeHtml(l.email || "-")}</td>
      <td>${escapeHtml(l.role || "-")}</td>
      <td>${escapeHtml(shortenUserAgent(l.userAgent))}</td>
      <td>${when}</td>
    </tr>`;
  }).join("");
}

if (searchInput) searchInput.addEventListener("input", render);

loadLoginHistory();
