import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function isValidMobile(value) {
  const cleaned = (value || "").replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(cleaned) || /^\d{10}$/.test(cleaned);
}

function markInvalid(el, invalid) {
  if (!el) return;
  el.classList.toggle("field-invalid", invalid);
  if (invalid) {
    el.focus();
  }
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = "leadFormMsg show " + type;
}

function clearMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "leadFormMsg";
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="leadSpinner"></span>Submitting...` : label;
}

async function submitLead({ name, mobile, location, type, serviceType }) {
  const cleanMobile = mobile.replace(/\D/g, "");

  // Write to websiteLeads collection for Admin
  await addDoc(collection(db, "websiteLeads"), {
    name,
    mobile: cleanMobile,
    location,
    type,               // "Site Visit" | "Service Request"
    serviceType: serviceType || null,
    status: "New",
    createdAt: serverTimestamp()
  });

  // If Service Request, also write to serviceRequests collection so Manager & Employees see it instantly
  if (type === "Service Request") {
    try {
      await addDoc(collection(db, "serviceRequests"), {
        customerName: name,
        phone: cleanMobile,
        location: location,
        serviceType: serviceType || "Service",
        issueDescription: `Website lead: ${serviceType || "Service"} requested at ${location}`,
        status: "Open",
        createdByName: "Website Public Form",
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Dual write to serviceRequests:", e);
    }
  }
}

function openWhatsAppFallback({ name, mobile, location, serviceType }) {
  const cleanMobile = mobile.replace(/\D/g, "");
  const message =
`Hello M.R Solar Systems,
I am ${name} from ${location}.
${serviceType ? `I am interested in ${serviceType}.` : "I'd like to book a free solar site visit."}
Please share subsidy & pricing details.
Mobile: ${cleanMobile}`;

  window.open("https://wa.me/919154777773?text=" + encodeURIComponent(message));
}

/* ==========================================================
   SERVICE REQUEST FORM (Inline Form in #service section)
========================================================== */

const serviceForm = document.getElementById("serviceRequestPublicForm");

if (serviceForm) {
  serviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("name");
    const mobileEl = document.getElementById("mobile");
    const locationEl = document.getElementById("locationInput");
    const serviceTypeEl = document.getElementById("serviceType");
    const msgEl = document.getElementById("serviceFormMsg");
    const btn = document.getElementById("serviceSubmitBtn");

    const name = nameEl?.value.trim() || "";
    const mobile = mobileEl?.value.trim() || "";
    const location = locationEl?.value.trim() || "";
    const serviceType = serviceTypeEl?.value || "New Installation";

    const nameInvalid = name.length < 2;
    const mobileInvalid = !isValidMobile(mobile);
    const locationInvalid = location.length < 2;

    markInvalid(nameEl, nameInvalid);
    markInvalid(mobileEl, mobileInvalid);
    markInvalid(locationEl, locationInvalid);

    if (nameInvalid || mobileInvalid || locationInvalid) {
      showMsg(msgEl, "Please enter your name, valid 10-digit mobile number, and location.", "error");
      return;
    }

    clearMsg(msgEl);
    setLoading(btn, true, "Submit Request");

    try {
      await submitLead({ name, mobile, location, type: "Service Request", serviceType });
      showMsg(msgEl, "✓ Request received successfully! Our team will contact you shortly.", "success");
      serviceForm.reset();
      markInvalid(nameEl, false);
      markInvalid(mobileEl, false);
      markInvalid(locationEl, false);

      openWhatsAppFallback({ name, mobile, location, serviceType });
    } catch (err) {
      showMsg(msgEl, "Something went wrong. Please call us directly at 9154777773.", "error");
    } finally {
      setLoading(btn, false, "Submit Request");
    }
  });

  // Realtime clear validation errors on typing
  ['name', 'mobile', 'locationInput'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      e.target.classList.remove("field-invalid");
    });
  });
}

/* ==========================================================
   SITE VISIT FORM (Popup Modal Form)
========================================================== */

const siteVisitForm = document.getElementById("siteVisitForm");

if (siteVisitForm) {
  siteVisitForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameEl = document.getElementById("leadName");
    const mobileEl = document.getElementById("leadMobile");
    const locationEl = document.getElementById("leadLocation");
    const msgEl = document.getElementById("leadFormMsg");
    const btn = document.getElementById("leadSubmitBtn");

    const name = nameEl?.value.trim() || "";
    const mobile = mobileEl?.value.trim() || "";
    const location = locationEl?.value.trim() || "";

    const nameInvalid = name.length < 2;
    const mobileInvalid = !isValidMobile(mobile);
    const locationInvalid = location.length < 2;

    markInvalid(nameEl, nameInvalid);
    markInvalid(mobileEl, mobileInvalid);
    markInvalid(locationEl, locationInvalid);

    if (nameInvalid || mobileInvalid || locationInvalid) {
      showMsg(msgEl, "Please enter your name, valid 10-digit mobile number, and location.", "error");
      return;
    }

    clearMsg(msgEl);
    setLoading(btn, true, "Get Free Consultation");

    try {
      await submitLead({ name, mobile, location, type: "Site Visit" });
      showMsg(msgEl, "✓ Thank you! We will contact you to schedule your free site visit.", "success");
      siteVisitForm.reset();
      markInvalid(nameEl, false);
      markInvalid(mobileEl, false);
      markInvalid(locationEl, false);

      openWhatsAppFallback({ name, mobile, location });

      setTimeout(() => {
        const overlay = document.getElementById("leadPopupOverlay");
        if (overlay) overlay.style.display = "none";
      }, 2200);
    } catch (err) {
      showMsg(msgEl, "Something went wrong. Please call us directly at 9154777773.", "error");
    } finally {
      setLoading(btn, false, "Get Free Consultation");
    }
  });

  ['leadName', 'leadMobile', 'leadLocation'].forEach(id => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      e.target.classList.remove("field-invalid");
    });
  });
}
