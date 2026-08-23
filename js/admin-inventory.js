import { db } from "./firebase-config.js";
import { logActivity } from "./audit-log.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let inventoryList = [];
let purchaseList = [];

const inventoryTable = document.getElementById("inventoryTable");
const invSearchInput = document.getElementById("invSearchInput");
const invFilterCategory = document.getElementById("invFilterCategory");
const invFilterStockStatus = document.getElementById("invFilterStockStatus");
const invSaveBtn = document.getElementById("invSaveBtn");
const invFormStatus = document.getElementById("invFormStatus");
const invExportCsvBtn = document.getElementById("invExportCsvBtn");
const invExportXlsxBtn = document.getElementById("invExportXlsxBtn");

const purchaseItemSelect = document.getElementById("purchaseItemSelect");
const recordPurchaseBtn = document.getElementById("recordPurchaseBtn");
const purchaseRecordsTable = document.getElementById("purchaseRecordsTable");
const purchaseFormStatus = document.getElementById("purchaseFormStatus");

/* ==========================================================
   RENDER INVENTORY TABLE & PURCHASE SELECT
========================================================== */

function renderInventoryTable() {
  if (!inventoryTable) return;

  const search = (invSearchInput?.value || "").toLowerCase().trim();
  const catFilter = invFilterCategory?.value || "";
  const statusFilter = invFilterStockStatus?.value || "";

  const filtered = inventoryList.filter(item => {
    const name = (item.name || "").toLowerCase();
    const cat = item.category || "";
    const sku = (item.sku || "").toLowerCase();
    const qty = Number(item.quantity) || 0;
    const threshold = Number(item.lowStockThreshold) || 0;

    let itemStatus = "in_stock";
    if (qty === 0) itemStatus = "out_of_stock";
    else if (qty <= threshold) itemStatus = "low_stock";

    if (search && !name.includes(search) && !sku.includes(search) && !cat.toLowerCase().includes(search)) {
      return false;
    }
    if (catFilter && cat !== catFilter) return false;
    if (statusFilter && itemStatus !== statusFilter) return false;

    return true;
  });

  if (filtered.length === 0) {
    inventoryTable.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#8a97a6;padding:16px;">No inventory items found matching filters.</td></tr>`;
  } else {
    inventoryTable.innerHTML = filtered.map(item => {
      const qty = Number(item.quantity) || 0;
      const threshold = Number(item.lowStockThreshold) || 0;
      const unit = item.unit || "pcs";
      const sku = item.sku || "-";
      const cat = item.category || "General";

      let statusBadge = "";
      if (qty === 0) {
        statusBadge = `<span style="color:#ef4444;font-weight:700;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);padding:3px 10px;border-radius:12px;font-size:12px;">Out of Stock</span>`;
      } else if (qty <= threshold) {
        statusBadge = `<span style="color:#f59e0b;font-weight:700;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);padding:3px 10px;border-radius:12px;font-size:12px;">Low Stock</span>`;
      } else {
        statusBadge = `<span style="color:#22c55e;font-weight:700;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);padding:3px 10px;border-radius:12px;font-size:12px;">In Stock</span>`;
      }

      let updatedDate = "-";
      if (item.updatedAt?.seconds) {
        updatedDate = new Date(item.updatedAt.seconds * 1000).toLocaleDateString("en-IN");
      } else if (item.createdAt?.seconds) {
        updatedDate = new Date(item.createdAt.seconds * 1000).toLocaleDateString("en-IN");
      }

      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td><span style="color:#38bdf8;font-weight:600;">${escapeHtml(cat)}</span></td>
          <td><code>${escapeHtml(sku)}</code></td>
          <td><strong style="font-size:15px;color:#22c55e;">${qty}</strong></td>
          <td>${escapeHtml(unit)}</td>
          <td><span style="color:#94a3b8;">${threshold}</span></td>
          <td>${statusBadge}</td>
          <td><span style="font-size:12px;color:#94a3b8;">${updatedDate}</span></td>
          <td>
            <button class="action addStockBtn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" style="background:#0284c7;padding:4px 10px;font-size:11px;margin-right:4px;">+ Add Stock</button>
            <button class="action editItemBtn" data-id="${item.id}" style="background:#475569;padding:4px 8px;font-size:11px;margin-right:4px;">Edit</button>
            <button class="action deleteItemBtn" data-id="${item.id}" data-name="${escapeHtml(item.name)}" style="background:#ef4444;padding:4px 8px;font-size:11px;">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    inventoryTable.querySelectorAll(".addStockBtn").forEach(btn => {
      btn.onclick = () => handleAddStock(btn.dataset.id, btn.dataset.name);
    });

    inventoryTable.querySelectorAll(".editItemBtn").forEach(btn => {
      btn.onclick = () => handleEditItem(btn.dataset.id);
    });

    inventoryTable.querySelectorAll(".deleteItemBtn").forEach(btn => {
      btn.onclick = () => handleDeleteItem(btn.dataset.id, btn.dataset.name);
    });
  }

  updateStockMetrics();
  updatePurchaseSelect();
}

function updatePurchaseSelect() {
  if (!purchaseItemSelect) return;
  const currentVal = purchaseItemSelect.value;
  purchaseItemSelect.innerHTML = `<option value="">Select inventory item to purchase...</option>` +
    inventoryList.map(i => `<option value="${i.id}">${escapeHtml(i.name)} (Available stock: ${i.quantity ?? 0} ${escapeHtml(i.unit || "pcs")})</option>`).join("");
  if (currentVal) purchaseItemSelect.value = currentVal;
}

/* ==========================================================
   UPDATE SUMMARY METRICS & WIDGETS
========================================================== */

function updateStockMetrics() {
  const totalItemsEl = document.getElementById("invSummaryTotalItems");
  const totalUnitsEl = document.getElementById("invSummaryTotalUnits");
  const lowStockEl = document.getElementById("invSummaryLowStock");
  const outOfStockEl = document.getElementById("invSummaryOutOfStock");
  const widgetLowStockEl = document.getElementById("widgetLowStockCount");

  let totalUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  inventoryList.forEach(item => {
    const qty = Number(item.quantity) || 0;
    const threshold = Number(item.lowStockThreshold) || 0;
    totalUnits += qty;
    if (qty === 0) {
      outOfStockCount++;
      lowStockCount++;
    } else if (qty <= threshold) {
      lowStockCount++;
    }
  });

  if (totalItemsEl) totalItemsEl.textContent = inventoryList.length;
  if (totalUnitsEl) totalUnitsEl.textContent = totalUnits.toLocaleString();
  if (lowStockEl) lowStockEl.textContent = lowStockCount;
  if (outOfStockEl) outOfStockEl.textContent = outOfStockCount;
  if (widgetLowStockEl) widgetLowStockEl.textContent = lowStockCount;
}

/* ==========================================================
   ADD STOCK QUICK ACTION
========================================================== */

async function handleAddStock(itemId, itemName) {
  const item = inventoryList.find(i => i.id === itemId);
  if (!item) return;

  const currentQty = Number(item.quantity) || 0;
  const input = prompt(`Add stock to "${itemName}"\nCurrent quantity: ${currentQty} ${item.unit || "pcs"}\nEnter quantity to add:`);
  if (!input) return;

  const addQty = Number(input.trim());
  if (isNaN(addQty) || addQty <= 0) {
    alert("Please enter a valid positive number.");
    return;
  }

  try {
    const newQty = currentQty + addQty;
    await updateDoc(doc(db, "inventory", itemId), {
      quantity: increment(addQty),
      updatedAt: serverTimestamp()
    });

    // Also record purchase movement
    await addDoc(collection(db, "purchaseRecords"), {
      itemId,
      itemName,
      quantity: addQty,
      vendorName: "Direct Stock Inward",
      unitPrice: 0,
      invoiceNumber: `INW-${Date.now().toString().slice(-4)}`,
      purchaseDate: new Date().toISOString().split("T")[0],
      createdAt: serverTimestamp()
    });

    logActivity("Admin added stock", `item=${itemName}, added=${addQty}, new_total=${newQty}`);
    alert(`Successfully added ${addQty} ${item.unit || "pcs"} to "${itemName}". Available stock is now ${newQty} ${item.unit || "pcs"}.`);
  } catch (err) {
    alert("Failed to add stock: " + err.message);
  }
}

/* ==========================================================
   EDIT ITEM ACTION
========================================================== */

async function handleEditItem(itemId) {
  const item = inventoryList.find(i => i.id === itemId);
  if (!item) return;

  const newQtyStr = prompt(`Update available stock quantity for "${item.name}":`, item.quantity ?? 0);
  if (newQtyStr === null) return;
  const newQty = Number(newQtyStr.trim());
  if (isNaN(newQty) || newQty < 0) {
    alert("Please enter a valid non-negative quantity.");
    return;
  }

  const newThresholdStr = prompt(`Update low stock alert threshold for "${item.name}":`, item.lowStockThreshold ?? 5);
  if (newThresholdStr === null) return;
  const newThreshold = Number(newThresholdStr.trim());

  try {
    await updateDoc(doc(db, "inventory", itemId), {
      quantity: newQty,
      lowStockThreshold: isNaN(newThreshold) ? 5 : newThreshold,
      updatedAt: serverTimestamp()
    });

    logActivity("Admin edited inventory item", `item=${item.name}, quantity=${newQty}, threshold=${newThreshold}`);
    alert(`Updated "${item.name}" stock quantity to ${newQty}.`);
  } catch (err) {
    alert("Failed to update item: " + err.message);
  }
}

/* ==========================================================
   DELETE ITEM ACTION
========================================================== */

async function handleDeleteItem(itemId, itemName) {
  if (!confirm(`Are you sure you want to delete inventory item "${itemName}"? This cannot be undone.`)) return;

  try {
    await deleteDoc(doc(db, "inventory", itemId));
    logActivity("Admin deleted inventory item", `item=${itemName}, id=${itemId}`);
  } catch (err) {
    alert("Failed to delete inventory item: " + err.message);
  }
}

/* ==========================================================
   SAVE / CREATE INVENTORY ITEM
========================================================== */

if (invSaveBtn) {
  invSaveBtn.addEventListener("click", async () => {
    const name = document.getElementById("invItemName")?.value.trim();
    const category = document.getElementById("invCategory")?.value || "Panel";
    const sku = document.getElementById("invSku")?.value.trim() || "";
    const quantity = Number(document.getElementById("invQuantity")?.value) || 0;
    const unit = document.getElementById("invUnit")?.value.trim() || "pcs";
    const lowStockThreshold = Number(document.getElementById("invLowStockThreshold")?.value) || 5;

    if (!name) {
      if (invFormStatus) {
        invFormStatus.innerHTML = `<span style="color:#ef4444;">Please enter an item name.</span>`;
      }
      return;
    }

    try {
      if (invFormStatus) {
        invFormStatus.innerHTML = `<span style="color:#38bdf8;">Saving item to database...</span>`;
      }

      const existing = inventoryList.find(i =>
        i.name.toLowerCase() === name.toLowerCase() ||
        (sku && i.sku && i.sku.toLowerCase() === sku.toLowerCase())
      );

      if (existing) {
        const newTotal = (Number(existing.quantity) || 0) + quantity;
        await updateDoc(doc(db, "inventory", existing.id), {
          quantity: newTotal,
          category,
          unit,
          lowStockThreshold,
          updatedAt: serverTimestamp()
        });
        logActivity("Admin updated existing inventory", `item=${name}, new_quantity=${newTotal}`);
        if (invFormStatus) {
          invFormStatus.innerHTML = `<span style="color:#22c55e;">Existing item updated! New available stock: ${newTotal} ${unit}.</span>`;
        }
      } else {
        await addDoc(collection(db, "inventory"), {
          name,
          category,
          sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
          quantity,
          unit,
          lowStockThreshold,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        logActivity("Admin added new inventory item", `item=${name}, quantity=${quantity}, category=${category}`);
        if (invFormStatus) {
          invFormStatus.innerHTML = `<span style="color:#22c55e;">Inventory item "${name}" saved successfully with ${quantity} ${unit}.</span>`;
        }
      }

      document.getElementById("invItemName").value = "";
      document.getElementById("invSku").value = "";
      document.getElementById("invQuantity").value = "";
      document.getElementById("invLowStockThreshold").value = "";

      setTimeout(() => {
        if (invFormStatus) invFormStatus.innerHTML = "";
      }, 4000);
    } catch (err) {
      if (invFormStatus) {
        invFormStatus.innerHTML = `<span style="color:#ef4444;">Error saving item: ${err.message}</span>`;
      }
    }
  });
}

/* ==========================================================
   RECORD PURCHASE (INWARD STOCK)
========================================================== */

if (recordPurchaseBtn) {
  recordPurchaseBtn.addEventListener("click", async () => {
    const itemId = purchaseItemSelect?.value;
    const quantity = Number(document.getElementById("purchaseQuantity")?.value);
    const vendorName = document.getElementById("purchaseVendor")?.value.trim() || "General Supplier";
    const unitPrice = Number(document.getElementById("purchaseUnitPrice")?.value) || 0;
    const invoiceNumber = document.getElementById("purchaseInvoiceNumber")?.value.trim() || `INV-${Date.now().toString().slice(-4)}`;
    const purchaseDate = document.getElementById("purchaseDate")?.value || new Date().toISOString().split("T")[0];

    if (!itemId) {
      if (purchaseFormStatus) purchaseFormStatus.innerHTML = `<span style="color:#ef4444;">Please select an inventory item.</span>`;
      return;
    }

    if (!quantity || quantity <= 0) {
      if (purchaseFormStatus) purchaseFormStatus.innerHTML = `<span style="color:#ef4444;">Please enter a valid quantity.</span>`;
      return;
    }

    const item = inventoryList.find(i => i.id === itemId);
    if (!item) return;

    try {
      if (purchaseFormStatus) purchaseFormStatus.innerHTML = `<span style="color:#38bdf8;">Recording purchase and updating available stock...</span>`;

      // 1. Add purchase record
      await addDoc(collection(db, "purchaseRecords"), {
        itemId,
        itemName: item.name,
        category: item.category || "Panel",
        vendorName,
        quantity,
        unitPrice,
        invoiceNumber,
        purchaseDate,
        createdAt: serverTimestamp()
      });

      // 2. Increment stock quantity in inventory
      await updateDoc(doc(db, "inventory", itemId), {
        quantity: increment(quantity),
        updatedAt: serverTimestamp()
      });

      const updatedQty = (Number(item.quantity) || 0) + quantity;
      logActivity("Admin recorded purchase", `item=${item.name}, quantity=+${quantity}, new_stock=${updatedQty}, invoice=${invoiceNumber}`);

      if (purchaseFormStatus) {
        purchaseFormStatus.innerHTML = `<span style="color:#22c55e;">Purchase recorded! Added ${quantity} ${item.unit || "pcs"} to "${item.name}". Available stock is now ${updatedQty} ${item.unit || "pcs"}.</span>`;
      }

      document.getElementById("purchaseQuantity").value = "";
      document.getElementById("purchaseVendor").value = "";
      document.getElementById("purchaseUnitPrice").value = "";
      document.getElementById("purchaseInvoiceNumber").value = "";

      setTimeout(() => {
        if (purchaseFormStatus) purchaseFormStatus.innerHTML = "";
      }, 5000);
    } catch (err) {
      if (purchaseFormStatus) {
        purchaseFormStatus.innerHTML = `<span style="color:#ef4444;">Error recording purchase: ${err.message}</span>`;
      }
    }
  });
}

/* ==========================================================
   RENDER PURCHASE RECORDS TABLE
========================================================== */

function renderPurchaseRecordsTable() {
  if (!purchaseRecordsTable) return;

  if (purchaseList.length === 0) {
    purchaseRecordsTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#8a97a6;padding:16px;">No purchase records recorded yet.</td></tr>`;
    return;
  }

  purchaseRecordsTable.innerHTML = purchaseList.map(p => {
    const qty = Number(p.quantity) || 0;
    const unitPrice = Number(p.unitPrice) || 0;
    const total = qty * unitPrice;
    return `
      <tr>
        <td><strong>${escapeHtml(p.itemName)}</strong></td>
        <td>${escapeHtml(p.vendorName || "-")}</td>
        <td><strong style="color:#22c55e;">+${qty}</strong></td>
        <td>₹${unitPrice.toLocaleString()}</td>
        <td><strong style="color:#38bdf8;">₹${total.toLocaleString()}</strong></td>
        <td><code>${escapeHtml(p.invoiceNumber || "-")}</code></td>
        <td><span style="font-size:12px;color:#94a3b8;">${escapeHtml(p.purchaseDate || "-")}</span></td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================
   EXPORTS (CSV & EXCEL)
========================================================== */

function buildInventoryExportRows() {
  return inventoryList.map(item => {
    const qty = Number(item.quantity) || 0;
    const threshold = Number(item.lowStockThreshold) || 0;
    let status = "In Stock";
    if (qty === 0) status = "Out of Stock";
    else if (qty <= threshold) status = "Low Stock";

    let dateStr = "-";
    if (item.updatedAt?.seconds) {
      dateStr = new Date(item.updatedAt.seconds * 1000).toLocaleDateString("en-IN");
    } else if (item.createdAt?.seconds) {
      dateStr = new Date(item.createdAt.seconds * 1000).toLocaleDateString("en-IN");
    }

    return {
      "Item Name": item.name || "",
      "Category": item.category || "",
      "SKU / Code": item.sku || "",
      "Available Stock (Quantity)": qty,
      "Unit": item.unit || "pcs",
      "Low Stock Threshold": threshold,
      "Stock Status": status,
      "Last Updated": dateStr
    };
  });
}

if (invExportCsvBtn) {
  invExportCsvBtn.addEventListener("click", () => {
    const rows = buildInventoryExportRows();
    if (rows.length === 0) {
      alert("No inventory records to export.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map(row => headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MR_Solar_Inventory_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  });
}

if (invExportXlsxBtn) {
  invExportXlsxBtn.addEventListener("click", () => {
    const rows = buildInventoryExportRows();
    if (rows.length === 0) {
      alert("No inventory records to export.");
      return;
    }

    if (typeof XLSX === "undefined") {
      if (invExportCsvBtn) invExportCsvBtn.click();
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Stock");
    XLSX.writeFile(wb, `MR_Solar_Inventory_${new Date().toISOString().split("T")[0]}.xlsx`);
  });
}

/* Search and filters */
if (invSearchInput) invSearchInput.addEventListener("input", renderInventoryTable);
if (invFilterCategory) invFilterCategory.addEventListener("change", renderInventoryTable);
if (invFilterStockStatus) invFilterStockStatus.addEventListener("change", renderInventoryTable);

/* ==========================================================
   REALTIME INITIALIZATION
========================================================== */

function initInventoryListener() {
  // Realtime Inventory
  onSnapshot(collection(db, "inventory"), (snap) => {
    inventoryList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    inventoryList.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderInventoryTable();
  });

  // Realtime Purchase Records
  onSnapshot(query(collection(db, "purchaseRecords"), orderBy("createdAt", "desc")), (snap) => {
    purchaseList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPurchaseRecordsTable();
  }, () => {
    // Fallback without orderBy
    onSnapshot(collection(db, "purchaseRecords"), (snap) => {
      purchaseList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      purchaseList.sort((a, b) => String(b.purchaseDate || "").localeCompare(String(a.purchaseDate || "")));
      renderPurchaseRecordsTable();
    });
  });
}

initInventoryListener();
