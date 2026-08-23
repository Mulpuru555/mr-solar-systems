import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let uid = "";
let employeeName = "";
let employeeBranch = "";

const form = document.getElementById("leaveForm");
const statusBox = document.getElementById("leaveFormStatus");
const historyTable = document.getElementById("leaveHistoryTable");
const holidayListEl = document.getElementById("holidayList");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;

  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    employeeName = snap.data().name || "";
    employeeBranch = snap.data().branch || "";
  }

  loadLeaveHistory();
  loadUpcomingHolidays();
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = document.getElementById("leaveType").value;
    const fromDate = document.getElementById("leaveFrom").value;
    const toDate = document.getElementById("leaveTo").value;
    const reason = document.getElementById("leaveReason").value.trim();

    if (!fromDate || !toDate || !reason) {
      statusBox.textContent = "Please fill in all fields.";
      return;
    }

    if (toDate < fromDate) {
      statusBox.textContent = "'To date' cannot be before 'From date'.";
      return;
    }

    statusBox.textContent = "Submitting…";

    try {
      await addDoc(collection(db, "leaveRequests"), {
        employeeId: uid,
        employeeName,
        branch: employeeBranch,
        type,
        fromDate,
        toDate,
        reason,
        status: "pending",
        createdAt: serverTimestamp()
      });

      statusBox.textContent = "Leave request submitted.";
      form.reset();
      loadLeaveHistory();
    } catch (err) {
      statusBox.textContent = "Could not submit: " + err.message;
    }
  });
}

async function loadLeaveHistory() {
  if (!historyTable) return;

  try {
    const q = query(
      collection(db, "leaveRequests"),
      where("employeeId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      historyTable.innerHTML = `<tr><td colspan="5">No leave requests yet.</td></tr>`;
      return;
    }

    let rows = "";
    snap.forEach(d => {
      const r = d.data();
      const status = (r.status || "pending").toLowerCase();
      rows += `<tr>
        <td>${escapeHtml(r.type || "-")}</td>
        <td>${escapeHtml(r.fromDate || "-")}</td>
        <td>${escapeHtml(r.toDate || "-")}</td>
        <td>${escapeHtml(r.reason || "-")}</td>
        <td><span class="statusPill ${status}">${escapeHtml(status)}</span></td>
      </tr>`;
    });

    historyTable.innerHTML = rows;
  } catch (err) {
    historyTable.innerHTML = `<tr><td colspan="5">Could not load leave history.</td></tr>`;
  }
}

async function loadUpcomingHolidays() {
  if (!holidayListEl) return;

  try {
    const snap = await getDocs(collection(db, "settings", "holidays", "holidayList"));

    const todayStr = new Date().toISOString().split("T")[0];
    const upcoming = [];

    snap.forEach(d => {
      if (d.id >= todayStr) {
        upcoming.push({ date: d.id, name: (d.data() && d.data().name) || "Holiday" });
      }
    });

    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length === 0) {
      holidayListEl.innerHTML = `<li>No upcoming holidays scheduled.</li>`;
      return;
    }

    holidayListEl.innerHTML = upcoming.slice(0, 10).map(h =>
      `<li><span>${escapeHtml(h.name)}</span><span class="holidayDate">${escapeHtml(h.date)}</span></li>`
    ).join("");

  } catch (err) {
    holidayListEl.innerHTML = `<li>Could not load holidays.</li>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
