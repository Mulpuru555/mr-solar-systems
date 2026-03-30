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
let clockStarted = false;
let lastCoords = null;

/* ELEMENT */
function el(id) {
  return document.getElementById(id);
}

/* 🔥 TIME CHECK (ADMIN CONTROLLED) */
function isWithinAllowedTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const closeMinutes = closeHour * 60 + closeMinute;
  return currentMinutes <= closeMinutes;
}

/* 🔥 UI HELPERS */
function showLoginState() {
  el("distanceDisplay").textContent = "👋 Please login";
  el("todayStat").textContent = "NO";
  el("todayStat").className = "absent";
  const btn = el("attendanceBtn");
  if (btn) btn.textContent = "Login required";
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
    showErrorState("Failed to load settings");
  }
});

/* 🔥 LOAD SETTINGS (OFFICE + TIME) */
async function loadOfficeSettings() {
  // 📍 OFFICE LOCATION
  const officeSnap = await getDoc(doc(db, "settings", "tenali"));
  if (!officeSnap.exists()) throw new Error("No office settings");

  const officeData = officeSnap.data();
  if (!officeData.point?.latitude || !officeData.point.longitude) {
    throw new Error("Invalid office coordinates");
  }

  officeLat = Number(officeData.point.latitude);
  officeLon = Number(officeData.point.longitude);
  allowedRadius = Number(officeData.radius) || 200;

  // ⏰ ADMIN TIME SETTINGS
  try {
    const timeSnap = await getDoc(doc(db, "settings", "attendance"));
    if (timeSnap.exists()) {
      const timeData = timeSnap.data();
      closeHour = Number(timeData.closeHour) || 23;
      closeMinute = Number(timeData.closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Time settings not found, using defaults");
  }

  console.log(`✅ Office: ${officeLat.toFixed(6)}, ${officeLon.toFixed(6)}`);
  console.log(`✅ Radius: ${allowedRadius}m | Close: ${closeHour}:${closeMinute.toString().padStart(2, '0')}`);
}

/* SYSTEM START */
function startSystem() {
  startClock();
  startLocation();
  loadToday();
}

/* 🔥 CLOCK (NO FLICKER) */
function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
  clockStarted = false;
}

function startClock() {
  if (clockStarted) {
    console.log("⏰ Clock already running");
    return;
  }

  clockStarted = true;
  console.log("🕐 Clock started");

  const tick = () => {
    const clock = el("liveClock");
    if (clock) {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // 🔥 TIME STATUS
      const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
      const status = isWithinAllowedTime() ? `✅ Open (${closeTime})` : `⏰ Closed (${closeTime})`;
      clock.title = status;
    }
  };

  tick();
  clockInterval = setInterval(tick, 1000);
}

/* LOCATION TRACKING */
function stopLocationTracking() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

function startLocation() {
  const display = el("distanceDisplay");
  display.textContent = "📍 Getting GPS...";

  if (!navigator.geolocation) {
    display.textContent = "❌ GPS not supported";
    return;
  }

  stopLocationTracking();

  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      lastCoords = pos.coords;  // 🔥 CACHE LOCATION

      if (officeLat == null) {
        display.textContent = "Loading office...";
        return;
      }

      const distance = calculateDistance(
        pos.coords.latitude,
        pos.coords.longitude,
        officeLat,
        officeLon
      );

      updateDistanceDisplay(distance);
      updateAttendanceButton(distance);
    },
    (err) => {
      const msg = {
        1: "📍 Permission denied",
        2: "📍 GPS off",
        3: "⏱️ GPS timeout"
      }[err.code] || "📍 GPS error";
      display.textContent = msg;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

/* 🔥 UI UPDATES */
function updateDistanceDisplay(distance) {
  const display = el("distanceDisplay");
  if (!display) return;
  
  const dist = Math.round(distance);
  const inside = distance <= allowedRadius;
  
  display.innerHTML = inside
    ? `✅ Inside<br><b>${dist}m</b>`
    : `❌ Outside<br><b>${dist}m</b> / ${allowedRadius}m`;
    
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

/* TODAY STATUS */
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
    console.error("Today status error:", e);
    el("todayStat").textContent = "ERR";
  }
}

function getTodayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().split("T")[0];
}

/* 🔥 MARK ATTENDANCE (INSTANT + TIME SAFE) */
window.markAttendance = async () => {
  // 🔥 1. TIME CHECK
  if (!isWithinAllowedTime()) {
    const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
    return alert(`⏰ ATTENDANCE CLOSED!\nAllowed until ${closeTime}\nCurrent: ${new Date().toLocaleTimeString('en-US', {hour12: false})}\n\nTry tomorrow!`);
  }

  // 🔥 2. LOCATION CHECK
  if (!lastCoords) {
    return alert("📍 GPS signal required\nPlease wait...");
  }

  // 🔥 3. ONLINE CHECK
  if (!navigator.onLine) {
    return alert("❌ No internet connection");
  }

  // 🔥 4. DISTANCE CHECK
  const distance = calculateDistance(
    lastCoords.latitude,
    lastCoords.longitude,
    officeLat,
    officeLon
  );

  if (distance > allowedRadius + 10) {  // +10m buffer
    return alert(`❌ OUTSIDE RANGE\n📏 ${Math.round(distance)}m\n💯 Limit: ${allowedRadius}m`);
  }

  const btn = el("attendanceBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "💾 Saving...";
  }

  try {
    // 🔥 5. INSTANT SAVE (CACHED LOCATION)
    await saveAttendance({ coords: lastCoords }, distance);
    
    const successMsg = `🎉 ATTENDANCE SUCCESS!\n📍 ${Math.round(distance)}m\n⏰ ${new Date().toLocaleTimeString()}\n📅 ${getTodayDate()}`;
    alert(successMsg);
    
    loadToday();
    
  } catch (error) {
    console.error("Save error:", error);
    if (error.message.includes("Exists")) {
      alert("✅ Already marked today!");
    } else {
      alert("❌ Save failed - try again");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✅ Marked Today!";
    }
  }
};

/* 🔥 SAVE ATTENDANCE */
async function saveAttendance(position, distance) {
  const today = getTodayDate();
  const ref = doc(db, "attendance", currentUser.uid, today, "data");
  
  // 🔥 DUPLICATE CHECK
  const snap = await getDoc(ref);
  if (snap.exists()) {
    throw new Error("Already marked today");
  }

  await setDoc(ref, {
    status: "present",
    date: today,
    timestamp: serverTimestamp(),
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy || 0,
    distance: Math.round(distance),
    officeLat,
    officeLon,
    radius: allowedRadius,
    time: new Date().toISOString(),
    closeHour,
    closeMinute
  });
}

/* 🔥 CLEAN LOGOUT */
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  clockStarted = false;
  lastCoords = null;
  await signOut(auth);
  console.log("👋 Signed out");
};

/* 🔥 REFRESH */
window.refreshData = () => {
  loadToday();
  startLocation();
};

/* DISTANCE CALC */
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
