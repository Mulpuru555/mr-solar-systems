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

const snap = await getDoc(
doc(db,"settings","notice")
);

if(!snap.exists()) return;

const bar = document.getElementById("noticeBar");

if(bar){
bar.innerText = snap.data().text || "";
}

}


/* ================= STATS ================= */

async function loadStats(){

/* ERP */

let total = 0;
let pending = 0;

const q = query(
collection(db,"customerPayments"),
where("createdBy","==",uid)
);

const snap = await getDocs(q);

snap.forEach(d=>{

total++;

if(
(d.data().status || "")
.toLowerCase() === "pending"
){
pending++;
}

});

document.getElementById("totalBox").innerText = total;
document.getElementById("pendingBox").innerText = pending;


/* TODAY */

const today =
new Date().toISOString().split("T")[0];

let todayStatus = "NO";

const aQ = query(
collection(db,"attendance"),
where("employeeId","==",uid),
where("date","==",today)
);

const aSnap = await getDocs(aQ);

if(!aSnap.empty){
todayStatus = "YES";
}

document.getElementById("todayBox").innerText = todayStatus;

}
