// Admin Panel Core Logic
import { checkSession } from "./auth.js";
checkSession("admin");

import { logActivity } from "./audit-log.js";

import { db, auth } from "./firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.logoutAdmin = async function () {
  try {
    await signOut(auth);
  } catch(e) {}
  window.location.href = "/index.html";
};

export const PROGRESS_STAGES = [
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
  const dateObj = (d instanceof Date && !isNaN(d)) ? d : new Date();
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

window.showSection = function (id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
};

const table = document.getElementById("customerTable");
const searchInput = document.getElementById("searchInput");
const pendingCheckbox = document.getElementById("pendingOnly");

if (searchInput) searchInput.addEventListener("input", renderDashboard);
if (pendingCheckbox) pendingCheckbox.addEventListener("change", renderDashboard);

let allDocs = [];

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  onSnapshot(collection(db, "customerPayments"), (snapshot) => {
    allDocs = [];
    snapshot.forEach(docSnap => {
      allDocs.push({ id: docSnap.id, ...docSnap.data() });
    });
    window.__adminAllDocs = allDocs;
    renderDashboard();
  }, (err) => {
    console.warn("customerPayments sync:", err);
  });

  onSnapshot(collection(db, "attendance"), (snapshot) => {
    const today = formatDateStr(new Date());
    const uniqueEmployees = new Set();
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date === today) {
        const eid = data.employeeId || data.userId;
        if (eid) uniqueEmployees.add(eid);
      }
    });
    const todayPresentEl = document.getElementById("todayPresent");
    if (todayPresentEl) todayPresentEl.innerText = uniqueEmployees.size;
  }, (err) => {
    console.warn("attendance sync:", err);
  });
});

function renderDashboard() {
  if (!table) return;

  let totalRevenue = 0;
  let totalPending = 0;
  table.innerHTML = "";

  const searchText = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const pendingOnly = pendingCheckbox ? pendingCheckbox.checked : false;

  const sortedDocs = [...allDocs].sort((a, b) => {
    const tA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() / 1000 : 0);
    const tB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() / 1000 : 0);
    return tB - tA;
  });

  let serial = 1;

  sortedDocs.forEach(data => {
    const payments = data.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = (Number(data.totalAmount) || 0) - totalPaid;
    const status = data.status || (balance <= 0 ? "Completed" : "Pending");
    const currentStage = data.currentStage || "Registration";

    // Format Created Date
    const dateStr = data.createdAt?.seconds
      ? new Date(data.createdAt.seconds * 1000).toLocaleDateString("en-IN")
      : (typeof data.createdAt === "string" ? data.createdAt.split("T")[0] : "-");

    // Work Status (Completed vs Not Completed)
    const workStatus = data.workStatus || (currentStage === "Completed" ? "Completed" : "Not Completed");
    const isWorkDone = workStatus === "Completed";
    const workBtnHtml = isWorkDone
      ? `<button class="action" onclick="toggleAdminWorkStatus('${data.id}', 'Completed')" style="background:#10b981;color:#fff;border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;" title="Click to change to Not Completed">Completed ✅</button>`
      : `<button class="action" onclick="toggleAdminWorkStatus('${data.id}', 'Not Completed')" style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid #f59e0b;padding:4px 8px;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;" title="Click to change to Completed">Not Completed ⏳</button>`;

    if (searchText) {
      const custMatch = (data.customerName || "").toLowerCase().includes(searchText);
      const execMatch = (data.executiveName || "").toLowerCase().includes(searchText);
      const phoneMatch = (data.phone || "").toLowerCase().includes(searchText);
      if (!custMatch && !execMatch && !phoneMatch) return;
    }

    if (pendingOnly && balance <= 0) return;

    totalRevenue += totalPaid;
    totalPending += (balance > 0 ? balance : 0);

    const isLocked = data.isLocked !== false;

    table.innerHTML += `
    <tr data-created="${data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : ''}">
      <td class="serial">${serial++}</td>
      <td>${escapeHtml(data.customerName || "-")}</td>
      <td>${escapeHtml(data.phone || "-")}</td>
      <td>${escapeHtml(data.executiveName || "-")}</td>
      <td>₹${Number(data.totalAmount || 0).toLocaleString()}</td>
      <td>₹${totalPaid.toLocaleString()}</td>
      <td style="color:${balance <= 0 ? '#00e676' : '#ff5252'}">₹${balance.toLocaleString()}</td>
      <td><span class="erpStatusBadge ${status}">${status}</span></td>
      <td><span class="stageBadge" style="font-weight:600;color:#ff9800;">${escapeHtml(currentStage)}</span></td>
      <td>${workBtnHtml}</td>
      <td><span style="font-size:12px;color:#94a3b8;">${dateStr}</span></td>
      <td>
        <button class="action" onclick="openAdminEdit('${data.id}')" style="background:#3498db;color:#fff;">Edit</button>
      </td>
      <td><button class="pay-btn" onclick="addPayment('${data.id}')">Add</button></td>
      <td>
        <button class="${isLocked ? 'unlock-btn' : 'lock-btn'}" onclick="toggleLock('${data.id}', ${isLocked})">
          ${isLocked ? 'Unlock' : 'Lock'}
        </button>
      </td>
      <td>
        <button class="deleteBtn action" onclick="openDeleteConfirm('${data.id}', '${escapeHtml(data.customerName || '').replace(/'/g, "\\'")}')">Delete</button>
      </td>
      <td>
        <button class="action" onclick="openAdminProgress('${data.id}')" style="background:#9b59b6;color:#fff;">Progress</button>
      </td>
    </tr>`;
  });

  const revEl = document.getElementById("totalRevenue");
  const pendEl = document.getElementById("totalPending");
  if (revEl) revEl.innerText = "₹ " + totalRevenue.toLocaleString();
  if (pendEl) pendEl.innerText = "₹ " + totalPending.toLocaleString();

  document.dispatchEvent(new CustomEvent("adminTableRendered"));
}

