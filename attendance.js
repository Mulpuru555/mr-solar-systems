import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
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
// 🔥 GLOBAL CACHE (FIX #1)
let attendanceCache = [];

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

/* 🔥 CACHE MANAGER (NEW - PERFORMANCE FIX) */
async function loadAttendanceData() {
  if (!currentUser) return;
  
  try {
    const snap = await getDocs(collection(db, "attendance"));
    attendanceCache = [];

    snap.forEach(doc => {
      attendanceCache.push(doc.data());
    });
    
    // 🔥 Update all stats after cache load
    await Promise.all([
      loadToday(),
      loadStreak(),
      loadMonthlyStats()
    ]);
  } catch (error) {
    console.error("Attendance cache error:", error);
  }
}

/* 🔥 FIXED: TODAY STATUS (USES CACHE) */
async function loadToday() {
  if (!currentUser || attendanceCache.length === 0) return;

  const today = getTodayDate();
  const found = attendanceCache.some(data => 
    (data.userId === currentUser.uid || data.employeeId === currentUser.uid) &&
    data.date === today
  );

  const todayEl = el("todayStat");
  if (todayEl) todayEl.textContent = found ? "YES" : "NO";
}

/* 🔥 FIXED: STREAK (USES CACHE) */
async function loadStreak() {
  if (!currentUser || attendanceCache.length === 0) return;

  const records = attendanceCache.filter(data => 
    data.userId === currentUser.uid || data.employeeId === currentUser.uid
  );

  // Sort latest first
  records.sort((a, b) => {
    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
  });

  let streak = 0;
  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (let r of records) {
    let recordDate;
    if (r.timestamp?.seconds) {
      recordDate = new Date(r.timestamp.seconds * 1000);
    } else if (r.date) {
      recordDate = new Date(r.date);
    } else continue;

    recordDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((current - recordDate) / (1000 * 60 * 60 * 24));

    if (diff === 0 || diff === 1) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  const streakEl = el("streakCount");
  if (streakEl) streakEl.textContent = streak + " days";
}

/* 🔥 FIXED: MONTHLY STATS (USES CACHE) */
async function loadMonthlyStats() {
  if (!currentUser || attendanceCache.length === 0) return;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    
    let presentDays = 0;
    let totalWorkingDays = 0;
    let adminHolidays = 0;

    // Load holidays
    const holidaysSnap = await getDoc(doc(db, "settings", "holidays"));
    const holidaysData = holidaysSnap.exists() ? holidaysSnap.data() : {};

    // 🔥 Use cache instead of new query
    const userRecords = new Set();
    attendanceCache.forEach(data => {
      if (data.userId === currentUser.uid || data.employeeId === currentUser.uid) {
        userRecords.add(data.date);
      }
    });

    // Check each day
    for (let d = 1; d <= currentDay; d++) {
      const date = new Date(year, month, d);
      const day = date.getDay();
      const dateStr = getTodayDateForDay(date);

      if (day === 0) continue; // Skip Sundays

      if (holidaysData[dateStr]) {
        adminHolidays++;
        continue;
      }

      totalWorkingDays++;
      if (userRecords.has(dateStr)) presentDays++;
    }

    let percent = 100;
    if (totalWorkingDays > 0) {
      percent = Math.max(0, Math.round((presentDays / totalWorkingDays) * 100));
    }

    const percentEl = el("percentStat");
    if (percentEl) {
      percentEl.textContent = percent + "%";
      percentEl.title = `${presentDays}/${totalWorkingDays} days (${adminHolidays} holidays)`;
    }
  } catch (error) {
    console.error("Monthly stats error:", error);
  }
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
  const distanceEl = el("distanceDisplay");
  const todayEl = el("todayStat");
  const percentEl = el("percentStat");
  const streakEl = el("streakCount");

  if (distanceEl) distanceEl.textContent = "👋 Login";
  if (todayEl) todayEl.textContent = "NO";
  if (percentEl) percentEl.textContent = "--%";
  if (streakEl) streakEl.textContent = "0 days";
}

