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

/* VARIABLES */
let officeLat = null;
let officeLon = null;
let allowedRadius = 200;
let closeHour = 23;
let closeMinute = 0;
let currentUser = null;
let locationWatchId = null;
let clockInterval = null;
let lastCoords = null;
let attendanceCache = [];

/* HELPERS */
function el(id) {
  return document.getElementById(id);
}

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

function isWithinAllowedTime() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) <= (closeHour * 60 + closeMinute);
}

/* CACHE */
async function loadAttendanceData() {
  if (!currentUser) return;

  try {
    const snap = await getDocs(collection(db, "attendance"));
    attendanceCache = [];

    snap.forEach(doc => {
      const data = doc.data();
      if (data.userId === currentUser.uid || data.employeeId === currentUser.uid) {
        attendanceCache.push(data);
      }
    });

    await Promise.all([
      loadToday(),
      loadStreak(),
      loadMonthlyStats()
    ]);

  } catch (e) {
    console.error("Cache error:", e);
    alert("Failed to load attendance data");
  }
}

/* TODAY */
async function loadToday() {
  if (!currentUser) return;

  const today = getTodayDate();

  const found = attendanceCache.some(d => d.date === today);

  const todayEl = el("todayStat");
  if (todayEl) todayEl.textContent = found ? "1" : "0";
}

/* STREAK */
async function loadStreak() {
  if (!currentUser) return;

  const records = [...attendanceCache];

  records.sort((a, b) =>
    (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
  );

  let streak = 0;
  let current = new Date();
  current.setHours(0,0,0,0);

  for (let r of records) {
    let date = r.timestamp?.seconds
      ? new Date(r.timestamp.seconds * 1000)
      : new Date(r.date);

    date.setHours(0,0,0,0);

    const diff = Math.floor((current - date) / 86400000);

    if (diff === 0 || diff === 1) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else break;
  }

  const streakEl = el("streakCount");
  if (streakEl) streakEl.textContent = streak;
}

/* MONTHLY */
async function loadMonthlyStats() {
  if (!currentUser) return;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();

    let present = 0;
    let total = 0;

    const hSnap = await getDoc(doc(db, "settings", "holidays"));
    const hData = hSnap.exists() ? hSnap.data() : {};

    const userDates = new Set(attendanceCache.map(d => d.date));

    for (let d = 1; d <= currentDay; d++) {
      const date = new Date(year, month, d);
      const str = getTodayDateForDay(date);

      if (date.getDay() === 0) continue;

      if (hData[str]) continue;

      total++;
      if (userDates.has(str)) present++;
    }

    let percent = total > 0 ? Math.round((present / total) * 100) : 0;

    const percentEl = el("percentStat");
    if (percentEl) percentEl.textContent = percent + "%";

  } catch (e) {
    console.error("Monthly error:", e);
  }
}

/* STATUS */
function updateStatus() {
  const s = el("attendanceStatus");
  if (!s) return;

  s.textContent = isWithinAllowedTime() ? "✅ Open" : "⏰ Closed";
}

/* AUTH */
onAuthStateChanged(auth, async user => {

  if (!user) {
    attendanceCache = [];
    return;
  }

  currentUser = user;

  try {
    await loadOfficeSettings();
    startSystem();
  } catch (e) {
    console.error("Settings error", e);
  }
});

/* SETTINGS */
async function loadOfficeSettings() {
  const snap = await getDoc(doc(db, "settings", "tenali"));

  if (!snap.exists()) throw new Error("Settings missing");

  const data = snap.data();

  if (!data?.point) throw new Error("Invalid settings");

  officeLat = Number(data.point.latitude);
  officeLon = Number(data.point.longitude);
  allowedRadius = Number(data.radius) || 200;

  // ✅ RESTORED ADMIN TIME CONTROL
  try {
    const timeSnap = await getDoc(doc(db, "settings", "attendance"));
    if (timeSnap.exists()) {
      const t = timeSnap.data();
      closeHour = Number(t.closeHour) || 23;
      closeMinute = Number(t.closeMinute) || 0;
    }
  } catch (e) {
    console.warn("Time settings not found");
  }
}

/* START */
async function startSystem() {
  startClock();
  updateStatus(); // small fix
  startLocation();
  await loadAttendanceData();
}

/* CLOCK */
function startClock() {
  const clock = el("liveClock");

  if (clockInterval) clearInterval(clockInterval);

  const update = () => {
    if (clock) clock.innerText = new Date().toLocaleTimeString("en-IN");
    updateStatus();
  };

  update();
  clockInterval = setInterval(update, 1000);
}

/* LOCATION */
function startLocation() {
  if (!navigator.geolocation) {
    alert("GPS not supported");
    return;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    pos => {

      lastCoords = pos.coords;

      if (officeLat !== null && officeLon !== null) {
        const dist = calculateDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          officeLat,
          officeLon
        );

        updateAttendanceButton(dist);
      }

    },
    err => {
      alert("Please enable location permission");
      console.error(err);
    }
  );
}

/* BUTTON */
function updateAttendanceButton(distance) {
  const btn = el("attendanceBtn");
  if (!btn) return;

  const ok = distance <= allowedRadius && isWithinAllowedTime();

  btn.disabled = !ok;
  btn.textContent = ok ? "Mark Attendance" : "Outside/Closed";
}

/* MARK ATTENDANCE */
async function markAttendance() {

  if (!currentUser || !lastCoords) return;

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

    if (distance > allowedRadius) {
      alert("Outside allowed area");
      if (btn) btn.disabled = false; // FIXED
      return;
    }

    const exists = attendanceCache.some(d => d.date === today);

    if (exists) throw new Error("Already marked");

    await addDoc(collection(db, "attendance"), {
      userId: currentUser.uid,
      date: today,
      timestamp: serverTimestamp(),
      lat: lastCoords.latitude,
      lon: lastCoords.longitude,
      distance: Math.round(distance),
      status: "present"
    });

    if (btn) {
      btn.textContent = "Marked";
      btn.disabled = true;
    }

    await loadAttendanceData();

  } catch (e) {
    alert(e.message);
    if (btn) btn.disabled = false;
  }
}

/* EVENT */
document.addEventListener("DOMContentLoaded", () => {
  const btn = el("attendanceBtn");
  if (btn) btn.onclick = markAttendance;
});

/* DISTANCE */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI/180;
  const dLon = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
