const organs = [
  { id: "mouth", name: "口腔", image: "assets/organs/mouth-gentle.svg", width: 12 },
  { id: "esophagus", name: "食管", image: "assets/organs/esophagus.webp", width: 7, height: 16 },
  { id: "stomach", name: "胃", image: "assets/organs/stomach.webp", width: 17, angle: 16 },
  { id: "small-intestine", name: "小肠", image: "assets/organs/small-intestine.webp", width: 17.5 },
  { id: "large-intestine", name: "大肠", image: "assets/organs/large-intestine.webp", width: 23.5 },
];

const revisionOnlyIds=new Set(['trachea','lungs','liver','pancreas','nose']);
organs.push({id:'nose',name:'鼻子',image:'assets/organs/nose-gentle.svg',width:9});
organs.push({id:'trachea',name:'气管',image:'assets/organs/trachea-atlas.png',width:12,height:20},{id:'lungs',name:'肺',image:'assets/organs/lungs-atlas.png',width:31},{id:'liver',name:'肝',image:'assets/organs/liver-atlas.png',width:25},{id:'pancreas',name:'胰',image:'assets/organs/pancreas-atlas.png',width:18});
const CLOUD_ENV = "motionless-harrier-d7cuz0659ef1a";
const CLOUD_COLLECTION = "food-journey-groups";
const LOCAL_CLEAR_SIGNAL_KEY = "foodJourneyClassLocalClear";
const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "teacher" ? "teacher" : "student";
const parsedGroup = Number(params.get("group"));
const groupId = Number.isInteger(parsedGroup) && parsedGroup >= 1 && parsedGroup <= 12 ? parsedGroup : 1;
let sessionId = `group-${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
let activeResetId = null;

const studentView = document.querySelector("#student-view");
const teacherView = document.querySelector("#teacher-view");
const transitionPanel = document.querySelector("#transition-panel");
const stage = document.querySelector("#body-stage");
const placedLayer = document.querySelector("#placed-organs");
const palette = document.querySelector("#organ-palette");
const canvas = document.querySelector("#route-canvas");
const context = canvas.getContext("2d");
const frontRouteCanvas = document.createElement("canvas");
frontRouteCanvas.className = "front-route-canvas";
frontRouteCanvas.setAttribute("aria-hidden","true");
canvas.after(frontRouteCanvas);
const frontRouteContext = frontRouteCanvas.getContext("2d");
const drawButton = document.querySelector("#draw-route-button");
const submitButton = document.querySelector("#submit-model-button");
const saveStatus = document.querySelector("#save-status");
const routeSummary = document.querySelector("#route-summary");
const drawTip = document.querySelector("#draw-tip");
const placementCount = document.querySelector("#placement-count");
const taskHint = document.querySelector("#task-hint");

let phase = "v1";
let v1 = createModel();
let v2 = null;
let dragState = null;
let drawMode = false;
let drawingKind="route", selectedOrgan=null;
let drawing = false;
let history = [];
let cloudDatabase = null;
let cloudLoginPromise = null;
let draftSaveTimer = null;
let dashboardRecords = [];
let teacherModelPhase = 'v1';
window.addEventListener('teacher-stage-view',event=>{
  teacherModelPhase=event.detail;
  renderDashboard(dashboardRecords);
});
let dashboardPage = 0;
let resetCheckInProgress = false;
let pendingSubmissionSync = false;
let modelSubmitting = false;
let discardDraftOnExit = false;
let lessonExtras = {};

function readLiveModel(){return {phase,model:clone(activeModel()),completed:Boolean(activeModel()?.completedAt)};}
window.readLiveModel=readLiveModel;
function createModel() {
  return {
    startedAt: Date.now(),
    structureColor:"#f4a329",
    visualStyle: Object.fromEntries(organs.map(o => [o.id, {width:o.width, height:o.height, angle:o.angle || 0}])),
    completedAt: null,
    positions: {},
    placementOrder: [],
    moves: [],
    modificationCount: 0,
    routePoints: [],
    routeOrder: [],
    routeDistances: {},
    routeAttempts: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function activeModel() {
  return phase === "v1" ? v1 : v2;
}

function organById(id) {
  return organs.find((organ) => organ.id === id);
}

function appearanceFor(organ, model) {
  if (model.visualStyle?.[organ.id]) return model.visualStyle[organ.id];
  // Old submitted records keep their original appearance for V1/V2 comparison.
  if (model.completedAt) return {width:({stomach:18,'small-intestine':20,'large-intestine':26})[organ.id] || organ.width, height:organ.height, angle:organ.id==='stomach'?-8:0};
  return {width:organ.width, height:organ.height, angle:organ.angle || 0};
}

function allOrgansPlaced() {
  return organs.every((organ) => activeModel().positions[organ.id]);
}

function snapshot() {
  history.push(clone(activeModel()));
  if (history.length > 30) history.shift();
}

function createOrganButton(organ, placed = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = placed ? "placed-organ" : "palette-organ";
  button.dataset.organ = organ.id;
  const label=phase === "v1" && organ.id === "large-intestine" ? "" : phase === "v2" && organ.id === "trachea" ? "气管（前）" : phase === "v2" && organ.id === "esophagus" ? "食管（后）" : organ.name;
  button.setAttribute("aria-label", label || "未命名器官");
  button.innerHTML = `<img src="${organ.image}" alt="" draggable="false"><span>${label}</span>`;
  button.addEventListener("pointerdown", beginOrganDrag);
  return button;
}

function renderPalette() {
  palette.replaceChildren(...organs.filter(o => phase !== "v1" || (o.id !== "esophagus" && !revisionOnlyIds.has(o.id))).map(o=>createOrganButton(o)));
  for (const button of palette.children) button.hidden = Boolean(activeModel().positions[button.dataset.organ]);
}

function renderPlacedOrgans() {

  organs.forEach((organ) => {
    const position = activeModel().positions[organ.id];
    const appearance = appearanceFor(organ, activeModel());
    let button = placedLayer.querySelector(`[data-organ="${organ.id}"]`);
    if (!button) { button = createOrganButton(organ, true); placedLayer.append(button); }
    button.hidden = !position;
    button.querySelector("span").textContent = phase === "v1" && organ.id === "large-intestine" ? "" : organ.name;
    if (!position) return;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.style.width = `${appearance.width}%`;
    button.querySelector('img').style.transform = `rotate(${appearance.angle}deg)`;
    if (appearance.height) {
      button.classList.add(`placed-organ--${organ.id}`);
      button.style.height = `${appearance.height}%`;
    }

  });
}

function render() {
  renderPalette();
  renderPlacedOrgans();
  drawRoute();
  const count = Object.keys(activeModel().positions).length;
  placementCount.textContent = `${count} 个`;
  document.querySelector("#organ-size-controls").hidden = !selectedOrgan || !activeModel().positions[selectedOrgan] || drawMode;
  drawButton.disabled = false;
  taskHint.textContent = phase === "v1" ? "按我们的想法摆放，也可以补画。" : "重新摆放消化和呼吸器官，再画出食物路线。";
  const order = [];
  routeSummary.textContent = order.length ? `我们的路线：${order.join(" → ")}` : "等待画路线";
}

function pointerPosition(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function beginOrganDrag(event) {
  if (drawMode || dragState || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
  event.preventDefault();
  const organId = event.currentTarget.dataset.organ;
  selectedOrgan = organId;
  const organ = organById(organId);
  const appearance = appearanceFor(organ, activeModel());
  const ghost = createOrganButton(organ, true);
  ghost.classList.add('organ-drag-ghost');
  ghost.querySelector('span').remove();
  ghost.querySelector('img').style.transform = `rotate(${appearance.angle}deg)`;
  ghost.style.width = `${stage.clientWidth * appearance.width / 100}px`;
  ghost.style.maxHeight = 'none';
  ghost.style.pointerEvents = 'none';
  if (appearance.height) {
    ghost.classList.add(`placed-organ--${organ.id}`);
    ghost.style.height = `${stage.clientHeight * appearance.height / 100}px`;
  }
  document.body.append(ghost);
  dragState = {
    pointerId: event.pointerId,
    source: event.currentTarget,
    organId,
    from: activeModel().positions[organId] ? clone(activeModel().positions[organId]) : null,
    startedAt: Date.now(),
    ghost,
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.currentTarget.classList.add("is-moving");
  moveOrganDrag(event);
}

function moveOrganDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState.ghost.style.left = `${event.clientX}px`;
  dragState.ghost.style.top = `${event.clientY}px`;
}

function endOrganDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const rect = stage.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  dragState.ghost.remove();
  document.querySelectorAll(".is-moving").forEach((element) => element.classList.remove("is-moving"));
  if (inside) {
    snapshot();
    const point = pointerPosition(event);
    const model = activeModel();
    model.positions[dragState.organId] = point;
    if (!dragState.from && !model.placementOrder.includes(dragState.organId)) model.placementOrder.push(dragState.organId);
    model.modificationCount += 1;
    model.moves.push({ organId: dragState.organId, from: dragState.from, to: point, at: Date.now(), durationMs: Date.now() - dragState.startedAt });
    saveStatus.textContent = "";
    render();
    queueDraftSave();
  }
  dragState = null;
}

function cancelOrganDrag(event) {
  if (!dragState || (event?.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return;
  dragState.ghost.remove();
  dragState.source?.classList.remove('is-moving');
  dragState = null;
  document.querySelectorAll('.organ-drag-ghost').forEach(node=>node.remove());
}

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  frontRouteCanvas.width = canvas.width;
  frontRouteCanvas.height = canvas.height;
  frontRouteContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawRoute();
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

function routeLayers(model) {
  const points = model.routePoints || [];
  const small = model.positions?.['small-intestine'];
  const colon = model.positions?.['large-intestine'];
  const unsplit = {behind:points,front:[]};
  if (!small || !colon || points.length<2) return unsplit;
  const {width,height} = appearanceFor(organById('small-intestine'),model);
  const colonAppearance=appearanceFor(organById('large-intestine'),model);
  const colonRx=Math.max(3,colonAppearance.width/2);
  const colonRy=Math.max(3,(colonAppearance.height||colonAppearance.width/1.5)/2);
  let reachedSmall=false;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,(b.y-a.y)*1.5)/.35));
    for(let j=i===1?0:1;j<=steps;j++){
      const t=j/steps;
      const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
      const onColon=colonWallDistance((point.x-colon.x)/colonRx,(point.y-colon.y)/colonRy)<=1;
      if(onColon){
        if(reachedSmall){
          const front=j===steps?[b,...points.slice(i+1)]:[point,...points.slice(i)];
          return {behind:[...points.slice(0,i),front[0]],front};
        }
      // Touching the edge while approaching the transverse colon is not a visit.
      }else if(Math.hypot((point.x-small.x)/(width/2),(point.y-small.y)/((height||width/1.5)/2))<=.75){
        reachedSmall=true;
      }
    }
  }
  return unsplit;
}

function drawRoute() {
  const rect = stage.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  frontRouteContext.clearRect(0, 0, rect.width, rect.height);
  const {behind,front} = routeLayers(activeModel());
  const paint=(points,color,context)=>{
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x * rect.width / 100, points[0].y * rect.height / 100);
  points.slice(1).forEach((point) => context.lineTo(point.x * rect.width / 100, point.y * rect.height / 100));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.lineWidth = Math.max(5, rect.width * .012);
  context.shadowColor = "rgba(255,255,255,.9)";
  context.shadowBlur = 3;
  context.stroke();
  context.shadowBlur = 0;
  };
  for(const stroke of activeModel().structureStrokes || []) paint(stroke,activeModel().structureColor || "#2878cf",context);
  paint(behind,"#17824d",context);
  paint(front,"#17824d",frontRouteContext);
}

function setDrawMode(enabled) {
  drawMode = enabled;
  document.querySelector(".anatomy-workspace").classList.toggle("drawing-expanded",drawMode);
  stage.classList.toggle("is-drawing", drawMode);
  drawButton.classList.toggle("is-active", drawMode && drawingKind === "route");
  drawButton.setAttribute("aria-pressed",String(drawMode && drawingKind === "route"));
  drawButton.textContent = drawMode && drawingKind === "route" ? "✓ 结束画路线" : "✎ 画食物路线";
  document.querySelector("#structure-button").textContent = drawMode && drawingKind === "structure" ? "✓ 结束补画" : "✎ 补画结构";
  drawTip.hidden = !drawMode;
  drawTip.textContent=drawingKind === "structure" ? "橘黄色：补画器官" : "绿色：食物路线";
  document.querySelector("#structure-button").classList.toggle("is-active",drawMode && drawingKind === "structure");
  document.querySelector("#structure-button").setAttribute("aria-pressed",String(drawMode && drawingKind === "structure"));
  requestAnimationFrame(resizeCanvas);
  if (drawMode) saveStatus.textContent = "";
}

function startRoute(event) {
  if (!drawMode) return;
  event.preventDefault();
  snapshot();
  const model = activeModel();
  if(drawingKind === "structure") {
    model.structureStrokes ||= []; model.structureStrokes.push([pointerPosition(event)]);
  } else {
  if (model.routePoints.length) model.routeAttempts.push({ points: model.routePoints, order: model.routeOrder, at: Date.now() });
  model.routePoints = [pointerPosition(event)];
  model.routeOrder = [];
  model.routeDistances = {};
  }
  model.modificationCount += 1;
  drawing = true;
  canvas.setPointerCapture?.(event.pointerId);
  drawRoute();
}

let routePaint = 0;
function moveRoute(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = pointerPosition(event);
  const points = drawingKind === "structure" ? activeModel().structureStrokes.slice(-1)[0] : activeModel().routePoints;
  const previous = points[points.length - 1];
  if (Math.hypot(point.x - previous.x, point.y - previous.y) >= .45) points.push(point);
  if (!routePaint) routePaint = requestAnimationFrame(() => { routePaint = 0; drawRoute(); });
}

function finishRoute(event) {
  if (!drawing) return;
  event.preventDefault();
  drawing = false;
  if(drawingKind === "route") calculateRouteOrder();
  saveStatus.textContent = "";
  render();
  queueDraftSave();
}

function inferRouteOrder(model) {
  const points = model?.routePoints || [], distances = {};
  if (points.length < 2) return {order:[],distances};
  // Sample actual segments in canvas coordinates, not the centre of a bounding box.
  // A colon surrounds an empty space: that space must never count as colon tissue.
  const samples=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,(b.y-a.y)*1.5)/.35));
    for(let j=0;j<=steps;j++)samples.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps,at:i-1+j/steps});
  }
  const smallPosition=model.positions?.['small-intestine'];
  const smallAppearance=smallPosition?appearanceFor(organById('small-intestine'),model):null;
  const firstSmall=smallPosition?samples.find(p=>Math.hypot((p.x-smallPosition.x)/(smallAppearance.width/2),(p.y-smallPosition.y)/((smallAppearance.height||smallAppearance.width/1.5)/2))<=1)?.at:undefined;
  const lastSmall=firstSmall===undefined?undefined:samples.findLast(p=>Math.hypot((p.x-smallPosition.x)/(smallAppearance.width/2),(p.y-smallPosition.y)/((smallAppearance.height||smallAppearance.width/1.5)/2))<=1)?.at;
  const ranked = organs.filter(o=>model.positions?.[o.id]).map(organ=>{
    const position=model.positions[organ.id],appearance=appearanceFor(organ,model);
    const rx=Math.max(3,appearance.width/2),ry=Math.max(3,(appearance.height||appearance.width/1.5)/2);
    let closest=Infinity,at=Infinity;
    for(const point of samples){
      const x=(point.x-position.x)/rx,y=(point.y-position.y)/ry;
      let distance=Math.hypot(x,y);
      if(organ.id==='large-intestine'){
        distance=colonWallDistance(x,y);
        // A line descending into the small intestine passes UNDER the transverse
        // colon. Do not report this visual crossing as entering the large intestine.
        if(lastSmall!==undefined && point.at<=lastSmall && Math.abs(x)<.52 && y<-.25)continue;
      }
      closest=Math.min(closest,distance);
      if(distance<=1 && at===Infinity)at=point.at;
    }
    distances[organ.id]=Number(closest.toFixed(3));
    return {id:organ.id,at,distance:closest};
  });
  const placed=ranked.filter(item=>item.distance<=1).sort((a,b)=>a.at-b.at);
  const drawn=[];
  // Freehand structures are evidence too; proximity can locate them, not name them.
  for(const stroke of model.structureStrokes||[]){
    const samples=[];
    for(let i=1;i<stroke.length;i++){
      const a=stroke[i-1],b=stroke[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,(b.y-a.y)*1.5)));
      for(let j=0;j<steps;j++)samples.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});
    }
    const near=[];
    for(const p of samples){
      let best=Infinity,at=0;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=(b.y-a.y)*1.5,length=dx*dx+dy*dy;
        const t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*1.5*dy)/length)):0;
        const d=Math.hypot(a.x+t*dx-p.x,(a.y-p.y)*1.5+t*dy);
        if(d<best){best=d;at=i-1+t;}
      }
      if(best<=3.5)near.push(at);
    }
    if(near.length>=3&&near.length>=samples.length*.3){
      near.sort((a,b)=>a-b);
      drawn.push({at:near[Math.floor(near.length/2)],label:'补画的器官 / 通道'});
    }
  }
  const displayOrder=[...placed.map(item=>({at:item.at,label:organById(item.id).name})),...drawn]
    .sort((a,b)=>a.at-b.at).map(item=>item.label).filter((name,i,all)=>i===0||name!==all[i-1]);
  return {order:placed.map(item=>item.id),distances,displayOrder,hasDrawn:!!model.structureStrokes?.length,unmatchedDrawn:!!model.structureStrokes?.length&&!drawn.length};
}

function calculateRouteOrder(model = activeModel()) {
  const result=inferRouteOrder(model);
  model.routeOrder=result.order;
  model.routeDistances=result.distances;
  model.routeOrderVersion=3;
}

function undo() {
  if (!history.length) {
    saveStatus.textContent = "现在还没有可以撤销的操作。";
    return;
  }
  const previous = history.pop();
  if (phase === "v1") v1 = previous;
  else v2 = previous;
  setDrawMode(false);
  saveStatus.textContent = "";
  render();
  queueDraftSave();
}

function clearRoute() {
  if (!activeModel().routePoints.length) return;
  snapshot();
  const model = activeModel();
  model.routeAttempts.push({ points: model.routePoints, order: model.routeOrder, at: Date.now() });
  model.routePoints = [];
  model.routeOrder = [];
  model.routeDistances = {};
  model.modificationCount += 1;
  setDrawMode(false);
  saveStatus.textContent = "";
  render();
  queueDraftSave();
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("foodJourneyClass", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("learningRecords")) request.result.createObjectStore("learningRecords", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocal(record) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("learningRecords", "readwrite");
    transaction.objectStore("learningRecords").put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function saveDraftNow() {
  if (mode !== "student" || discardDraftOnExit) return;
  clearTimeout(draftSaveTimer);
  const record = buildRecord();
  record.updatedAt = Date.now();
  try {
    await saveLocal(record);
  } catch (error) {
    saveStatus.textContent = "本机保存失败，请暂时不要退出。";
    console.error("草稿保存失败", error);
  }
}

function queueDraftSave() {
  if (mode !== "student") return;
  window.dispatchEvent(new CustomEvent('lesson-live-state',{detail:readLiveModel()}));
  clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(saveDraftNow, 150);
}

async function loadLocalRecords() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("learningRecords", "readonly").objectStore("learningRecords").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function updateLocalLessonRecords(shouldDelete) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("learningRecords", "readwrite");
    const request = transaction.objectStore("learningRecords").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.lesson === "food-journey" && shouldDelete(cursor.value)) cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

function withCloudDeadline(work, ms) {
  let timer;
  return Promise.race([work, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("云端连接超时")), ms); })]).finally(() => clearTimeout(timer));
}

async function loadClassResetId() {
  const result = await withCloudDeadline((async () => {
    const database = await initializeCloud();
    const {readOptionalDocument} = await import("./student-data.js?v=20261109-ui3");
    return readOptionalDocument(database.collection(CLOUD_COLLECTION).doc("class-reset"));
  })(), 2500);
  if (result?.code) throw new Error(result.message || "课堂轮次读取失败");
  const resetRecord = Array.isArray(result?.data) ? result.data[0] || {} : result?.data || {};
  return typeof resetRecord.resetId === "string" ? resetRecord.resetId : null;
}

async function initializeCloud() {
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))return (await import('./local-preview-db.js')).previewDb;
  if (cloudDatabase) { await cloudLoginPromise; return cloudDatabase; }
  if (window.loadClassCloud) await window.loadClassCloud();
  if (!window.cloudbase) throw new Error("CloudBase SDK unavailable");
  const app = window.cloudbase.init({ env: CLOUD_ENV, region: "ap-shanghai" });
  cloudDatabase = app.database();
  if (!cloudLoginPromise) {
    cloudLoginPromise = (async () => {
      const auth = app.auth();
      const state = await auth.getLoginState();
      if (!state) await auth.signInAnonymously();
    })().catch((error) => {
      cloudDatabase = null;
      cloudLoginPromise = null;
      throw error;
    });
  }
  await cloudLoginPromise;
  return cloudDatabase;
}

async function syncRecord(record) {
  try {
    const data = await import("./student-data.js?v=20261109-ui3");
    if (!await data.submitRecord(record, { saveLocal: false })) throw data.lastSubmissionError || new Error("云端未确认保存");
    record.pendingSync = false;
    pendingSubmissionSync = false;
    await saveLocal(record);
    document.querySelector("#connection-status").textContent = "已上传教师端";
    return true;
  } catch (error) {
    pendingSubmissionSync = true;
    console.error("同步失败，记录已保存在本机", error);
    const status = document.querySelector("#connection-status");
    status.textContent = "本机已保存，上传失败：" + (error?.code || error.message);
    status.title = error.message;
    return false;
  }
}

function buildRecord() {
  if(v1)calculateRouteOrder(v1);
  if(v2)calculateRouteOrder(v2);
  return {
    ...lessonExtras,
    id: sessionId,
    groupId,
    lesson: "food-journey",
    resetId: activeResetId,
    createdAt: v1.startedAt,
    updatedAt: Date.now(),
    pendingSync: pendingSubmissionSync,
    v1,
    v2,
  };
}

function showSavedTransition(record) {
  studentView.hidden = true;
  transitionPanel.hidden = false;
  if (!record.v2?.completedAt) {
    transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V1 已提交</p><h1>初始想法已提交</h1>${record.pendingSync ? '<p>已保存在本机，暂未传给老师。</p>' : ''}<div class="saved-model-preview">${miniModel(record.v1, "已保存模型")}</div><div class="transition-actions"><button id="start-v2-button" class="submit-model-button" type="button">去观察</button></div>`;
    document.querySelector("#start-v2-button").addEventListener("click", () => {
      location.href = `observation.html?group=${groupId}`;
    });
    addSyncRetry(record);
    return;
  }
  const changed = compareModels(record.v1, record.v2);
  transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V2 已提交</p><h1>模型修正已提交</h1><p>对比观察前后的摆放与食物路线。${record.pendingSync ? "暂未传给老师。" : ""}</p><div class="saved-model-preview student-model-compare">${miniModel(record.v1, "观察前模型")}${miniModel(record.v2, "观察后模型")}</div><div class="transition-actions"><a class="submit-model-button" href="assembly.html?group=${groupId}">去拼装 →</a></div>`;
  addSyncRetry(record);
}

function addSyncRetry(record){
  if(!record.pendingSync)return;
  transitionPanel.querySelector('h1').textContent='模型已保存在本机';
  const retry=document.createElement('button');retry.className='submit-model-button';retry.textContent='重新提交给老师';
  retry.onclick=async()=>{if(modelSubmitting)return;modelSubmitting=true;retry.disabled=true;try{await syncRecord(record);showSavedTransition(record);}finally{modelSubmitting=false;}};
  transitionPanel.querySelector('.transition-actions').prepend(retry);
}

function applyRevisionView() {
  phase = "v2";
  if(v2 && !v2.completedAt && v2.revisionVersion!==2){v2=createModel();v2.revisionVersion=2;}
  document.body.classList.add('revision-model');
  if(!document.querySelector('#airway-reference-button')){
    const button=document.createElement('button');button.id='airway-reference-button';button.type='button';button.textContent='看前后关系';
    const dialog=document.createElement('dialog');dialog.id='airway-reference';dialog.innerHTML='<button type="button">关闭</button><p>侧面剖视：气管在前，食管在后。</p><img src="assets/organs/upper-airway-openstax.jpg" alt="OpenStax上呼吸道侧面剖面，包含鼻腔、口腔、咽、气管与食管"><small>OpenStax College · CC BY 3.0 · 原始教材插图</small>';
    dialog.querySelector('button').onclick=()=>dialog.close();document.body.append(dialog);button.onclick=()=>dialog.showModal();document.querySelector('.organ-shelf').prepend(button);
  }
  document.querySelector('#model-prompt').setAttribute('title','气管位于食管前方；重叠时气管显示在前。');
  document.querySelector('#structure-button').hidden=true;
  drawingKind='route';setDrawMode(false);
  document.querySelector("#phase-label").textContent = "V2 · 证据修正";
  document.querySelector("#model-title").textContent = "我们修正";
  document.querySelector("#model-prompt").textContent = "重新摆放消化和呼吸器官，再画出食物路线。";
  document.querySelector("#phase-v1").classList.remove("active");
  document.querySelector("#phase-v1").classList.add("done");
  document.querySelector("#phase-v2").classList.add("active");
  submitButton.textContent = "确认提交 V2 修正";
}

async function submitModel() {
  if(modelSubmitting)return;
  if (!Object.keys(activeModel().positions).length && !activeModel().structureStrokes?.length) {
    saveStatus.textContent = "先摆放或补画我们的想法。";
    return;
  }
  if (activeModel().routePoints.length < 8) {
    saveStatus.textContent = "在人体上画出食物的路线。";
    return;
  }
  modelSubmitting=true;submitButton.disabled=true;
  try{
  activeModel().visualStyle ||= Object.fromEntries(organs.map(o=>[o.id,appearanceFor(o,activeModel())]));
  activeModel().completedAt = Date.now();
  pendingSubmissionSync = true;
  const record = buildRecord();
  await saveLocal(record);
  document.querySelector("#connection-status").textContent = "本机已保存";
  await syncRecord(record);
  showSavedTransition(record);
  }catch{saveStatus.textContent='暂时未能保存，请再提交一次。';}
  finally{modelSubmitting=false;submitButton.disabled=false;}
}

function startRevision() {
  if (!v2) {
    v2 = createModel();
    v2.revisionVersion=2;
  }
  applyRevisionView();
  history = [];
  transitionPanel.hidden = true;
  studentView.hidden = false;
  saveStatus.textContent = "";
  render();
  queueDraftSave();
}

function compareModels(first, second) {
  if (!first || !second) return { organs: [], routeChanged: false };
  const changedOrgans = organs.filter((organ) => {
    const a = first.positions[organ.id];
    const b = second.positions[organ.id];
    return Boolean(a) !== Boolean(b) || (a && b && (Math.hypot(a.x-b.x,a.y-b.y)>2.5 || JSON.stringify(appearanceFor(organ,first)) !== JSON.stringify(appearanceFor(organ,second))));
  }).map((organ) => organ.name);
  return { organs: changedOrgans, routeChanged: JSON.stringify(first.routePoints || []) !== JSON.stringify(second.routePoints || []) };
}

function formatDuration(model) {
  if (!model?.completedAt) return "未完成";
  const seconds = Math.max(1, Math.round((model.completedAt - model.startedAt) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : `${seconds}秒`;
}

function miniModel(model, label, options = {}) {
  if (!model) return `<div class="mini-empty"><strong>${label}</strong><span>尚未提交</span></div>`;
  const {behind,front}=routeLayers(model);
  const polyline=behind.map(point=>`${point.x},${point.y*1.5}`).join(" ");
  const frontLine=front.map(point=>`${point.x},${point.y*1.5}`).join(" ");
  const pieces = organs.map((organ) => {
    const position = model.positions?.[organ.id];
    if (!position) return "";
    const appearance = appearanceFor(organ,model);
    return `<img class="organ-${organ.id}" src="${organ.image}" alt="${organ.name}" title="${organ.name}" style="left:${position.x}%;top:${position.y}%;width:${appearance.width}%;${appearance.height ? `height:${appearance.height}%;` : ""}transform:translate(-50%,-50%) rotate(${appearance.angle}deg)">`;
  }).join("");
  const interactive = Number.isInteger(options.groupId);
  const attributes = interactive ? ` data-group-id="${options.groupId}" data-model-phase="${options.phase}" role="button" tabindex="0" aria-label="放大第 ${options.groupId} 组${label}"` : "";
  return `<div class="${label === "观察前想法" && !model._paired ? "mini-model-single" : "mini-model-item"}${interactive ? " mini-model-clickable" : ""}"${attributes}><strong class="mini-label">${label}</strong><div class="mini-model"><img class="mini-body" src="assets/anatomy/body-outline-generated.webp?v=20261022-7" alt=""><svg viewBox="0 0 100 150" preserveAspectRatio="none">${(model.structureStrokes || []).map(stroke => `<polyline points="${stroke.map(p=>`${p.x},${p.y*1.5}`).join(" ")}" style="stroke:${model.structureColor || '#2878cf'}"/>`).join("")}<polyline points="${polyline}" style="stroke:#17824d"/></svg>${pieces}${front.length>1?`<svg class="front-route-svg" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><polyline points="${frontLine}" style="stroke:#17824d"/></svg>`:""}</div></div>`;
}

window.renderLiveModel=(model)=>miniModel(model,'当前作品');
function latestRecord(records, id) {
  return records.filter((record) => Number(record.groupId) === id).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0] || null;
}

function renderDashboard(records) {
  dashboardRecords = records.filter((record) => record.lesson === "food-journey" && (record.v1?.completedAt || record.v2?.completedAt || record.observation?.completedAt || record.assembly?.completedAt || record.journey?.completedAt || record.evaluation?.completedAt));
  const latestRecords = Array.from({ length: 12 }, (_, index) => latestRecord(dashboardRecords, index + 1));
  const evaluated = latestRecords.filter(record => record?.evaluation?.completedAt).length;
  const completedV1 = latestRecords.filter((record) => record?.v1?.completedAt).length;
  const completedV2 = latestRecords.filter((record) => record?.v2?.completedAt).length;
  const observed = latestRecords.filter((record) => record?.observation?.completedAt).length;
  const assembled = latestRecords.filter((record) => record?.assembly?.completedAt).length;
  const journeyed = latestRecords.filter((record) => record?.journey?.completedAt).length;
  document.querySelector("#teacher-summary").innerHTML = `<div><strong>${completedV1}</strong><span>组提交初始模型</span></div><div><strong>${observed}</strong><span>组完成观察</span></div><div><strong>${completedV2}</strong><span>组提交修正模型</span></div><div><strong>${assembled}</strong><span>组完成拼装</span></div><div><strong>${journeyed}</strong><span>组完成旅程</span></div><div><strong>${evaluated}</strong><span>组完成自评</span></div>`;
  const pageSize = 6;
  const pageCount = Math.ceil(12 / pageSize);
  dashboardPage = Math.min(dashboardPage, pageCount - 1);
  const firstGroup = dashboardPage * pageSize + 1;
  const groups = Array.from({ length: pageSize }, (_, index) => firstGroup + index);
  document.querySelector("#dashboard-page-label").textContent = `第 ${firstGroup}–${firstGroup + pageSize - 1} 组 · 共 12 组`;
  document.querySelector("#dashboard-prev").disabled = dashboardPage === 0;
  document.querySelector("#dashboard-next").disabled = dashboardPage === pageCount - 1;
  document.querySelector("#group-dashboard").innerHTML = groups.map((id) => {
    const record = latestRecord(dashboardRecords, id);
    const revisionView = teacherModelPhase === 'v2';
    if (!record) return `<article class="group-model-card is-empty"><header><h2>第 ${id} 组</h2><span>等待提交</span></header></article>`;
    const difference = compareModels(record.v1, record.v2);
    const status = revisionView ? (record.v2?.completedAt ? "已提交修正模型" : "等待修正模型") : (record.v1?.completedAt ? "已提交初始模型" : "等待初始模型");
    const before = record.v1?.completedAt ? miniModel({ ...record.v1, _paired: revisionView && Boolean(record.v2?.completedAt) }, "观察前想法", { groupId: id, phase: "v1" }) : "";
    const after = revisionView && record.v2?.completedAt ? miniModel(record.v2, "观察后修正", { groupId: id, phase: "v2" }) : "";
    const analysis = !revisionView ? "" : record.v2?.completedAt
      ? `${difference.organs.length ? `位置有变化：${difference.organs.join("、")}` : "器官位置未见明显变化"}；${difference.routeChanged ? "食物路线有变化" : "食物路线保持原样"}`
      : record.v1?.completedAt ? "等待小组完成观察后修正" : "";
    return `<article class="group-model-card"><header><h2>第 ${id} 组</h2><span>${status}</span></header>${before || after ? `<div class="mini-compare ${after ? "has-revision" : "single-model"}">${before}${after}</div>` : ""}${analysis ? `<p class="group-model-analysis">${analysis}</p>` : ""}</article>`;
  }).join("");
}

async function loadCloudRecords() {
  const database = await initializeCloud();
  const result = await database.collection(CLOUD_COLLECTION).get();
  if (result?.code) throw new Error(result.message || "无法读取云端记录");
  const documents = Array.isArray(result?.data) ? result.data : [];
  return documents.flatMap((document) => Array.isArray(document.records)
    ? document.records.filter((record) => Number(record.groupId) === Number(document.id))
    : []);
}

async function refreshDashboard() {
  const button = document.querySelector("#refresh-dashboard");
  if(button.disabled)return;
  button.disabled = true;
  button.textContent = "正在刷新…";
  const localRecords = await loadLocalRecords().catch(() => []);
  let cloudRecords = [];
  try {
    activeResetId = await loadClassResetId();
    if (activeResetId) await updateLocalLessonRecords((record) => record.resetId !== activeResetId);
    cloudRecords = await loadCloudRecords();
    document.querySelector("#connection-status").textContent = "教师端已连接";
  } catch (error) {
    console.error("教师端云端读取失败", error);
    document.querySelector("#connection-status").textContent = "连接失败：" + (error?.code ? error.code + " · " : "") + error.message;
  }
  const visibleRecords = cloudRecords.filter(record => (record.resetId || null) === (activeResetId || null));
  renderDashboard(visibleRecords);
  window.dispatchEvent(new CustomEvent("lesson-records", {detail:{records:cloudRecords.filter(r=>(r.resetId||null)===(activeResetId||null)),resetId:activeResetId}}));
  button.disabled = false;
  button.textContent = "刷新数据";
  if(mode==='teacher')void watchTeacherRecords();
}

let teacherWatcher=null,teacherWatchStarting=false;
function stopTeacherWatch(){
  const watcher=teacherWatcher;teacherWatcher=null;
  if(watcher)Promise.resolve(watcher.close()).catch(()=>{});
}
async function watchTeacherRecords(){
  if(teacherWatcher||teacherWatchStarting||document.hidden)return;
  teacherWatchStarting=true;
  try{
    const database=await initializeCloud(),collection=database.collection(CLOUD_COLLECTION);
    if(document.hidden||typeof collection.watch!=='function')return;
    teacherWatcher=collection.where({_id:database.command.in([...Array.from({length:12},(_,i)=>`group-${i+1}`),'class-reset','class-feedback'])}).watch({
      onChange(snapshot){
        if(document.hidden||!Array.isArray(snapshot.docs))return;
        const docs=snapshot.docs,reset=docs.find(d=>d._id==='class-reset'||d.id==='class-reset');
        if((reset?.resetId||null)!==(activeResetId||null)){void refreshDashboard();return;}
        const records=docs.flatMap(d=>Array.isArray(d.records)?d.records.filter(r=>Number(r.groupId)===Number(d.id)):[])
          .filter(r=>(r.resetId||null)===(activeResetId||null));
        renderDashboard(records);
        const feedback=docs.find(d=>d._id==='class-feedback'||(d.groups&&d.resetId!==undefined));
        window.dispatchEvent(new CustomEvent('lesson-records',{detail:{records,resetId:activeResetId,feedback}}));
        document.querySelector('#connection-status').textContent='教师端实时接收中';
      },
      onError(){stopTeacherWatch();document.querySelector('#connection-status').textContent='实时接收中断，可点刷新重连';}
    });
  }catch{stopTeacherWatch();}finally{teacherWatchStarting=false;}
}
document.addEventListener('visibilitychange',()=>{
  if(mode!=='teacher')return;
  if(document.hidden)stopTeacherWatch();else void refreshDashboard();
});
window.addEventListener('online',()=>{if(mode==='teacher')void refreshDashboard();});
window.addEventListener('pagehide',stopTeacherWatch);

async function clearAllClassData() {
  const button = document.querySelector("#clear-data-button");
  const status = document.querySelector("#clear-data-status");
  const resetId = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let localCleared = false;
  status.hidden = false;
  button.disabled = true;
  button.textContent = "正在清除…";
  status.textContent = "正在清除当前浏览器记录…";
  try {
    await updateLocalLessonRecords(() => true);
    localCleared = true;
  } catch (error) {
    console.error("清除本机课堂记录失败", error);
  }
  discardDraftOnExit = true;
  clearTimeout(draftSaveTimer);
  try {
    localStorage.setItem(LOCAL_CLEAR_SIGNAL_KEY, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  } catch {}
  renderDashboard([]);
  status.textContent = "本机记录已清除，正在开启新一轮…";
  try {
    const database = await initializeCloud();
    const result = await database.collection(CLOUD_COLLECTION).doc("class-reset").set({ id: "class-reset", resetId, updatedAt: Date.now() });
    if (result?.code || !(result?.updated > 0 || result?.upsertedId || result?.id)) throw new Error("云端未确认清空");
    localStorage.setItem('lesson-known-round', JSON.stringify(resetId));
    for(let id=1;id<=12;id++)localStorage.removeItem('food-journey-game-v3-group-'+id);
    activeResetId = resetId;
    renderDashboard([]);
    await refreshDashboard();
    status.textContent = "新一轮已开启，旧记录已从教师端隐藏。";
    window.alert(`本机记录${localCleared ? "已" : "未能完全"}清除，新一轮已开启。学生设备联网后会清除本机旧记录；云端旧文档仍保留，但不会显示在本轮教师看板中。`);
  } catch (error) {
    console.error("清除课堂记录失败", error);
    status.textContent = localCleared ? "本机记录已清除；云端清除未完成。" : "本机和云端清除均未完成。";
    window.alert(localCleared
      ? "本机浏览器记录已清除；云端连接失败，因此平板等其他设备的数据尚未清除。联网后请再点一次清除。"
      : "本机记录未能清除，云端连接也失败。请检查网络后重试。");
  } finally {
    button.disabled = false;
    button.textContent = "清除全部记录";
  }
}

async function checkClassReset() {
  if (mode !== "student" || resetCheckInProgress) return;
  resetCheckInProgress = true;
  try {
    const latestResetId = await loadClassResetId();
    if (latestResetId && latestResetId !== activeResetId) {
      discardDraftOnExit = true;
      clearTimeout(draftSaveTimer);
      location.reload();
    }
  } catch (error) {
    console.warn("暂时无法检查课堂重置状态", error);
  } finally {
    resetCheckInProgress = false;
  }
}

window.addEventListener("storage", (event) => {
  if (mode !== "student" || event.key !== LOCAL_CLEAR_SIGNAL_KEY || !event.newValue) return;
  discardDraftOnExit = true;
  clearTimeout(draftSaveTimer);
  void updateLocalLessonRecords(() => true).finally(() => location.reload());
});

async function exportRecords() {
  const records = await loadLocalRecords();
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `food-journey-records-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function openModelPreview(groupId, phaseName) {
  const record = latestRecord(dashboardRecords, groupId);
  const model = phaseName === "v2" ? record?.v2 : record?.v1;
  if (!model) return;
  const label = phaseName === "v2" ? "观察后修正" : "观察前想法";
  const inferred=inferRouteOrder(model);
  const routeNames=inferred.displayOrder||[];
  const route = routeNames.length ? routeNames.join(" → ") : model.routePoints?.length >= 2 ? "已有笔迹，未识别到经过的器官，请对照上图查看" : "本次提交没有路线笔迹";
  const revision = phaseName === "v2" ? compareModels(record.v1, model) : null;
  const metrics = `<dl class="model-preview-metrics"><div><dt>摆放调整</dt><dd>${model.modificationCount || 0} 次</dd></div><div><dt>建模用时</dt><dd>${formatDuration(model)}</dd></div><div><dt>所画路线（依据图形估计）</dt><dd>${route}${inferred.hasDrawn?'<small class="route-inference-note">'+(inferred.unmatchedDrawn?'另有补画部分，暂无法可靠排入顺序，请结合原图查看。':'已纳入路线附近的补画部分；具体名称请结合小组说明确认。')+'</small>':''}</dd></div>${revision ? `<div><dt>修正器官</dt><dd>${revision.organs.join("、") || "未调整位置"}</dd></div><div><dt>路线变化</dt><dd>${revision.routeChanged ? "有变化" : "保持原样"}</dd></div>` : ""}</dl>`;
  document.querySelector("#preview-model-title").textContent = `第 ${groupId} 组 · ${label}`;
  document.querySelector("#preview-model-content").innerHTML = `<div class="preview-model-image">${miniModel(model, label)}</div>${metrics}`;
  document.querySelector("#model-preview-dialog").showModal();
}

