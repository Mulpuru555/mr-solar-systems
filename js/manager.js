import { auth, db } from "./firebase-config.js";
import { checkSession } from "./auth.js";
import { logActivity } from "./audit-log.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

checkSession("manager");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const attendanceBody = document.getElementById("attendanceTable");
const blockedBody = document.getElementById("blockedTable");
const summaryBody = document.getElementById("summaryTable");
const dateInput = document.getElementById("attendanceDate");
const popup = document.getElementById("photoPopup");
const popupImg = document.getElementById("popupImg");
const progressListEl = document.getElementById("managerProgressList");
const progressSearchInput = document.getElementById("managerProgressSearchInput");
const metricsContainer = document.getElementById("attendanceReportMetrics");

/* ================= LOGIN & AUTH ================= */

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "/index.html";
  }
});

window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = "/index.html";
};

/* ================= MODULE NAVIGATION TABS ================= */

window.switchManagerModule = (moduleId) => {
  document.querySelectorAll(".managerModule").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".navTabBtn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(moduleId);
  if (target) target.classList.add("active");

  const activeBtn = document.querySelector(`[data-module="${moduleId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  sessionStorage.setItem("mrs_active_mgr_tab", moduleId);
};

// Restore saved tab or default to attendanceModule
const savedTab = sessionStorage.getItem("mrs_active_mgr_tab") || "attendanceModule";
window.switchManagerModule(savedTab);

/* ================= DATE HELPER (Local Timezone) ================= */

function formatDateStr(d = new Date()) {
  const dateObj = (d instanceof Date && !isNaN(d)) ? d : new Date();
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const today = formatDateStr(new Date());
if (dateInput) dateInput.value = today;

let cachedUsers = [];
let userMap = {};
let cachedAttendance = [];
let cachedHolidays = {};
let cachedCustomers = [];

/* ================= ATTENDANCE REPORT ================= */

async function renderAttendance(date) {
  if (!attendanceBody) return;
  attendanceBody.innerHTML = "";

  const selectedDate = date || today;
  const parts = selectedDate.split("-");
  const selectedDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

  const isSunday = selectedDateObj.getDay() === 0;
  const holidayName = cachedHolidays[selectedDate] || "";
  const isFuture = selectedDate > today;

  const map = {};
  cachedAttendance.forEach(docItem => {
    const data = docItem.data || docItem;
    if (data.date !== selectedDate) return;

    const empId = data.employeeId || data.userId;
    if (!empId) return;

    if (!map[empId]) {
      map[empId] = [];
    }
    map[empId].push(data);
  });

  const employees = cachedUsers.filter(u => {
    const role = (u.role || "employee").toLowerCase();
    return role !== "admin" && role !== "manager";
  });

    // Also check nested hierarchy /attendance/{employeeId}/{selectedDate}/data for any missing records
  await Promise.all(employees.map(async (u) => {
    if (!map[u.id] || map[u.id].length === 0) {
      try {
        const directSnap = await getDoc(doc(db, "attendance", u.id, selectedDate, "data"));
        if (directSnap.exists()) {
          const dData = directSnap.data();
          if (dData.status === "present" || dData.status === "late") {
            map[u.id] = [dData];
          }
        }
      } catch (e) {}
    }
  }));
  if (employees.length === 0) {
    attendanceBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a97a6;padding:16px;">No employee records found.</td></tr>`;
    if (metricsContainer) metricsContainer.innerHTML = "";
    return;
  }

  let presentCount = 0;
  let absentCount = 0;

  employees.forEach(user => {
    const rows = map[user.id] || [];
    const branch = user.branch || "-";

    if (rows.length === 0) {
      let statusLabel = "";
      if (isFuture) {
        statusLabel = `<span style="color:#94a3b8;font-weight:600;">Upcoming</span>`;
      } else if (isSunday) {
        statusLabel = `<span style="color:#facc15;font-weight:600;">Sunday (Off)</span>`;
      } else if (holidayName) {
        statusLabel = `<span style="color:#facc15;font-weight:600;">Holiday (${escapeHtml(holidayName)})</span>`;
      } else {
        statusLabel = `<span style="color:#ef4444;font-weight:700;">Absent</span>`;
        absentCount++;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(user.name || "Employee")}</strong></td>
        <td>${escapeHtml(branch)}</td>
        <td>${statusLabel}</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
      `;
      attendanceBody.appendChild(tr);
      return;
    }

    presentCount++;
    rows.forEach(r => {
      let time = "-";
      if (r.timestamp?.seconds) {
        time = new Date(r.timestamp.seconds * 1000).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
      } else if (r.time?.seconds) {
        time = new Date(r.time.seconds * 1000).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
      } else if (typeof r.time === "string") {
        time = r.time;
      }

      const imgHTML = r.photoURL
        ? `<img src="${r.photoURL}" width="48" height="48" style="border-radius:6px;cursor:pointer;object-fit:cover;border:1px solid rgba(255,255,255,0.2);" class="photo" alt="Photo">`
        : "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(user.name || "Employee")}</strong></td>
        <td>${escapeHtml(branch)}</td>
        <td><span style="color:${(r.isLate || r.status === 'late') ? '#f59e0b' : '#22c55e'};font-weight:700;">${(r.isLate || r.status === 'late') ? 'Late Mark' : 'Present'}</span></td>
        <td>${escapeHtml(r.type || "Check-in")}</td>
        <td>${escapeHtml(time)}</td>
        <td>${imgHTML}</td>
      `;
      attendanceBody.appendChild(tr);
    });
  });

  // Render quick metrics cards
  if (metricsContainer) {
    const dayTypeLabel = isSunday
      ? "Sunday (Weekly Off)"
      : (holidayName ? `Holiday (${holidayName})` : "Standard Working Day");

    metricsContainer.innerHTML = `
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 16px;font-size:12px;">
        <span style="color:#94a3b8;">Selected Date:</span> <strong>${selectedDate}</strong> (${dayTypeLabel})
      </div>
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 16px;font-size:12px;">
        <span style="color:#94a3b8;">Total Staff:</span> <strong>${employees.length}</strong>
      </div>
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:10px 16px;font-size:12px;">
        <span style="color:#94a3b8;">Present:</span> <strong style="color:#22c55e;">${presentCount}</strong>
      </div>
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:10px 16px;font-size:12px;">
        <span style="color:#94a3b8;">Absent:</span> <strong style="color:#ef4444;">${absentCount}</strong>
      </div>
    `;
  }

  attendanceBody.querySelectorAll(".photo").forEach(img => {
    img.onclick = () => {
      if (popup && popupImg) {
        popup.style.display = "flex";
        popupImg.src = img.src;
      }
    };
  });
}

