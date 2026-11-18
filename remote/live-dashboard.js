import {chewForms,chewLabels,chewStep} from '../journey-chew-stages.js';
import {journeyEvents} from '../evaluation-data.js?v=award-journey-evidence';
import {cloudDb} from '../student-data.js?v=20261116-tablet-fixes';
import {isLocalPreview} from '../local-preview-db.js';
import {LIVE_COLLECTION,writeTeacherFocus} from '../live-sync.js?v=20261118-classroom-review';
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={outside:'入口',mouth:'口腔',pharynx:'咽',esophagus:'食管',stomach:'胃',small:'小肠',large:'大肠',done:'旅行完成'};
const organNames={mouth:"口腔",esophagus:"食管",stomach:"胃","small-intestine":"小肠","large-intestine":"大肠","nasal-cavity":"鼻腔",trachea:"气管","right-lung":"右肺","left-lung":"左肺",pharynx:"咽",liver:"肝",pancreas:"胰",gallbladder:"胆囊",heart:"心脏",submandibular:"下颌下腺","left-kidney":"左肾","right-kidney":"右肾",bladder:"膀胱"};
if(teacher)setup();
function setup(){
 const host=document.querySelector('#teacher-view');if(!host)return;
 const wall=document.createElement('section');wall.className='live-wall';wall.hidden=true;
 wall.innerHTML='<div class="live-toolbar"><div><h2>小组同步预览</h2></div><nav class="live-pages" aria-label="同步预览分页"><button data-page="0">第 1–6 组</button><button data-page="1">第 7–12 组</button></nav></div><div class="live-grid"></div>';
 host.append(wall);
 const dialog=document.createElement('dialog');dialog.className='live-focus';dialog.innerHTML='<header><h2></h2><button type="button">返回小组预览</button></header><div class="live-focus-content"></div>';document.body.append(dialog);
 const gameFrame=document.createElement('iframe');
 gameFrame.className='live-game-frame';
 gameFrame.title='学生游戏画面';
 gameFrame.hidden=true;
 const gameViewport=document.createElement('div');
 gameViewport.className='live-game-viewport';
 gameViewport.hidden=true;
 gameViewport.append(gameFrame);
 dialog.querySelector('.live-focus-content').before(gameViewport);
 let gameSrc='';
 const renderedStages=new WeakMap();
 const sentStates=new WeakMap();
 const previewImages={outside:'outside.webp',mouth:'mouth.webp',pharynx:'pharynx-mouth-style-v5.webp',esophagus:'esophagus-wall-v9.webp',stomach:'stomach.webp',small:'small-mucosa-v3.webp',large:'large-intestine.webp'};
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.channel!=='journey-rendered')return;
  const frame=[gameFrame,...wall.querySelectorAll('iframe')].find(item=>item.contentWindow===event.source);
  if(!frame)return;
  renderedStages.set(frame,event.data.stage);
  if(sentStates.get(frame)?.stage===event.data.stage)frame.style.opacity='1';
 });
 function setGamePlaceholder(frame,state){
  const box=frame.parentElement;
  const image=Object.hasOwn(previewImages,state.stage)?previewImages[state.stage]:null;
  const covered=renderedStages.get(frame)===state.stage||!image;
  frame.style.opacity=covered?'1':'0';
  box.style.backgroundImage=image?'url("assets/journey/'+image+'")':'';
  box.style.backgroundSize='cover';
  box.style.backgroundPosition='center';
 }

 function showGame(){
  const state=phase==='journey'&&focus&&stateFor(focus);
  const active=!!state;
  gameViewport.hidden=gameFrame.hidden=!active;
  if(!active){
   if(gameSrc){gameFrame.removeAttribute('src');renderedStages.delete(gameFrame);gameSrc='';}
   return;
  }
  if(!gameSrc){
   gameSrc='journey-game.html?observe=1&layout=landscape&v=game-observer-ready';
   gameFrame.src=gameSrc;
  }
  sendGameState(gameFrame,state);
 }
 gameFrame.onload=showGame;
 function sendGameState(frame,state){
  if(!state)return;
  const expanded=frame===gameFrame;
  const width=expanded?1024:768;
  const height=expanded?576:1024;
  const box=frame.parentElement;
  const scale=Math.min(box.clientWidth/width,box.clientHeight/height);
  if(scale>0){
   frame.style.width=width+'px';
   frame.style.height=height+'px';
   frame.style.transform='translate(-50%, -50%) scale('+scale+')';
  }
  sentStates.set(frame,state);
  setGamePlaceholder(frame,state);
  frame.contentWindow?.postMessage({channel:'journey-observer',state},location.origin);
 }
 function updateGameCards(grid){
  if(phase!=='journey')return;
  for(const card of grid.children){
   const id=Number(card.dataset.group);
   const state=stateFor(id);
   const box=card.querySelector('.live-game-scene');
   if(!box||!state)continue;
   let frame=box.querySelector('iframe');
   if(focus)continue;
   if(!frame){
    frame=document.createElement('iframe');
    frame.title='本组游戏画面';
    frame.className='live-game-card-frame';
    frame.src='journey-game.html?observe=1&v=game-observer-ready';
    frame.onload=()=>{
     if(focus)frame.contentWindow?.postMessage({channel:'journey-observer',paused:true},location.origin);
     else sendGameState(frame,stateFor(id));
    };
    box.replaceChildren(frame);
   }
   sendGameState(frame,state);
  }
 }
 let phase=window.currentTeacherLivePhase||null,page=0,focus=null,resetId=null,records=[],snapshots=new Map(),watcher=null,watchVersion=0,token='',initial=true,demo=false;
 const phaseSnapshots=new Map([[phase,snapshots]]),lastCameraFrames=new Map();
 const seen=new Map(),unread=new Map(),flashes=new Map(),demoSubmitted=new Set();let lastControl='',controlBusy=false,controlAgain=false;
 const stageLabel=()=>({v1:'初始模型',observation:'AR观察',v2:'修正模型',journey:'食物旅行'}[phase]||'');
 let pageSize=6;
 const groupIds=()=>Array.from({length:Math.min(pageSize,12-page*pageSize)},(_,i)=>page*pageSize+i+1);
 const visible=()=>phase&&!document.hidden?(focus?[focus]:groupIds()):[];
 const recordFor=id=>records.filter(r=>Number(r.groupId)===id).sort((a,b)=>b.updatedAt-a.updatedAt)[0];
 const completion=(id,p=phase)=>recordFor(id)?.[p]?.completedAt||null;
 function stateFor(id){
  if(demo){
   const simulated=demoState(id,phase);
   if(phase==='journey'&&(id%4===0||demoSubmitted.has(phase+':'+id)))return {...simulated,stage:'done',progress:1};
   if(phase==='journey'){
    const cycle=(performance.now()/9000+id*.13)%2;
    const progress=1-Math.abs(cycle-1);
    const elapsed=(performance.now()/1000)%8-1;
    const chewing=simulated.stage==='mouth'&&elapsed>=0&&elapsed<4.8;
    const step=chewStep(elapsed);
    const oral=simulated.stage==='mouth'?{food:chewForms[step],foodName:chewLabels[step]}:{};
    return {...simulated,...oral,progress:simulated.stage==='mouth'?step/3:progress,view:{wall:.85,jaw:chewing?.2+.7*Math.abs(Math.sin(elapsed*6)):0,swallow:progress,stomach:{mixed:progress,fluid:true,motion:.85,foodStage:'chyme',routeProgress:.22+progress*.55}}};
   }
   return simulated;
  }
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
  return '<section class="live-analysis live-journey-analysis"><div><strong>探索行为</strong><ul>'+items.slice(0,expanded?items.length:4).join('')+'</ul></div>'+(expanded?'<div><strong>探索过程</strong><ol>'+events.map(event=>'<li>'+labels[event.type]+(event.choice?' · '+escape(event.choice):'')+'</li>').join('')+'</ol></div>':'')+'</section>';
 }
 function preview(state,id,submitted,expanded=false){
  const record=demo&&['v1','v2'].includes(phase)?{v1:demoState(id,'v1').model,v2:demoState(id,'v2').model}:recordFor(id);
  if(submitted&&phase==='journey')return (expanded?'':'<div class="live-scene live-game-scene"></div>')+journeyAnalysis(record?.journey,expanded);
  const withAnalysis=markup=>{
   if(!submitted||!['v1','v2'].includes(phase)||!window.renderSubmittedModelAnalysis)return markup;
   if(expanded)return window.renderSubmittedModelAnalysis(record,phase,markup);
   const metrics=window.renderSubmittedModelAnalysis(record,phase);
   return metrics?markup+'<div class="live-analysis"><strong>行为与路线分析</strong>'+metrics+'</div>':markup;
  };

  if(phase==='v2'){
   const before=demo?demoState(id,'v1').model:record?.v1?.completedAt?record.v1:null;
   const after=submitted&&!demo?record?.v2:state?.model;
   return withAnalysis(window.renderLiveComparison?.(before,after)||'');
  }
  if(!state)return '<div class="live-empty"><span>◌</span><b>等待本组进入</b></div>';
  if(state.phase==='observation'){
   if(submitted){
    const organs=state.organs||[state.organId].filter(id=>Object.hasOwn(organNames,id));
    return '<section class="live-findings"><strong>本组发现</strong><div>'+organs.map(id=>'<figure><img src="assets/models/ar-thumbnails/'+id+'.png" alt=""><figcaption>'+organNames[id]+'</figcaption></figure>').join('')+'</div></section>';
   }
   const organ=/^[a-z-]+$/.test(state.organId||'')?state.organId:null;
   const camera=demo?null:lastCameraFrames.get(id);
   if(camera)return '<div class="live-scene live-camera-still"><img src="'+camera+'" alt="学生相机预览"></div>';
   if(state.sharePreview)return '<div class="live-empty">等待相机画面</div>';
   const src=organ?'assets/models/ar-thumbnails/'+organ+'.png':'';
   return src?'<div class="live-scene live-capture"><img src="'+src+'" alt="'+escape(state.organName||'器官观察')+'"></div><p class="live-game-copy">'+escape(state.organName||'器官观察')+'</p>':'<div class="live-empty">'+(state.completed?'观察完成':'观察身体里的器官')+'</div>';
  }
  if(state.phase!=='journey')return withAnalysis(window.renderLiveModel?.(state.model)||'<div class="live-empty">模型正在准备</div>');
  if(state.stage==='done')return expanded?'':'<div class="live-scene live-game-scene"></div>';
  const food=state.foodName||'食物正在变化';
  const viewport=expanded?'':'<div class="live-scene live-game-scene"></div>';
  return viewport+'<p class="live-game-copy"><strong>'+escape(food)+'</strong><br>'+escape(state.hint||'正在探索')+'</p><progress class="live-progress" max="1" value="'+Math.max(0,Math.min(1,Number(state.progress)||0))+'" aria-label="当前场景行进进度"></progress>';

 }
 function render(){
  wall.hidden=!phase;document.body.classList.toggle('teacher-live-active',!!phase);
  showGame();
  if(!phase)return;
  wall.querySelector('h2').textContent=stageLabel();
  const available=Math.max(120,innerHeight-wall.getBoundingClientRect().top-(document.querySelector('.ev-stars')?.offsetHeight||0)-12);
  pageSize=innerWidth>=1100?6:innerWidth>=680&&available>=365?6:innerWidth>=680?3:available>=440?4:2;
  page=Math.min(page,Math.ceil(12/pageSize)-1);
  wall.style.setProperty('--live-columns',innerWidth>=1100?6:innerWidth>=680?3:2);
  wall.style.setProperty('--live-rows',Math.ceil(pageSize/(innerWidth>=1100?6:innerWidth>=680?3:2)));
  wall.style.setProperty('--live-height',available+'px');
  const rows=Math.ceil(pageSize/(innerWidth>=1100?6:innerWidth>=680?3:2));
  const toolbar=wall.querySelector('.live-toolbar');
  const rowHeight=(available-toolbar.offsetHeight-24)/rows;
  wall.style.setProperty('--game-preview-width',Math.max(75,(rowHeight-116)*.75)+'px');
  const pages=wall.querySelector('.live-pages');
  const pageMarkup=Array.from({length:Math.ceil(12/pageSize)},(_,p)=>{
   const count=[...unread.keys()].filter(key=>key.startsWith(phase+':')&&Math.floor((Number(key.split(':')[1])-1)/pageSize)===p).length;
   return '<button data-page="'+p+'" aria-current="'+(p===page?'page':'false')+'">第 '+(p*pageSize+1)+'–'+Math.min(12,(p+1)*pageSize)+' 组'+(count?'<small>'+count+' 组新提交</small>':'')+'</button>';
  }).join('');
  if(pages.renderedMarkup!==pageMarkup){pages.innerHTML=pageMarkup;pages.renderedMarkup=pageMarkup;}
  const grid=wall.querySelector('.live-grid');
  grid.dataset.phase=phase;
  const markup=focus?grid.renderedMarkup:groupIds().map(id=>{
   const submitted=demo?(id%4===0||demoSubmitted.has(phase+':'+id)):!!completion(id),key=phase+':'+id,isUnread=unread.has(key),flash=Date.now()-(flashes.get(key)||0)<3200;
   return `<button type="button" class="live-card${submitted?' is-submitted':''}${isUnread?' is-unread':''}${flash?' is-new':''}" data-group="${id}" aria-label="放大第 ${id} 组"><header><strong>第 ${id} 组</strong><span class="live-status">${isUnread?'✓ 新提交':submitted?'✓ 已提交':stateFor(id)?'探索中':'等待进入'}</span></header>${preview(stateFor(id),id,submitted)}</button>`;
  }).join('');
  if(!focus&&grid.renderedMarkup!==markup){
   const next=document.createElement('template');
   next.innerHTML=markup;
   const cards=Array.from(next.content.children);
   if(grid.children.length!==cards.length||cards.some((card,index)=>grid.children[index].dataset.group!==card.dataset.group)){
    grid.replaceChildren(next.content);
   }else{
    cards.forEach((card,index)=>{
     const current=grid.children[index];
     if(current.outerHTML===card.outerHTML)return;
     const currentPhoto=current.querySelector('.live-camera-still img'),nextPhoto=card.querySelector('.live-camera-still img');
     if(currentPhoto&&nextPhoto&&current.className===card.className){currentPhoto.src=nextPhoto.src;return;}
     const currentScene=current.querySelector('.live-game-scene');
     const nextScene=card.querySelector('.live-game-scene');
     if(currentScene?.querySelector('iframe')&&nextScene&&grid.renderedPhase===phase){
      current.className=card.className;
      for(const child of [...current.children])if(child!==currentScene)child.remove();
      current.prepend(card.querySelector('header'));
      for(const child of [...card.children])if(child!==nextScene)current.append(child);
     }else current.replaceWith(card);
    });
   }
   grid.renderedMarkup=markup;
   grid.renderedPhase=phase;
  }
  const paused=Boolean(focus);
  if(grid.previewsPaused!==paused){
   grid.previewsPaused=paused;
   for(const frame of grid.querySelectorAll('iframe'))frame.contentWindow?.postMessage({channel:'journey-observer',paused},location.origin);
  }
  if(!paused)updateGameCards(grid);
  if(focus){
   dialog.querySelector('h2').textContent='第 '+focus+' 组 · '+stageLabel();
   const content=dialog.querySelector('.live-focus-content');
   const state=stateFor(focus);
   const previewMarkup=preview(state,focus,demo?(focus%4===0||demoSubmitted.has(phase+':'+focus)):!!completion(focus),true);
   if(content.renderedMarkup!==previewMarkup){
    const photo=content.querySelector('.live-camera-still img');
    if(photo&&previewMarkup.startsWith('<div class="live-scene live-camera-still">'))photo.src=lastCameraFrames.get(focus);
    else content.innerHTML=previewMarkup;
    content.renderedMarkup=previewMarkup;
   }
  }
 }
 async function control(force=false){
  const groups=demo?[]:visible().filter(id=>!completion(id)),signature=JSON.stringify([phase,groups,focus,resetId]);
  if(!force&&signature===lastControl)return;
  if(controlBusy){controlAgain=true;return;}controlBusy=true;
  try{if(signature!==lastControl)token=crypto.randomUUID();await writeTeacherFocus({phase,groups,focus:!!focus,resetId,token});lastControl=signature;}catch{lastControl='';}finally{controlBusy=false;if(controlAgain){controlAgain=false;void control(true);}}
 }
 async function subscribe(){
 let pullSnapshots;
  const version=++watchVersion;
  pullSnapshots=undefined;
  watcher?.close();
  watcher=null;
  if(!phase||demo)return;
  function receive(docs){
   if(version!==watchVersion)return;
   let changed=false;
   for(const doc of docs||[]){
    const id=Number(doc.groupId),prior=snapshots.get(id);
    if(doc.phase!==phase||(doc.resetId||null)!==(resetId||null)||prior?.updatedAt>=doc.updatedAt||(completion(id)&&prior))continue;
    if(!doc.state||doc.state.phase!==phase)continue;
    if(phase==='journey'&&!Object.hasOwn(names,doc.state.stage))continue;
    if(phase==='observation'&&doc.state.sharePreview&&typeof doc.state.image==='string'&&/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(doc.state.image))lastCameraFrames.set(id,doc.state.image);
    snapshots.set(id,doc);changed=true;
   }
   if(changed)render();
  }
  try{
   const db=await cloudDb();
   if(version!==watchVersion)return;
   const query=db.collection(LIVE_COLLECTION).where({kind:'lesson-live',phase});
   if(typeof query.watch==='function'){
    watcher=query.watch({
     onChange(snapshot){receive(snapshot.docs);},
     onError(){if(version!==watchVersion)return;watcher?.close();watcher=null;}
    });
   }
   let pulling=false;
   pullSnapshots=async()=>{
    if(pulling||version!==watchVersion)return;
    pulling=true;
    try{
     const result=await query.get();
     if(!result?.code)receive(result.data);
    }catch{}finally{pulling=false;}
   };
   await pullSnapshots();
  }catch{/* Reconnect on the next heartbeat. */}
 }
 async function selectPhase(next){if(next===phase){render();return;}phase=next;focus=null;if(!phaseSnapshots.has(next))phaseSnapshots.set(next,new Map());snapshots=phaseSnapshots.get(next);if(dialog.open)dialog.close();lastControl='';render();void control();await subscribe();}

 window.addEventListener('remote-display-state',event=>queueMicrotask(()=>{
  if(!phase)return;
  const remote=event.detail;
  const nextFocus=remote.group||null;
  const nextPage=Math.floor(((nextFocus||remote.page*6+1)-1)/pageSize);
  if(nextFocus){
   const key=phase+':'+nextFocus;
   unread.delete(key);
   flashes.delete(key);
  }
  if(!nextFocus&&dialog.open)dialog.close();
  focus=nextFocus;
  page=nextPage;
  render();
  if(focus&&!dialog.open)dialog.showModal();
  void control();
 }));
 window.addEventListener('teacher-live-phase',e=>void selectPhase(e.detail));
 window.addEventListener('lesson-records',e=>{
  const oldRound=resetId;resetId=e.detail.resetId||null;if(oldRound!==resetId){seen.clear();unread.clear();initial=true;for(const entries of phaseSnapshots.values())entries.clear();lastCameraFrames.clear();lastControl='';}
  records=e.detail.records||[];
  const added=[];
  for(let id=1;id<=12;id++)for(const p of ['v1','observation','v2','journey']){const at=completion(id,p),key=p+':'+id,old=seen.get(key);if(at&&old&&old!==at||at&&!old&&!initial){if(p!==phase||id!==focus||!dialog.open){unread.set(key,at);flashes.set(key,Date.now());}added.push(`第 ${id} 组${{v1:' 初始模型',observation:' AR观察',v2:' 修正模型',journey:' 食物旅行'}[p]}`);}seen.set(key,at);}
  initial=false;render();if(added.length)setTimeout(render,3400);void control();
 });
 wall.addEventListener('click',e=>{const pager=e.target.closest('[data-page]');if(pager){page=Number(pager.dataset.page);focus=null;render();void control();return;}const card=e.target.closest('[data-group]');if(card){focus=Number(card.dataset.group);unread.delete(phase+':'+focus);render();dialog.showModal();void control();}});
 dialog.querySelector('header button').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(dialog.open)return;focus=null;window.speechSynthesis?.cancel();render();void control();});
 window.addEventListener('resize',()=>{render();void control();});
 document.querySelector('#refresh-dashboard')?.addEventListener('click',()=>{if(phase&&!demo){void control(true);void subscribe();}});
 const previewPoll=setInterval(()=>{if(!document.hidden&&phase&&!demo){if(watcher)void pullSnapshots?.();else void subscribe();}},3000);
 const demoPlayback=setInterval(()=>{if(demo&&phase==='journey'&&!document.hidden){updateGameCards(wall.querySelector('.live-grid'));showGame();}},250);
 const heartbeat=setInterval(()=>{if(!document.hidden){void control(true);if(!watcher&&phase&&!demo)void subscribe();}},20000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){watchVersion++;watcher?.close();watcher=null;}else void subscribe();void control(true);});
 window.addEventListener('pagehide',()=>{clearInterval(heartbeat);clearInterval(demoPlayback);clearInterval(previewPoll);watcher?.close();void writeTeacherFocus({phase:null,groups:[],token});});
 if(isLocalPreview){
  const row=document.createElement('div');row.className='live-demo-actions';row.innerHTML='<span class="live-demo-badge">本地预览 · 云端已隔离</span><button type="button">显示 12 组演示</button><button type="button" hidden>模拟另一页提交</button>';wall.querySelector('.live-toolbar').append(row);
  const buttons=row.querySelectorAll('button');buttons[0].onclick=()=>{demo=!demo;buttons[0].textContent=demo?'返回本地真实小组':'显示 12 组演示';buttons[1].hidden=!demo;void subscribe();render();void control();};buttons[1].onclick=()=>{const id=page===0?pageSize+1:1,key=phase+':'+id;demoSubmitted.add(key);unread.set(key,Date.now());flashes.set(key,Date.now());render();};
 }
 render();void subscribe();void control();
}
function demoState(id,phase){
 if(phase==='observation'){const organs=['mouth','esophagus','stomach','small-intestine','large-intestine','pharynx'];return {phase,organId:organs[(id-1)%6],organName:['口腔','食管','胃','小肠','大肠','咽'][(id-1)%6]};}
 if(phase==='journey'){const stages=['mouth','esophagus','stomach','small','large','pharynx'];return {phase,stage:stages[(id-1)%6],food:id%6===1?'whole':'chyme',foodName:['湿润碎块','湿润食团','分散的食物碎块','更细软的食糜','剩余内容物','湿润食团'][(id-1)%6],hint:['快看！饼干变碎的同时，也变湿润了。','食管的内壁正在把食团向下推。','胃壁运动，让食物与胃液充分混合。','仔细观察，营养物质正在被吸收。','留下的内容物还会怎样变化？','前面是气管，后面是食管。'][(id-1)%6],progress:(id%5+1)/6};}
 const startedAt=1700000000000;
 const positions={mouth:{x:50,y:14},stomach:{x:57,y:43},'small-intestine':{x:50+(id%3-1)*2,y:55},'large-intestine':{x:50,y:55}};
 if(phase==='v2')Object.assign(positions,{esophagus:{x:50,y:28},stomach:{x:61,y:44},nose:{x:50,y:9},trachea:{x:48,y:26},lungs:{x:50,y:34}});
 return {phase,model:{positions,startedAt,completedAt:startedAt+(45+id*3+(phase==='v2'?18:0))*1000,visualStyle:{},routePoints:[{x:50,y:14},{x:50,y:29},{...positions.stomach},{x:50,y:55},{x:56,y:58},{x:43,y:55},{x:41,y:49},{x:60,y:49},{x:60,y:61},{x:50,y:64}],structureStrokes:[],modificationCount:id*2}};
}
