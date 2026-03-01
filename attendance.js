import { auth, db } from "./firebase-config.js";
import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, getDoc }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==============================
   OFFICE SETTINGS
============================== */

const officeLat = 16.236719;
const officeLon = 80.647476;
const allowedRadius = 200;

const btn = document.getElementById("attendanceBtn");
const statusBox = document.getElementById("attendanceStatus");
const distanceDisplay = document.getElementById("distanceDisplay");
const countdownBox = document.getElementById("countdownBox");

/* ==============================
   WORKING DAY CHECK
   (Sunday + Firebase Holiday)
============================== */

async function isWorkingDay(){

  const todayObj = new Date();
  const today = todayObj.toISOString().split("T")[0];

  // Sunday check
  if(todayObj.getDay() === 0){
    return false;
  }

  // Firebase holiday check
  const holidaySnap = await getDoc(
    doc(db,"settings","holidays","holidayList",today)
  );

  if(holidaySnap.exists()){
    return false;
  }

  return true;
}

/* ==============================
   GET CLOSING TIME
============================== */

async function getClosingTime(){
  const snap = await getDoc(doc(db,"settings","attendance"));
  if(snap.exists()){
    return {
      hour: snap.data().closeHour ?? 10,
      minute: snap.data().closeMinute ?? 0
    };
  }
  return { hour:10, minute:0 };
}

/* ==============================
   COUNTDOWN TIMER
============================== */

async function startCountdown(){

  if(!(await isWorkingDay())){
    countdownBox.innerText = "Today is Sunday / Holiday";
    btn.disabled = true;
    return;
  }

  const { hour, minute } = await getClosingTime();

  function update(){
    const now = new Date();
    const close = new Date();
    close.setHours(hour, minute, 0, 0);

    const diff = close - now;

    if(diff <= 0){
      countdownBox.innerText = "Attendance Closed";
      btn.disabled = true;
      return;
    }

    const h=Math.floor(diff/(1000*60*60));
    const m=Math.floor((diff%(1000*60*60))/(1000*60));
    const s=Math.floor((diff%(1000*60))/1000);

    countdownBox.innerText =
      `Closes at ${hour}:${minute.toString().padStart(2,"0")} | ${h}h ${m}m ${s}s`;
  }

  update();
  setInterval(update,1000);
}

/* ==============================
   LOCATION TRACKING
============================== */

function startLocationTracking(){

  if(!navigator.geolocation){
    distanceDisplay.innerText="Geolocation not supported";
    distanceDisplay.className="distance-box red";
    return;
  }

  navigator.geolocation.watchPosition(
    (pos)=>{
      const lat=pos.coords.latitude;
      const lon=pos.coords.longitude;
      const distance=calculateDistance(lat,lon,officeLat,officeLon);

      distanceDisplay.innerText=
        `Distance from office: ${Math.round(distance)} meters`;

      if(distance<=allowedRadius){
        distanceDisplay.className="distance-box green";
        btn.disabled=false;
      }else{
        distanceDisplay.className="distance-box red";
        btn.disabled=true;
        statusBox.innerText="You are outside office location";
      }
    },
    ()=>{
      distanceDisplay.innerText="Location permission denied";
      distanceDisplay.className="distance-box red";
      btn.disabled=true;
    },
    { enableHighAccuracy:true, maximumAge:0, timeout:10000 }
  );
}

/* ==============================
   MARK ATTENDANCE
============================== */

window.markAttendance = async function(){

  if(!(await isWorkingDay())){
    statusBox.innerText =
      "Today is Sunday / Holiday. Attendance not required.";
    btn.disabled=true;
    return;
  }

  const user=auth.currentUser;
  const today=new Date().toISOString().split("T")[0];

  const q=query(collection(db,"attendance"),
    where("employeeId","==",user.uid),
    where("date","==",today)
  );

  const snapshot=await getDocs(q);

  if(!snapshot.empty){
    statusBox.innerText="Attendance already marked today.";
    btn.disabled=true;
    return;
  }

  await addDoc(collection(db,"attendance"),{
    employeeId:user.uid,
    date:today,
    timestamp:serverTimestamp()
  });

  statusBox.innerText="Attendance Marked Successfully";
  btn.disabled=true;
};

/* ==============================
   DISTANCE CALCULATION
============================== */

function calculateDistance(lat1, lon1, lat2, lon2){
  const R=6371e3;
  const φ1=lat1*Math.PI/180;
  const φ2=lat2*Math.PI/180;
  const Δφ=(lat2-lat1)*Math.PI/180;
  const Δλ=(lon2-lon1)*Math.PI/180;

  const a=Math.sin(Δφ/2)*Math.sin(Δφ/2)+
          Math.cos(φ1)*Math.cos(φ2)*
          Math.sin(Δλ/2)*Math.sin(Δλ/2);

  const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

  return R*c;
}

/* ==============================
   INITIALIZE
============================== */

startCountdown();
startLocationTracking();
