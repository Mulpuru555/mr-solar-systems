import { auth, db } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
collection,
getDocs,
query,
where,
doc,
updateDoc,
getDoc,
setDoc,
onSnapshot
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const attendanceBody =
document.getElementById("attendanceTable");

const blockedBody =
document.getElementById("blockedTable");

const summaryBody =
document.getElementById("summaryTable");

const dateInput =
document.getElementById("attendanceDate");

const verifyText =
document.getElementById("verifyStatus");


/* ================= LOGIN ================= */

onAuthStateChanged(auth,user=>{
if(!user) window.location.href="index.html";
});

window.logoutUser = async()=>{
await signOut(auth);
window.location.href="index.html";
};


/* ================= DATE ================= */

function getDate(){

const d = new Date();

return d.getFullYear()+"-"+
String(d.getMonth()+1).padStart(2,"0")+"-"+
String(d.getDate()).padStart(2,"0");

}

const today = getDate();
dateInput.value = today;


/* ================= VERIFY ================= */

onSnapshot(
doc(db,"verificationRequests","chirala"),
snap=>{
if(!snap.exists()) return;
verifyText.innerText =
"Status : "+snap.data().status;
}
);

window.sendVerify = async()=>{

await setDoc(
doc(db,"verificationRequests","chirala"),
{
request:true,
status:"pending"
}
);

alert("Verification sent");

};


/* ================= ATTENDANCE REPORT ================= */

async function loadAttendance(date){

attendanceBody.innerHTML="";

const users = await getDocs(
query(
collection(db,"users"),
where("role","==","employee")
)
);

for(const u of users.docs){

const user = u.data();

let status="Absent";
let time="-";

/* NEW STRUCTURE */

const snap = await getDoc(
doc(db,"attendance",u.id,date,"data")
);

if(snap.exists()){

status="Present";

const t = snap.data().time;

if(t?.seconds){

time = new Date(
t.seconds*1000
).toLocaleTimeString("en-IN");

}

}

const row=document.createElement("tr");

row.innerHTML=

`<td>${user.name}</td>
<td>${status}</td>
<td>${time}</td>`;

attendanceBody.appendChild(row);

}

}


/* ================= SUMMARY FINAL ================= */

async function loadSummary(){

summaryBody.innerHTML="";

const users = await getDocs(
query(
collection(db,"users"),
where("role","==","employee")
)
);

const now = new Date();

const year = now.getFullYear();
const month = now.getMonth()+1;


/* working days till today */

let workingDays = 0;

for(let d=1; d<=now.getDate(); d++){

const date =
year+"-"+
String(month).padStart(2,"0")+"-"+
String(d).padStart(2,"0");

const day = new Date(date);

if(day.getDay()===0) continue;

workingDays++;

}


/* per user */

for(const u of users.docs){

const user = u.data();

let present = 0;

for(let d=1; d<=now.getDate(); d++){

const date =
year+"-"+
String(month).padStart(2,"0")+"-"+
String(d).padStart(2,"0");

const day = new Date(date);

if(day.getDay()===0) continue;

const snap = await getDoc(
doc(db,"attendance",u.id,date,"data")
);

if(snap.exists()) present++;

}

const absent = Math.max(
0,
workingDays - present
);

const row=document.createElement("tr");

row.innerHTML=

`<td>${user.name}</td>
<td>${workingDays}</td>
<td>${present}</td>
<td>${absent}</td>`;

summaryBody.appendChild(row);

}

}


/* ================= BLOCKED ================= */

async function loadBlocked(){

blockedBody.innerHTML="";

const snap = await getDocs(
query(
collection(db,"users"),
where("accountStatus","==","blocked")
)
);

snap.forEach(d=>{

const user=d.data();

const row=document.createElement("tr");

row.innerHTML=

`<td>${user.name}</td>
<td>${user.branch}</td>
<td>${user.blockReason}</td>
<td>
<button data-id="${d.id}">
Unblock
</button>
</td>`;

blockedBody.appendChild(row);

});


document
.querySelectorAll("button[data-id]")
.forEach(btn=>{

btn.onclick=async()=>{

await updateDoc(
doc(db,"users",btn.dataset.id),
{
accountStatus:"active",
absenceCount:0
}
);

loadBlocked();

};

});

}


/* ================= LOAD ================= */

dateInput.addEventListener(
"change",
()=>loadAttendance(dateInput.value)
);

loadAttendance(today);
loadSummary();
loadBlocked();
