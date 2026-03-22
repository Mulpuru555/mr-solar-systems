import { auth, db } from "./firebase-config.js";

import {
collection,
query,
where,
getDocs,
addDoc,
serverTimestamp,
doc,
updateDoc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged,
signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";
let editID = "";


/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user)=>{

if(!user){
location.href="index.html";
return;
}

const snap = await getDoc(doc(db,"users",user.uid));

if(!snap.exists()){
location.href="index.html";
return;
}

const data = snap.data();

if(data.accountStatus === "blocked"){
showBlockedScreen();
return;
}

uid = user.uid;

loadRecords(uid);

});


/* ================= BLOCKED ================= */

function showBlockedScreen(){

document.body.innerHTML = `
<div style="height:100vh;display:flex;justify-content:center;align-items:center;background:black;color:white">
<div style="background:#111;padding:40px;border:2px solid red;border-radius:10px;text-align:center">
<h2>ACCOUNT BLOCKED</h2>
<p>Contact Manager</p>
<button id="logoutBtn2">Logout</button>
</div>
</div>
`;

document.getElementById("logoutBtn2").onclick = async ()=>{
await signOut(auth);
location.href="index.html";
};

}


/* ================= LOGOUT ================= */

const logoutBtn = document.getElementById("logoutBtn");

if(logoutBtn){
logoutBtn.onclick = async ()=>{
await signOut(auth);
location.href="index.html";
};
}


/* ================= SECTION SWITCH ================= */

window.openSection = (id)=>{

const a = document.getElementById("attendanceSection");
const b = document.getElementById("erpSection");

if(a) a.style.display="none";
if(b) b.style.display="none";

const target = document.getElementById(id);
if(target) target.style.display="block";

};


/* ================= ADD PAYMENT ================= */

const form = document.getElementById("paymentForm");

if(form){

form.onsubmit = async (e)=>{

e.preventDefault();

const customerName =
document.getElementById("customerName").value;

const executiveName =
document.getElementById("executiveName").value;

const totalAmount =
Number(document.getElementById("totalAmount").value) || 0;


await addDoc(
collection(db,"customerPayments"),
{
customerName,
executiveName,
totalAmount,
createdBy: uid,
payments: [],
status: "Pending",
isLocked: true,
createdAt: serverTimestamp()
}
);

loadRecords(uid);

};

}


/* ================= LOAD RECORDS ================= */

async function loadRecords(u){

const table =
document.getElementById("recordsTable");

if(!table) return;

table.innerHTML = "";

const q = query(
collection(db,"customerPayments"),
where("createdBy","==",u)
);

const snap = await getDocs(q);

const docs = [];

snap.forEach(d=>{
docs.push({id:d.id,data:d.data()});
});

docs.sort((a,b)=>{
const t1 = a.data.createdAt?.seconds || 0;
const t2 = b.data.createdAt?.seconds || 0;
return t2 - t1;
});

let i = 1;

docs.forEach(obj=>{

const data = obj.data;
const id = obj.id;

let paid = 0;

(data.payments || []).forEach(p=>{
paid += Number(p.amount) || 0;
});

const date =
data.createdAt?.seconds
? new Date(data.createdAt.seconds*1000).toLocaleDateString()
: "-";

const locked =
data.isLocked !== false;


const editBtn =
locked
? "Locked"
: `<button data-id="${id}" class="editBtn">Edit</button>`;


table.insertAdjacentHTML(
"beforeend",
`
<tr>
<td>${i++}</td>
<td>${data.customerName}</td>
<td>${data.executiveName}</td>
<td>${data.totalAmount}</td>
<td>${paid}</td>
<td>${data.status}</td>
<td>${date}</td>
<td>${locked ? "Locked":"Editable"}</td>
<td>${editBtn}</td>
</tr>
`
);

});


/* attach edit buttons */

document.querySelectorAll(".editBtn")
.forEach(btn=>{

btn.onclick = ()=>{

const id = btn.dataset.id;

const rec = docs.find(d=>d.id===id);

if(!rec) return;

openEdit(
id,
rec.data.customerName,
rec.data.executiveName,
rec.data.totalAmount
);

};

});

}


/* ================= EDIT ================= */

window.openEdit = (id,name,exec,total)=>{

editID = id;

document.getElementById("editName").value = name;
document.getElementById("editExec").value = exec;
document.getElementById("editTotal").value = total;

document.getElementById("editPopup").style.display="flex";

};


window.closePopup = ()=>{
document.getElementById("editPopup").style.display="none";
};


