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

/* ================= DATE ================= */
function normalizeDate(d) {
  try {
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

let officeLat = 0;
let officeLon = 0;
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
    alert("System error");
  }
});

/* ================= SETTINGS ================= */
async function loadSettings() {
  try {
    const s = await getDoc(doc(db, "settings", "tenali"));
    if (s.exists()) {
      const d = s.data();
      officeLat = Number(d?.point?.latitude || 0);
      officeLon = Number(d?.point?.longitude || 0);
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
    const snap = await getDocs(collection(db, "attendance"));
    attendanceCache = [];

    snap.forEach(doc => {
      const d = doc.data();
      if (d.userId === currentUser.uid) attendanceCache.push(d);
    });

    calculateAll();

  } catch (e) {
    console.error("Attendance load error", e);
  }
}

/* ================= CALCULATIONS ================= */
function calculateAll() {
  const today = todayStr();

  // TODAY
  const todayFound = attendanceCache.some(d =>
    normalizeDate(d.date) === today
  );
  safeSet("todayStat", todayFound ? "1" : "0");

  // STREAK
  let streak = 0;
  let current = new Date();
  current.setHours(0,0,0,0);

  const sorted = [...attendanceCache].sort((a,b)=>
    (b.timestamp?.seconds||0)-(a.timestamp?.seconds||0)
  );

  for (let r of sorted) {
    let d = r.timestamp?.seconds
      ? new Date(r.timestamp.seconds*1000)
      : new Date(r.date);

    d.setHours(0,0,0,0);

    const diff = (current - d)/(1000*60*60*24);

    if (diff === 0 || diff === 1) {
      streak++;
      current.setDate(current.getDate()-1);
    } else break;
  }

  safeSet("streakCount", streak);

  // MONTHLY
  const now = new Date();
  let present = 0, total = 0;

  const set = new Set(attendanceCache.map(d => normalizeDate(d.date)));

  for (let i=1;i<=now.getDate();i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), i);
    if (d.getDay()===0) continue;

    total++;
    const str = normalizeDate(d);
    if (set.has(str)) present++;
  }

  const percent = total>0 ? Math.round((present/total)*100) : 0;
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

    const dist = distance(
      pos.coords.latitude,
      pos.coords.longitude,
      officeLat,
      officeLon
    );

    const now = new Date();
    const withinTime =
      (now.getHours()*60 + now.getMinutes()) <= (closeHour*60 + closeMinute);

    const ok = dist <= allowedRadius && withinTime;

    safeSet("attendanceStatus", ok ? "Inside" : "Outside");

    const btn = document.getElementById("attendanceBtn");
    if (btn) {
      btn.disabled = !ok;
      btn.innerText = ok ? "Mark Attendance" : "Outside/Closed";
    }
  }

  function error(e) {
    safeSet("attendanceStatus", "Location Blocked");
  }

  navigator.geolocation.getCurrentPosition(success, error, {timeout:10000});
  navigator.geolocation.watchPosition(success, error, {enableHighAccuracy:true});
}

/* ================= CLOCK ================= */
function startClock() {
  setInterval(()=>{
    safeSet("liveClock", new Date().toLocaleTimeString("en-IN"));
  },1000);
}

/* ================= MARK ================= */
async function markAttendance() {
  if (!lastCoords) {
    alert("Wait for location");
    return;
  }

  const today = todayStr();

  if (attendanceCache.some(d=>normalizeDate(d.date)===today)) {
    alert("Already marked");
    return;
  }

  const dist = distance(
    lastCoords.latitude,
    lastCoords.longitude,
    officeLat,
    officeLon
  );

  if (dist > allowedRadius) {
    alert("Outside area");
    return;
  }

  await addDoc(collection(db,"attendance"),{
    userId: currentUser.uid,
    date: today,
    timestamp: serverTimestamp(),
    lat: lastCoords.latitude,
    lon: lastCoords.longitude
  });

  await loadAttendance();
}

/* ================= EVENT ================= */
document.addEventListener("DOMContentLoaded",()=>{
  const btn = document.getElementById("attendanceBtn");
  if (btn) btn.onclick = markAttendance;
});

/* ================= DISTANCE ================= */
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) *
    Math.cos(lat2*Math.PI/180) *
    Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
