import { db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let currentReport = null; // { title, columns, rows }

/* ==========================================================
   REPORT GENERATORS
   Each returns { title, columns: [...], rows: [[...], ...] }
========================================================== */

async function buildAttendanceReport() {
  const [usersSnap, attSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "attendance"))
  ]);

  const users = {};
  usersSnap.forEach(d => { users[d.id] = d.data(); });

  const counts = {};
  const lastMarked = {};
  attSnap.forEach(d => {
    const a = d.data();
    const uid = a.employeeId || a.userId;
    if (!uid) return;
    counts[uid] = (counts[uid] || 0) + 1;
    if (!lastMarked[uid] || (a.date || "") > lastMarked[uid]) lastMarked[uid] = a.date || "-";
  });

  const rows = Object.keys(counts).map(uid => [
    users[uid]?.name || uid,
    users[uid]?.branch || "-",
    counts[uid],
    lastMarked[uid] || "-"
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    title: "Attendance Report (all-time)",
    columns: ["Employee", "Branch", "Total Present Days", "Last Marked"],
    rows
  };
}

async function buildEmployeeReport() {
  const snap = await getDocs(collection(db, "users"));
  const rows = [];
  snap.forEach(d => {
    const u = d.data();
    rows.push([
      u.name || "-",
      u.role || "-",
      u.branch || "-",
      u.department || "-",
      u.designation || "-",
      u.joiningDate || "-",
      u.accountStatus || "active"
    ]);
  });
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    title: "Employee Report",
    columns: ["Name", "Role", "Branch", "Department", "Designation", "Joining Date", "Status"],
    rows
  };
}

async function buildBranchReport() {
  const [usersSnap, attSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "attendance"))
  ]);

  const branchEmployees = {};
  usersSnap.forEach(d => {
    const b = d.data().branch;
    if (b) branchEmployees[b] = (branchEmployees[b] || 0) + 1;
  });

  const branchAttendance = {};
  const uidToBranch = {};
  usersSnap.forEach(d => { uidToBranch[d.id] = d.data().branch; });
  attSnap.forEach(d => {
    const a = d.data();
    const b = a.branch || uidToBranch[a.employeeId || a.userId];
    if (b) branchAttendance[b] = (branchAttendance[b] || 0) + 1;
  });

  const rows = Object.keys(branchEmployees).map(b => [
    b,
    branchEmployees[b],
    branchAttendance[b] || 0
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    title: "Branch Report",
    columns: ["Branch", "Employees", "Total Attendance Marks"],
    rows
  };
}

async function buildRevenueReport() {
  const snap = await getDocs(collection(db, "customerPayments"));
  const rows = [];
  snap.forEach(d => {
    const c = d.data();
    const paid = (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    rows.push([
      c.customerName || "-",
      c.phone || "-",
      c.executiveName || "-",
      Number(c.totalAmount || 0),
      paid,
      Number(c.totalAmount || 0) - paid,
      c.status || "-"
    ]);
  });
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    title: "Revenue Report",
    columns: ["Customer", "Phone", "Executive", "Total", "Paid", "Balance", "Status"],
    rows
  };
}

async function buildPaymentReport() {
  const snap = await getDocs(collection(db, "customerPayments"));
  const rows = [];
  snap.forEach(d => {
    const c = d.data();
    (c.payments || []).forEach(p => {
      rows.push([c.customerName || "-", p.date || "-", Number(p.amount) || 0]);
    });
  });
  rows.sort((a, b) => String(b[1]).localeCompare(String(a[1])));

  return {
    title: "Payment Report (every transaction)",
    columns: ["Customer", "Payment Date", "Amount"],
    rows
  };
}