window.toggleAdminWorkStatus = async function (id, currentStatus) {
  const newStatus = currentStatus === "Completed" ? "Not Completed" : "Completed";
  try {
    await updateDoc(doc(db, "customerPayments", id), {
      workStatus: newStatus,
      updatedAt: serverTimestamp()
    });
    logActivity("Admin toggled work status", `id=${id}, workStatus=${newStatus}`);
  } catch (err) {
    alert("Failed to update work status: " + err.message);
  }
};

/* ==========================================================
   ADMIN FULL EDIT RECORD (Edit EVERYTHING with NO restrictions)
========================================================== */

let activeEditId = null;

window.openAdminEdit = function (id) {
  activeEditId = id;
  const rec = allDocs.find(r => r.id === id);
  if (!rec) return;

  const headerEl = document.getElementById("adminEditCustomerHeader");
  if (headerEl) headerEl.textContent = `Edit Customer — ${rec.customerName || "Customer"}`;

  const nameInput = document.getElementById("adminEditCustomerName");
  const phoneInput = document.getElementById("adminEditPhone");
  const execInput = document.getElementById("adminEditExecutiveName");
  const totalInput = document.getElementById("adminEditTotalAmount");
  const statusSelect = document.getElementById("adminEditStatus");
  const stageSelect = document.getElementById("adminEditStage");
  const workStatusSelect = document.getElementById("adminEditWorkStatus");
  const lockSelect = document.getElementById("adminEditLockStatus");
  const remarksInput = document.getElementById("adminEditRemarks");
  const statusMsg = document.getElementById("adminEditFormStatus");

  if (nameInput) nameInput.value = rec.customerName || "";
  if (phoneInput) phoneInput.value = rec.phone || "";
  if (execInput) execInput.value = rec.executiveName || "";
  if (totalInput) totalInput.value = rec.totalAmount || 0;
  if (statusSelect) statusSelect.value = rec.status || "Pending";
  if (stageSelect) stageSelect.value = rec.currentStage || "Registration";
  if (workStatusSelect) workStatusSelect.value = rec.workStatus || (rec.currentStage === "Completed" ? "Completed" : "Not Completed");
  if (lockSelect) lockSelect.value = rec.isLocked === false ? "open" : "locked";
  if (remarksInput) remarksInput.value = rec.remarks || "";
  if (statusMsg) statusMsg.textContent = "";

  const modal = document.getElementById("adminEditRecordModal");
  if (modal) modal.classList.add("open");
};

