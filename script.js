let chart;
let lastEMIData = {};

function calculateEMI() {

    let P = parseFloat(document.getElementById("loanAmount").value);
    let annualRate = parseFloat(document.getElementById("interestRate").value);
    let years = parseFloat(document.getElementById("loanTenure").value);
    let feePercent = parseFloat(document.getElementById("processingFee").value) || 0;

    if (!P || !annualRate || !years) {
        alert("Please enter Loan Amount, Interest Rate and Tenure");
        return;
    }

    let R = annualRate / 12 / 100;
    let N = years * 12;

    let EMI = (P * R * Math.pow(1 + R, N)) /
              (Math.pow(1 + R, N) - 1);

    let totalPayment = EMI * N;
    let totalInterest = totalPayment - P;
    let processingFee = (P * feePercent) / 100;

    document.getElementById("monthlyEMI").innerText = EMI.toFixed(2);
    document.getElementById("totalInterest").innerText = totalInterest.toFixed(2);
    document.getElementById("feeAmount").innerText = processingFee.toFixed(2);
    document.getElementById("totalPayment").innerText =
        (totalPayment + processingFee).toFixed(2);

    lastEMIData = { P, EMI, years, annualRate };

    if (chart) chart.destroy();

    let ctx = document.getElementById("emiChart").getContext("2d");

    chart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: ["Principal", "Interest"],
            datasets: [{
                data: [P, totalInterest],
                backgroundColor: ["#f4a62a", "#00c2a8"]
            }]
        }
    });

    let principalPercent = (P / totalPayment) * 100;
    let interestPercent = (totalInterest / totalPayment) * 100;

    document.getElementById("principalBar").style.width = principalPercent + "%";
    document.getElementById("interestBar").style.width = interestPercent + "%";
}

function resetEMI() {
    location.reload();
}

function generateSchedule() {

    let P = parseFloat(document.getElementById("loanAmount").value);
    let annualRate = parseFloat(document.getElementById("interestRate").value);
    let years = parseFloat(document.getElementById("loanTenure").value);

    if (!P || !annualRate || !years) {
        alert("Please calculate EMI first.");
        return;
    }

    let R = annualRate / 12 / 100;
    let N = years * 12;

    let EMI = (P * R * Math.pow(1 + R, N)) /
              (Math.pow(1 + R, N) - 1);

    let balance = P;

    let tableHTML = `
    <table class="amortization-table">
        <tr>
            <th>Month</th>
            <th>EMI</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Balance</th>
        </tr>`;

    for (let i = 1; i <= N; i++) {

        let interest = balance * R;
        let principal = EMI - interest;
        balance -= principal;

        tableHTML += `
        <tr>
            <td>${i}</td>
            <td>${EMI.toFixed(2)}</td>
            <td>${principal.toFixed(2)}</td>
            <td>${interest.toFixed(2)}</td>
            <td>${balance > 0 ? balance.toFixed(2) : "0.00"}</td>
        </tr>`;
    }

    tableHTML += "</table>";
    document.getElementById("amortizationContainer").innerHTML = tableHTML;
}

function downloadPDF() {

    if (!lastEMIData.P) {
        alert("Please calculate EMI first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("M.R Solar Systems - EMI Report", 20, 20);

    doc.setFontSize(12);
    doc.text("Loan Amount: ₹ " + lastEMIData.P, 20, 40);
    doc.text("Interest Rate: " + lastEMIData.annualRate + "%", 20, 50);
    doc.text("Tenure: " + lastEMIData.years + " Years", 20, 60);
    doc.text("Monthly EMI: ₹ " + lastEMIData.EMI.toFixed(2), 20, 70);

    doc.save("EMI_Report_MR_Solar_Systems.pdf");
}

function calculateSavings() {
    let bill = parseFloat(document.getElementById("monthlyBill").value);
    if (bill) {
        let savings = bill * 12 * 25;
        document.getElementById("savingsResult").innerText =
            "Estimated 25-Year Savings: ₹ " + savings.toFixed(2);
    }
}