window.saveEdit = async ()=>{

if(!editID) return;

const ref = doc(db,"customerPayments",editID);

await updateDoc(ref,{
customerName:
document.getElementById("editName").value,

executiveName:
document.getElementById("editExec").value,

totalAmount:
Number(
document.getElementById("editTotal").value
) || 0
});

closePopup();

loadRecords(uid);

};
/* ================= PROFILE SAVE ================= */

import {
setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const saveProfileBtn =
document.getElementById("saveProfileBtn");

if(saveProfileBtn){

saveProfileBtn.onclick = async ()=>{

if(!uid) return;

const name =
document.getElementById("profileName").value;

const phone =
document.getElementById("profilePhone").value;

const branch =
document.getElementById("profileBranch").value;

const address =
document.getElementById("profileAddress").value;


await setDoc(
doc(db,"employeeProfiles",uid),
{
name,
phone,
branch,
address
},
{merge:true}
);

document.getElementById("profileMsg")
.innerText="Saved";

};

}



/* ================= LOAD PROFILE ================= */

async function loadProfile(){

if(!uid) return;

const ref =
doc(db,"employeeProfiles",uid);

const snap =
await getDoc(ref);

if(!snap.exists()) return;

const d = snap.data();

document.getElementById("profileName").value =
d.name || "";

document.getElementById("profilePhone").value =
d.phone || "";

document.getElementById("profileBranch").value =
d.branch || "";

document.getElementById("profileAddress").value =
d.address || "";

}



/* ================= MONTHLY REPORT ================= */

async function loadReport(){

if(!uid) return;

const box =
document.getElementById("reportBox");

if(!box) return;


const q =
query(
collection(db,"attendance"),
where("uid","==",uid)
);

const snap =
await getDocs(q);

let total = 0;
let present = 0;

snap.forEach(doc=>{

total++;

const d = doc.data();

if(d.status==="Present"){
present++;
}

});

const absent =
total - present;

box.innerHTML = `
Total Days : ${total}
<br>
Present : ${present}
<br>
Absent : ${absent}
`;

}



/* ================= SECTION HOOK ================= */

const oldOpen = window.openSection;

window.openSection = (id)=>{

oldOpen(id);

if(id==="profileSection"){
loadProfile();
}

if(id==="reportSection"){
loadReport();
}

};
/* ================= GPS STATUS UI ================= */

const distBox =
document.getElementById("distanceDisplay");

const gpsStatus =
document.getElementById("gpsStatus");


if(distBox){

const observer =
new MutationObserver(()=>{

const txt = distBox.innerText.toLowerCase();

if(txt.includes("inside")){

gpsStatus.innerText = "GPS: Inside Office";
gpsStatus.className="gpsInside";

}

else if(txt.includes("outside")){

gpsStatus.innerText = "GPS: Outside Office";
gpsStatus.className="gpsOutside";

}

});

observer.observe(
distBox,
{childList:true}
);

}
/* ================= THEME SWITCH ================= */

const themeBtn =
document.getElementById("themeBtn");

let themeIndex = 0;

const themes = [
"solarMode",
"darkMode",
"lightMode"
];

if(themeBtn){

themeBtn.onclick = ()=>{

document.body.classList.remove(
"solarMode",
"darkMode",
"lightMode"
);

themeIndex++;

if(themeIndex>=themes.length)
themeIndex=0;

document.body.classList.add(
themes[themeIndex]
);

};

}



/* ================= NOTIFICATIONS ================= */

async function loadNotifications(){

const box =
document.getElementById("notifyBox");

if(!box) return;

const snap =
await getDocs(
collection(db,"notifications")
);

if(snap.empty){

box.innerText="No messages";
return;

}

let html="";

snap.forEach(doc=>{

const d = doc.data();

html += `
<div>
${d.text || ""}
</div>
`;

});

box.innerHTML = html;

}


/* hook */

const oldOpen2 = window.openSection;

window.openSection = (id)=>{

oldOpen2(id);

if(id==="notifySection"){
loadNotifications();
}

};

/* ================= LIVE CLOCK ================= */

const clockBox =
document.getElementById("liveClock");

if(clockBox){

setInterval(()=>{

const d = new Date();

clockBox.innerText =
d.toLocaleTimeString();

},1000);

}



/* ================= WELCOME NAME ================= */

async function loadWelcome(){

if(!uid) return;

const snap =
await getDoc(
doc(db,"employeeProfiles",uid)
);

if(!snap.exists()) return;

const d = snap.data();

const box =
document.getElementById("welcomeText");

if(box){

box.innerText =
"Welcome " + (d.name || "");

}

}


/* hook */

const oldOpen3 = window.openSection;

window.openSection = (id)=>{

oldOpen3(id);

loadWelcome();

};
