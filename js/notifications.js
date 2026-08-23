import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let uid = "";
let cachedNotifs = [];

const bellBtn = document.getElementById("notifBellBtn");
const badge = document.getElementById("notifBadge");
const panel = document.getElementById("notifPanel");

onAuthStateChanged(auth, (user) => {
  if (!user) return;
  uid = user.uid;
  loadNotifications();
});

if (bellBtn && panel) {
  bellBtn.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!bellBtn.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove("open");
    }
  });
}

async function loadNotifications() {
  if (!panel) return;

  try {
    const q = query(
      collection(db, "notifications"),
      where("employeeId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const snap = await getDocs(q);
    cachedNotifs = [];
    snap.forEach(d => cachedNotifs.push({ id: d.id, ...d.data() }));

    renderPanel();
    updateBadge();

  } catch (err) {
    panel.innerHTML = `<div class="notifEmpty">No notifications yet.</div>`;
  }
}

function renderPanel() {
  if (cachedNotifs.length === 0) {
    panel.innerHTML = `<div class="notifEmpty">No notifications yet.</div>`;
    return;
  }

  panel.innerHTML = cachedNotifs.map(n => {
    const time = n.createdAt && n.createdAt.toDate
      ? n.createdAt.toDate().toLocaleString("en-IN")
      : "";
    return `<div class="notifItem ${n.read ? "" : "unread"}" data-id="${n.id}">
      ${escapeHtml(n.message || "")}
      <span class="notifTime">${time}</span>
    </div>`;
  }).join("");

  panel.querySelectorAll(".notifItem").forEach(el => {
    el.addEventListener("click", () => markRead(el.dataset.id));
  });
}

function updateBadge() {
  const unreadCount = cachedNotifs.filter(n => !n.read).length;
  if (!badge) return;
  badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
  badge.classList.toggle("show", unreadCount > 0);
}

async function markRead(id) {
  try {
    await updateDoc(doc(db, "notifications", id), { read: true });
    const n = cachedNotifs.find(x => x.id === id);
    if (n) n.read = true;
    renderPanel();
    updateBadge();
  } catch (err) {
    // fail silently — not critical
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
