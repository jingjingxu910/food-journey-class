const organs = [
  { id: "mouth", name: "口腔", image: "assets/organs/mouth-gentle.svg", width: 12 },
  { id: "esophagus", name: "食管", image: "assets/organs/esophagus.webp", width: 7, height: 16 },
  { id: "stomach", name: "胃", image: "assets/organs/stomach.webp", width: 18 },
  { id: "small-intestine", name: "小肠", image: "assets/organs/small-intestine.webp", width: 20 },
  { id: "large-intestine", name: "大肠", image: "assets/organs/large-intestine.webp", width: 26 },
];

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
let dashboardRecords = [];
let dashboardPage = 0;
let resetCheckInProgress = false;
let pendingSubmissionSync = false;
let discardDraftOnExit = false;
let lessonExtras = {};

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
  if (!palette.children.length) organs.forEach((organ) => palette.append(createOrganButton(organ)));
  for (const button of palette.children) button.hidden = Boolean(activeModel().positions[button.dataset.organ]);
}

function renderPlacedOrgans() {

  organs.forEach((organ) => {
    const position = activeModel().positions[organ.id];
    let button = placedLayer.querySelector(`[data-organ="${organ.id}"]`);
    if (!button) { button = createOrganButton(organ, true); placedLayer.append(button); }
    button.hidden = !position;
    if (!position) return;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.style.width = `${organ.width}%`;
    if (organ.height) {
      button.classList.add(`placed-organ--${organ.id}`);
      button.style.height = `${organ.height}%`;
    }

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
   ghost.style.width = `${Math.max(30, stage.clientWidth * organ.width / 100)}px`;
  if (organ.height) {
    ghost.style.height = `${stage.clientHeight * organ.height / 100}px`;
    ghost.style.maxHeight = "none";
    ghost.style.objectFit = "contain";
  }
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

let routePaint = 0;
function moveRoute(event) {
  if (!drawing) return;
  event.preventDefault();
  const point = pointerPosition(event);
  const points = activeModel().routePoints;
  const previous = points[points.length - 1];
  if (Math.hypot(point.x - previous.x, point.y - previous.y) >= .45) points.push(point);
  if (!routePaint) routePaint = requestAnimationFrame(() => { routePaint = 0; drawRoute(); });
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
    return database.collection(CLOUD_COLLECTION).doc("class-reset").get();
  })(), 2500);
  const resetRecord = Array.isArray(result?.data) ? result.data[0] || {} : result?.data || {};
  return typeof resetRecord.resetId === "string" ? resetRecord.resetId : null;
}

async function initializeCloud() {
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
    const submittedRecord = clone(record);
    if (!submittedRecord.v1?.completedAt) submittedRecord.v1 = null;
    if (!submittedRecord.v2?.completedAt) submittedRecord.v2 = null;
    submittedRecord.pendingSync = false;
    const records = Array.isArray(current.records) ? current.records.filter((item) => item.id !== record.id) : [];
    records.push(submittedRecord);
    const payload = { id: groupId, records: records.slice(-20), updatedAt: Date.now() };
    const written = await reference.set(payload);
    if (written?.code || !(written?.updated > 0 || written?.upsertedId || written?.id)) {
      throw new Error(written?.message || "云端未确认保存");
    }
    record.pendingSync = false;
    pendingSubmissionSync = false;
    await saveLocal(record);
    document.querySelector("#connection-status").textContent = "已上传教师端";
    return true;
  } catch (error) {
    pendingSubmissionSync = true;
    console.error("同步失败，记录已保存在本机", error);
    document.querySelector("#connection-status").textContent = "本机已保存";
    return false;
  }
}

function buildRecord() {
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
    return;
  }
  const changed = compareModels(record.v1, record.v2);
  transitionPanel.innerHTML = `<p class="model-eyebrow">第 ${groupId} 组 · V2 已提交</p><h1>模型修正已提交</h1><p>调整了 ${changed.organs.length} 个器官。${record.pendingSync ? "暂未传给老师。" : ""}</p><div class="saved-model-preview">${miniModel(record.v2, "已保存模型")}</div><div class="transition-actions"><a class="submit-model-button" href="assembly.html?group=${groupId}">去拼装 →</a></div>`;
}

