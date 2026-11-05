import {cloudDb} from './student-data.js';
export const dimensions = ['观察有依据','合作会倾听','遇到问题再尝试'];
export async function readDocument(id) {
  const db=await cloudDb();
  const result=await db.collection('food-journey-groups').doc(id).get();
  if(result?.code) throw new Error(result.message||'暂时无法连接课堂');
  return (Array.isArray(result.data)?result.data[0]:result.data)||{};
}
export async function roundId() {
  return (await readDocument('class-reset')).resetId||null;
}
export async function saveFeedback(state) {
  if(await roundId()!==(state.resetId||null)) throw new Error('课堂已换轮次，请刷新后继续。');
  const db=await cloudDb();
  const result=await db.collection('food-journey-groups').doc('class-feedback').set(state);
  if(result?.code||!(result?.updated>0||result?.upsertedId||result?.id)) throw new Error('保存失败，请重试。');
}

export async function sendClassCommand(resetId, phase, commandId) {
  if(await roundId()!==(resetId||null))throw new Error('课堂已换轮次，请刷新。');
  const db=await cloudDb();
  const result=await db.collection('food-journey-groups').doc('class-control').set({resetId,phase,commandId});
  if(result?.code||!(result?.updated>0||result?.upsertedId||result?.id))throw new Error('课堂指令未发送，请再点一次。');
}
export async function submittedRecords(resetId) {
  const db=await cloudDb(),result=await db.collection('food-journey-groups').get();
  if(result?.code)throw new Error('作品读取失败，请再试一次。');
  return (result.data||[]).flatMap(d=>Array.isArray(d.records)?d.records:[])
    .filter(r=>(r.resetId||null)===(resetId||null))
    .sort((a,b)=>b.updatedAt-a.updatedAt)
    .filter((r,i,all)=>all.findIndex(x=>Number(x.groupId)===Number(r.groupId))===i);
}
export function makeAwards(records, groups) {
  const words=[['细察','寻迹','发现','求真','慧眼','探秘','洞察','追问','知新','思考','联想','求知'],
    ['携手','同心','伙伴','互助','倾听','团结','分享','同行','合力','协作','友爱','共进'],
    ['勇敢','坚持','再试','向前','不懈','挑战','突破','求索','进取','追光','努力','成长']];
  const used=new Set();
  return records.map(record=>{
    const old=groups[record.groupId]||{},stars=dimensions.map((_,i)=>Number(old.stars?.[i])||0);
    const levels=record.evaluation?.levels||[];
    const scores=stars.map((n,i)=>n*2+(Number(levels[i])||0));
    const category=scores.indexOf(Math.max(...scores));
    const word=words[category].find(w=>!used.has(w))||'成长';
    used.add(word);
    const facts=[];
    if(record.v1?.completedAt&&record.v2?.completedAt){
      const changed=JSON.stringify(record.v1.positions)!==JSON.stringify(record.v2.positions)||
        JSON.stringify(record.v1.routePoints)!==JSON.stringify(record.v2.routePoints);
      facts.push(changed?'老师看到了你们前后两次模型中的变化。愿意回头看、动手改，这就是探索中的进步！':'你们认真留下了观察前后的两份模型，让自己的想法有了清楚的样子。');
    }
    if(record.assembly?.photoPreview)facts.push('你们还把拼装作品拍下来，让大家也能看见你们动手探索的成果。');
    const events=record.journey?.history||record.journey?.events||[];
    if(events.some(e=>e.type==='locate'||e.type==='stomach-locate'))facts.push('旅行中，你们打开人体图寻找线索。遇到疑问，知道去哪里找答案，真不错！');
    else if(record.journey?.completedAt)facts.push('你们走完了食物的旅行，把探索坚持到了最后，老师为你们高兴！');
    if(!facts.length&&record.observation?.completedAt)facts.push('你们完成了观察，给认识身体积累了新的线索。继续带着好奇心去发现吧！');
    if(!facts.length)facts.push(record.evaluation?.completedAt?'你们认真回顾了这节课的表现。愿意认识自己的进步，就是一个很好的开始！':'你们留下了自己的学习作品，迈出了探索身体的一步。继续把想法大胆表达出来吧！');
    const persistencePraise=record.journey?.completedAt
      ? '你们把整趟旅行坚持完成了，这份做事有始有终的认真劲儿，值得表扬！'
      : record.v2?.completedAt
        ? '你们完成了观察后的第二次模型，把探索继续做了下去，老师为这份坚持点赞！'
        : '老师注意到了你们遇到问题还愿意继续尝试的表现，这份不轻易放弃的劲头真棒！';
    const encouragement=stars[category]>0?[
      '你们在观察和思考上的投入，老师看见啦！',
      '老师看到了你们一起参与、共同合作的表现，和伙伴并肩努力的样子真棒！',
      persistencePraise][category]:'带着这份好奇，继续发现身体里的秘密吧！';
    return {...old,stars,title:word+'小小探索家',reason:facts[(Number(record.groupId)-1)%facts.length]+' '+encouragement,
      category,recordId:record.id,evaluationAt:record.evaluation?.completedAt||null,issuedAt:Date.now(),groupId:record.groupId};
  });
}
