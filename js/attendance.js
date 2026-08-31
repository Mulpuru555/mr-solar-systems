import { auth, db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let officeLat = 0;
let officeLon = 0;
let allowedRadius = 100;
let userBranch = "";
let currentUser = null;
let currentMonthLateCount = 0;

const btn = document.getElementById("attendanceBtn");
const statusBox = document.getElementById("attendanceStatus");
const distanceDisplay = document.getElementById("distanceDisplay");
const countdownBox = document.getElementById("countdownBox");
const confirmedBanner = document.getElementById("attendanceConfirmedBanner");
const confirmedDetails = document.getElementById("attendanceConfirmedDetails");
const lateTrackerWidget = document.getElementById("lateTrackerWidget");

function formatDateStr(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function checkIsLateTime(d = new Date()) {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  if (hours < 10) return false;
  if (hours === 10 && minutes === 0) return false;
  return true;
}

function renderLateTracker(count) {
  currentMonthLateCount = count;
  if (!lateTrackerWidget) return;

  if (count === 0) {
    lateTrackerWidget.innerHTML = `
      <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🟢</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#10b981;">Punctuality Status: Excellent (0 / 3 Late Marks Used)</div>
            <div style="font-size:11px;color:#94a3b8;">All check-ins recorded before 10:00 AM. 3 monthly grace marks available.</div>
          </div>
        </div>
        <div style="background:rgba(16,185,129,0.2);color:#10b981;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:800;">0/3 Used</div>
      </div>
    `;
  } else if (count <= 3) {
    lateTrackerWidget.innerHTML = `
      <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:20px;">🟡</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#f59e0b;">Late Warning: ${count} of 3 Monthly Grace Marks Used</div>
            <div style="font-size:11px;color:#94a3b8;">Arrival after 10:00 AM. ${3 - count} grace mark(s) remaining before salary deduction review.</div>
          </div>
        </div>
        <div style="background:rgba(245,158,11,0.2);color:#f59e0b;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:800;">${count}/3 Used</div>
      </div>
    `;
  } else {
    lateTrackerWidget.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(239,68,68,0.2),rgba(15,23,42,0.95));border:2px solid #ef4444;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;box-shadow:0 8px 24px rgba(239,68,68,0.25);">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:26px;">🚨</span>
          <div>
            <div style="font-size:14px;font-weight:800;color:#ef4444;">ATTENTION: 3 Allowed Late Marks Exceeded (${count} Lates Recorded)</div>
            <div style="font-size:12px;color:#fca5a5;margin-top:2px;">Disciplinary Notice: Attendance has been flagged for Management & Admin Salary Deduction Review.</div>
          </div>
        </div>
        <div style="background:#ef4444;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:800;">${count} Lates (Critical)</div>
      </div>
    `;
  }
}

function showAttendanceConfirmed(timeStr, branchStr, isLate) {
  if (confirmedBanner) {
    confirmedBanner.style.display = "block";
    if (isLate) {
      if (currentMonthLateCount >= 4) {
        confirmedBanner.style.background = "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(15,23,42,0.95))";
        confirmedBanner.style.borderColor = "#ef4444";
        confirmedBanner.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="font-size:36px;line-height:1;">🚨</div>
            <div>
              <div style="font-size:17px;font-weight:800;color:#ef4444;">Late Attendance Recorded — Exceeded 3 Allowed Marks!</div>
              <div style="font-size:13px;color:#fca5a5;margin-top:4px;"><strong>Time:</strong> ${timeStr} | <strong>Branch:</strong> ${branchStr || userBranch || "Office"} | <strong>Status:</strong> Late (${currentMonthLateCount}th Late Mark) &bull; Flagged for Admin Salary Review</div>
            </div>
          </div>
        `;
      } else {
        confirmedBanner.style.background = "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(15,23,42,0.95))";
        confirmedBanner.style.borderColor = "#f59e0b";
        confirmedBanner.innerHTML = `
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="font-size:36px;line-height:1;">⚠️</div>
            <div>
              <div style="font-size:17px;font-weight:800;color:#f59e0b;">Late Attendance Recorded (After 10:00 AM)</div>
              <div style="font-size:13px;color:#fde68a;margin-top:4px;"><strong>Time:</strong> ${timeStr} | <strong>Branch:</strong> ${branchStr || userBranch || "Office"} | <strong>Status:</strong> Late Mark (${currentMonthLateCount} of 3 Grace Marks Used)</div>
            </div>
          </div>
        `;
      }
    } else {
      confirmedBanner.style.background = "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(15,23,42,0.95))";
      confirmedBanner.style.borderColor = "#22c55e";
      confirmedBanner.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="font-size:36px;line-height:1;">✅</div>
          <div>
            <div style="font-size:18px;font-weight:800;color:#22c55e;">Attendance Marked On-Time for Today!</div>
            <div style="font-size:13px;color:#cfd8e3;margin-top:4px;"><strong>Status:</strong> Present (On Time) | <strong>Time:</strong> ${timeStr} | <strong>Branch:</strong> ${branchStr || userBranch || "Office"}</div>
          </div>
        </div>
      `;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = isLate ? "Already Marked Today (Late) &#9888;" : "Already Marked Today &#9989;";
    btn.style.background = isLate ? "#f59e0b" : "#22c55e";
    btn.style.borderColor = isLate ? "#f59e0b" : "#22c55e";
    btn.style.cursor = "default";
  }

  if (statusBox) {
    statusBox.innerHTML = isLate
      ? '<span style="color:#f59e0b;font-weight:700;">&#9888; Present (Late Mark)</span>'
      : '<span style="color:#22c55e;font-weight:700;">&#10004; Present (On Time)</span>';
  }

  const todayStat = document.getElementById("todayStat");
  if (todayStat) todayStat.innerHTML = '<span style="color:#22c55e;font-weight:800;">YES</span>';
}

/* AUTH & FAST INITIALIZATION */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  currentUser = user;

  // 1. Calculate Monthly Late Marks for this user
  await computeMonthlyLates(user);

  // 2. FAST SINGLE-DOCUMENT ATTENDANCE CHECK (O(1) in < 50ms)
  const today = formatDateStr(new Date());
  try {
    const directSnap = await getDoc(doc(db, "attendance", user.uid, today, "data"));
    if (directSnap.exists() && (directSnap.data().status === "present" || directSnap.data().status === "late")) {
      let tStr = "Today";
      const t = directSnap.data().time;
      if (t?.seconds) {
        tStr = new Date(t.seconds * 1000).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      showAttendanceConfirmed(tStr, directSnap.data().branch, directSnap.data().isLate === true);
    }
  } catch (e) {
    console.warn("Direct attendance check note:", e);
  }

  // 2. Fetch User Profile & Branch Settings
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      userBranch = userSnap.data().branch || "";
      const bKey = (userBranch || "").toLowerCase().trim();
      if (bKey) {
        const locSnap = await getDoc(doc(db, "settings", bKey));
        if (locSnap.exists()) {
          officeLat = locSnap.data().point?.latitude || 0;
          officeLon = locSnap.data().point?.longitude || 0;
          allowedRadius = locSnap.data().radius || 100;
        }
      }
    }
  } catch (e) {
    console.error("Error loading branch settings:", e);
  }

  await initializeAttendance(user);
});

async function initializeAttendance(user) {
  const working = await isTodayWorking();

  if (!working) {
    if (countdownBox) countdownBox.innerText = "Today is Sunday / Declared Holiday";
    if (btn) btn.disabled = true;
    if (distanceDisplay) distanceDisplay.innerText = "Attendance Not Required Today";
    return;
  }

  startCountdown();
  startLocationTracking();
  loadMonthlySummary(user);

  setInterval(() => checkAndHandleAbsence(user), 60000);
}

async function isTodayWorking() {
  const todayObj = new Date();
  const today = formatDateStr(todayObj);

  if (todayObj.getDay() === 0) return false;

  try {
    const holidaySnap = await getDoc(doc(db, "settings", "holidays", "holidayList", today));
    if (holidaySnap.exists()) return false;
  } catch (e) {}

  return true;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let countdownInterval = null;

async function startCountdown() {
  if (!countdownBox) return;

  let closeHour = 10;
  let closeMinute = 0;

  // 1. Fetch closing time configured in Admin Settings
  try {
    const snap = await getDoc(doc(db, "settings", "attendance"));
    if (snap.exists() && snap.data().closeHour !== undefined) {
      closeHour = Number(snap.data().closeHour);
      closeMinute = Number(snap.data().closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Using default 10:00 AM closing time:", e);
  }

  const closingTime = new Date();
  closingTime.setHours(closeHour, closeMinute, 0, 0);

  const formattedCloseTime = closingTime.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });

  if (countdownInterval) clearInterval(countdownInterval);

  function update() {
    const current = new Date();
    const diff = closingTime - current;

    if (diff <= 0) {
      if (countdownBox) countdownBox.innerText = `Attendance Closed for Today (${formattedCloseTime})`;
      if (btn && !btn.innerText.includes("Already")) {
        btn.disabled = true;
        btn.innerText = "Attendance Closed";
        btn.style.background = "#64748b";
        btn.style.borderColor = "#64748b";
      }
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    if (countdownBox) {
      countdownBox.innerText = `Open until ${formattedCloseTime} | Remaining: ${h}h ${m}m ${s}s`;
    }
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

function startLocationTracking() {
  if (!navigator.geolocation) {
    if (distanceDisplay) distanceDisplay.innerText = "Geolocation not supported";
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      if (!officeLat || !officeLon) {
        if (distanceDisplay) distanceDisplay.innerText = `Location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        if (btn && !btn.innerText.includes("Already")) btn.disabled = false;
        if (statusBox) statusBox.innerText = "Ready";
        return;
      }

      const distance = calculateDistance(lat, lon, officeLat, officeLon);
      const isInside = distance <= allowedRadius;

      if (distanceDisplay) {
        distanceDisplay.innerText = `Distance: ${Math.round(distance)}m | Allowed: ${allowedRadius}m`;
      }

      if (btn && !btn.innerText.includes("Already")) {
        if (isInside) {
          btn.disabled = false;
          if (statusBox) statusBox.innerHTML = '<span style="color:#22c55e;">Within Office Geofence</span>';
        } else {
          btn.disabled = true;
          if (statusBox) statusBox.innerHTML = `<span style="color:#ef4444;">Outside Office Area (${Math.round(distance)}m away)</span>`;
        }
      }
    },
    (err) => {
      if (distanceDisplay) distanceDisplay.innerText = "Location permission needed for check-in";
    },
    { enableHighAccuracy: true }
  );
}

