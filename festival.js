// ===== HOLI 2026 ULTRA PREMIUM – M.R SOLAR SYSTEMS =====

const festivalSettings = {
    enabled: true,

    greetingMessage:
        "🌈 Happy Holi 2026 from M.R Solar Systems – Tenali! Add Colors to Your Life with Solar Energy Savings!",

    offerTitle: "🎉 Holi Special Solar Offer",

    offerDetails: `
        Before Price: ₹2,25,000
        <br>Holi Discount: ₹15,000
        <br>After Price: ₹2,10,000
        <br>+ Government Subsidy Available ₹78,000
    `
};

if (festivalSettings.enabled) {

    window.addEventListener("load", function () {

        // ===== BACKGROUND COLOR SPLASH =====
        const splash = document.createElement("div");
        splash.style.position = "fixed";
        splash.style.top = "0";
        splash.style.left = "0";
        splash.style.width = "100%";
        splash.style.height = "100%";
        splash.style.zIndex = "-1";
        splash.style.pointerEvents = "none";
        splash.style.background = "radial-gradient(circle at 20% 30%, rgba(255,64,129,0.5), transparent 40%), \
                                   radial-gradient(circle at 80% 40%, rgba(76,175,80,0.5), transparent 40%), \
                                   radial-gradient(circle at 50% 80%, rgba(33,150,243,0.5), transparent 40%), \
                                   radial-gradient(circle at 70% 20%, rgba(255,235,59,0.5), transparent 40%)";
        splash.style.animation = "splashMove 12s ease-in-out infinite alternate";
        document.body.appendChild(splash);

        const splashStyle = document.createElement("style");
        splashStyle.innerHTML = `
            @keyframes splashMove {
                0% { transform: scale(1); }
                100% { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(splashStyle);

        // ===== FLOATING PARTICLES =====
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement("div");
            particle.style.position = "fixed";
            particle.style.width = "8px";
            particle.style.height = "8px";
            particle.style.borderRadius = "50%";
            particle.style.background = `hsl(${Math.random()*360}, 100%, 60%)`;
            particle.style.left = Math.random()*100 + "vw";
            particle.style.top = "-20px";
            particle.style.zIndex = "1";
            particle.style.animation = `fall ${4 + Math.random()*6}s linear infinite`;
            document.body.appendChild(particle);
        }

        const particleStyle = document.createElement("style");
        particleStyle.innerHTML = `
            @keyframes fall {
                0% { transform: translateY(0); opacity: 1; }
                100% { transform: translateY(110vh); opacity: 0; }
            }
        `;
        document.head.appendChild(particleStyle);

        // ===== TOP BANNER =====
        const banner = document.createElement("div");
        banner.style.position = "fixed";
        banner.style.top = "0";
        banner.style.left = "0";
        banner.style.width = "100%";
        banner.style.padding = "18px";
        banner.style.textAlign = "center";
        banner.style.fontWeight = "700";
        banner.style.zIndex = "9999";
        banner.style.color = "#fff";
        banner.style.fontFamily = "Montserrat, sans-serif";
        banner.style.background =
            "linear-gradient(270deg, #ff4081, #ffeb3b, #4caf50, #2196f3)";
        banner.style.backgroundSize = "800% 800%";
        banner.style.animation = "gradientMove 8s ease infinite";

        const gradientStyle = document.createElement("style");
        gradientStyle.innerHTML = `
            @keyframes gradientMove {
                0% {background-position: 0% 50%;}
                50% {background-position: 100% 50%;}
                100% {background-position: 0% 50%;}
            }
        `;
        document.head.appendChild(gradientStyle);

        banner.innerHTML = festivalSettings.greetingMessage;
        document.body.prepend(banner);
        document.body.style.marginTop = banner.offsetHeight + "px";

        // ===== OFFER POPUP =====
        setTimeout(() => {

            const popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.top = "50%";
            popup.style.left = "50%";
            popup.style.transform = "translate(-50%, -50%)";
            popup.style.background = "#ffffff";
            popup.style.padding = "30px";
            popup.style.borderRadius = "15px";
            popup.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
            popup.style.zIndex = "10000";
            popup.style.textAlign = "center";
            popup.style.fontFamily = "Montserrat, sans-serif";
            popup.style.maxWidth = "400px";

            popup.innerHTML = `
                <h2 style="color:#ff4081;">${festivalSettings.offerTitle}</h2>
                <p style="margin:15px 0;">${festivalSettings.offerDetails}</p>
                <button id="closeFestivalPopup"
                    style="background:#4caf50;color:#fff;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">
                    Close
                </button>
            `;

            document.body.appendChild(popup);

            document.getElementById("closeFestivalPopup").onclick = function () {
                popup.remove();
            };

        }, 2000);

    });
}
