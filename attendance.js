import { auth, db } from "./firebase-config.js";

// ✅ CORRECT CDN IMPORTS (CRITICAL)
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= DEBUG ================= */
let debugEnabled = true;
function debug(msg) {
  if (!debugEnabled) return;
  console.log(`[DEBUG] ${msg}`);
  const debugEl = document.getElementById('debug');
  if (debugEl) {
    const time = new Date().toLocaleTimeString();
    debugEl.innerHTML += `<div style="font-size:11px; padding:1px 0;">${time}: ${msg}</div>`;
    debugEl.scrollTop = debugEl.scrollHeight;
  }
}

/* ================= SAFE ELEMENT ================= */
function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

/* ================= DATE ================= */
function normalizeDate(d) {
  try {
    if (!d) return "";
    if (d.seconds) return new Date(d.seconds * 1000).toISOString().split("T")[0];
    if (typeof d === 'string') return new Date(d).toISOString().split("T")[0];
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ================= GLOBAL ================= */
let currentUser = null;
let attendanceCache = [];
let lastCoords = null;

let officeLat = 16.237;  // Tenali
let officeLon = 80.138;
let allowedRadius = 200;
let closeHour = 23;
let closeMinute = 0;

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    safeSet("attendanceStatus", "👤 Login required");
    debug("⏳ Waiting for user login...");
    return;
  }

  currentUser = user;
  debug(`✅ User logged in: ${user.uid.slice(0,8)}...`);

  try {
    await loadSettings();
    await loadAttendance();
    startLocation();
    startClock();
  } catch (e) {
    debug("❌ Init failed: " + e.message);
    safeSet("attendanceStatus", "❌ System error");
  }
});

/* ================= SETTINGS ================= */
async function loadSettings() {
  try {
    const sDoc = await getDoc(doc(db, "settings", "tenali"));
    if (sDoc.exists()) {
      const data = sDoc.data();
      officeLat = Number(data?.point?.latitude || 16.237);
      officeLon = Number(data?.point?.longitude || 80.138);
      allowedRadius = Number(data?.radius || 200);
      debug(`📍 Office: ${officeLat.toFixed(4)}, ${officeLon.toFixed(4)} | Radius: ${allowedRadius}m`);
    }

    const tDoc = await getDoc(doc(db, "settings", "attendance"));
    if (tDoc.exists()) {
      const data = tDoc.data();
      closeHour = Number(data?.closeHour || 23);
      closeMinute = Number(data?.closeMinute || 0);
      debug(`⏰ Closes: ${closeHour}:${closeMinute.toString().padStart(2,'0')}`);
    }
  } catch (e) {
    debug("⚠️ No settings doc - using defaults");
  }
}

/* ================= LOAD ATTENDANCE ================= */
async function loadAttendance() {
  try {
    debug("🔄 Loading your attendance...");
    const snap = await getDocs(collection(db, "attendance"));
    attendanceCache = [];
    
    let userCount = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.userId === currentUser.uid) {
        attendanceCache.push({ id: docSnap.id, ...data });
        userCount++;
      }
    });
    
    debug(`📊 Total records found: ${snap.size} | 👤 YOUR records: ${userCount}`);
    
    if (userCount === 0) {
      debug("ℹ️  No attendance records for this user yet");
    } else {
      const latest = attendanceCache[0];
      debug(`📅 Latest record: ${normalizeDate(latest.date || latest.timestamp)}`);
    }
    
    calculateAll();
  } catch (e) {
    debug("❌ Load failed: " + e.message);
  }
}

/* ================= CALCULATIONS ================= */
function calculateAll() {
  const today = todayStr();
  
  // ✅ TODAY STAT (0/1 format)
  const todayFound = attendanceCache.some(d =>
    normalizeDate(d.date || d.timestamp) === today
  );
  safeSet("todayStat", todayFound ? "1" : "0");
  
  // ✅ STREAK
  let streak = 0;
  const validRecords = attendanceCache.filter(d => d.date || d.timestamp);
  const sorted = validRecords.sort((a, b) => {
    const ta = a.timestamp?.seconds || new Date(a.date).getTime()/1000;
    const tb = b.timestamp?.seconds || new Date(b.date).getTime()/1000;
    return tb - ta;
  });
  
  let checkDate = new Date();
  checkDate.setHours(0,0,0,0);
  
  for (let record of sorted) {
    let recordDate = record.timestamp?.seconds 
      ? new Date(record.timestamp.seconds * 1000)
      : new Date(record.date);
    recordDate.setHours(0,0,0,0);
    
    const diffDays = Math.floor((checkDate - recordDate) / (1000*60*60*24));
    if (diffDays === 0 || diffDays === 1) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }
  safeSet("streakCount", streak);
  
  // ✅ MONTHLY (Sundays only - original logic)
  const now = new Date();
  let present = 0, total = 0;
  const dateSet = new Set(attendanceCache.map(d => normalizeDate(d.date || d.timestamp)));
  
  for (let i = 1; i <= now.getDate(); i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), i);
    if (d.getDay() === 0) continue; // Sundays only
    
    total++;
    if (dateSet.has(normalizeDate(d))) present++;
  }
  
  const percent = total > 0 ? Math.round((present/total)*100) : 0;
  safeSet("percentStat", percent + "%");
  
  debug(`📈 Stats → Today: ${todayFound ? '1' : '0'} | Streak: ${streak} | Monthly: ${percent}% (${present}/${total})`);
}

