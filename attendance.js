import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* 🔥 VARIABLES */
let officeLat = null;
let officeLon = null;
let allowedRadius = 200;
let closeHour = 23;
let closeMinute = 0;
let currentUser = null;
let locationWatchId = null;
let clockInterval = null;
let lastCoords = null;

/* 🔥 DATE FUNCTIONS */
function getTodayDate() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, '0') + "-" +
    String(now.getDate()).padStart(2, '0');
}

function getTodayDateForDay(date) {
  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, '0') + "-" +
    String(date.getDate()).padStart(2, '0');
}

/* 🔥 ELEMENTS */
function el(id) {
  return document.getElementById(id);
}

/* 🔥 TIME CHECK */
function isWithinAllowedTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const closeMinutes = closeHour * 60 + closeMinute;
  return currentMinutes <= closeMinutes;
}

/* 🔥 OPTIMIZED MONTHLY STATS - Only PAST days ✅ */
async function loadMonthlyStats() {
  if (!currentUser) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const currentDay = now.getDate();  // 🔥 Only up to TODAY
  
  let presentDays = 0;
  let totalWorkingDays = 0;
  let adminHolidays = 0;

  // 🔥 Load holidays
  const holidaysSnap = await getDoc(doc(db, "settings", "holidays"));
  const holidaysData = holidaysSnap.exists() ? holidaysSnap.data() : {};

  // 🔥 FIXED: Only check PAST days (performance + accuracy)
  for (let d = 1; d <= currentDay; d++) {
    const date = new Date(year, month, d);
    const day = date.getDay();
    const dateStr = getTodayDateForDay(date);

    // 🔥 Skip Sundays
    if (day === 0) continue;

    // 🔥 Skip Admin Holidays
    if (holidaysData[dateStr]) {
      adminHolidays++;
      continue;
    }

    totalWorkingDays++;
    const snap = await getDoc(doc(db, "attendance", currentUser.uid, dateStr, "data"));
    if (snap.exists()) presentDays++;
  }

  // 🔥 Perfect 100% - absences
  let percent = 100;
  if (totalWorkingDays > 0) {
    percent = Math.max(0, Math.round((presentDays / totalWorkingDays) * 100));
  }

  const percentEl = el("percentStat");
  if (percentEl) {
    percentEl.textContent = percent + "%";
    percentEl.title = `${presentDays}/${totalWorkingDays} days (${adminHolidays} holidays)`;
  }
}

/* 🔥 OPTIMIZED STREAK - Safety Limit ✅ */
async function loadStreak() {
  if (!currentUser) return;

  let streak = 0;
  let date = new Date();
  let safety = 0;

  // 🔥 Load holidays
  const holidaysSnap = await getDoc(doc(db, "settings", "holidays"));
  const holidaysData = holidaysSnap.exists() ? holidaysSnap.data() : {};

  // 🔥 Skip today if not marked
  const todayStr = getTodayDate();
  const todaySnap = await getDoc(
    doc(db, "attendance", currentUser.uid, todayStr, "data")
  );

  if (!todaySnap.exists()) {
    date.setDate(date.getDate() - 1);
  }

  while (safety < 365) {
    safety++;

    const dateStr = getTodayDateForDay(date);
    const dayCheck = date.getDay();

    // ✅ Skip Sunday
    if (dayCheck === 0) {
      date.setDate(date.getDate() - 1);
      continue;
    }

    // 🔥 NEW: Skip admin holidays
    if (holidaysData[dateStr]) {
      date.setDate(date.getDate() - 1);
      continue;
    }

    const snap = await getDoc(
      doc(db, "attendance", currentUser.uid, dateStr, "data")
    );

    if (snap.exists()) {
      streak++;
      date.setDate(date.getDate() - 1);
    } else {
      break;
    }
  }

  const streakEl = el("streakCount");
  if (streakEl) streakEl.textContent = streak + " days";
}
/* 🔥 STATUS INDICATOR */
function updateStatus() {
  const statusEl = el("attendanceStatus");
  if (!statusEl) return;

  if (!isWithinAllowedTime()) {
    statusEl.textContent = "⏰ Attendance Closed";
    statusEl.className = "status closed";
  } else {
    statusEl.textContent = "✅ Attendance Open";
    statusEl.className = "status open";
  }
}

/* 🔥 UI STATES */
function showLoginState() {
  el("distanceDisplay").textContent = "👋 Login";
  el("todayStat").textContent = "NO";
  el("percentStat").textContent = "--%";
  if (el("streakCount")) el("streakCount").textContent = "0 days";
}

/* 🔥 TODAY STATUS */
async function loadToday() {
  if (!currentUser) return;
  const today = getTodayDate();
  const snap = await getDoc(doc(db, "attendance", currentUser.uid, today, "data"));
  el("todayStat").textContent = snap.exists() ? "YES" : "NO";
}

