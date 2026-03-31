import { auth } from "./firebase-config.js";

import {
signInWithEmailAndPassword,
sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


/* ================= LOGIN ================= */
window.loginUser = async function(){

const email = document.getElementById("loginEmail")?.value;
const password = document.getElementById("loginPassword")?.value;

if(!email || !password){
alert("Enter Email & Password");
return;
}

/* 🔥 CHECK IF AI LOADER EXISTS */
const modal = document.getElementById("loginModal");
const loader = document.getElementById("aiLoader");
const statusText = document.getElementById("aiStatus");

/* SHOW LOADER IF AVAILABLE */
if(loader){
modal.style.display = "none";
loader.style.display = "flex";
}

/* AI STEPS */
const steps = [
"Scanning credentials...",
"Connecting to secure server...",
"Verifying identity...",
"Checking access level...",
"Login successful"
];

let i = 0;

if(statusText){
var interval = setInterval(()=>{
statusText.innerText = steps[i];
i++;
if(i >= steps.length){
clearInterval(interval);
}
}, 700);
}

try{

await signInWithEmailAndPassword(auth, email, password);

/* SUCCESS REDIRECT */
setTimeout(()=>{

/* 🔥 KEEP YOUR EXISTING REDIRECT (SAFE) */
window.location.href = "employee.html";

}, 3000);

}catch(err){

/* HIDE LOADER */
if(loader){
loader.style.display = "none";
modal.style.display = "flex";
}

/* CLEAR INTERVAL */
if(typeof interval !== "undefined"){
clearInterval(interval);
}

/* ERROR */
alert("Login Failed: " + err.message);

}

};


/* ================= RESET PASSWORD ================= */
window.resetPassword = async function(){

const email = document.getElementById("loginEmail")?.value;

if(!email){
alert("Enter email first");
return;
}

try{

await sendPasswordResetEmail(auth, email);

alert("Reset link sent to email");

}catch(err){

alert("Error: " + err.message);

}

};


/* ================= CLOSE LOGIN ================= */
window.closeLogin = function(){

const modal = document.getElementById("loginModal");

if(modal){
modal.style.display = "none";
}

};
/* FIX BUTTON CLICK */
document.addEventListener("DOMContentLoaded", () => {

console.log("DOM ready");

const btn = document.getElementById("loginBtn");

if(btn){
console.log("Button connected");

btn.addEventListener("click", () => {
console.log("Clicked");
loginUser();
});

}else{
console.log("Button NOT found");
}

});
