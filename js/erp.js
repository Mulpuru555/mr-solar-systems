import { auth, db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";
let records = [];
let editID = "";
let progressActiveRecord = null;
let unsubscribeRecords = null;

const ALL_STAGES = [
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

function formatDateStr(d) {
  const dateObj = (d instanceof Date && !isNaN(d)) ? d : new Date();
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computePaid(d) {
  return (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (unsubscribeRecords) unsubscribeRecords();
    return;
  }
  uid = user.uid;
  loadRecords();
});

/* ================= ADD NEW ERP RECORD ================= */

const form = document.getElementById("paymentForm");
if (form) {
  form.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById("customerName")?.value.trim();
    const phone = document.getElementById("customerPhone")?.value.trim() || "";
    const exec = document.getElementById("executiveName")?.value.trim();
    const total = Number(document.getElementById("totalAmount")?.value) || 0;

    if (!name || !exec || total <= 0) {
      alert("Please fill in valid customer name, executive name, and total amount.");
      return;
    }

    try {
      await addDoc(
        collection(db, "customerPayments"),
        {
          customerName: name,
          phone: phone,
          executiveName: exec,
          totalAmount: total,
          createdBy: uid,
          payments: [],
          status: "Pending",
          currentStage: "Registration",
          workStatus: "Not Completed",
          isLocked: true, // Default locked for audit safety
          createdAt: serverTimestamp()
        }
      );

      form.reset();
      alert("Customer record created successfully!");
    } catch (err) {
      alert("Failed to add ERP entry: " + err.message);
    }
  };
}

/* ================= LOAD (REALTIME SNAPSHOT) ================= */

function loadRecords() {
  if (!uid) return;
  if (unsubscribeRecords) unsubscribeRecords();

  const q = query(
    collection(db, "customerPayments"),
    where("createdBy", "==", uid)
  );

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
  }, (err) => {
    console.error("ERP load error:", err);
  });
}

/* ================= SHOW ERP TABLE ================= */

