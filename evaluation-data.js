import {cloudDb, readOptionalDocument} from './student-data.js?v=20261109-ui3';
export const dimensions = ['观察有依据','合作会倾听','遇到问题再尝试'];
export async function readDocument(id) {
  const db=await cloudDb();
  const result=await readOptionalDocument(db.collection('food-journey-groups').doc(id));
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

export async function sendClassCommand(resetId, phase, commandId, details={}) {
  if(await roundId()!==(resetId||null))throw new Error('课堂已换轮次，请刷新。');
  const db=await cloudDb();
  const result=await db.collection('food-journey-groups').doc('class-control').set({resetId,phase,commandId,...(phase==='discussion'?{discussionIndex:Math.max(0,Math.min(2,Number(details.discussionIndex)||0))}:{})});
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
  ,'discussion-digestion':'💬','discussion-breathing':'🫁','discussion-movement':'🏃'
};
const additionalAwardIcons = ['⭐','🌟','✨','🏅','🎖️','🏆','🎉','🎈','🌼','🍀','🚀','🎨'];
export function awardIcon(entry) {
  if(entry.awardBasis?.isAdditional)return additionalAwardIcons[Number(entry.groupId)-1]||'⭐';
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
      '一开始没认准'+organs+'，后来我们重新选择，找到了正确的答案。肯修正自己的判断，这一步进步很可贵！',
      '我们在'+organs+'的辨认中，从选错到选对，没有停在第一次答案上。我们用重新判断纠正了最初的答案。'
    ]);
  }
  const airway = events.findIndex(event => event.type === 'airway');
  if (airway >= 0 && events.slice(airway + 1).some(event => event.type === 'safe-swallow')) {
    add('swallow-correction','通道辨析',2,10,[
      '食团误入气管后，我们重新选择了通向食管的路。能把这次尝试改过来，我们又向前迈进了一步！',
      '我们经历了“走错通道”，随后选中了食管。把刚才的错误变成下一次选择的提醒，我们学会了从尝试中寻找线索！'
    ]);
  }
  if (has('fork-side-view')) add('side-view','换位观察',0,7,[
    '我们打开侧面图查看气管和食管。正面看不清的关系，换个角度再看，这是很好的观察办法！',
    '我们从侧面查看两条通道，比较它们的前后关系。这次换角度观察，让两条通道的位置关系更清楚了。'
  ]);
  if (has('villi-detail')) add('villi','细节探究',0,7,[
    '我们把小肠绒毛放大来看，留意到了肠壁上的细小结构。愿意走近细节，才能找到更多线索！',
    '我们没有只看小肠的外形，还打开了绒毛细节。我们把观察从器官外形深入到了肠壁细节。'
  ]);
  if (has('locate') || has('stomach-locate')) add('location','线索追寻',0,6,[
    '探索时，我们主动打开人体图查位置。把眼前的器官放回身体里找一找，是解决疑问的好办法！',
    '我们会借助人体图寻找线索，把局部观察和身体的位置联系起来。遇到疑问时能用好工具，我们学会了从尝试中寻找线索！'
  ]);
  if (has('villi-detail') && (has('nutrient-absorption') || has('nutrient-absorption-start'))) {
    add('structure-function','结构寻因',0,9,[
      '我们既查看了小肠绒毛，也探索了营养吸收。把“长什么样”和“做什么工作”放在一起观察，这个方向很有价值！',
      '我们关注了绒毛的样子，又体验了营养吸收。我们同时关注了器官的结构和作用，观察得很全面。'
    ]);
  }
  if (record.v1?.completedAt && record.v2?.completedAt) {
    const before = record.v1.positions || {}, after = record.v2.positions || {};
    const moved = Object.keys(organNames).filter(id => before[id] && after[id] &&
      Math.hypot(before[id].x-after[id].x, before[id].y-after[id].y) > 2.5);
    if (moved.length) {
      const organs = moved.map(id => organNames[id]).join('、');
      add('model-position','模型推敲',0,8,[
        '第二次建模时，我们重新调整了'+organs+'的位置。愿意重新检查最初的摆放，我们把新的想法落实到了模型中。',
        '我们对'+organs+'的位置作了新的调整。模型的变化留下了我们重新推敲的痕迹。'
      ]);
    }
    const first = record.v1.routeOrder || [], second = record.v2.routeOrder || [];
    if (first.length && second.length && first.join(',') !== second.join(',')) {
      add('model-route','路线推敲',0,8,[
        '我们第二次画出的食物路线，经过器官的顺序有了变化。愿意重新推敲“先到哪里、再到哪里”，这是思考的进步！',
        '我们重新调整了食物经过器官的顺序，把路线当作需要检验的想法。修改前后的路线记录了我们重新思考的过程。'
      ]);
    }
  }
  if (stars[0] > 0) add('teacher-observation','用心观察',0,5,[
    '认真观察是我们这节课的一处亮点。这份专注让小组的观察更细致。',
    '用心观察是我们这节课的亮点。我们在这节课里展现了观察时的专注。'
  ]);
  if (stars[1] > 0) add('teacher-cooperation','合作同行',1,5,[
    '合作是我们这节课的一处亮点。一起把小组的事情做好，让我们的合作有了成果。',
    '我们这节课的合作表现得到了老师的肯定。这份彼此配合的表现值得肯定。'
  ]);
  if (stars[2] > 0) add('teacher-persistence','坚持探索',2,5,[
    '遇到问题时，我们愿意继续尝试。遇到困难仍肯动脑和动手，这份坚持值得表扬！',
    '我们在探索中表现出的坚持很可贵。困难面前，我们展现了坚持探索的劲头。'
  ]);
  if (!candidates.length) {
    add('reflection','成长启航',0,1,[
      record.evaluation?.completedAt
        ? '我们给观察、合作和坚持评了星，完成了一次对学习表现的回顾。我们认真回顾了小组在课堂上的表现。'
        : '我们已经开始了对身体的探索。主动参与了这次探索，值得为自己鼓掌。'
    ]);
  }
  return candidates;
}


