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


// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBNtPFzFkYLpbv8vgfeQ0_uE42JT7h28bc",
  authDomain: "mr-solar-portal.firebaseapp.com",
  projectId: "mr-solar-portal",
  storageBucket: "mr-solar-portal.appspot.com",
  messagingSenderId: "1017116122935",
  appId: "1:1017116122935:web:db1256b90c66c96ad644b2"
};


// INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// 📍 OFFICE LOCATION (CHANGE IF NEEDED)
const officeLat = 15.823;
const officeLng = 80.352;
const allowedRadius = 350; // meters


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


// 📍 DISTANCE FUNCTION
function getDistance(lat1, lon1, lat2, lon2) {

  const R = 6371e3;

  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;

  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a =
    Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}


// ✅ ATTENDANCE WITH GPS CHECK
document.getElementById("attendanceBtn").onclick = () => {

  const user = auth.currentUser;
  if (!user) return;

  navigator.geolocation.getCurrentPosition(async (position) => {

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    const distance = getDistance(userLat, userLng, officeLat, officeLng);

    document.getElementById("distanceInfo").innerText =
      "Distance: " + Math.round(distance) + " meters";

    if (distance > allowedRadius) {
      alert("❌ You are outside allowed area");
      return;
    }

    const now = new Date();

    await addDoc(collection(db, "attendance_chirala"), {
      uid: user.uid,
      email: user.email,
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      timestamp: now,
      lat: userLat,
      lng: userLng,
      distance: Math.round(distance)
    });

    document.getElementById("attendanceStatus").innerText =
      "✅ Attendance Marked";

    loadHistory(user.uid);

  }, () => {
    alert("Enable location access");
  });
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
