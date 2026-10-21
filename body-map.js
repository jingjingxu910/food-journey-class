const piecesContainer = document.querySelector("#body-organ-pieces");
const bodySlots = [...document.querySelectorAll(".body-slot")];
const bodyFeedback = document.querySelector("#body-feedback");
const bodyProgressOutput = document.querySelector("#body-progress-output");
const bodyRestartButton = document.querySelector("#body-restart-button");
let selectedPiece = null;
let bodyGhost = null;

function setBodyFeedback(message, state) {
  bodyFeedback.textContent = message;
  bodyFeedback.dataset.state = state;
}

function updateBodyProgress() {
  const completedCount = bodySlots.filter((slot) => slot.classList.contains("is-correct")).length;
  bodyProgressOutput.textContent = `已定位 ${completedCount} / 6 个器官`;

  if (completedCount === bodySlots.length) {
    setBodyFeedback("全部找对了！你已经认识了消化器官的位置。", "passed");
  }
}

function moveBodyGhost(pointerEvent) {
  if (!bodyGhost) return;
  bodyGhost.style.left = `${pointerEvent.clientX}px`;
  bodyGhost.style.top = `${pointerEvent.clientY}px`;
}

function clearBodyGhost() {
  bodyGhost?.remove();
  bodyGhost = null;
}

function endBodyDrag(pointerEvent) {
  if (!selectedPiece) return;

  clearBodyGhost();
  const dropTarget = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest(".body-slot");
  const draggedPiece = selectedPiece;
  selectedPiece = null;
  draggedPiece.classList.remove("is-dragging");

  if (!dropTarget) {
    setBodyFeedback("请把器官拖到人体轮廓中的圆形提示处。", "retry");
    return;
  }

  if (dropTarget.dataset.organ !== draggedPiece.dataset.organ) {
    setBodyFeedback("这里不是它的位置，再观察一下人体轮廓。", "retry");
    return;
  }

  dropTarget.append(draggedPiece);
  dropTarget.classList.add("is-correct");
  setBodyFeedback("找对了！继续定位下一个器官。", "passed");
  updateBodyProgress();
}

function beginBodyDrag(pointerEvent) {
  const piece = pointerEvent.currentTarget;
  if (piece.parentElement?.classList.contains("body-slot")) return;

  selectedPiece = piece;
  piece.setPointerCapture(pointerEvent.pointerId);
  piece.classList.add("is-dragging");
  bodyGhost = piece.cloneNode(true);
  bodyGhost.classList.add("drag-ghost");
  document.body.append(bodyGhost);
  moveBodyGhost(pointerEvent);
}

function shuffleBodyPieces() {
  [...piecesContainer.children]
    .sort(() => Math.random() - 0.5)
    .forEach((piece) => piecesContainer.append(piece));
}

function restartBodyActivity() {
  bodySlots.forEach((slot) => {
    const piece = slot.querySelector(".organ-piece");
    if (piece) piecesContainer.append(piece);
    slot.classList.remove("is-correct");
  });
  shuffleBodyPieces();
  setBodyFeedback("从任意一张器官卡片开始。", "");
  updateBodyProgress();
}

document.addEventListener("pointermove", moveBodyGhost);
document.addEventListener("pointerup", endBodyDrag);
bodyRestartButton.addEventListener("click", restartBodyActivity);
document.querySelectorAll(".organ-piece").forEach((piece) => piece.addEventListener("pointerdown", beginBodyDrag));

shuffleBodyPieces();
updateBodyProgress();
