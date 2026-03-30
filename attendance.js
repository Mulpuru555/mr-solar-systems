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

/* VARIABLES */
let officeLat = null;
let officeLon = null;
let allowedRadius = 200;
let currentUser = null;
let locationWatchId = null;

/* ELEMENT */
function el(id) {
  return document.getElementById(id);
}

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("User not authenticated");
    showLoginState();
    stopLocationTracking();
    return;
  }

  currentUser = user;
  console.log("User authenticated:", user.uid);
  
  try {
    await loadOfficeSettings();
    startSystem();
  } catch (e) {
    console.error("Error initializing system:", e);
    showErrorState("Failed to load office settings");
  }
});

/* OFFICE SETTINGS - ✅ FIXED */
async function loadOfficeSettings() {
  const snap = await getDoc(doc(db, "settings", "tenali"));
  
  if (!snap.exists()) throw new Error("Office settings not found");
  
  const data = snap.data();
  
  // ✅ FIXED: Proper null/undefined checks
  if (
    data.point &&
    data.point.latitude != null &&
    data.point.longitude != null
  ) {
    officeLat = Number(data.point.latitude);
    officeLon = Number(data.point.longitude);
    console.log("✅ Office:", officeLat.toFixed(6), officeLon.toFixed(6));
  } else {
    throw new Error("Invalid office coordinates");
  }
  
  allowedRadius = Number(data.radius) || 200;
  console.log("✅ Radius:", allowedRadius, "m");
}

/* INIT */
function startSystem() {
  if (officeLat !== null && officeLon !== null) {
    startClock();
    startLocation();
    loadToday();
  }
}

/* LOCATION TRACKING - ✅ FULLY FIXED */
function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

async function checkLocationPermission() {
  if (!navigator.permissions) return true;
  
  try {
    const permission = await navigator.permissions.query({name: 'geolocation'});
    return permission.state === 'granted';
  } catch (e) {
    console.warn("Permission check failed:", e);
    return true;
  }
}

async function startLocation() {
  const display = el("distanceDisplay");
  const btn = el("attendanceBtn");
  
  if (display) display.textContent = "Checking permissions...";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Loading...";
  }

  if (!navigator.geolocation) {
    if (display) display.textContent = "❌ Geolocation not supported";
    return;
  }

  // ✅ Check permission first
  const hasPermission = await checkLocationPermission();
  if (!hasPermission) {
    if (display) display.textContent = "📍 Enable location permission";
    return;
  }

  if (display) display.textContent = "Getting GPS location...";
  
  stopLocationTracking();
  
  // ✅ FIXED: Single options object + longer timeout
  const options = {
    enableHighAccuracy: true,
    timeout: 15000,      // 15 seconds
    maximumAge: 30000    // 30 seconds cache
  };
  
  locationWatchId = navigator.geolocation.watchPosition(
    pos => handleLocationUpdate(pos.coords),
    error => handleLocationError(error),
    options
  );
}

function handleLocationError(error) {
  console.error("Location error:", error);
  let msg;
  
  switch(error.code) {
    case 1: 
      msg = "📍 Location permission denied";
      break;
    case 2: 
      msg = "📍 GPS signal unavailable";
      break;
    case 3: 
      msg = "⏱️ GPS timeout - retrying...";
      // ✅ Auto-retry after timeout
      setTimeout(() => {
        if (officeLat !== null && officeLon !== null) {
          startLocation();
        }
      }, 3000);
      break;
    default: 
      msg = "📍 Location error";
  }
  
  updateDistanceDisplay(msg, "error");
}

function handleLocationUpdate(coords) {
  if (officeLat === null || officeLon === null) {
    updateDistanceDisplay("Loading office...", "loading");
    return;
  }

  const distance = calculateDistance(coords.latitude, coords.longitude, officeLat, officeLon);
  updateDistanceDisplay(distance);
  updateAttendanceButton(distance);
}

/* UI */
function showLoginState() {
  updateDistanceDisplay("Please login...", "login");
  updateTodayStat("NO");
  setButtonState(false, "Login required");
}

function showErrorState(message) {
  updateDistanceDisplay(message, "error");
  setButtonState(false, "Error");
}

