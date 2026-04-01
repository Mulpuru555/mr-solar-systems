import { auth, db } from "./firebase-config.js";

import {
collection,
query,
where,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";

onAuthStateChanged(auth, async (user)=>{

if(!user) return;

uid = user.uid;

loadHistory();

});


async function loadHistory(){

const table =
document.getElementById("historyTable");

if(!table) return;

table.innerHTML = "";


const q =
query(
collection(db,"attendance"),
where("employeeId","==",uid)
);

const snap =
await getDocs(q);


let rows = [];

snap.forEach(d=>{

rows.push(d.data());

});


rows.sort((a,b)=>{

return b.date.localeCompare(a.date);

});


rows.forEach(r=>{

let time = "-";

if(r.timestamp?.seconds){

time =
new Date(
r.timestamp.seconds*1000
).toLocaleTimeString(
[],
{hour12:true}
);

}

table.innerHTML += `
<tr>
<td>${r.date}</td>
<td>${time}</td>
</tr>
`;

});

}
