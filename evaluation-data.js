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

const evidenceIcons = {
  'identify-correction':'💡', 'swallow-correction':'🛡️',
  'side-view':'🔄', 'villi':'🔬', 'location':'🗺️',
  'structure-function':'🔗', 'model-position':'🧩', 'model-route':'🧭',
  'teacher-observation':'🔎', 'teacher-cooperation':'🤝',
  'teacher-persistence':'🌱', 'reflection':'🪞',
  'observation-breadth':'📚', 'assembly-work':'🛠️', 'initial-idea':'✏️',
  'revision-work':'📝', 'journey-complete':'🎒', 'absorption':'💧', 'identify-accurate':'🎯'
};
export function awardIcon(entry) {
  return evidenceIcons[entry.evidenceKey] || ['🔎','🤝','🌱'][entry.category] || '🌻';
}
const organNames = {
  mouth:'口腔', esophagus:'食管', stomach:'胃',
  small:'小肠', large:'大肠', 'small-intestine':'小肠', 'large-intestine':'大肠',
  trachea:'气管', lungs:'肺'
};

export function journeyEvents(journey={}) {
  const current=journey.history?.some(e=>e.type)?journey.history:journey.events||[];
  return [...(journey.attempts||[]).flatMap(a=>a.events||[]),...current];
}

// Praise observable choices and revisions. Completion alone does not establish understanding.
export function awardEvidence(record, stars) {
  const candidates = [];
  const add = (key, title, category, priority, texts) => {
    candidates.push({key, title, category, priority, texts});
  };
  const journey = record.journey || {};
  const events = journeyEvents(journey);
  const has = type => events.some(event => event.type === type);
  const corrected = [];
  const mistaken = new Set();
  for (const event of events) {
    if (event.type !== 'identify' || !organNames[event.organId] || typeof event.choice !== 'string' || !event.choice.trim()) continue;
    if (event.choice !== organNames[event.organId]) mistaken.add(event.organId);
    else if (mistaken.has(event.organId) && !corrected.includes(event.organId)) corrected.push(event.organId);
  }
  if (corrected.length) {
    const organs = corrected.map(id => organNames[id]).join('、');
    add('identify-correction','辨认进步',2,10,[
      '一开始没认准'+organs+'，后来你们重新选择，找到了正确的答案。肯修正自己的判断，这一步进步很可贵！',
      '你们在'+organs+'的辨认中，从选错到选对，没有停在第一次答案上。老师喜欢这份愿意改正的认真！'
    ]);
  }
  const airway = events.findIndex(event => event.type === 'airway');
  if (airway >= 0 && events.slice(airway + 1).some(event => event.type === 'safe-swallow')) {
    add('swallow-correction','通道辨析',2,10,[
      '食团误入气管后，你们重新选择了通向食管的路。能把这次尝试改过来，真有进步！',
      '你们经历了“走错通道”，随后选中了食管。把刚才的错误变成下一次选择的提醒，值得表扬！'
    ]);
  }
  if (has('fork-side-view')) add('side-view','换位观察',0,7,[
    '你们打开侧面图查看气管和食管。正面看不清的关系，换个角度再看，这是很好的观察办法！',
    '你们特意从侧面查看两条通道，把目光放在它们的前后关系上。会选择观察角度，真不错！'
  ]);
  if (has('villi-detail')) add('villi','细节探究',0,7,[
    '你们把小肠绒毛放大来看，留意到了肠壁上的细小结构。愿意走近细节，才能找到更多线索！',
    '你们没有只看小肠的外形，还打开了绒毛细节。把观察从整体推进到局部，这个做法很棒！'
  ]);
  if (has('locate') || has('stomach-locate')) add('location','线索追寻',0,6,[
    '探索时，你们主动打开人体图查位置。把眼前的器官放回身体里找一找，是解决疑问的好办法！',
    '你们会借助人体图寻找线索，把局部观察和身体的位置联系起来。遇到疑问时能用好工具，值得表扬！'
  ]);
  if (has('villi-detail') && (has('nutrient-absorption') || has('nutrient-absorption-start'))) {
    add('structure-function','结构寻因',0,9,[
      '你们既查看了小肠绒毛，也探索了营养吸收。把“长什么样”和“做什么工作”放在一起观察，这个方向很有价值！',
      '你们关注了绒毛的样子，又体验了营养吸收。继续追问这两者有什么关系，就能把发现想得更深入！'
    ]);
  }
  if (record.v1?.completedAt && record.v2?.completedAt) {
    const before = record.v1.positions || {}, after = record.v2.positions || {};
    const moved = Object.keys(organNames).filter(id => before[id] && after[id] &&
      Math.hypot(before[id].x-after[id].x, before[id].y-after[id].y) > 2.5);
    if (moved.length) {
      const organs = moved.map(id => organNames[id]).join('、');
      add('model-position','模型推敲',0,8,[
        '第二次建模时，你们重新调整了'+organs+'的位置。愿意重新检查最初的摆放，老师看到了你们修改想法的行动！',
        '你们对'+organs+'的位置作了新的调整。把想法落实到模型里，再看看是否合适，这是认真推敲的表现！'
      ]);
    }
    const first = record.v1.routeOrder || [], second = record.v2.routeOrder || [];
    if (first.length && second.length && first.join(',') !== second.join(',')) {
      add('model-route','路线推敲',0,8,[
        '你们第二次画出的食物路线，经过器官的顺序有了变化。愿意重新推敲“先到哪里、再到哪里”，这是思考的进步！',
        '你们重新调整了食物经过器官的顺序，把路线当作需要检验的想法。接着说说修改的依据，会更有说服力！'
      ]);
    }
  }
  if (stars[0] > 0) add('teacher-observation','用心观察',0,5,[
    '你们在观察上的认真，值得表扬。继续带着问题看一看，把发现说清楚，让自己的判断更有依据！',
    '用心观察是你们这节课的亮点。下次再多比较一处细节，也许就会找到新的线索！'
  ]);
  if (stars[1] > 0) add('teacher-cooperation','合作同行',1,5,[
    '合作是你们这节课的一处亮点。把小组的事一起做好，值得肯定；继续让每位伙伴都有参与的机会！',
    '你们这节课的合作表现得到了老师的肯定。一起完成任务时，继续听听伙伴的想法，让小组的办法更丰富！'
  ]);
  if (stars[2] > 0) add('teacher-persistence','坚持探索',2,5,[
    '遇到问题还愿意继续尝试，这份劲头值得表扬。再想一次、再试一次，办法就有机会变得更好！',
    '你们在探索中表现出的坚持很可贵。继续比较每次尝试有什么不同，让下一次尝试更有方向！'
  ]);
  if (!candidates.length) {
    add('reflection','成长启航',0,1,[
      record.evaluation?.completedAt
        ? '你们给观察、合作和坚持评了星，完成了一次对学习表现的回顾。下次选一个具体例子，说说哪颗星最能代表自己的进步吧！'
        : '你们已经开始了对身体的探索。接下来挑一个最想弄清的问题，带着它去观察、比较，老师期待听到你们的新发现！'
    ]);
  }
  return candidates;
}


