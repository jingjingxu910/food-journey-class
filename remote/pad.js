import {stages,phases,round,readRemote,writeRemote} from './channel.js';
import {readDocument,saveFeedback,sendClassCommand,submittedRecords,makeAwards} from '../evaluation-data.js?v=20261113-awards';
const $=selector=>document.querySelector(selector);
const symbols=['🔎','🤝','🌱'],dimensions=['观察','合作','坚持'];
let active=null,feedback={},queue=Promise.resolve();
function element(tag,text=''){
 const node=document.createElement(tag);
 node.textContent=text;
 return node;
}
function button(text,click,pressed){
 const node=element('button',text);
 node.type='button';
 node.onclick=click;
 if(pressed!==undefined)node.setAttribute('aria-pressed',String(pressed));
 return node;
}
function shareKey(display){return display.stage==='课堂研讨'?'研讨'+(display.question+1):display.stage;}
function disconnected(message){
 active=null;
 $('#remote-controls').hidden=true;
 $('#pairing').hidden=false;
 $('#status').textContent=message;
}
async function connection(){
 const display=await readRemote();
 const lease=await readDocument('class-display-lease');
 if(display.expiresAt===0||!(lease.expiresAt>Date.now())||lease.session!==display.session)throw Error('大屏已退出跟随或连接超时');
 if((display.resetId||null)!==await round())throw Error('课堂已开始新一轮，请重新配对');
 return display;
}
async function feedbackFor(resetId){
 const saved=await readDocument('class-feedback');
 return (saved.resetId||null)===(resetId||null)?{resetId,groups:saved.groups||{},shares:saved.shares||{}}:{resetId,groups:{},shares:{}};
}
$('#pairing').onsubmit=async event=>{
 event.preventDefault();
 try{
  const display=await connection();
  if(display.code!==$('#code').value.trim().toLowerCase())throw Error('配对码不正确');
  feedback=await feedbackFor(display.resetId);
  active=display;
  $('#pairing').hidden=true;
  $('#remote-controls').hidden=false;
  $('#status').textContent='已连接大屏';
  render();
 }catch(error){disconnected(error.message);}
};
function run(operation){
 const session=active?.session;
 queue=queue.then(async()=>{
  if(!session||active?.session!==session)return;
  const display=await connection();
  if(display.session!==session){disconnected('大屏已切换控制会话');return;}
  const next=await operation(display);
  if(next){
   const current=await readRemote();
   if(current.session!==session||current.expiresAt===0||active?.session!==session){disconnected('大屏已退出跟随');return;}
   await writeRemote(next);
   active=next;
  }
  render();
 }).catch(error=>{$('#status').textContent=error.message;});
}
async function switchStage(display,stage,question=display.question){
 const phase=phases[stages.indexOf(stage)];
 if(phase==='awards')return {...display,stage,page:0,group:0};
 await sendClassCommand(display.resetId,phase,String(Date.now()),{discussionIndex:question});
 return {...display,stage,question,page:0,group:0};
}
function render(){
 const state=active;
 if(!state)return;
 $('#phases').replaceChildren(...stages.map(stage=>button(stage,()=>run(display=>switchStage(display,stage)),stage===state.stage)));
 const actions=element('div');actions.className='actions';
 const grids=['初始模型','AR观察','修正模型','实体拼装','食物旅行','小组自评','专属奖状'];
 if(grids.includes(state.stage))actions.append(
  button('第 1–6 组',()=>run(display=>({...display,page:0,group:0})),state.page===0),
  button('第 7–12 组',()=>run(display=>({...display,page:1,group:0})),state.page===1),
  button('返回总览',()=>run(display=>({...display,group:0})),!state.group)
 );
 if(state.stage==='课堂研讨')for(let i=0;i<3;i++)actions.append(button('第 '+(i+1)+' 题',()=>run(display=>switchStage(display,'课堂研讨',i)),state.question===i));
 if(state.stage==='专属奖状')actions.append(button('颁发奖状',()=>run(async display=>{
  const records=await submittedRecords(display.resetId);
  if(!records.length)throw Error('还没有本轮作品');
  feedback=await feedbackFor(display.resetId);
  for(const award of makeAwards(records,feedback.groups,feedback.shares))feedback.groups[award.groupId]=award;
  await saveFeedback(feedback);
  await sendClassCommand(display.resetId,'awards',String(Date.now()));
  return {...display,page:0,group:0};
 })));
 const groupButtons=element('div');groupButtons.className='groups';
 if(grids.includes(state.stage))for(let id=state.page*6+1;id<=state.page*6+6;id++)groupButtons.append(button('放大第 '+id+' 组',()=>run(display=>({...display,group:id})),state.group===id));
 const sharing=element('label','本环节交流小组');
 const select=element('select');
 for(let id=0;id<=12;id++){const option=element('option',id?'第 '+id+' 组':'未指定');option.value=id;select.append(option);}
 select.value=feedback.shares?.[shareKey(state)]||0;
 select.onchange=()=>{
  const id=Number(select.value),key=shareKey(state);
  run(async display=>{
   feedback=await feedbackFor(display.resetId);
   if(id)feedback.shares[key]=id;else delete feedback.shares[key];
   await saveFeedback(feedback);
  });
 };
 sharing.append(select);
 $('#controls').replaceChildren(element('strong',state.group?'正在展示第 '+state.group+' 组':state.stage),actions,groupButtons,sharing);
 const stars=element('div');stars.className='star-grid';
 for(let id=1;id<=12;id++){
  const item=element('article');item.append(element('b','第 '+id+' 组'));
  symbols.forEach((symbol,i)=>{
   const change=delta=>run(async display=>{
    feedback=await feedbackFor(display.resetId);
    const group=feedback.groups[id]??={};
    const counts=group.stars??=[0,0,0];
    counts[i]=Math.max(0,Math.min(5,(counts[i]||0)+delta));
    await saveFeedback(feedback);
   });
   const star=button(symbol+' '+(feedback.groups?.[id]?.stars?.[i]||0),()=>change(1));
   star.setAttribute('aria-label','第 '+id+' 组'+dimensions[i]+'加星');
   let held=false,timer;
   star.onpointerdown=()=>{held=false;timer=setTimeout(()=>{held=true;change(-1);},650);};
   star.onpointerup=star.onpointerleave=star.onpointercancel=()=>clearTimeout(timer);
   star.oncontextmenu=event=>event.preventDefault();
   star.onclick=()=>{if(!held)change(1);held=false;};
   item.append(star);
  });
  stars.append(item);
 }
 $('#stars').replaceChildren(element('h2','小组加星'),stars);
}
let checking=false;
setInterval(async()=>{
 if(!active||document.hidden||checking)return;
 checking=true;
 try{
  const display=await readRemote(),lease=await readDocument('class-display-lease');
  if(display.expiresAt===0||display.session!==active.session||lease.session!==active.session||lease.expiresAt<=Date.now())disconnected('大屏已退出跟随，请重新配对');
 }catch{/* Retry without changing the classroom. */}
 finally{checking=false;}
},3000);
