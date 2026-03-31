import { auth, db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  uid = user.uid;
  await loadHistory(); // Use await for better error handling
});

/* ================= LOAD HISTORY ================= */
async function loadHistory() {
  const table = document.getElementById("historyTable");
  if (!table) {
    console.warn("History table not found");
    return;
  }

  // Show loading state
  table.innerHTML = "<tr><td colspan='2' class='text-center'>Loading...</td></tr>";

  try {
    // 🔥 IMPROVED: Use Firestore query instead of client-side filtering
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", uid), // Prioritize userId (new format)
      where("employeeId", "==", uid, { shouldDocumentExist: true }), // Fallback to employeeId
      orderBy("date", "desc"),
      orderBy("timestamp", "desc")
    );

    const snap = await getDocs(q);
    const rows = [];

    snap.forEach((doc) => {
      rows.push({ id: doc.id, ...doc.data() });
    });

    // No data found
    if (rows.length === 0) {
      table.innerHTML = "<tr><td colspan='2' class='text-center'>No Records Found</td></tr>";
      return;
    }

    // Render rows
    renderTableRows(table, rows);

  } catch (error) {
    console.error("Error loading history:", error);
    table.innerHTML = "<tr><td colspan='2' class='text-center text-danger'>Error loading data. Please try again.</td></tr>";
  }
}

/* ================= RENDER TABLE ROWS ================= */
function renderTableRows(table, rows) {
  table.innerHTML = ""; // Clear table

  rows.forEach((r) => {
    const row = createTableRow(r);
    table.appendChild(row);
  });
}

/* ================= CREATE TABLE ROW ================= */
function createTableRow(record) {
  const row = document.createElement("tr");
  
  // Format date
  const date = formatDate(record.date || record.createdAt);
  
  // Format time
  const time = formatTime(record);

  row.innerHTML = `
    <td class="date-cell">${date}</td>
    <td class="time-cell">${time}</td>
  `;
  
  // Add hover effect
  row.className = "table-row-hover";
  
  return row;
}

/* ================= FORMAT DATE ================= */
function formatDate(dateStr) {
  if (!dateStr) return "-";
  
  try {
    // Handle different date formats
    let date;
    if (typeof dateStr === 'string') {
      date = new Date(dateStr);
    } else if (dateStr.seconds) {
      date = new Date(dateStr.seconds * 1000);
    } else {
      date = new Date(dateStr);
    }
    
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return dateStr || "-";
  }
}

/* ================= FORMAT TIME ================= */
function formatTime(record) {
  // Priority order for time fields
  const timeFields = [
    record.timestamp,
    record.time,
    record.checkInTime,
    record.checkOutTime
  ];

  for (const timeField of timeFields) {
    if (timeField) {
      try {
        if (timeField.seconds) {
          // Firestore timestamp
          return new Date(timeField.seconds * 1000).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          });
        } else if (typeof timeField === 'string') {
          // String time
          return timeField;
        } else {
          // Date object
          return new Date(timeField).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          });
        }
      } catch {
        continue;
      }
    }
  }
  
  return "-";
}

/* ================= RELOAD FUNCTION (OPTIONAL) ================= */
function reloadHistory() {
  if (uid) {
    loadHistory();
  }
}

// Expose reload function globally for manual refresh
window.reloadHistory = reloadHistory;

// Auto-reload every 30 seconds (optional)
setInterval(() => {
  if (uid) loadHistory();
}, 30000);
