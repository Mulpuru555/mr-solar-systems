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

/* ================= SAFE DOM ================= */

const el = (id) => document.getElementById(id);

/* ================= SETTINGS ================= */

let officeLat = null;
let officeLon = null;
let allowedRadius = 0;

/* ================= WAIT FOR DOM ================= */

function waitForDOM() {
  return new Promise((resolve) => {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      resolve();
    } else {
      window.addEventListener("load", resolve);
    }
  });
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  await waitForDOM(); // 🔥 ensures DOM exists

  const branch = "tenali";

  const locSnap = await getDoc(doc(db, "settings", branch));

  if (locSnap.exists()) {
    officeLat = locSnap.data().point.latitude;
    officeLon = locSnap.data().point.longitude;
    allowedRadius = locSnap.data().radius;
  } else {
    console.error("❌ Location missing in Firestore");
  }

  initializeAttendance(user);
});

/* ================= INIT ================= */

async function initializeAttendance(user) {

  const working = await isTodayWorking();

  if (!working) {
    el("countdownBox")?.innerText = "Holiday";
    el("attendanceBtn")?.disabled = true;
    return;
  }

  startCountdown();

  await waitForLocation(); // 🔥 fix loading issue
  startLocationTracking();

  loadTodayStatus(user);
  loadMonthlySummary(user);
  calculateStreak(user);

  setInterval(() => checkAndHandleAbsence(user), 60000);
}

/* ================= WAIT LOCATION ================= */

function waitForLocation() {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (officeLat && officeLon) {
        clearInterval(check);
        resolve();
      }
    }, 200);
  });
}

/* ================= TODAY ================= */

async function loadTodayStatus(user) {

  const today = new Date().toISOString().split("T")[0];

  const snap = await getDoc(
    doc(db, "attendance", user.uid, today, "data")
  );

  el("todayStat") && (el("todayStat").innerText = snap.exists() ? 1 : 0);
}

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

  const promises = [];

  for (let d = 1; d <= today.getDate(); d++) {

    const dateObj = new Date(year, month, d);
    const dateStr = dateObj.toISOString().split("T")[0];

    if (dateObj.getDay() === 0) continue;
    if (holidays.has(dateStr)) continue;

    working++;

    promises.push(
      getDoc(doc(db, "attendance", user.uid, dateStr, "data"))
    );
  }

  const results = await Promise.all(promises);

  results.forEach(snap => {
    if (snap.exists()) present++;
  });

  const percent =
    working > 0 ? ((present / working) * 100).toFixed(1) : 0;

  el("percentStat") && (el("percentStat").innerText = percent + "%");
}

/* ================= STREAK ================= */

async function calculateStreak(user) {

  let streak = 0;
  let date = new Date();

  while (true) {

    const dateStr = date.toISOString().split("T")[0];

    const snap = await getDoc(
      doc(db, "attendance", user.uid, dateStr, "data")
    );

    if (!snap.exists()) break;

    streak++;
    date.setDate(date.getDate() - 1);
  }

  el("streakCount") && (el("streakCount").innerText = streak);
}

/* ================= WORKING ================= */

async function isTodayWorking() {

  const todayObj = new Date();
  const today = todayObj.toISOString().split("T")[0];

  if (todayObj.getDay() === 0) return false;

  const snap = await getDoc(
    doc(db, "settings", "holidays", "holidayList", today)
  );

  return !snap.exists();
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
      el("countdownBox")?.innerText = "Closed";
      el("attendanceBtn")?.disabled = true;
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    el("countdownBox") &&
      (el("countdownBox").innerText = `${h}h ${m}m ${s}s`);
  }

  update();
  setInterval(update, 1000);
}

/* ================= LOCATION ================= */

function startLocationTracking() {
el("distanceDisplay") && (el("distanceDisplay").innerText = "Getting GPS location...");
  navigator.geolocation.watchPosition(

    (pos) => {

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const dist = calculateDistance(lat, lon, officeLat, officeLon);
      const inside = dist <= allowedRadius;

      if (inside) {

        el("distanceDisplay") &&
          (el("distanceDisplay").innerHTML = "📍 Verified<br>" + Math.round(dist) + "m");

        el("attendanceStatus") &&
          (el("attendanceStatus").innerHTML = "🟢 Inside");

        el("attendanceBtn") && (el("attendanceBtn").disabled = false);

      } else {

        el("distanceDisplay") &&
          (el("distanceDisplay").innerHTML = "⚠️ Outside<br>" + Math.round(dist) + "m");

        el("attendanceStatus") &&
          (el("attendanceStatus").innerHTML = "🔴 Move closer");

        el("attendanceBtn") && (el("attendanceBtn").disabled = true);
      }

    },

    () => {
      el("distanceDisplay") &&
        (el("distanceDisplay").innerText = "Location denied");
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000
    }

  );
}

/* ================= MARK ================= */

window.markAttendance = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.uid, today, "data");

  const snap = await getDoc(ref);

  if (snap.exists()) {
    el("attendanceStatus") &&
      (el("attendanceStatus").innerText = "Already marked");
    return;
  }

  await setDoc(ref, {
    status: "present",
    time: serverTimestamp(),
    date: today
  });

  el("attendanceStatus") &&
    (el("attendanceStatus").innerHTML = "✅ Marked");

  el("attendanceBtn") && (el("attendanceBtn").disabled = true);

  setTimeout(() => {
    loadTodayStatus(user);
    loadMonthlySummary(user);
    calculateStreak(user);
  }, 300);
};

/* ================= AUTO BLOCK ================= */


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
