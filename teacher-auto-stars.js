import {automaticStars,readForumStarGroups,submittedRecords} from './evaluation-data.js?v=classroom-remote';

export function makeForumStarRefresh(readRound, onScores) {
 let lastRound, lastRequest=0, pending=false;
 return async function refresh(){
   const round=readRound();
   if(round===undefined||pending||round===lastRound&&Date.now()-lastRequest<30000)return;
   pending=true;
   lastRound=round;
   lastRequest=Date.now();
   try {
     const replies=await readForumStarGroups(round);
     if(readRound()===round)onScores(replies);
   } catch {
     // Preserve the last successful tally through a connection interruption.
   } finally {
     pending=false;
   }
 };
}

export function makeAutomaticStarsButton({el,button,symbols,readState,onScores}){
 const autoDialog=el('dialog',undefined,'ev-auto-stars');
 autoDialog.setAttribute('aria-label','自动加星明细');
 const autoBody=el('div');
 autoDialog.append(el('h2','自动加星明细'),autoBody,button('关闭',()=>autoDialog.close()));
 document.body.append(autoDialog);
 async function showAutomaticStars(){
   if(autoDialog.open)return;
   if(!readState().ready){
     autoBody.replaceChildren(el('p','请等工作台连接课堂后再查看。'));
     autoDialog.showModal();
     return;
   }
   const round=readState().resetId;
   autoBody.replaceChildren(el('p','正在读取本轮记录…'));
   autoDialog.showModal();
   const [submissions,forum]=await Promise.allSettled([submittedRecords(round),readForumStarGroups(round)]);
   if(!autoDialog.open)return;
   if(round!==readState().resetId){autoBody.replaceChildren(el('p','课堂已换轮次，请关闭后重新查看。'));return;}
   const current=submissions.status==='fulfilled'?submissions.value:readState().records;
   const replies=forum.status==='fulfilled'?forum.value:readState().forumReplyGroups||new Set();
   onScores?.(current,replies);
   const table=el('div',undefined,'ev-auto-groups');
   for(let id=1;id<=12;id++){
     const record=current.find(item=>Number(item.groupId)===id);
     const {stars,reasons}=automaticStars(record,replies.has(id));
     const group=el('section');
     group.append(el('h3','第 '+id+' 组'),el('p',stars.map((count,index)=>symbols[index]+' '+count).join('　')));
     for(const {count,reason} of reasons)group.append(el('p',reason+' · +'+count+' 星'));
     if(!reasons.length)group.append(el('p','暂时没有符合条件的记录。'));
     table.append(group);
   }
   autoBody.replaceChildren(table);
   if(submissions.status==='rejected'||forum.status==='rejected')autoBody.prepend(el('p','部分课堂记录暂不可用，请稍后重查。'));
 }
 return button('自动星明细',showAutomaticStars);
}
