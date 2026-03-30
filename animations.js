// Smooth section fade

window.toggleSection = function(id) {

    document.querySelectorAll(".section").forEach(sec => {
        sec.style.display = "none";
    });

    const el = document.getElementById(id);
    el.style.display = "block";
    el.style.opacity = 0;

    setTimeout(() => {
        el.style.transition = "0.4s";
        el.style.opacity = 1;
    }, 50);
};


// Loading screen

window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loadingScreen").style.display = "none";
    }, 1000);
});
