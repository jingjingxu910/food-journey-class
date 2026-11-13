import {journeyEvents} from './evaluation-data.js?v=20261113-awards';
import {cloudDb} from './student-data.js?v=20261109-ui3';
import {isLocalPreview} from './local-preview-db.js';
import {LIVE_COLLECTION,writeTeacherFocus} from './live-sync.js?v=20261113-four-views';
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={outside:'入口',mouth:'口腔',pharynx:'咽',esophagus:'食管',stomach:'胃',small:'小肠',large:'大肠',done:'旅行完成'};
const organNames={mouth:"口腔",esophagus:"食管",stomach:"胃","small-intestine":"小肠","large-intestine":"大肠","nasal-cavity":"鼻腔",trachea:"气管","right-lung":"右肺","left-lung":"左肺",pharynx:"咽",liver:"肝",pancreas:"胰",gallbladder:"胆囊",heart:"心脏",submandibular:"下颌下腺","left-kidney":"左肾","right-kidney":"右肾",bladder:"膀胱"};
const scenes={outside:'outside.webp',mouth:'mouth.webp',pharynx:'pharynx-mouth-style-v5.webp',esophagus:'esophagus.webp',stomach:'stomach.webp',small:'small-intestine.webp',large:'large-intestine.webp',done:'outside.webp'};
if(teacher)setup();
function setup(){
 const host=document.querySelector('#teacher-view');if(!host)return;
 const wall=document.createElement('section');wall.className='live-wall';wall.hidden=true;
 wall.innerHTML='<div class="live-toolbar"><div><h2>小组同步预览</h2></div><nav class="live-pages" aria-label="同步预览分页"><button data-page="0">第 1–6 组</button><button data-page="1">第 7–12 组</button></nav></div><p class="live-notice" role="status" aria-live="polite"></p><div class="live-grid"></div>';
 host.append(wall);
 const dialog=document.createElement('dialog');dialog.className='live-focus';dialog.innerHTML='<header><h2></h2><button type="button">返回小组预览</button></header><div class="live-focus-content"></div>';document.body.append(dialog);
 let phase=window.currentTeacherLivePhase||null,page=0,focus=null,resetId=null,records=[],snapshots=new Map(),watcher=null,watchVersion=0,token='',initial=true,demo=false;
 const seen=new Map(),unread=new Map(),flashes=new Map(),demoSubmitted=new Set();let lastControl='',controlBusy=false,controlAgain=false;
 const focusedNotice=document.createElement('p');focusedNotice.className='live-notice';focusedNotice.setAttribute('role','status');dialog.querySelector('header').after(focusedNotice);
 const stageLabel=()=>({v1:'初始模型',observation:'AR观察',v2:'修正模型',journey:'食物旅行'}[phase]||'');
 let pageSize=6;
 const groupIds=()=>Array.from({length:Math.min(pageSize,12-page*pageSize)},(_,i)=>page*pageSize+i+1);
 const visible=()=>phase&&!document.hidden?(focus?[focus]:groupIds()):[];
 const recordFor=id=>records.filter(r=>Number(r.groupId)===id).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
 const completion=(id,p=phase)=>recordFor(id)?.[p]?.completedAt||null;
 function stateFor(id){
  if(demo)return demoState(id,phase);
  const current=snapshots.get(id),record=recordFor(id),saved=record?.[phase];
  if(!saved?.completedAt&&current?.phase===phase&&(current.resetId||null)===(resetId||null))return current.state;
  if(saved&&phase==='observation')return {phase,completed:!!saved.completedAt,organs:[...new Set((saved.views||[]).map(view=>view.organId))].filter(id=>Object.hasOwn(organNames,id))};
  if(saved)return phase==='journey'?{phase,stage:saved.stage||'done',hint:'本组已保存的探索记录',completed:!!saved.completedAt,progress:saved.completedAt?1:0}:{phase,model:saved,completed:!!saved.completedAt};
  return null;
 }
 function journeyAnalysis(record,expanded){
  const labels={identify:'辨认器官',locate:'查看定位图',look:'转动观察',backward:'回头观察','fork-side-view':'查看咽部侧面图','villi-detail':'观察小肠绒毛',airway:'尝试气管路线','safe-swallow':'选择食管','stomach-wall':'观察胃壁运动','stomach-fluid':'观察胃液','stomach-complete':'完成胃部探索',peristalsis:'观察食管蠕动','nutrient-absorption':'观察营养吸收','water-absorption':'观察水分吸收',vomit:'观察呕吐并重试'};
  const events=journeyEvents(record).filter(event=>Object.hasOwn(labels,event.type));
  if(!events.length)return '<p>本组已完成旅行，暂无探索行为记录。</p>';
  const counts=new Map();
  for(const event of events)counts.set(event.type,(counts.get(event.type)||0)+1);
  const items=[...counts].map(([type,count])=>'<li>'+labels[type]+' '+count+' 次</li>');
  return '<section class="live-analysis"><strong>探索行为</strong><ul>'+items.slice(0,expanded?items.length:4).join('')+'</ul>'+(expanded?'<h3>探索过程</h3><ol>'+events.map(event=>'<li>'+labels[event.type]+(event.choice?' · '+escape(event.choice):'')+'</li>').join('')+'</ol>':'')+'</section>';
 }
 function preview(state,id,submitted,expanded=false){
  const record=demo&&['v1','v2'].includes(phase)?{v1:demoState(id,'v1').model,v2:demoState(id,'v2').model}:recordFor(id);
  if(submitted&&phase==='journey')return journeyAnalysis(record?.journey,expanded);
  const analysis=submitted&&['v1','v2'].includes(phase)?window.renderSubmittedModelAnalysis?.(record,phase)||'':'';
  const summary=analysis?'<div class="live-analysis"><strong>行为与路线分析</strong>'+analysis+'</div>':'';

  const image=typeof state?.image==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(state.image)?state.image:null;
  if(phase==='v2'){
   const before=demo?demoState(id,'v1').model:record?.v1?.completedAt?record.v1:null;
   const after=submitted&&!demo?record?.v2:state?.model;
   return (window.renderLiveComparison?.(before,after)||'')+summary;
  }
  if(!state)return '<div class="live-empty"><span>◌</span><b>等待本组进入</b></div>';
  if(state.phase==='observation'){
   if(submitted){
    const organs=state.organs||[state.organId].filter(id=>Object.hasOwn(organNames,id));
    return '<section class="live-findings"><strong>本组发现</strong><div>'+organs.map(id=>'<figure><img src="assets/models/ar-thumbnails/'+id+'.png" alt=""><figcaption>'+organNames[id]+'</figcaption></figure>').join('')+'</div></section>';
   }
   const organ=/^[a-z-]+$/.test(state.organId||'')?state.organId:null;
   const src=image||(organ?'assets/models/ar-thumbnails/'+organ+'.png':'');
   return src?'<div class="live-scene live-capture"><img src="'+src+'" alt="'+escape(state.organName||'器官观察')+'"></div><p class="live-game-copy">'+escape(state.organName||'器官观察')+'</p>':'<div class="live-empty">'+(state.completed?'观察完成':'观察身体里的器官')+'</div>';
  }
  if(state.phase!=='journey')return (window.renderLiveModel?.(state.model)||'<div class="live-empty">模型正在准备</div>')+summary;
  if(state.stage!=='done'&&image)return '<div class="live-scene live-capture"><img src="'+image+'" alt="'+escape(names[state.stage]||'旅行场景')+'"></div><p class="live-game-copy">'+escape(state.hint||names[state.stage]||'食物旅行')+'</p>';
  if(state.stage==='done')return '<div class="live-completed"><strong>旅行完成</strong><div>'+[0,3,5,6,7].map(index=>'<span class="live-food-sprite" style="background-position:'+index%4/3*100+'% '+Math.floor(index/4)*100+'%"></span>').join('')+'</div></div>';
  const scene=scenes[state.stage]||scenes.outside;
  const food=state.foodName||({whole:'一块饼干',crumbs:'湿润碎块',bolus:'湿润食团',chyme:'食糜',residue:'剩余内容物',dry:'残渣'}[state.food]||'食物正在变化');
  const foodKey=({crumbs:'pieces','fine-chyme':'chyme'}[state.food]||state.food),index=Math.max(0,['whole','chunks','pieces','bolus','gastric','chyme','residue','dry'].indexOf(foodKey));
  return `<div class="live-scene"><img src="assets/journey/${scene}" alt="${escape(names[state.stage]||'旅行场景')}" onerror="this.style.visibility='hidden'"><span class="live-scene-label">${escape(names[state.stage]||'旅行中')}</span><span class="live-food-sprite" style="background-position:${index%4/3*100}% ${Math.floor(index/4)*100}%" aria-hidden="true"></span></div><p class="live-game-copy"><strong>${escape(food)}</strong><br>${escape(state.hint||'正在探索')}</p><progress class="live-progress" max="1" value="${Math.max(0,Math.min(1,Number(state.progress)||0))}" aria-label="当前场景行进进度"></progress>`;
 }
 function render(){
  wall.hidden=!phase;document.body.classList.toggle('teacher-live-active',!!phase);
  if(!phase)return;
  wall.querySelector('h2').textContent=stageLabel();
  const available=Math.max(120,innerHeight-wall.getBoundingClientRect().top-(document.querySelector('.ev-stars')?.offsetHeight||0)-12);
  pageSize=innerWidth>=1100?6:innerWidth>=680&&available>=365?6:innerWidth>=680?3:available>=440?4:2;
  page=Math.min(page,Math.ceil(12/pageSize)-1);
  wall.style.setProperty('--live-columns',innerWidth>=1100?6:innerWidth>=680?3:2);
  wall.style.setProperty('--live-rows',Math.ceil(pageSize/(innerWidth>=1100?6:innerWidth>=680?3:2)));
  wall.style.setProperty('--live-height',available+'px');
  const pages=wall.querySelector('.live-pages');
  pages.innerHTML=Array.from({length:Math.ceil(12/pageSize)},(_,p)=>{
   const count=[...unread.keys()].filter(key=>key.startsWith(phase+':')&&Math.floor((Number(key.split(':')[1])-1)/pageSize)===p).length;
   return '<button data-page="'+p+'" aria-current="'+(p===page?'page':'false')+'">第 '+(p*pageSize+1)+'–'+Math.min(12,(p+1)*pageSize)+' 组'+(count?'<small>'+count+' 组新提交</small>':'')+'</button>';
  }).join('');
  const grid=wall.querySelector('.live-grid');
  grid.dataset.phase=phase;
  grid.innerHTML=groupIds().map(id=>{
   const submitted=demo?(id%4===0||demoSubmitted.has(phase+':'+id)):!!completion(id),key=phase+':'+id,isUnread=unread.has(key),flash=Date.now()-(flashes.get(key)||0)<3200;
   return `<button type="button" class="live-card${submitted?' is-submitted':''}${isUnread?' is-unread':''}${flash?' is-new':''}" data-group="${id}" aria-label="放大第 ${id} 组"><header><strong>第 ${id} 组</strong><span class="live-status">${isUnread?'✓ 新提交':submitted?'✓ 已提交':stateFor(id)?'探索中':'等待进入'}</span></header>${preview(stateFor(id),id,submitted)}</button>`;
  }).join('');
  focusedNotice.textContent=wall.querySelector('.live-notice').textContent;
  if(focus){dialog.querySelector('h2').textContent=`第 ${focus} 组 · ${stageLabel()}`;dialog.querySelector('.live-focus-content').innerHTML=preview(stateFor(focus),focus,demo?(focus%4===0||demoSubmitted.has(phase+':'+focus)):!!completion(focus),true);}
 }
 async function control(force=false){
  const groups=demo?[]:visible().filter(id=>!completion(id)),signature=JSON.stringify([phase,groups,focus,resetId]);
  if(!force&&signature===lastControl)return;
  if(controlBusy){controlAgain=true;return;}controlBusy=true;
  try{if(signature!==lastControl)token=`view-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;await writeTeacherFocus({phase,groups,focus:!!focus,resetId,token});lastControl=signature;}catch{lastControl='';}finally{controlBusy=false;if(controlAgain){controlAgain=false;void control(true);}}
 }
 async function subscribe(){
  const version=++watchVersion;watcher?.close();watcher=null;snapshots.clear();if(!phase||demo)return;
  try{const db=await cloudDb();if(version!==watchVersion)return;watcher=db.collection(LIVE_COLLECTION).where({kind:'lesson-live',phase}).watch({onChange(snapshot){if(version!==watchVersion)return;for(const doc of snapshot.docs||[]){const id=Number(doc.groupId);if(!completion(id)||!snapshots.has(id))snapshots.set(id,doc);}render();},onError(){if(version!==watchVersion)return;watcher?.close();watcher=null;render();}});}catch{render();}
 }
 async function selectPhase(next){if(next===phase){render();return;}phase=next;focus=null;if(dialog.open)dialog.close();lastControl='';await subscribe();render();void control();}
 window.addEventListener('teacher-live-phase',e=>void selectPhase(e.detail));
 window.addEventListener('lesson-records',e=>{
  const oldRound=resetId;resetId=e.detail.resetId||null;if(oldRound!==resetId){seen.clear();unread.clear();initial=true;snapshots.clear();lastControl='';}
  records=e.detail.records||[];
  const added=[];
  for(let id=1;id<=12;id++)for(const p of ['v1','observation','v2','journey']){const at=completion(id,p),key=p+':'+id,old=seen.get(key);if(at&&old&&old!==at||at&&!old&&!initial){unread.set(key,at);flashes.set(key,Date.now());added.push(`第 ${id} 组${{v1:' 初始模型',observation:' AR观察',v2:' 修正模型',journey:' 食物旅行'}[p]}`);}seen.set(key,at);}
  initial=false;if(added.length)wall.querySelector('.live-notice').textContent=added.join('、')+'已提交';render();if(added.length)setTimeout(render,3400);void control();
 });
 wall.addEventListener('click',e=>{const pager=e.target.closest('[data-page]');if(pager){page=Number(pager.dataset.page);focus=null;render();void control();return;}const card=e.target.closest('[data-group]');if(card){focus=Number(card.dataset.group);unread.delete(phase+':'+focus);render();dialog.showModal();void control();}});
 dialog.querySelector('header button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{focus=null;window.speechSynthesis?.cancel();render();void control();});
 window.addEventListener('resize',()=>{render();void control();});
 const heartbeat=setInterval(()=>{if(!document.hidden){void control(true);if(!watcher&&phase&&!demo)void subscribe();}},20000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){watchVersion++;watcher?.close();watcher=null;}else void subscribe();void control(true);});
 window.addEventListener('pagehide',()=>{clearInterval(heartbeat);watcher?.close();void writeTeacherFocus({phase:null,groups:[],token});});
 if(isLocalPreview){
  const row=document.createElement('div');row.className='live-demo-actions';row.innerHTML='<span class="live-demo-badge">本地预览 · 云端已隔离</span><button type="button">显示 12 组演示</button><button type="button" hidden>模拟另一页提交</button>';wall.querySelector('.live-toolbar').append(row);
  const buttons=row.querySelectorAll('button');buttons[0].onclick=()=>{demo=!demo;buttons[0].textContent=demo?'返回本地真实小组':'显示 12 组演示';buttons[1].hidden=!demo;void subscribe();render();void control();};buttons[1].onclick=()=>{const id=page===0?pageSize+1:1,key=phase+':'+id;demoSubmitted.add(key);unread.set(key,Date.now());flashes.set(key,Date.now());wall.querySelector('.live-notice').textContent=`演示：第 ${id} 组已提交，另一页已标记`;render();};
 }
 render();void subscribe();void control();
}
function demoState(id,phase){
 if(phase==='observation'){const organs=['mouth','esophagus','stomach','small-intestine','large-intestine','pharynx'];return {phase,organId:organs[(id-1)%6],organName:['口腔','食管','胃','小肠','大肠','咽'][(id-1)%6]};}
 if(phase==='journey'){const stages=['mouth','esophagus','stomach','small','large','pharynx'];return {phase,stage:stages[(id-1)%6],food:id%6===1?'whole':'chyme',foodName:['湿润碎块','湿润食团','分散的食物碎块','更细软的食糜','剩余内容物','湿润食团'][(id-1)%6],hint:['快看！饼干变碎的同时，也变湿润了。','食管的内壁正在把食团向下推。','胃壁运动，让食物与胃液充分混合。','仔细观察，营养物质正在被吸收。','留下的内容物还会怎样变化？','前面是气管，后面是食管。'][(id-1)%6],progress:(id%5+1)/6};}
 const startedAt=1700000000000;
 const positions={mouth:{x:50,y:14},esophagus:{x:50,y:28},stomach:{x:57,y:43},'small-intestine':{x:50+(id%3-1)*2,y:55},'large-intestine':{x:50,y:55}};
 if(phase==='v2')Object.assign(positions,{stomach:{x:61,y:44},nose:{x:50,y:9},trachea:{x:48,y:26},lungs:{x:50,y:34}});
 return {phase,model:{positions,startedAt,completedAt:startedAt+(45+id*3+(phase==='v2'?18:0))*1000,visualStyle:{},routePoints:[{x:50,y:14},{x:50,y:29},{...positions.stomach},{x:50,y:55},{x:56,y:58},{x:43,y:55},{x:41,y:49},{x:60,y:49},{x:60,y:61},{x:50,y:64}],structureStrokes:[],modificationCount:id*2}};
}
