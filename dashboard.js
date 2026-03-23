import { auth, db } from "./firebase-config.js";

import {
doc,
getDoc,
getDocs,
collection,
query,
where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";
let userData = null;


/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user)=>{

if(!user){
location.href="index.html";
return;
}

uid = user.uid;

const snap = await getDoc(
doc(db,"users",uid)
);

if(!snap.exists()){
location.href="index.html";
return;
}

userData = snap.data();

if(userData.accountStatus === "blocked"){
showBlocked();
return;
}


/* welcome */

const w = document.getElementById("welcomeName");
if(w){
w.innerText = "Welcome " + (userData.name || "");
}


/* load dashboard data */

loadNotice();
loadStats();

});


/* ================= LOGOUT ================= */

const logoutBtn = document.getElementById("logoutBtn");

if(logoutBtn){
logoutBtn.onclick = async ()=>{
await signOut(auth);
location.href="index.html";
};
}


/* ================= BLOCKED ================= */

function showBlocked(){

document.body.innerHTML = `
<div style="height:100vh;display:flex;justify-content:center;align-items:center;background:black;color:white">
<div style="background:#111;padding:40px;border:2px solid red;border-radius:10px;text-align:center">
<h2>ACCOUNT BLOCKED</h2>
<button id="logoutBtn2">Logout</button>
</div>
</div>
`;

document.getElementById("logoutBtn2").onclick = async ()=>{
await signOut(auth);
location.href="index.html";
};

}


/* ================= NOTICE ================= */

async function loadNotice(){

try{

const snap = await getDoc(
doc(db,"settings","notice")
);

if(!snap.exists()) return;

const text = snap.data().text || "";

const bar = document.getElementById("noticeBar");

if(bar) bar.innerText = text;

}catch(e){
console.log(e);
}

}



/* ================= STATS ================= */

async function loadStats(){

try{

/* ---------- TODAY ATTENDANCE ---------- */

const today = new Date()
.toISOString()
.split("T")[0];

const q1 = query(
collection(db,"attendance"),
where("employeeId","==",uid),
where("date","==",today)
);

const snap1 = await getDocs(q1);

const todayStat = document.getElementById("todayStat");

if(todayStat){
todayStat.innerText = snap1.size > 0 ? "YES" : "NO";
}



/* ---------- MONTH RANGE ---------- */

const now = new Date();

const monthStart =
new Date(now.getFullYear(), now.getMonth(), 1);

const todayDate =
new Date(
now.getFullYear(),
now.getMonth(),
now.getDate()
);



/* ---------- HOLIDAYS ---------- */

const holidaysSnap =
await getDocs(
collection(db,"settings","holidays","list")
);

let holidays = [];

holidaysSnap.forEach(d=>{
holidays.push(d.id);
});



/* ---------- ATTENDANCE ---------- */

const q2 = query(
collection(db,"attendance"),
where("employeeId","==",uid)
);

const snap2 = await getDocs(q2);

let presentDates = [];

snap2.forEach(d=>{

const data = d.data();

if(!data.date) return;

const dt = new Date(data.date);

if(dt >= monthStart && dt <= todayDate){

presentDates.push(data.date);

}

});


presentDates =
[...new Set(presentDates)];


/* ---------- WORKING DAYS ---------- */

let working = 0;

for(
let d = new Date(monthStart);
d <= todayDate;
d.setDate(d.getDate()+1)
){

const ds =
d.toISOString().split("T")[0];

if(holidays.includes(ds)) continue;

working++;

}


/* ---------- PERCENT ---------- */

let percent = 0;

if(working > 0){
percent =
Math.round(
presentDates.length
/
working
* 100
);
}

const percentBox =
document.getElementById("percentStat");

if(percentBox){
percentBox.innerText = percent + "%";
}



/* ---------- ERP TOTAL ---------- */

const q3 = query(
collection(db,"customerPayments"),
where("createdBy","==",uid)
);

const snap3 = await getDocs(q3);

const totalBox =
document.getElementById("totalStat");

if(totalBox){
totalBox.innerText = snap3.size;
}



/* ---------- ERP PENDING ---------- */

let pending = 0;

snap3.forEach(d=>{

if(d.data().status !== "Paid"){
pending++;
}

});

const pBox =
document.getElementById("pendingStat");

if(pBox){
pBox.innerText = pending;
}


}catch(e){

console.log(e);

}

}