async function initialize() {
  document.querySelector("#group-badge").textContent = mode === "teacher" ? "教师端" : `第 ${groupId} 组`;
  document.querySelector(".model-back").href = `index.html?group=${groupId}`;
  if (mode === "teacher") {
    document.body.classList.add("teacher-mode");
    studentView.hidden = true;
    teacherView.hidden = false;
    refreshDashboard();
    return;
  }
  setInterval(checkClassReset, 180000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkClassReset();
  });
  render(); // Local interaction and images must not wait for a remote service.
  stage.style.pointerEvents = 'none';
  studentView.style.pointerEvents = 'none';
  submitButton.disabled = true;
  resizeCanvas();
  const savedRecords = await loadLocalRecords().catch(() => []);
  try {
    activeResetId = await loadClassResetId();
    if (activeResetId) await updateLocalLessonRecords((record) => record.resetId !== activeResetId);
  } catch (error) {
    activeResetId = null;
    console.warn("暂时无法读取课堂重置状态", error);
  }
  const currentRecords = activeResetId
    ? (await loadLocalRecords().catch(() => [])).filter((record) => record.resetId === activeResetId)
    : savedRecords;
  const savedRecord = currentRecords
    .filter((record) => Number(record.groupId) === groupId)
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0];
  if (savedRecord) {
    lessonExtras = { observation: savedRecord.observation || null, assembly: savedRecord.assembly || null, journey: savedRecord.journey || null, evaluation: savedRecord.evaluation || null };
    sessionId = savedRecord.id;
    v1 = savedRecord.v1 ? clone(savedRecord.v1) : createModel();
    if(!v1.completedAt)v1.structureColor="#f4a329";
    v2 = savedRecord.v2 ? clone(savedRecord.v2) : null;
    if (v2 && !(params.get('controlled')==='1' && params.get('phase')==='v1')) applyRevisionView();
    pendingSubmissionSync = Boolean(savedRecord.pendingSync && (savedRecord.v1?.completedAt || savedRecord.v2?.completedAt));
    if (pendingSubmissionSync) void syncRecord(savedRecord);
    else if (savedRecord.pendingSync) {
      savedRecord.pendingSync = false;
      await saveLocal(savedRecord);
    }
  }
  if (v2?.completedAt) {
    studentView.hidden = true;
    transitionPanel.hidden = false;
    showSavedTransition(savedRecord);
    return;
  }
  if (v1.completedAt && !v2) {
    if (params.get('phase') === 'v2' && lessonExtras.observation?.completedAt) {
      startRevision();
      resizeCanvas();
      new ResizeObserver(resizeCanvas).observe(stage);
      return;
    }
    showSavedTransition(savedRecord);
    return;
  }
  render();
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(stage);
}

