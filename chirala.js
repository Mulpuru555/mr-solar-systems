import { auth, db, storage } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
setDoc,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
ref,
uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


console.log("chirala.js loaded");


// wait until page loaded

window.addEventListener("DOMContentLoaded",()=>{


const msg = document.getElementById("msg");
const gpsStatus = document.getElementById("gpsStatus");
const empName = document.getElementById("empName");
const popup = document.getElementById("verifyPopup");

let userId = "";


const officeLat = 15.829398363781864;
const officeLng = 80.35605609999999;

const maxDistance = 200;



// LOGIN CHECK

onAuthStateChanged(auth,(user)=>{

if(!user){

window.location.href="index.html";
return;

}

userId=user.uid;

if(empName)
empName.innerText="Logged in : "+user.email;

checkGPS();

});



// LOGOUT

window.logoutUser = async function(){

await signOut(auth);

window.location.href="index.html";

};



// GPS

function getGPS(){

return new Promise((resolve,reject)=>{

if(!navigator.geolocation){

reject();
return;

}

navigator.geolocation.getCurrentPosition(

pos=>resolve(pos.coords),

err=>reject(err),

{
enableHighAccuracy:true,
timeout:10000,
maximumAge:0
}

);

});

}



// DISTANCE

function getDistance(lat1, lon1, lat2, lon2){

const R=6371000;

const dLat=(lat2-lat1)*Math.PI/180;
const dLon=(lon2-lon1)*Math.PI/180;

const a=
Math.sin(dLat/2)*Math.sin(dLat/2)+
Math.cos(lat1*Math.PI/180)*
Math.cos(lat2*Math.PI/180)*
Math.sin(dLon/2)*
Math.sin(dLon/2);

const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));

return R*c;

}



// CHECK GPS

async function checkGPS(){

if(!gpsStatus) return;

gpsStatus.innerText="Checking GPS...";

try{

const coords=await getGPS();

const dist=getDistance(
coords.latitude,
coords.longitude,
officeLat,
officeLng
);

gpsStatus.innerText=
"Distance : "+Math.round(dist)+" m";

}catch{

gpsStatus.innerText="Location not allowed";

}

}



// ATTENDANCE

window.markAttendance = async function(){

try{

msg.innerText="Checking time...";

const now=new Date();

if(now.getHours()>=10){

msg.innerText="Allowed before 10 AM";
return;

}


const coords=await getGPS();

const dist=getDistance(
coords.latitude,
coords.longitude,
officeLat,
officeLng
);

if(dist>maxDistance){

msg.innerText="Not in office";
return;

}


const selfie=
document.getElementById("selfie").files[0];

const office=
document.getElementById("office").files[0];

if(!selfie||!office){

msg.innerText="Upload photos";
return;

}


const date=
new Date().toISOString().slice(0,10);


await uploadBytes(
ref(storage,"chirala/"+date+"/selfie_"+userId),
selfie
);

await uploadBytes(
ref(storage,"chirala/"+date+"/office_"+userId),
office
);


await setDoc(
doc(db,"chiralaAttendance",
date+"_"+userId),
{
userId,
time:Date.now()
}
);


msg.innerText="Attendance Saved";

}catch(e){

console.log(e);
msg.innerText="Error";

}

};



// VERIFY LISTENER

const verifyDoc=
doc(db,"verificationRequests","chirala");


onSnapshot(verifyDoc,(snap)=>{

if(!snap.exists()) return;

const data=snap.data();

if(data && data.request===true){

if(popup){

popup.classList.add("show");

}

}

});



// VERIFY SUBMIT

window.submitVerify = async function(){

try{

const file=
document.getElementById("verifyPhoto").files[0];

if(!file) return;

const date=
new Date().toISOString().slice(0,10);

await uploadBytes(
ref(storage,"verify/"+date+"/"+userId),
file
);

await setDoc(
doc(db,"verificationRequests","chirala"),
{request:false}
);

if(popup)
popup.classList.remove("show");

}catch(e){

console.log(e);

}

};


});
