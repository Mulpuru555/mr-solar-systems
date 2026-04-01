import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= SAFE ELEMENT ================= */
function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

/* ================= DATE - BULLETPROOF ================= */
function normalizeDate(d) {
  try {
    if (!d) return "";
    
    let date;
    // ✅ Firestore timestamp
    if (d.seconds !== undefined) {
      date = new Date(d.seconds * 1000);
    } 
    // ✅ String date
    else if (typeof d === 'string') {
      date = new Date(d);
    } 
    // ✅ Date object
    else {
      date = new Date(d);
    }
    
    // ✅ Always return YYYY-MM-DD
    return date.toLocaleDateString("en-CA");
  } catch {
    return "";
  }
}

function todayStr() {
  // 🔥 BULLETPROOF: Use normalizeDate for consistency
  return normalizeDate(new Date());
}

/* ================= GLOBAL ================= */
let currentUser = null;
let attendanceCache = [];
let lastCoords = null;

let officeLat = 16.237;
let officeLon = 80.138;
let allowedRadius = 200;
let closeHour = 23;
let closeMinute = 0;

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  currentUser = user;

  try {
    await loadSettings();
    await loadAttendance();
    startLocation();
    startClock();
  } catch (e) {
    console.error(e);
    safeSet("attendanceStatus", "System error");
  }
});

/* ================= SETTINGS ================= */
async function loadSettings() {
  try {
    const s = await getDoc(doc(db, "settings", "tenali"));
    if (s.exists()) {
      const d = s.data();
      officeLat = Number(d?.point?.latitude || 16.237);
      officeLon = Number(d?.point?.longitude || 80.138);
      allowedRadius = Number(d?.radius || 200);
    }

    const t = await getDoc(doc(db, "settings", "attendance"));
    if (t.exists()) {
      const d = t.data();
      closeHour = Number(d?.closeHour || 23);
      closeMinute = Number(d?.closeMinute || 0);
    }
  } catch (e) {
    console.warn("Settings fallback");
  }
}

/* ================= LOAD ATTENDANCE ================= */
async function loadAttendance() {
  try {
    attendanceCache = [];

    // 👉 Get today's record directly
    const today = todayStr();

    const dataRef = doc(
      db,
      "attendance",
      currentUser.uid,
      today,
      "data"
    );

    const snap = await getDoc(dataRef);

    if (snap.exists()) {
      attendanceCache.push(snap.data());
    }

    // 👉 OPTIONAL: load last few days (for streak)
    for (let i = 1; i <= 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dateStr = normalizeDate(d);

      const ref = doc(
        db,
        "attendance",
        currentUser.uid,
        dateStr,
        "data"
      );

      const s = await getDoc(ref);
      if (s.exists()) {
        attendanceCache.push(s.data());
      }
    }

    calculateAll();

  } catch (e) {
    console.error("Attendance load error", e);
  }
}

/* ================= CALCULATIONS ================= */
function calculateAll() {
  const today = todayStr();

  // 🔥 BULLETPROOF TODAY CHECK
  const todayFound = attendanceCache.some(d => {
    const recordDate = normalizeDate(d.date || d.timestamp);
    return recordDate === today;
  });
  safeSet("todayStat", todayFound ? "1" : "0");

  // STREAK
  let streak = 0;
  const validRecords = attendanceCache.filter(d => normalizeDate(d.date || d.timestamp));
  const sorted = validRecords.sort((a, b) => {
    const ta = normalizeDate(a.date || a.timestamp);
    const tb = normalizeDate(b.date || b.timestamp);
    return new Date(tb) - new Date(ta);
  });

  let checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (let record of sorted) {
    let recordDate = new Date(normalizeDate(record.date || record.timestamp) + 'T00:00:00');
    
    const diffDays = Math.floor((checkDate - recordDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 0 || diffDays === 1) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  safeSet("streakCount", streak);

  // MONTHLY
  const now = new Date();
  let present = 0, total = 0;
  const dateSet = new Set(attendanceCache.map(d => normalizeDate(d.date || d.timestamp)));

  for (let i = 1; i <= now.getDate(); i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), i);
    if (d.getDay() === 0) continue; // Sundays only

    total++;
    // ✅ CONSISTENT normalizeDate
    if (dateSet.has(normalizeDate(d))) present++;
  }

  const percent = total > 0 ? Math.round((present / total) * 100) : 0;
  safeSet("percentStat", percent + "%");
}

/* ================= LOCATION ================= */
function startLocation() {
  if (!navigator.geolocation) {
    safeSet("attendanceStatus", "No GPS");
    return;
  }

  function success(pos) {
    lastCoords = pos.coords;
    const dist = distance(pos.coords.latitude, pos.coords.longitude, officeLat, officeLon);

    const now = new Date();
    const withinTime = (now.getHours() * 60 + now.getMinutes()) <= (closeHour * 60 + closeMinute);
    const ok = dist <= allowedRadius && withinTime;

    safeSet("attendanceStatus", ok ? "✅ INSIDE" : `📍 ${Math.round(dist)}m`);

    const btn = document.getElementById("attendanceBtn");
    if (btn) {
      btn.disabled = !ok;
      btn.innerText = ok ? "✅ Mark Attendance" : "❌ Outside/Closed";
    }
  }

  function error(e) {
    safeSet("attendanceStatus", "🚫 Location Denied");
  }

  navigator.geolocation.getCurrentPosition(success, error, { 
    timeout: 15000, 
    enableHighAccuracy: true 
  });
  navigator.geolocation.watchPosition(success, error, { 
    enableHighAccuracy: true 
  });
}

/* ================= CLOCK ================= */
function startClock() {
  setInterval(() => {
    safeSet("liveClock", new Date().toLocaleTimeString("en-IN"));
  }, 1000);
}

/* ================= MARK ATTENDANCE ================= */
async function markAttendance() {
  if (!lastCoords) {
    alert("⏳ Wait for GPS");
    return;
  }

  const today = todayStr();
  if (attendanceCache.some(d => normalizeDate(d.date || d.timestamp) === today)) {
    alert("✅ Already marked today");
    return;
  }

  const dist = distance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (dist > allowedRadius) {
    alert(`🚫 Outside: ${Math.round(dist)}m`);
    return;
  }

  try {
    // 🔥 BULLETPROOF DATE (both date AND timestamp)
    await addDoc(collection(db, "attendance"), {
      userId: currentUser.uid,
      date: today,                           // ✅ Immediate date
      timestamp: serverTimestamp(),          // ✅ Firestore timestamp
      lat: lastCoords.latitude,
      lon: lastCoords.longitude,
      distance: Math.round(dist)
    });
    await loadAttendance();
    alert("✅ Marked!");
  } catch (e) {
    alert("❌ Save failed");
  }
}

/* ================= EVENTS ================= */
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("attendanceBtn");
  if (btn) {
    btn.onclick = markAttendance;
  }
});

/* ================= DISTANCE ================= */
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
