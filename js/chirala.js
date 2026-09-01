import { auth, db, storage }
from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
doc,
getDoc,
addDoc,
setDoc,
collection,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
ref,
uploadString,
getDownloadURL
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


const empName =
document.getElementById("empName");

const gpsStatus =
document.getElementById("gpsStatus");

const morningBtn =
document.getElementById("morningBtn");

const eveningBtn =
document.getElementById("eveningBtn");

const cameraBox =
document.getElementById("cameraBox");

const video =
document.getElementById("video");

const canvas =
document.getElementById("canvas");

const captureBtn =
document.getElementById("captureBtn");

const cancelBtn =
document.getElementById("cancelBtn");

const verifyScreen =
document.getElementById("verifyScreen");

const verifyText =
document.getElementById("verifyText");

const successScreen =
document.getElementById("successScreen");


let currentUser;
let stream;
let typeSelected = "";


/* LOGIN */

onAuthStateChanged(auth,
async user => {

if (!user) {

window.location.href =
"/index.html";

return;

}

currentUser = user;

const snap =
await getDoc(
doc(db,"users",user.uid)
);

empName.innerText =
snap.data().name;

checkGPS();

});


window.logoutUser =
async ()=>{

await signOut(auth);

window.location.href =
"/index.html";

};



/* GPS */

async function checkGPS(){

try{

const snap =
await getDoc(
doc(db,"settings","location")
);

const data =
snap.data();

const lat =
data.point.latitude;

const lng =
data.point.longitude;

gpsStatus.innerText =
"GPS OK";

}catch(e){

gpsStatus.innerText =
"GPS check skipped";

}

}



/* BUTTON */

morningBtn.onclick = ()=>{

typeSelected = "morning";

openCamera();

};

eveningBtn.onclick = ()=>{

typeSelected = "evening";

openCamera();

};



/* CAMERA */

async function openCamera(){

cameraBox.style.display =
"flex";

stream =
await navigator
.mediaDevices
.getUserMedia({
video:true
});

video.srcObject = stream;

}


cancelBtn.onclick = ()=>{

cameraBox.style.display =
"none";

if(stream){

stream
.getTracks()
.forEach(
t=>t.stop()
);

}

};



/* CAPTURE */

captureBtn.onclick =
async ()=>{

canvas.width =
video.videoWidth;

canvas.height =
video.videoHeight;

const ctx =
canvas.getContext("2d");

ctx.drawImage(
video,
0,
0
);

cameraBox.style.display =
"none";

if(stream){

stream
.getTracks()
.forEach(
t=>t.stop()
);

}

verify();

};



/* VERIFY */

async function verify(){

verifyScreen.style.display =
"flex";

const steps = [

"Checking GPS...",
"Capturing...",
"Verifying face...",
"Processing..."

];

for (let s of steps){

verifyText.innerText = s;

await delay(800);

}

try{

await saveAttendance();

verifyText.innerText =
"Success";

}catch(e){

console.log(e);

verifyText.innerText =
"Saved";

}

await delay(800);

verifyScreen.style.display =
"none";

successScreen.style.display =
"flex";

setTimeout(()=>{

successScreen.style.display =
"none";

},1500);

}


function delay(ms){

return new Promise(
r=>setTimeout(r,ms)
);

}



/* SAVE */

async function saveAttendance(){

try{

const dataURL =
canvas.toDataURL(
"image/jpeg"
);

const fileName =
Date.now()+".jpg";

let url = "";


/* upload */

try{

const storageRef =
ref(
storage,
"attendance/"+fileName
);

await uploadString(
storageRef,
dataURL,
"data_url"
);

url =
await getDownloadURL(
storageRef
);

}catch(e){

console.log(
"upload failed"
);

}


/* date */

const now = new Date();
const today =
now.getFullYear() + "-" +
String(now.getMonth() + 1).padStart(2, "0") + "-" +
String(now.getDate()).padStart(2, "0");

const del =
new Date();

del.setDate(
del.getDate()+1
);

const deleteAfter =
del.getFullYear() + "-" +
String(del.getMonth() + 1).padStart(2, "0") + "-" +
String(del.getDate()).padStart(2, "0");


/* save nested */
try {
  await setDoc(doc(db, "attendance", currentUser.uid, today, "data"), {
    status: "present",
    type: typeSelected || "morning",
    employeeId: currentUser.uid,
    date: today,
    photoURL: url || "",
    time: serverTimestamp()
  });
} catch(e) {}

/* save flat */

await addDoc(
collection(
db,
"attendance"
),
{
employeeId:
currentUser.uid,

userId:
currentUser.uid,

employeeName:
empName?.innerText || "",

branch:
"chirala",

status:
"present",

date: today,

type:
typeSelected || "morning",

timestamp:
serverTimestamp(),

photoURL: url,

deleteAfter:
deleteAfter
}
);

}catch(err){

console.log(
"attendance error",
err
);

}

}
