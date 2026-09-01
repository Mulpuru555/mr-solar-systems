import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let allTasks = [];
let cachedEmployees = null;

const taskTable = document.getElementById("taskTable");
const taskSearchInput = document.getElementById("taskSearchInput");
const taskStatusFilter = document.getElementById("taskStatusFilter");
const taskAssigneeSelect = document.getElementById("taskAssigneeSelect");

async function loadEmployees() {
  if (cachedEmployees) return cachedEmployees;
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "employee")));
  cachedEmployees = [];
  snap.forEach(d => {
    const u = d.data();
    cachedEmployees.push({ uid: d.id, name: u.name || "Unnamed" });
  });

  if (taskAssigneeSelect) {
    taskAssigneeSelect.innerHTML = `<option value="">Assign to...</option>` +
      cachedEmployees.map(e => `<option value="${e.uid}">${escapeHtml(e.name)}</option>`).join("");
  }

  return cachedEmployees;
}

function isOverdue(task) {
  if (!task.dueDate || task.status === "Completed") return false;
  return task.dueDate < new Date().toISOString().split("T")[0];
}

function render() {
  if (!taskTable) return;

  const search = (taskSearchInput?.value || "").toLowerCase();
  const statusFilter = taskStatusFilter?.value || "";

  const filtered = allTasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (!search) return true;
    return (t.title || "").toLowerCase().includes(search) ||
           (t.assignedTo?.name || "").toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    taskTable.innerHTML = `<tr><td colspan="6">No tasks found.</td></tr>`;
    return;
  }

  taskTable.innerHTML = filtered.map(t => {
    const priorityColor = t.priority === "High" ? "#ff5252" : t.priority === "Low" ? "#6fe3a1" : "#ffb300";
    const overdue = isOverdue(t);
    const statusClass = (t.status || "Pending").toLowerCase().replace(/\s+/g, "-");
    return `<tr>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.assignedTo?.name || "-")}</td>
      <td><span style="color:${priorityColor};font-weight:600;">${escapeHtml(t.priority || "Medium")}</span></td>
      <td>${escapeHtml(t.dueDate || "-")}${overdue ? ' <span style="color:#ff5252;font-size:11px;">(Overdue)</span>' : ""}</td>
      <td><span class="statusPill ${statusClass}">${escapeHtml(t.status || "Pending")}</span></td>
      <td><button class="action deleteBtn" data-deltask="${t.id}">Delete</button></td>
    </tr>`;
  }).join("");

  taskTable.querySelectorAll("[data-deltask]").forEach(btn => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.deltask));
  });
}

window.createTask = async function () {
  const statusEl = document.getElementById("taskFormStatus");

  const title = document.getElementById("taskTitleInput").value.trim();
  const assigneeUid = taskAssigneeSelect?.value;
  const priority = document.getElementById("taskPriorityInput").value;
  const dueDate = document.getElementById("taskDueDateInput").value;
  const description = document.getElementById("taskDescriptionInput").value.trim();

  if (!title || !assigneeUid) {
    statusEl.textContent = "Please enter a title and select an employee.";
    return;
  }

  const employees = await loadEmployees();
  const assignee = employees.find(e => e.uid === assigneeUid);

  try {
    await addDoc(collection(db, "tasks"), {
      title,
      description,
      priority,
      dueDate,
      status: "Pending",
      assignedTo: assignee ? { uid: assignee.uid, name: assignee.name } : null,
      createdAt: serverTimestamp()
    });

    logActivity("Assigned task", `title=${title}, assignedTo=${assignee?.name || "-"}, priority=${priority}`);
    statusEl.textContent = "Task assigned.";

    document.getElementById("taskTitleInput").value = "";
    document.getElementById("taskDescriptionInput").value = "";
    document.getElementById("taskDueDateInput").value = "";
    taskAssigneeSelect.value = "";
  } catch (err) {
    statusEl.textContent = "Failed to assign task: " + err.message;
  }
};

async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;
  try {
    await deleteDoc(doc(db, "tasks", id));
    logActivity("Deleted task", `id=${id}`);
  } catch (err) {
    alert("Failed to delete: " + err.message);
  }
}

if (taskSearchInput) taskSearchInput.addEventListener("input", render);
if (taskStatusFilter) taskStatusFilter.addEventListener("change", render);

loadEmployees();

if (taskTable) {
  onSnapshot(collection(db, "tasks"), (snap) => {
    allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    render();
  }, () => {
    taskTable.innerHTML = `<tr><td colspan="6">Could not load tasks.</td></tr>`;
  });
}
