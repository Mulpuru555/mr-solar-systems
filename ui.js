let currentSection = null;


/* ================= LOADING ================= */

window.addEventListener("load", ()=>{

setTimeout(()=>{

const l = document.getElementById("loadingScreen");

if(l) l.style.display="none";

},800);

});



/* ================= CLOCK ================= */

setInterval(()=>{

const c = document.getElementById("liveClock");

if(!c) return;

const now = new Date();

let h = now.getHours().toString().padStart(2,"0");
let m = now.getMinutes().toString().padStart(2,"0");
let s = now.getSeconds().toString().padStart(2,"0");

c.innerText = h + ":" + m + ":" + s;

},1000);



/* ================= TOGGLE SECTION ================= */

window.toggleSection = (id)=>{

const target = document.getElementById(id);

if(!target) return;

/* close if same */

if(currentSection === id){

target.style.display="none";
currentSection = null;
return;

}

/* close old */

if(currentSection){

const old = document.getElementById(currentSection);

if(old) old.style.display="none";

}

/* open new */

target.style.display="block";

currentSection = id;

};



/* ================= POPUP ================= */

window.closePopup = ()=>{

const p = document.getElementById("editPopup");

if(p) p.style.display="none";

};

window.openPopup = ()=>{

const p = document.getElementById("editPopup");

if(p) p.style.display="flex";

};



/* ================= LOGOUT UI ================= */

const logoutBtn = document.getElementById("logoutBtn");

if(logoutBtn){

logoutBtn.onclick = ()=>{

location.href = "index.html";

};

}