const adminEditCloseBtn = document.getElementById("adminEditCloseBtn");
if (adminEditCloseBtn) {
  adminEditCloseBtn.addEventListener("click", () => {
    const modal = document.getElementById("adminEditRecordModal");
    if (modal) modal.classList.remove("open");
    activeEditId = null;
  });
}

const adminEditSaveBtn = document.getElementById("adminEditSaveBtn");
if (adminEditSaveBtn) {
  adminEditSaveBtn.addEventListener("click", async () => {
    if (!activeEditId) return;

    const name = document.getElementById("adminEditCustomerName")?.value.trim();
    const phone = document.getElementById("adminEditPhone")?.value.trim() || "";
    const exec = document.getElementById("adminEditExecutiveName")?.value.trim() || "";
    const total = Number(document.getElementById("adminEditTotalAmount")?.value) || 0;
    const status = document.getElementById("adminEditStatus")?.value || "Pending";
    const stage = document.getElementById("adminEditStage")?.value || "Registration";
    const workStatus = document.getElementById("adminEditWorkStatus")?.value || "Not Completed";
    const lockStatus = document.getElementById("adminEditLockStatus")?.value;
    const remarks = document.getElementById("adminEditRemarks")?.value.trim() || "";
    const statusMsg = document.getElementById("adminEditFormStatus");

    if (!name || total <= 0) {
      if (statusMsg) statusMsg.textContent = "Please provide customer name and valid total amount.";
      return;
    }

    if (statusMsg) statusMsg.textContent = "Saving changes…";

    try {
      await updateDoc(doc(db, "customerPayments", activeEditId), {
        customerName: name,
        phone: phone,
        executiveName: exec,
        totalAmount: total,
        status: status,
        currentStage: stage,
        workStatus: workStatus,
        isLocked: lockStatus === "locked",
        remarks: remarks,
        updatedAt: serverTimestamp()
      });

      logActivity("Admin edited customer record", `customerId=${activeEditId}, customer=${name}`);

      const modal = document.getElementById("adminEditRecordModal");
      if (modal) modal.classList.remove("open");
      activeEditId = null;
    } catch (err) {
      if (statusMsg) statusMsg.textContent = "Failed to save: " + err.message;
    }
  });
}

/* ==========================================================
   SIMPLIFIED CUSTOMER PROGRESS: Current Stage -> Next Stage -> Save / Cancel
========================================================== */

let activeProgressId = null;

window.openAdminProgress = function (id) {
  activeProgressId = id;
  const rec = allDocs.find(r => r.id === id);
  if (!rec) return;

  const nameEl = document.getElementById("adminProgressCustomerName");
  if (nameEl) nameEl.textContent = `Customer Progress — ${rec.customerName || "Customer"}`;

  const curStage = rec.currentStage || rec.workStatus || "Registration";
  const curStageEl = document.getElementById("adminProgressCurrentStage");
  if (curStageEl) curStageEl.textContent = curStage;

  const stageSelect = document.getElementById("adminProgressStageInput");
  if (stageSelect) {
    stageSelect.innerHTML = PROGRESS_STAGES.map(s => `<option value="${s}" ${s === curStage ? 'selected' : ''}>${s}</option>`).join("");
    
    // Default to the next sequential stage if available
    const curIdx = PROGRESS_STAGES.indexOf(curStage);
    if (curIdx >= 0 && curIdx < PROGRESS_STAGES.length - 1) {
      stageSelect.value = PROGRESS_STAGES[curIdx + 1];
    }
  }

  const statusMsg = document.getElementById("adminProgressFormStatus");
  if (statusMsg) statusMsg.textContent = "";

  const modal = document.getElementById("adminProgressModal");
  if (modal) modal.classList.add("open");
};

const adminProgressCloseBtn = document.getElementById("adminProgressCloseBtn");
if (adminProgressCloseBtn) {
  adminProgressCloseBtn.addEventListener("click", () => {
    const modal = document.getElementById("adminProgressModal");
    if (modal) modal.classList.remove("open");
    activeProgressId = null;
  });
}

