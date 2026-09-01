import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ==========================================================
   EMPLOYEE MANAGEMENT
========================================================= */

let allEmployees = [];

const employeeTable = document.getElementById("employeeTable");
const employeeSearchInput = document.getElementById("employeeSearchInput");

async function loadEmployees() {
  if (!employeeTable) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    allEmployees = [];
    snap.forEach(d => allEmployees.push({ id: d.id, ...d.data() }));
    renderEmployees();
  } catch (e) {
    console.error("Error loading employees:", e);
  }
}

function renderEmployees() {
  if (!employeeTable) return;
  const search = (employeeSearchInput?.value || "").toLowerCase();

  const filtered = allEmployees.filter(u => {
    if (!search) return true;
    return (u.name || "").toLowerCase().includes(search) ||
           (u.email || "").toLowerCase().includes(search) ||
           (u.branch || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    employeeTable.innerHTML = "<tr><td colspan='7'>No employees found.</td></tr>";
    return;
  }

  employeeTable.innerHTML = filtered.map(u => {
    const isBlocked = u.accountStatus === "blocked";
    const statusPill = isBlocked
      ? '<span class="statusPill blocked">Blocked</span>'
      : '<span class="statusPill active">Active</span>';

    const blockBtn = isBlocked
      ? `<button class="action unblockBtn" data-uid="${u.id}">Unblock</button>`
      : `<button class="action blockBtn" data-uid="${u.id}">Block</button>`;

    return `<tr>
      <td><strong>${escapeHtml(u.name || "—")}</strong></td>
      <td>${escapeHtml(u.email || "—")}</td>
      <td>
        <select data-role-uid="${u.id}" class="roleSelect">
          <option value="employee" ${u.role === "employee" ? "selected" : ""}>Employee</option>
          <option value="manager"  ${u.role === "manager"  ? "selected" : ""}>Manager</option>
          <option value="admin"    ${u.role === "admin"    ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td>${escapeHtml(u.branch || "—")}</td>
      <td>${statusPill}</td>
      <td>${u.consecutiveAbsences || 0}</td>
      <td>
        ${blockBtn}
        <button class="action deleteBtn" data-delete-uid="${u.id}" style="margin-left:4px;background:#ef4444;">Delete</button>
      </td>
    </tr>`;
  }).join("");

  employeeTable.querySelectorAll(".roleSelect").forEach(sel => {
    sel.addEventListener("change", () => changeRole(sel.dataset.roleUid, sel.value));
  });

  employeeTable.querySelectorAll(".blockBtn").forEach(btn => {
    btn.addEventListener("click", () => toggleBlock(btn.dataset.uid, true));
  });

  employeeTable.querySelectorAll(".unblockBtn").forEach(btn => {
    btn.addEventListener("click", () => toggleBlock(btn.dataset.uid, false));
  });

  employeeTable.querySelectorAll("[data-delete-uid]").forEach(btn => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.deleteUid));
  });
}

async function changeRole(uid, newRole) {
  try {
    await updateDoc(doc(db, "users", uid), { role: newRole });
    logActivity("Changed user role", `uid=${uid}, newRole=${newRole}`);
    const user = allEmployees.find(u => u.id === uid);
    if (user) user.role = newRole;
    renderEmployees();
  } catch (err) {
    alert("Failed to change role: " + err.message);
  }
}

async function toggleBlock(uid, block) {
  const newStatus = block ? "blocked" : "active";
  const user = allEmployees.find(u => u.id === uid);
  const actionLabel = block ? "Block" : "Unblock";

  if (!confirm(`${actionLabel} account for ${user?.name || uid}?`)) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      accountStatus: newStatus,
      consecutiveAbsences: block ? (user?.consecutiveAbsences || 0) : 0
    });
    logActivity(`${actionLabel}ed account`, `uid=${uid}`);
    if (user) {
      user.accountStatus = newStatus;
      if (!block) user.consecutiveAbsences = 0;
    }
    renderEmployees();
  } catch (err) {
    alert(`Failed to ${actionLabel.toLowerCase()}: ` + err.message);
  }
}

async function deleteUser(uid) {
  const user = allEmployees.find(u => u.id === uid);
  if (!confirm(`Permanently delete account ${user?.name || uid}? This cannot be undone.`)) return;

  try {
    await deleteDoc(doc(db, "users", uid));
    logActivity("Deleted user account", `uid=${uid}, name=${user?.name}`);
    allEmployees = allEmployees.filter(u => u.id !== uid);
    renderEmployees();
  } catch (err) {
    alert("Failed to delete user: " + err.message);
  }
}

if (employeeSearchInput) {
  employeeSearchInput.addEventListener("input", renderEmployees);
}

/* ==========================================================
   BRANCH MANAGEMENT
========================================================== */

const branchTable = document.getElementById("branchTable");

