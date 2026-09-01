import { auth, db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";
let records = [];
let unsubscribeRecords = null;
let editID = "";
let progressActiveRecord = null;

export const ALL_STAGES = [
  "Registration",
  "Loan / Cash / Bajaj",
  "Payments",
  "Installation Agreement",
  "Civil Work",
  "AE Login",
  "Net Meter",
  "Subsidy Push",
  "Subsidy Received",
  "Warranty",
  "Completed"
];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computePaid(d) {
  return (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function getStageGroupBadge(stage) {
  const s = stage || "Registration";
  if (["Registration", "Loan / Cash / Bajaj", "Payments"].includes(s)) {
    return '<span style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">Group A &bull; Onboarding</span>';
  }
  if (["Installation Agreement", "Civil Work", "AE Login"].includes(s)) {
    return '<span style="background:rgba(234,179,8,0.15);color:#eab308;border:1px solid rgba(234,179,8,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">Group B &bull; Approvals</span>';
  }
  if (["Net Meter", "Subsidy Push", "Subsidy Received"].includes(s)) {
    return '<span style="background:rgba(168,85,247,0.15);color:#a855f7;border:1px solid rgba(168,85,247,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">Group C &bull; Subsidy</span>';
  }
  return '<span style="background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">Group D &bull; Handover</span>';
}

/* AUTH */
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    loadRecords();
  }
});

/* ADD NEW ERP RECORD */
const form = document.getElementById("paymentForm");
if (form) {
  form.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById("customerName")?.value.trim();
    const phone = document.getElementById("customerPhone")?.value.trim() || "";
    const exec = document.getElementById("executiveName")?.value.trim();
    const total = Number(document.getElementById("totalAmount")?.value) || 0;
    const remarks = document.getElementById("customerRemarks")?.value.trim() || "";

    if (!name || !exec || total <= 0) {
      alert("Please fill in valid customer name, executive name, and total amount.");
      return;
    }

    try {
      await addDoc(collection(db, "customerPayments"), {
        customerName: name,
        phone: phone,
        executiveName: exec,
        totalAmount: total,
        remarks: remarks,
        createdBy: uid,
        payments: [],
        status: "Pending",
        currentStage: "Registration",
        workStatus: "Not Completed",
        isLocked: false,
        createdAt: serverTimestamp()
      });

      form.reset();
      alert("Customer record created successfully!");
    } catch (err) {
      alert("Failed to add ERP entry: " + err.message);
    }
  };
}

/* LOAD ALL COMPANY ERP RECORDS FOR ALL EMPLOYEES */
function loadRecords() {
  if (!uid) return;
  if (unsubscribeRecords) unsubscribeRecords();

  const q = collection(db, "customerPayments");

  unsubscribeRecords = onSnapshot(q, (snap) => {
    records = [];

    snap.forEach(d => {
      records.push({
        id: d.id,
        data: d.data()
      });
    });

    records.sort((a, b) => {
      const t1 = a.data.createdAt?.seconds || (typeof a.data.createdAt === "string" ? new Date(a.data.createdAt).getTime() / 1000 : 0);
      const t2 = b.data.createdAt?.seconds || (typeof b.data.createdAt === "string" ? new Date(b.data.createdAt).getTime() / 1000 : 0);
      return t2 - t1;
    });

    window.__erpAllRecords = records;
    document.dispatchEvent(new CustomEvent("erpRecordsLoaded"));

    showTable(records);
    renderCustomerProgress(records);
    updateDashboardStats(records);
  }, (err) => {
    console.error("ERP load error:", err);
  });
}

function updateDashboardStats(list) {
  const totalEl = document.getElementById("totalStat");
  const pendingEl = document.getElementById("pendingStat");
  if (totalEl) totalEl.textContent = list.length;
  if (pendingEl) {
    const pendCount = list.filter(r => (r.data.status || "").toLowerCase() !== "completed").length;
    pendingEl.textContent = pendCount;
  }
}

