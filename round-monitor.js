// Lightweight control checks. Artwork and records are fetched only when commands change.
import {readDocument} from './evaluation-data.js?v=20261109-ui3';
import {cloudDb} from './student-data.js?v=20261109-ui3';
let checking=false,lastCheck=0,lastRoundCheck=0,lastStageCommand=null;
let commandWatcher=null,cachedCommand=null,nextWatchAttempt=0,retryAfter=0,failureDelay=2000;
function stopCommandWatch(){
 const watcher=commandWatcher;
 commandWatcher=null;
 cachedCommand=null;
 if(watcher)Promise.resolve(watcher.close()).catch(()=>{});
}
async function ensureCommandWatch(){
 if(commandWatcher||Date.now()<nextWatchAttempt)return;
 nextWatchAttempt=Date.now()+60000;
 try{
   const db=await cloudDb();
   if(document.hidden)return;
   const ref=db.collection('food-journey-groups').doc('class-control');
   if(typeof ref.watch!=='function')return;
   commandWatcher=ref.watch({
     onChange(snapshot){
       if(document.hidden)return;
       cachedCommand=snapshot.docs?.[0]||{};
       retryAfter=0;
       void check(true);
     },
     onError(){stopCommandWatch();nextWatchAttempt=Date.now()+60000;}
   });
 }catch{stopCommandWatch();}
}
async function check(force=false){
 if(checking||document.hidden||Date.now()<retryAfter||(!force&&Date.now()-lastCheck<1500))return;
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
   await ensureCommandWatch();
   const command=cachedCommand||await readDocument('class-control');
   failureDelay=2000;retryAfter=0;
   const known=JSON.parse(localStorage.getItem('lesson-known-round')||'null');
   if(command.resetId!==known)return;
   const stageRoutes={v1:'model-workbench.html?phase=v1',v2:'model-workbench.html?phase=v2',observation:'observation.html',assembly:'assembly.html',journey:'journey.html',discussion:'discussion.html?question='+Math.max(0,Math.min(2,Number(command.discussionIndex)||0))};
   const route=stageRoutes[command.phase];
   if(route){
     const key=JSON.stringify([known,command.phase,command.commandId]);
     if(key===lastStageCommand)return;
     if(await frame.contentWindow.prepareClassNavigation?.()===false)return;
     const target=new URL(route,url);
     target.searchParams.set('group',url.searchParams.get('group')||1);
     target.searchParams.set('controlled','1');
     lastStageCommand=key;
     frame.contentWindow.location.replace(target.href);
     return;
   }
   if(!['evaluation','awards'].includes(command.phase))return;
   lastStageCommand=null;
   if(!url.pathname.endsWith('/evaluation.html')){
     if(await frame.contentWindow.prepareClassNavigation?.()===false)return;
     frame.contentWindow.location.replace('evaluation.html?group='+(url.searchParams.get('group')||1));
   }else frame.contentWindow.dispatchEvent(new frame.contentWindow.CustomEvent('class-command',{detail:command}));
 }catch{
   retryAfter=Date.now()+failureDelay;
   failureDelay=Math.min(60000,failureDelay*2);
 }finally{checking=false;}
}
setInterval(check,2000);
window.addEventListener('focus',()=>void check(true));
window.addEventListener('online',()=>{nextWatchAttempt=0;retryAfter=0;void check(true);});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stopCommandWatch();
 else {nextWatchAttempt=0;void check(true);}
});
window.addEventListener('pagehide',stopCommandWatch);