function updateDistanceDisplay(distance, status = null) {
  const display = el("distanceDisplay");
  if (!display) return;

  if (typeof distance === 'number') {
    const dist = Math.round(distance);
    const inside = distance <= allowedRadius;
    display.innerHTML = inside ? 
      `✅ Inside<br><strong>${dist}m</strong>` : 
      `❌ Outside<br>${dist}m / ${allowedRadius}m`;
    display.className = inside ? "inside" : "outside";
  } else {
    display.textContent = distance;
    display.className = status || "loading";
  }
}

function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  if (!btn) return;

  const inside = distance <= allowedRadius;
  const ready = currentUser && officeLat !== null && officeLon !== null && inside;
  
  btn.disabled = !ready;
  btn.textContent = ready ? "✅ Mark Attendance" : 
                   inside ? "Waiting..." : 
                   `Outside ${Math.round(distance)}m`;
}

function setButtonState(enabled, text) {
  const btn = el("attendanceBtn");
  if (btn) {
    btn.disabled = !enabled;
    btn.textContent = text;
  }
}

/* TODAY */
async function loadToday() {
  if (!currentUser) return;

  try {
    const today = getTodayDate();
    const ref = doc(db, "attendance", currentUser.uid, today, "data");
    const snap = await getDoc(ref);
    updateTodayStat(snap.exists() ? "1" : "0");
  } catch (e) {
    console.error("Load today error:", e);
    updateTodayStat("ERR");
  }
}

function updateTodayStat(status) {
  const box = el("todayStat");
  if (box) {
    box.textContent = status;
    box.className = status === "1" ? "present" : status === "0" ? "absent" : "error";
  }
}

function getTodayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().split("T")[0];
}

/* MARK ATTENDANCE - ✅ IMPROVED */
async function markAttendance() {
  if (!navigator.onLine) {
    alert("❌ No internet connection");
    return;
  }

  if (currentUser === null || officeLat === null || officeLon === null) {
    alert("Please wait for system to load");
    return;
  }

  const btn = el("attendanceBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Getting precise location...";
  }

  try {
    const position = await getCurrentPosition();
    const distance = calculateDistance(
      position.coords.latitude, 
      position.coords.longitude, 
      officeLat, 
      officeLon
    );

    console.log(`📍 Distance: ${Math.round(distance)}m, Accuracy: ${position.coords.accuracy?.toFixed(0)}m`);

    if (distance > allowedRadius + 10) {
      alert(`❌ Too far!\n${Math.round(distance)}m > ${allowedRadius}m limit`);
      return;
    }

    await saveAttendance(position, distance);
    alert(`✅ Attendance marked!\n📍 ${Math.round(distance)}m from office\n📏 Accuracy: ${position.coords.accuracy?.toFixed(0) || 'N/A'}m`);
    
    loadToday();
    
  } catch (error) {
    console.error("Attendance error:", error);
    const msg = error.code === 1 ? 
      "📍 Location permission needed" : 
      error.code === 3 ? 
      "⏱️ GPS timeout - try again in open area" :
      "❌ Failed to mark attendance";
    alert(msg);
  } finally {
    // Safe button reset
    if (btn) {
      btn.disabled = false;
      const display = el("distanceDisplay");
      if (display && display.className === "inside") {
        updateAttendanceButton(0);
      } else {
        updateAttendanceButton(allowedRadius + 1);
      }
    }
  }
}

// ✅ FIXED: Better geolocation promise
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    const options = {
      enableHighAccuracy: true,
      timeout: 20000,      // 20 seconds for precise location
      maximumAge: 0        // Fresh location only
    };
    
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

// ✅ IMPROVED: Better duplicate check
async function saveAttendance(position, distance) {
  const today = getTodayDate();
  const ref = doc(db, "attendance", currentUser.uid, today, "data");
  
  const snap = await getDoc(ref);
  if (snap.exists()) {
    alert("✅ Already marked today!");
    return;
  }

  await setDoc(ref, {
    status: "present",
    date: today,
    timestamp: serverTimestamp(),
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy || 0,
    distance: Math.round(distance),
    officeLat: officeLat,
    officeLon: officeLon,
    radius: allowedRadius,
    device: navigator.userAgent.slice(0, 100)
  }, { merge: true });
}

/* GLOBAL API */
window.markAttendance = markAttendance;
window.signOutUser = async () => {
  stopLocationTracking();
  await signOut(auth);
};

window.refreshData = () => {
  loadToday();
  if (officeLat !== null && officeLon !== null) {
    startLocation();
  }
};

/* CLOCK */
function startClock() {
  const tick = () => {
    const clock = el("liveClock");
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* DISTANCE CALCULATION */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + 
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
