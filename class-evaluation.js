import {cloudErrorText,groupId,currentRecord,saveRecord,submitRecord,isPhotoPreview} from './student-data.js?v=20261109-ui3';
import {dimensions,readDocument,saveFeedback,sendClassCommand,submittedRecords,makeAwards,awardIcon,journeyEvents,participationPraise,sharingAwards} from './evaluation-data.js?v=20261109-ui3';
const teacher=new URLSearchParams(location.search).get('mode')==='teacher';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action,cls='ev-button')=>{const b=el('button',text,cls);b.type='button';b.onclick=action;return b;};
const symbols=['🔎','🤝','🌱'];
import {discussionQuestions} from './discussion-content.js';
const discussion=discussionQuestions.map(item=>item.question);
const lessonSlides=new Set(['课题封面','课堂研讨']);
export function certificate(entry){
 if(entry.awardBasis?.isEncouragement){
   entry={...entry,title:'课堂探索家',reasonParagraphs:[participationPraise],awardBasis:{isAdditional:true}};
 }
 if(entry.awardBasis?.isAdditional&&/^第\s*\d+\s*组/.test(entry.title)){
   entry={...entry,title:'发现小先锋'};
 }
 const card=el('article',undefined,'ev-award theme-'+(entry.category||0));
 const art=el('div',undefined,'award-garden');
 const reason=el('div',undefined,'award-reason');
 const paragraphs=entry.reasonParagraphs||String(entry.reason||'').split(/\n+|(?<=[！。？]) +/u);
 paragraphs.filter(Boolean).forEach(text=>reason.append(el('p',text)));
 const hero=el('span',awardIcon(entry),'award-hero');hero.setAttribute('aria-hidden','true');
 art.append(hero);
 card.append(el('p','食物在身体里的旅行','award-course'),art,el('p','我们是第 '+entry.groupId+' 组','award-group'),el('h2',entry.title),el('div','我们的闪光时刻','award-ribbon'),reason,el('p','为我们在这节课里的投入与收获喝彩！','award-wish'),el('span','✧  ✦  ✧','award-confetti'));
 return card;
}
if(teacher)setupTeacher();
else if(document.querySelector('#student-evaluation'))setupStudent();
function setupTeacher(){
 document.body.classList.add('evaluation-teacher');
 const host=document.querySelector('#teacher-view'),tabs=el('nav',undefined,'ev-tabs'),panel=el('section',undefined,'ev-grid'),dock=el('aside',undefined,'ev-stars');
 const requestedStage=new URLSearchParams(location.search).get('stage');
 let records=[],state={resetId:null,groups:{}},ready=false,dirty=false,version=0,timer,saving=null,busy=false,stage=requestedStage==='awards'?'专属奖状':'课题封面';
 const slide=el('section',undefined,'lesson-slide');
 slide.setAttribute('aria-label','课堂投屏');
 const summary=document.querySelector('#teacher-summary');
 const heading=host.querySelector('.teacher-model-heading');
 const sharingControl=el('label',undefined,'ev-sharing');
 const sharingSelect=el('select');
 sharingControl.append(el('span','交流小组'),sharingSelect);
 const blankOption=el('option','未指定');
 blankOption.value='';
 sharingSelect.append(blankOption);
 for(let group=1;group<=12;group++){
   const option=el('option','第 '+group+' 组');
   option.value=String(group);
   sharingSelect.append(option);
 }
 const sharingStage=()=>stage==='课堂研讨'?'研讨'+(discussionIndex+1):stage;
 function renderSharing(){
   const key=sharingStage();
   const discussing=stage==='课堂研讨';
   const fullscreenButton=discussing?fullscreen:heading.querySelector('#teacher-fullscreen-button');
   if(sharingControl.parentElement!==fullscreenButton.parentElement)fullscreenButton.before(sharingControl);
   sharingControl.hidden=!Object.hasOwn(sharingAwards,key);
   sharingSelect.value=String(state.shares?.[key]??(key==='研讨1'?state.shares?.['食物旅行']:null)??'');
 }
 sharingSelect.onchange=()=>{
   const key=sharingStage();
   if(!ready||busy||!Object.hasOwn(sharingAwards,key))return;
   state.shares||={};
   if(key==='研讨1')delete state.shares['食物旅行'];
   if(sharingSelect.value)state.shares[key]=Number(sharingSelect.value);
   else delete state.shares[key];
   schedule();
 };
 const fullscreen=button('全屏',()=>window.requestLessonFullscreen?.(),'ev-button lesson-fullscreen');
 let discussionIndex=0;
 const status=el('span','连接课堂中…','ev-status');
 const header=el('div',undefined,'ev-star-heading');
 header.append(el('b','点一下，送一颗星'),el('span','🔎 观察   🤝 合作   🌱 坚持'),status);
 const rows=el('div',undefined,'ev-star-groups');dock.append(header,rows);host.append(panel,dock);
 tabs.setAttribute('aria-label','教学页面和学生活动');
 host.insertBefore(tabs,heading);
 host.insertBefore(slide,summary);
 function showStage(name){
   stage=name;
   render();
   window.scrollTo(0,0);
   if(lessonSlides.has(stage))slide.querySelector('h1').focus({preventScroll:true});
 }
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
   sharingSelect.disabled=!ready||busy;
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
   showStage(name);

   busy=true;renderStars();
   try{
     if(!ready)throw new Error('请先连接课堂。');
     await flush();
     if(name==='专属奖状'){
       records=await submittedRecords(state.resetId);
       if(!records.length)throw new Error('还没有本轮作品，暂时无法颁发。');
       const next=structuredClone(state);
       makeAwards(records,next.groups,next.shares).forEach(a=>next.groups[a.groupId]=a);
       await saveFeedback(next);state=next;
     }
     const phases={'课题封面':'cover','初始模型':'v1','AR观察':'observation','修正模型':'v2','实体拼装':'assembly','食物旅行':'journey','小组自评':'evaluation','专属奖状':'awards','课堂研讨':'discussion'};
     await sendClassCommand(state.resetId,phases[name],String(Date.now()),name==='课堂研讨'?{discussionIndex}:{});
     status.textContent=name==='专属奖状'?'已颁发，学生端自动展示':'学生端正在进入'+name;
     render();
   }catch(error){status.textContent=error.message;}finally{busy=false;renderStars();}
 }
 ['课题封面','初始模型','AR观察','修正模型','实体拼装','食物旅行','课堂研讨','小组自评','专属奖状'].forEach(name=>{
   const tab=button(name,()=>choose(name));
   tab.title=name==='课题封面'?'展示封面并带领学生回到课堂初始页':'展示并带领学生进入'+name;
   tabs.append(tab);
 });
 tabs.append(fullscreen);
 function renderSlide(){
   const cover=stage==='课题封面';
   const slideTitle=el('h1',cover?'食物在身体里的旅行':'课堂研讨');
   slideTitle.tabIndex=-1;
   slide.dataset.page=stage;
   if(cover){
     const actions=el('div',undefined,'lesson-slide-actions');
     actions.append(button('开始上课 →',()=>choose('初始模型'),'ev-button primary'));
     slide.replaceChildren(el('p','四年级 · 科学','lesson-slide-label'),slideTitle,el('p','一块饼干咽下去以后，会去哪儿？','lesson-slide-prompt'),actions);
   }else{
     slideTitle.textContent='课堂研讨 · '+(discussionIndex+1)+' / '+discussion.length;
     slideTitle.classList.add('lesson-discussion-title');
     const question=el('p',discussion[discussionIndex],'lesson-discussion');
     const actions=el('div',undefined,'lesson-slide-actions');
     function move(step){
       if(busy)return;
       discussionIndex+=step;
       renderSlide();
       renderSharing();
       slide.querySelector('h1').focus({preventScroll:true});
       void choose('课堂研讨');
     }
     const previous=button('← 上一题',()=>move(-1));
     const next=button('下一题 →',()=>move(1),'ev-button primary');
     previous.disabled=discussionIndex===0;
     next.disabled=discussionIndex===discussion.length-1;
     actions.append(previous,next);
     slide.replaceChildren(slideTitle,question,actions);
   }
 }
 function showPhoto(data,id){
   const dialog=document.querySelector('#model-preview-dialog'),img=el('img');
   img.src=data;img.alt='第 '+id+' 组拼装照片';img.className='ev-photo-large';
   document.querySelector('#preview-model-title').textContent='第 '+id+' 组拼装作品';
   document.querySelector('#preview-model-content').replaceChildren(img);dialog.showModal();
 }
 function render(){
   renderSharing();
   [...tabs.children].forEach(b=>{
     if(b===fullscreen||b===sharingControl)return;
     const current=b.textContent===stage;
     b.setAttribute('aria-selected',String(current));
     if(current)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
   });
   const presenting=lessonSlides.has(stage);
   document.body.classList.toggle('lesson-presenting',presenting);
   slide.hidden=!presenting;
   heading.hidden=summary.hidden=dock.hidden=presenting;
   fullscreen.hidden=!presenting;
   if(presenting){
     document.querySelector('#group-dashboard').hidden=true;
     document.querySelector('.teacher-pagination').hidden=true;
     panel.hidden=true;
     if(slide.dataset.page!==stage)renderSlide();
     return;
   }
   delete slide.dataset.page;
   const model=stage==='初始模型'||stage==='修正模型';
   document.querySelector('.teacher-model-heading h1').textContent=stage==='初始模型'?'各组的初始模型':stage==='修正模型'?'观察前后的模型对比':stage;
   document.querySelector('.teacher-model-heading .model-eyebrow').textContent={
     '初始模型':'任务一 · 表达初始想法',
     'AR观察':'任务二 · 观察器官结构',
     '修正模型':'任务三 · 对照观察修正模型',
     '实体拼装':'任务四 · 展示拼装作品',
     '食物旅行':'任务五 · 回顾探索过程',
     '小组自评':'任务六 · 回顾小组表现',
     '专属奖状':'课堂收尾 · 肯定各组亮点'
   }[stage];
   window.dispatchEvent(new CustomEvent('teacher-stage-view',{detail:stage==='修正模型'?'v2':'v1'}));
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
       const labels={identify:'辨认器官',locate:'借助人体图查找位置',look:'转向观察',
         'fork-side-view':'从侧面比较气管与食管','villi-detail':'放大观察小肠绒毛',
         airway:'食团误入气管后重新尝试','safe-swallow':'选择食管继续旅行',
         'stomach-locate':'查看胃在身体中的位置','stomach-wrong':'重新辨认胃',
         'stomach-complete':'完成胃部探索','nutrient-absorption':'观察营养移向肠壁',
         'water-absorption':'观察水分吸收','peristalsis':'体验食管蠕动',vomit:'观察食物逆行后重新出发'};
       const events=journeyEvents(data).filter(e=>labels[e.type]),details=el('details',undefined,'journey-details');details.append(el('summary','查看探索过程（'+events.length+' 条）'));
       const timeline=el('ol',undefined,'journey-timeline');
       events.slice(-30).forEach(e=>timeline.append(el('li',labels[e.type]+(e.choice?' · '+e.choice:''))));
       details.append(timeline);
       if(!events.length)details.append(el('p','本次提交记录了旅程完成状态，没有可展开的探索步骤。'));
       if(events.length>30)details.append(el('p','显示最近 30 条；奖状判定仍使用完整提交记录。'));
       card.append(details);
     }
     panel.append(card);
   }
 }
 let coverCommandRound;
 window.addEventListener('lesson-records',async event=>{
   ready=false;renderStars();
   const round=event.detail.resetId||null;
   records=[...event.detail.records].sort((a,b)=>b.updatedAt-a.updatedAt).filter((r,i,all)=>all.findIndex(x=>Number(x.groupId)===Number(r.groupId))===i);
   try{
     if(saving)await saving;
     const stored=event.detail.feedback||await readDocument('class-feedback');
     if(!dirty||state.resetId!==round)state=stored.resetId===round?{resetId:round,groups:stored.groups||{},shares:stored.shares||{}}:{resetId:round,groups:{}};
     const local=JSON.parse(localStorage.getItem('teacher-evaluation-draft')||'null');
     if(local?.resetId===round){state=local;dirty=true;}else localStorage.removeItem('teacher-evaluation-draft');
     ready=true;status.textContent='每项最多 5 星 · 自动保存';
     if(dirty)schedule();
     if(stage==='课题封面'&&coverCommandRound!==JSON.stringify(round)){
       await sendClassCommand(round,'cover',String(Date.now()));
       coverCommandRound=JSON.stringify(round);
     }
   }catch(error){console.error('教师评分读取失败',error);status.textContent='连接失败：'+cloudErrorText(error);status.title='连接版本 1109-2 · '+location.origin;}
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
       }else{awardArea.replaceChildren();status.textContent='我们的奖状正在准备中，一起等一等 🌷';}
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
     record.evaluationDraft={levels:[...levels]};
     await saveRecord(record);
     const evaluation={levels:[...levels],completedAt:Date.now(),schema:2};
     if(!await submitRecord({...record,evaluation},{saveLocal:false,submitEvaluation:true}))throw new Error('星星保存在本机，联网后再点一次。');
     record.evaluation=evaluation;delete record.evaluationDraft;
     await saveRecord(record);
     status.textContent='老师收到啦！一起等待惊喜吧 🌸';submit.textContent='星星已提交 ✓';
   }catch(error){locked=false;submit.disabled=false;drawStars();status.textContent=error.message;}
 };
 window.addEventListener('class-command',event=>showCommand(event.detail));
 try{
   record=await currentRecord();
   levels=(record.evaluationDraft||record.evaluation)?.levels?.slice(0,3)||levels;drawStars();
   await showCommand(await readDocument('class-control'));
 }catch{status.textContent='正在连接课堂…';}
}