async function buildServiceReport() {
  const snap = await getDocs(collection(db, "serviceRequests"));
  const rows = [];
  snap.forEach(d => {
    const r = d.data();
    rows.push([
      r.customerName || "-",
      r.status || "-",
      r.assignedTechnician?.name || "Unassigned",
      r.createdByName || "-",
      r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "-"
    ]);
  });

  return {
    title: "Service Report",
    columns: ["Customer", "Status", "Technician", "Logged By", "Date"],
    rows
  };
}

async function buildInventoryReport() {
  const snap = await getDocs(collection(db, "inventoryItems"));
  const rows = [];
  snap.forEach(d => {
    const i = d.data();
    const qty = Number(i.quantity) || 0;
    const threshold = Number(i.lowStockThreshold) || 0;
    rows.push([
      i.name || "-",
      i.category || "-",
      qty,
      i.vendorName || "-",
      Number(i.pricePerUnit || 0),
      qty <= threshold ? "Low Stock" : "OK"
    ]);
  });
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    title: "Inventory Report",
    columns: ["Item", "Category", "Quantity", "Vendor", "Price/Unit", "Status"],
    rows
  };
}

const REPORTS = {
  attendance: buildAttendanceReport,
  employee: buildEmployeeReport,
  branch: buildBranchReport,
  revenue: buildRevenueReport,
  payment: buildPaymentReport,
  service: buildServiceReport,
  inventory: buildInventoryReport
};

/* ==========================================================
   GENERATE + RENDER
========================================================== */

window.generateReport = async function () {
  const type = document.getElementById("reportTypeSelect").value;
  const headEl = document.getElementById("reportPreviewHead");
  const bodyEl = document.getElementById("reportPreviewBody");
  const titleEl = document.getElementById("reportPreviewTitle");
  const metaEl = document.getElementById("reportPreviewMeta");

  bodyEl.innerHTML = `<tr><td>Loading…</td></tr>`;

  try {
    const builder = REPORTS[type];
    if (!builder) return;

    const report = await builder();
    currentReport = report;

    titleEl.textContent = report.title;
    metaEl.textContent = `${report.rows.length} row(s) • Generated ${new Date().toLocaleString("en-IN")}`;

    headEl.innerHTML = report.columns.map(c => `<th>${escapeHtml(c)}</th>`).join("");

    if (report.rows.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="${report.columns.length}">No data available for this report.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = report.rows.map(row =>
      `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    ).join("");

  } catch (err) {
    bodyEl.innerHTML = `<tr><td>Failed to generate report: ${escapeHtml(err.message)}</td></tr>`;
  }
};

/* ==========================================================
   EXPORT
========================================================== */

document.getElementById("reportExportCsvBtn")?.addEventListener("click", () => {
  if (!currentReport || currentReport.rows.length === 0) { alert("Generate a report first."); return; }

  const header = currentReport.columns.join(",");
  const body = currentReport.rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${currentReport.title.replace(/\s+/g, "_")}.csv`;
  link.click();
});

document.getElementById("reportExportXlsxBtn")?.addEventListener("click", () => {
  if (!currentReport || currentReport.rows.length === 0) { alert("Generate a report first."); return; }
  if (typeof XLSX === "undefined") { alert("Excel export library didn't load — try CSV instead."); return; }

  const aoa = [currentReport.columns, ...currentReport.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${currentReport.title.replace(/\s+/g, "_")}.xlsx`);
});

document.getElementById("reportPrintBtn")?.addEventListener("click", () => {
  if (!currentReport || currentReport.rows.length === 0) { alert("Generate a report first."); return; }

  document.getElementById("reportPrintTitle").textContent = `M.R Solar Systems — ${currentReport.title}`;
  document.getElementById("reportPrintMeta").textContent = `Generated ${new Date().toLocaleString("en-IN")} • ${currentReport.rows.length} row(s)`;
  document.getElementById("reportPrintHead").innerHTML = currentReport.columns.map(c => `<th>${escapeHtml(c)}</th>`).join("");
  document.getElementById("reportPrintBody").innerHTML = currentReport.rows.map(row =>
    `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
  ).join("");

  window.print();
});
