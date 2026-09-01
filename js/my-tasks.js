import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const listEl = document.getElementById("myTasksList");

function isOverdue(task) {
  if (!task.dueDate || task.status === "Completed") return false;
  return task.dueDate < new Date().toISOString().split("T")[0];
}

function render(tasks) {
  if (!listEl) return;

  if (tasks.length === 0) {
    listEl.innerHTML = `<div class="docEmpty">No tasks assigned to you yet.</div>`;
    return;
  }

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  tasks.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  listEl.innerHTML = tasks.map(t => {
    const priorityColor = t.priority === "High" ? "#ff8a8a" : t.priority === "Low" ? "#6fe3a1" : "#ffd479";
    const overdue = isOverdue(t);

    return `<div class="docItem" style="display:block;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <strong>${escapeHtml(t.title)}</strong>
        <span style="font-size:11px;color:${priorityColor};">${escapeHtml(t.priority || "Medium")}</span>
      </div>
      ${t.description ? `<div style="font-size:12px;color:#cfd8e3;margin-top:4px;">${escapeHtml(t.description)}</div>` : ""}
      <div style="font-size:11px;color:#8a97a6;margin-top:4px;">
        Due: ${escapeHtml(t.dueDate || "-")} ${overdue ? '<span style="color:#ff5252;">(Overdue)</span>' : ""}
      </div>
      <select data-task-status="${t.id}" style="width:auto;margin-top:8px;">
        <option value="Pending" ${t.status === "Pending" ? "selected" : ""}>Pending</option>
        <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
        <option value="Completed" ${t.status === "Completed" ? "selected" : ""}>Completed</option>
      </select>
    </div>`;
  }).join("");

  listEl.querySelectorAll("[data-task-status]").forEach(sel => {
    sel.addEventListener("change", () => updateStatus(sel.dataset.taskStatus, sel.value));
  });
}

async function updateStatus(taskId, newStatus) {
  try {
    await updateDoc(doc(db, "tasks", taskId), { status: newStatus });
  } catch (err) {
    alert("Failed to update task status: " + err.message);
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user || !listEl) return;

  const q = query(collection(db, "tasks"), where("assignedTo.uid", "==", user.uid));
  onSnapshot(q, (snap) => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render(tasks);
  }, () => {
    listEl.innerHTML = `<div class="docEmpty">Could not load your tasks.</div>`;
  });
});
