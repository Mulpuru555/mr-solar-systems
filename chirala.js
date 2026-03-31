// chirala.js - 🔥 FULL PROFESSIONAL ATTENDANCE SYSTEM
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 YOUR FIREBASE CONFIG (REPLACE)
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* 🔥 STATE */
let currentUser = null;
let officeLat = 16.24, officeLon = 80.35; // Chirala coords
let allowedRadius = 200; // meters
let closeHour = 23, closeMinute = 0;
let locationWatchId = null;
let clockInterval = null;
let lastCoords = null;

/* 🔥 DOM */
const el = id => document.getElementById(id);

/* 🔥 DATE */
const getTodayDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const getDateForDay = date => {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};

/* 🔥 TIME CHECK */
const isWithinAllowedTime = () => {
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  const closeMin = closeHour * 60 + closeMinute;
  return currentMin <= closeMin;
};

/* 🔥 LOADING */
const showLoading = () => el('loadingScreen')?.classList.remove('hidden');
const hideLoading = () => el('loadingScreen')?.classList.add('hidden');

/* 🔥 SETTINGS */
const loadOfficeSettings = async () => {
  try {
    const snap =
