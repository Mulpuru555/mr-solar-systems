// 🔥 ALL-IN-ONE FILE (NO firebase.js NEEDED)

import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// 🔥 YOUR CONFIG (MERGED HERE)
const firebaseConfig = {
  apiKey: "AIzaSyBNtPFzFkYLpbv8vgfeQ0_uE42JT7h28bc",
  authDomain: "mr-solar-portal.firebaseapp.com",
  projectId: "mr-solar-portal",
  storageBucket: "mr-solar-portal.appspot.com",
  messagingSenderId: "1017116122935",
  appId: "1:1017116122935:web:db1256b90c66c96ad644b2"
};


// 🔥 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


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


// 🎯 SECTION SWITCH
document.getElementById("attendanceCard").onclick = () => {
  document.getElementById("attendance").style.display = "block";
  document.getElementById("history").style.display = "none";
};

document.getElementById("historyCard").onclick = () => {
  document.getElementById("attendance").style.display = "none";
  document.getElementById("history").style.display = "block";
};


// ✅ ATTENDANCE
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
