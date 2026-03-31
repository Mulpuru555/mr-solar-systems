import { auth, db } from "./firebase.js";

import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ✅ SECTION SWITCH
document.getElementById("attendanceCard").onclick = () => {
  document.getElementById("attendance").style.display = "block";
  document.getElementById("history").style.display = "none";
};

document.getElementById("historyCard").onclick = () => {
  document.getElementById("attendance").style.display = "none";
  document.getElementById("history").style.display = "block";
};


// 🔐 AUTH
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("welcomeName").innerText = user.email;
    loadHistory(user.uid);
  } else {
    window.location.href = "login.html";
  }
});


// 🚪 LOGOUT
document.getElementById("logoutBtn").onclick = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};


// ✅ ATTENDANCE BUTTON FIX (NO onclick issue)
document.getElementById("attendanceBtn").onclick = async () => {

  const user = auth.currentUser;
  if (!user) return;

  const now = new Date();

  await addDoc(collection(db, "attendance_chirala"), {
    uid: user.uid,
    email: user.email,
    date: now.toLocaleDateString(),
    time: now.toLocaleTimeString(),
    timestamp: now
  });

  document.getElementById("attendanceStatus").innerText = "✅ Attendance Marked";

  loadHistory(user.uid);
};


// 📜 HISTORY
async function loadHistory(uid) {

  const table = document.getElementById("historyTable");
  table.innerHTML = "";

  const q = query(
    collection(db, "attendance_chirala"),
    where("uid", "==", uid)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach((doc) => {
    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.date}</td>
        <td>${data.time}</td>
      </tr>
    `;
  });
}