/* 🔥 AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLoginState();
    stopLocationTracking();
    stopClock();
    lastCoords = null;
    return;
  }

  currentUser = user;
  try {
    await loadOfficeSettings();
    startSystem();
  } catch (e) {
    console.error("Settings error:", e);
    el("distanceDisplay").textContent = "⚠️ Settings Error";
  }
});

/* 🔥 SETTINGS */
async function loadOfficeSettings() {
  const snap = await getDoc(doc(db, "settings", "tenali"));
  const data = snap.data();
  officeLat = Number(data.point.latitude);
  officeLon = Number(data.point.longitude);
  allowedRadius = Number(data.radius) || 200;

  const timeSnap = await getDoc(doc(db, "settings", "attendance"));
  if (timeSnap.exists()) {
    const timeData = timeSnap.data();
    closeHour = Number(timeData.closeHour) || 23;
    closeMinute = Number(timeData.closeMinute) || 0;
  }
}

/* 🔥 CLEAN SYSTEM START - No double calls ✅ */
function startSystem() {
  startClock();
  startLocation();
  loadToday();
  loadMonthlyStats();  // 🔥 Single call
  loadStreak();        // 🔥 Single call
}

/* 🔥 CLOCK WITH STATUS */
function stopClock() {
  if (clockInterval) clearInterval(clockInterval);
}

function startClock() {
  const clock = el("liveClock");
  if (clockInterval) clearInterval(clockInterval);

  const updateClock = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    if (clock && clock.innerText !== time) clock.innerText = time;
    
    updateStatus();
  };

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

/* 🔥 LOCATION */
function stopLocationTracking() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

function startLocation() {
  const display = el("distanceDisplay");
  display.textContent = "📍 GPS...";

  if (!navigator.geolocation) {
    display.textContent = "❌ No GPS";
    return;
  }

  stopLocationTracking();

  locationWatchId = navigator.geolocation.watchPosition(
    pos => {
      lastCoords = pos.coords;
      if (officeLat) {
        const distance = calculateDistance(pos.coords.latitude, pos.coords.longitude, officeLat, officeLon);
        updateDistanceDisplay(distance);
        updateAttendanceButton(distance);
      }
    },
    () => display.textContent = "❌ GPS Error",
    { enableHighAccuracy: true }
  );
}

/* 🔥 UI UPDATES */
function updateDistanceDisplay(distance) {
  const display = el("distanceDisplay");
  const inside = distance <= allowedRadius;
  display.innerHTML = inside ? `✅ ${Math.round(distance)}m` : `❌ ${Math.round(distance)}m`;
}

function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  const ready = distance <= allowedRadius && isWithinAllowedTime();
  btn.disabled = !ready;
  btn.textContent = ready ? "✅ Mark Attendance" : "Outside/Closed";
}

/* 🔥 PERFECT ATTENDANCE */
window.markAttendance = async () => {
  if (!isWithinAllowedTime()) return alert("⏰ Closed");
  if (!lastCoords) return alert("📍 GPS");
  if (!navigator.onLine) return alert("❌ Offline");

  const distance = calculateDistance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (distance > allowedRadius) return alert("❌ Outside range");

  const btn = el("attendanceBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Saving...";
  btn.style.background = "#f59e0b";

  try {
    const today = getTodayDate();
    const ref = doc(db, "attendance", currentUser.uid, today, "data");
    
    const snap = await getDoc(ref);
    if (snap.exists()) throw new Error("Already marked");

    await setDoc(ref, {
      status: "present",
      date: today,
      timestamp: serverTimestamp(),
      lat: lastCoords.latitude,
      lon: lastCoords.longitude,
      distance: Math.round(distance)
    });

    alert("✅ Attendance Marked!");
    
    // 🔥 UI Success
    btn.textContent = "✅ Marked Today";
    btn.style.background = "#10b981";
    btn.style.color = "white";
    btn.disabled = true;
    
    // 🔥 Update all data
    setTimeout(async () => {
      await loadToday();
      await loadMonthlyStats();
      await loadStreak();
    }, 800);
    
  } catch (e) {
    if (e.message.includes("Already")) {
      btn.textContent = "✅ Already Marked";
      btn.style.background = "#10b981";
      btn.style.color = "white";
      btn.disabled = true;
      alert("✅ Already marked today!");
    } else {
      console.error("Error:", e);
      alert("❌ Failed to mark");
      btn.textContent = "✅ Mark Attendance";
      btn.style.background = "";
      btn.style.color = "";
    }
  }
};

/* 🔥 LOGOUT */
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  await signOut(auth);
};

/* 🔥 DISTANCE */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
