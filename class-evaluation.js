import {groupId,currentRecord,saveRecord,submitRecord,isPhotoPreview} from './student-data.js';
import {dimensions,readDocument,saveFeedback,sendClassCommand,submittedRecords,makeAwards} from './evaluation-data.js';
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action,cls='ev-button')=>{const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};
const symbols=['🔎','🤝','🌱'];
export function certificate(entry){
 const card=el('article',undefined,'ev-award theme-'+(entry.category||0));
 const art=el('div',undefined,'award-garden');
 art.append(el('span','✧','spark spark-one'),el('span','✦','spark spark-two'),el('span','🌿','leaf leaf-one'),el('span','🌿','leaf leaf-two'),el('span',['🔭','🪁','🚀'][entry.category||0],'award-hero'));
 card.append(el('p','食物在身体里的旅行','award-course'),art,el('p','送给 第 '+entry.groupId+' 组','award-group'),el('h2',entry.title),el('div','你们的闪光时刻','award-ribbon'),el('p',entry.reason,'award-reason'),el('p','带着好奇出发，让每一次发现都发光。','award-wish'),el('span','✧  ✦  ✧','award-confetti'));
 return card;
}
if(teacher)setupTeacher();
else if(document.querySelector('#student-evaluation'))setupStudent();
function setupTeacher(){
 document.body.classList.add('evaluation-teacher');
 const host=document.querySelector('#teacher-view'),tabs=el('nav',undefined,'ev-tabs'),panel=el('section',undefined,'ev-grid'),dock=el('aside',undefined,'ev-stars');
 let records=[],state={resetId:null,groups:{}},ready=false,dirty=false,version=0,timer,saving=null,busy=false,stage=new URLSearchParams(location.search).get('stage')==='awards'?'专属奖状':'模型';
 const status=el('span','连接课堂中…','ev-status');
 const header=el('div',undefined,'ev-star-heading');
 header.append(el('b','点一下，送一颗星'),el('span','🔎 观察   🤝 合作   🌱 坚持'),status);
 const rows=el('div',undefined,'ev-star-groups');dock.append(header,rows);host.append(panel,dock);
 host.insertBefore(tabs,document.querySelector('#teacher-summary'));
 function entry(id){return state.groups[id]||={stars:[0,0,0]};}
 async function flush(){
   clearTimeout(timer);
   if(saving)await saving;
   if(!dirty)return;
   const snapshot=structuredClone(state),revision=version;
   saving=saveFeedback(snapshot);
   try{await saving;if(version===revision){dirty=false;localStorage.removeItem('teacher-evaluation-draft');}status.textContent='已保存';}
   finally{saving=null;}
 }
 function schedule(){
   dirty=true;version++;localStorage.setItem('teacher-evaluation-draft',JSON.stringify(state));
   clearTimeout(timer);status.textContent='正在保存…';
   timer=setTimeout(()=>flush().catch(()=>{status.textContent='暂未保存，点击重试';}),1200);
 }
 status.onclick=()=>flush().catch(()=>{status.textContent='暂未保存，点击重试';});
 function renderStars(){
   rows.replaceChildren();
   for(let id=1;id<=12;id++){
     const cell=el('div',undefined,'ev-star-group');cell.append(el('b',id+' 组'));
     dimensions.forEach((name,i)=>{
       const star=button(symbols[i]+' '+(entry(id).stars[i]||0),()=>{
         if(!ready||busy)return;
         entry(id).stars[i]=Math.min(5,(entry(id).stars[i]||0)+1);schedule();renderStars();
       },'quick-star');
       star.title=name+'，点击加星；长按或右键撤回一星';star.setAttribute('aria-label',id+'组'+name+'加星');
       let press;
       star.onpointerdown=()=>{press=setTimeout(()=>{if(!ready||busy)return;entry(id).stars[i]=Math.max(0,(entry(id).stars[i]||0)-1);schedule();renderStars();},650);};
       star.onpointerup=star.onpointerleave=star.onpointercancel=()=>clearTimeout(press);
       star.oncontextmenu=event=>{event.preventDefault();if(!ready||busy)return;entry(id).stars[i]=Math.max(0,(entry(id).stars[i]||0)-1);schedule();renderStars();};
       star.disabled=!ready||busy;cell.append(star);
     });
     rows.append(cell);
   }
 }
 async function choose(name){
   if(busy)return;
   stage=name;render();
   if(!['小组自评','专属奖状'].includes(name))return;
   busy=true;renderStars();
   try{
     if(!ready)throw new Error('请先连接课堂。');
     await flush();
     if(name==='专属奖状'){
       records=await submittedRecords(state.resetId);
       if(!records.length)throw new Error('还没有本轮作品，暂时无法颁发。');
       const next=structuredClone(state);
       makeAwards(records,next.groups).forEach(a=>next.groups[a.groupId]=a);
       await saveFeedback(next);state=next;
     }
     await sendClassCommand(state.resetId,name==='小组自评'?'evaluation':'awards',String(Date.now()));
     status.textContent=name==='小组自评'?'学生端正在进入自评':'已颁发，学生端自动展示';
     render();
   }catch(error){status.textContent=error.message;}finally{busy=false;renderStars();}
 }
 ['模型','AR观察','实体拼装','食物旅行','小组自评','专属奖状'].forEach(name=>tabs.append(button(name,()=>choose(name))));
 function showPhoto(data,id){
   const dialog=document.querySelector('#model-preview-dialog'),img=el('img');
   img.src=data;img.alt='第 '+id+' 组拼装照片';img.className='ev-photo-large';
   document.querySelector('#preview-model-title').textContent='第 '+id+' 组拼装作品';
   document.querySelector('#preview-model-content').replaceChildren(img);dialog.showModal();
 }
 function render(){
   [...tabs.children].forEach(b=>b.setAttribute('aria-selected',String(b.textContent===stage)));
   const model=stage==='模型';
   document.querySelector('.teacher-model-heading h1').textContent=model?'各组的消化模型':stage;
   document.querySelector('#group-dashboard').hidden=!model;
   document.querySelector('.teacher-pagination').hidden=!model;
   panel.hidden=model;panel.classList.toggle('award-gallery',stage==='专属奖状');panel.replaceChildren();
   if(model)return;
   for(let id=1;id<=12;id++){
     const record=records.find(r=>Number(r.groupId)===id),data=record?.[{'AR观察':'observation','实体拼装':'assembly','食物旅行':'journey','小组自评':'evaluation'}[stage]];
     if(stage==='专属奖状'&&entry(id).issuedAt){panel.append(certificate({...entry(id),groupId:id}));continue;}
     const card=el('article',undefined,'ev-card');card.append(el('h3','第 '+id+' 组'));
     if(!data?.completedAt){card.append(el('p',stage==='专属奖状'?'等待本组作品':'等待本组提交'));panel.append(card);continue;}
     if(stage==='实体拼装'){
       if(isPhotoPreview(data.photoPreview)){
         const photo=button('',()=>showPhoto(data.photoPreview,id),'ev-photo-button'),img=el('img');img.src=data.photoPreview;img.alt='第 '+id+' 组拼装照片';photo.append(img);card.append(photo);
       }else card.append(el('p','本组还没有提交照片'));
       if(data.note)card.append(el('p',data.note));
     }else if(stage==='小组自评'){
       dimensions.forEach((name,i)=>{
         const count=Math.max(0,Math.min(3,Number(data.levels?.[i])||0));
         card.append(el('p',symbols[i]+' '+name+'  '+'★'.repeat(count),'self-result'));
       });
     }else if(stage==='AR观察'){
       const names={mouth:'口腔',esophagus:'食管',stomach:'胃','small-intestine':'小肠','large-intestine':'大肠',small:'小肠',large:'大肠'};
       card.append(el('p','观察过 '+[...new Set((data.views||[]).map(v=>names[v.organId]||v.organId))].join('、')));
     }else{
       card.append(el('p','已完成食物旅行'));
       const events=data.history||data.events||[],details=el('details');details.append(el('summary','查看探索过程'));
       events.slice(-30).forEach(e=>details.append(el('p',({identify:'辨认器官',locate:'查看人体图',look:'转向观察','villi-detail':'观察绒毛','stomach-wrong':'再次尝试胃部路径'}[e.type]||'探索活动')+(e.choice?' · '+e.choice:''))));
       card.append(details);
     }
     panel.append(card);
   }
 }
 window.addEventListener('lesson-records',async event=>{
   ready=false;renderStars();
   const round=event.detail.resetId||null;
   records=[...event.detail.records].sort((a,b)=>b.updatedAt-a.updatedAt).filter((r,i,all)=>all.findIndex(x=>Number(x.groupId)===Number(r.groupId))===i);
   try{
     if(saving)await saving;
     const stored=await readDocument('class-feedback');
     if(!dirty||state.resetId!==round)state=stored.resetId===round?{resetId:round,groups:stored.groups||{}}:{resetId:round,groups:{}};
     const local=JSON.parse(localStorage.getItem('teacher-evaluation-draft')||'null');
     if(local?.resetId===round){state=local;dirty=true;}else localStorage.removeItem('teacher-evaluation-draft');
     ready=true;status.textContent='每项最多 5 星 · 自动保存';
     if(dirty)schedule();
   }catch{status.textContent='连接失败，请刷新课堂';}
   renderStars();render();
 });
 window.addEventListener('online',()=>{if(dirty)flush().catch(()=>{});});
 renderStars();render();
}
async function setupStudent(){
 const root=document.querySelector('#student-evaluation');
 let record,levels=[0,0,0],locked=false,loading=false,displayedCommand=null;
 const header=el('header',undefined,'ev-heading');header.append(el('span','第 '+groupId+' 组'),el('span','我们的成长花园 🌿'));
 const title=el('h1','今天，我们闪闪发光！'),subtitle=el('p','一起商量，给自己的表现点亮星星。','self-hint');
 const form=el('form',undefined,'self-panel'),status=el('p','','ev-status'),awardArea=el('section',undefined,'student-award');
 const rows=[];
 dimensions.forEach((name,i)=>{
   const row=el('div',undefined,'self-row'),label=el('div',undefined,'self-label');label.append(el('span',symbols[i]),el('strong',name));
   const stars=el('div',undefined,'self-stars');
   for(let n=1;n<=3;n++){
     const b=button('★',()=>{if(locked)return;levels[i]=n;drawStars();},'self-star');
     b.setAttribute('aria-label',name+n+'星');stars.append(b);
   }
   row.append(label,stars);rows.push(stars);form.append(row);
 });
 function drawStars(){rows.forEach((row,i)=>[...row.children].forEach((b,j)=>{b.classList.toggle('lit',j<levels[i]);b.setAttribute('aria-pressed',String(j<levels[i]));b.disabled=locked;}));}
 const legend=el('p','★ 再加把劲　★★ 有进步　★★★ 做得棒','self-legend'),submit=el('button','把星星提交给老师 ✨','ev-button primary');submit.type='submit';
 form.append(legend,submit);root.append(header,title,subtitle,form,status,awardArea);
 async function showCommand(command){
   if(loading||(command?.commandId&&command.commandId===displayedCommand))return;loading=true;
   try{
     if(!record)record=await currentRecord();
     if((record.resetId||null)!==(command?.resetId||null))return;
     if(command?.phase==='awards'){
       const feedback=await readDocument('class-feedback'),entry=feedback.resetId===record.resetId?feedback.groups?.[groupId]:null;
       form.hidden=true;title.hidden=true;subtitle.hidden=true;
       if(entry?.issuedAt&&entry.recordId===record.id){
         awardArea.replaceChildren(certificate({...entry,groupId}));status.textContent='';document.body.classList.add('award-mode');displayedCommand=command.commandId;
       }else{awardArea.replaceChildren();status.textContent='老师正在把祝福送给你们，请稍等 🌷';}
     }else{
       document.body.classList.remove('award-mode');awardArea.replaceChildren();form.hidden=false;title.hidden=false;subtitle.hidden=false;
       if(command?.phase==='evaluation'){displayedCommand=command.commandId;locked=false;submit.disabled=false;submit.textContent='把星星提交给老师 ✨';drawStars();}
     }
   }catch{status.textContent='正在连接课堂…';}finally{loading=false;}
 }
 form.onsubmit=async event=>{
   event.preventDefault();if(locked||!record)return;
   if(levels.some(n=>n===0)){status.textContent='还有星星没点亮哦！';return;}
   locked=true;submit.disabled=true;drawStars();
   try{
     record.evaluation={levels:[...levels],completedAt:Date.now(),schema:2};
     await saveRecord(record);
     if(!await submitRecord(record))throw new Error('星星保存在本机，联网后再点一次。');
     status.textContent='老师收到啦！一起等待惊喜吧 🌸';submit.textContent='星星已提交 ✓';
   }catch(error){locked=false;submit.disabled=false;drawStars();status.textContent=error.message;}
 };
 window.addEventListener('class-command',event=>showCommand(event.detail));
 try{
   record=await currentRecord();
   levels=record.evaluation?.levels?.slice(0,3)||levels;drawStars();
   await showCommand(await readDocument('class-control'));
 }catch{status.textContent='正在连接课堂…';}
}
