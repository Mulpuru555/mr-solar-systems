// =========================
// FESTIVAL CONTROL
// =========================

const festivalTheme = "ugadi"; // change to none after festival



if (festivalTheme === "ugadi") {

document.addEventListener("DOMContentLoaded", () => {


const isMobile = window.innerWidth < 768;



/* ========= BACKGROUND ========= */

document.body.style.background =
"linear-gradient(135deg,#fff8e1,#ffe0b2,#fff3e0)";



/* ========= GOLD LINE ========= */

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



/* ========= LEAVES ========= */

const leaves=document.createElement("div");

leaves.innerHTML = isMobile ?
"🌿 🌿 🌿" :
"🌿 🌿 🌿 🌿 🌿 🌿 🌿";

leaves.style.position="fixed";
leaves.style.top="4px";
leaves.style.width="100%";
leaves.style.textAlign="center";
leaves.style.fontSize = isMobile ? "16px" : "18px";
leaves.style.background="#2e7d32";
leaves.style.color="white";
leaves.style.zIndex="9999";

document.body.appendChild(leaves);



/* ========= BANNER ========= */

const banner=document.createElement("div");

banner.innerHTML=
"🌸 Happy Ugadi | Solar Offers | 9154777773";

banner.style.position="fixed";
banner.style.top="26px";
banner.style.width="100%";
banner.style.background="#ff6f00";
banner.style.color="white";
banner.style.textAlign="center";
banner.style.padding="5px";
banner.style.fontSize =
isMobile ? "12px" : "14px";

banner.style.zIndex="9999";

document.body.appendChild(banner);



/* ========= OFFER TIMER ========= */

const timer=document.createElement("div");

timer.style.position="fixed";
timer.style.top="50px";
timer.style.right="10px";
timer.style.background="white";
timer.style.padding="5px 8px";
timer.style.fontSize="12px";
timer.style.boxShadow="0 0 5px black";
timer.style.zIndex="9999";

document.body.appendChild(timer);

let seconds=3600;

setInterval(()=>{

seconds--;

let m=Math.floor(seconds/60);
let s=seconds%60;

timer.innerHTML=
"Offer ends in "+m+":"+s;

if(seconds<=0) timer.remove();

},1000);



/* ========= FLOWERS ========= */

function flower(){

const f=document.createElement("div");

f.innerHTML="🌸";

f.style.position="fixed";
f.style.top="-10px";
f.style.left=Math.random()*100+"vw";
f.style.fontSize =
isMobile ? "14px" : "16px";

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

setInterval(
flower,
isMobile ? 1200 : 700
);



/* ========= CONFETTI ========= */

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

setInterval(
confetti,
isMobile ? 2000 : 1200
);



/* ========= SMALL POPUP ========= */

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



/* ========= RANGOLI ========= */

const rangoli=document.createElement("div");

rangoli.innerHTML="🏵 🏵 🏵";

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
