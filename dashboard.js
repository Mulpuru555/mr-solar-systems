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


onAuthStateChanged(auth, async (user)=>{

if(!user){
location.href="index.html";
return;
}

uid = user.uid;

const snap = await getDoc(
doc(db,"users",uid)
);

if(!snap.exists()) return;

userData = snap.data();


document.getElementById("welcomeName").innerText =
"Welcome " + (userData.name || "");


loadStats();

});


/* logout */

const logoutBtn =
document.getElementById("logoutBtn");

if(logoutBtn){

logoutBtn.onclick = async ()=>{

await signOut(auth);
location.href="index.html";

};

}


/* ================= STATS ================= */

async function loadStats(){

let total = 0;
let pending = 0;


/* ERP */

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

const ref = doc(
db,
"attendance",
uid,
today,
"data"
);

const aSnap = await getDoc(ref);

if(aSnap.exists()){
todayStatus = "YES";
}

document.getElementById("todayBox").innerText =
todayStatus;

}
