import {cloudDb,groupId} from './student-data.js?v=20261109-ui3';
export const LIVE_COLLECTION='food-journey-groups';
const CONTROL='live-view-control';
export const liveDocumentId=(id,phase)=>`live-group-${id}-${phase}`;
export function selectedGroups(control){return control&&control.expiresAt>Date.now()?control.groups||[]:[];}
export function createStudentPublisher({groupId:id,getState,capture,onStatus=()=>{}}){
 let control=null,watcher=null,latest=null,lastSignature='',lastAt=0,writing=false,stopped=false,timer=null,retryAt=0;
 async function connect(){
  if(stopped||watcher||Date.now()<retryAt)return;
  retryAt=Date.now()+10000;
  try{const db=await cloudDb();watcher=db.collection(LIVE_COLLECTION).where({_id:CONTROL}).watch({onChange(snapshot){const old=control;control=snapshot.docs?.[0]||null;if(control?.token!==old?.token){lastSignature='';lastAt=0;}void flush();},onError(error){watcher?.close();watcher=null;onStatus('连接中断');retryAt=Date.now()+10000;}});}catch{onStatus('等待连接');}
 }
 async function flush(){
  if(stopped||writing)return;
  const state=getState?.()||latest;
  if(!state||!['v1','v2','observation','journey'].includes(state.phase)||!selectedGroups(control).includes(Number(id))||control.phase!==state.phase)return;
  const signature=JSON.stringify(state),gap=control.focus?1000:3000;
  if(signature===lastSignature||Date.now()-lastAt<gap)return;
  writing=true;lastAt=Date.now();
  try{const db=await cloudDb();const image=capture?.(state)||null;const result=await db.collection(LIVE_COLLECTION).doc(liveDocumentId(id,state.phase)).set({kind:'lesson-live',groupId:Number(id),phase:state.phase,resetId:control.resetId||null,token:control.token,state:{...JSON.parse(signature),image},updatedAt:Date.now()});if(result?.code)throw Error(result.message||'同步失败');lastSignature=signature;onStatus('已同步');}catch{onStatus('同步暂未完成');}finally{writing=false;}
 }
 const listener=e=>{latest=e.detail;void flush();};window.addEventListener('lesson-live-state',listener);
 timer=setInterval(()=>{void connect();void flush();},250);void connect();
 return {update(state){latest=state;void flush();},close(){stopped=true;clearInterval(timer);watcher?.close();window.removeEventListener('lesson-live-state',listener);}};
}
export async function writeTeacherFocus({phase,groups,focus=false,resetId=null,token}){
 const db=await cloudDb();const result=await db.collection(LIVE_COLLECTION).doc(CONTROL).set({kind:'lesson-live-control',phase,groups,focus,resetId,token,expiresAt:groups.length?Date.now()+45000:0});if(result?.code)throw Error(result.message||'同步失败');
}
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
if(!teacher){
 const publisher=createStudentPublisher({groupId,getState:()=>window.readLiveModel?.()||window.readLiveObservation?.(),capture:state=>window.captureLessonLive?.(state)});
 window.addEventListener('pagehide',()=>publisher.close());
}
