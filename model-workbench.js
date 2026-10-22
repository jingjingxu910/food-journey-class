const organs = [
  { id: "mouth", name: "口腔", image: "assets/organs/mouth-gentle.svg", width: 12 },
  { id: "esophagus", name: "食道", image: "assets/organs/esophagus.png", width: 15 },
  { id: "stomach", name: "胃", image: "assets/organs/stomach.png", width: 18 },
  { id: "small-intestine", name: "小肠", image: "assets/organs/small-intestine.png", width: 23 },
  { id: "large-intestine", name: "大肠", image: "assets/organs/large-intestine.png", width: 26 },
];

const CLOUD_ENV = "fishing-classroom-d5dzcz19db484d";
const CLOUD_COLLECTION = "food-journey-groups";
const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "teacher" ? "teacher" : "student";
const parsedGroup = Number(params.get("group"));
const groupId = Number.isInteger(parsedGroup) && parsedGroup >= 1 && parsedGroup <= 12 ? parsedGroup : 1;
let sessionId = `group-${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const studentView = document.querySelector("#student-view");
const teacherView = document.querySelector("#teacher-view");
const transitionPanel = document.querySelector("#transition-panel");
const stage = document.querySelector("#body-stage");
const placedLayer = document.querySelector("#placed-organs");
const palette = document.querySelector("#organ-palette");
const canvas = document.querySelector("#route-canvas");
const context = canvas.getContext("2d");
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
let drawing = false;
let history = [];
let cloudDatabase = null;
let cloudLoginPromise = null;
let draftSaveTimer = null;

function createModel() {
  return {
    startedAt: Date.now(),
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
  button.setAttribute("aria-label", organ.name);
  button.innerHTML = `<img src="${organ.image}" alt="" draggable="false"><span>${organ.name}</span>`;
  button.addEventListener("pointerdown", beginOrganDrag);
  return button;
}

function renderPalette() {
  palette.replaceChildren();
  organs.filter((organ) => !activeModel().positions[organ.id]).forEach((organ) => palette.append(createOrganButton(organ)));
}

function renderPlacedOrgans() {
  placedLayer.replaceChildren();
  organs.forEach((organ) => {
    const position = activeModel().positions[organ.id];
    if (!position) return;
    const button = createOrganButton(organ, true);
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.style.width = `${organ.width}%`;
    placedLayer.append(button);
  });
}

function render() {
  renderPalette();
  renderPlacedOrgans();
  drawRoute();
  const count = Object.keys(activeModel().positions).length;
  placementCount.textContent = `${count} / ${organs.length}`;
  drawButton.disabled = count !== organs.length;
  taskHint.textContent = count === organs.length ? "位置还可以调整，再画出路线。" : "把 5 个器官放在你认为合适的位置。";
  const order = activeModel().routeOrder.map((id) => organById(id).name);
  routeSummary.textContent = order.length ? `你的路线：${order.join(" → ")}` : "等待画路线";
}

function pointerPosition(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function beginOrganDrag(event) {
  if (drawMode) return;
  event.preventDefault();
  const organId = event.currentTarget.dataset.organ;
  const organ = organById(organId);
  const ghost = document.createElement("img");
  ghost.className = "organ-drag-ghost";
  ghost.src = organ.image;
  ghost.style.width = `${Math.max(54, stage.clientWidth * organ.width / 100)}px`;
  document.body.append(ghost);
  dragState = {
    organId,
    from: activeModel().positions[organId] ? clone(activeModel().positions[organId]) : null,
    startedAt: Date.now(),
    ghost,
  };
  event.currentTarget.classList.add("is-moving");
  moveOrganDrag(event);
}

function moveOrganDrag(event) {
  if (!dragState) return;
  dragState.ghost.style.left = `${event.clientX}px`;
  dragState.ghost.style.top = `${event.clientY}px`;
}

function endOrganDrag(event) {
  if (!dragState) return;
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

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawRoute();
}

function drawRoute() {
  const rect = stage.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  const points = activeModel().routePoints;
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x * rect.width / 100, points[0].y * rect.height / 100);
  points.slice(1).forEach((point) => context.lineTo(point.x * rect.width / 100, point.y * rect.height / 100));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(24, 129, 117, .92)";
  context.lineWidth = Math.max(5, rect.width * .012);
  context.shadowColor = "rgba(255,255,255,.9)";
  context.shadowBlur = 3;
  context.stroke();
  context.shadowBlur = 0;
}

function setDrawMode(enabled) {
  drawMode = enabled && allOrgansPlaced();
  stage.classList.toggle("is-drawing", drawMode);
  drawButton.classList.toggle("is-active", drawMode);
  drawButton.textContent = drawMode ? "完成画线" : "✎ 画食物路线";
  drawTip.hidden = !drawMode;
  if (drawMode) saveStatus.textContent = "";
}

function startRoute(event) {
  if (!drawMode) return;
  event.preventDefault();
  snapshot();
  const model = activeModel();
  if (model.routePoints.length) model.routeAttempts.push({ points: model.routePoints, order: model.routeOrder, at: Date.now() });
  model.routePoints = [pointerPosition(event)];
  model.routeOrder = [];
  model.routeDistances = {};
  model.modificationCount += 1;
  drawing = true;
  canvas.setPointerCapture?.(event.pointerId);
  drawRoute();
}

function moveRoute(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = pointerPosition(event);
  const points = activeModel().routePoints;
  const previous = points[points.length - 1];
  if (Math.hypot(point.x - previous.x, point.y - previous.y) >= .45) points.push(point);
  drawRoute();
}

function finishRoute(event) {
  if (!drawing) return;
  event.preventDefault();
  drawing = false;
  calculateRouteOrder();
  setDrawMode(false);
  saveStatus.textContent = "";
  render();
  queueDraftSave();
}

function calculateRouteOrder() {
  const model = activeModel();
  const ranked = organs.map((organ) => {
    const position = model.positions[organ.id];
    let closestIndex = 0;
    let closestDistance = Infinity;
    model.routePoints.forEach((point, index) => {
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    model.routeDistances[organ.id] = Number(closestDistance.toFixed(2));
    return { id: organ.id, index: closestIndex };
  });
  model.routeOrder = ranked.sort((a, b) => a.index - b.index).map((item) => item.id);
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
  if (mode !== "student") return;
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

async function initializeCloud() {
  if (cloudDatabase) return cloudDatabase;
  if (!window.cloudbase) throw new Error("CloudBase SDK unavailable");
  const app = window.cloudbase.init({ env: CLOUD_ENV, region: "ap-shanghai" });
  cloudDatabase = app.database();
  if (!cloudLoginPromise) {
    cloudLoginPromise = (async () => {
      const auth = app.auth();
      const state = await auth.getLoginState();
      if (!state) await auth.signInAnonymously();
    })();
  }
  await cloudLoginPromise;
  return cloudDatabase;
}

async function syncRecord(record) {
  try {
    const database = await initializeCloud();
    const reference = database.collection(CLOUD_COLLECTION).doc(`group-${groupId}`);
    let current = {};
    try {
      const result = await reference.get();
      current = Array.isArray(result?.data) ? result.data[0] || {} : result?.data || {};
    } catch {}
    const records = Array.isArray(current.records) ? current.records.filter((item) => item.id !== record.id) : [];
    records.push(record);
    const payload = { id: groupId, records: records.slice(-20), updatedAt: Date.now() };
    try {
      await reference.update(payload);
    } catch {
      await reference.set(payload);
    }
    record.pendingSync = false;
    await saveLocal(record);
    document.querySelector("#connection-status").textContent = "已上传教师端";
    return true;
  } catch (error) {
    console.error("同步失败，记录已保存在本机", error);
    document.querySelector("#connection-status").textContent = "本机已保存";
    return false;
  }
}

function buildRecord() {
  return {
    id: sessionId,
    groupId,
    lesson: "food-journey",
    createdAt: v1.startedAt,
    updatedAt: Date.now(),
    pendingSync: true,
    v1,
    v2,
  };
}

function showSavedTransition(record) {
  studentView.hidden = true;
  transitionPanel.hidden = false;
  if (!record.v2?.completedAt) {
    transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V1 已保存</p><h1>初始想法已保留</h1><p>完成观察后，再回来看一看。</p><div class="saved-model-preview">${miniModel(record.v1, "已保存模型")}</div><div class="transition-actions"><button id="start-v2-button" class="submit-model-button" type="button">观察完成，开始修正</button></div>`;
    document.querySelector("#start-v2-button").addEventListener("click", startRevision);
    return;
  }
  const changed = compareModels(record.v1, record.v2);
  transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V2 已保存</p><h1>模型修正完成</h1><p>你们调整了 <strong>${changed.organs.length}</strong> 个器官，并${changed.routeChanged ? "重新思考了" : "保留了"}食物路线。前后两版已保存。</p>`;
}

function applyRevisionView() {
  phase = "v2";
  document.querySelector("#phase-label").textContent = "V2 · 证据修正";
  document.querySelector("#model-title").textContent = "用观察证据修正模型";
  document.querySelector("#model-prompt").textContent = "看看初始模型，想一想要不要调整。";
  document.querySelector("#phase-v1").classList.remove("active");
  document.querySelector("#phase-v1").classList.add("done");
  document.querySelector("#phase-v2").classList.add("active");
  submitButton.textContent = "保存 V2 修正模型";
}

async function submitModel() {
  if (!allOrgansPlaced()) {
    saveStatus.textContent = "先放好 5 个器官。";
    return;
  }
  if (activeModel().routePoints.length < 8) {
    saveStatus.textContent = "在人体上画出食物的路线。";
    return;
  }
  activeModel().completedAt = Date.now();
  const record = buildRecord();
  await saveLocal(record);
  document.querySelector("#connection-status").textContent = "本机已保存";
  syncRecord(record);
  studentView.hidden = true;
  transitionPanel.hidden = false;
  if (phase === "v1") {
    showSavedTransition(record);
  } else {
    const changed = compareModels(v1, v2);
    transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V2 已保存</p><h1>模型修正完成</h1><p>你们调整了 <strong>${changed.organs.length}</strong> 个器官，并${changed.routeChanged ? "重新思考了" : "保留了"}食物路线。系统已经把前后两版一起交给老师。</p>`;
  }
}

