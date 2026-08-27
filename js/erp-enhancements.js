/* ==========================================================
   M.R SOLAR SYSTEMS - MONTH-WISE FAST ERP LOADER
   ========================================================== */

let selectedMonth = "current"; // 'current' | 'YYYY-MM' | 'all'
let sortField = null;
let sortDir = 1;
let allSourceRecords = [];

function computePaid(d) {
  return (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function getRecordMonthKey(rec) {
  const d = rec.data;
  if (d.createdAt?.seconds) {
    const dt = new Date(d.createdAt.seconds * 1000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof d.createdAt === "string" && d.createdAt.length >= 7) {
    return d.createdAt.slice(0, 7);
  }
  return "Unknown";
}

function populateMonthDropdown(recordsList) {
  const monthFilterEl = document.getElementById("erpMonthFilter");
  if (!monthFilterEl) return;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  const monthSet = new Set();
  recordsList.forEach(r => {
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
  optionsHtml += `<option value="all">🌐 All Records (${recordsList.length})</option>`;

  const savedVal = monthFilterEl.value;
  monthFilterEl.innerHTML = optionsHtml;
  if (savedVal && (monthSet.has(savedVal) || savedVal === "all" || savedVal === currentMonthKey)) {
    monthFilterEl.value = savedVal;
  }
}

function filterAndRenderMonthWise() {
  const monthFilterEl = document.getElementById("erpMonthFilter");
  const chosenMonth = monthFilterEl?.value || "current";

  let filtered = allSourceRecords;

  if (chosenMonth !== "all") {
    const now = new Date();
    const targetMonth = chosenMonth === "current"
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      : chosenMonth;

    filtered = allSourceRecords.filter(r => getRecordMonthKey(r) === targetMonth);
  }

  // Sort if needed
  if (sortField) {
    filtered = [...filtered].sort((a, b) => {
      const da = a.data, db = b.data;
      let va = (da[sortField] || "").toLowerCase();
      let vb = (db[sortField] || "").toLowerCase();
      return sortDir * va.localeCompare(vb);
    });
  }

  if (typeof window.__erpShowTable === "function") {
    window.__erpShowTable(filtered);
  }

  renderMonthSummaryBar(filtered.length, chosenMonth);
}

function renderMonthSummaryBar(count, chosenMonth) {
  const el = document.getElementById("erpPaginationControls");
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
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:10px 14px;background:rgba(15,23,42,0.8);border:1px solid rgba(245,158,11,0.25);border-radius:8px;font-size:13px;">
      <div>📊 <strong>Showing ${count} customer records</strong> for <span style="color:#fbbf24;font-weight:700;">${monthLabel}</span></div>
      <div style="color:#10b981;font-weight:700;">⚡ Fast Month-Wise View Active</div>
    </div>
  `;
}

// Listen for records from erp.js
document.addEventListener("erpRecordsLoaded", () => {
  allSourceRecords = window.__erpAllRecords || [];
  populateMonthDropdown(allSourceRecords);
  filterAndRenderMonthWise();
});

document.getElementById("erpMonthFilter")?.addEventListener("change", () => {
  filterAndRenderMonthWise();
});

// CSV Export
document.getElementById("erpExportCsvBtn")?.addEventListener("click", () => {
  const list = window.__erpCurrentList || allSourceRecords;
  if (!list.length) { alert("No records to export."); return; }

  let csv = "Customer Name,Phone,Executive,Total Amount,Paid Amount,Balance,Status,Current Stage,Date,Remarks\n";
  list.forEach(r => {
    const d = r.data;
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    const balance = total - paid;
    csv += `"${d.customerName || ''}","${d.phone || ''}","${d.executiveName || ''}",${total},${paid},${balance},"${d.status || ''}","${d.currentStage || ''}","${d.createdAt?.seconds ? new Date(d.createdAt.seconds*1000).toLocaleDateString() : ''}","${d.remarks || ''}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Customer_ERP_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
});

// Excel Export
document.getElementById("erpExportXlsxBtn")?.addEventListener("click", () => {
  const list = window.__erpCurrentList || allSourceRecords;
  if (!list.length) { alert("No records to export."); return; }
  if (typeof XLSX === "undefined") { alert("Excel export library loading..."); return; }

  const rows = list.map(r => {
    const d = r.data;
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    return {
      "Customer Name": d.customerName || "",
      "Phone Number": d.phone || "",
      "Executive Name": d.executiveName || "",
      "Total Amount": total,
      "Paid Amount": paid,
      "Balance": total - paid,
      "Status": d.status || "Pending",
      "Current Stage": d.currentStage || "Registration",
      "Remarks": d.remarks || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customer ERP");
  XLSX.writeFile(wb, `Customer_ERP_${new Date().toISOString().split("T")[0]}.xlsx`);
});