const fixedAwards=[
  {key:'teacher-observation',title:'细心观察员',praise:'我们在课堂探索中用心观察，愿意留意容易忽略的细节。这份细心值得表扬！'},
  {key:'teacher-cooperation',title:'合作好伙伴',praise:'我们愿意听伙伴说完自己的想法，也为小组的共同任务出一份力。这份合作值得表扬！'},
  {key:'teacher-persistence',title:'坚持小勇士',praise:'遇到问题时，我们愿意再想一想、再试一次。这份坚持值得表扬！'}
];
export const sharingAwards={
  '初始模型':{key:'initial-idea',category:0,praise:'我们上台分享了最初的模型，让全班有机会一起看看、讨论我们的想法。愿意把猜想说出来，就是探究的好起点！'},
  'AR观察':{key:'observation-breadth',category:0,praise:'我们把在 AR 观察中的发现带到了全班交流，让大家有了新的观察线索。愿意分享发现，这份主动值得表扬！'},
  '修正模型':{key:'revision-work',category:0,praise:'我们上台分享了修正后的模型，让大家看到观察之后的想法。愿意把重新思考的结果拿出来交流，这份认真值得肯定！'},
  '实体拼装':{key:'assembly-work',category:1,praise:'我们上台展示了小组的拼装作品，把动手做出的成果带给了全班。愿意分享自己的作品，这份主动值得喝彩！'},
  '研讨1':{key:'discussion-digestion',title:'食物旅行向导',category:0,praise:'我们在研讨中当了一回食物旅行向导，把自己在旅程中的发现讲给全班听。小组的探索，因为这次分享成了全班共同的收获。'},
  '研讨2':{key:'discussion-breathing',title:'科学连线员',category:0,praise:'在消化与呼吸的研讨中，我们把自己的猜想说给全班听，为这两项身体活动的关系提供了一个思考角度。这份敢想、敢表达的表现值得肯定！'},
  '研讨3':{key:'discussion-movement',title:'身体协作侦探',category:0,praise:'我们从熟悉的跳绳说起，参与了全班对身体器官如何协作的讨论。把生活里的运动和课堂上的科学联系起来，是这次发言的亮点。'}
};
const awardOrder = ['villi','identify-correction','swallow-correction','model-position','model-route',
  'side-view','location','identify-accurate','absorption','observation-breadth',
  'assembly-work',
  'revision-work','initial-idea','journey-complete','reflection'];