/* 🔥 AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showLoginState();
    stopLocationTracking();
    stopClock();
    lastCoords = null;
    attendanceCache = []; // 🔥 Clear cache
    return;
  }

  currentUser = user;
  try {
    await loadOfficeSettings();
    startSystem();
  } catch (e) {
    console.error("Settings error:", e);
    const distanceEl = el("distanceDisplay");
    if (distanceEl) distanceEl.textContent = "⚠️ Settings Error";
  }
});

/* 🔥 SETTINGS */
async function loadOfficeSettings() {
  const snap = await getDoc(doc(db, "settings", "tenali"));
  const data = snap.data();
  
  officeLat = Number(data?.point?.latitude);
  officeLon = Number(data?.point?.longitude);
  allowedRadius = Number(data?.radius) || 200;

  try {
    const timeSnap = await getDoc(doc(db, "settings", "attendance"));
    if (timeSnap.exists()) {
      const timeData = timeSnap.data();
      closeHour = Number(timeData.closeHour) || 23;
      closeMinute = Number(timeData.closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Time settings not found");
  }
}

/* 🔥 SYSTEM START */
async function startSystem() {
  startClock();
  startLocation();
  await loadAttendanceData(); // 🔥 Single cache load
}

/* 🔥 CLOCK */
function stopClock() {
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = null;
}

function startClock() {
  const clock = el("liveClock");
  stopClock();

  const updateClock = () => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    if (clock && clock.innerText !== time) {
      clock.innerText = time;
    }
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
  if (display) display.textContent = "📍 GPS...";

  if (!navigator.geolocation) {
    if (display) display.textContent = "❌ No GPS";
    return;
  }

  stopLocationTracking();

  locationWatchId = navigator.geolocation.watchPosition(
    pos => {
      lastCoords = pos.coords;
      // 🔥 FIX #2: Proper null check
      if (officeLat !== null && officeLon !== null) {
        const distance = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          officeLat, 
          officeLon
        );
        updateDistanceDisplay(distance);
        updateAttendanceButton(distance);
      }
    },
    err => {
      console.error("GPS error:", err);
      if (display) display.textContent = "❌ GPS Error";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

/* 🔥 UI UPDATES */
function updateDistanceDisplay(distance) {
  const display = el("distanceDisplay");
  if (!display) return;
  
  const inside = distance <= allowedRadius;
  display.innerHTML = inside ? `✅ ${Math.round(distance)}m` : `❌ ${Math.round(distance)}m`;
}

function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  if (!btn) return;
  
  const ready = distance <= allowedRadius && isWithinAllowedTime();
  btn.disabled = !ready;
  btn.textContent = ready ? "✅ Mark Attendance" : "Outside/Closed";
}

/* 🔥 ATTENDANCE MARKING (OPTIMIZED + UX FIX) */
async function markAttendance() {
  if (!currentUser || !lastCoords || officeLat === null || officeLon === null) {
    alert("Missing data");
    return;
  }

  const btn = el("attendanceBtn");
  if (btn) btn.disabled = true;

  try {
    const today = getTodayDate();
    const distance = calculateDistance(
      lastCoords.latitude, 
      lastCoords.longitude, 
      officeLat, 
      officeLon
    );

    // 🔥 USE CACHE (FAST) + UX FIX #3
    const alreadyMarked = attendanceCache.some(data => 
      (data.userId === currentUser.uid || data.employeeId === currentUser.uid) &&
      data.date === today
    );

    if (alreadyMarked) {
      throw new Error("Already marked today!");
    }

    // ✅ Save
    await addDoc(collection(db, "attendance"), {
      userId: currentUser.uid,
      date: today,
      timestamp: serverTimestamp(),
      lat: lastCoords.latitude,
      lon: lastCoords.longitude,
      distance: Math.round(distance),
      status: "present"
    });

    // 🔥 UX FIX: Keep button disabled + update message
    if (btn) {
      btn.textContent = "✅ Marked Today";
      btn.disabled = true;
    }

    alert("✅ Attendance Marked!");
    
    // 🔥 Refresh cache and stats
    await loadAttendanceData();

  } catch (error) {
    console.error("Attendance error:", error);
    alert("Error: " + error.message);
    
    // 🔥 Re-enable button on error
    if (btn) {
      const distance = calculateDistance(
        lastCoords.latitude, 
        lastCoords.longitude, 
        officeLat, 
        officeLon
      );
      updateAttendanceButton(distance);
    }
  }
}

// ✅ Event listener
document.addEventListener('DOMContentLoaded', () => {
  const btn = el("attendanceBtn");
  if (btn) {
    btn.onclick = markAttendance;
  }
});

/* 🔥 LOGOUT */
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  attendanceCache = []; // 🔥 Clear cache
  await signOut(auth);
};

/* 🔥 DISTANCE */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
