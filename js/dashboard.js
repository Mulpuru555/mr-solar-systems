import { auth, db } from "./firebase-config.js";

import {
doc,
getDoc,
getDocs,
collection,
query,
where,
onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";
let userData = null;

function formatDateStr(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

onAuthStateChanged(auth, async (user)=>{

if(!user){
location.href="/index.html";
return;
}

uid = user.uid;

onSnapshot(doc(db, "users", uid), (snap) => {
  if (!snap.exists()) return;
  userData = snap.data();
  const nameEl = document.getElementById("welcomeName");
  if (nameEl) {
    nameEl.innerText = "Welcome " + (userData.name || "");
  }
});

loadStats();

});


/* logout */

const logoutBtn =
document.getElementById("logoutBtn");

if(logoutBtn){

logoutBtn.onclick = async ()=>{

await signOut(auth);
location.href="/index.html";

};

}


/* ================= STATS ================= */

async function loadStats(){

let total = 0;
let pending = 0;


/* ERP */

try {
  onSnapshot(query(collection(db,"customerPayments"), where("createdBy","==",uid)), (snap) => {
    total = 0;
    pending = 0;
    snap.forEach(d=>{
      total++;
      if(
        (d.data().status || "")
        .toLowerCase() === "pending"
      ){
        pending++;
      }
    });

    const totalEl = document.getElementById("totalStat");
    const pendingEl = document.getElementById("pendingStat");
    if (totalEl) totalEl.innerText = total;
    if (pendingEl) pendingEl.innerText = pending;
  });
} catch(e) {}


/* TODAY ATTENDANCE */

const today = formatDateStr(new Date());

async function checkTodayAttendance() {
  let todayStatus = "NO";

  try {
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
    } else {
      const flatSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("employeeId", "==", uid),
          where("date", "==", today)
        )
      );
      if (!flatSnap.empty) {
        todayStatus = "YES";
      } else {
        const flatSnapUser = await getDocs(
          query(
            collection(db, "attendance"),
            where("userId", "==", uid),
            where("date", "==", today)
          )
        );
        if (!flatSnapUser.empty) {
          todayStatus = "YES";
        }
      }
    }
  } catch(e) {}

  const todayEl = document.getElementById("todayStat");
  if (todayEl) {
    todayEl.innerText = todayStatus;
  }
}

checkTodayAttendance();

/* MONTHLY ATTENDANCE % */
async function computeMonthlyAttendance() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

    let holidayDates = new Set();
    try {
      const holidaySnap = await getDocs(collection(db, "settings", "holidays", "holidayList"));
      holidaySnap.forEach(d => holidayDates.add(d.id));
    } catch(e) {}

    let workingDays = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayObj = new Date(year, month - 1, d);
      if (dayObj.getDay() === 0) continue; // Sunday
      if (holidayDates.has(dateStr)) continue; // Holiday
      workingDays++;
    }

    onSnapshot(collection(db, "attendance"), (snap) => {
      const presentDays = new Set();
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if ((data.employeeId === uid || data.userId === uid) && data.date && data.date.startsWith(monthPrefix)) {
          if (data.date <= today) {
            const parts = data.date.split("-");
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            if (dateObj.getDay() !== 0 && !holidayDates.has(data.date)) {
              presentDays.add(data.date);
            }
          }
        }
      });

      const presentCount = Math.min(presentDays.size, workingDays);
      const pct = workingDays > 0 ? Math.min(100, Math.round((presentCount / workingDays) * 100)) : 100;

      const monthEl = document.getElementById("monthStat");
      if (monthEl) {
        monthEl.innerText = `${pct}%`;
      }
    });
  }

  computeMonthlyAttendance();
}
