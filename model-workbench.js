const organs = [
  { id: "mouth", name: "口腔", image: "assets/organs/mouth.png" },
  { id: "esophagus", name: "食道", image: "assets/organs/esophagus.png" },
  { id: "stomach", name: "胃", image: "assets/organs/stomach.png" },
  { id: "small-intestine", name: "小肠", image: "assets/organs/small-intestine.png" },
  { id: "large-intestine", name: "大肠", image: "assets/organs/large-intestine.png" },
];
const emptyMap = () => Object.fromEntries(organs.map((organ) => [organ.id, null]));
const emptyRoute = () => Object.fromEntries(["1", "2", "3", "4", "5"].map((station) => [station, null]));
let phase = "v1";
let step = "position";
let sessionId = "";
let startedAt = 0;
let v1 = { position: emptyMap(), route: emptyRoute(), changes: 0 };
let v2 = { position: emptyMap(), route: emptyRoute(), changes: 0 };
let draggedOrgan = null;
let dragGhost = null;

const workbench = document.querySelector("#workbench");
const savedPanel = document.querySelector("#saved-panel");
const codeCard = document.querySelector("#student-code-card");
const studentCodeInput = document.querySelector("#student-code");
const feedback = document.querySelector("#model-feedback");
const nextButton = document.querySelector("#next-button");
const clearButton = document.querySelector("#clear-button");

function activeModel() { return phase === "v1" ? v1 : v2; }
function targetMap() { return activeModel()[step]; }
function organById(organId) { return organs.find((organ) => organ.id === organId); }
function allPlaced(map) { return Object.values(map).every(Boolean); }

function createPiece(organId) {
  const organ = organById(organId);
  const piece = document.createElement("button");
  piece.className = "organ-image-piece";
  piece.type = "button";
  piece.dataset.organ = organ.id;
  piece.setAttribute("aria-label", organ.name);
  piece.innerHTML = `<img src="${organ.image}" alt="${organ.name}" /><span>${organ.name}</span>`;
  piece.addEventListener("pointerdown", beginDrag);
  return piece;
}

function renderBoard(board) {
  const map = activeModel()[board];
  const palette = document.querySelector(`#${board}-palette`);
  document.querySelectorAll(`[data-board="${board}"][data-slot]`).forEach((slot) => {
    slot.replaceChildren();
    const organId = map[slot.dataset.slot];
    if (organId) slot.append(createPiece(organId));
  });
  palette.replaceChildren();
  organs.filter((organ) => !Object.values(map).includes(organ.id)).forEach((organ) => palette.append(createPiece(organ.id)));
}

function render() {
  document.querySelector("#position-board").hidden = step !== "position";
  document.querySelector("#route-board").hidden = step !== "route";
  document.querySelector("#position-step").classList.toggle("is-active", step === "position");
  document.querySelector("#route-step").classList.toggle("is-active", step === "route");
  document.querySelector("#revision-step").classList.toggle("is-active", phase === "v2");
  document.querySelector("#phase-label").textContent = phase === "v1" ? "V1 · 我的初始想法" : "V2 · 用观察证据修正模型";
  document.querySelector("#model-title").textContent = phase === "v1" ? "先画出你的消化模型" : "回到模型，做出你的修正";
  document.querySelector("#model-prompt").textContent = phase === "v1" ? "把器官放到你认为正确的位置，再排出食物会经过的顺序。此时没有对错提示。" : "根据刚才的 AR 观察，调整位置和路线；系统会保存你的变化。";
  nextButton.textContent = step === "position" ? "下一步：排列路线" : phase === "v1" ? "保存 V1，前往 AR 观察" : "保存 V2 修正模型";
  renderBoard(step);
}

function beginDrag(event) {
  draggedOrgan = event.currentTarget.dataset.organ;
  dragGhost = event.currentTarget.cloneNode(true);
  dragGhost.classList.add("drag-ghost");
  document.body.append(dragGhost);
  moveGhost(event);
}
function moveGhost(event) { if (dragGhost) { dragGhost.style.left = `${event.clientX}px`; dragGhost.style.top = `${event.clientY}px`; } }
function endDrag(event) {
  if (!draggedOrgan) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(`[data-board="${step}"][data-slot]`);
  dragGhost?.remove(); dragGhost = null;
  if (target) {
    const map = targetMap();
    Object.keys(map).forEach((slot) => { if (map[slot] === draggedOrgan) map[slot] = null; });
    map[target.dataset.slot] = draggedOrgan;
    activeModel().changes += 1;
    feedback.textContent = phase === "v1" ? "已记录你的想法，继续完成模型。" : "已记录这次修正。";
    renderBoard(step);
  }
  draggedOrgan = null;
}
function clearCurrentStep() { activeModel()[step] = step === "position" ? emptyMap() : emptyRoute(); activeModel().changes += 1; renderBoard(step); }

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("foodJourneyClass", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("learningRecords", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveRecord() {
  const databaseHandle = await database();
  const record = { id: sessionId, studentCode: studentCodeInput.value.trim(), startedAt, updatedAt: Date.now(), pendingSync: true, v1, v2: phase === "v2" ? v2 : null };
  await new Promise((resolve, reject) => { const transaction = databaseHandle.transaction("learningRecords", "readwrite"); transaction.objectStore("learningRecords").put(record); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
}
async function advance() {
  if (!allPlaced(targetMap())) { feedback.textContent = "请先放完全部 5 个器官，再进入下一步。"; return; }
  if (step === "position") { step = "route"; feedback.textContent = "现在请排出食物旅行的顺序。"; render(); return; }
  await saveRecord();
  workbench.hidden = true;
  savedPanel.hidden = false;
  if (phase === "v1") {
    savedPanel.innerHTML = `<p class="board-kicker">V1 已保存</p><h2>你的初始模型已记录</h2><p>现在进入 AR 观察。完成观察后，回到这里点击下方按钮修正模型。</p><button id="start-v2-button" type="button">我已完成 AR 观察，开始 V2 修正</button>`;
    document.querySelector("#start-v2-button").addEventListener("click", () => { phase = "v2"; step = "position"; v2 = JSON.parse(JSON.stringify(v1)); savedPanel.hidden = true; workbench.hidden = false; feedback.textContent = "请根据观察到的证据调整模型。"; render(); });
  } else {
    savedPanel.innerHTML = `<p class="board-kicker">V2 已保存</p><h2>你完成了模型修正</h2><p>系统已保存 V1 与 V2 的差异，等待教师端收集。</p>`;
  }
}
async function exportRecords() {
  const databaseHandle = await database();
  const records = await new Promise((resolve, reject) => { const request = databaseHandle.transaction("learningRecords", "readonly").objectStore("learningRecords").getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `food-journey-records-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url);
}

document.querySelector("#start-model-button").addEventListener("click", () => {
  if (!studentCodeInput.value.trim()) { studentCodeInput.focus(); return; }
  sessionId = crypto.randomUUID(); startedAt = Date.now(); codeCard.hidden = true; workbench.hidden = false; render();
});
nextButton.addEventListener("click", advance); clearButton.addEventListener("click", clearCurrentStep); document.addEventListener("pointermove", moveGhost); document.addEventListener("pointerup", endDrag); document.querySelector("#export-button").addEventListener("click", exportRecords);
