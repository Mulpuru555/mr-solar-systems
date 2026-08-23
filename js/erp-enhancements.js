let currentPage = 1;
const pageSize = 8;
let sortField = null;
let sortDir = 1;
let lastRenderedSlice = null;
let lastSourceList = [];

function computePaid(d) {
  return (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function sortList(list) {
  if (!sortField) return list;
  const copy = [...list];
  copy.sort((a, b) => {
    const da = a.data, db = b.data;
    let va, vb;
    switch (sortField) {
      case "customerName":
      case "executiveName":
      case "status":
        va = (da[sortField] || "").toLowerCase();
        vb = (db[sortField] || "").toLowerCase();
        return sortDir * va.localeCompare(vb);
      case "currentStage":
        va = (da.currentStage || "Registration").toLowerCase();
        vb = (db.currentStage || "Registration").toLowerCase();
        return sortDir * va.localeCompare(vb);
      case "totalAmount":
        return sortDir * ((da.totalAmount || 0) - (db.totalAmount || 0));
      case "paid":
        return sortDir * (computePaid(da) - computePaid(db));
      case "balance": {
        const balA = (Number(da.totalAmount) || 0) - computePaid(da);
        const balB = (Number(db.totalAmount) || 0) - computePaid(db);
        return sortDir * (balA - balB);
      }
      case "date":
        return sortDir * ((da.createdAt?.seconds || 0) - (db.createdAt?.seconds || 0));
      default:
        return 0;
    }
  });
  return copy;
}

function renderPaginated(sourceList) {
  const sorted = sortList(sourceList);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  const slice = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  lastRenderedSlice = slice;

  if (typeof window.__erpShowTable === "function") {
    window.__erpShowTable(slice);
  }

  renderPaginationControls(sorted.length, totalPages);
}

function renderPaginationControls(totalCount, totalPages) {
  const el = document.getElementById("erpPaginationControls");
  if (!el) return;

  if (totalCount === 0) {
    el.innerHTML = "";
    return;
  }

  el.innerHTML = `
    <button id="erpPrevPageBtn" ${currentPage <= 1 ? "disabled" : ""}>&lsaquo; Prev</button>
    <span>Page ${currentPage} of ${totalPages} (${totalCount} records)</span>
    <button id="erpNextPageBtn" ${currentPage >= totalPages ? "disabled" : ""}>Next &rsaquo;</button>
  `;

  document.getElementById("erpPrevPageBtn")?.addEventListener("click", () => {
    currentPage--;
    renderPaginated(lastSourceList);
  });
  document.getElementById("erpNextPageBtn")?.addEventListener("click", () => {
    currentPage++;
    renderPaginated(lastSourceList);
  });
}

function decorateRows() {
  const table = document.getElementById("recordsTable");
  if (!table || !lastRenderedSlice) return;

  const rows = table.querySelectorAll("tr");
  rows.forEach((tr, idx) => {
    const rec = lastRenderedSlice[idx];
    if (!rec) return;

    const cells = tr.children;
    // Columns: S.No(0), Customer(1), Phone(2), Executive(3), Total(4), Paid(5), Balance(6), Status(7), Stage(8), Date(9), Lock(10), Actions(11)
    const statusCell = cells[7];
    if (statusCell && !statusCell.querySelector(".statusPill")) {
      const statusText = statusCell.textContent.trim();
      statusCell.innerHTML = `<span class="statusPill ${statusText.toLowerCase().replace(/\\s+/g, '-')}">${statusText}</span>`;
    }

    const lastCell = cells[cells.length - 1];
    if (lastCell) {
      const viewBtn = lastCell.querySelector(".erpViewBtn");
      if (viewBtn) {
        viewBtn.onclick = (e) => {
          e.stopPropagation();
          openTimelineModal(rec);
        };
      }
      const editBtn = lastCell.querySelector(".editBtn");
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof window.openEdit === "function") {
            window.openEdit(rec);
          }
        };
      }
      const progressBtn = lastCell.querySelector(".progressBtn");
      if (progressBtn) {
        progressBtn.onclick = (e) => {
          e.stopPropagation();
          if (typeof window.__openCustomerProgressModal === "function") {
            window.__openCustomerProgressModal(rec.id);
          }
        };
      }
    }
  });
}

/* ---------- Sort header clicks ---------- */

document.querySelectorAll(".erpSortable").forEach(th => {
  th.addEventListener("click", () => {
    const field = th.dataset.sort;

    if (sortField === field) {
      sortDir *= -1;
    } else {
      sortField = field;
      sortDir = 1;
    }
    currentPage = 1;
    renderPaginated(lastSourceList);
  });
});

/* ---------- React to erp.js render events ---------- */

document.addEventListener("erpTableRendered", () => {
  const current = window.__erpCurrentList || [];

  if (current === lastRenderedSlice) {
    // This render was triggered by us (renderPaginated -> __erpShowTable) — just decorate.
    decorateRows();
    return;
  }

  // Fresh source list from erp.js itself (initial load or search filter change).
  lastSourceList = current;
  currentPage = 1;
  renderPaginated(current);
});

/* ---------- Payment timeline / invoice modal ---------- */

const modal = document.getElementById("erpTimelineModal");
let activeRecord = null;

function openTimelineModal(rec) {
  activeRecord = rec;
  const d = rec.data;

  document.getElementById("erpModalCustomerName").textContent = d.customerName || "Customer";
  document.getElementById("erpModalExecName").textContent = `Executive: ${d.executiveName || "-"}`;

  const listEl = document.getElementById("erpTimelineList");
  const payments = d.payments || [];

  if (payments.length === 0) {
    listEl.innerHTML = `<div class="erpTimelineEmpty">No payments recorded yet.</div>`;
  } else {
    listEl.innerHTML = payments.map(p => `
      <div class="erpTimelineItem">
        <span>${p.date || "-"}</span>
        <span>₹${Number(p.amount || 0).toLocaleString()}</span>
      </div>
    `).join("");
  }

  modal?.classList.add("open");
}
window.openTimelineModal = openTimelineModal;

document.getElementById("erpCloseModalBtn")?.addEventListener("click", () => {
  modal?.classList.remove("open");
});

document.getElementById("erpPrintInvoiceBtn")?.addEventListener("click", () => {
  if (!activeRecord) return;
  const d = activeRecord.data;
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

/* ---------- Export ---------- */

function buildExportRows() {
  const source = window.__erpAllRecords || [];
  return source.map(r => {
    const d = r.data;
    const paid = computePaid(d);
    return {
      Customer: d.customerName || "",
      Phone: d.phone || "",
      Executive: d.executiveName || "",
      Total: d.totalAmount || 0,
      Paid: paid,
      Balance: (d.totalAmount || 0) - paid,
      Status: d.status || "",
      Stage: d.currentStage || "Registration",
      Lock: d.isLocked !== false ? "Locked" : "Open"
    };
  });
}

document.getElementById("erpExportCsvBtn")?.addEventListener("click", () => {
  const rows = buildExportRows();
  if (rows.length === 0) { alert("No records to export."); return; }

  const header = Object.keys(rows[0]).join(",");
  const body = rows.map(r => Object.values(r).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "My_ERP_Records.csv";
  link.click();
});

document.getElementById("erpExportXlsxBtn")?.addEventListener("click", () => {
  const rows = buildExportRows();
  if (rows.length === 0) { alert("No records to export."); return; }

  if (typeof XLSX === "undefined") {
    alert("Excel export library didn't load — try CSV export instead.");
    return;
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Records");
  XLSX.writeFile(wb, "My_ERP_Records.xlsx");
});
