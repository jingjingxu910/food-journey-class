import {cloudDb} from './student-data.js?v=20261109-ui3';
import {isLocalPreview} from './local-preview-db.js';
import {LIVE_COLLECTION,writeTeacherFocus} from './live-sync.js';
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={outside:'入口',mouth:'口腔',pharynx:'咽',esophagus:'食管',stomach:'胃',small:'小肠',large:'大肠',done:'旅行完成'};
const scenes={outside:'outside.webp',mouth:'mouth.webp',pharynx:'pharynx-mouth-style-v5.webp',esophagus:'esophagus.webp',stomach:'stomach.webp',small:'small-intestine.webp',large:'large-intestine.webp',done:'outside.webp'};
if(teacher)setup();
function setup(){
 const host=document.querySelector('#teacher-view');if(!host)return;
 const wall=document.createElement('section');wall.className='live-wall';wall.hidden=true;
 wall.innerHTML='<div class="live-toolbar"><div><h2>小组同步预览</h2><p class="live-meta"></p></div><nav class="live-pages" aria-label="同步预览分页"><button data-page="0">第 1–6 组</button><button data-page="1">第 7–12 组</button></nav></div><p class="live-notice" role="status" aria-live="polite"></p><div class="live-grid"></div>';
 host.append(wall);
 const dialog=document.createElement('dialog');dialog.className='live-focus';dialog.innerHTML='<header><h2></h2><button type="button">返回六组预览</button></header><p class="live-meta">正在关注本组，其他组暂停过程上传；所有组提交仍会提醒。</p><div class="live-focus-content"></div>';document.body.append(dialog);
 let phase=window.currentTeacherLivePhase||null,page=0,focus=null,resetId=null,records=[],snapshots=new Map(),watcher=null,watchVersion=0,token='',initial=true,connected=false,demo=false;
 const seen=new Map(),unread=new Map(),flashes=new Map(),demoSubmitted=new Set();let lastControl='',controlBusy=false,controlAgain=false;
 const focusedNotice=document.createElement('p');focusedNotice.className='live-notice';focusedNotice.setAttribute('role','status');dialog.querySelector('header').after(focusedNotice);
 const stageLabel=()=>({v1:'V1 · 初始模型',v2:'V2 · 修正模型',journey:'游戏 · 食物旅行'}[phase]||'');
 const visible=()=>phase&&!document.hidden?(focus?[focus]:Array.from({length:6},(_,i)=>page*6+i+1)):[];
 const recordFor=id=>records.filter(r=>Number(r.groupId)===id).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
 const completion=(id,p=phase)=>recordFor(id)?.[p]?.completedAt||null;
 function stateFor(id){
  if(demo)return demoState(id,phase);
  const current=snapshots.get(id),record=recordFor(id),saved=record?.[phase];
  if(current?.phase===phase&&(current.resetId||null)===(resetId||null))return current.state;
  if(saved)return phase==='journey'?{phase,stage:saved.stage||'done',hint:'本组已保存的探索记录',completed:!!saved.completedAt,progress:saved.completedAt?1:0}:{phase,model:saved,completed:!!saved.completedAt};
  return null;
 }
 function preview(state,id,submitted){
  if(phase==='v2'){
   const record=recordFor(id);
   const before=demo?demoState(id,'v1').model:record?.v1?.completedAt?record.v1:null;
   const after=submitted?(demo?state?.model:record?.v2):null;
   return window.renderLiveComparison?.(before,after)||'';
  }
  if(!state)return '<div class="live-empty"><span>◌</span><b>等待本组进入</b><small>收到操作后会显示当前画面</small></div>';
  if(state.phase!=='journey')return window.renderLiveModel?.(state.model)||'<div class="live-empty">模型正在准备</div>';
  const scene=scenes[state.stage]||scenes.outside;
  const food=state.foodName||({whole:'一块饼干',crumbs:'湿润碎块',bolus:'湿润食团',chyme:'食糜',residue:'剩余内容物',dry:'残渣'}[state.food]||'食物正在变化');
  const foodKey=({crumbs:'pieces','fine-chyme':'chyme'}[state.food]||state.food),index=Math.max(0,['whole','chunks','pieces','bolus','gastric','chyme','residue','dry'].indexOf(foodKey));
  return `<div class="live-scene"><img src="assets/journey/${scene}" alt="${escape(names[state.stage]||'旅行场景')}" onerror="this.style.visibility='hidden'"><span class="live-scene-label">${escape(names[state.stage]||'旅行中')}</span><span class="live-food-sprite" style="background-position:${index%4/3*100}% ${Math.floor(index/4)*100}%" aria-hidden="true"></span></div><p class="live-game-copy"><strong>${escape(food)}</strong><br>${escape(state.hint||'正在探索')}</p><progress class="live-progress" max="1" value="${Math.max(0,Math.min(1,Number(state.progress)||0))}" aria-label="当前场景行进进度"></progress>`;
 }
 function updateAge(id){
  if(demo)return '演示画面 · 不写入课堂记录';
  const snap=snapshots.get(id);if(!snap)return completion(id)?'已提交的作品':'尚未收到过程数据';
  const seconds=Math.max(0,Math.floor((Date.now()-snap.updatedAt)/1000));
  return `${seconds<60?seconds+' 秒前':Math.floor(seconds/60)+' 分钟前'}更新${!connected?' · 连接中断，保留最后画面':snap.token!==token?' · 等待最新画面':' · 无操作时画面保持'}`;
 }
 function render(){
  wall.hidden=!phase;document.body.classList.toggle('teacher-live-active',!!phase);
  if(!phase)return;
  wall.querySelector('h2').textContent=stageLabel()+' · '+(focus?'单组关注':'六组预览');
  wall.querySelector('.live-meta').textContent=(demo?'本地演示 · ':'')+(focus?'仅第 '+focus+' 组同步，约 1 秒更新':'当前页有变化时约 3 秒更新')+' · 提交即时提醒 · 点击小组放大';
  for(const button of wall.querySelectorAll('[data-page]')){const p=Number(button.dataset.page),count=[...unread.keys()].filter(key=>key.startsWith(phase+':')&&Math.floor((Number(key.split(':')[1])-1)/6)===p).length;button.innerHTML=`第 ${p*6+1}–${p*6+6} 组${count?`<small>${count} 组新提交</small>`:''}`;button.setAttribute('aria-current',p===page?'page':'false');}
  const grid=wall.querySelector('.live-grid');grid.dataset.phase=phase;grid.innerHTML=Array.from({length:6},(_,i)=>page*6+i+1).map(id=>{
   const submitted=demo?(id%4===0||demoSubmitted.has(phase+':'+id)):!!completion(id),key=phase+':'+id,isUnread=unread.has(key),flash=Date.now()-(flashes.get(key)||0)<3200;
   return `<button type="button" class="live-card${submitted?' is-submitted':''}${isUnread?' is-unread':''}${flash?' is-new':''}" data-group="${id}" aria-label="放大第 ${id} 组"><header><strong>第 ${id} 组</strong><span class="live-status">${isUnread?'✓ 新提交':submitted?'✓ 已提交':phase==='v2'?'尚未提交':stateFor(id)?'探索中':'等待进入'}</span></header>${preview(stateFor(id),id,submitted)}<p class="live-updated">${escape(updateAge(id))}</p></button>`;
  }).join('');
  focusedNotice.textContent=wall.querySelector('.live-notice').textContent;
  if(focus){dialog.querySelector('h2').textContent=`第 ${focus} 组 · ${stageLabel()}`;dialog.querySelector('.live-focus-content').innerHTML=preview(stateFor(focus),focus,demo?(focus%4===0||demoSubmitted.has(phase+':'+focus)):!!completion(focus))+`<p class="live-updated">${escape(updateAge(focus))}</p>`;}
 }
 async function control(force=false){
  const groups=demo?[]:visible(),signature=JSON.stringify([phase,groups,focus,resetId]);
  if(!force&&signature===lastControl)return;
  if(controlBusy){controlAgain=true;return;}controlBusy=true;
  try{if(signature!==lastControl)token=`view-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;await writeTeacherFocus({phase,groups,focus:!!focus,resetId,token});lastControl=signature;connected=true;}catch{connected=false;lastControl='';wall.querySelector('.live-notice').textContent='同步连接暂不可用，保留最后收到的作品。';}finally{controlBusy=false;if(controlAgain){controlAgain=false;void control(true);}}
 }
 async function subscribe(){
  const version=++watchVersion;watcher?.close();watcher=null;snapshots.clear();if(!phase||demo)return;
  try{const db=await cloudDb();if(version!==watchVersion)return;watcher=db.collection(LIVE_COLLECTION).where({kind:'lesson-live',phase}).watch({onChange(snapshot){if(version!==watchVersion)return;connected=true;for(const doc of snapshot.docs||[])snapshots.set(Number(doc.groupId),doc);render();},onError(){if(version!==watchVersion)return;watcher?.close();watcher=null;connected=false;render();}});}catch{connected=false;render();}
 }
 async function selectPhase(next){if(next===phase){render();return;}phase=next;focus=null;if(dialog.open)dialog.close();lastControl='';await subscribe();render();void control();}
 window.addEventListener('teacher-live-phase',e=>void selectPhase(e.detail));
 window.addEventListener('lesson-records',e=>{
  const oldRound=resetId;resetId=e.detail.resetId||null;if(oldRound!==resetId){seen.clear();unread.clear();initial=true;snapshots.clear();lastControl='';}
  records=e.detail.records||[];
  const added=[];
  for(let id=1;id<=12;id++)for(const p of ['v1','v2','journey']){const at=completion(id,p),key=p+':'+id,old=seen.get(key);if(at&&old&&old!==at||at&&!old&&!initial){unread.set(key,at);flashes.set(key,Date.now());added.push(`第 ${id} 组${{v1:' V1',v2:' V2',journey:'游戏'}[p]}`);}seen.set(key,at);}
  initial=false;if(added.length)wall.querySelector('.live-notice').textContent=added.join('、')+'已提交';render();void control();
 });
 wall.addEventListener('click',e=>{const pager=e.target.closest('[data-page]');if(pager){page=Number(pager.dataset.page);focus=null;render();void control();return;}const card=e.target.closest('[data-group]');if(card){focus=Number(card.dataset.group);unread.delete(phase+':'+focus);render();dialog.showModal();void control();}});
 dialog.querySelector('header button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{focus=null;window.speechSynthesis?.cancel();render();void control();});
 const heartbeat=setInterval(()=>{if(!document.hidden){void control(true);if(!watcher&&phase&&!demo)void subscribe();}},20000);
 const clock=setInterval(()=>{for(const card of wall.querySelectorAll('[data-group]'))card.querySelector('.live-updated').textContent=updateAge(Number(card.dataset.group));},1000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){watchVersion++;watcher?.close();watcher=null;}else void subscribe();void control(true);});
 window.addEventListener('pagehide',()=>{clearInterval(heartbeat);clearInterval(clock);watcher?.close();void writeTeacherFocus({phase:null,groups:[],token});});
 if(isLocalPreview){
  const row=document.createElement('div');row.className='live-demo-actions';row.innerHTML='<span class="live-demo-badge">本地预览 · 云端已隔离</span><button type="button">显示 12 组演示</button><button type="button" hidden>模拟另一页提交</button>';wall.querySelector('.live-toolbar').append(row);
  const buttons=row.querySelectorAll('button');buttons[0].onclick=()=>{demo=!demo;buttons[0].textContent=demo?'返回本地真实小组':'显示 12 组演示';buttons[1].hidden=!demo;void subscribe();render();void control();};buttons[1].onclick=()=>{const id=page===0?9:3,key=phase+':'+id;demoSubmitted.add(key);unread.set(key,Date.now());flashes.set(key,Date.now());wall.querySelector('.live-notice').textContent=`演示：第 ${id} 组已提交，另一页已标记`;render();};
 }
 render();void subscribe();void control();
}
function demoState(id,phase){
 if(phase==='journey'){const stages=['mouth','esophagus','stomach','small','large','pharynx'];return {phase,stage:stages[(id-1)%6],food:id%6===1?'whole':'chyme',foodName:['湿润碎块','湿润食团','分散的食物碎块','更细软的食糜','剩余内容物','湿润食团'][(id-1)%6],hint:['快看！饼干变碎的同时，也变湿润了。','食管的内壁正在把食团向下推。','胃壁运动，让食物与胃液充分混合。','仔细观察，营养物质正在被吸收。','留下的内容物还会怎样变化？','前面是气管，后面是食管。'][(id-1)%6],progress:(id%5+1)/6};}
 const positions={mouth:{x:50,y:14},esophagus:{x:50,y:28},stomach:{x:57,y:43},'small-intestine':{x:50+(id%3-1)*2,y:55},'large-intestine':{x:50,y:55}};
 if(phase==='v2')Object.assign(positions,{nose:{x:50,y:9},trachea:{x:48,y:26},lungs:{x:50,y:34}});
 return {phase,model:{positions,visualStyle:{},routePoints:[{x:50,y:14},{x:50,y:29},{x:57,y:43},{x:50,y:55},{x:56,y:58},{x:43,y:55},{x:41,y:49},{x:60,y:49},{x:60,y:61},{x:50,y:64}],structureStrokes:[],modificationCount:id*2}};
}
