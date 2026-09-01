import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const bar = document.getElementById("noticeBar");
if (bar) {

  loadNotices();

}

async function loadNotices() {

  try {

    const q = query(
      collection(db, "notices"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      bar.textContent = "No announcements right now.";
      return;
    }

    const messages = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.message) messages.push(data.message);
    });

    if (messages.length === 0) {
      bar.textContent = "No announcements right now.";
      return;
    }

    let i = 0;
    bar.textContent = messages[0];

    if (messages.length > 1) {
      setInterval(() => {
        i = (i + 1) % messages.length;
        bar.textContent = messages[i];
      }, 6000);
    }

  } catch (err) {
    // "notices" collection may not exist yet or rules may not allow it —
    // fail quietly rather than breaking the rest of the portal.
    bar.textContent = "No announcements right now.";
  }

}