function showTable(list) {
  const table = document.getElementById("recordsTable");
  if (!table) return;

  table.innerHTML = "";

  if (list.length === 0) {
    table.innerHTML = `<tr><td colspan="12" style="text-align:center;color:#8a97a6;padding:16px;">No ERP records found.</td></tr>`;
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

    const isLocked = d.isLocked === true;

    let actionButtons = "";
    if (isLocked) {
      // LOCKED -> ONLY View & Progress
      actionButtons = `
        <button data-progressid="${obj.id}" class="progressBtn" style="background:#ff9800;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Progress</button>
        <button data-viewid="${obj.id}" class="viewBtn erpViewBtn" style="margin-left:4px;background:rgba(255,255,255,0.12);color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;">View</button>
      `;
    } else {
      // UNLOCKED -> Progress + Edit + View
      actionButtons = `
        <button data-progressid="${obj.id}" class="progressBtn" style="background:#ff9800;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Progress</button>
        <button data-id="${obj.id}" class="editBtn" style="margin-left:4px;background:#22c55e;color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Edit</button>
        <button data-viewid="${obj.id}" class="viewBtn erpViewBtn" style="margin-left:4px;background:rgba(255,255,255,0.12);color:#fff;border:none;padding:5px 9px;border-radius:4px;cursor:pointer;font-size:12px;">View</button>
      `;
    }

    const lockStatusBadge = isLocked
      ? `<span style="color:#ef4444;font-weight:700;">Locked</span>`
      : `<span style="color:#22c55e;font-weight:700;">Open</span>`;

    const balanceDisplay = balance <= 0
      ? `<span style="color:#22c55e;font-weight:600;">₹0</span>`
      : `<span style="color:#f59e0b;font-weight:600;">₹${balance.toLocaleString()}</span>`;

    table.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${i++}</td>
        <td><strong>${d.customerName || "-"}</strong></td>
        <td>${d.phone || "-"}</td>
        <td>${d.executiveName || "-"}</td>
        <td>₹${total.toLocaleString()}</td>
        <td>₹${paid.toLocaleString()}</td>
        <td>${balanceDisplay}</td>
        <td><span class="statusPill ${(d.status || "Pending").toLowerCase().replace(/\s+/g, '-')}">${d.status || "Pending"}</span></td>
        <td><span style="color:#38bdf8;font-weight:600;font-size:12px;">${stage}</span></td>
        <td>${date}</td>
        <td>${lockStatusBadge}</td>
        <td>${actionButtons}</td>
      </tr>
      `
    );
  });

  // Attach handlers
  table.querySelectorAll(".editBtn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const rec = records.find(r => r.id === id);
      if (!rec) return;
      openEdit(rec);
    };
  });

  table.querySelectorAll(".progressBtn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.progressid;
      const rec = records.find(r => r.id === id);
      if (!rec) return;
      openProgressModal(rec);
    };
  });

  table.querySelectorAll(".erpViewBtn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.viewid;
      const rec = records.find(r => r.id === id);
      if (!rec) return;
      if (typeof window.openTimelineModal === "function") {
        window.openTimelineModal(rec);
      }
    };
  });

  window.__erpCurrentList = list;
  document.dispatchEvent(new CustomEvent("erpTableRendered"));
}

window.__erpShowTable = showTable;

/* ================= SEARCH TABLE ================= */

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.oninput = () => {
    const v = searchInput.value.toLowerCase().trim();
    const filtered = records.filter(r => {
      const d = r.data;
      return (
        (d.customerName || "").toLowerCase().includes(v)
        || (d.executiveName || "").toLowerCase().includes(v)
        || (d.phone || "").toLowerCase().includes(v)
        || (d.status || "").toLowerCase().includes(v)
        || (d.currentStage || "").toLowerCase().includes(v)
      );
    });
    showTable(filtered);
  };
}

/* ================= CUSTOMER PROGRESS VIEW ================= */

function renderCustomerProgress(sourceList) {
  const container = document.getElementById("empCustomerProgressList");
  if (!container) return;

  const searchVal = document.getElementById("empProgressSearchInput")?.value.toLowerCase().trim() || "";
  const statusFilter = document.getElementById("empProgressStatusFilter")?.value || "";
  const stageFilter = document.getElementById("empProgressStageFilter")?.value || "";

  const list = (sourceList || records).filter(r => {
    const d = r.data;
    const matchSearch = !searchVal
      || (d.customerName || "").toLowerCase().includes(searchVal)
      || (d.executiveName || "").toLowerCase().includes(searchVal)
      || (d.phone || "").toLowerCase().includes(searchVal);

    const matchStatus = !statusFilter || (d.status || "Pending").toLowerCase() === statusFilter.toLowerCase();
    const matchStage = !stageFilter || (d.currentStage || "Registration").toLowerCase() === stageFilter.toLowerCase();

    return matchSearch && matchStatus && matchStage;
  });

  if (list.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;padding:30px;text-align:center;color:#8a97a6;background:#161b22;border-radius:10px;">No customer progress records matching criteria.</div>`;
    return;
  }

  container.innerHTML = list.map(obj => {
    const d = obj.data;
    const total = Number(d.totalAmount) || 0;
    const paid = computePaid(d);
    const balance = total - paid;
    const stage = d.currentStage || "Registration";
    const isLocked = d.isLocked === true;

    const createdDate = d.createdAt?.seconds
      ? new Date(d.createdAt.seconds * 1000).toLocaleDateString("en-IN")
      : (typeof d.createdAt === "string" ? d.createdAt.split("T")[0] : "-");

    const lastPayment = (d.payments && d.payments.length > 0)
      ? d.payments[d.payments.length - 1].date
      : "-";

    const stageIdx = ALL_STAGES.indexOf(stage);
    const progressPercent = Math.min(100, Math.max(8, Math.round(((stageIdx + 1) / ALL_STAGES.length) * 100)));

    const lockBadge = isLocked
      ? `<span style="color:#ef4444;font-size:11px;border:1px solid rgba(239,68,68,0.4);padding:2px 8px;border-radius:12px;background:rgba(239,68,68,0.1);">🔒 Locked</span>`
      : `<span style="color:#22c55e;font-size:11px;border:1px solid rgba(34,197,94,0.4);padding:2px 8px;border-radius:12px;background:rgba(34,197,94,0.1);">🔓 Open</span>`;

    return `
      <div style="background:#161b22;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 6px 20px rgba(0,0,0,0.3);">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h4 style="margin:0;font-size:16px;color:#ffffff;">${d.customerName || "Unnamed Customer"}</h4>
            ${lockBadge}
          </div>
          
          <div style="font-size:13px;color:#cfd8e3;margin-bottom:12px;">
            <div>👤 Executive: <strong style="color:#ff9800;">${d.executiveName || "-"}</strong></div>
            <div>📞 Phone: ${d.phone || "-"}</div>
          </div>

          <!-- Progress Bar -->
          <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
              <span style="color:#38bdf8;font-weight:700;">${stage}</span>
              <span style="color:#8a97a6;">${progressPercent}%</span>
            </div>
            <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
              <div style="width:${progressPercent}%;height:100%;background:linear-gradient(90deg,#ff9800,#22c55e);border-radius:4px;"></div>
            </div>
          </div>

          <!-- Financial Details -->
          <div style="background:#0d1117;border-radius:8px;padding:12px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;text-align:center;">
            <div>
              <div style="color:#8a97a6;">Total</div>
              <div style="font-weight:700;color:#fff;">₹${total.toLocaleString()}</div>
            </div>
            <div>
              <div style="color:#8a97a6;">Paid</div>
              <div style="font-weight:700;color:#22c55e;">₹${paid.toLocaleString()}</div>
            </div>
            <div>
              <div style="color:#8a97a6;">Balance</div>
              <div style="font-weight:700;color:${balance <= 0 ? "#22c55e" : "#ef4444"};">₹${balance.toLocaleString()}</div>
            </div>
          </div>

          <div style="font-size:12px;color:#8a97a6;margin-bottom:14px;line-height:1.6;">
            <div>📅 Created: ${createdDate}</div>
            <div>💳 Last Payment: ${lastPayment}</div>
            <div>📝 Status: <strong style="color:#ff9800;">${d.status || "Pending"}</strong></div>
            ${d.remarks ? `<div style="margin-top:4px;color:#cfd8e3;">💬 <em>"${d.remarks}"</em></div>` : ""}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" onclick="window.__openCustomerProgressModal('${obj.id}')" style="flex:1;background:#ff9800;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Update Stage</button>
          <button type="button" onclick="window.__openCustomerTimeline('${obj.id}')" style="background:rgba(255,255,255,0.1);color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;">Timeline</button>
          ${!isLocked ? `<button type="button" onclick="window.__openCustomerEdit('${obj.id}')" style="background:#22c55e;color:#fff;border:none;padding:8px 12px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">Edit</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

window.__renderCustomerProgress = renderCustomerProgress;

// Progress filters listeners
document.getElementById("empProgressSearchInput")?.addEventListener("input", () => renderCustomerProgress(records));
document.getElementById("empProgressStatusFilter")?.addEventListener("change", () => renderCustomerProgress(records));
document.getElementById("empProgressStageFilter")?.addEventListener("change", () => renderCustomerProgress(records));

window.__openCustomerProgressModal = (id) => {
  const rec = records.find(r => r.id === id);
  if (rec) openProgressModal(rec);
};

window.__openCustomerTimeline = (id) => {
  const rec = records.find(r => r.id === id);
  if (rec && typeof window.openTimelineModal === "function") {
    window.openTimelineModal(rec);
  }
};

window.__openCustomerEdit = (id) => {
  const rec = records.find(r => r.id === id);
  if (rec) openEdit(rec);
};

/* ================= EDIT MODAL (STRICT EMPLOYEE PERMISSION RULES) ================= */

window.openEdit = (rec) => {
  if (!rec) return;

  // RULE 1: If locked, employee CANNOT edit under any circumstances!
  if (rec.data.isLocked === true) {
    alert("This record is locked. Only Admin can unlock it for editing.");
    return;
  }

  editID = rec.id;
  const d = rec.data;

  let paid = computePaid(d);
  let lastDate = "";
  (d.payments || []).forEach(p => {
    if (p.date) lastDate = p.date;
  });

  // Read-only elements (Never editable by employee)
  const editName = document.getElementById("editName");
  const editExec = document.getElementById("editExec");
  const editPhone = document.getElementById("editPhone");
  const editTotal = document.getElementById("editTotal");
  const editStatus = document.getElementById("editStatus");

  if (editName) { editName.value = d.customerName || ""; editName.readOnly = true; editName.disabled = true; }
  if (editExec) { editExec.value = d.executiveName || ""; editExec.readOnly = true; editExec.disabled = true; }
  if (editPhone) { editPhone.value = d.phone || ""; editPhone.readOnly = true; editPhone.disabled = true; }
  if (editTotal) { editTotal.value = d.totalAmount || 0; editTotal.readOnly = true; editTotal.disabled = true; }
  if (editStatus) { editStatus.value = d.status || "Pending"; editStatus.readOnly = true; editStatus.disabled = true; }

  // Permitted editable elements
  const editPaid = document.getElementById("editPaid");
  const editDate = document.getElementById("editDate");
  const editStage = document.getElementById("editStage");
  const editRemarks = document.getElementById("editRemarks");

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
    if (!rec) {
      alert("Record not found.");
      return;
    }

    // STRICT LOCK ENFORCEMENT
    if (rec.data.isLocked === true) {
      alert("This record is locked. Only Admin can unlock it for editing.");
      closePopup();
      return;
    }

    const paidInput = document.getElementById("editPaid")?.value;
    const paid = paidInput !== "" && paidInput !== undefined ? Number(paidInput) : null;
    const date = document.getElementById("editDate")?.value || formatDateStr(new Date());
    const stage = document.getElementById("editStage")?.value || rec.data.currentStage || "Registration";
    const remarks = document.getElementById("editRemarks")?.value.trim() || "";

    const totalAmount = Number(rec.data.totalAmount) || 0;
    let newPaid = paid !== null && !isNaN(paid) && paid >= 0 ? paid : computePaid(rec.data);
    const balance = totalAmount - newPaid;
    const autoStatus = balance <= 0 ? "Completed" : (newPaid > 0 ? "Partially Paid" : "Pending");

    // SERVER-BOUND WRITE OBJECT:
    // Only mutates permitted fields (payments, status, stage, remarks).
    // NEVER overwrites customerName, executiveName, phone, totalAmount, isLocked, createdBy, createdAt.
    const updates = {
      status: autoStatus,
      currentStage: stage,
      workStatus: stage === "Completed" ? "Completed" : "Not Completed",
      remarks: remarks,
      updatedAt: serverTimestamp()
    };

    if (paid !== null && !isNaN(paid) && paid >= 0) {
      let payments = rec.data.payments ? [...rec.data.payments] : [];
      if (payments.length === 0) {
        if (paid > 0) {
          payments.push({ amount: paid, date: date });
        }
      } else {
        const otherPaymentsTotal = payments.slice(0, -1).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const lastAmount = paid - otherPaymentsTotal;
        if (lastAmount >= 0) {
          payments[payments.length - 1] = {
            ...payments[payments.length - 1],
            amount: lastAmount,
            date: date
          };
        } else {
          payments = [{ amount: paid, date: date }];
        }
      }
      updates.payments = payments;
    }

    try {
      await updateDoc(doc(db, "customerPayments", editID), updates);
      closePopup();
      alert("Record updated successfully!");
    } catch (err) {
      alert("Failed to save changes: " + err.message);
    }
  };
}

/* ================= WORK PROGRESS MODAL ================= */

function openProgressModal(rec) {
  progressActiveRecord = rec;
  const d = rec.data;
  const isLocked = d.isLocked === true;

  const nameEl = document.getElementById("progressModalCustomerName");
  if (nameEl) nameEl.textContent = `${d.customerName || "Customer"} — Stage Tracking`;

  const subEl = document.querySelector("#progressModal .erpModalSub");
  if (subEl) {
    subEl.innerHTML = `Update and track installation/service progress for this customer.`;
  }

  const formEl = document.getElementById("progressForm");
  if (formEl) {
    formEl.style.display = "block";
  }

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
    remarksInput.readOnly = false;
    remarksInput.placeholder = "What was done / next steps...";
  }

  const submitBtn = document.querySelector("#progressForm button[type='submit']");
  if (submitBtn) {
    submitBtn.style.display = "block";
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Progress Update";
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
        <div>🔒 <strong>Lock Status:</strong> ${isLocked ? '<span style="color:#ef4444;font-weight:700;">Locked (Admin only)</span>' : '<span style="color:#22c55e;font-weight:700;">Unlocked</span>'}</div>
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
