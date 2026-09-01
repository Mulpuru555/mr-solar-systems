import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const timelineEl = document.getElementById("timelineList");

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return null;
}

function fmt(d) {
  if (!d) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function safeQuery(qRef) {
  try {
    return await getDocs(qRef);
  } catch (err) {
    return null; // collection may not exist / rules may not allow it — skip quietly
  }
}

async function loadTimeline(uid) {
  if (!timelineEl) return;

  const events = [];

  // Attendance (flat collection, same one used by monthly summary / calendar)
  const attSnap = await safeQuery(query(collection(db, "attendance"), where("employeeId", "==", uid)));
  attSnap?.forEach(d => {
    const data = d.data();
    const date = tsToDate(data.timestamp);
    events.push({
      text: `Marked attendance${data.date ? " for " + data.date : ""}`,
      date: date || (data.date ? new Date(data.date) : null)
    });
  });

  // Leave requests
  const leaveSnap = await safeQuery(query(collection(db, "leaveRequests"), where("employeeId", "==", uid)));
  leaveSnap?.forEach(d => {
    const data = d.data();
    events.push({
      text: `Requested ${data.type || ""} leave (${data.fromDate || "?"} to ${data.toDate || "?"})`,
      date: tsToDate(data.createdAt)
    });
  });

  // Documents
  const docSnap = await safeQuery(collection(db, "documents", uid, "files"));
  docSnap?.forEach(d => {
    const data = d.data();
    events.push({
      text: `Uploaded document "${data.name || "file"}"`,
      date: tsToDate(data.uploadedAt)
    });
  });

  // ERP records created by this employee
  const erpSnap = await safeQuery(query(collection(db, "customerPayments"), where("createdBy", "==", uid)));
  erpSnap?.forEach(d => {
    const data = d.data();
    events.push({
      text: `Added ERP record for ${data.customerName || "a customer"}`,
      date: tsToDate(data.createdAt)
    });
  });

  const withDates = events.filter(e => e.date instanceof Date && !isNaN(e.date));
  withDates.sort((a, b) => b.date - a.date);

  if (withDates.length === 0) {
    timelineEl.innerHTML = `<div class="timelineEmpty">No recent activity yet.</div>`;
    return;
  }

  timelineEl.innerHTML = withDates.slice(0, 20).map(e => `
    <div class="timelineItem">
      <div class="timelineText">${escapeHtml(e.text)}</div>
      <div class="timelineMeta">${fmt(e.date)}</div>
    </div>
  `).join("");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  loadTimeline(user.uid);
});
