import { auth, db } from "./firebase-config.js";

import {
collection,
query,
where,
onSnapshot,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";
let unsubscribe = null;

onAuthStateChanged(auth, async (user)=>{

if(!user) {
  if (unsubscribe) unsubscribe();
  return;
}

uid = user.uid;

listenHistory();

});


function listenHistory(){

const table =
document.getElementById("historyTable");

if(!table || !uid) return;

table.innerHTML = "";

if (unsubscribe) unsubscribe();

unsubscribe = onSnapshot(collection(db, "attendance"), (snap)=>{
  let rowsMap = new Map();

  snap.forEach(d=>{
    const data = d.data();
    if (data.employeeId === uid || data.userId === uid) {
      const dateKey = data.date || (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000).toISOString().split("T")[0] : "");
      if (dateKey) {
        rowsMap.set(d.id, { id: d.id, ...data, date: dateKey });
      }
    }
  });

  renderRows(Array.from(rowsMap.values()), table);
}, async (err)=>{
  // Fallback to getDocs
  try {
    const fallbackSnap = await getDocs(query(collection(db, "attendance"), where("employeeId", "==", uid)));
    let rows = [];
    fallbackSnap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    renderRows(rows, table);
  } catch (e) {
    console.error("Attendance history error:", e);
  }
});

}

function renderRows(rows, table) {
  if (!table) return;
  table.innerHTML = "";

  if (rows.length === 0) {
    table.innerHTML = `<tr><td colspan="2" style="text-align:center;color:#8a97a6;">No attendance records found.</td></tr>`;
    return;
  }

  rows.sort((a,b)=>{
    const dateA = a.date || "";
    const dateB = b.date || "";
    return dateB.localeCompare(dateA);
  });

  rows.forEach(r=>{
    let time = "-";

    if(r.timestamp?.seconds){
      time = new Date(r.timestamp.seconds*1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } else if (r.time?.seconds) {
      time = new Date(r.time.seconds*1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    table.innerHTML += `
    <tr>
    <td>${r.date || "-"}</td>
    <td>${time}</td>
    </tr>
    `;
  });
}
