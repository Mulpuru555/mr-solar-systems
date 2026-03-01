import { auth, db } from "./firebase-config.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/* ===========================
   OFFICE SETTINGS
=========================== */

const officeLat = 16.236719;
const officeLon = 80.647476;
const allowedRadius = 200;

/* ===========================
   ELEMENTS
=========================== */

const btn = document.getElementById("attendanceBtn");
const statusBox = document.getElementById("attendanceStatus");
const distanceDisplay = document.getElementById("distanceDisplay");
const countdownBox = document.getElementById("countdownBox");

/* ===========================
   AUTH SAFE INIT
=========================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  await initializeAttendance(user);
});

/* ===========================
   INITIALIZE
=========================== */

async function initializeAttendance(user) {

  const working = await isTodayWorking();

  if (!working) {
    countdownBox.innerText = "Today is Sunday / Holiday";
    btn.disabled = true;
    distanceDisplay.innerText = "Attendance Not Required";
    return;
  }

  startCountdown();
  startLocationTracking();
  loadMonthlySummary(user);

  setInterval(() => checkAndHandleAbsence(user), 60000);
}

/* ===========================
   CHECK IF TODAY WORKING
=========================== */

async function isTodayWorking() {

  const todayObj = new Date();
  const today = todayObj.toISOString().split("T")[0];

  if (todayObj.getDay() === 0) return false;

  const holidaySnap = await getDoc(
    doc(db, "settings", "holidays", "holidayList", today)
  );

  if (holidaySnap.exists()) return false;

  return true;
}

/* ===========================
   GET MONTH HOLIDAYS (OPTIMIZED)
=========================== */

async function getMonthHolidays(year, monthIndex) {

  const holidaySnap = await getDocs(
    collection(db, "settings", "holidays", "holidayList")
  );

  const holidaySet = new Set();

  holidaySnap.forEach(docSnap => {
    const date = docSnap.id;
    const d = new Date(date);
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      holidaySet.add(date);
    }
  });

  return holidaySet;
}

/* ===========================
   GET CLOSING TIME
=========================== */

async function getClosingTime() {

  const snap = await getDoc(doc(db, "settings", "attendance"));

  if (snap.exists()) {
    return {
      hour: snap.data().closeHour ?? 10,
      minute: snap.data().closeMinute ?? 0
    };
  }

  return { hour: 10, minute: 0 };
}

/* ===========================
   COUNTDOWN
=========================== */

async function startCountdown() {

  const { hour, minute } = await getClosingTime();

  function update() {

    const now = new Date();
    const close = new Date();
    close.setHours(hour, minute, 0, 0);

    const diff = close - now;

    if (diff <= 0) {
      countdownBox.innerText = "Attendance Closed";
      btn.disabled = true;
      return;
    }

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    countdownBox.innerText =
      `Closes at ${hour}:${minute.toString().padStart(2, "0")} | ${h}h ${m}m ${s}s`;
  }

  update();
  setInterval(update, 1000);
}

/* ===========================
   LOCATION TRACKING
=========================== */

function startLocationTracking() {

  if (!navigator.geolocation) {
    distanceDisplay.innerText = "Geolocation not supported";
    distanceDisplay.className = "distance-box red";
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const distance = calculateDistance(lat, lon, officeLat, officeLon);

      if (distance <= allowedRadius) {
        distanceDisplay.innerText = "🟢 Inside Office Zone";
        distanceDisplay.className = "distance-box green";
        btn.disabled = false;
        statusBox.innerText = "";
      } else {
        distanceDisplay.innerText = "🔴 Outside Office Zone";
        distanceDisplay.className = "distance-box red";
        btn.disabled = true;
        statusBox.innerText = "You are outside office location";
      }
    },
    () => {
      distanceDisplay.innerText = "Location permission denied";
      distanceDisplay.className = "distance-box red";
      btn.disabled = true;
    },
    { enableHighAccuracy: true }
  );
}

/* ===========================
   MARK ATTENDANCE
=========================== */

window.markAttendance = async function () {

  const user = auth.currentUser;
  if (!user) return;

  const today = new Date().toISOString().split("T")[0];

  const attendanceSnap = await getDocs(
    query(
      collection(db, "attendance"),
      where("employeeId", "==", user.uid),
      where("date", "==", today)
    )
  );

  if (!attendanceSnap.empty) {
    statusBox.innerText = "Attendance already marked today.";
    btn.disabled = true;
    return;
  }

  await addDoc(collection(db, "attendance"), {
    employeeId: user.uid,
    date: today,
    timestamp: serverTimestamp()
  });

  statusBox.innerText = "✔ Attendance Marked Successfully";
  btn.disabled = true;

  loadMonthlySummary(user);
};

/* ===========================
   ACCURATE MONTHLY SUMMARY
=========================== */

async function loadMonthlySummary(user) {

  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  const monthStr = today.toISOString().slice(0, 7);

  const attendanceSnap = await getDocs(
    query(
      collection(db, "attendance"),
      where("employeeId", "==", user.uid)
    )
  );

  let present = 0;

  attendanceSnap.forEach(docSnap => {
    if (docSnap.data().date.startsWith(monthStr)) {
      present++;
    }
  });

  const holidaySet = await getMonthHolidays(year, monthIndex);

  let workingDays = 0;

  for (let d = 1; d <= today.getDate(); d++) {

    const dateObj = new Date(year, monthIndex, d);
    const dateStr = dateObj.toISOString().split("T")[0];

    if (dateObj.getDay() !== 0 && !holidaySet.has(dateStr)) {
      workingDays++;
    }
  }

  const percent = workingDays
    ? ((present / workingDays) * 100).toFixed(1)
    : 0;

  const oldSummary = document.getElementById("monthlySummary");
  if (oldSummary) oldSummary.remove();

  const summaryDiv = document.createElement("div");
  summaryDiv.id = "monthlySummary";
  summaryDiv.style.marginTop = "15px";
  summaryDiv.style.fontWeight = "600";

  summaryDiv.innerText =
    `📊 This Month: ${present}/${workingDays} Working Days (${percent}%)`;

  statusBox.appendChild(summaryDiv);
}

/* ===========================
   AUTO BLOCK (SAFE)
=========================== */

async function checkAndHandleAbsence(user) {

  if (!(await isTodayWorking())) return;

  const { hour, minute } = await getClosingTime();

  const now = new Date();
  const close = new Date();
  close.setHours(hour, minute, 0, 0);

  if (now < close) return;

  const today = new Date().toISOString().split("T")[0];

  const attendanceSnap = await getDocs(
    query(
      collection(db, "attendance"),
      where("employeeId", "==", user.uid),
      where("date", "==", today)
    )
  );

  if (!attendanceSnap.empty) return;

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data();

  if (userData.lastAbsentDate === today) return;

  await updateDoc(userRef, {
    absenceCount: (userData.absenceCount || 0) + 1,
    lastAbsentDate: today,
    accountStatus: "blocked"
  });

  alert("Your account has been blocked due to absence.");
  location.reload();
}

/* ===========================
   DISTANCE CALCULATION
=========================== */

function calculateDistance(lat1, lon1, lat2, lon2) {

  const R = 6371e3;

  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;

  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
    Math.cos(φ2) *
    Math.sin(Δλ / 2) *
    Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
