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
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";
let records = [];
let editID = "";


/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user)=>{

if(!user) return;

uid = user.uid;

loadRecords();

});


/* ================= ADD ================= */

const form =
document.getElementById("paymentForm");

if(form){

form.onsubmit = async (e)=>{

e.preventDefault();

const name =
document.getElementById("customerName").value;

const exec =
document.getElementById("executiveName").value;

const total =
Number(
document.getElementById("totalAmount").value
) || 0;


await addDoc(
collection(db,"customerPayments"),
{
customerName:name,
executiveName:exec,
totalAmount:total,
createdBy:uid,
payments:[],
status:"Pending",
isLocked:true,
createdAt:serverTimestamp()
}
);

form.reset();

loadRecords();

};

}


/* ================= LOAD ================= */

async function loadRecords(){

records = [];

const table =
document.getElementById("recordsTable");

if(!table) return;

table.innerHTML="";


const q = query(
collection(db,"customerPayments"),
where("createdBy","==",uid)
);

const snap = await getDocs(q);


snap.forEach(d=>{

records.push({
id:d.id,
data:d.data()
});

});


records.sort((a,b)=>{

const t1 =
a.data.createdAt?.seconds || 0;

const t2 =
b.data.createdAt?.seconds || 0;

return t2 - t1;

});


showTable(records);

}


/* ================= SHOW ================= */

function showTable(list){

const table =
document.getElementById("recordsTable");

table.innerHTML="";

let i = 1;

list.forEach(obj=>{

const d = obj.data;

let paid = 0;

(d.payments || [])
.forEach(p=>{

paid +=
Number(p.amount) || 0;

});


const date =
d.createdAt?.seconds
? new Date(
d.createdAt.seconds*1000
).toLocaleDateString()
: "-";


const locked =
d.isLocked !== false;


const editBtn =
locked
? "Locked"
: `<button data-id="${obj.id}" class="editBtn">Edit</button>`;


table.insertAdjacentHTML(
"beforeend",
`
<tr>

<td>${i++}</td>

<td>${d.customerName}</td>

<td>${d.executiveName}</td>

<td>${d.totalAmount}</td>

<td>${paid}</td>

<td>${d.status}</td>

<td>${date}</td>

<td>${locked ? "Locked":"Open"}</td>

<td>${editBtn}</td>

</tr>
`
);

});


document
.querySelectorAll(".editBtn")
.forEach(btn=>{

btn.onclick = ()=>{

const id =
btn.dataset.id;

const rec =
records.find(
r=>r.id===id
);

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


/* ================= SEARCH ================= */

const searchInput =
document.getElementById("searchInput");

if(searchInput){

searchInput.oninput = ()=>{

const v =
searchInput.value
.toLowerCase();

const filtered =
records.filter(r=>{

const d = r.data;

return(

d.customerName
.toLowerCase()
.includes(v)

||

d.executiveName
.toLowerCase()
.includes(v)

||

(d.status || "")
.toLowerCase()
.includes(v)

);

});

showTable(filtered);

};

}


/* ================= EDIT ================= */

window.openEdit = (
id,
name,
exec,
total
)=>{

editID = id;

document.getElementById("editName").value = name;
document.getElementById("editExec").value = exec;
document.getElementById("editTotal").value = total;

document.getElementById("editPopup")
.style.display="flex";

};


window.closePopup = ()=>{

document.getElementById("editPopup")
.style.display="none";

};


document
.getElementById("saveEditBtn")
.onclick = async ()=>{

if(!editID) return;

const ref =
doc(
db,
"customerPayments",
editID
);

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

loadRecords();

};