// One award per group and one group per award family. No cosmetic title suffixes.
const awardOrder = ['villi','identify-correction','swallow-correction','model-position','model-route',
  'side-view','location','identify-accurate','absorption','observation-breadth',
  'teacher-cooperation','teacher-persistence','teacher-observation','assembly-work',
  'revision-work','initial-idea','journey-complete','reflection'];
const awardTitles = ['微观探究家','纠错小智者','通道守护者','模型设计师','路线规划师',
  '换位观察家','人体导航员','器官辨认能手','吸收探索家','广角观察员',
  '合作好伙伴','坚持小勇士','细心观察员','巧手建造师',
  '模型修订员','想法表达家','旅程探索者','成长回顾家'];
const awardGoals = ['放大绒毛，看清细小结构','检查答案，尝试修正自己的判断','比较气管与食管，找准食物的通道',
  '对照观察，推敲器官的位置','检查食物路线，想清楚经过的顺序','换个角度，看看原来没看清的地方',
  '借助人体图，寻找器官的位置','留意器官特点，再作出辨认','追踪营养，探索吸收的过程',
  '多看几种器官，比较它们的不同','听听伙伴的想法，一起解决问题','遇到问题时再试一次',
  '带着问题观察，把发现说清楚','动手搭建，把想法变成作品','回看最初的模型，试着作出调整',
  '摆一摆、画一画，表达自己的想法','沿着食物路线，寻找新的发现','回顾自己的表现，找到下一步目标'];

