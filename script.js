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

function calculateEMI() {

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
}


// ================= PAYBACK =================

function calculatePayback() {

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
}


// ================= WHATSAPP =================

function sendWhatsApp() {

    let name = document.getElementById("name").value;
    let mobile = document.getElementById("mobile").value;
    let location = document.getElementById("locationInput").value;
    let type = document.getElementById("serviceType").value;

    if (!name || !mobile || !location) {
        alert("Please fill all fields.");
        return;
    }

    let message = `Service Request:%0A
Name: ${name}%0A
Mobile: ${mobile}%0A
Location: ${location}%0A
Type: ${type}`;

    let url = `https://wa.me/919154777773?text=${message}`;

    window.open(url, "_blank");
}


// ================= SAFE FAQ + CHAT =================

document.addEventListener("DOMContentLoaded", function() {

    // FAQ TOGGLE
    const faqQuestions = document.querySelectorAll(".faq-question");
    if (faqQuestions.length > 0) {
        faqQuestions.forEach(item => {
            item.addEventListener("click", () => {
                const answer = item.nextElementSibling;
                if (answer) {
                    answer.style.display =
                        answer.style.display === "block" ? "none" : "block";
                }
            });
        });
    }

    // CHAT ASSISTANT
    const chatToggle = document.getElementById("solarChatToggle");
    const chatBox = document.getElementById("solarChatBox");
    const chatInput = document.getElementById("solarChatInput");
    const chatMessages = document.getElementById("solarChatMessages");

    if (chatToggle && chatBox && chatInput && chatMessages) {

        chatToggle.addEventListener("click", () => {
            chatBox.style.display =
                chatBox.style.display === "flex" ? "none" : "flex";
        });

        chatInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {

                let userText = chatInput.value.toLowerCase();
                let response = "Please contact us at 9154777773 for more details.";

                if (userText.includes("dcr")) {
                    response = "Tata DCR panels are subsidy-approved domestic modules.";
                } 
                else if (userText.includes("topcon")) {
                    response = "N-Type TOPCon panels offer higher efficiency and lower degradation.";
                }
                else if (userText.includes("subsidy")) {
                    response = "Residential DCR systems are eligible for government subsidy.";
                }
                else if (userText.includes("installation")) {
                    response = "Installation usually takes 2–5 days depending on system size.";
                }

                chatMessages.innerHTML += "<div><strong>You:</strong> " + chatInput.value + "</div>";
                chatMessages.innerHTML += "<div><strong>Assistant:</strong> " + response + "</div>";
                chatInput.value = "";
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

});
// ===== SMART LEAD POPUP =====

document.addEventListener("DOMContentLoaded", function () {

    // Show popup after 10 seconds
    setTimeout(function () {
        if (!sessionStorage.getItem("leadPopupShown")) {
            document.getElementById("leadPopupOverlay").style.display = "flex";
            sessionStorage.setItem("leadPopupShown", "true");
        }
    }, 10000);

});

function closeLeadPopup() {
    document.getElementById("leadPopupOverlay").style.display = "none";
}

function sendLeadToWhatsApp() {

    let name = document.getElementById("leadName").value;
    let mobile = document.getElementById("leadMobile").value;
    let location = document.getElementById("leadLocation").value;

    if (!name || !mobile || !location) {
        alert("Please fill all fields.");
        return;
    }

    let message = `New Lead:%0A
Name: ${name}%0A
Mobile: ${mobile}%0A
Location: ${location}`;

    let url = `https://wa.me/919154777773?text=${message}`;

    window.open(url, "_blank");

    closeLeadPopup();
}

// ===== PROJECT GALLERY SYSTEM =====

let currentGallery = [];
let currentIndex = 0;
let slideInterval;

const residentialImages = [
    "images/res1.jpeg",
    "images/res2.jpeg",
    "images/res3.jpeg",
    "images/res4.jpeg",
    "images/res6.jpeg",
    "images/res11.jpeg",
    "images/res12.jpeg",
    "images/res13.jpeg",
    "images/res14.jpeg",
    "images/res16.jpeg",
    "images/res17.jpeg",
    "images/res18.jpeg",
    "images/res19.jpeg",
    "images/res20.jpeg",
    "images/res21.jpeg",
    "images/res22.jpeg",
    "images/res24.jpeg",
    "images/res25.jpeg"
];
const commercialImages = [];  // add later

function openGallery(type) {
    console.log(currentGallery);
    const overlay = document.getElementById("galleryOverlay");
    const image = document.getElementById("galleryImage");
    const comingSoon = document.getElementById("comingSoonText");
    const controls = document.querySelector(".gallery-controls");

    overlay.style.display = "flex";

    if (type === "residential") {
        currentGallery = residentialImages;
    } else {
        currentGallery = commercialImages;
    }

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
}

function closeGallery() {
    document.getElementById("galleryOverlay").style.display = "none";
    stopAutoSlide(); // stop when closed
}

function nextImage() {
    currentIndex++;
    if (currentIndex >= currentGallery.length) {
        currentIndex = 0;
    }
    document.getElementById("galleryImage").src = currentGallery[currentIndex];
}

function prevImage() {
    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = currentGallery.length - 1;
    }
    document.getElementById("galleryImage").src = currentGallery[currentIndex];
}
function startAutoSlide() {
    console.log("Auto slide started");  // 👈 add this
    clearInterval(slideInterval);

    slideInterval = setInterval(() => {
        console.log("Sliding...");      // 👈 add this
        nextImage();
    }, 3000);
}

function stopAutoSlide() {
    clearInterval(slideInterval);
}




