const SEARCHABLE = [
  { label: "Attendance", target: "attendanceSection" },
  { label: "ERP / Payments", target: "erpSection" },
  { label: "History", target: "historySection" },
  { label: "Leave", target: "leaveSection" },
  { label: "Documents", target: "documentsSection" },
  { label: "Activity", target: "activitySection" },
  { label: "Profile", href: "profile.html" }
];

/* ---------- Quick action buttons ---------- */

document.querySelectorAll(".quickActionBtn[data-target]").forEach(btn => {
  btn.addEventListener("click", () => openSection(btn.dataset.target));
});

function openSection(targetId) {
  if (typeof window.toggleSection === "function") {
    const el = document.getElementById(targetId);
    // toggleSection() closes if already the current section, so only
    // call it when we actually need to open (or switch to) this one.
    if (!el || el.style.display !== "block") {
      window.toggleSection(targetId);
    }
    setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
}

/* ---------- Global section search ---------- */

const searchInput = document.getElementById("globalSearchInput");
const resultsPanel = document.getElementById("searchResultsPanel");

if (searchInput && resultsPanel) {

  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim().toLowerCase();

    if (!val) {
      resultsPanel.classList.remove("open");
      resultsPanel.innerHTML = "";
      return;
    }

    const matches = SEARCHABLE.filter(item => item.label.toLowerCase().includes(val));

    if (matches.length === 0) {
      resultsPanel.innerHTML = `<div>No matches</div>`;
    } else {
      resultsPanel.innerHTML = matches.map(m => `<div data-label="${m.label}">${m.label}</div>`).join("");
    }

    resultsPanel.classList.add("open");
  });

  resultsPanel.addEventListener("click", (e) => {
    const label = e.target.dataset.label;
    if (!label) return;
    const item = SEARCHABLE.find(m => m.label === label);
    if (!item) return;

    if (item.href) {
      location.href = item.href;
    } else {
      openSection(item.target);
    }

    resultsPanel.classList.remove("open");
    searchInput.value = "";
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !resultsPanel.contains(e.target)) {
      resultsPanel.classList.remove("open");
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = resultsPanel.querySelector("div[data-label]");
      if (first) first.click();
    }
  });
}