function startRevision() {
  if (!v2) {
    v2 = clone(v1);
    v2.startedAt = Date.now();
    v2.completedAt = null;
    v2.moves = [];
    v2.modificationCount = 0;
    v2.routeAttempts = [];
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
  if (!second) return { organs: [], routeChanged: false };
  const changedOrgans = organs.filter((organ) => {
    const a = first.positions[organ.id];
    const b = second.positions[organ.id];
    return !a || !b || Math.hypot(a.x - b.x, a.y - b.y) > 2.5;
  }).map((organ) => organ.name);
  return { organs: changedOrgans, routeChanged: first.routeOrder.join(",") !== second.routeOrder.join(",") || second.routeAttempts.length > 0 };
}

function formatDuration(model) {
  if (!model?.completedAt) return "未完成";
  const seconds = Math.max(1, Math.round((model.completedAt - model.startedAt) / 1000));
  return seconds >= 60 ? `${Math.floor(seconds / 60)}分${seconds % 60}秒` : `${seconds}秒`;
}

function miniModel(model, label) {
  if (!model) return `<div class="mini-empty"><strong>${label}</strong><span>尚未提交</span></div>`;
  const polyline = model.routePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const pieces = organs.map((organ) => {
    const position = model.positions[organ.id];
    if (!position) return "";
    return `<img src="${organ.image}" alt="${organ.name}" title="${organ.name}" style="left:${position.x}%;top:${position.y}%;width:${organ.width}%">`;
  }).join("");
  return `<div><strong class="mini-label">${label}</strong><div class="mini-model"><img class="mini-body" src="assets/anatomy/body-outline-generated.png?v=20261022-5" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${polyline}"/></svg>${pieces}</div></div>`;
}

function latestRecord(records, id) {
  return records.filter((record) => Number(record.groupId) === id).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0] || null;
}

