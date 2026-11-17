import {cloudDb} from '../student-data.js?v=20261116-tablet-fixes';
import {stages,phases,round,readRemote,writeRemote} from './channel.js?v=after-class-forum';
import {readDocument} from '../evaluation-data.js?v=20261113-awards';
const stopText='跟随 iPad';
const toolbar=document.createElement('div');
toolbar.className='remote-bar';
const follow=document.createElement('button'),fullscreen=document.createElement('button');
for(const button of [follow,fullscreen]){button.type='button';button.className='ev-button';toolbar.append(button);}
follow.textContent=stopText;
fullscreen.textContent='全屏';
let lease, generation=0, busy=false, lastApplied='', lastRenewal=0;
function mount(){
 const tabs=document.querySelector('.ev-tabs');
 if(tabs){tabs.append(toolbar);return true;}
 return false;
}
if(!mount()){
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
 observer.observe(document.body,{subtree:true,childList:true});
}
fullscreen.onclick=()=>window.requestLessonFullscreen?.();
document.addEventListener('fullscreenchange',()=>{fullscreen.textContent=document.fullscreenElement?'退出全屏':'全屏';});
async function stop(){
 const current=lease;
 lease=null;
 generation++;
 lastApplied='';
 follow.textContent=stopText;
 follow.setAttribute('aria-pressed','false');
 if(current){
  const stored=await readRemote();
  if(stored.session===current.session){
   await writeLease(current,0);
   await writeRemote({...stored,expiresAt:0});
  }
 }
}
follow.onclick=async()=>{
 if(follow.disabled)return;
 follow.disabled=true;
 try{
  if(lease){await stop();return;}
  const resetId=await round(),command=await readDocument('class-control');
  const value={resetId,session:crypto.randomUUID(),pairingCode:crypto.randomUUID().slice(0,6),expiresAt:Date.now()+30000,
   stage:stages[phases.indexOf(command.phase)]||stages[0],page:0,group:0,question:command.discussionIndex||0};
  await writeRemote(value);
  lease=value;await writeLease(value,Date.now()+30000);lastRenewal=Date.now();follow.textContent='退出跟随 · '+value.pairingCode;follow.setAttribute('aria-pressed','true');
 }catch{
  lease=null;generation++;follow.setAttribute('aria-pressed','false');
  follow.textContent='跟随 iPad · 重试';
 }finally{follow.disabled=false;}
};
async function check(){
 if(!lease||busy||document.hidden)return;
 busy=true;
 const active=lease,version=generation;
 try{
  const current=await readRemote();
  if(generation!==version)return;
  if(current.session!==active.session){await stop();return;}
  if(Date.now()-lastRenewal>10000){
   // Lease renewals use their own document, so they cannot overwrite a new display command.
   if((await round())!==active.resetId){await stop();return;}
   if(lease!==active)return;
   await writeLease(active,Date.now()+30000);
   lastRenewal=Date.now();
  }
  const key=JSON.stringify([current.stage,current.page,current.group,current.question]);
  if(key!==lastApplied){
   window.dispatchEvent(new CustomEvent('remote-display-state',{detail:current}));
   lastApplied=key;
  }
 }catch{/* Keep the current display during connection interruptions. */}
 finally{busy=false;}
}
async function writeLease(active,expiresAt){
 const db=await cloudDb();
 if(expiresAt&&lease!==active)return;
 const result=await db.collection('food-journey-groups').doc('class-display-lease').set({session:active.session,resetId:active.resetId,expiresAt});
 if(result?.code)throw Error(result.message);
}
setInterval(check,750);