async function computeMonthlyLates(user) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${year}-${month}`;

  let count = 0;
  try {
    const attSnap = await getDocs(query(collection(db, "attendance"), where("employeeId", "==", user.uid)));
    attSnap.forEach(d => {
      const data = d.data();
      if (data.date && data.date.startsWith(monthPrefix)) {
        if (data.isLate === true || data.status === "late") {
          count++;
        }
      }
    });
  } catch (e) {}

  renderLateTracker(count);
  return count;
}

/* MARK ATTENDANCE ACTION */
window.markAttendance = async function () {
  const user = auth.currentUser || currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }

  const now = new Date();
  const today = formatDateStr(now);
  const timeStr = now.toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true });
  const isLate = checkIsLateTime(now);

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Recording Attendance...";
  }

  try {
    let empName = "";
    try {
      const uSnap = await getDoc(doc(db, "users", user.uid));
      if (uSnap.exists()) {
        empName = uSnap.data().name || "";
        if (!userBranch) userBranch = uSnap.data().branch || "";
      }
    } catch (e) {}

       // ✅ Saves ONLY to: /attendance/{employeeId}/{date}/data
    const nestedRef = doc(db, "attendance", user.uid, today, "data");
    await setDoc(nestedRef, {
      status: isLate ? "late" : "present",
      isLate: isLate,
      type: "checkin",
      employeeId: user.uid,
      employeeName: empName,
      employeeEmail: user.email || "",
      branch: userBranch || "Office",
      date: today,
      time: serverTimestamp()
    });

    // Recalculate late marks count
    const updatedLateCount = await computeMonthlyLates(user);

    showAttendanceConfirmed(timeStr, userBranch, isLate);

    // PSYCHOLOGICAL DETERRENT ALERTS
    if (!isLate) {
      alert(`✅ Attendance Marked Successfully (On Time)!\nTime: ${timeStr}\nBranch: ${userBranch || "Office"}\nStatus: Present (On-Time)`);
    } else if (updatedLateCount <= 3) {
      alert(`⚠️ LATE ATTENDANCE RECORDED!\nTime: ${timeStr} (After 10:00 AM)\n\nYou have used ${updatedLateCount} of 3 allowed monthly grace marks.\nPlease arrive before 10:00 AM to avoid salary deduction review.`);
    } else {
      alert(`🚨 CRITICAL WARNING: LATE MARK #${updatedLateCount} RECORDED!\nTime: ${timeStr}\n\nYou have EXCEEDED the 3 allowed monthly grace marks!\nYour attendance record has been flagged for Admin Salary Deduction & Disciplinary Action.`);
    }

    loadMonthlySummary(user);

  } catch (err) {
    alert("Failed to record attendance: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Mark Attendance";
    }
  }
};

async function loadMonthlySummary(user) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  let workingDays = 0;
  let presentDays = 0;

  const holidays = new Set();
  try {
    const hSnap = await getDocs(collection(db, "settings", "holidays", "holidayList"));
    hSnap.forEach(d => holidays.add(d.id));
  } catch (e) {}

  const presentDates = new Set();
  try {
    const attSnap = await getDocs(query(collection(db, "attendance"), where("employeeId", "==", user.uid)));
    attSnap.forEach(d => {
      if (d.data().date) presentDates.add(d.data().date);
    });
  } catch (e) {}

  for (let d = 1; d <= today.getDate(); d++) {
    const dateObj = new Date(year, month - 1, d);
    const dateStr = formatDateStr(dateObj);
    if (dateObj.getDay() === 0) continue;
    if (holidays.has(dateStr)) continue;

    workingDays++;
    if (presentDates.has(dateStr)) presentDays++;
  }

  const pct = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  const percentStat = document.getElementById("percentStat");
  if (percentStat) percentStat.innerText = `${pct}%`;
}

async function checkAndHandleAbsence(user) {}
