import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNtPFzFkYLpbv8vgfeQ0_uE42JT7h28bc",
  authDomain: "mr-solar-portal.firebaseapp.com",
  projectId: "mr-solar-portal",
  storageBucket: "mr-solar-portal.firebasestorage.app",
  messagingSenderId: "1017116122935",
  appId: "1:1017116122935:web:db1256b90c66c96ad644b2"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