function renderDashboard(records) {
  const completedV1 = records.filter((record) => record.v1?.completedAt).length;
  const completedV2 = records.filter((record) => record.v2?.completedAt).length;
  document.querySelector("#teacher-summary").innerHTML = `<div><strong>${completedV1}</strong><span>组完成 V1</span></div><div><strong>${completedV2}</strong><span>组完成 V2</span></div><div><strong>${records.length}</strong><span>本次记录</span></div>`;
  document.querySelector("#group-dashboard").innerHTML = Array.from({ length: 12 }, (_, index) => {
    const id = index + 1;
    const record = latestRecord(records, id);
    if (!record) return `<article class="group-model-card is-empty"><header><h2>第 ${id} 组</h2><span>等待提交</span></header></article>`;
    const difference = compareModels(record.v1, record.v2);
    const placement = record.v1.placementOrder.map((organId) => organById(organId)?.name).filter(Boolean).join(" → ") || "未记录";
    const route = record.v1.routeOrder.map((organId) => organById(organId)?.name).filter(Boolean).join(" → ") || "未画路线";
    const status = record.v2?.completedAt ? "V2 已完成" : record.v1?.completedAt ? "V1 已完成" : "进行中";
    return `<article class="group-model-card"><header><h2>第 ${id} 组</h2><span>${status}</span></header><div class="mini-compare">${miniModel(record.v1, "V1 初始")}${miniModel(record.v2, "V2 修正")}</div><dl><div><dt>初次摆放</dt><dd>${placement}</dd></div><div><dt>初始路线</dt><dd>${route}</dd></div><div><dt>完成时间</dt><dd>V1 ${formatDuration(record.v1)}${record.v2 ? ` · V2 ${formatDuration(record.v2)}` : ""}</dd></div><div><dt>修正证据</dt><dd>${record.v2 ? `移动 ${difference.organs.length} 个器官：${difference.organs.join("、") || "未移动"}；路线${difference.routeChanged ? "有变化" : "未变化"}` : "等待 AR 后修正"}</dd></div></dl></article>`;
  }).join("");
}

