import { db } from "./firebase-config.js";

import { logActivity } from "./audit-log.js";

import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ==========================================================
   COMPANY SETTINGS
========================================================== */

async function loadCompanySettings() {
  const nameInput = document.getElementById("companyNameInput");
  if (!nameInput) return;

  try {
    const snap = await getDoc(doc(db, "settings", "company"));
    if (snap.exists()) {
      const data = snap.data();
      nameInput.value = data.name || "";
      document.getElementById("companyPhoneInput").value = data.phone || "";
      document.getElementById("companyEmailInput").value = data.email || "";
      document.getElementById("companyAddressInput").value = data.address || "";
    }
  } catch (err) {
    // leave fields blank if this fails
  }
}

window.saveCompanySettings = async function () {
  const statusEl = document.getElementById("companySettingsStatus");

  const name = document.getElementById("companyNameInput").value.trim();
  const phone = document.getElementById("companyPhoneInput").value.trim();
  const email = document.getElementById("companyEmailInput").value.trim();
  const address = document.getElementById("companyAddressInput").value.trim();

  try {
    await setDoc(doc(db, "settings", "company"), { name, phone, email, address }, { merge: true });
    statusEl.textContent = "Company settings saved.";
    logActivity("Updated company settings", `name=${name}`);
  } catch (err) {
    statusEl.textContent = "Failed to save: " + err.message;
  }
};

/* ==========================================================
   BACKUP & EXPORT
========================================================== */

window.exportAllData = async function () {
  const statusEl = document.getElementById("backupStatus");
  statusEl.textContent = "Preparing export…";

  try {
    const collections = ["users", "customerPayments", "attendance", "leaveRequests", "notices"];
    const snapshot = {};

    for (const name of collections) {
      const snap = await getDocs(collection(db, name));
      snapshot[name] = [];
      snap.forEach(d => snapshot[name].push({ id: d.id, ...d.data() }));
    }

    snapshot.exportedAt = new Date().toISOString();

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mr-solar-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();

    statusEl.textContent = "Export downloaded.";
    logActivity("Exported full data backup", collections.join(", "));
  } catch (err) {
    statusEl.textContent = "Export failed: " + err.message;
  }
};

/* Scheduled-backup preference — saved for reference, but does not itself
   trigger any automated backup. Actually running scheduled backups needs
   a server-side job (e.g. a Cloud Function on a timer), which a static
   site can't do on its own. */

async function loadBackupPreference() {
  const enabledInput = document.getElementById("backupEnabledInput");
  if (!enabledInput) return;

  try {
    const snap = await getDoc(doc(db, "settings", "backup"));
    if (snap.exists()) {
      const data = snap.data();
      enabledInput.checked = !!data.enabled;
      document.getElementById("backupFrequencyInput").value = data.frequency || "daily";
    }
  } catch (err) {
    // leave defaults
  }
}

async function saveBackupPreference() {
  const enabled = document.getElementById("backupEnabledInput").checked;
  const frequency = document.getElementById("backupFrequencyInput").value;
  const statusEl = document.getElementById("backupScheduleStatus");

  try {
    await setDoc(doc(db, "settings", "backup"), { enabled, frequency }, { merge: true });
    statusEl.textContent = enabled
      ? `Preference saved (${frequency}). Note: this does not run automatically yet — that needs a server-side job.`
      : "Scheduled backups disabled.";
  } catch (err) {
    statusEl.textContent = "Failed to save preference: " + err.message;
  }
}

const backupEnabledInput = document.getElementById("backupEnabledInput");
const backupFrequencyInput = document.getElementById("backupFrequencyInput");
if (backupEnabledInput && backupFrequencyInput) {
  backupEnabledInput.addEventListener("change", saveBackupPreference);
  backupFrequencyInput.addEventListener("change", saveBackupPreference);
}

loadCompanySettings();
loadBackupPreference();
