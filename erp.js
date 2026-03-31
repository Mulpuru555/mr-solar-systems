import { auth, db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let uid = "";
let records = [];
let editID = "";

/* ================= AUTH ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  uid = user.uid;
  await loadRecords();
});

/* ================= ADD ================= */
const form = document.getElementById("paymentForm");

if (form) {
  form.onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById("customerName").value.trim();
    const exec = document.getElementById("executiveName").value.trim();
    const total = Number(document.getElementById("totalAmount").value) || 0;

    if (!name || !exec || total <= 0) {
      alert("Please fill all fields correctly");
      return;
    }

    try {
      const submitBtn = form.querySelector("button[type='submit']");
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Adding...";
      submitBtn.disabled = true;

      await addDoc(collection(db, "customerPayments"), {
        customerName: name,
        executiveName: exec,
        totalAmount: total,
        createdBy: uid,
        payments: [],
        status: "Pending",
        isLocked: true,
        createdAt: serverTimestamp()
      });

      form.reset();
      await loadRecords();
      alert("✅ Payment added successfully!");
      
    } catch (error) {
      console.error("Add error:", error);
      alert("❌ Failed to add payment");
    } finally {
      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.textContent = "Add Payment";
      submitBtn.disabled = false;
    }
  };
}

/* ================= LOAD ================= */
async function loadRecords() {
  try {
    records = [];

    const table = document.getElementById("recordsTable");
    if (!table) return;

    table.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px">Loading records...</td></tr>';

    const q = query(
      collection(db, "customerPayments"),
      where("createdBy", "==", uid)
    );

    const snap = await getDocs(q);

    snap.forEach(d => {
      records.push({
        id: d.id,
        data: d.data()
      });
    });

    records.sort((a, b) => {
      const t1 = a.data.createdAt?.seconds || 0;
      const t2 = b.data.createdAt?.seconds || 0;
      return t2 - t1;
    });

    showTable(records);
    
    // 🔥 FIXED: UPDATE GLOBAL INSIDE loadRecords()
    window.erpRecords = records;
    
  } catch (error) {
    console.error("Load records error:", error);
    const table = document.getElementById("recordsTable");
    if (table) {
      table.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#ef4444">Failed to load records</td></tr>';
    }
  }
}

/* ================= SHOW TABLE - FIXED EVENT ✅ ================= */
function showTable(list) {
  const table = document.getElementById("recordsTable");
  if (!table) return;

  table.innerHTML = "";

  if (list.length === 0) {
    table.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8">No records found</td></tr>';
    return;
  }

  let i = 1;
  list.forEach(obj => {
    const d = obj.data;
    const totalAmount = d.totalAmount ?? d.total ?? 0;

    let paid = 0;
    (d.payments || []).forEach(p => {
      paid += Number(p.amount) || 0;
    });

    const date = d.createdAt?.seconds 
      ? new Date(d.createdAt.seconds * 1000).toLocaleDateString('en-IN')
      : "-";

    const statusBadge = {
      "Pending": '<span class="status pending">Pending</span>',
      "Paid": '<span class="status paid">Paid</span>',
      "Partial": '<span class="status partial">Partial</span>'
    }[d.status] || '<span class="status unknown">Unknown</span>';

    const locked = d.isLocked !== false;
    const lockIcon = locked ? "🔒" : "🔓";
    const editBtn = locked 
      ? `<span class="locked">${lockIcon} Locked</span>`
      : `<button class="edit-btn" data-id="${obj.id}">✏️ Edit</button>`;

    table.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${i++}</td>
        <td>${d.customerName || '-'}</td>
        <td>${d.executiveName || '-'}</td>
        <td class="amount">₹${totalAmount.toLocaleString()}</td>
        <td class="amount">₹${paid.toLocaleString()}</td>
        <td>${statusBadge}</td>
        <td>${date}</td>
        <td>${lockIcon}</td>
        <td>${editBtn}</td>
      </tr>
    `);
  });

  /* 🔥 FIXED: onclick = SINGLE HANDLER (No duplication!) */
  table.onclick = (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const id = e.target.dataset.id;
      const rec = records.find(r => r.id === id);
      if (rec) {
        const d = rec.data;
        openEdit(
          id,
          d.customerName || '',
          d.executiveName || '',
          d.totalAmount ?? d.total ?? 0
        );
      }
    }
  };
}

/* ================= SEARCH - SAFE ✅ ================= */
const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.oninput = () => {
    const v = searchInput.value.toLowerCase().trim();

    const filtered = records.filter(r => {
      const d = r.data;
      return (
        (d.customerName || "").toLowerCase().includes(v) ||
        (d.executiveName || "").toLowerCase().includes(v) ||
        (d.status || "").toLowerCase().includes(v)
      );
    });

    showTable(filtered);
  };
}

/* ================= EDIT ================= */
window.openEdit = (id, name, exec, total) => {
  editID = id;

  const editNameEl = document.getElementById("editName");
  const editExecEl = document.getElementById("editExec");
  const editTotalEl = document.getElementById("editTotal");
  const popupEl = document.getElementById("editPopup");

  if (editNameEl) editNameEl.value = name || '';
  if (editExecEl) editExecEl.value = exec || '';
  if (editTotalEl) editTotalEl.value = total || '';
  if (popupEl) popupEl.style.display = "flex";
};

window.closePopup = () => {
  const popupEl = document.getElementById("editPopup");
  if (popupEl) popupEl.style.display = "none";
};

/* 🔥 SAFE SAVE BUTTON */
const saveBtn = document.getElementById("saveEditBtn");
if (saveBtn) {
  saveBtn.onclick = async () => {
    if (!editID) {
      alert("No record selected");
      return;
    }

    const editNameEl = document.getElementById("editName");
    const editExecEl = document.getElementById("editExec");
    const editTotalEl = document.getElementById("editTotal");

    if (!editNameEl || !editExecEl || !editTotalEl) return;

    const name = editNameEl.value.trim();
    const exec = editExecEl.value.trim();
    const total = Number(editTotalEl.value) || 0;

    if (!name || !exec || total <= 0) {
      alert("Please fill all fields correctly");
      return;
    }

    try {
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;

      const ref = doc(db, "customerPayments", editID);
      await updateDoc(ref, {
        customerName: name,
        executiveName: exec,
        totalAmount: total
      });

      closePopup();
      await loadRecords();
      alert("✅ Record updated successfully!");
      
    } catch (error) {
      console.error("Update error:", error);
      alert("❌ Failed to update record");
    } finally {
      saveBtn.textContent = "Save Changes";
      saveBtn.disabled = false;
    }
  };
}

/* 🔥 EXPOSE FUNCTIONS */
window.erpRecords = records;
window.loadRecords = loadRecords;
