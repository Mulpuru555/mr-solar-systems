import { auth, db } from "./firebase-config.js";

import {
doc,
getDoc
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


const today = new Date();

for(let i=0;i<31;i++){

const d =
new Date();

d.setDate(today.getDate()-i);

const dateStr =
d.toISOString().split("T")[0];


const ref =
doc(
db,
"attendance",
uid,
dateStr,
"data"
);

const snap =
await getDoc(ref);

if(!snap.exists())
continue;


let time = "-";

const t =
snap.data().time;

if(t?.seconds){

time =
new Date(
t.seconds*1000
).toLocaleTimeString(
[],
{hour12:true}
);

}

table.innerHTML += `
<tr>
<td>${dateStr}</td>
<td>${time}</td>
</tr>
`;

}

}
