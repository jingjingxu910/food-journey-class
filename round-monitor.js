// Lightweight control checks. Artwork and records are fetched only when commands change.
import {readDocument} from './evaluation-data.js';
let checking=false,lastCheck=0,lastRoundCheck=0;
async function check(){
 if(checking||document.hidden||Date.now()-lastCheck<5000)return;
 const frame=document.querySelector('#lesson-frame');
 if(!frame)return;
 let url;
 try{url=new URL(frame.contentWindow.location.href);}catch{return;}
 if(url.searchParams.get('mode')==='teacher'||url.pathname==='blank')return;
 checking=true;lastCheck=Date.now();
 try{
   if(Date.now()-lastRoundCheck>=60000){
     const active=await readDocument('class-reset'),round=active.resetId||null,previous=localStorage.getItem('lesson-known-round');
     lastRoundCheck=Date.now();
     if(previous===null||JSON.parse(previous)!==round){
       const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('foodJourneyClass',2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('learningRecords'))r.result.createObjectStore('learningRecords',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
       let removed=false;
       await new Promise((resolve,reject)=>{const tx=db.transaction('learningRecords','readwrite'),r=tx.objectStore('learningRecords').openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;if(c.value.lesson==='food-journey'&&(c.value.resetId||null)!==round){c.delete();removed=true;}c.continue();};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
       localStorage.setItem('lesson-known-round',JSON.stringify(round));
       if(removed||previous!==null){
         for(let id=1;id<=12;id++)localStorage.removeItem('food-journey-game-v3-group-'+id);
         frame.contentWindow.location.replace('index.html?group='+(url.searchParams.get('group')||1));
         return;
       }
     }
   }
   const command=await readDocument('class-control');
   const known=JSON.parse(localStorage.getItem('lesson-known-round')||'null');
   if(command.resetId!==known||!['evaluation','awards'].includes(command.phase))return;
   if(!url.pathname.endsWith('/evaluation.html')){
     frame.contentWindow.location.replace('evaluation.html?group='+(url.searchParams.get('group')||1));
   }else frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent('class-command',{detail:command}));
 }catch{/* Retain local progress and retry when online. */}finally{checking=false;}
}
setInterval(check,15000);
window.addEventListener('focus',check);
window.addEventListener('online',check);
document.addEventListener('visibilitychange',check);
