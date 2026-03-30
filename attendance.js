import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= VARIABLES ================= */

let officeLat = null;
let officeLon = null;
let allowedRadius = 200;
let systemReady = false;

/* ================= ELEMENT ================= */

function el(id) {
  return document.getElementById(id);
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  const btn = el("attendanceBtn");
  if (btn) btn.disabled = true;

  try {

    const snap = await getDoc(doc(db, "settings", "tenali"));

    if (snap.exists()) {

      const data = snap.data();

      // 🔥 SAFE ACCESS
      if (data.point && data.point.latitude && data.point.longitude) {
        officeLat = data.point.latitude;
        officeLon = data.point.longitude;
      }

      if (data.radius) {
        allowedRadius = data.radius;
      }
    }

  } catch (e) {
    console.error("Settings error:", e);
  }

  startSystem(user);

setTimeout(() => {
  systemReady = true;
}, 500);

/* ================= INIT ================= */

function startSystem(user) {

  startClock();
  loadToday(user);
  startLocation();
}

/* ================= TODAY ================= */

async function loadToday(user) {

  try {

    const today = new Date().toISOString().split("T")[0];

    const ref = doc(db, "attendance", user.uid, today, "data");
    const snap = await getDoc(ref);

    const box = el("todayStat");
    if (box) box.innerText = snap.exists() ? "1" : "NO";

  } catch (e) {
    console.error("Today error:", e);
  }
}

/* ================= LOCATION ================= */

function startLocation() {

  const display = el("distanceDisplay");

  if (display) display.innerText = "Getting GPS...";

  if (!navigator.geolocation) {
    if (display) display.innerText = "GPS not supported";
    return;
  }

  navigator.geolocation.watchPosition(

    function (pos) {

      if (!officeLat || !officeLon) {
        if (display) display.innerText = "Office config loading...";
        return;
      }

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const dist = calculateDistance(lat, lon, officeLat, officeLon);

      const btn = el("attendanceBtn");

      if (dist <= allowedRadius) {

        if (display) {
          display.innerHTML = "📍 Inside<br>" + Math.round(dist) + "m";
        }

        if (btn && systemReady) btn.disabled = false;

      } else {

        if (display) {
          display.innerHTML = "❌ Outside<br>" + Math.round(dist) + "m";
        }

        if (btn) btn.disabled = true;
      }

    },

    function () {
      if (display) display.innerText = "Location denied";
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000
    }

  );
}

/* ================= MARK ================= */

async function markAttendance() {

  if (!systemReady) {
    alert("System loading...");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Login required");
    return;
  }

  try {

    const today = new Date().toISOString().split("T")[0];

    const ref = doc(db, "attendance", user.uid, today, "data");
    const snap = await getDoc(ref);

    if (snap.exists()) {
      alert("Already marked");
      return;
    }

    await setDoc(ref, {
      status: "present",
      date: today,
      time: serverTimestamp()
    });

    alert("Attendance Marked ✅");

    loadToday(user);

  } catch (e) {
    console.error("Mark error:", e);
    alert("Error marking attendance");
  }
}

/* GLOBAL */
window.markAttendance = markAttendance;

/* ================= CLOCK ================= */

function startClock() {

  function update() {
    const now = new Date();
    const time = now.toLocaleTimeString();

    const clock = el("liveClock");
    if (clock) clock.innerText = time;
  }

  update();
  setInterval(update, 1000);
}

/* ================= DISTANCE ================= */

function calculateDistance(lat1, lon1, lat2, lon2) {

  const R = 6371e3;

  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;

  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