const awardTitles = ['微观探究家','纠错小智者','通道守护者','模型设计师','路线规划师',
  '换位观察家','人体导航员','器官辨认能手','吸收探索家','广角观察员',
  '巧手建造师',
  '模型修订员','想法表达家','旅程探索者','成长回顾家'];
const additionalAwards = [
  ['发现小先锋','值得给自己鼓掌的是，','这份投入，为我们的课堂探索添了一笔。'],
  ['科学漫游者','回看这趟探索，有一段经历值得记下来。','这是属于我们小组的一段科学探索经历。'],
  ['好奇行动派','好奇心有了行动，这份记录就有了意义。','把好奇变成课堂上的行动，就是我们这节课的收获。'],
  ['探秘小达人','我们的探秘留下了一条实实在在的线索。','我们亲身参与，也给这次探秘留下了自己的印记。'],
  ['科学寻宝队','这份记录就是我们在课堂上找到的一件小宝贝。','这份成果值得我们珍藏。'],
  ['课堂探索家','课堂上这段亲手参与的经历，值得在交流时说一说。','这是我们认真参与课堂的见证。'],
  ['科学体验家','这段亲身体验让课本里的知识更容易记住。','亲身体验，是我们这一节课的亮点。'],
  ['探索小队员','我们的探索有了值得回看的记录。','小组在探索中付出的努力，留在了这份记录里。'],
  ['探究新星','这份课堂记录里，有一件值得认真肯定的事。','这份小组成果，值得一声祝贺。']
];
export const participationPraise='我们提交了本轮课堂活动记录，留下了小组参与这节课的成果。';

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
      ? '我们打开了 '+count('villi-detail')+' 次绒毛细节，把目光放到了小肠内壁的小小结构上。愿意回到细节中观察，这份好奇值得珍惜！'
      : '我们打开绒毛细节，把观察从小肠的整体推进到内壁的小小结构。从整体看到局部，这份细致让我们的观察多了一层。'];
  }
  const observed=new Set((record.observation?.views||[]).map(v=>v.organId).filter(Boolean));
  if(record.observation?.completedAt&&observed.size)add('observation-breadth',0,observed.size,'我们观察了 '+observed.size+' 种器官，把探索的目光投向身体里的不同地方。这一轮观察让我们的探索覆盖了多个器官。');
  if(record.assembly?.completedAt)add('assembly-work',1,1,'我们完成了实体拼装，把纸面上的想法变成了可以查看的作品。这件实物作品凝聚了小组的想法和动手成果。');
  if(record.v1?.completedAt)add('initial-idea',0,1,'我们用初始模型表达了食物在身体里旅行的想法。愿意把想法摆出来、画出来，就是讨论和检验的好起点！');
  if(record.v2?.completedAt)add('revision-work',0,1,'观察之后，我们完成并提交了第二份模型。第二份作品记录了我们观察后重新建模的成果。');
  if(record.journey?.completedAt)add('journey-complete',2,new Set((journey.visits||[]).map(v=>v.organId)).size||1,'我们完成了这次食物旅行，走到了探索的终点。从出发到抵达终点，我们完整经历了这段探索。');
  if(record.evaluation?.completedAt)add('reflection',1,1,'我们认真提交了观察、合作和坚持的自评。我们为这节课的观察、合作和坚持留下了自己的评价。');
  if(count('nutrient-absorption','nutrient-absorption-start'))add('absorption',0,1,'我们体验了营养吸收的过程，把注意力放在食物中的营养去了哪里。把目光放在营养的去向上，是我们这次探索的亮点。');
  const correct=new Set(events.filter(e=>e.type==='identify'&&organNames[e.organId]===e.choice).map(e=>e.organId));
  if(correct.size)add('identify-accurate',0,correct.size,'我们在旅行中正确辨认了 '+correct.size+' 种器官。这些正确的辨认是我们在旅程中取得的成果。');
  return candidates;
}