const adminProgressSaveBtn = document.getElementById("adminProgressSaveBtn");
if (adminProgressSaveBtn) {
  adminProgressSaveBtn.addEventListener("click", async () => {
    if (!activeProgressId) return;

    const nextStage = document.getElementById("adminProgressStageInput")?.value;
    const statusMsg = document.getElementById("adminProgressFormStatus");

    if (!nextStage) {
      if (statusMsg) statusMsg.textContent = "Please select next stage.";
      return;
    }

    if (statusMsg) statusMsg.textContent = "Updating stage…";

    try {
      await updateDoc(doc(db, "customerPayments", activeProgressId), {
        currentStage: nextStage,
        workStatus: nextStage === "Completed" ? "Completed" : "Not Completed",
        updatedAt: serverTimestamp()
      });

      logActivity("Updated customer stage", `customerId=${activeProgressId}, stage=${nextStage}`);

      const modal = document.getElementById("adminProgressModal");
      if (modal) modal.classList.remove("open");
      activeProgressId = null;
    } catch (err) {
      if (statusMsg) statusMsg.textContent = "Failed to update: " + err.message;
    }
  });
}

/* ==========================================================
   DELETE CONFIRMATION
========================================================== */

let pendingDeleteId = null;

window.openDeleteConfirm = function (id, customerLabel) {
  pendingDeleteId = id;
  const subEl = document.getElementById("deleteConfirmSub");
  if (subEl) subEl.textContent = `Customer: ${customerLabel}`;
  const modal = document.getElementById("deleteConfirmModal");
  if (modal) modal.classList.add("open");
};

document.getElementById("deleteCancelBtn")?.addEventListener("click", () => {
  pendingDeleteId = null;
  document.getElementById("deleteConfirmModal")?.classList.remove("open");
});

document.getElementById("deleteConfirmBtn")?.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;

  try {
    await deleteDoc(doc(db, "customerPayments", id));
    logActivity("Deleted customer record", `customerPaymentId=${id}`);
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }

  pendingDeleteId = null;
  document.getElementById("deleteConfirmModal")?.classList.remove("open");
});

/* ==========================================================
   ADD PAYMENT & LOCKING
========================================================== */

window.addPayment = async function (id) {
  const confirmAction = confirm("Are you sure you want to add payment?");
  if (!confirmAction) return;

  const amount = prompt("Enter Payment Amount:");
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    alert("Invalid amount.");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "customerPayments", id));
    if (!snap.exists()) return;
    const data = snap.data();

    const payments = data.payments ? [...data.payments] : [];
    payments.push({
      amount: Number(amount),
      date: formatDateStr(new Date())
    });

    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = (Number(data.totalAmount) || 0) - totalPaid;

    await updateDoc(doc(db, "customerPayments", id), {
      payments: payments,
      status: balance <= 0 ? "Completed" : "Partially Paid"
    });

    alert("Payment added successfully.");
    logActivity("Added payment", `customerPaymentId=${id}, amount=${amount}`);
  } catch (error) {
    console.error(error);
    alert("Failed to add payment: " + error.message);
  }
};

window.toggleLock = async function (id, state) {
  const action = state ? "Unlock" : "Lock";
  const confirmAction = confirm(`Are you sure you want to ${action} this record?`);
  if (!confirmAction) return;

  try {
    await updateDoc(doc(db, "customerPayments", id), {
      isLocked: !state
    });
    logActivity(state ? "Unlocked customer record" : "Locked customer record", `customerPaymentId=${id}`);
  } catch (error) {
    console.error(error);
    alert("Failed to update lock status: " + error.message);
  }
};

