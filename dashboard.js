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

document.getElementById("totalStat").innerText = total;
document.getElementById("pendingStat").innerText = pending;


/* TODAY */

const snapAttendance = await getDocs(collection(db, "attendance"));

let todayCount = 0;

const today = new Date().toDateString();

snapAttendance.forEach(doc => {
  const data = doc.data();

  if (data.userId === uid || data.employeeId === uid) {

    let recordDate;

    if (data.timestamp?.seconds) {
      recordDate = new Date(data.timestamp.seconds * 1000).toDateString();
    } else if (data.date) {
      recordDate = new Date(data.date).toDateString();
    }

    if (recordDate === today) {
      todayCount++;
    }
  }
});

document.getElementById("todayStat").innerText = todayCount > 0 ? "YES" : "NO";
