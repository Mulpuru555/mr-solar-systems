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

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ================= OFFICE SETTINGS ================= */

let officeLat = 0;
let officeLon = 0;
let allowedRadius = 0;

/* ================= ELEMENTS ================= */

const btn = document.getElementById("attendanceBtn");
const statusBox = document.getElementById("attendanceStatus");
const distanceDisplay = document.getElementById("distanceDisplay");
const countdownBox = document.getElementById("countdownBox");

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

  await initializeAttendance(user);
});

/* ================= INITIALIZE ================= */

async function initializeAttendance(user) {

  const working = await isTodayWorking();

  if (!working) {
    countdownBox.innerText = "Today is Holiday";
    btn.disabled = true;
    return;
  }

  startCountdown();
  startLocationTracking();

  loadMonthlySummary(user);
  loadTodayStatus(user);

  setInterval(() => checkAndHandleAbsence(user), 60000);
}

/* ================= TODAY STATUS ================= */

async function loadTodayStatus(user) {

  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.uid, today, "data");
  const snap = await getDoc(ref);

  document.getElementById("todayStat").innerText =
    snap.exists() ? 1 : 0;
}

/* ================= CHECK WORKING ================= */

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
      countdownBox.innerText = "⛔ Closed";
      btn.disabled = true;
      return;
    }

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    countdownBox.innerText =
      `⏳ ${h}h ${m}m ${s}s`;
  }

  update();
  setInterval(update, 1000);
}

/* ================= LOCATION ================= */

function startLocationTracking() {

  if (!navigator.geolocation) {
    distanceDisplay.innerText = "No GPS";
    btn.disabled = true;
    return;
  }
if (!officeLat || !officeLon) {
  distanceDisplay.innerText = "Loading office location...";
  btn.disabled = true;
  return;
}
  navigator.geolocation.getCurrentPosition(

    (pos) => {

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const dist = calculateDistance(lat, lon, officeLat, officeLon);

      if (dist <= allowedRadius) {

        distanceDisplay.innerHTML =
          "📍 Verified<br>" + Math.round(dist) + "m";

        statusBox.innerHTML = "🟢 Inside";
        statusBox.style.color = "#00ff88";

        btn.disabled = false;

      } else {

        distanceDisplay.innerHTML =
          "⚠️ Outside<br>" + Math.round(dist) + "m";

        statusBox.innerHTML = "🔴 Move closer";
        statusBox.style.color = "red";

        btn.disabled = true;
      }

    },

    () => {
      distanceDisplay.innerText = "Location denied";
      btn.disabled = true;
    },

    { enableHighAccuracy: true }

  );
  setInterval(() => {
  navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
    enableHighAccuracy: true
  });
}, 5000);
}

/* ================= MARK ================= */

window.markAttendance = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  const ref = doc(db, "attendance", user.uid, today, "data");

  const snap = await getDoc(ref);

  if (snap.exists()) {
    statusBox.innerText = "Already Marked";
    return;
  }

  await setDoc(ref, {
    status: "present",
    time: serverTimestamp(),
    date: today,
    employeeId: user.uid
  });

  statusBox.innerHTML = "✅ Marked";
  statusBox.style.color = "#00ff88";

  btn.disabled = true;

  loadMonthlySummary(user);
  loadTodayStatus(user);
};
setTimeout(() => {
  loadMonthlySummary(user);
  loadTodayStatus(user);
}, 500);
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

  const monthRef = collection(db, "attendance", user.uid);

const datesSnap = await getDocs(monthRef);

const presentDates = new Set();

for (const docSnap of datesSnap.docs) {

  const dataRef = doc(db, "attendance", user.uid, docSnap.id, "data");
  const dataSnap = await getDoc(dataRef);

  if (dataSnap.exists()) {
    const data = dataSnap.data();
    if (data.date) {
      presentDates.add(data.date);
    }
  }
}
  const presentDates = new Set();

  attSnap.forEach(d => {
    const data = d.data();
    if (data.date) presentDates.add(data.date);
  });

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

  document.getElementById("percentStat").innerText =
    percent + "%";
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
