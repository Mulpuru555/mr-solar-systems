import { auth, db, storage } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
ref,
uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";



// ELEMENTS

const msg = document.getElementById("msg");
const gpsStatus = document.getElementById("gpsStatus");
const empName = document.getElementById("empName");

let userId = "";



// OFFICE LOCATION

const officeLat = 15.829398363781864;
const officeLng = 80.35605609999999;

const maxDistance = 300;



// LOGIN CHECK

onAuthStateChanged(auth,(user)=>{

if(!user){

window.location.href = "index.html";
return;

}

userId = user.uid;

empName.innerText =
"Logged in : " + user.email;

checkGPS();

});



// LOGOUT

window.logoutUser = async function(){

await signOut(auth);

window.location.href = "index.html";

};



// GPS

function getGPS(){

return new Promise((resolve,reject)=>{

navigator.geolocation.getCurrentPosition(

pos => resolve(pos.coords),

err => reject(err)

);

});

}



// DISTANCE

function getDistance(lat1, lon1, lat2, lon2){

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



// CHECK GPS

async function checkGPS(){

gpsStatus.innerText = "Checking GPS...";

try{

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



// MARK ATTENDANCE

window.markAttendance = async function(){

try{

msg.innerText = "Checking time...";


// TIME CHECK

const now = new Date();
const hour = now.getHours();

if(hour >= 10){

msg.innerText =
"Allowed only before 10 AM";

return;

}


// GPS

msg.innerText = "Checking GPS...";

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


// FILES

const selfieFile =
document.getElementById("selfie").files[0];

const officeFile =
document.getElementById("office").files[0];

if(!selfieFile || !officeFile){

msg.innerText =
"Upload photos";

return;

}


const date =
new Date().toISOString().slice(0,10);


msg.innerText = "Uploading...";


// STORAGE

const selfieRef =
ref(storage,
"chirala/"+date+"/selfie_"+userId);

const officeRef =
ref(storage,
"chirala/"+date+"/office_"+userId);


await uploadBytes(selfieRef,selfieFile);
await uploadBytes(officeRef,officeFile);


// FIRESTORE

await setDoc(
doc(db,"chiralaAttendance",
date+"_"+userId),
{

userId,

gpsLat: coords.latitude,
gpsLng: coords.longitude,

distance,

time: Date.now()

}
);


msg.innerText =
"Attendance Saved ✅";

}catch(e){

msg.innerText =
"Error";

console.log(e);

}

};