async function loadCloudRecords() {
  const database = await initializeCloud();
  const result = await database.collection(CLOUD_COLLECTION).get();
  const documents = Array.isArray(result?.data) ? result.data : [];
  return documents.flatMap((document) => Array.isArray(document.records) ? document.records : []);
}

async function refreshDashboard() {
  const button = document.querySelector("#refresh-dashboard");
  button.disabled = true;
  button.textContent = "正在刷新…";
  const localRecords = await loadLocalRecords().catch(() => []);
  let cloudRecords = [];
  try {
    cloudRecords = await loadCloudRecords();
    document.querySelector("#connection-status").textContent = "教师端已连接";
  } catch (error) {
    console.error("教师端云端读取失败", error);
    document.querySelector("#connection-status").textContent = "仅显示本机记录";
  }
  const merged = new Map([...localRecords, ...cloudRecords].map((record) => [record.id, record]));
  renderDashboard([...merged.values()]);
  button.disabled = false;
  button.textContent = "刷新数据";
}

async function exportRecords() {
  const records = await loadLocalRecords();
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `food-journey-records-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function initialize() {
  document.querySelector("#group-badge").textContent = mode === "teacher" ? "教师端" : `第 ${groupId} 组`;
  document.querySelector(".model-back").href = `index.html?group=${groupId}`;
  if (mode === "teacher") {
    document.body.classList.add("teacher-mode");
    studentView.hidden = true;
    teacherView.hidden = false;
    refreshDashboard();
    setInterval(refreshDashboard, 15000);
    return;
  }
  const savedRecords = await loadLocalRecords().catch(() => []);
  const savedRecord = savedRecords
    .filter((record) => Number(record.groupId) === groupId)
    .sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0];
  if (savedRecord) {
    sessionId = savedRecord.id;
    v1 = savedRecord.v1 ? clone(savedRecord.v1) : createModel();
    v2 = savedRecord.v2 ? clone(savedRecord.v2) : null;
    if (v2) applyRevisionView();
  }
  if (v2?.completedAt) {
    studentView.hidden = true;
    transitionPanel.hidden = false;
    showSavedTransition(savedRecord);
    return;
  }
  if (v1.completedAt && !v2) {
    showSavedTransition(savedRecord);
    return;
  }
  render();
  resizeCanvas();
  new ResizeObserver(resizeCanvas).observe(stage);
}

document.addEventListener("pointermove", moveOrganDrag);
document.addEventListener("pointerup", endOrganDrag);
document.addEventListener("pointercancel", endOrganDrag);
window.addEventListener("pagehide", () => { void saveDraftNow(); });
canvas.addEventListener("pointerdown", startRoute);
canvas.addEventListener("pointermove", moveRoute);
canvas.addEventListener("pointerup", finishRoute);
canvas.addEventListener("pointercancel", finishRoute);
drawButton.addEventListener("click", () => setDrawMode(!drawMode));
document.querySelector("#undo-button").addEventListener("click", undo);
document.querySelector("#clear-route-button").addEventListener("click", clearRoute);
submitButton.addEventListener("click", submitModel);
document.querySelector("#refresh-dashboard").addEventListener("click", refreshDashboard);
document.querySelector("#export-button").addEventListener("click", exportRecords);
document.querySelector("#model-fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
initialize();
