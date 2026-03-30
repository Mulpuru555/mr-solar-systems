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
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* ===========================
   OFFICE SETTINGS FROM DB
=========================== */

let officeLat = 0;
let officeLon = 0;
let allowedRadius = 0;
let userBranch = "";


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

  const userSnap = await getDoc(
    doc(db, "users", user.uid)
  );

  if (!userSnap.exists()) return;

userBranch = userSnap.data().branch;

userBranch = "tenali";

const locSnap = await getDoc(
  doc(db, "settings", userBranch)
);

if (locSnap.exists()) {

  officeLat = locSnap.data().point.latitude;
  officeLon = locSnap.data().point.longitude;
  allowedRadius = locSnap.data().radius;

}

  if (locSnap.exists()) {

    officeLat = locSnap.data().point.latitude;
    officeLon = locSnap.data().point.longitude;
    allowedRadius = locSnap.data().radius;

  }

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

  setTimeout(() => {
    startLocationTracking();
  }, 500);

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
   GET MONTH HOLIDAYS
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

  const snap = await getDoc(
    doc(db, "settings", "attendance")
  );

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
    countdownBox.innerText = "⛔ Attendance Closed";
    btn.disabled = true;
    return;
  }

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  countdownBox.innerText =
    `⏳ Closes at ${hour}:${minute.toString().padStart(2, "0")} | ${h}h ${m}m ${s}s`;
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
    btn.disabled = true;
    return;
  }

  navigator.geolocation.watchPosition(

    (pos) => {

      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      const distance =
        calculateDistance(
          lat,
          lon,
          officeLat,
          officeLon
        );

      if (distance <= allowedRadius) {

        distanceDisplay.innerHTML =
          "📍 <b>Location Verified</b><br>" +
          "Distance: " + Math.round(distance) + "m";

        btn.disabled = false;

        statusBox.innerHTML = "🟢 Inside Office Range";
        statusBox.style.color = "#00ff88";

      } else {

        distanceDisplay.innerHTML =
          "⚠️ <b>Outside Office Area</b><br>" +
          "Distance: " + Math.round(distance) + "m";

        btn.disabled = true;

        statusBox.innerHTML = "🔴 Move closer to mark attendance";
        statusBox.style.color = "red";

      }

    },

    () => {

      distanceDisplay.innerText = "❌ Location permission denied";
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

  const today =
    new Date().toISOString().split("T")[0];

  const ref = doc(
    db,
    "attendance",
    user.uid,
    today,
    "data"
  );

  const snap = await getDoc(ref);

  if (snap.exists()) {

    statusBox.innerText =
      "Already marked";

    btn.disabled = true;
    return;

  }

  await setDoc(ref, {

    status: "present",
    time: serverTimestamp()

  });

  statusBox.innerText =
    "Attendance Marked";

  btn.disabled = true;

  loadMonthlySummary(user);

};


/* ===========================
   MONTH SUMMARY
=========================== */
async function loadMonthlySummary(user) {

const today = new Date();

const year = today.getFullYear();
const month = today.getMonth() + 1;

let workingDays = 0;
let present = 0;


/* ================= HOLIDAYS ================= */

const holidaySnap =
await getDocs(
collection(
db,
"settings",
"holidays",
"holidayList"
)
);

const holidays = new Set();

holidaySnap.forEach(d=>{
holidays.add(d.id);
});


/* ================= GET ATTENDANCE ================= */

const attSnap =
await getDocs(
query(
collection(db,"attendance"),
where("employeeId","==",user.uid)
)
);

const presentDates = new Set();

attSnap.forEach(d=>{
const data = d.data();

if(data.date){
presentDates.add(data.date);
}
});


/* ================= LOOP DAYS ================= */

for(
let d=1;
d<=today.getDate();
d++
){

const dateObj =
new Date(year,month-1,d);

const dateStr =
dateObj.toISOString().split("T")[0];


/* skip sunday */

if(dateObj.getDay()===0)
continue;


/* skip holiday */

if(holidays.has(dateStr))
continue;


workingDays++;


/* check attendance */

if(presentDates.has(dateStr)){
present++;
}

}


/* ================= PERCENT ================= */

let percent = 0;

if(workingDays>0){

percent =
(present / workingDays) * 100;

percent =
percent.toFixed(1);

}


const box =
document.getElementById("percentStat");

if(box){
box.innerText = percent + "%";
}

}
/* ===========================
   AUTO BLOCK
=========================== */

async function checkAndHandleAbsence(user) {

  if (!(await isTodayWorking()))
    return;

  const { hour, minute } =
    await getClosingTime();

  const now = new Date();

  const close = new Date();

  close.setHours(hour, minute, 0, 0);

  if (now < close)
    return;

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const ref = doc(
    db,
    "attendance",
    user.uid,
    today,
    "data"
  );

  const snap =
    await getDoc(ref);

  if (snap.exists())
    return;

  const userRef =
    doc(
      db,
      "users",
      user.uid
    );

  const userSnap =
    await getDoc(userRef);

  if (!userSnap.exists())
    return;

  const data =
    userSnap.data();

  if (
    data.lastAbsentDate === today
  ) return;

  await updateDoc(userRef, {

    absenceCount:
      (data.absenceCount || 0) + 1,

    lastAbsentDate: today,

    accountStatus: "blocked"

  });

  alert(
    "Blocked due to absence"
  );

  location.reload();

}


/* ===========================
   DISTANCE
=========================== */

function calculateDistance(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R = 6371e3;

  const φ1 =
    lat1 *
    Math.PI / 180;

  const φ2 =
    lat2 *
    Math.PI / 180;

  const Δφ =
    (lat2 - lat1) *
    Math.PI / 180;

  const Δλ =
    (lon2 - lon1) *
    Math.PI / 180;

  const a =
    Math.sin(Δφ / 2) *
    Math.sin(Δφ / 2) +
    Math.cos(φ1) *
    Math.cos(φ2) *
    Math.sin(Δλ / 2) *
    Math.sin(Δλ / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
console.log("✅ Attendance system loaded");
}
