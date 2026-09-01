import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let cachedEmployees = [];

const assigneeSelect = document.getElementById("mgrTaskAssigneeSelect");
const listEl = document.getElementById("managerTaskList");

function updateAssigneeDropdown() {
  if (!assigneeSelect) return;
  const currentVal = assigneeSelect.value;
  assigneeSelect.innerHTML = `<option value="">Assign to employee...</option>` +
    cachedEmployees.map(e => `<option value="${e.uid}">${escapeHtml(e.name)}${e.branch ? ` (${escapeHtml(e.branch)})` : ''}</option>`).join("");
  if (currentVal) assigneeSelect.value = currentVal;
}

// Real-time employee listener
onSnapshot(collection(db, "users"), (snap) => {
  cachedEmployees = [];
  snap.forEach(d => {
    const u = d.data();
    const role = (u.role || "employee").toLowerCase();
    if (role !== "admin" && role !== "manager") {
      cachedEmployees.push({
        uid: d.id,
        name: u.name || u.email || "Employee",
        branch: u.branch || ""
      });
    }
  });
  cachedEmployees.sort((a, b) => a.name.localeCompare(b.name));
  updateAssigneeDropdown();
});

const createBtn = document.getElementById("mgrCreateTaskBtn");
if (createBtn) {
  createBtn.addEventListener("click", async () => {
    const statusEl = document.getElementById("mgrTaskFormStatus");

    const title = document.getElementById("mgrTaskTitleInput")?.value.trim();
    const assigneeUid = assigneeSelect?.value;
    const dueDate = document.getElementById("mgrTaskDueDateInput")?.value || "";

    if (!title || !assigneeUid) {
      if (statusEl) statusEl.textContent = "Please enter a task title and select an assignee.";
      return;
    }

    const assignee = cachedEmployees.find(e => e.uid === assigneeUid);

    if (statusEl) statusEl.textContent = "Assigning task…";

    try {
      await addDoc(collection(db, "tasks"), {
        title,
        description: "",
        priority: "Medium",
        dueDate,
        status: "Pending",
        assignedTo: assignee ? { uid: assignee.uid, name: assignee.name, branch: assignee.branch || "" } : null,
        assignedBy: "Manager",
        createdAt: serverTimestamp()
      });

      logActivity("Manager assigned task", `title=${title}, assignedTo=${assignee?.name || "-"}`);
      if (statusEl) statusEl.textContent = "Task assigned successfully.";

      const titleInput = document.getElementById("mgrTaskTitleInput");
      const dateInput = document.getElementById("mgrTaskDueDateInput");
      if (titleInput) titleInput.value = "";
      if (dateInput) dateInput.value = "";
      if (assigneeSelect) assigneeSelect.value = "";
    } catch (err) {
      if (statusEl) statusEl.textContent = "Failed to assign: " + err.message;
    }
  });
}

function renderTasks(tasks) {
  if (!listEl) return;

  if (tasks.length === 0) {
    listEl.innerHTML = `<div style="color:#8a97a6;font-size:13px;padding:8px 0;">No tasks assigned yet.</div>`;
    return;
  }

  listEl.innerHTML = tasks.map(t => {
    const priorityColor = t.priority === "High" ? "#ff8a8a" : t.priority === "Low" ? "#6fe3a1" : "#ffd479";
    const statusClass = (t.status || "Pending").toLowerCase().replace(/\s+/g, "-");
    return `<div style="background:rgba(255,255,255,0.06);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <strong>${escapeHtml(t.title)}</strong>
        <span style="font-size:11px;color:${priorityColor};">${escapeHtml(t.priority || "Medium")}</span>
      </div>
      <div style="font-size:12px;color:#dce3ea;margin-top:4px;">
        Assigned to: <strong>${escapeHtml(t.assignedTo?.name || "-")}</strong>
      </div>
      <div style="font-size:11px;color:#8a97a6;margin-top:4px;display:flex;justify-content:space-between;flex-wrap:wrap;">
        <span>Due: ${escapeHtml(t.dueDate || "-")}</span>
        <span class="statusPill ${statusClass}">${escapeHtml(t.status || "Pending")}</span>
      </div>
    </div>`;
  }).join("");
}

if (listEl) {
  onSnapshot(collection(db, "tasks"), (snap) => {
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tasks.sort((a, b) => {
      const tA = a.createdAt?.seconds || (typeof a.createdAt === "string" ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tB = b.createdAt?.seconds || (typeof b.createdAt === "string" ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tB - tA;
    });
    renderTasks(tasks);
  }, (err) => {
    console.error("manager-tasks error:", err);
    listEl.innerHTML = `<div style="color:#8a97a6;font-size:13px;">Could not load tasks.</div>`;
  });
}
