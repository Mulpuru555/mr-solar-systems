let currentSection = null;


/* ================= LOADING ================= */

window.addEventListener("load", ()=>{

setTimeout(()=>{

const l =
document.getElementById("loadingScreen");

if(l) l.style.display="none";

},700);

});


/* ================= CLOCK ================= */

setInterval(()=>{

const el =
document.getElementById("liveClock");

if(!el) return;

const now = new Date();

let h = now.getHours();
let m = now.getMinutes();
let s = now.getSeconds();

let ampm = h >= 12 ? "PM" : "AM";

h = h % 12;
if(h == 0) h = 12;

h = h.toString().padStart(2,"0");
m = m.toString().padStart(2,"0");
s = s.toString().padStart(2,"0");

el.innerText =
h + ":" + m + ":" + s + " " + ampm;

},1000);


/* ================= TOGGLE SECTION ================= */

window.toggleSection = (id) => {

  const sections = document.querySelectorAll(".section");
  const target = document.getElementById(id);

  if (!target) return;

  // If clicking same section → close it
  if (target.classList.contains("active")) {
    target.classList.remove("active");
    target.style.display = "none";
    currentSection = null;
    return;
  }

  // Close all sections
  sections.forEach(sec => {
    sec.classList.remove("active");
    sec.style.display = "none";
  });

  // Open selected
  target.classList.add("active");
  target.style.display = "block";
  currentSection = id;

  playClick();
};


/* ================= POPUP ================= */

window.closePopup = ()=>{

const p =
document.getElementById("editPopup");

if(p)
p.style.display="none";

};


window.openPopup = ()=>{

const p =
document.getElementById("editPopup");

if(p)
p.style.display="flex";

playClick();

};


/* ================= CLICK SOUND ================= */

const clickSound =
new Audio(
"https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg"
);

function playClick(){

try{
clickSound.currentTime = 0;
clickSound.play();
}catch(e){}

}


/* ================= BUTTON SOUND ================= */

document.addEventListener("click",(e)=>{

if(
e.target.tagName === "BUTTON" ||
e.target.classList.contains("card")
){
playClick();
}

});


/* ================= LOGOUT UI FALLBACK ================= */

const logoutBtn =
document.getElementById("logoutBtn");

if(logoutBtn){

logoutBtn.onclick = ()=>{

location.href="index.html";

};

}