function applyRevisionView() {
  phase = "v2";
  document.querySelector("#phase-label").textContent = "V2 · 证据修正";
  document.querySelector("#model-title").textContent = "用观察证据修正模型";
  document.querySelector("#model-prompt").textContent = "看看初始模型，想一想要不要调整。";
  document.querySelector("#phase-v1").classList.remove("active");
  document.querySelector("#phase-v1").classList.add("done");
  document.querySelector("#phase-v2").classList.add("active");
  submitButton.textContent = "确认提交 V2 修正";
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
  pendingSubmissionSync = true;
  const record = buildRecord();
  await saveLocal(record);
  document.querySelector("#connection-status").textContent = "本机已保存";
  await syncRecord(record);
  showSavedTransition(record);
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

function miniModel(model, label, options = {}) {
  if (!model) return `<div class="mini-empty"><strong>${label}</strong><span>尚未提交</span></div>`;
  const polyline = (model.routePoints || []).map((point) => `${point.x},${point.y}`).join(" ");
  const pieces = organs.map((organ) => {
    const position = model.positions?.[organ.id];
    if (!position) return "";
    return `<img class="organ-${organ.id}" src="${organ.image}" alt="${organ.name}" title="${organ.name}" style="left:${position.x}%;top:${position.y}%;width:${organ.width}%;${organ.height ? `height:${organ.height}%;` : ""}">`;
  }).join("");
  const interactive = Number.isInteger(options.groupId);
  const attributes = interactive ? ` data-group-id="${options.groupId}" data-model-phase="${options.phase}" role="button" tabindex="0" aria-label="放大第 ${options.groupId} 组${label}"` : "";
  return `<div class="${label === "观察前想法" && !model._paired ? "mini-model-single" : "mini-model-item"}${interactive ? " mini-model-clickable" : ""}"${attributes}><strong class="mini-label">${label}</strong><div class="mini-model"><img class="mini-body" src="assets/anatomy/body-outline-generated.webp?v=20261022-7" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${polyline}"/></svg>${pieces}</div></div>`;
}

function latestRecord(records, id) {
  return records.filter((record) => Number(record.groupId) === id).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))[0] || null;
}

function renderDashboard(records) {
  dashboardRecords = records.filter((record) => record.lesson === "food-journey" && (record.v1?.completedAt || record.v2?.completedAt || record.observation?.completedAt || record.assembly?.completedAt || record.journey?.completedAt));
  const latestRecords = Array.from({ length: 12 }, (_, index) => latestRecord(dashboardRecords, index + 1));
  const participatingGroups = latestRecords.filter(Boolean).length;
  const completedV1 = latestRecords.filter((record) => record?.v1?.completedAt).length;
  const completedV2 = latestRecords.filter((record) => record?.v2?.completedAt).length;
  const observed = latestRecords.filter((record) => record?.observation?.completedAt).length;
  const assembled = latestRecords.filter((record) => record?.assembly?.completedAt).length;
  const journeyed = latestRecords.filter((record) => record?.journey?.completedAt).length;
  document.querySelector("#teacher-summary").innerHTML = `<div><strong>${participatingGroups}</strong><span>组已提交</span></div><div><strong>${completedV1}</strong><span>组初始模型</span></div><div><strong>${observed}</strong><span>组完成观察</span></div><div><strong>${completedV2}</strong><span>组修正模型</span></div><div><strong>${assembled}</strong><span>组拼装</span></div><div><strong>${journeyed}</strong><span>组完成旅程</span></div>`;
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
    if (!record) return `<article class="group-model-card is-empty"><header><h2>第 ${id} 组</h2><span>等待提交</span></header></article>`;
    const difference = compareModels(record.v1, record.v2);
    const status = record.pendingSync ? "本机已提交·待同步" : record.journey?.completedAt ? "已完成旅程" : record.assembly?.completedAt ? "已提交拼装" : record.v2?.completedAt ? "已提交观察后修正" : record.observation?.completedAt ? "已完成观察" : "已提交观察前想法";
    const before = record.v1 ? miniModel({ ...record.v1, _paired: Boolean(record.v2?.completedAt) }, "观察前想法", { groupId: id, phase: "v1" }) : "";
    const after = record.v2?.completedAt ? miniModel(record.v2, "观察后修正", { groupId: id, phase: "v2" }) : "";
    const analysis = record.v2?.completedAt
      ? `${difference.organs.length ? `位置有变化：${difference.organs.join("、")}` : "器官位置未见明显变化"}；${difference.routeChanged ? "食物路线有变化" : "食物路线保持原样"}`
      : record.v1?.completedAt ? "等待小组完成观察后修正" : "";
    const views = record.observation?.views || [];
    const observedNames = [...new Set(views.map((item) => organById(item.organId)?.name).filter(Boolean))];
    const observationLine = record.observation?.completedAt ? `观察 ${observedNames.length} 种器官 · 局部 3D ${record.observation.local3dEntries?.length || 0} 次` : "";
    const gameLine = record.journey?.completedAt ? `旅程经过 ${(record.journey.visits || []).length} 处` : "";
    const photo = /^data:image\/jpeg;base64,/.test(record.assembly?.photoPreview || "") ? `<button class="assembly-thumb" data-photo-group-id="${id}" aria-label="放大第 ${id} 组拼装照片"><img src="${record.assembly.photoPreview}" alt="第 ${id} 组拼装作品"></button>` : "";
    return `<article class="group-model-card"><header><h2>第 ${id} 组</h2><span>${status}</span></header>${before || after ? `<div class="mini-compare ${after ? "has-revision" : "single-model"}">${before}${after}</div>` : ""}${analysis ? `<p class="group-model-analysis">${analysis}</p>` : ""}${observationLine || gameLine ? `<p class="group-progress-line">${[observationLine,gameLine].filter(Boolean).join(" · ")}</p>` : ""}${photo}</article>`;
  }).join("");
}

