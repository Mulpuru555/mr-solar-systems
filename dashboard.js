import { auth, db } from "./firebase-config.js";

import {
  doc,
  getDoc,
  getDocs,
  collection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";
let userData = null;

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  uid = user.uid;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    
    if (!snap.exists()) {
      console.warn("User document not found");
      return;
    }

    userData = snap.data();

    // ✅ Safe DOM update
    const welcomeEl = document.getElementById("welcomeName");
    if (welcomeEl) {
      welcomeEl.innerText = "Welcome " + (userData.name || "User");
    }

    await loadStats();
  } catch (error) {
    console.error("Auth error:", error);
  }
});

/* ================= LOGOUT ================= */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
}

/* ================= STATS ================= */
async function loadStats() {
  try {
    // Show loading
    updateStat("totalStat", "Loading...");
    updateStat("pendingStat", "Loading...");
    updateStat("todayStat", "Loading...");

    /* ================= ERP PAYMENTS (NO INDEX NEEDED) ================= */
    let total = 0;
    let pending = 0;

    const paymentsSnap = await getDocs(collection(db, "customerPayments"));
    
    paymentsSnap.forEach(d => {
      const data = d.data();
      
      // ✅ Support both field names
      if (data.createdBy === uid || data.userId === uid || data.employeeId === uid) {
        total++;
        if ((data.status || "").toLowerCase() === "pending") {
          pending++;
        }
      }
    });

    updateStat("totalStat", total);
    updateStat("pendingStat", pending);

    /* ================= ATTENDANCE ================= */
    const attendanceSnap = await getDocs(collection(db, "attendance"));
    const records = [];

    attendanceSnap.forEach(doc => {
      const data = doc.data();
      if (data.userId === uid || data.employeeId === uid) {
        records.push(data);
      }
    });

    /* ================= TODAY ================= */
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const todayStr = today.toDateString();

    const todayFound = records.some(r => {
      const recordDate = getRecordDate(r);
      return recordDate && recordDate.toDateString() === todayStr;
    });

    updateStat("todayStat", todayFound ? "YES" : "NO");

    /* ================= STREAK (FIXED LOGIC) ================= */
    const streak = calculateStreak(records);
    updateStat("streakCount", streak);

  } catch (error) {
    console.error("Stats error:", error);
    updateStat("totalStat", "Error");
    updateStat("pendingStat", "Error");
    updateStat("todayStat", "Error");
    updateStat("streakCount", "Error");
  }
}

/* ================= HELPER FUNCTIONS ================= */
function updateStat(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.innerText = value;
}

function getRecordDate(record) {
  try {
    if (record.timestamp?.seconds !== undefined) {
      return new Date(record.timestamp.seconds * 1000);
    }
    if (record.date) {
      return new Date(record.date);
    }
    return null;
  } catch {
    return null;
  }
}

function calculateStreak(records) {
  if (records.length === 0) return 0;

  // Convert & sort dates (latest first)
  const dates = records
    .map(r => getRecordDate(r))
    .filter(d => d !== null)
    .map(d => {
      d.setHours(0, 0, 0, 0); // normalize
      return d;
    })
    .sort((a, b) => b - a);

  let streak = 0;

  let current = new Date();
  current.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {

    const diff = Math.floor(
      (current - dates[i]) / (1000 * 60 * 60 * 24)
    );

    if (diff === 0) {
      streak++;
      current.setDate(current.getDate() - 1);
    } 
    else if (diff === 1) {
      streak++;
      current.setDate(current.getDate() - 1);
    } 
    else {
      break;
    }
  }

  return streak;
}
