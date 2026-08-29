/* ==========================================================
   M.R SOLAR SYSTEMS - ADMIN MONTH-WISE FAST ERP CONTROLLER
   ========================================================== */

import { db } from "./firebase-config.js";

const table = document.getElementById("customerTable");
let allDocsCache = [];

function getRecordMonthKey(rec) {
  if (rec.createdAt?.seconds) {
    const dt = new Date(rec.createdAt.seconds * 1000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof rec.createdAt === "string" && rec.createdAt.length >= 7) {
    return rec.createdAt.slice(0, 7);
  }
  return "Unknown";
}

function populateAdminMonthDropdown(docsList) {
  const monthFilterEl = document.getElementById("adminErpMonthFilter");
  if (!monthFilterEl) return;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  const monthSet = new Set();
  docsList.forEach(r => {
    const key = getRecordMonthKey(r);
    if (key && key !== "Unknown") monthSet.add(key);
  });

  const sortedMonths = Array.from(monthSet).sort().reverse();

  let optionsHtml = `<option value="${currentMonthKey}">📅 This Month (${currentMonthName})</option>`;
  sortedMonths.forEach(mKey => {
    if (mKey !== currentMonthKey) {
      const [y, m] = mKey.split("-");
      const dObj = new Date(Number(y), Number(m) - 1, 1);
      const name = dObj.toLocaleString("default", { month: "long", year: "numeric" });
      optionsHtml += `<option value="${mKey}">🗓️ ${name}</option>`;
    }
  });
  optionsHtml += `<option value="all">🌐 All Records (${docsList.length})</option>`;

  const savedVal = monthFilterEl.value;
  monthFilterEl.innerHTML = optionsHtml;
  if (savedVal && (monthSet.has(savedVal) || savedVal === "all" || savedVal === currentMonthKey)) {
    monthFilterEl.value = savedVal;
  }
}

function applyMonthFilter() {
  if (!table) return;

  const monthFilterEl = document.getElementById("adminErpMonthFilter");
  const chosenMonth = monthFilterEl?.value || "current";

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const targetMonth = chosenMonth === "current" ? currentMonthKey : chosenMonth;

  const rows = Array.from(table.querySelectorAll("tr"));
  let visibleCount = 0;

  rows.forEach(tr => {
    const created = tr.getAttribute("data-created");
    let rowMonthKey = "Unknown";
    if (created && created.length >= 7) {
      rowMonthKey = created.slice(0, 7);
    }

    if (chosenMonth === "all" || rowMonthKey === targetMonth || rowMonthKey === "Unknown") {
      tr.style.display = "";
      visibleCount++;
    } else {
      tr.style.display = "none";
    }
  });

  renderAdminMonthSummaryBar(visibleCount, chosenMonth);
}

function renderAdminMonthSummaryBar(count, chosenMonth) {
  const el = document.getElementById("adminErpPaginationControls");
  if (!el) return;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isAll = chosenMonth === "all";

  let monthLabel = "All Records";
  if (!isAll) {
    const [y, m] = (chosenMonth === "current" ? currentMonthKey : chosenMonth).split("-");
    const dObj = new Date(Number(y), Number(m) - 1, 1);
    monthLabel = dObj.toLocaleString("default", { month: "long", year: "numeric" });
  }

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;background:rgba(15,23,42,0.85);border:1px solid rgba(245,158,11,0.25);border-radius:8px;font-size:13px;margin-top:10px;">
      <div>📊 <strong>Showing ${count} customer projects</strong> for <span style="color:#fbbf24;font-weight:700;">${monthLabel}</span></div>
      <div style="color:#10b981;font-weight:700;">⚡ Admin Fast Month-Wise View Active</div>
    </div>
  `;
}

document.addEventListener("adminTableRendered", () => {
  allDocsCache = window.__adminAllDocs || [];
  populateAdminMonthDropdown(allDocsCache);
  applyMonthFilter();
});

document.getElementById("adminErpMonthFilter")?.addEventListener("change", () => {
  applyMonthFilter();
});

/* ==========================================================
   EXCEL EXPORT (Includes Work Status & Date)
========================================================== */

document.getElementById("adminExportXlsxBtn")?.addEventListener("click", () => {
  const docs = window.__adminAllDocs || [];
  if (docs.length === 0) { alert("No records to export."); return; }

  if (typeof XLSX === "undefined") {
    alert("Excel export library is loading — try CSV export instead.");
    return;
  }

  const rows = docs.map(d => {
    const paid = (d.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const dateStr = d.createdAt?.seconds
      ? new Date(d.createdAt.seconds * 1000).toLocaleDateString("en-IN")
      : (typeof d.createdAt === "string" ? d.createdAt.split("T")[0] : "-");

    return {
      "Customer Name": d.customerName || "",
      "Phone Number": d.phone || "",
      "Executive Name": d.executiveName || "",
      "Total Amount": d.totalAmount || 0,
      "Paid Amount": paid,
      "Balance": (d.totalAmount || 0) - paid,
      "Payment Status": d.status || "Pending",
      "Stage": d.currentStage || "Registration",
      "Work Status": d.workStatus || (d.currentStage === "Completed" ? "Completed" : "Not Completed"),
      "Created Date": dateStr,
      "Remarks": d.remarks || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customer ERP");
  XLSX.writeFile(wb, `MR_Solar_Admin_ERP_${new Date().toISOString().split("T")[0]}.xlsx`);
});
