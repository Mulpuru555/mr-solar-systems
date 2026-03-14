import { auth } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


// =========================
// ELEMENTS
// =========================

const msg = document.getElementById("msg");
const gpsStatus = document.getElementById("gpsStatus");
const empName = document.getElementById("empName");

let userId = "";


// =========================
// OFFICE LOCATION
// =========================

const officeLat = 15.829398363781864;
const officeLng = 80.35605609999999;

const maxDistance = 200;



// =========================
// LOGIN CHECK
// =========================

onAuthStateChanged(auth,(user)=>{

if(!user){

window.location.href = "index.html";
return;

}

userId = user.uid;

empName.innerText =
"Logged in : " + user.email;

checkGPSOnLoad();

});



// =========================
// LOGOUT
// =========================

window.logoutUser = async function(){

await signOut(auth);

window.location.href = "index.html";

};



// =========================
// GET GPS
// =========================

function getGPS(){

return new Promise((resolve,reject)=>{

navigator.geolocation.getCurrentPosition(

pos=>resolve(pos.coords),

err=>reject(err)

);

});

}



// =========================
// DISTANCE
// =========================

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



// =========================
// GPS ON LOAD
// =========================

async function checkGPSOnLoad(){

try{

gpsStatus.innerText = "Checking GPS...";

const coords = await getGPS();

const distance = getDistance(
coords.latitude,
coords.longitude,
officeLat,
officeLng
);

gpsStatus.innerText =
"Distance : " + Math.round(distance) + " m";

}catch(e){

gpsStatus.innerText =
"GPS not allowed";

}

}



// =========================
// MARK ATTENDANCE (TEST)
// =========================

window.markAttendance = async function(){

msg.innerText = "Checking...";

try{

const coords = await getGPS();

const distance = getDistance(
coords.latitude,
coords.longitude,
officeLat,
officeLng
);

if(distance > maxDistance){

msg.innerText =
"Not in office location";

return;

}

msg.innerText =
"Attendance OK (test mode)";

}catch(e){

msg.innerText =
"GPS error";

}

};