export function awardCandidates(record, stars) {
  const journey=record.journey||{};
  // history and events in schema 3 are aliases, never count both.
  const events=journeyEvents(journey);
  const count=(...types)=>events.filter(e=>types.includes(e.type)).length;
  const candidates=awardEvidence(record,stars).filter(c=>!['structure-function','reflection'].includes(c.key));
  const add=(key,category,metric,text)=>candidates.push({key,category,metric,texts:[text]});
  const mistaken=new Set(),corrected=new Set();
  for(const e of events){
    if(e.type!=='identify'||!organNames[e.organId]||typeof e.choice!=='string'||!e.choice.trim())continue;
    if(e.choice!==organNames[e.organId])mistaken.add(e.organId);
    else if(mistaken.has(e.organId))corrected.add(e.organId);
  }
  for(const c of candidates){
    c.metric=({'villi':count('villi-detail'),'side-view':count('fork-side-view'),
      'location':count('locate','stomach-locate'),
      'identify-correction':corrected.size,
      'swallow-correction':1,'model-position':Object.keys(record.v2?.positions||{}).filter(id=>record.v1?.positions?.[id]&&Math.hypot(record.v1.positions[id].x-record.v2.positions[id].x,record.v1.positions[id].y-record.v2.positions[id].y)>2.5).length,
      'model-route':1,'teacher-cooperation':stars[1],'teacher-persistence':stars[2],'teacher-observation':stars[0]})[c.key]||1;
    if(c.key==='villi')c.texts=[count('villi-detail')>1
      ? '你们打开了 '+count('villi-detail')+' 次绒毛细节，把目光放到了小肠内壁的小小结构上。愿意回到细节中观察，这份好奇值得珍惜！'
      : '你们打开绒毛细节，把观察从小肠的整体推进到内壁的小小结构。继续带着问题看一看，让每个发现都更清楚！'];
  }
  const observed=new Set((record.observation?.views||[]).map(v=>v.organId).filter(Boolean));
  if(record.observation?.completedAt&&observed.size)add('observation-breadth',0,observed.size,'你们观察了 '+observed.size+' 种器官，把探索的目光投向身体里的不同地方。继续比较它们的形状和作用，会有更多新发现！');
  if(record.assembly?.completedAt)add('assembly-work',1,1,'你们完成了实体拼装，把纸面上的想法变成了可以查看的作品。接着指着作品说说连接的理由，让大家听见你们的思考！');
  if(record.v1?.completedAt)add('initial-idea',0,1,'你们用初始模型表达了食物在身体里旅行的想法。愿意把想法摆出来、画出来，就是讨论和检验的好起点！');
  if(record.v2?.completedAt)add('revision-work',0,1,'观察之后，你们完成并提交了第二份模型。继续对照前后的作品，说说保留或调整的理由，让观察和想法连起来！');
  if(record.journey?.completedAt)add('journey-complete',2,new Set((journey.visits||[]).map(v=>v.organId)).size||1,'你们完成了这次食物旅行，走到了探索的终点。挑一站最有意思的经历讲给大家听，让一路的发现留下来！');
  if(record.evaluation?.completedAt)add('reflection',1,1,'你们认真提交了观察、合作和坚持的自评。愿意停下来回顾自己的表现，下一次努力就有了新的起点！');
  if(count('nutrient-absorption','nutrient-absorption-start'))add('absorption',0,1,'你们体验了营养吸收的过程，把注意力放在食物中的营养去了哪里。继续追踪这些变化，老师期待听见你们的新问题！');
  const correct=new Set(events.filter(e=>e.type==='identify'&&organNames[e.organId]===e.choice).map(e=>e.organId));
  if(correct.size)add('identify-accurate',0,correct.size,'你们在旅行中正确辨认了 '+correct.size+' 种器官。接下来试着说出辨认时用到的特点，让答案更有依据！');
  return candidates;
}

export function makeAwards(records, groups) {
  const rows=[...records].sort((a,b)=>Number(a.groupId)-Number(b.groupId)).map(record=>{
    const old=groups[record.groupId]||{};
    const stars=dimensions.map((_,i)=>Math.max(0,Math.min(5,Number(old.stars?.[i])||0)));
    const levels=record.evaluation?.completedAt?record.evaluation.levels||[]:[];
    return {record,old,stars,levels,candidates:awardCandidates(record,stars)};
  });
  const assigned=new Map(),used=new Set();
  // Stable round-specific tie break; refresh never rerolls an equal result.
  const tie=row=>{let n=2166136261;for(const c of String(row.record.resetId||'')+':'+row.record.groupId)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  for(const key of awardOrder){
    const eligible=rows.filter(r=>!assigned.has(r.record.groupId)&&r.candidates.some(c=>c.key===key));
    const candidate=row=>row.candidates.find(c=>c.key===key);
    eligible.sort((a,b)=>{const ca=candidate(a),cb=candidate(b);return cb.metric-ca.metric||b.stars[cb.category]-a.stars[ca.category]||
      (Number(b.levels[cb.category])||0)-(Number(a.levels[ca.category])||0)||tie(a)-tie(b);});
    if(eligible.length){const row=eligible[0];assigned.set(row.record.groupId,candidate(row));used.add(key);}
  }
  return rows.map(row=>{
    const {record,old,stars}=row;
    let primary=assigned.get(record.groupId),isEncouragement=false;
    if(!primary){
      // Sparse or identical records cannot prove twelve different strengths.
      // Use an explicitly forward-looking wish, never invent an observed action.
      const key=awardOrder.find(k=>!used.has(k));used.add(key);
      primary={key,category:0,metric:0,texts:['这份成长寄语送给第 '+record.groupId+' 组：下一次，试着'+awardGoals[awardOrder.indexOf(key)]+'。老师期待看到你们新的进步！']};
      isEncouragement=true;
    }
    const index=awardOrder.indexOf(primary.key);
    const reasonParagraphs=[primary.texts[(Number(record.groupId)-1)%primary.texts.length]];
    return {...old,stars,title:awardTitles[index]+(isEncouragement?' · 成长寄语':''),
      reason:reasonParagraphs.join('\n'),reasonParagraphs,evidenceKey:primary.key,
      icon:awardIcon({evidenceKey:primary.key,category:primary.category}),category:primary.category,
      awardBasis:{metric:primary.metric,teacherStars:stars[primary.category],selfStars:Number(row.levels[primary.category])||0,isEncouragement},
      recordId:record.id,evaluationAt:record.evaluation?.completedAt||null,issuedAt:Date.now(),groupId:record.groupId};
  });
}