export function makeAwards(records, groups, shares={}) {
  const rows=[...records].sort((a,b)=>Number(a.groupId)-Number(b.groupId)).map(record=>{
    const old=groups[record.groupId]||{};
    const stars=dimensions.map((_,i)=>Math.max(0,Math.min(5,Number(old.stars?.[i])||0)));
    const levels=record.evaluation?.completedAt?record.evaluation.levels||[]:[];
    return {record,old,stars,levels,candidates:awardCandidates(record,stars)};
  });
  const assigned=new Map();
  // Stable round-specific tie break; refresh never rerolls an equal result.
  const tie=row=>{let n=2166136261;for(const c of String(row.record.resetId||'')+':'+row.record.groupId)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
  fixedAwards.forEach(({key,title,praise},category)=>{
    const selfScore=row=>Number(row.levels[category])||0;
    const row=rows.filter(r=>!assigned.has(r.record.groupId)).sort((a,b)=>
      selfScore(b)-selfScore(a)||b.stars[category]-a.stars[category]||tie(a)-tie(b))[0];
    if(!row)return;
    assigned.set(row.record.groupId,{key,title,category,metric:selfScore(row),texts:[praise]});
  });
  const usedKeys=new Set();
  for(const [stage,{key,title,category,praise}] of Object.entries(sharingAwards)){
    const group=shares[stage]??(stage==='研讨1'?shares['食物旅行']:null);
    const row=rows.find(r=>Number(r.record.groupId)===Number(group));
    if(!row||assigned.has(row.record.groupId))continue;
    assigned.set(row.record.groupId,{key,title,category,metric:1,texts:[praise],sharingStage:stage});
    usedKeys.add(key);
  }
  for(const key of awardOrder){
    if(usedKeys.has(key))continue;
    const eligible=rows.filter(r=>!assigned.has(r.record.groupId)&&r.candidates.some(c=>c.key===key));
    const candidate=row=>row.candidates.find(c=>c.key===key);
    eligible.sort((a,b)=>{const ca=candidate(a),cb=candidate(b);return cb.metric-ca.metric||b.stars[cb.category]-a.stars[ca.category]||
      (Number(b.levels[cb.category])||0)-(Number(a.levels[ca.category])||0)||tie(a)-tie(b);});
    if(eligible.length){const row=eligible[0];assigned.set(row.record.groupId,candidate(row));}
  }
  let additionalIndex=0;
  return rows.map(row=>{
    const {record,old,stars}=row;
    const assignedAward=assigned.get(record.groupId);
    const isAdditional=!assignedAward;
    const primary=assignedAward||awardOrder.map(key=>row.candidates.find(c=>c.key===key)).find(Boolean)
      ||{key:'participation',category:0,metric:0,texts:[participationPraise]};
    const index=awardOrder.indexOf(primary.key);
    const evidence=primary.texts[(Number(record.groupId)-1)%primary.texts.length];
    let title=awardTitles[index]||primary.title;
    let reason=evidence;
    if(isAdditional){
      const [name,praise,celebration]=additionalAwards[additionalIndex++];
      title=name;
      const observation=evidence.match(/^.*?[。！？]/u)?.[0]||evidence;
      reason=praise+observation+celebration;
    }
    const reasonParagraphs=[reason];
    const award={...old,stars,title,
      reason:reasonParagraphs.join('\n'),reasonParagraphs,evidenceKey:primary.key,
      category:primary.category,
      awardBasis:{metric:primary.metric,teacherStars:stars[primary.category],selfStars:Number(row.levels[primary.category])||0,isAdditional,sharingStage:primary.sharingStage||null},
      recordId:record.id,evaluationAt:record.evaluation?.completedAt||null,issuedAt:Date.now(),groupId:record.groupId};
    return {...award,icon:awardIcon(award)};
  });
}
