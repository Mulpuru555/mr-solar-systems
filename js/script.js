document.addEventListener("DOMContentLoaded", function() {

// ================= COUNTER =================

function animateCounters() {
    const counters = document.querySelectorAll(".stat-box h2");

    counters.forEach(counter => {
        const target = parseInt(counter.innerText);
        let count = 0;
        const speed = target / 100;

        const update = () => {
            if (count < target) {
                count += speed;

                if (counter.closest(".warranty-box")) {
                    counter.innerText = Math.ceil(count);
                } else {
                    counter.innerText = Math.ceil(count) + "+";
                }

                requestAnimationFrame(update);
            } else {
                if (counter.closest(".warranty-box")) {
                    counter.innerText = target;
                } else {
                    counter.innerText = target + "+";
                }
            }
        };

        update();
    });
}


// ================= SCROLL FADE =================

const sections = document.querySelectorAll("section");

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("fade-section", "visible");
        }
    });
}, { threshold: 0.2 });

sections.forEach(section => {
    section.classList.add("fade-section");
    observer.observe(section);
});


// ================= EMI =================

let emiChart;

window.calculateEMI = function() {

    let P = parseFloat(document.getElementById("loanAmount").value);
    let annualRate = parseFloat(document.getElementById("interestRate").value);
    let years = parseFloat(document.getElementById("loanTenure").value);

    if (!P || !annualRate || !years) {
        document.getElementById("emiResult").innerText = "Please fill all fields.";
        return;
    }

    let R = annualRate / 12 / 100;
    let N = years * 12;

    let EMI = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
    let totalPayment = EMI * N;
    let totalInterest = totalPayment - P;

    document.getElementById("emiResult").innerText =
        "Monthly EMI: ₹" + EMI.toFixed(0);

    let ctx = document.getElementById("emiChart");

    if (emiChart) emiChart.destroy();

    emiChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Principal', 'Interest'],
            datasets: [{
                data: [P, totalInterest],
                backgroundColor: ['#0b1c2d', '#ff9800']
            }]
        }
    });
};


// ================= PAYBACK =================

window.calculatePayback = function() {

    let cost = parseFloat(document.getElementById("systemCost").value);
    let before = parseFloat(document.getElementById("beforeBill").value);
    let after = parseFloat(document.getElementById("afterBill").value);

    if (!cost || !before || !after) {
        document.getElementById("paybackResult").innerText = "Please fill all fields.";
        return;
    }

    let monthlySavings = before - after;

    if (monthlySavings <= 0) {
        document.getElementById("paybackResult").innerText =
            "Monthly savings must be greater than zero.";
        return;
    }

    let annualSavings = monthlySavings * 12;
    let payback = (cost / annualSavings).toFixed(1);

    document.getElementById("paybackResult").innerText =
        "Annual Savings: ₹" + annualSavings.toFixed(0) +
        " | Payback Period: " + payback + " Years";
};


// ================= WHATSAPP =================

function sendWhatsApp(){
const name = document.getElementById("name").value;
const mobile = document.getElementById("mobile").value;
const location = document.getElementById("locationInput").value;
const service = document.getElementById("serviceType").value;

const message =
`Hello M.R Solar Systems,
I am ${name} from ${location}.
I am interested in ${service}.
Please share subsidy & pricing details.
Mobile: ${mobile}`;

window.open("https://wa.me/919154777773?text=" + encodeURIComponent(message));
}

// ================= SMART LEAD POPUP =================

setTimeout(function () {

    const popup = document.getElementById("leadPopupOverlay");

    if (popup && !sessionStorage.getItem("leadPopupShown")) {
        popup.style.display = "flex";
        sessionStorage.setItem("leadPopupShown", "true");
    }

}, 10000);


// ================= PROJECT GALLERY SYSTEM =================

let currentGallery = [];
let currentIndex = 0;
let slideInterval;

const residentialImages = [
    "assets/images/res1.jpeg",
    "assets/images/res2.jpeg",
    "assets/images/res3.jpeg",
    "assets/images/res4.jpeg",
    "assets/images/res6.jpeg",
    "assets/images/res11.jpeg",
    "assets/images/res12.jpeg",
    "assets/images/res13.jpeg",
    "assets/images/res14.jpeg",
    "assets/images/res16.jpeg",
    "assets/images/res17.jpeg",
    "assets/images/res18.jpeg",
    "assets/images/res19.jpeg",
    "assets/images/res20.jpeg",
    "assets/images/res21.jpeg",
    "assets/images/res22.jpeg",
    "assets/images/res24.jpeg",
    "assets/images/res25.jpeg"
];

const commercialImages = [];

window.openGallery = function(type) {
    const overlay = document.getElementById("galleryOverlay");
    const image = document.getElementById("galleryImage");
    const comingSoon = document.getElementById("comingSoonText");
    const controls = document.querySelector(".gallery-controls");

    overlay.style.display = "flex";

    currentGallery = type === "residential" ? residentialImages : commercialImages;

    if (currentGallery.length === 0) {
        image.style.display = "none";
        controls.style.display = "none";
        comingSoon.innerText = "Project images will be updated soon.";
        comingSoon.style.display = "block";
        return;
    }

    comingSoon.style.display = "none";
    image.style.display = "block";
    controls.style.display = "block";

    currentIndex = 0;
    image.src = currentGallery[currentIndex];
    startAutoSlide();
};

window.closeGallery = function() {
    document.getElementById("galleryOverlay").style.display = "none";
    stopAutoSlide();
};

window.nextImage = function() {

    stopAutoSlide();

    currentIndex = (currentIndex + 1) % currentGallery.length;
    document.getElementById("galleryImage").src = currentGallery[currentIndex];

    startAutoSlide();
};

window.prevImage = function() {

    stopAutoSlide();

    currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
    document.getElementById("galleryImage").src = currentGallery[currentIndex];

    startAutoSlide();
};
function startAutoSlide() {
    clearInterval(slideInterval);
    slideInterval = setInterval(() => {
        nextImage();
    }, 3000);
}

function stopAutoSlide() {
    clearInterval(slideInterval);
}

}); // END DOMContentLoaded



// ===== GLOBAL CLOSE FUNCTION (IMPORTANT FIX) =====
function closeLeadPopup() {
    const popup = document.getElementById("leadPopupOverlay");
    if (popup) {
        popup.style.display = "none";
    }
}


