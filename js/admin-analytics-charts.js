import { db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let collectionsChartInstance = null;
let attendanceChartInstance = null;
let branchChartInstance = null;
let leadsChartInstance = null;

let currentMode = "7d";

function destroyIfExists(instance) {
  if (instance) instance.destroy();
}

function getPastDates(daysCount) {
  const dates = [];
  const labels = [];
  const now = new Date();
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
    labels.push(d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }));
  }
  return { dates, labels };
}

function getPastMonths(monthCount) {
  const months = [];
  const labels = [];
  const now = new Date();
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    labels.push(d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }));
  }
  return { months, labels };
}

function safeDateStr(val) {
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

/* ==========================================================
   1. COLLECTIONS CHART
========================================================== */

async function renderCollectionsChart() {
  const canvas = document.getElementById("collectionsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const snap = await getDocs(collection(db, "customerPayments"));
  const isMonthMode = currentMode === "12m";
  const { dates, labels } = isMonthMode ? getPastMonths(12) : getPastDates(currentMode === "30d" ? 30 : 7);

  const dataMap = Object.fromEntries((isMonthMode ? dates || labels : dates).map(k => [k, 0]));

  snap.forEach(d => {
    const payments = d.data().payments || [];
    payments.forEach(p => {
      const pDate = safeDateStr(p.date || p.createdAt || d.data().createdAt);
      if (!pDate) return;
      const key = isMonthMode ? pDate.slice(0, 7) : pDate;
      if (key in dataMap) {
        dataMap[key] += Number(p.amount) || 0;
      }
    });
  });

  destroyIfExists(collectionsChartInstance);
  collectionsChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Collections (₹)",
        data: dates.map(k => dataMap[k]),
        backgroundColor: "#22c55e",
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#cfd8e3" } },
        y: { ticks: { color: "#cfd8e3" } }
      }
    }
  });
}

/* ==========================================================
   2. ATTENDANCE TREND CHART
========================================================== */

async function renderAttendanceChart() {
  const canvas = document.getElementById("attendanceChart");
  if (!canvas || typeof Chart === "undefined") return;

  const snap = await getDocs(collection(db, "attendance"));
  const isMonthMode = currentMode === "12m";
  const { dates, labels } = isMonthMode ? getPastMonths(12) : getPastDates(currentMode === "30d" ? 30 : 7);

  const dataMap = Object.fromEntries(dates.map(k => [k, 0]));

  snap.forEach(d => {
    const a = d.data();
    if (!a.date) return;
    const key = isMonthMode ? a.date.slice(0, 7) : a.date;
    if (key in dataMap) {
      dataMap[key] += 1;
    }
  });

  destroyIfExists(attendanceChartInstance);
  attendanceChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Check-ins",
        data: dates.map(k => dataMap[k]),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56,189,248,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#cfd8e3" } },
        y: { ticks: { color: "#cfd8e3" } }
      }
    }
  });
}

/* ==========================================================
   3. BRANCH COMPARISON CHART
========================================================== */

async function renderBranchChart() {
  const canvas = document.getElementById("branchChart");
  if (!canvas || typeof Chart === "undefined") return;

  const [usersSnap, attSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "attendance"))
  ]);

  const branchEmployees = {};
  const uidToBranch = {};
  usersSnap.forEach(d => {
    const u = d.data();
    const b = u.branch;
    uidToBranch[d.id] = b;
    if (b) branchEmployees[b] = (branchEmployees[b] || 0) + 1;
  });

  const branchAttendance = {};
  attSnap.forEach(d => {
    const data = d.data();
    const b = data.branch || uidToBranch[data.employeeId || data.userId];
    if (b) branchAttendance[b] = (branchAttendance[b] || 0) + 1;
  });

  const branches = Object.keys(branchEmployees).sort();

  destroyIfExists(branchChartInstance);
  branchChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: branches.length ? branches : ["Main"],
      datasets: [
        { label: "Active Staff", data: branches.map(b => branchEmployees[b] || 0), backgroundColor: "#facc15" },
        { label: "Total Attendance", data: branches.map(b => branchAttendance[b] || 0), backgroundColor: "#a855f7" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#cfd8e3" } },
        y: { ticks: { color: "#cfd8e3" } }
      }
    }
  });
}

/* ==========================================================
   4. LEAD ACQUISITION TREND CHART
========================================================== */

async function renderLeadsChart() {
  const canvas = document.getElementById("leadsChart");
  if (!canvas || typeof Chart === "undefined") return;

  const snap = await getDocs(collection(db, "websiteLeads"));
  const isMonthMode = currentMode === "12m";
  const { dates, labels } = isMonthMode ? getPastMonths(12) : getPastDates(currentMode === "30d" ? 30 : 7);

  const dataMap = Object.fromEntries(dates.map(k => [k, 0]));

  snap.forEach(d => {
    const l = d.data();
    const lDate = safeDateStr(l.date || l.createdAt);
    if (!lDate) return;
    const key = isMonthMode ? lDate.slice(0, 7) : lDate;
    if (key in dataMap) {
      dataMap[key] += 1;
    }
  });

  destroyIfExists(leadsChartInstance);
  leadsChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Website Leads",
        data: dates.map(k => dataMap[k]),
        borderColor: "#f97316",
        backgroundColor: "rgba(249,115,22,0.15)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#cfd8e3" } },
        y: { ticks: { color: "#cfd8e3" } }
      }
    }
  });
}

/* ==========================================================
   INIT ALL CHARTS
========================================================== */

async function renderAllCharts() {
  await Promise.all([
    renderCollectionsChart(),
    renderAttendanceChart(),
    renderBranchChart(),
    renderLeadsChart()
  ]);
}

document.querySelectorAll(".chartModeBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chartModeBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.chartmode || "7d";
    renderAllCharts();
  });
});

const analyticsNavBtn = document.querySelector('button[onclick*="analyticsCenter"]');
if (analyticsNavBtn) {
  analyticsNavBtn.addEventListener("click", () => renderAllCharts());
}

renderAllCharts();