document.addEventListener("pointermove", moveOrganDrag);
document.addEventListener("pointerup", endOrganDrag);
document.addEventListener("pointercancel", cancelOrganDrag);
document.addEventListener("lostpointercapture", cancelOrganDrag);
window.addEventListener("blur",()=>cancelOrganDrag());
window.addEventListener("pagehide", () => { if (!discardDraftOnExit) void saveDraftNow(); });
canvas.addEventListener("pointerdown", startRoute);
canvas.addEventListener("pointermove", moveRoute);
canvas.addEventListener("pointerup", finishRoute);
canvas.addEventListener("pointercancel", finishRoute);
drawButton.addEventListener("click", () => { const was=drawMode && drawingKind==="route"; drawingKind="route"; setDrawMode(!was); });
document.querySelector('#structure-button').addEventListener('click',()=>{const was=drawMode && drawingKind==="structure";drawingKind="structure";setDrawMode(!was);});
for(const [id,factor] of [['organ-smaller',.9],['organ-larger',1.1]]) document.querySelector('#'+id).addEventListener('click',()=>{
 if(!selectedOrgan) return; snapshot(); const model=activeModel(), organ=organById(selectedOrgan), from=clone(appearanceFor(organ,model));
 const ratio=Math.max(.6,Math.min(1.6,from.width/organ.width*factor)), to={...from,width:organ.width*ratio}; if(organ.height)to.height=organ.height*ratio;
 model.visualStyle ||= {};model.visualStyle[selectedOrgan]=to;model.sizeChanges ||= [];model.sizeChanges.push({organId:selectedOrgan,from,to:clone(to),at:Date.now()});model.modificationCount++;render();queueDraftSave();
});
document.querySelector("#undo-button").addEventListener("click", undo);
document.querySelector("#clear-route-button").addEventListener("click", clearRoute);
submitButton.addEventListener("click", submitModel);
document.querySelector("#refresh-dashboard").addEventListener("click", refreshDashboard);
document.querySelector("#export-button").addEventListener("click", exportRecords);
document.querySelector("#clear-data-button").addEventListener("click", clearAllClassData);
document.querySelector("#dashboard-prev").addEventListener("click", () => {
  dashboardPage = Math.max(0, dashboardPage - 1);
  renderDashboard(dashboardRecords);
});
document.querySelector("#dashboard-next").addEventListener("click", () => {
  dashboardPage = Math.min(1, dashboardPage + 1);
  renderDashboard(dashboardRecords);
});
document.querySelector("#group-dashboard").addEventListener("click", (event) => {
  const photo = event.target.closest(".assembly-thumb");
  if (photo) {
    const group = Number(photo.dataset.photoGroupId);
    const source = latestRecord(dashboardRecords, group)?.assembly?.photoPreview;
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(source || "")) {
      document.querySelector("#preview-model-title").textContent = `第 ${group} 组 · 拼装作品`;
      document.querySelector("#preview-model-content").innerHTML = `<img class="assembly-photo-large" src="${source}" alt="第 ${group} 组拼装作品">`;
      document.querySelector("#model-preview-dialog").showModal();
    }
    return;
  }
  const model = event.target.closest(".mini-model-clickable");
  if (model) openModelPreview(Number(model.dataset.groupId), model.dataset.modelPhase);
});
document.querySelector("#group-dashboard").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".mini-model-clickable")) {
    event.preventDefault();
    openModelPreview(Number(event.target.dataset.groupId), event.target.dataset.modelPhase);
  }
});
document.querySelector("#preview-dialog-close").addEventListener("click", () => document.querySelector("#model-preview-dialog").close());
document.querySelector("#teacher-fullscreen-button").addEventListener("click", () => window.requestLessonFullscreen?.());
document.querySelector("#model-fullscreen-button").addEventListener("click", () => window.requestLessonFullscreen?.());
initialize().finally(() => { studentView.style.pointerEvents = ''; stage.style.pointerEvents = ''; submitButton.disabled = false; });

window.prepareClassNavigation = async () => { if(modelSubmitting)return false; if (mode === 'student' && !discardDraftOnExit) { clearTimeout(draftSaveTimer); await saveLocal(buildRecord()); } };
