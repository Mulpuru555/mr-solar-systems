import { auth, db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Records an admin action to the auditLogs collection.
 * Fails silently — logging should never block or break the action it's recording.
 */
export async function logActivity(action, details) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, "auditLogs"), {
      action,
      details: details || "",
      performedBy: user ? user.uid : "unknown",
      performedByEmail: user ? user.email : "unknown",
      timestamp: serverTimestamp()
    });
  } catch (err) {
    // Never let logging failures interrupt the admin's actual action.
    console.warn("Audit log write failed:", err.message);
  }
}
