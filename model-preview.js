const organs = [
  { id: "mouth", name: "口腔", image: "assets/organs/mouth-gentle.svg", width: 12 },
  { id: "esophagus", name: "食管", image: "assets/organs/esophagus.webp", width: 7, height: 16 },
  { id: "stomach", name: "胃", image: "assets/organs/stomach.webp", width: 17, angle: 16 },
  { id: "small-intestine", name: "小肠", image: "assets/organs/small-intestine.webp", width: 17.5 },
  { id: "large-intestine", name: "大肠", image: "assets/organs/large-intestine.webp", width: 23.5 },
];

const revisionOnlyIds=new Set(['nose','trachea','lungs','liver','pancreas']);
organs.push({id:'nose',name:'鼻子',image:'assets/organs/nose-gentle.svg',width:9});
organs.push({id:'trachea',name:'气管',image:'assets/organs/trachea-atlas.png',width:12,height:20},{id:'lungs',name:'肺',image:'assets/organs/lungs-atlas.png',width:31},{id:'liver',name:'肝',image:'assets/organs/liver-soft.webp',width:19},{id:'pancreas',name:'胰脏',image:'assets/organs/pancreas-soft.webp',width:11});

function organById(id) {
  return organs.find((organ) => organ.id === id);
}

function appearanceFor(organ, model) {
  if (model.visualStyle?.[organ.id]) return model.visualStyle[organ.id];
  // Old submitted records keep their original appearance for V1/V2 comparison.
  if (model.completedAt) return {width:({stomach:18,'small-intestine':20,'large-intestine':26})[organ.id] || organ.width, height:organ.height, angle:organ.id==='stomach'?-8:0};
  return {width:organ.width, height:organ.height, angle:organ.angle || 0};
}

// Centreline of the colon artwork. The hollow centre is outside its pipe wall.
function colonWallDistance(x,y) {
  const rim=[[-.56,.16],[-.68,-.2],[-.64,-.66],[-.35,-.58],[0,-.48],[.36,-.56],[.65,-.76],[.72,-.3],[.7,.25],[.48,.48],[.1,.44],[0,.82]];
  let distance=Infinity;
  for(let i=1;i<rim.length;i++){
    const a=rim[i-1],b=rim[i],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
    distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)/.24);
  }
  return distance;
}

function sampleFoodRoute(points) {
  const samples=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,(b.y-a.y)*1.5)/.35));
    for(let j=i===1?0:1;j<=steps;j++){
      const t=j/steps;
      samples.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,at:i-1+t});
    }
  }
  return samples;
}

function routeOrganDistance(point,organ,model) {
  const position=model.positions[organ.id],appearance=appearanceFor(organ,model);
  const angle=(appearance.angle||0)*Math.PI/180;
  const dx=point.x-position.x,dy=(point.y-position.y)*1.5;
  const x=(dx*Math.cos(angle)+dy*Math.sin(angle))/Math.max(3,appearance.width/2);
  const y=(dy*Math.cos(angle)-dx*Math.sin(angle))/Math.max(3,(appearance.height||appearance.width/1.5)*.75);
  return organ.id==='large-intestine'?colonWallDistance(x,y):Math.hypot(x,y);
}

function intestinalContacts(model,samples) {
  const small=organById('small-intestine'),colon=organById('large-intestine');
  const hasSmall=model.positions?.[small.id],hasColon=model.positions?.[colon.id];
  let reachedSmall=false,startsOnColon=false,colonEntry;
  const contacts=samples.map((point,index)=>{
    const colonDistance=hasColon?routeOrganDistance(point,colon,model):Infinity;
    const smallDistance=hasSmall?routeOrganDistance(point,small,model):Infinity;
    if(index===0)startsOnColon=colonDistance<=1&&smallDistance>.75;
    const onColon=colonDistance<=1;
    if(reachedSmall&&onColon&&colonEntry===undefined)colonEntry=point;
    if(!onColon&&smallDistance<=.75)reachedSmall=true;
    return {point,colonDistance,afterSmall:colonEntry!==undefined};
  });
  return {contacts,colonEntry,ignoreApproach:reachedSmall&&!startsOnColon};
}

function routeLayers(model) {
  const points=model.routePoints||[];
  const {colonEntry}=intestinalContacts(model,sampleFoodRoute(points));
  if(!colonEntry)return {behind:points,front:[]};
  const index=Math.floor(colonEntry.at);
  const split=Number.isInteger(colonEntry.at)?points[index]:colonEntry;
  const next=index+1;
  return {behind:[...points.slice(0,next),...(split===points[index]?[]:[split])],front:[split,...points.slice(next)]};
}

function isModelPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
}

function svgPoints(points) {
  return points.filter(isModelPoint).map(point => `${point.x},${point.y*1.5}`).join(" ");
}

function miniModel(model, label, options = {}) {
  if (!model) return `<div class="mini-empty"><strong>${label}</strong><span>尚未提交</span></div>`;
  const routePoints=Array.isArray(model.routePoints)?model.routePoints.filter(isModelPoint):[];
  const {behind,front}=routeLayers({...model,routePoints});
  const structureColor=/^#[0-9a-f]{6}$/i.test(model.structureColor)?model.structureColor:'#2878cf';
  const strokes=Array.isArray(model.structureStrokes)?model.structureStrokes.filter(Array.isArray):[];
  const pieces = organs.map((organ) => {
    const position = model.positions?.[organ.id];
    if (!isModelPoint(position) || (options.phase === "v1" && (organ.id === "esophagus" || revisionOnlyIds.has(organ.id)))) return "";
    const appearance = appearanceFor(organ,model);
    const width = Number.isFinite(appearance.width) ? appearance.width : organ.width;
    const height = Number.isFinite(appearance.height) ? appearance.height : organ.height;
    const angle = Number.isFinite(appearance.angle) ? appearance.angle : organ.angle || 0;
    return `<img class="organ-${organ.id}" src="${organ.image}" alt="${organ.name}" title="${organ.name}" style="left:${position.x}%;top:${position.y}%;width:${width}%;${height ? `height:${height}%;` : ""}transform:translate(-50%,-50%) rotate(${angle}deg)">`;
  }).join("");
  const interactive = Number.isInteger(options.groupId);
  const attributes = interactive ? ` data-group-id="${options.groupId}" data-model-phase="${options.phase}" role="button" tabindex="0" aria-label="放大第 ${options.groupId} 组${label}"` : "";
  return `<div class="${label === "观察前想法" && !model._paired ? "mini-model-single" : "mini-model-item"}${interactive ? " mini-model-clickable" : ""}"${attributes}><strong class="mini-label">${label}</strong><div class="mini-model"><img class="mini-body" src="assets/anatomy/body-outline-generated.webp?v=20261022-7" alt=""><svg viewBox="0 0 100 150" preserveAspectRatio="none">${strokes.map(stroke => `<polyline points="${svgPoints(stroke)}" style="stroke:${structureColor}"/>`).join("")}<polyline points="${svgPoints(behind)}" style="stroke:#17824d"/></svg>${pieces}${front.length>1?`<svg class="front-route-svg" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><polyline points="${svgPoints(front)}" style="stroke:#17824d"/></svg>`:""}</div></div>`;
}

export {organs, revisionOnlyIds, organById, appearanceFor, sampleFoodRoute, routeOrganDistance, intestinalContacts, routeLayers, miniModel};
