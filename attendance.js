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

/* 🔥 FIXED DATE FUNCTION 👈 YOUR EXACT FIX */
function getTodayDate() {
  const now = new Date();
  return now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, '0') + "-" +
    String(now.getDate()).padStart(2, '0');
}

/* ELEMENT */
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

/* 🔥 MONTHLY STATS 👈 FIXED WITH YOUR DATE */
/* 🔥 FULL MONTH STATS */
/* 🔥 MONTHLY STATS - 100% TO 0% (Skip Sundays + Holidays) */
async function loadMonthlyStats() {
  if (!currentUser) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  let presentDays = 0;
  let totalWorkingDays = 0;
  let adminHolidays = 0;

  // 🔥 Load holidays
  const holidaysSnap = await getDoc(doc(db, "settings", "holidays"));
  const holidaysData = holidaysSnap.exists() ? holidaysSnap.data() : {};

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const day = date.getDay();
    const dateStr = getTodayDateForDay(date);

    // 🔥 Skip Sundays (day 0)
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

  // 🔥 100% - Absences (Perfect!)
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

/* UI */
function showLoginState() {
  el("distanceDisplay").textContent = "👋 Login";
  el("todayStat").textContent = "NO";
  el("percentStat").textContent = "--%";
}

/* AUTH */
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
    showErrorState("Settings error");
  }
});

/* SETTINGS */
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

/* SYSTEM */
function startSystem() {
  startClock();
  startLocation();
  loadToday();
  setTimeout(loadMonthlyStats, 1500);  // 🔥 Sync delay
}

/* CLOCK */
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
    if (clock.innerText !== time) clock.innerText = time;
  };

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

/* LOCATION */
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
    () => display.textContent = "GPS error",
    { enableHighAccuracy: true }
  );
}

/* UI */
function updateDistanceDisplay(distance) {
  const display = el("distanceDisplay");
  const inside = distance <= allowedRadius;
  display.innerHTML = inside ? `✅ ${Math.round(distance)}m` : `❌ ${Math.round(distance)}m`;
}

function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  const ready = distance <= allowedRadius && isWithinAllowedTime();
  btn.disabled = !ready;
  btn.textContent = ready ? "✅ Mark" : "Outside/Closed";
}

/* TODAY */
async function loadToday() {
  if (!currentUser) return;
  const today = getTodayDate();  // 👈 YOUR FIXED FUNCTION
  const snap = await getDoc(doc(db, "attendance", currentUser.uid, today, "data"));
  el("todayStat").textContent = snap.exists() ? "1" : "0";
}

/* 🔥 ATTENDANCE */
window.markAttendance = async () => {
  if (!isWithinAllowedTime()) return alert("⏰ Closed");
  if (!lastCoords) return alert("📍 GPS");
  if (!navigator.onLine) return alert("❌ Offline");

  const distance = calculateDistance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (distance > allowedRadius) return alert("❌ Outside");

  const btn = el("attendanceBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    // 👈 YOUR FIXED DATE
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

    alert("✅ Marked!");
    
    // 🔥 UPDATE WITH DELAY
    setTimeout(() => {
      loadToday();
      loadMonthlyStats();
    }, 1200);
    
  } catch (e) {
    if (e.message.includes("Already")) {
      console.log("ℹ️ Already marked");
      alert("✅ Already marked!");
    } else {
      console.error("Error:", e);
      alert("❌ Failed");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Done!";
  }
};

/* LOGOUT */
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  await signOut(auth);
};

/* DISTANCE */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
