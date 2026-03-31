import { auth, db } from "./firebase-config.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
collection,
getDocs,
query,
where,
doc,
updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const attendanceBody = document.getElementById("attendanceTable");
const blockedBody = document.getElementById("blockedTable");
const summaryBody = document.getElementById("summaryTable");
const dateInput = document.getElementById("attendanceDate");
const popup = document.getElementById("photoPopup");
const popupImg = document.getElementById("popupImg");

/* LOGIN */
onAuthStateChanged(auth,user=>{
if(!user){
window.location.href="index.html";
}
});

window.logoutUser = async ()=>{
await signOut(auth);
window.location.href="index.html";
};

/* DATE */
function getToday(){
const d = new Date();
return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

const today = getToday();
dateInput.value = today;

/* CLEAN OLD PHOTOS */
async function cleanOldPhotos(){
const snap = await getDocs(collection(db,"attendance"));
const today = getToday();

snap.forEach(async d=>{
const data = d.data();
if(!data.deleteAfter) return;

if(data.deleteAfter < today){
await updateDoc(doc(db,"attendance",d.id),{
photoURL:""
});
}
});
}

/* ================= ATTENDANCE ================= */
async function loadAttendance(date){

attendanceBody.innerHTML="";
await cleanOldPhotos();

const usersSnap = await getDocs(
query(collection(db,"users"),where("role","==","employee"))
);

const attSnap = await getDocs(collection(db,"attendance"));

const map = {};

attSnap.forEach(docSnap=>{

const data = docSnap.data();

/* SUPPORT OLD + NEW */
const empId = data.employeeId || data.userId;
if(!empId) return;

if(data.date !== date) return;

if(!map[empId]) map[empId] = [];
map[empId].push(data);

});

usersSnap.forEach(u=>{

const user = u.data();
let rows = map[u.id] || [];

/* ABSENT */
if(rows.length === 0){
const tr = document.createElement("tr");
tr.innerHTML =
`<td>${user.name}</td>
<td class="absent">Absent</td>
<td>-</td>
<td>-</td>
<td>-</td>`;
attendanceBody.appendChild(tr);
return;
}

/* PRESENT */
rows.forEach(r=>{

let time = "-";

if(r.timestamp?.seconds){
time = new Date(r.timestamp.seconds*1000).toLocaleTimeString("en-IN");
}
else if(r.time){
time = r.time;
}
else if(r.checkInTime){
time = r.checkInTime;
}

const type = r.type || r.session || "Normal";
const status = r.status || "Present";

const imgHTML = r.photoURL
? `<img src="${r.photoURL}" width="60" class="photo">`
: "-";

const tr = document.createElement("tr");

tr.innerHTML =
`<td>${user.name}</td>
<td class="present">${status}</td>
<td>${type}</td>
<td>${time}</td>
<td>${imgHTML}</td>`;

attendanceBody.appendChild(tr);

});

});

/* popup */
document.querySelectorAll(".photo").forEach(img=>{
img.onclick = ()=>{
popup.style.display="flex";
popupImg.src = img.src;
};
});

}

popup.onclick = ()=> popup.style.display="none";

/* ================= SUMMARY ================= */
async function loadSummary(){

summaryBody.innerHTML="";

const usersSnap = await getDocs(
query(collection(db,"users"),where("role","==","employee"))
);

const attSnap = await getDocs(collection(db,"attendance"));

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth()+1;

let workingDays = now.getDate();

const presentMap = {};

attSnap.forEach(docSnap=>{

const data = docSnap.data();

const empId = data.employeeId || data.userId;
if(!empId) return;

if(!data.date?.startsWith(year+"-"+String(month).padStart(2,"0"))) return;

const key = empId+"_"+data.date;

if(!presentMap[key]){
presentMap[key] = true;
}

});

const empCount = {};

Object.keys(presentMap).forEach(k=>{
const id = k.split("_")[0];
empCount[id] = (empCount[id]||0)+1;
});

usersSnap.forEach(u=>{

const user = u.data();
const present = empCount[u.id] || 0;
const absent = workingDays - present;

const tr = document.createElement("tr");

tr.innerHTML =
`<td>${user.name}</td>
<td>${workingDays}</td>
<td>${present}</td>
<td>${absent}</td>`;

summaryBody.appendChild(tr);

});

}

/* ================= BLOCKED ================= */
async function loadBlocked(){

blockedBody.innerHTML="";

const snap = await getDocs(
query(collection(db,"users"),where("accountStatus","==","blocked"))
);

snap.forEach(d=>{

const user = d.data();

const tr = document.createElement("tr");

tr.innerHTML =
`<td>${user.name}</td>
<td>${user.branch}</td>
<td>${user.blockReason}</td>
<td><button data-id="${d.id}">Unblock</button></td>`;

blockedBody.appendChild(tr);

});

document.querySelectorAll("button[data-id]").forEach(btn=>{
btn.onclick = async ()=>{
await updateDoc(doc(db,"users",btn.dataset.id),{
accountStatus:"active",
absenceCount:0
});
loadBlocked();
};
});

}

/* LOAD */
dateInput.addEventListener("change",()=>loadAttendance(dateInput.value));

loadAttendance(today);
loadSummary();
loadBlocked();
