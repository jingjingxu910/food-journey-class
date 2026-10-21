const organPieces = document.querySelector("#organ-pieces");
const slots = [...document.querySelectorAll(".organ-slot")];
const feedback = document.querySelector("#drag-feedback");
const progressOutput = document.querySelector("#progress-output");
const restartButton = document.querySelector("#restart-button");
let activePiece = null;
let dragGhost = null;

function updateProgress() {
  const completedCount = slots.filter((slot) => slot.classList.contains("is-correct")).length;
  progressOutput.textContent = `已完成 ${completedCount} / 6 站`;

  if (completedCount === slots.length) {
    feedback.textContent = "全部正确！食物完成了身体里的旅行。";
    feedback.dataset.state = "passed";
  }
}

function resetPiece(piece) {
  piece.classList.remove("is-dragging");
  piece.style.removeProperty("opacity");
}

function removeGhost() {
  dragGhost?.remove();
  dragGhost = null;
}

function finishDrag(pointerEvent) {
  if (!activePiece) return;

  removeGhost();
  const dropTarget = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest(".organ-slot");

  if (!dropTarget) {
    resetPiece(activePiece);
    feedback.textContent = "请把器官拖进一个空站点。";
    activePiece = null;
    return;
  }

  if (dropTarget.dataset.organ !== activePiece.dataset.organ) {
    resetPiece(activePiece);
    feedback.textContent = "再想一想：食物会先到哪里呢？";
    feedback.dataset.state = "retry";
    activePiece = null;
    return;
  }

  dropTarget.append(activePiece);
  dropTarget.classList.add("is-correct");
  activePiece.classList.remove("is-dragging");
  feedback.textContent = "放对了！继续下一站。";
  feedback.dataset.state = "passed";
  updateProgress();
  activePiece = null;
}

function startDrag(pointerEvent) {
  const piece = pointerEvent.currentTarget;
  if (piece.parentElement?.classList.contains("organ-slot")) return;

  activePiece = piece;
  piece.setPointerCapture(pointerEvent.pointerId);
  piece.classList.add("is-dragging");
  dragGhost = piece.cloneNode(true);
  dragGhost.classList.add("drag-ghost");
  document.body.append(dragGhost);
  moveGhost(pointerEvent);
}

function moveGhost(pointerEvent) {
  if (!dragGhost) return;
  dragGhost.style.left = `${pointerEvent.clientX}px`;
  dragGhost.style.top = `${pointerEvent.clientY}px`;
}

function shufflePieces() {
  [...organPieces.children]
    .sort(() => Math.random() - 0.5)
    .forEach((piece) => organPieces.append(piece));
}

function restartActivity() {
  slots.forEach((slot) => {
    const piece = slot.querySelector(".organ-piece");
    if (piece) organPieces.append(piece);
    slot.classList.remove("is-correct");
  });
  shufflePieces();
  feedback.textContent = "准备好了吗？从任意一张器官卡片开始。";
  feedback.dataset.state = "";
  updateProgress();
}

document.addEventListener("pointermove", moveGhost);
document.addEventListener("pointerup", finishDrag);
restartButton.addEventListener("click", restartActivity);
document.querySelectorAll(".organ-piece").forEach((piece) => piece.addEventListener("pointerdown", startDrag));

shufflePieces();
updateProgress();
