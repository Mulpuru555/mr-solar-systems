// =========================
// FESTIVAL CONTROL
// =========================

const festivalTheme = "ugadi"; // change to none after festival



if (festivalTheme === "ugadi") {

document.addEventListener("DOMContentLoaded", () => {



/* ===== BACKGROUND ===== */

document.body.style.background =
"linear-gradient(135deg,#fff8e1,#ffe0b2,#fff3e0)";



/* ===== GOLD LINE ===== */

const gold=document.createElement("div");

gold.style.position="fixed";
gold.style.top="0";
gold.style.left="0";
gold.style.width="100%";
gold.style.height="4px";
gold.style.background=
"linear-gradient(90deg,gold,orange,gold)";
gold.style.zIndex="9999";

document.body.appendChild(gold);



/* ===== MANGO LEAVES SMALL ===== */

const leaves=document.createElement("div");

leaves.innerHTML="🌿 🌿 🌿 🌿 🌿 🌿 🌿";

leaves.style.position="fixed";
leaves.style.top="4px";
leaves.style.width="100%";
leaves.style.textAlign="center";
leaves.style.fontSize="18px";
leaves.style.background="#2e7d32";
leaves.style.color="white";
leaves.style.zIndex="9999";

document.body.appendChild(leaves);



/* ===== SMALL BANNER ===== */

const banner=document.createElement("div");

banner.innerHTML=
"🌸 Happy Ugadi | Special Solar Offers | 9154777773";

banner.style.position="fixed";
banner.style.top="28px";
banner.style.width="100%";
banner.style.background="#ff6f00";
banner.style.color="white";
banner.style.textAlign="center";
banner.style.padding="6px";
banner.style.fontSize="14px";
banner.style.zIndex="9999";

document.body.appendChild(banner);



/* ===== SMALL POPUP ===== */

setTimeout(()=>{

const pop=document.createElement("div");

pop.innerHTML=
"<b>Happy Ugadi</b><br>M.R Solar Systems";

pop.style.position="fixed";
pop.style.bottom="20px";
pop.style.right="20px";
pop.style.background="white";
pop.style.padding="10px";
pop.style.boxShadow="0 0 10px black";
pop.style.zIndex="99999";

document.body.appendChild(pop);

setTimeout(()=>pop.remove(),4000);

},2000);



/* ===== FLOWER (LESS) ===== */

function flower(){

const f=document.createElement("div");

f.innerHTML="🌸";

f.style.position="fixed";
f.style.top="-10px";
f.style.left=Math.random()*100+"vw";
f.style.fontSize="16px";
f.style.zIndex="9999";

document.body.appendChild(f);

let fall=setInterval(()=>{

f.style.top=f.offsetTop+2+"px";

if(f.offsetTop>window.innerHeight){

f.remove();
clearInterval(fall);

}

},30);

}

setInterval(flower,900); // slower



/* ===== CONFETTI LESS ===== */

function confetti(){

const c=document.createElement("div");

c.innerHTML="✨";

c.style.position="fixed";
c.style.top="-10px";
c.style.left=Math.random()*100+"vw";
c.style.fontSize="14px";
c.style.zIndex="9999";

document.body.appendChild(c);

let fall=setInterval(()=>{

c.style.top=c.offsetTop+3+"px";

if(c.offsetTop>window.innerHeight){

c.remove();
clearInterval(fall);

}

},30);

}

setInterval(confetti,1500);



/* ===== RANGOLI SMALL ===== */

const rangoli=document.createElement("div");

rangoli.innerHTML="🏵 🏵 🏵 🏵 🏵";

rangoli.style.position="fixed";
rangoli.style.bottom="0";
rangoli.style.width="100%";
rangoli.style.textAlign="center";
rangoli.style.fontSize="18px";
rangoli.style.background="#ffcc80";
rangoli.style.zIndex="9999";

document.body.appendChild(rangoli);



});
}
