import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getPreviousMonthPrefix(yearMonthStr) {
  const parts = yearMonthStr.split("-");
  let y = Number(parts[0]);
  let m = Number(parts[1]) - 1;
  if (m < 1) {
    m = 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function safeGetDateStr(val) {
  if (!val) return "";
  if (typeof val === "string") {
    return val.includes("T") ? val.split("T")[0] : (val.includes(" ") ? val.split(" ")[0] : val);
  }
  if (val && typeof val === "object") {
    if (typeof val.toDate === "function") return val.toDate().toISOString().split("T")[0];
    if (val.seconds !== undefined) return new Date(val.seconds * 1000).toISOString().split("T")[0];
    if (val instanceof Date) return val.toISOString().split("T")[0];
  }
  return "";
}

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let cachedUsers = [];
let cachedPayments = [];
let cachedLeads = [];
let cachedAttendance = [];
let cachedServiceRequests = [];
let cachedLeaveRequests = [];
let cachedInventory = [];

const leadsMonthSelect = document.getElementById("leadsMonthSelect");
const executiveLeadsTable = document.getElementById("executiveLeadsTable");
const executiveRankingsTable = document.getElementById("executiveRankingsTable");

/* ==========================================================
   POPULATE MONTH SELECTOR
========================================================== */

function initMonthSelect() {
  if (!leadsMonthSelect) return;
  leadsMonthSelect.innerHTML = "";

  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = formatDateMonth(d);
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = label + (i === 0 ? " (Current)" : "");
    leadsMonthSelect.appendChild(opt);
  }

  leadsMonthSelect.addEventListener("change", () => {
    renderMonthlyLeads();
  });
}

/* ==========================================================
   0. OVERVIEW DASHBOARD WIDGETS
========================================================== */

function renderOverviewWidgets() {
  const today = todayStr();

  // 1. Users & Staff
  let employeeCount = 0;
  let blockedCount = 0;
  const branches = new Set();
  const branchCounts = {};

  cachedUsers.forEach(u => {
    const role = (u.role || "employee").toLowerCase();
    if (role !== "admin") {
      employeeCount++;
      if (u.accountStatus === "blocked") blockedCount++;
      if (u.branch) {
        branches.add(u.branch);
        branchCounts[u.branch] = (branchCounts[u.branch] || 0) + 1;
      }
    }
  });

  setText("widgetTotalEmployees", employeeCount);
  setText("widgetBlockedCount", blockedCount);
  setText("widgetBranchCount", branches.size);

  const breakdownEl = document.getElementById("branchBreakdown");
  if (breakdownEl) {
    const entries = Object.entries(branchCounts).sort((a, b) => b[1] - a[1]);
    breakdownEl.innerHTML = entries.length === 0
      ? "<div style='color:#8a97a6;font-size:13px;'>No branch data yet.</div>"
      : entries.map(([b, c]) => `<div class="branchBreakdownRow" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span>${escapeHtml(b)}</span><strong style="color:#38bdf8;">${c}</strong></div>`).join("");
  }

  // 2. Attendance Today
  const todayAttSet = new Set();
  cachedAttendance.forEach(a => {
    if (a.date === today) {
      const eid = a.employeeId || a.userId;
      if (eid) todayAttSet.add(eid);
    }
  });
  setText("widgetTodayAttendance", todayAttSet.size);
  setText("todayPresent", todayAttSet.size);

  // 3. Today's Collections & Installations
  let todayCollections = 0;
  let todayInstallations = 0;

  cachedPayments.forEach(c => {
    (c.payments || []).forEach(p => {
      const pDate = safeGetDateStr(p.date || p.createdAt);
      if (pDate === today) {
        todayCollections += Number(p.amount) || 0;
      }
    });

    const isDone = (c.currentStage || "").toLowerCase() === "completed" || (c.status || "").toLowerCase() === "completed";
    const updateDate = safeGetDateStr(c.updatedAt || c.createdAt);
    if (isDone && updateDate === today) {
      todayInstallations++;
    }
  });

  setText("widgetTodayCollections", "₹" + todayCollections.toLocaleString("en-IN"));
  setText("widgetTodayInstallations", todayInstallations);

  // 4. Pending Service Requests
  const pendingService = cachedServiceRequests.filter(s => (s.status || "").toLowerCase() === "open" || (s.status || "").toLowerCase() === "pending").length;
  setText("widgetPendingService", pendingService);

  // 5. Pending Leave Requests
  const pendingLeaves = cachedLeaveRequests.filter(l => (l.status || "").toLowerCase() === "pending").length;
  setText("widgetPendingLeaves", pendingLeaves);

  // 6. Low Stock Alerts
  const lowStock = cachedInventory.filter(i => (Number(i.quantity) || 0) <= (Number(i.lowStockThreshold) || 0)).length;
  setText("widgetLowStockCount", lowStock);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ==========================================================
   1. TOTAL COLLECTIONS & FINANCIAL METRICS
========================================================== */

function renderCollectionsMetrics() {
  let totalCollections = 0;
  let thisMonthCollections = 0;
  let prevMonthCollections = 0;
  let totalPending = 0;

  const currentMonth = formatDateMonth(new Date());
  const prevMonth = getPreviousMonthPrefix(currentMonth);

  cachedPayments.forEach(c => {
    const totalAmount = Number(c.totalAmount || 0);
    const payments = c.payments || [];
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, totalAmount - paid);

    totalPending += balance;

    payments.forEach(p => {
      const amt = Number(p.amount) || 0;
      totalCollections += amt;

      const pDate = safeGetDateStr(p.date || p.createdAt || c.createdAt);
      if (pDate && pDate.startsWith(currentMonth)) {
        thisMonthCollections += amt;
      } else if (pDate && pDate.startsWith(prevMonth)) {
        prevMonthCollections += amt;
      }
    });
  });

  const statTotal = document.getElementById("statTotalCollections");
  const statThisMonth = document.getElementById("statThisMonthCollections");
  const statPrevMonth = document.getElementById("statPrevMonthCollections");
  const statPending = document.getElementById("statTotalPending");
  const statCount = document.getElementById("statCustomerCount");

  if (statTotal) statTotal.textContent = "₹" + totalCollections.toLocaleString("en-IN");
  if (statThisMonth) statThisMonth.textContent = "₹" + thisMonthCollections.toLocaleString("en-IN");
  if (statPrevMonth) statPrevMonth.textContent = "₹" + prevMonthCollections.toLocaleString("en-IN");
  if (statPending) statPending.textContent = "₹" + totalPending.toLocaleString("en-IN");
  if (statCount) statCount.textContent = cachedPayments.length;

  const totalRevEl = document.getElementById("totalRevenue");
  const totalPendEl = document.getElementById("totalPending");
  if (totalRevEl) totalRevEl.textContent = "₹ " + totalCollections.toLocaleString("en-IN");
  if (totalPendEl) totalPendEl.textContent = "₹ " + totalPending.toLocaleString("en-IN");
}

/* ==========================================================
   2. MONTHLY LEADS — EXECUTIVE WISE
========================================================== */

function renderMonthlyLeads() {
  if (!executiveLeadsTable) return;

  const selectedMonth = leadsMonthSelect?.value || formatDateMonth(new Date());
  const prevMonth = getPreviousMonthPrefix(selectedMonth);

  const execMap = {};

  cachedUsers.forEach(u => {
    const role = (u.role || "employee").toLowerCase();
    if (role !== "admin") {
      const name = (u.name || "Executive").trim();
      execMap[name] = { id: u.id, name, leadsThisMonth: 0, leadsPrevMonth: 0, converted: 0 };
    }
  });

  cachedPayments.forEach(c => {
    const name = (c.executiveName || "").trim();
    if (name && !execMap[name]) {
      execMap[name] = { id: c.createdBy || name, name, leadsThisMonth: 0, leadsPrevMonth: 0, converted: 0 };
    }
  });

  cachedLeads.forEach(lead => {
    const leadDate = safeGetDateStr(lead.date || lead.createdAt);
    const execName = (lead.assignedTo || lead.executiveName || "").trim();

    if (execName && execMap[execName]) {
      if (leadDate && leadDate.startsWith(selectedMonth)) {
        execMap[execName].leadsThisMonth++;
      } else if (leadDate && leadDate.startsWith(prevMonth)) {
        execMap[execName].leadsPrevMonth++;
      }
    }
  });

  cachedPayments.forEach(c => {
    const execName = (c.executiveName || "").trim();
    const createdDate = safeGetDateStr(c.createdAt);

    if (execName && execMap[execName]) {
      if (createdDate && createdDate.startsWith(selectedMonth)) {
        execMap[execName].leadsThisMonth++;
        execMap[execName].converted++;
      } else if (createdDate && createdDate.startsWith(prevMonth)) {
        execMap[execName].leadsPrevMonth++;
      }
    }
  });

  const execList = Object.values(execMap);
  execList.sort((a, b) => b.leadsThisMonth - a.leadsThisMonth || b.converted - a.converted);

  if (execList.length === 0) {
    executiveLeadsTable.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#8a97a6;padding:14px;">No executive lead data found for this month.</td></tr>`;
    return;
  }

  executiveLeadsTable.innerHTML = execList.map(item => {
    let growthHTML = `<span style="color:#94a3b8;">0%</span>`;
    if (item.leadsPrevMonth === 0 && item.leadsThisMonth > 0) {
      growthHTML = `<span style="color:#22c55e;font-weight:700;">+100% &uarr;</span>`;
    } else if (item.leadsPrevMonth > 0) {
      const growth = Math.round(((item.leadsThisMonth - item.leadsPrevMonth) / item.leadsPrevMonth) * 100);
      if (growth > 0) {
        growthHTML = `<span style="color:#22c55e;font-weight:700;">+${growth}% &uarr;</span>`;
      } else if (growth < 0) {
        growthHTML = `<span style="color:#ef4444;font-weight:700;">${growth}% &darr;</span>`;
      } else {
        growthHTML = `<span style="color:#94a3b8;">0%</span>`;
      }
    }

    return `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td><strong style="color:#38bdf8;font-size:14px;">${item.leadsThisMonth}</strong></td>
        <td>${item.leadsPrevMonth}</td>
        <td>${growthHTML}</td>
        <td><span style="color:#22c55e;font-weight:700;background:rgba(34,197,94,0.15);padding:2px 8px;border-radius:12px;">${item.converted}</span></td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================
   3. EXECUTIVE PERFORMANCE RANKINGS
========================================================== */

function renderExecutiveRankings() {
  if (!executiveRankingsTable) return;

  const rankingMap = {};

  cachedUsers.forEach(u => {
    const role = (u.role || "employee").toLowerCase();
    if (role !== "admin") {
      const name = (u.name || "Executive").trim();
      rankingMap[name] = {
        name,
        branch: u.branch || "-",
        totalLeads: 0,
        convertedCustomers: 0,
        totalCollections: 0,
        pendingBalance: 0
      };
    }
  });

  cachedPayments.forEach(c => {
    const name = (c.executiveName || "").trim();
    if (!name) return;

    if (!rankingMap[name]) {
      rankingMap[name] = {
        name,
        branch: c.branch || "-",
        totalLeads: 0,
        convertedCustomers: 0,
        totalCollections: 0,
        pendingBalance: 0
      };
    }

    rankingMap[name].totalLeads++;

    const isCompleted = (c.currentStage || "").toLowerCase() === "completed" ||
                        (c.workStatus || "").toLowerCase() === "completed" ||
                        (c.status || "").toLowerCase() === "completed";
    if (isCompleted) {
      rankingMap[name].convertedCustomers++;
    }

    const totalAmount = Number(c.totalAmount || 0);
    const payments = c.payments || [];
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, totalAmount - paid);

    rankingMap[name].totalCollections += paid;
    rankingMap[name].pendingBalance += balance;
  });

  cachedLeads.forEach(lead => {
    const execName = (lead.assignedTo || lead.executiveName || "").trim();
    if (execName && rankingMap[execName]) {
      rankingMap[execName].totalLeads++;
    }
  });

  const list = Object.values(rankingMap);

  list.forEach(item => {
    item.score = Math.round((item.totalCollections / 1000) + (item.convertedCustomers * 25) + (item.totalLeads * 5));
  });

  list.sort((a, b) => b.totalCollections - a.totalCollections || b.score - a.score);

  if (list.length === 0) {
    executiveRankingsTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#8a97a6;padding:14px;">No executive performance data available.</td></tr>`;
    return;
  }

  executiveRankingsTable.innerHTML = list.map((item, idx) => {
    const rank = idx + 1;
    let rankBadge = `<span style="font-weight:700;color:#94a3b8;">#${rank}</span>`;
    if (rank === 1) rankBadge = `<span style="background:#facc15;color:#000;font-weight:800;padding:2px 8px;border-radius:12px;">🥇 #1</span>`;
    else if (rank === 2) rankBadge = `<span style="background:#e2e8f0;color:#000;font-weight:800;padding:2px 8px;border-radius:12px;">🥈 #2</span>`;
    else if (rank === 3) rankBadge = `<span style="background:#d97706;color:#fff;font-weight:800;padding:2px 8px;border-radius:12px;">🥉 #3</span>`;

    return `
      <tr>
        <td>${rankBadge}</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${item.totalLeads}</td>
        <td><strong style="color:#22c55e;">${item.convertedCustomers}</strong></td>
        <td><strong style="color:#38bdf8;">₹${item.totalCollections.toLocaleString("en-IN")}</strong></td>
        <td><span style="color:${item.pendingBalance > 0 ? '#ef4444' : '#22c55e'};">₹${item.pendingBalance.toLocaleString("en-IN")}</span></td>
        <td><span style="background:rgba(255,255,255,0.08);padding:3px 10px;border-radius:12px;font-weight:700;color:#facc15;">${item.score.toLocaleString()} pts</span></td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================
   INITIALIZATION & REALTIME SNAPSHOT LISTENERS
========================================================== */

function initAnalytics() {
  initMonthSelect();

  // Users
  onSnapshot(collection(db, "users"), (snap) => {
    cachedUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
    renderMonthlyLeads();
    renderExecutiveRankings();
  });

  // Payments & ERP
  onSnapshot(collection(db, "customerPayments"), (snap) => {
    cachedPayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
    renderCollectionsMetrics();
    renderMonthlyLeads();
    renderExecutiveRankings();
  });

  // Leads
  onSnapshot(collection(db, "websiteLeads"), (snap) => {
    cachedLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMonthlyLeads();
    renderExecutiveRankings();
  });

  // Attendance
  onSnapshot(collection(db, "attendance"), (snap) => {
    cachedAttendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
  });

  // Service Requests
  onSnapshot(collection(db, "serviceRequests"), (snap) => {
    cachedServiceRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
  });

  // Leave Requests
  onSnapshot(collection(db, "leaveRequests"), (snap) => {
    cachedLeaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
  });

  // Inventory
  onSnapshot(collection(db, "inventory"), (snap) => {
    cachedInventory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOverviewWidgets();
  });
}

initAnalytics();
