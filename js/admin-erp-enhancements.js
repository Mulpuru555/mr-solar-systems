import { db } from "./firebase-config.js";

let currentPage = 1;
const pageSize = 8;
let sortKey = null; // 'customer' | 'executive' | 'total' | 'paid'
let sortDir = 1;
let applying = false;

const table = document.getElementById("customerTable");

function parseCurrency(text) {
  return Number((text || "").replace(/[^0-9.-]/g, "")) || 0;
}

function decorateRow(tr) {
  const cells = tr.children;
  if (cells.length < 12) return;

  // Lock cell is at index 11
  const lockCell = cells[11];
  if (lockCell && !lockCell.querySelector(".erpViewBtn")) {
    const lockBtn = lockCell.querySelector("button");
    const idMatch = lockBtn?.getAttribute("onclick")?.match(/toggleLock\('([^']+)'/);
    const recordId = idMatch ? idMatch[1] : null;
    if (recordId) {
      const viewBtn = document.createElement("button");
      viewBtn.textContent = "View";
      viewBtn.className = "erpViewBtn action";
      viewBtn.style.marginLeft = "4px";
      viewBtn.addEventListener("click", () => openTimelineModalById(recordId));
      lockCell.appendChild(viewBtn);
    }
  }
}

function applyView() {
  if (!table) return;
  applying = true;

  const rows = Array.from(table.querySelectorAll("tr"));
  rows.forEach(decorateRow);

  if (sortKey) {
    const colIndex = { customer: 1, executive: 3, total: 4, paid: 5 }[sortKey];
    rows.sort((a, b) => {
      const va = a.children[colIndex]?.textContent.trim() || "";
      const vb = b.children[colIndex]?.textContent.trim() || "";
      if (sortKey === "total" || sortKey === "paid") {
        return sortDir * (parseCurrency(va) - parseCurrency(vb));
      }
      return sortDir * va.localeCompare(vb);
    });
    rows.forEach(tr => table.appendChild(tr));
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  rows.forEach((tr, idx) => {
    const page = Math.floor(idx / pageSize) + 1;
    tr.style.display = page === currentPage ? "" : "none";
  });

  renderPaginationControls(rows.length, totalPages);

  requestAnimationFrame(() => { applying = false; });
}

function renderPaginationControls(totalCount, totalPages) {
  const el = document.getElementById("adminErpPaginationControls");
  if (!el) return;

  if (totalCount === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <button id="adminErpPrevBtn" ${currentPage <= 1 ? "disabled" : ""}>&lsaquo; Prev</button>
    <span>Page ${currentPage} of ${totalPages} (${totalCount} records)</span>
    <button id="adminErpNextBtn" ${currentPage >= totalPages ? "disabled" : ""}>Next &rsaquo;</button>
  `;

  document.getElementById("adminErpPrevBtn")?.addEventListener("click", () => {
    currentPage--;
    applyView();
  });
  document.getElementById("adminErpNextBtn")?.addEventListener("click", () => {
    currentPage++;
    applyView();
  });
}

if (table) {
  const observer = new MutationObserver(() => {
    if (applying) return;
    currentPage = 1;
    applyView();
  });
  observer.observe(table, { childList: true });
}

document.querySelectorAll('.erpSortable[data-adminsort]').forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.adminsort === "customerName" ? "customer"
      : th.dataset.adminsort === "executiveName" ? "executive"
      : th.dataset.adminsort;
    if (sortKey === key) {
      sortDir *= -1;
    } else {
      sortKey = key;
      sortDir = 1;
    }
    applyView();
  });
});

document.addEventListener("adminTableRendered", () => {
  applyView();
});

/* ==========================================================
   PAYMENT TIMELINE & INVOICE PRINT
========================================================== */

const modal = document.getElementById("erpTimelineModal");
let activeRecord = null;

function computePaid(d) {
  return (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function openTimelineModalById(id) {
  const rec = (window.__adminAllDocs || []).find(r => r.id === id);
  if (!rec) return;

  activeRecord = rec;

  document.getElementById("erpModalCustomerName").textContent = rec.customerName || "Customer";
  document.getElementById("erpModalExecName").textContent = `Executive: ${rec.executiveName || "-"}`;

  const listEl = document.getElementById("erpTimelineList");
  const payments = rec.payments || [];

  listEl.innerHTML = payments.length === 0
    ? `<div class="erpTimelineEmpty">No payments recorded yet.</div>`
    : payments.map(p => `
        <div class="erpTimelineItem">
          <span>${p.date || "-"}</span>
          <span>₹${Number(p.amount || 0).toLocaleString()}</span>
        </div>
      `).join("");

  modal?.classList.add("open");
}
window.openTimelineModalById = openTimelineModalById;

document.getElementById("erpCloseModalBtn")?.addEventListener("click", () => {
  modal?.classList.remove("open");
});

document.getElementById("erpPrintInvoiceBtn")?.addEventListener("click", () => {
  if (!activeRecord) return;
  const d = activeRecord;
  const payments = d.payments || [];
  const totalPaid = computePaid(d);

  document.getElementById("printCustomerLine").textContent = `Customer: ${d.customerName || "-"}`;
  document.getElementById("printExecLine").textContent = `Executive: ${d.executiveName || "-"}`;
  document.getElementById("printDateLine").textContent = `Printed: ${new Date().toLocaleDateString("en-IN")}`;

  document.getElementById("printPaymentRows").innerHTML = payments.length === 0
    ? `<tr><td colspan="3">No payments recorded</td></tr>`
    : payments.map((p, i) => `<tr><td>${i + 1}</td><td>${p.date || "-"}</td><td>${Number(p.amount || 0).toLocaleString()}</td></tr>`).join("");

  document.getElementById("printTotalsLine").textContent =
    `Total: ₹${Number(d.totalAmount || 0).toLocaleString()}  |  Paid: ₹${totalPaid.toLocaleString()}  |  Balance: ₹${(Number(d.totalAmount || 0) - totalPaid).toLocaleString()}`;

  window.print();
});

/* ==========================================================
   EXCEL EXPORT
========================================================== */

document.getElementById("adminExportXlsxBtn")?.addEventListener("click", () => {
  const docs = window.__adminAllDocs || [];
  if (docs.length === 0) { alert("No records to export."); return; }

  if (typeof XLSX === "undefined") {
    alert("Excel export library didn't load — try CSV export instead.");
    return;
  }

  const rows = docs.map(d => {
    const paid = computePaid(d);
    return {
      Customer: d.customerName || "",
      Phone: d.phone || "",
      Executive: d.executiveName || "",
      Total: d.totalAmount || 0,
      Paid: paid,
      Balance: (d.totalAmount || 0) - paid,
      Status: d.status || "",
      Stage: d.currentStage || d.workStatus || "Registration"
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Records");
  XLSX.writeFile(wb, "Customer_ERP_Report.xlsx");
});
