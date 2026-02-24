import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  // 🔴 PASTE YOUR REAL CONFIG HERE
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("paymentForm");
const message = document.getElementById("message");

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const customerName = document.getElementById("customerName").value;
  const executiveName = document.getElementById("executiveName").value;
  const sanctionedAmount = document.getElementById("sanctionedAmount").value;

  try {
    await addDoc(collection(db, "customerPayments"), {
      customerName,
      executiveName,
      sanctionedAmount: Number(sanctionedAmount),
      paidAmount: 0,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });

    message.innerText = "Customer Added Successfully!";
    form.reset();

  } catch (error) {
    message.innerText = error.message;
  }
});
