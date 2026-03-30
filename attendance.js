import { auth, db } from "./firebase-config.js";

import {
  collection,
  serverTimestamp,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= SETTINGS ================= */

let officeLat = null;
let officeLon = null;
let allowedRadius = 0;

/* ================= SAFE ELEMENT GET ================= */

function el(id) {
  return document.getElementById(id);
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists()) return;

  const branch = userSnap.data().branch || "tenali";

  const locSnap = await getDoc(doc(db, "settings", branch));

  if (locSnap.exists()) {
    officeLat = locSnap.data().point.latitude;
    officeLon = locSnap.data().point.longitude;
    allowedRadius = locSnap.data().radius;
  }

  initializeAttendance(user);
});

/* ================= INIT ================= */

async function initializeAttendance(user) {

  const working = await isTodayWorking();

  if (!working) {
    if (el("countdownBox")) el("countdownBox").innerText = "Holiday";
    if (el("attendanceBtn")) el("attendanceBtn").disabled = true;
    return;
  }

  startCountdown();
  startLocationTracking();

  loadMonthlySummary(user);
  loadTodayStatus(user);

  setInterval(() => checkAndHandleAbsence(user), 60000);
}

/* ================= TODAY ================= */

async function loadTodayStatus(user) {

  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.uid, today, "data");
  const snap = await getDoc(ref);

  if (el("todayStat")) {
    el("todayStat").innerText = snap.exists() ? 1 : 0;
  }
}

/* ================= WORKING DAY ================= */

async function isTodayWorking() {

  const todayObj = new Date();
  const today = todayObj.toISOString().split("T")[0];

  if (todayObj.getDay() === 0) return false;

  const holidaySnap = await getDoc(
    doc(db, "settings", "holidays", "holidayList", today)
  );

  return !holidaySnap.exists();
}

/* ================= COUNTDOWN ================= */

async function startCountdown() {

  const snap = await getDoc(doc(db, "settings", "attendance"));

  const hour = snap.exists() ? snap.data().closeHour : 10;
  const minute = snap.exists() ? snap.data().closeMinute : 0;

  function update() {

    const now = new Date();
    const close = new Date();
    close.setHours(hour, minute, 0, 0);

    const diff = close - now;

    if (diff <= 0) {
      if (el("countdownBox")) el("countdownBox").innerText = "Closed";
      if (el("attendanceBtn")) el("attendanceBtn").disabled = true;
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    if (el("countdownBox")) {
      el("countdownBox").innerText = `${h}h ${m}m ${s}s`;
    }
  }

  update();
  setInterval(update, 1000);
}

/* ================= LOCATION ================= */

function startLocationTracking() {

  if (!navigator.geolocation) {
    el("distanceDisplay").innerText = "GPS not supported";
    return;
  }

  let lastStatus = null; // prevent flicker

  function updateLocation(pos) {

    if (!officeLat || !officeLon) {
      el("distanceDisplay").innerText = "Loading office...";
      el("attendanceBtn").disabled = true;
      return;
    }

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    const dist = calculateDistance(lat, lon, officeLat, officeLon);

    const inside = dist <= allowedRadius;

    // 🔥 prevent UI flicker (update only if changed)
    if (lastStatus === inside) return;
    lastStatus = inside;

    if (inside) {

      el("distanceDisplay").innerHTML =
        "📍 Verified<br>" + Math.round(dist) + "m";

      el("attendanceStatus").innerHTML = "🟢 Inside Office Range";
      el("attendanceStatus").style.color = "#00ff88";

      el("attendanceBtn").disabled = false;

    } else {

      el("distanceDisplay").innerHTML =
        "⚠️ Outside Area<br>" + Math.round(dist) + "m";

      el("attendanceStatus").innerHTML = "🔴 Move closer";
      el("attendanceStatus").style.color = "red";

      el("attendanceBtn").disabled = true;
    }
  }

  function error(err) {
    el("distanceDisplay").innerText = "Location denied / slow";
    el("attendanceBtn").disabled = true;
  }

  // 🔥 BEST METHOD → continuous tracking (no delay)
  navigator.geolocation.watchPosition(updateLocation, error, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000
  });
}

/* ================= MARK ================= */

window.markAttendance = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.uid, today, "data");

  const snap = await getDoc(ref);

  if (snap.exists()) {
    if (el("attendanceStatus")) el("attendanceStatus").innerText = "Already marked";
    return;
  }

  await setDoc(ref, {
    status: "present",
    time: serverTimestamp(),
    date: today
  });

  if (el("attendanceStatus")) {
    el("attendanceStatus").innerHTML = "✅ Marked";
    el("attendanceStatus").style.color = "#00ff88";
  }

  if (el("attendanceBtn")) el("attendanceBtn").disabled = true;

  setTimeout(() => {
    loadMonthlySummary(user);
    loadTodayStatus(user);
  }, 500);
};

/* ================= MONTHLY ================= */

async function loadMonthlySummary(user) {

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let working = 0;
  let present = 0;

  const holidaySnap = await getDocs(
    collection(db, "settings", "holidays", "holidayList")
  );

  const holidays = new Set();
  holidaySnap.forEach(d => holidays.add(d.id));

  const datesSnap = await getDocs(
    collection(db, "attendance", user.uid)
  );

  const presentDates = new Set();

  for (const docSnap of datesSnap.docs) {

    const dataRef = doc(db, "attendance", user.uid, docSnap.id, "data");
    const dataSnap = await getDoc(dataRef);

    if (dataSnap.exists()) {
      const data = dataSnap.data();
      if (data.date) presentDates.add(data.date);
    }
  }

  for (let d = 1; d <= today.getDate(); d++) {

    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().split("T")[0];

    if (dateObj.getDay() === 0) continue;
    if (holidays.has(dateStr)) continue;

    working++;

    if (presentDates.has(dateStr)) present++;
  }

  const percent =
    working > 0 ? ((present / working) * 100).toFixed(1) : 0;

  if (el("percentStat")) {
    el("percentStat").innerText = percent + "%";
  }
}


/* ================= DISTANCE ================= */

function calculateDistance(lat1, lon1, lat2, lon2) {

  const R = 6371e3;

  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;

  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
