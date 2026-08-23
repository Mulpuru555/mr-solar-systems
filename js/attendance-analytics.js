import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let presentDates = new Set();
let holidayDates = new Set();
let viewYear, viewMonth; // viewMonth is 0-indexed
let unsubscribe = null;

const monthLabelEl = document.getElementById("calendarMonthLabel");
const gridEl = document.getElementById("calendarGrid");
const heatmapEl = document.getElementById("heatmapGrid");
const summaryEl = document.getElementById("analyticsSummary");
const streakEl = document.getElementById("streakCount");
const prevBtn = document.getElementById("calPrevBtn");
const nextBtn = document.getElementById("calNextBtn");

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateStr(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayStatus(dateObj, dateStr, todayStr) {
  if (dateStr > todayStr) return "future";
  if (dateObj.getDay() === 0 || holidayDates.has(dateStr)) return "holiday";
  if (presentDates.has(dateStr)) return "present";
  return "absent";
}

function renderCalendar() {
  if (!gridEl) return;

  gridEl.innerHTML = "";
  if (monthLabelEl) monthLabelEl.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;

  DOW.forEach(d => {
    const el = document.createElement("div");
    el.className = "calDay calDow";
    el.textContent = d;
    gridEl.appendChild(el);
  });

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = toDateStr(new Date());
  const todayFull = new Date();
  const isCurrentMonthView = (viewYear === todayFull.getFullYear() && viewMonth === todayFull.getMonth());

  for (let i = 0; i < startOffset; i++) {
    const blank = document.createElement("div");
    blank.className = "calDay calBlank";
    gridEl.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(viewYear, viewMonth, day);
    const dateStr = toDateStr(dateObj);
    const status = dayStatus(dateObj, dateStr, todayStr);

    const cell = document.createElement("div");
    cell.className = "calDay cal" + status.charAt(0).toUpperCase() + status.slice(1);
    if (isCurrentMonthView && day === todayFull.getDate()) {
      cell.classList.add("calToday");
    }
    cell.textContent = day;
    gridEl.appendChild(cell);
  }

  // Monthly summary for the viewed month (working days up to today only)
  let workingDays = 0;
  let present = 0;
  const lastDayToCount = isCurrentMonthView ? todayFull.getDate() : daysInMonth;

  for (let day = 1; day <= lastDayToCount; day++) {
    const dateObj = new Date(viewYear, viewMonth, day);
    const dateStr = toDateStr(dateObj);
    if (dateObj.getDay() === 0 || holidayDates.has(dateStr)) continue;
    workingDays++;
    if (presentDates.has(dateStr)) present++;
  }

  const pct = workingDays > 0 ? ((present / workingDays) * 100).toFixed(1) : "0.0";
  if (summaryEl) summaryEl.textContent = `${present} present / ${workingDays} working days (${pct}%)`;

  if (isCurrentMonthView) {
    const monthEl = document.getElementById("monthStat");
    if (monthEl) monthEl.innerText = `${Math.round(Number(pct))}%`;
  }
}

function renderHeatmap() {
  if (!heatmapEl) return;
  heatmapEl.innerHTML = "";

  const today = new Date();
  const days = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const todayStr = toDateStr(today);

  days.forEach(d => {
    const dateStr = toDateStr(d);
    const cell = document.createElement("div");
    cell.title = dateStr;

    if (dateStr > todayStr) {
      cell.className = "heatCell";
    } else if (d.getDay() === 0 || holidayDates.has(dateStr)) {
      cell.className = "heatCell heatHoliday";
    } else if (presentDates.has(dateStr)) {
      cell.className = "heatCell heatPresent";
    } else {
      cell.className = "heatCell heatAbsent";
    }

    heatmapEl.appendChild(cell);
  });
}

function computeStreak() {
  let streak = 0;
  const cursor = new Date();
  // If today isn't marked yet, start counting from yesterday
  const todayStr = toDateStr(cursor);
  if (!presentDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = toDateStr(cursor);
    const isNonWorking = cursor.getDay() === 0 || holidayDates.has(dateStr);

    if (isNonWorking) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }

    if (presentDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  if (streakEl) streakEl.textContent = streak;
}

async function loadData(uid) {

  try {
    const holidaySnap = await getDocs(collection(db, "settings", "holidays", "holidayList"));
    holidayDates = new Set();
    holidaySnap.forEach(d => holidayDates.add(d.id));
  } catch(e) {}

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  if (unsubscribe) unsubscribe();

  // Listen to flat attendance
  unsubscribe = onSnapshot(collection(db, "attendance"), (snap) => {
    presentDates = new Set();
    snap.forEach(d => {
      const data = d.data();
      if ((data.employeeId === uid || data.userId === uid) && data.date) {
        presentDates.add(data.date);
      }
    });

    renderCalendar();
    renderHeatmap();
    computeStreak();
  }, async () => {
    // Fallback getDocs
    try {
      const attSnap = await getDocs(
        query(collection(db, "attendance"), where("employeeId", "==", uid))
      );
      presentDates = new Set();
      attSnap.forEach(d => {
        const data = d.data();
        if (data.date) presentDates.add(data.date);
      });
      renderCalendar();
      renderHeatmap();
      computeStreak();
    } catch(e) {}
  });
}

if (prevBtn && nextBtn) {
  prevBtn.addEventListener("click", () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  nextBtn.addEventListener("click", () => {
    const now = new Date();
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return; // don't go into the future
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (unsubscribe) unsubscribe();
    return;
  }
  loadData(user.uid);
});
