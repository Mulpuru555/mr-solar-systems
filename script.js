/* ==============================
   WHATSAPP BUTTON FUNCTION
============================== */

function openWhatsApp() {
    window.open("https://wa.me/919154777773", "_blank");
}


/* ==============================
   SMOOTH SCROLL FOR NAVIGATION
============================== */

function scrollToSection(id) {
    const section = document.getElementById(id);
    if (section) {
        section.scrollIntoView({
            behavior: "smooth"
        });
    }
}


/* ==============================
   SOLAR SAVINGS CALCULATOR
============================== */

function calculateSavings() {

    let bill = document.getElementById("billInput").value;

    if (bill === "" || bill <= 0) {
        alert("Please enter valid electricity bill amount");
        return;
    }

    let yearlyBill = bill * 12;
    let estimatedSavings = yearlyBill * 0.80;

    document.getElementById("result").innerHTML =
        "Estimated Yearly Savings: ₹" + estimatedSavings.toFixed(0);
}


/* ==============================
   STICKY NAVBAR ON SCROLL
============================== */

window.addEventListener("scroll", function () {
    const nav = document.querySelector("nav");

    if (!nav) return;

    if (window.scrollY > 100) {
        nav.style.position = "fixed";
        nav.style.top = "0";
        nav.style.width = "100%";
        nav.style.zIndex = "1000";
    } else {
        nav.style.position = "static";
    }
});


/* ==============================
   SIMPLE FADE-IN ANIMATION
============================== */

document.addEventListener("DOMContentLoaded", function () {

    const elements = document.querySelectorAll(".section, .card");

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }
        });
    });

    elements.forEach(el => {
        el.style.opacity = "0";
        el.style.transform = "translateY(40px)";
        el.style.transition = "all 0.6s ease";
        observer.observe(el);
    });

});
