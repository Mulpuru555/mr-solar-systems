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

/* 🔥 MONTHLY STATS 👈 YOUR NEW FUNCTION */
async function loadMonthlyStats() {
  if (!currentUser) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let presentDays = 0;
  let totalDays = 0;

  // Loop from 1 → today
  for (let d = 1; d <= now.getDate(); d++) {
    const date = new Date(year, month, d);
    const day = date.getDay();

    // Skip Sunday (optional - remove if you want Sundays)
    if (day === 0) continue;

    totalDays++;

    const dateStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  .toISOString()
  .split("T")[0];
    const snap = await getDoc(doc(db, "attendance", currentUser.uid, dateStr, "data"));

    if (snap.exists()) {
      presentDays++;
    }
  }

  const percent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
  
  // 👈 UPDATE UI
  const percentEl = el("percentStat");
  if (percentEl) {
    percentEl.textContent = percent + "%";
    percentEl.title = `${presentDays}/${totalDays} days`;
  }

  console.log(`📊 Monthly: ${percent}% (${presentDays}/${totalDays})`);
}

/* UI STATES */
function showLoginState() {
  el("distanceDisplay").textContent = "👋 Please login";
  el("todayStat").textContent = "NO";
  el("todayStat").className = "absent";
  const btn = el("attendanceBtn");
  if (btn) btn.textContent = "Login required";
  el("percentStat").textContent = "--";
}

function showErrorState(msg) {
  el("distanceDisplay").textContent = msg;
}

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("👋 Logout");
    showLoginState();
    stopLocationTracking();
    stopClock();
    lastCoords = null;
    return;
  }

  currentUser = user;
  console.log("✅ Login:", user.uid);

  try {
    await loadOfficeSettings();
    startSystem();
  } catch (e) {
    console.error("Init error:", e);
    showErrorState("Settings failed");
  }
});

/* 🔥 SETTINGS */
async function loadOfficeSettings() {
  const officeSnap = await getDoc(doc(db, "settings", "tenali"));
  if (!officeSnap.exists()) throw new Error("No office settings");

  const officeData = officeSnap.data();
  officeLat = Number(officeData.point.latitude);
  officeLon = Number(officeData.point.longitude);
  allowedRadius = Number(officeData.radius) || 200;

  try {
    const timeSnap = await getDoc(doc(db, "settings", "attendance"));
    if (timeSnap.exists()) {
      const timeData = timeSnap.data();
      closeHour = Number(timeData.closeHour) || 23;
      closeMinute = Number(timeData.closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Time settings default");
  }

  console.log(`✅ Office OK | Close: ${closeHour}:${closeMinute.toString().padStart(2, '0')}`);
}

/* SYSTEM 👈 YOUR CALL ADDED */
function startSystem() {
  startClock();
  startLocation();
  loadToday();
  loadMonthlyStats();  // 👈 YOUR NEW CALL
}

/* 🔥 CLOCK */
function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function startClock() {
  const clock = el("liveClock");
  if (!clock) return;

  if (clockInterval) clearInterval(clockInterval);

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    if (clock.innerText !== time) {
      clock.innerText = time;
    }

    const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
    clock.title = isWithinAllowedTime() ? `✅ Open (${closeTime})` : `⏰ Closed (${closeTime})`;
  }

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
    (pos) => {
      lastCoords = pos.coords;

      if (officeLat == null) {
        display.textContent = "Loading office...";
        return;
      }

      const distance = calculateDistance(pos.coords.latitude, pos.coords.longitude, officeLat, officeLon);
      updateDistanceDisplay(distance);
      updateAttendanceButton(distance);
    },
    (err) => {
      const msg = {1: "Permission denied", 2: "GPS off", 3: "Timeout"}[err.code] || "GPS error";
      display.textContent = msg;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

/* UI */
function updateDistanceDisplay(distance) {
  const display = el("distanceDisplay");
  const dist = Math.round(distance);
  const inside = distance <= allowedRadius;
  
  display.innerHTML = inside ? `✅ Inside<br><b>${dist}m</b>` : `❌ ${dist}m / ${allowedRadius}m`;
  display.className = inside ? "inside" : "outside";
}

function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  if (!btn) return;

  const inside = distance <= allowedRadius;
  const timeOK = isWithinAllowedTime();
  const ready = inside && timeOK;

  btn.disabled = !ready;
  
  if (!timeOK) {
    btn.textContent = `⏰ Closed ${closeHour}:${closeMinute.toString().padStart(2, '0')}`;
  } else if (!inside) {
    btn.textContent = `📍 ${Math.round(distance)}m`;
  } else {
    btn.textContent = "✅ Mark Attendance";
  }
}

/* TODAY */
async function loadToday() {
  if (!currentUser) return;
  
  try {
    const today = getTodayDate();
    const snap = await getDoc(doc(db, "attendance", currentUser.uid, today, "data"));
    
    const statEl = el("todayStat");
    if (statEl) {
      statEl.textContent = snap.exists() ? "1" : "0";
      statEl.className = snap.exists() ? "present" : "absent";
    }
  } catch (e) {
    el("todayStat").textContent = "ERR";
  }
}

function getTodayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().split("T")[0];
}

/* 🔥 ATTENDANCE 👈 UPDATE CALL ADDED */
window.markAttendance = async () => {
  if (!isWithinAllowedTime()) {
    const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
    return alert(`⏰ CLOSED!\nUntil ${closeTime}`);
  }

  if (!lastCoords) return alert("📍 GPS needed");
  if (!navigator.onLine) return alert("❌ Offline");

  const distance = calculateDistance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (distance > allowedRadius + 10) {
    return alert(`❌ ${Math.round(distance)}m > ${allowedRadius}m`);
  }

  const btn = el("attendanceBtn");
  btn.disabled = true;
  btn.textContent = "💾 Saving...";

  try {
    await saveAttendance({ coords: lastCoords }, distance);
    alert(`✅ SUCCESS!\n📍 ${Math.round(distance)}m`);
    loadToday();
    loadMonthlyStats();  // 👈 YOUR UPDATE CALL
  } catch (e) {
    if (e.message.includes("Already") || e.message.includes("Exists")) {
      console.log("ℹ️ Already marked today");
      alert("✅ Already marked today!");
    } else {
      console.error("Save error:", e);
      alert("❌ Save failed");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Done!";
  }
};

/* SAVE */
async function saveAttendance(position, distance) {
  const today = getTodayDate();
  const ref = doc(db, "attendance", currentUser.uid, today, "data");
  
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error("Already marked");

  await setDoc(ref, {
    status: "present",
    date: today,
    timestamp: serverTimestamp(),
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy || 0,
    distance: Math.round(distance),
    officeLat, officeLon, allowedRadius
  });
}

/* LOGOUT */
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  lastCoords = null;
  await signOut(auth);
};

/* DISTANCE */
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
