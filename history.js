import { auth, db } from "./firebase-config.js";

import {
doc,
getDoc,
getDocs,
collection
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


const colRef =
collection(
db,
"attendance",
uid
);

const snap =
await getDocs(colRef);


snap.forEach(async d=>{

const date = d.id;

const dataRef =
doc(
db,
"attendance",
uid,
date,
"data"
);

const dataSnap =
await getDoc(dataRef);

let time = "-";

if(
dataSnap.exists()
){

const t =
dataSnap.data().time;

if(t?.seconds){

time =
new Date(
t.seconds*1000
).toLocaleTimeString(
[],
{hour12:true}
);

}

}

table.insertAdjacentHTML(
"beforeend",
`
<tr>
<td>${date}</td>
<td>${time}</td>
</tr>
`
);

});

}