if (popup) {
  popup.onclick = () => {
    popup.style.display = "none";
  };
}

/* ================= MONTHLY ATTENDANCE SUMMARY ================= */

function renderSummary() {
  if (!summaryBody) return;
  summaryBody.innerHTML = "";

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  let workingDays = 0;

  // Count working days strictly up to today in the current month
  for (let d = 1; d <= now.getDate(); d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const day = new Date(year, month - 1, d);

    if (day.getDay() === 0) continue; // Skip Sundays
    if (cachedHolidays[dateStr]) continue; // Skip declared holidays

    workingDays++;
  }

  const presentMap = {};
  cachedAttendance.forEach(docItem => {
    const data = docItem.data || docItem;
    if (!data.date || !data.date.startsWith(monthPrefix)) return;

    // Skip future dates if any exist
    if (data.date > today) return;

    const parts = data.date.split("-");
    const docDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (docDate.getDay() === 0) return; // Sunday
    if (cachedHolidays[data.date]) return; // Holiday

    const empId = data.employeeId || data.userId;
    if (!empId) return;

    const key = `${empId}_${data.date}`;
    presentMap[key] = true;
  });

  const empCount = {};
  Object.keys(presentMap).forEach(k => {
    const id = k.split("_")[0];
    empCount[id] = (empCount[id] || 0) + 1;
  });

  const employees = cachedUsers.filter(u => {
    const role = (u.role || "employee").toLowerCase();
    return role !== "admin" && role !== "manager";
  });

  if (employees.length === 0) {
    summaryBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#8a97a6;padding:16px;">No employees found.</td></tr>`;
    return;
  }

  employees.forEach(user => {
    const present = Math.min(empCount[user.id] || 0, workingDays);
    const absent = Math.max(0, workingDays - present);
    const pct = workingDays > 0 ? Math.min(100, Math.round((present / workingDays) * 100)) : 100;

    let pctColor = "#22c55e";
    if (pct < 75) pctColor = "#ef4444";
    else if (pct < 90) pctColor = "#f59e0b";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(user.name || "Employee")}</strong></td>
      <td>${escapeHtml(user.branch || "-")}</td>
      <td>${workingDays}</td>
      <td><span style="color:#22c55e;font-weight:700;">${present}</span></td>
      <td><span style="color:#ef4444;font-weight:700;">${absent}</span></td>
      <td><span style="color:${pctColor};font-weight:700;background:rgba(255,255,255,0.06);padding:3px 10px;border-radius:12px;">${pct}%</span></td>
    `;
    summaryBody.appendChild(tr);
  });
}

/* ================= CUSTOMER PROGRESS & ERP (VIEW ONLY FOR MANAGER) ================= */

function renderCustomerProgress() {
  if (!progressListEl) return;

  const search = (progressSearchInput?.value || "").toLowerCase().trim();

  const filtered = cachedCustomers.filter(c => {
    const custName = (c.customerName || c.name || "").toLowerCase();
    const execName = (c.executiveName || userMap[c.createdBy || c.userId]?.name || "").toLowerCase();
    const branch = (c.branch || userMap[c.createdBy || c.userId]?.branch || "").toLowerCase();
    const stage = (c.currentStage || c.workStatus || "").toLowerCase();

    if (!search) return true;
    return custName.includes(search) || execName.includes(search) || branch.includes(search) || stage.includes(search);
  });

  if (filtered.length === 0) {
    progressListEl.innerHTML = `<div style="color:#8a97a6;font-size:13px;padding:16px;text-align:center;background:rgba(15,23,42,0.6);border-radius:8px;">No customer progress records matching search.</div>`;
    return;
  }

  progressListEl.innerHTML = filtered.map(c => {
    const custName = c.customerName || c.name || `Customer (#${c.id.slice(0, 6)})`;
    const execName = c.executiveName || userMap[c.createdBy || c.userId]?.name || "Staff";
    const branch = c.branch || userMap[c.createdBy || c.userId]?.branch || "-";
    const phone = c.phone || "-";
    const stage = c.currentStage || c.workStatus || "Registration";
    const total = Number(c.totalAmount || 0);
    const payments = c.payments || [];
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = total - paid;
    const isLocked = c.isLocked !== false;

    return `
    <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:12px;box-shadow:0 4px 14px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center;">
        <strong style="font-size:16px;color:#fff;">${escapeHtml(custName)}</strong>
        <div>
          <span style="font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);padding:3px 10px;border-radius:12px;font-size:12px;margin-right:6px;">${escapeHtml(stage)}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:12px;border:1px solid ${isLocked ? 'rgba(239,68,68,0.4);color:#ef4444;background:rgba(239,68,68,0.1);' : 'rgba(34,197,94,0.4);color:#22c55e;background:rgba(34,197,94,0.1);'}">${isLocked ? '🔒 Locked' : '🔓 Open'}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:10px;margin-top:10px;font-size:13px;color:#cfd8e3;">
        <div>👤 Executive: <strong style="color:#ff9800;">${escapeHtml(execName)}</strong></div>
        <div>🏢 Branch: <strong style="color:#fff;">${escapeHtml(branch)}</strong></div>
        <div>📞 Phone: <span>${escapeHtml(phone)}</span></div>
        <div>💰 Total: <strong>₹${total.toLocaleString()}</strong> | Paid: <strong style="color:#22c55e;">₹${paid.toLocaleString()}</strong> | Balance: <strong style="color:${balance <= 0 ? '#22c55e' : '#ef4444'};">₹${balance.toLocaleString()}</strong></div>
      </div>
      ${c.remarks ? `<div style="margin-top:8px;font-size:12px;color:#94a3b8;">💬 Remarks: <em>"${escapeHtml(c.remarks)}"</em></div>` : ""}
    </div>`;
  }).join("");
}