/* SHOW ERP TABLE */
function showTable(list) {
  const table = document.getElementById("recordsTable");
  if (!table) return;

  table.innerHTML = "";

  if (list.length === 0) {
    table.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#8a97a6;padding:16px;">No ERP records found.</td></tr>';
    window.__erpCurrentList = list;
    document.dispatchEvent(new CustomEvent("erpTableRendered"));
    return;
  }

  let i = 1;

  list.forEach(obj => {
    const d = obj.data;
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    const balance = total - paid;
    const stage = d.currentStage || "Registration";

    const date = d.createdAt?.seconds
      ? new Date(d.createdAt.seconds * 1000).toLocaleDateString()
      : (typeof d.createdAt === "string" ? d.createdAt.split("T")[0] : "-");

    const balanceDisplay = balance <= 0
      ? '<span style="color:#22c55e;font-weight:600;">₹0</span>'
      : `<span style="color:#f59e0b;font-weight:600;">₹${balance.toLocaleString()}</span>`;

    const stageBadge = getStageGroupBadge(stage);

    table.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${i++}</td>
        <td><strong>${escapeHtml(d.customerName || "-")}</strong></td>
        <td><a href="tel:${escapeHtml(d.phone || '')}" style="color:#38bdf8;text-decoration:none;">${escapeHtml(d.phone || "-")}</a></td>
        <td>${escapeHtml(d.executiveName || "-")}</td>
        <td>₹${total.toLocaleString()}</td>
        <td>₹${paid.toLocaleString()}</td>
        <td>${balanceDisplay}</td>
        <td><span class="statusPill ${(d.status || "Pending").toLowerCase().replace(/\s+/g, '-')}">${d.status || "Pending"}</span></td>
        <td>
          <div><strong>${escapeHtml(stage)}</strong></div>
          <div style="margin-top:2px;">${stageBadge}</div>
        </td>
        <td>${date}</td>
        <td>
          <button data-progressid="${obj.id}" class="progressBtn" style="background:#ff9800;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Progress</button>
          <button data-id="${obj.id}" class="editBtn" style="margin-left:4px;background:#22c55e;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Edit</button>
        </td>
      </tr>
      `
    );
  });

  table.querySelectorAll(".editBtn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rec = records.find(r => r.id === btn.dataset.id);
      if (rec) openEdit(rec);
    };
  });

  table.querySelectorAll(".progressBtn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const rec = records.find(r => r.id === btn.dataset.progressid);
      if (rec) openProgressModal(rec);
    };
  });

  window.__erpCurrentList = list;
  document.dispatchEvent(new CustomEvent("erpTableRendered"));
}

window.__erpShowTable = showTable;

/* SEARCH */
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.oninput = () => {
    const v = searchInput.value.toLowerCase().trim();
    if (!v) {
      showTable(records);
      return;
    }
    const filtered = records.filter(r =>
      (r.data.customerName || "").toLowerCase().includes(v) ||
      (r.data.phone || "").toLowerCase().includes(v) ||
      (r.data.executiveName || "").toLowerCase().includes(v) ||
      (r.data.currentStage || "").toLowerCase().includes(v)
    );
    showTable(filtered);
  };
}

/* CUSTOMER PROGRESS (ABCD WORKFLOW CARDS) */
function renderCustomerProgress(list) {
  const container = document.getElementById("empCustomerProgressList");
  if (!container) return;

  const search = (document.getElementById("empProgressSearchInput")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("empProgressStatusFilter")?.value || "";
  const groupFilter = document.getElementById("empProgressGroupFilter")?.value || "";

  const filtered = list.filter(obj => {
    const d = obj.data;
    const name = (d.customerName || "").toLowerCase();
    const phone = (d.phone || "").toLowerCase();
    const exec = (d.executiveName || "").toLowerCase();
    const stage = (d.currentStage || "Registration");
    const status = (d.status || "Pending");

    if (search && !name.includes(search) && !phone.includes(search) && !exec.includes(search)) return false;
    if (statusFilter && status !== statusFilter) return false;

    if (groupFilter === "A" && !["Registration", "Loan / Cash / Bajaj", "Payments"].includes(stage)) return false;
    if (groupFilter === "B" && !["Installation Agreement", "Civil Work", "AE Login"].includes(stage)) return false;
    if (groupFilter === "C" && !["Net Meter", "Subsidy Push", "Subsidy Received"].includes(stage)) return false;
    if (groupFilter === "D" && !["Warranty", "Completed"].includes(stage)) return false;

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#8a97a6;padding:24px;text-align:center;grid-column:1/-1;">No customer progress records found matching filters.</div>';
    return;
  }

  container.innerHTML = filtered.map(obj => {
    const d = obj.data;
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    const balance = total - paid;
    const stage = d.currentStage || "Registration";
    const groupBadge = getStageGroupBadge(stage);

    return `
      <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,0.3);display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div>
              <div style="font-weight:700;font-size:16px;color:#fff;">${escapeHtml(d.customerName || "Customer")}</div>
              <div style="font-size:13px;color:#38bdf8;">${escapeHtml(d.phone || "No phone")} &bull; Exec: ${escapeHtml(d.executiveName || "-")}</div>
            </div>
            <div>${groupBadge}</div>
          </div>

          <div style="margin:10px 0;background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;font-size:12px;line-height:1.6;">
            <div><strong>Stage:</strong> <span style="color:#facc15;font-weight:700;">${escapeHtml(stage)}</span></div>
            <div><strong>Total:</strong> ₹${total.toLocaleString()} | <strong>Paid:</strong> ₹${paid.toLocaleString()} | <strong>Balance:</strong> <span style="color:${balance <= 0 ? '#22c55e' : '#ef4444'};font-weight:700;">₹${balance.toLocaleString()}</span></div>
            ${d.remarks ? `<div style="margin-top:4px;color:#cfd8e3;">💬 <em>"${escapeHtml(d.remarks)}"</em></div>` : ""}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" onclick="window.__openCustomerProgressModal('${obj.id}')" style="flex:1;background:#ff9800;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Update Stage</button>
          <button type="button" onclick="window.__openCustomerEdit('${obj.id}')" style="background:#22c55e;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Edit Details</button>
        </div>
      </div>
    `;
  }).join("");
}

window.__openCustomerProgressModal = (id) => {
  const rec = records.find(r => r.id === id);
  if (rec) openProgressModal(rec);
};

window.__openCustomerEdit = (id) => {
  const rec = records.find(r => r.id === id);
  if (rec) openEdit(rec);
};

/* EDIT MODAL (ALLOW FULL NAME, PHONE & EXECUTIVE EDITING FOR EMPLOYEES) */
window.openEdit = (rec) => {
  if (!rec) return;
  editID = rec.id;
  const d = rec.data;

  let paid = computePaid(d);
  let lastDate = "";
  (d.payments || []).forEach(p => {
    if (p.date) lastDate = p.date;
  });

  const editName = document.getElementById("editName");
  const editPhone = document.getElementById("editPhone");
  const editExec = document.getElementById("editExec");
  const editPaid = document.getElementById("editPaid");
  const editDate = document.getElementById("editDate");
  const editStage = document.getElementById("editStage");
  const editRemarks = document.getElementById("editRemarks");

  if (editName) { editName.value = d.customerName || ""; editName.readOnly = false; editName.disabled = false; }
  if (editPhone) { editPhone.value = d.phone || ""; editPhone.readOnly = false; editPhone.disabled = false; }
  if (editExec) { editExec.value = d.executiveName || ""; editExec.readOnly = false; editExec.disabled = false; }
  if (editPaid) editPaid.value = paid;
  if (editDate) editDate.value = lastDate || formatDateStr(new Date());
  if (editStage) editStage.value = d.currentStage || "Registration";
  if (editRemarks) editRemarks.value = d.remarks || "";

  const popup = document.getElementById("editPopup");
  if (popup) popup.style.display = "flex";
};

window.closePopup = () => {
  const popup = document.getElementById("editPopup");
  if (popup) popup.style.display = "none";
  editID = "";
};

const saveEditBtn = document.getElementById("saveEditBtn");
if (saveEditBtn) {
  saveEditBtn.onclick = async () => {
    if (!editID) return;

    const rec = records.find(r => r.id === editID);
    if (!rec) return;

    const name = document.getElementById("editName")?.value.trim() || rec.data.customerName;
    const phone = document.getElementById("editPhone")?.value.trim() || rec.data.phone;
    const exec = document.getElementById("editExec")?.value.trim() || rec.data.executiveName;
    const paidInput = document.getElementById("editPaid")?.value;
    const paid = paidInput !== "" && paidInput !== undefined ? Number(paidInput) : null;
    const date = document.getElementById("editDate")?.value || formatDateStr(new Date());
    const stage = document.getElementById("editStage")?.value || rec.data.currentStage || "Registration";
    const remarks = document.getElementById("editRemarks")?.value.trim() || "";

    const totalAmount = Number(rec.data.totalAmount) || 0;
    let newPaid = paid !== null && !isNaN(paid) && paid >= 0 ? paid : computePaid(rec.data);
    const balance = totalAmount - newPaid;
    const autoStatus = balance <= 0 ? "Completed" : (newPaid > 0 ? "Partially Paid" : "Pending");

    const updates = {
      customerName: name,
      phone: phone,
      executiveName: exec,
      status: autoStatus,
      currentStage: stage,
      workStatus: stage === "Completed" ? "Completed" : "Not Completed",
      remarks: remarks,
      updatedAt: serverTimestamp()
    };

    if (paid !== null && !isNaN(paid) && paid >= 0) {
      let payments = rec.data.payments ? [...rec.data.payments] : [];
      if (payments.length === 0) {
        if (paid > 0) payments.push({ amount: paid, date: date });
      } else {
        const otherPaymentsTotal = payments.slice(0, -1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const lastAmount = paid - otherPaymentsTotal;
        if (lastAmount >= 0) {
          payments[payments.length - 1] = { ...payments[payments.length - 1], amount: lastAmount, date: date };
        } else {
          payments = [{ amount: paid, date: date }];
        }
      }
      updates.payments = payments;
    }

    try {
      await updateDoc(doc(db, "customerPayments", editID), updates);
      closePopup();
      alert("Customer record and details updated successfully!");
    } catch (err) {
      alert("Failed to save changes: " + err.message);
    }
  };
}

/* WORK PROGRESS MODAL */
function openProgressModal(rec) {
  progressActiveRecord = rec;
  const d = rec.data;

  const nameEl = document.getElementById("progressModalCustomerName");
  if (nameEl) nameEl.textContent = `${d.customerName || "Customer"} — Stage Tracking`;

  const statusSelect = document.getElementById("progressStatusInput");
  if (statusSelect) {
    statusSelect.innerHTML = ALL_STAGES.map(s =>
      `<option value="${s}" ${s === (d.currentStage || "Registration") ? "selected" : ""}>${s}</option>`
    ).join("");
    statusSelect.disabled = false;
  }

  const remarksInput = document.getElementById("progressRemarksInput");
  if (remarksInput) {
    remarksInput.value = d.remarks || "";
    remarksInput.disabled = false;
    remarksInput.placeholder = "What was done / next steps...";
  }

  const historyEl = document.getElementById("progressHistoryList");
  if (historyEl) {
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    const balance = total - paid;
    const currentStage = d.currentStage || "Registration";

    historyEl.innerHTML = `
      <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;font-size:13px;line-height:1.7;margin-top:10px;">
        <div style="margin-bottom:8px;">🚀 <strong>Current Stage:</strong> <span style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:3px 10px;border-radius:12px;font-weight:700;">${currentStage}</span></div>
        <div>👤 <strong>Executive:</strong> ${d.executiveName || "-"}</div>
        <div>📞 <strong>Phone:</strong> ${d.phone || "-"}</div>
        <div>💰 <strong>Total Amount:</strong> ₹${total.toLocaleString()}</div>
        <div>💳 <strong>Paid Amount:</strong> ₹${paid.toLocaleString()}</div>
        <div>⚖️ <strong>Balance:</strong> <span style="color:${balance <= 0 ? "#22c55e" : "#ef4444"};font-weight:700;">₹${balance.toLocaleString()}</span></div>
        ${d.remarks ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);">💬 <strong>Remarks:</strong> <em style="color:#cfd8e3;">"${d.remarks}"</em></div>` : ""}
      </div>
    `;
  }

  const modal = document.getElementById("progressModal");
  if (modal) modal.classList.add("open");
}

document.getElementById("progressCloseModalBtn")?.addEventListener("click", () => {
  document.getElementById("progressModal")?.classList.remove("open");
  progressActiveRecord = null;
});

const progressForm = document.getElementById("progressForm");
if (progressForm) {
  progressForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!progressActiveRecord) return;

    const stage = document.getElementById("progressStatusInput")?.value || "Registration";
    const remarks = document.getElementById("progressRemarksInput")?.value.trim() || "";

    const updates = {
      currentStage: stage,
      workStatus: stage === "Completed" ? "Completed" : "Not Completed",
      remarks: remarks,
      updatedAt: serverTimestamp()
    };

    try {
      await updateDoc(doc(db, "customerPayments", progressActiveRecord.id), updates);
      document.getElementById("progressModal")?.classList.remove("open");
      progressActiveRecord = null;
      alert("Customer stage updated successfully to: " + stage);
    } catch (err) {
      alert("Failed to update stage: " + err.message);
    }
  };
}