window.exportFullReport = async function () {
  const snapshot = await getDocs(collection(db, "customerPayments"));
  let csv = "Customer,Phone,Executive,Total,Paid,Balance,Status,Stage\n";
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const payments = data.payments || [];
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = (Number(data.totalAmount) || 0) - totalPaid;
    csv += `"${data.customerName || ''}","${data.phone || ''}","${data.executiveName || ''}",${data.totalAmount || 0},${totalPaid},${balance},"${data.status || ''}","${data.currentStage || ''}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Full_Report.csv";
  link.click();
};

/* ==========================================================
   ATTENDANCE CLOSING TIME & REPORTS & HOLIDAYS
========================================================== */

async function loadClosingTime() {
  try {
    const snap = await getDoc(doc(db, "settings", "attendance"));
    if (snap.exists()) {
      const data = snap.data();
      let h24 = data.closeHour ?? 10;
      let min = data.closeMinute ?? 0;
      let ampm = h24 >= 12 ? "PM" : "AM";
      let h12 = h24 % 12 || 12;

      const hEl = document.getElementById("closeHourInput");
      const mEl = document.getElementById("closeMinuteInput");
      const aEl = document.getElementById("closeAmpmInput");

      if (hEl) hEl.value = h12;
      if (mEl) mEl.value = min;
      if (aEl) aEl.value = ampm;
    }
  } catch (e) {
    console.error("Error loading closing time:", e);
  }
}
loadClosingTime();

window.updateCloseTime = async function () {
  const h12 = parseInt(document.getElementById("closeHourInput")?.value || 10);
  const minute = parseInt(document.getElementById("closeMinuteInput")?.value || 0);
  const ampm = document.getElementById("closeAmpmInput")?.value || "AM";

  let h24 = h12;
  if (ampm === "PM" && h12 < 12) h24 = h12 + 12;
  if (ampm === "AM" && h12 === 12) h24 = 0;

  try {
    await setDoc(doc(db, "settings", "attendance"), {
      closeHour: h24,
      closeMinute: minute,
      displayTime: `${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm}`
    }, { merge: true });

    document.getElementById("timeStatus").innerHTML = `<span style="color:#22c55e;">✅ Closing time updated to ${String(h12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm} successfully!</span>`;
    logActivity("Updated attendance closing time", `time=${h12}:${minute} ${ampm} (24h: ${h24}:${minute})`);
  } catch (err) {
    document.getElementById("timeStatus").innerHTML = `<span style="color:#ef4444;">Failed to update: ${err.message}</span>`;
  }
};

window.generateAttendanceReport = async function () {
  const month = document.getElementById("reportMonth").value;
  if (!month) {
    alert("Please select month.");
    return;
  }

  const [attendanceSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "attendance")),
    getDocs(collection(db, "users"))
  ]);

  const userMap = {};
  usersSnap.forEach(docSnap => {
    userMap[docSnap.id] = docSnap.data().name || "Unknown";
  });

  const reportMap = {};
  attendanceSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.date?.startsWith(month)) {
      const empId = data.employeeId || data.userId;
      if (empId) {
        if (!reportMap[empId]) reportMap[empId] = 0;
        reportMap[empId]++;
      }
    }
  });

  let html = "<table><tr><th>Employee Name</th><th>Present Days</th></tr>";
  for (const empId in reportMap) {
    const empName = userMap[empId] || "Unknown";
    html += `<tr><td>${escapeHtml(empName)}</td><td>${reportMap[empId]}</td></tr>`;
  }
  html += "</table>";

  document.getElementById("attendanceReportData").innerHTML = html;
};

const holidayTable = document.getElementById("holidayTable");

async function loadHolidays() {
  if (!holidayTable) return;
  holidayTable.innerHTML = "";

  const snapshot = await getDocs(collection(db, "settings", "holidays", "holidayList"));
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${data.date}</td>
      <td>${escapeHtml(data.name)}</td>
      <td>
        <button class="lock-btn" onclick="deleteHoliday('${docSnap.id}')">Delete</button>
      </td>
    `;
    holidayTable.appendChild(row);
  });
}

window.addHoliday = async function () {
  const date = document.getElementById("holidayDate").value;
  const name = document.getElementById("holidayName").value.trim();

  if (!date || !name) {
    document.getElementById("holidayMessage").innerText = "Fill all fields.";
    return;
  }

  await setDoc(doc(db, "settings", "holidays", "holidayList", date), { name, date });

  document.getElementById("holidayMessage").innerText = "Holiday Added Successfully.";
  document.getElementById("holidayDate").value = "";
  document.getElementById("holidayName").value = "";

  logActivity("Added holiday", `date=${date}, name=${name}`);
  loadHolidays();
};

window.deleteHoliday = async function (date) {
  if (!confirm("Delete this holiday?")) return;
  await deleteDoc(doc(db, "settings", "holidays", "holidayList", date));
  logActivity("Deleted holiday", `date=${date}`);
  loadHolidays();
};

loadHolidays();
