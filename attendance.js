import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc
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
let clockInterval = null;  // 🔥 SINGLE INTERVAL ONLY
let lastCoords = null;

/* ELEMENT */
function el(id) {
  return document.getElementById(id);
}

/* 🔥 ADMIN TIME CHECK (DEVICE TIME - FAST UI) */
function isWithinAllowedTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const closeMinutes = closeHour * 60 + closeMinute;
  return currentMinutes <= closeMinutes;
}

/* 🔥 UI STATES */
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
    stopClock();  // 🔥 CLEANUP
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

/* 🔥 LOAD ADMIN SETTINGS */
async function loadOfficeSettings() {
  // 📍 OFFICE
  const officeSnap = await getDoc(doc(db, "settings", "tenali"));
  if (!officeSnap.exists()) throw new Error("No office settings");

  const officeData = officeSnap.data();
  officeLat = Number(officeData.point.latitude);
  officeLon = Number(officeData.point.longitude);
  allowedRadius = Number(officeData.radius) || 200;

  // ⏰ TIME LIMITS
  try {
    const timeSnap = await getDoc(doc(db, "settings", "attendance"));
    if (timeSnap.exists()) {
      const timeData = timeSnap.data();
      closeHour = Number(timeData.closeHour) || 23;
      closeMinute = Number(timeData.closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Using default time settings");
  }

  console.log(`✅ Office OK | Close: ${closeHour}:${closeMinute.toString().padStart(2, '0')}`);
}

/* SYSTEM */
function startSystem() {
  startClock();  // 🔥 FIXED CLOCK
  startLocation();
  loadToday();
}

/* 🔧 FIX 1: FLICKERING CLOCK (100% SOLUTION) */
function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function startClock() {
  const clock = el("liveClock");
  if (!clock) return;

  // ✅ PREVENT MULTIPLE INTERVALS
  if (clockInterval) {
    clearInterval(clockInterval);
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // ✅ UPDATE ONLY IF CHANGED (NO FLICKER)
    if (clock.innerText !== time) {
      clock.innerText = time;
    }

    // 🔥 TIME STATUS
    const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
    const status = isWithinAllowedTime() ? `✅ Open (${closeTime})` : `⏰ Closed (${closeTime})`;
    clock.title = status;
  }

  updateClock(); // 🔥 IMMEDIATE UPDATE
  clockInterval = setInterval(updateClock, 1000); // 🔥 SINGLE INTERVAL
  
  console.log("🕐 Anti-flicker clock started");
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
      lastCoords = pos.coords;  // 🔥 INSTANT CACHE

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

/* 🔥 MARK ATTENDANCE (ANTI-CHEAT) */
window.markAttendance = async () => {
  // 🔥 TIME CHECK (FAST UI)
  if (!isWithinAllowedTime()) {
    const closeTime = `${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`;
    return alert(`⏰ CLOSED!\nUntil ${closeTime}\nNow: ${new Date().toLocaleTimeString('en-US', {hour12: false})}`);
  }

  // 🔥 LOCATION
  if (!lastCoords) return alert("📍 GPS needed");

  // 🔥 ONLINE
  if (!navigator.onLine) return alert("❌ Offline");

  // 🔥 DISTANCE
  const distance = calculateDistance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (distance > allowedRadius + 10) {
    return alert(`❌ ${Math.round(distance)}m > ${allowedRadius}m`);
  }

  const btn = el("attendanceBtn");
  btn.disabled = true;
  btn.textContent = "💾 Saving...";

  try {
    // 🔥 SERVER TIMESTAMP (ANTI-CHEAT)
    await saveAttendance({ coords: lastCoords }, distance);
    alert(`✅ SUCCESS!\n📍 ${Math.round(distance)}m`);
    loadToday();
  } catch (e) {
    if (e.message.includes("Exists")) {
      alert("✅ Already marked today!");
    } else {
      alert("❌ Try again");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✅ Done!";
  }
};

/* 🔥 SAVE WITH SERVER TIME (CHEAT-PROOF) */
async function saveAttendance(position, distance) {
  const today = getTodayDate();
  const ref = doc(db, "attendance", currentUser.uid, today, "data");
  
  // 🔥 CHECK DUPLICATE
  const snap = await getDoc(ref);
  if (snap.exists()) throw new Error("Already marked");

  // 🔥 SERVER TIMESTAMP (Can't fake!)
  await setDoc(ref, {
    uid: currentUser.uid,
    status: "present",
    date: today,
    timestamp: serverTimestamp(),  // 🔥 REAL SERVER TIME
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy || 0,
    distance: Math.round(distance),
    officeLat, officeLon, allowedRadius,
    closeHour, closeMinute,
    deviceTime: new Date().toISOString(),  // For audit
    userAgent: navigator.userAgent.slice(0, 100)
  });
}

/* CLEANUP */
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
