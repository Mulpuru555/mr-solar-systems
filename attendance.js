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
let clockInterval = null;

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
    stopClock();
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

/* OFFICE SETTINGS */
async function loadOfficeSettings() {
  const snap = await getDoc(doc(db, "settings", "tenali"));
  
  if (!snap.exists()) throw new Error("Office settings not found");
  
  const data = snap.data();
  
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

/* CLOCK - ✅ FIXED FLICKERING */
function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function startClock() {
  stopClock(); // Clear any existing interval
  
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
    }
  };
  
  // Initial call
  tick();
  
  // ✅ FIXED: Single interval reference
  clockInterval = setInterval(tick, 1000);
}

/* LOCATION TRACKING - ✅ FIXED PERMISSION */
function stopLocationTracking() {
  if (locationWatchId !== null) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
  }
}

// ✅ FIXED: Force permission request
function requestLocationPermission() {
  return new Promise((resolve) => {
    const display = el("distanceDisplay");
    if (display) display.textContent = "📍 Requesting location access...";
    
    // Force permission prompt by using getCurrentPosition first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("✅ Location permission granted");
        resolve(true);
      },
      (error) => {
        console.log("Permission status:", error.code);
        if (error.code === 1) {
          // Permission denied
          resolve(false);
        } else {
          // Other error, try again
          resolve("retry");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

async function startLocation() {
  const display = el("distanceDisplay");
  const btn = el("attendanceBtn");
  
  if (display) display.textContent = "Initializing location...";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Loading...";
  }

  if (!navigator.geolocation) {
    if (display) display.textContent = "❌ Geolocation not supported";
    return;
  }

  stopLocationTracking();
  
  // ✅ FIXED: Force permission request first
  const permissionResult = await requestLocationPermission();
  
  if (permissionResult === false) {
    if (display) display.textContent = "📍 Location permission denied";
    if (btn) btn.textContent = "Enable location permission";
    return;
  }
  
  if (permissionResult === "retry") {
    if (display) display.textContent = "🔄 Retrying location...";
  }

  if (display) display.textContent = "Tracking location...";
  
  // Start continuous tracking
  const options = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000
  };
  
  locationWatchId = navigator.geolocation.watchPosition(
    pos => handleLocationUpdate(pos.coords),
    error => handleLocationError(error),
    options
  );
}

function handleLocationError(error) {
  console.error("Location error:", error);
  const display = el("distanceDisplay");
  if (!display) return;
  
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
      setTimeout(() => {
        if (officeLat !== null && officeLon !== null) {
          startLocation();
        }
      }, 5000);
      break;
    default: 
      msg = "📍 Location error";
  }
  
  display.textContent = msg;
  display.className = "error";
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

/* MARK ATTENDANCE */
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

    if (distance > allowedRadius + 10) {
      alert(`❌ Too far!\n${Math.round(distance)}m > ${allowedRadius}m limit`);
      return;
    }

    await saveAttendance(position, distance);
    alert(`✅ Attendance marked!\n📍 ${Math.round(distance)}m from office`);
    
    loadToday();
    
  } catch (error) {
    console.error("Attendance error:", error);
    const msg = error.code === 1 ? 
      "📍 Location permission needed" : 
      error.code === 3 ? 
      "⏱️ GPS timeout - try outdoors" : 
      "❌ Failed to mark attendance";
    alert(msg);
  } finally {
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

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

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
    radius: allowedRadius
  }, { merge: true });
}

/* GLOBAL API */
window.markAttendance = markAttendance;
window.signOutUser = async () => {
  stopLocationTracking();
  stopClock();
  await signOut(auth);
};

window.refreshData = () => {
  loadToday();
  if (officeLat !== null && officeLon !== null) {
    startLocation();
  }
};

/* DISTANCE */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + 
            Math.cos(lat1 * Math.PI / 180) * 
            Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
