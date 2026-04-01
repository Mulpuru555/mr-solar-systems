import { auth, db } from "./firebase-config.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";
let refreshInterval = null;

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    // Stop refresh when logged out
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    return;
  }

  uid = user.uid;
  
  // Start refresh only when authenticated
  if (!refreshInterval) {
    refreshInterval = setInterval(loadHistory, 30000);
  }
  
  await loadHistory();
});

/* ================= LOAD HISTORY ================= */
async function loadHistory() {
  const table = document.getElementById("historyTable");
  if (!table) {
    console.warn("History table not found");
    return;
  }

  table.innerHTML = "<tr><td colspan='2'>Loading...</td></tr>";

  try {
    // ✅ NO INDEX REQUIRED - Simple collection query
    const snap = await getDocs(collection(db, "attendance"));

    const rows = [];

    snap.forEach((doc) => {
      const data = doc.data();

      // ✅ SUPPORTS BOTH FIELD NAMES
      if (data.userId === uid || data.employeeId === uid) {
        rows.push(data);
      }
    });

    if (rows.length === 0) {
      table.innerHTML = "<tr><td colspan='2'>No Records Found</td></tr>";
      return;
    }

    // ✅ CLIENT-SIDE SORT (latest first)
    rows.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });

    table.innerHTML = "";

    rows.forEach((data) => {
      const date = formatDate(data.date || data.timestamp);
      const time = formatTime(data.timestamp);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${date}</td>
        <td>${time}</td>
      `;
      table.appendChild(row);
    });

  } catch (error) {
    console.error("Error loading history:", error);
    table.innerHTML = "<tr><td colspan='2'>Error loading data</td></tr>";
  }
}

/* ================= FORMAT DATE ================= */
function formatDate(dateVal) {
  if (!dateVal) return "-";

  try {
    let date;
    
    if (dateVal.seconds !== undefined) {
      date = new Date(dateVal.seconds * 1000);
    } else if (typeof dateVal === 'string') {
      date = new Date(dateVal);
    } else {
      date = new Date(dateVal);
    }

    if (isNaN(date.getTime())) return "-";
    
    return date.toLocaleDateString("en-IN");
  } catch {
    return "-";
  }
}

/* ================= FORMAT TIME ================= */
function formatTime(timestamp) {
  if (!timestamp) return "-";

  try {
    let date;
    
    if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) return "-";
    
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return "-";
  }
}
