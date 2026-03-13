import { auth, db, storage } from "./firebase-config.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
ref,
uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import {
onSnapshot,
doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const msg = document.getElementById("msg");
const gpsStatus = document.getElementById("gpsStatus");

const popup =
document.getElementById("verifyPopup");

let userId = "";


/* =========================
   Chirala Office Location
========================= */

const officeLat = 15.829398363781864;
const officeLng = 80.35605609999999;

const maxDistance = 200;


/* =========================
   Login Check
========================= */

onAuthStateChanged(auth,(user)=>{

if(user){

userId = user.uid;

document.getElementById("empName").innerText =
"User : " + user.email;

}else{

msg.innerText = "Not logged in";

}

});


/* =========================
   Get GPS
========================= */

function getGPS(){

return new Promise((resolve,reject)=>{

navigator.geolocation.getCurrentPosition(

pos=>resolve(pos.coords),

err=>reject(err)

);

});

}


/* =========================
   Distance Function
========================= */

function getDistance(lat1, lon1, lat2, lon2) {

const R = 6371000;

const dLat = (lat2-lat1) * Math.PI/180;
const dLon = (lon2-lon1) * Math.PI/180;

const a =
Math.sin(dLat/2) * Math.sin(dLat/2) +
Math.cos(lat1*Math.PI/180) *
Math.cos(lat2*Math.PI/180) *
Math.sin(dLon/2) *
Math.sin(dLon/2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

return R * c;

}


/* =========================
   Mark Attendance
========================= */

window.markAttendance = async function(){

try{

msg.innerText = "Checking time...";

/* ===== TIME CHECK ===== */

const now = new Date();

const hour = now.getHours();

if(hour >= 10){

msg.innerText =
"Attendance allowed only before 10 AM";

return;

}


/* ===== GPS CHECK ===== */

msg.innerText = "Checking GPS...";

const coords = await getGPS();

const distance = getDistance(
coords.latitude,
coords.longitude,
officeLat,
officeLng
);

gpsStatus.innerText =
"Distance: " + Math.round(distance) + " m";


if(distance > maxDistance){

msg.innerText =
"You are not at Chirala office";

return;

}


/* ===== FILE CHECK ===== */

const selfieFile =
document.getElementById("selfie").files[0];

const officeFile =
document.getElementById("office").files[0];


if(!selfieFile || !officeFile){

msg.innerText =
"Upload selfie and office photo";

return;

}


/* ===== DATE ===== */

const date =
new Date().toISOString().slice(0,10);


msg.innerText = "Uploading photos...";


/* ===== STORAGE ===== */

const selfieRef =
ref(
storage,
"chirala/"+date+"/selfie_"+userId
);

const officeRef =
ref(
storage,
"chirala/"+date+"/office_"+userId
);


await uploadBytes(selfieRef,selfieFile);
await uploadBytes(officeRef,officeFile);


msg.innerText = "Saving attendance...";


/* ===== FIRESTORE ===== */

await setDoc(

doc(
db,
"chiralaAttendance",
date + "_" + userId
),

{

userId,

gpsLat: coords.latitude,
gpsLng: coords.longitude,

officeLat,
officeLng,

distance,

time: Date.now()

}

);


msg.innerText =
"Attendance Saved Successfully ✅";


}catch(e){

console.log(e);

msg.innerText =
"Error: " + e.message;

}

};



/* =========================
   VERIFY POPUP SUPPORT
========================= */


window.showVerifyPopup = function(){

if(!popup) return;

popup.classList.add("show");

playAlert();

};


window.submitVerify = function(){

popup.classList.remove("show");

msg.innerText =
"Verification Submitted";

};

/* =========================
   SOUND ALERT
========================= */

function playAlert(){

try{

const audio = new Audio(
"https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
);

audio.play();

}catch(e){}

}
/* =========================
   VERIFY LISTENER
========================= */

const verifyDoc =
doc(db,"verificationRequests","chirala");


onSnapshot(verifyDoc,(snap)=>{

if(!snap.exists()) return;

const data = snap.data();

if(data.request === true){

showVerifyPopup();

}

});
