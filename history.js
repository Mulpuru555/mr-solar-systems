import { auth, db } from "./firebase-config.js";

import {
doc,
getDoc,
collection,
getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


let uid = "";


/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user)=>{

if(!user) return;

uid = user.uid;

loadHistory();

});


/* ================= LOAD HISTORY ================= */

async function loadHistory(){

const table =
document.getElementById("historyTable");

if(!table) return;

table.innerHTML = "";


// attendance / uid /

const colRef =
collection(
db,
"attendance",
uid
);

const snap =
await getDocs(colRef);


let rows = [];


snap.forEach(d=>{

rows.push({
date:d.id,
data:d.data()
});

});


rows.sort((a,b)=>{

return b.date.localeCompare(a.date);

});


rows.forEach(r=>{

const time =
r.data?.data?.time?.seconds
? new Date(
r.data.data.time.seconds*1000
).toLocaleTimeString()
: "-";


table.insertAdjacentHTML(
"beforeend",
`
<tr>
<td>${r.date}</td>
<td>${time}</td>
</tr>
`
);

});

}