async function loadCloudRecords() {
  const database = await initializeCloud();
  const result = await database.collection(CLOUD_COLLECTION).get();
  const documents = Array.isArray(result?.data) ? result.data : [];
  return documents.flatMap((document) => Array.isArray(document.records)
    ? document.records.filter((record) => Number(record.groupId) === Number(document.id))
    : []);
}

async function refreshDashboard() {
  const button = document.querySelector("#refresh-dashboard");
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
    document.querySelector("#connection-status").textContent = "仅显示本机记录";
  }
  const currentLocalRecords = activeResetId
    ? localRecords.filter((record) => record.lesson !== "food-journey" || record.resetId === activeResetId)
    : localRecords;
  const merged = new Map();
  [...currentLocalRecords, ...cloudRecords]
    .sort((first, second) => Number(first.updatedAt) - Number(second.updatedAt))
    .forEach((record) => merged.set(record.id, record));
  const visibleRecords = [...merged.values()].filter((record) => record.lesson === "food-journey" && (record.v1?.completedAt || record.v2?.completedAt || record.observation?.completedAt || record.assembly?.completedAt || record.journey?.completedAt) && (!activeResetId || record.resetId === activeResetId));
  renderDashboard(visibleRecords);
  button.disabled = false;
  button.textContent = "刷新数据";
}

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
    await database.collection(CLOUD_COLLECTION).doc("class-reset").set({ id: "class-reset", resetId, updatedAt: Date.now() });
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
  const route = (model.routeOrder || []).map((id) => organById(id)?.name).filter(Boolean).join(" → ") || "未记录";
  const observation = record.observation;
  const observed = [...new Set((observation?.views || []).map((item) => organById(item.organId)?.name).filter(Boolean))].join("、") || "未记录";
  const revision = phaseName === "v2" ? compareModels(record.v1, model) : null;
  const metrics = `<dl class="model-preview-metrics"><div><dt>摆放调整</dt><dd>${model.modificationCount || 0} 次</dd></div><div><dt>完成时间</dt><dd>${formatDuration(model)}</dd></div><div><dt>所画路线</dt><dd>${route}</dd></div><div><dt>观察器官</dt><dd>${observed}</dd></div>${revision ? `<div><dt>修正器官</dt><dd>${revision.organs.join("、") || "未调整位置"}</dd></div><div><dt>路线变化</dt><dd>${revision.routeChanged ? "有变化" : "保持原样"}</dd></div>` : ""}</dl>`;
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
    lessonExtras = { observation: savedRecord.observation || null, assembly: savedRecord.assembly || null, journey: savedRecord.journey || null };
    sessionId = savedRecord.id;
    v1 = savedRecord.v1 ? clone(savedRecord.v1) : createModel();
    v2 = savedRecord.v2 ? clone(savedRecord.v2) : null;
    if (v2) applyRevisionView();
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
document.addEventListener("pointercancel", () => {
  dragState?.ghost.remove(); dragState = null;
  document.querySelectorAll(".is-moving").forEach(e => e.classList.remove("is-moving"));
});
window.addEventListener("pagehide", () => { if (!discardDraftOnExit) void saveDraftNow(); });
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
    if (/^data:image\/jpeg;base64,/.test(source || "")) {
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
document.querySelector("#teacher-fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
document.querySelector("#model-fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
initialize().finally(() => { studentView.style.pointerEvents = ''; stage.style.pointerEvents = ''; submitButton.disabled = false; });