/* ================= LOCATION ================= */
function startLocation() {
  debug("🛰️ Starting GPS...");
  
  if (!navigator.geolocation) {
    safeSet("attendanceStatus", "❌ No GPS support");
    debug("❌ Browser doesn't support geolocation");
    return;
  }

  function success(pos) {
    lastCoords = pos.coords;
    const dist = distance(pos.coords.latitude, pos.coords.longitude, officeLat, officeLon);
    
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const closeMin = closeHour * 60 + closeMinute;
    const withinTime = currentMin <= closeMin;
    
    const ok = dist <= allowedRadius && withinTime;
    
    safeSet("attendanceStatus", ok ? "✅ READY TO MARK" : `📍 ${Math.round(dist)}m away`);
    
    const btn = document.getElementById("attendanceBtn");
    if (btn) {
      btn.disabled = !ok;
      btn.innerText = ok ? "✅ MARK ATTENDANCE" : `❌ ${Math.round(dist)}m / Closed`;
    }
    
    debug(`📍 GPS OK → Lat:${pos.coords.latitude.toFixed(4)} Lon:${pos.coords.longitude.toFixed(4)} | Dist:${Math.round(dist)}m | Time:${withinTime ? 'OK' : 'CLOSED'} | CanMark:${ok}`);
  }

  function error(err) {
    let msg = "🚫 GPS Failed";
    switch(err.code) {
      case 1: msg = "🚫 Location blocked"; break;
      case 2: msg = "🚫 No GPS signal"; break;
      case 3: msg = "🚫 GPS timeout"; break;
    }
    safeSet("attendanceStatus", msg);
    debug(`❌ GPS Error ${err.code}: ${err.message}`);
  }

  // Initial position
  navigator.geolocation.getCurrentPosition(success, error, { 
    timeout: 15000, 
    enableHighAccuracy: true,
    maximumAge: 300000 
  });
  
  // Continuous watch
  navigator.geolocation.watchPosition(success, error, { 
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000 
  });
}

/* ================= CLOCK ================= */
function startClock() {
  function tick() {
    safeSet("liveClock", new Date().toLocaleTimeString("en-IN"));
  }
  tick();
  setInterval(tick, 1000);
}

/* ================= MARK ATTENDANCE ================= */
async function markAttendance() {
  if (!lastCoords) {
    alert("⏳ GPS not ready - wait 5 seconds");
    return;
  }

  const today = todayStr();
  if (attendanceCache.some(d => normalizeDate(d.date || d.timestamp) === today)) {
    alert("✅ Already marked today!");
    return;
  }

  const dist = distance(lastCoords.latitude, lastCoords.longitude, officeLat, officeLon);
  if (dist > allowedRadius) {
    alert(`🚫 Outside zone!\nDistance: ${Math.round(dist)}m\nMax allowed: ${allowedRadius}m`);
    return;
  }

  try {
    debug("✍️ Marking attendance...");
    const docRef = await addDoc(collection(db, "attendance"), {
      userId: currentUser.uid,
      date: today,
      timestamp: serverTimestamp(),
      lat: lastCoords.latitude,
      lon: lastCoords.longitude,
      distance: Math.round(dist),
      officeLat: officeLat,
      officeLon: officeLon
    });
    
    debug(`✅ SAVED! Doc ID: ${docRef.id}`);
    await loadAttendance();
    alert("🎉 Attendance marked successfully!");
  } catch (e) {
    debug("❌ Mark failed: " + e.message);
    alert("❌ Failed to save: " + e.message);
  }
}

/* ================= EVENTS ================= */
document.addEventListener("DOMContentLoaded", () => {
  // ✅ SAFE BUTTON ATTACHMENT (NO CRASH)
  const btn = document.getElementById("attendanceBtn");
  if (btn) {
    btn.onclick = markAttendance;
    debug("✅ Button attached");
  } else {
    debug("⚠️ Button not found - check HTML");
  }
  
  // ✅ DEBUG PANEL (VISIBLE FOR TESTING)
  if (!document.getElementById('debug')) {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug';
    debugDiv.style.cssText = `
      position:fixed; top:10px; right:10px; 
      width:340px; height:320px; max-height:320px;
      overflow:auto; background:rgba(0,0,0,0.9); color:#0f0; 
      padding:12px; font-family:monospace; font-size:11px; 
      z-index:99999; border-radius:8px; 
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(debugDiv);
  }
  
  debug("🎯 DOM ready - system fully initialized");
});

/* ================= DISTANCE ================= */
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// 🔥 STARTUP
debug("🚀 Attendance System v2.0 - LOADING...");
debug("📱 TIP: Use http://localhost (Live Server) + Allow Location");