async function loadBranches() {
  if (!branchTable) return;

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const branchEmployeeCounts = {};
    usersSnap.forEach(d => {
      const b = d.data().branch;
      if (b) branchEmployeeCounts[b] = (branchEmployeeCounts[b] || 0) + 1;
    });

    const branchIds = Object.keys(branchEmployeeCounts);
    if (branchIds.length === 0) {
      branchTable.innerHTML = "<tr><td colspan='5'>No branches found yet.</td></tr>";
      return;
    }

    const rows = [];
    for (const branchId of branchIds) {
      const settingsKey = branchId.toLowerCase();
      const settingsSnap = await getDoc(doc(db, "settings", settingsKey));
      let lat = "-", lon = "-", radius = "-";
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        lat = data.point?.latitude ?? "-";
        lon = data.point?.longitude ?? "-";
        radius = data.radius ?? "-";
      }

      rows.push(`<tr>
        <td><strong>${escapeHtml(branchId)}</strong></td>
        <td>${escapeHtml(lat)}</td>
        <td>${escapeHtml(lon)}</td>
        <td>${escapeHtml(radius)} m</td>
        <td><button class="action" data-editbranch="${settingsKey}">Edit</button></td>
      </tr>`);
    }

    branchTable.innerHTML = rows.join("");

    branchTable.querySelectorAll("[data-editbranch]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById("branchNameInput");
        if (input) {
          input.value = btn.dataset.editbranch;
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  } catch (e) {
    console.error("Error loading branches:", e);
  }
}

window.addBranch = window.saveBranchSettings = async function () {
  const branchId = document.getElementById("branchNameInput")?.value.trim().toLowerCase();
  const lat = parseFloat(document.getElementById("branchLatInput")?.value);
  const lon = parseFloat(document.getElementById("branchLonInput")?.value);
  const radius = parseFloat(document.getElementById("branchRadiusInput")?.value);
  const statusEl = document.getElementById("branchStatus") || document.getElementById("branchMessage");

  if (!branchId || isNaN(lat) || isNaN(lon) || isNaN(radius)) {
    if (statusEl) statusEl.textContent = "Fill in branch ID, latitude, longitude, and radius.";
    return;
  }

  try {
    await setDoc(doc(db, "settings", branchId), {
      point: { latitude: lat, longitude: lon },
      radius: radius
    }, { merge: true });

    if (statusEl) statusEl.textContent = `Saved settings for "${branchId}".`;
    logActivity("Updated branch settings", `branch=${branchId}, lat=${lat}, lon=${lon}, radius=${radius}`);
    if (document.getElementById("branchNameInput")) document.getElementById("branchNameInput").value = "";
    if (document.getElementById("branchLatInput")) document.getElementById("branchLatInput").value = "";
    if (document.getElementById("branchLonInput")) document.getElementById("branchLonInput").value = "";
    loadBranches();
  } catch (err) {
    if (statusEl) statusEl.textContent = "Failed to save: " + err.message;
  }
};

/* ==========================================================
   NOTICE MANAGEMENT
========================================================== */

const noticeTable = document.getElementById("noticeTable");

async function loadNotices() {
  if (!noticeTable) return;

  try {
    const snap = await getDocs(collection(db, "notices"));
    const notices = [];
    snap.forEach(d => notices.push({ id: d.id, ...d.data() }));

    notices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (notices.length === 0) {
      noticeTable.innerHTML = "<tr><td colspan='3'>No notices posted yet.</td></tr>";
      return;
    }

    noticeTable.innerHTML = notices.map(n => {
      const posted = n.createdAt?.seconds
        ? new Date(n.createdAt.seconds * 1000).toLocaleString("en-IN")
        : "-";
      return `<tr>
        <td>${escapeHtml(n.message || "")}</td>
        <td>${posted}</td>
        <td><button class="action deleteBtn" data-deletenotice="${n.id}">Delete</button></td>
      </tr>`;
    }).join("");

    noticeTable.querySelectorAll("[data-deletenotice]").forEach(btn => {
      btn.addEventListener("click", () => deleteNotice(btn.dataset.deletenotice));
    });

  } catch (err) {
    noticeTable.innerHTML = "<tr><td colspan='3'>Could not load notices.</td></tr>";
  }
}

window.postNotice = async function () {
  const input = document.getElementById("noticeMessageInput");
  const typeSelect = document.getElementById("noticeTypeSelect");
  const statusEl = document.getElementById("noticeStatus") || document.getElementById("noticeFormStatus");
  const message = input?.value.trim();
  const noticeType = typeSelect?.value || "info";

  if (!message) {
    if (statusEl) statusEl.textContent = "Write a message first.";
    return;
  }

  try {
    await addDoc(collection(db, "notices"), {
      message,
      type: noticeType,
      createdAt: serverTimestamp()
    });
    if (statusEl) statusEl.textContent = "Notice posted successfully.";
    logActivity("Posted notice", message.slice(0, 100));
    if (input) input.value = "";
    loadNotices();
    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 4000);
  } catch (err) {
    if (statusEl) statusEl.textContent = "Failed to post: " + err.message;
  }
};

window.clearNotice = async function () {
  const statusEl = document.getElementById("noticeStatus") || document.getElementById("noticeFormStatus");
  if (!confirm("Clear all active company notices?")) return;

  try {
    const snap = await getDocs(collection(db, "notices"));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, "notices", d.id));
    }
    if (statusEl) statusEl.textContent = "All notices cleared.";
    logActivity("Cleared all active notices", "");
    loadNotices();
    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 4000);
  } catch (err) {
    if (statusEl) statusEl.textContent = "Failed to clear notices: " + err.message;
  }
};

async function deleteNotice(id) {
  if (!confirm("Delete this notice?")) return;
  try {
    await deleteDoc(doc(db, "notices", id));
    logActivity("Deleted notice", `id=${id}`);
    loadNotices();
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}

/* ==========================================================
   INIT
========================================================== */

loadEmployees();
loadBranches();
loadNotices();