if (progressSearchInput) {
  progressSearchInput.addEventListener("input", renderCustomerProgress);
}

/* ================= BLOCKED EMPLOYEES ================= */

async function loadBlocked() {
  if (!blockedBody) return;
  blockedBody.innerHTML = "";

  try {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("accountStatus", "==", "blocked")
      )
    );

    if (snap.empty) {
      blockedBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#8a97a6;padding:16px;">No blocked employees.</td></tr>`;
      return;
    }

    snap.forEach(d => {
      const user = d.data();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(user.name || "-")}</strong></td>
        <td>${escapeHtml(user.branch || "-")}</td>
        <td>${escapeHtml(user.blockedReason || "Security policy trigger")}</td>
        <td>
          <button data-id="${d.id}" data-name="${escapeHtml(user.name || "")}" class="unblockBtn action" style="background:#059669;padding:6px 12px;font-size:12px;">Unblock</button>
        </td>
      `;
      blockedBody.appendChild(tr);
    });

    blockedBody.querySelectorAll(".unblockBtn").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (!confirm(`Are you sure you want to unblock ${name}?`)) return;

        try {
          await updateDoc(doc(db, "users", id), {
            accountStatus: "active",
            blockedReason: null
          });
          logActivity(auth.currentUser?.uid || "manager", "unblock_user", `Unblocked employee ${name}`);
          alert(`${name} has been unblocked.`);
          loadBlocked();
        } catch (err) {
          alert("Failed to unblock user: " + err.message);
        }
      };
    });
  } catch (err) {
    console.error("Blocked load error:", err);
  }
}

/* ================= INITIALIZE MANAGER PORTAL ================= */

async function initManagerPortal() {
  // 1. Fetch holidays
  try {
    const holidaySnap = await getDocs(collection(db, "settings", "holidays", "holidayList"));
    cachedHolidays = {};
    holidaySnap.forEach(d => {
      cachedHolidays[d.id] = d.data().name || "Company Holiday";
    });
  } catch (e) {
    console.warn("Could not fetch holidays:", e);
  }

  // 2. Realtime Users
  onSnapshot(collection(db, "users"), (snap) => {
    cachedUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    userMap = {};
    cachedUsers.forEach(u => { userMap[u.id] = u; });
    const selectedDate = dateInput?.value || today;
    renderAttendance(selectedDate);
    renderSummary();
    renderCustomerProgress();
  });

  // 3. Realtime Attendance
  onSnapshot(collection(db, "attendance"), (snap) => {
    cachedAttendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const selectedDate = dateInput?.value || today;
    renderAttendance(selectedDate);
    renderSummary();
  });

  // 4. Realtime Customer ERP
  onSnapshot(collection(db, "customerPayments"), (snap) => {
    cachedCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cachedCustomers.sort((a, b) => {
      const tA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
    renderCustomerProgress();
  });

  if (dateInput) {
    dateInput.addEventListener("change", () => {
      renderAttendance(dateInput.value);
    });
  }

  loadBlocked();
}

initManagerPortal();
