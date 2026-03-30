// ===== SECTION SWITCH =====

window.toggleSection = function(id) {

    document.querySelectorAll(".section").forEach(sec => {
        sec.style.display = "none";
    });

    document.querySelectorAll(".card").forEach(c => {
        c.classList.remove("activeCard");
    });

    const el = document.getElementById(id);
    el.style.display = "block";
    el.style.opacity = 0;

    setTimeout(() => {
        el.style.transition = "0.4s";
        el.style.opacity = 1;
    }, 50);

    event.target.classList.add("activeCard");
};


// ===== LOADING =====

window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loadingScreen").style.display = "none";
    }, 1000);
});


// ===== COUNT ANIMATION =====

function animateValue(id, start, end, duration) {
    let range = end - start;
    let stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    let increment = end > start ? 1 : -1;

    let timer = setInterval(() => {
        current += increment;
        document.getElementById(id).innerText = current;

        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}


// ===== APPLY ANIMATION AFTER LOAD =====

setTimeout(() => {
    animateValue("todayStat", 0, parseInt(document.getElementById("todayStat").innerText || 0), 500);
    animateValue("totalStat", 0, parseInt(document.getElementById("totalStat").innerText || 0), 800);
}, 1200);


// ===== STREAK SYSTEM =====

function calculateStreak() {

    const history = JSON.parse(localStorage.getItem("attendanceHistory") || "[]");

    let streak = 0;
    let today = new Date();

    for (let i = history.length - 1; i >= 0; i--) {

        let d = new Date(history[i].date);
        let diff = (today - d) / (1000 * 60 * 60 * 24);

        if (diff <= 1.5) {
            streak++;
            today = d;
        } else {
            break;
        }
    }

    document.getElementById("streakCount").innerText = streak;
}

setTimeout(calculateStreak, 1500);
