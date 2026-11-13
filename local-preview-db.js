// Loopback preview is deliberately isolated from the production environment.
export const isLocalPreview = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const prefix='food-preview-db-v1:';
const listeners=new Set();
const bus=isLocalPreview&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('food-preview-db-v1'):null;
const clone=value=>JSON.parse(JSON.stringify(value));
function notify(){for(const callback of listeners)callback();}
bus?.addEventListener('message',notify);
if(isLocalPreview)window.addEventListener('storage',e=>{if(e.key?.startsWith(prefix))notify();});
function read(name){const found=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key.startsWith(prefix+name+':'))continue;try{found.push(JSON.parse(localStorage.getItem(key)));}catch{}}return found;}
function matches(doc,query){return Object.entries(query||{}).every(([key,value])=>value?.$in?value.$in.includes(doc[key]):doc[key]===value);}
function reference(name,query={},id=null){
 const docs=()=>read(name).filter(d=>(id===null||d._id===id)&&matches(d,query));
 const ref={
  doc:next=>reference(name,{},next),where:next=>reference(name,{...query,...next}),limit:()=>ref,orderBy:()=>ref,
  get:async()=>({data:clone(docs())}),
  async set(value){if(id===null)throw Error('需要文档编号');localStorage.setItem(prefix+name+':'+id,JSON.stringify({...clone(value),_id:id}));notify();bus?.postMessage({changed:id});return {updated:1,id};},
  async update(value){return ref.set({...docs()[0],...value});},
  async remove(){for(const doc of docs())localStorage.removeItem(prefix+name+':'+doc._id);notify();bus?.postMessage({changed:id});return {deleted:1};},
  watch({onChange,onError}){let closed=false,last='';const emit=()=>{if(closed)return;try{const next=docs(),signature=JSON.stringify(next);if(signature===last)return;last=signature;onChange({docs:clone(next)});}catch(error){onError?.(error);}};listeners.add(emit);queueMicrotask(emit);return {close(){closed=true;listeners.delete(emit);}};}
 };return ref;
}
export const previewDb={collection:name=>reference(name),command:{in:values=>({$in:values})}};
export function installPreviewCloud(){
 if(!isLocalPreview)return;
 window.cloudbase={init:()=>({auth:()=>({getLoginState:async()=>({local:true}),signInAnonymously:async()=>({local:true})}),database:()=>previewDb})};
 window.loadClassCloud=async()=>window.cloudbase;
 window.__LOCAL_CLASS_PREVIEW__=true;
}
installPreviewCloud();
