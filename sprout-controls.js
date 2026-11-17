export function bindSproutDrag(guide,hintButton,hideHint,onTap,moveFreely){
  let drag;
  let ignorePointerClick = false;

  hintButton.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    const {left, top, width, height} = hintButton.getBoundingClientRect();
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, left, top, width, height, moved:false};
    ignorePointerClick = false;
    hintButton.setPointerCapture(event.pointerId);
  });
  hintButton.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 10) return;
      drag.moved = true;
      ignorePointerClick = true;
      guide.dataset.dragging = '';
      hideHint();
    }
    if(moveFreely){
      moveFreely(drag.left + dx,drag.top + dy,drag.width,drag.height);
      return;
    }
    const left = Math.max(0, Math.min(drag.left + dx, window.innerWidth - drag.width));
    const top = Math.max(12, Math.min(drag.top + dy, window.innerHeight - drag.height - 12));
    guide.style.setProperty('--drag-x', left + 'px');
    guide.style.setProperty('--sprout-y', top + 'px');
  });
  function finishDrag(event) {
    if (drag?.id !== event.pointerId) return;
    if (drag.moved) {
      if(!moveFreely){
        const bounds = hintButton.getBoundingClientRect();
        guide.dataset.side = bounds.left + bounds.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
        guide.style.setProperty('--sprout-y', (100 * bounds.top / window.innerHeight) + '%');
        guide.style.removeProperty('--drag-x');
      }
      delete guide.dataset.dragging;
    }
    drag = undefined;
  }
  hintButton.addEventListener('pointerup', finishDrag);
  hintButton.addEventListener('pointercancel', finishDrag);
  hintButton.addEventListener('lostpointercapture', finishDrag);

  hintButton.addEventListener('click', event => {
    if (ignorePointerClick && event.detail !== 0) {
      ignorePointerClick = false;
      return;
    }
    onTap();
  });
}

export function positionSproutBubble(guide,hintButton){
  const bounds = hintButton.getBoundingClientRect();
  const spaceAbove = bounds.top;
  const spaceBelow = window.innerHeight - bounds.bottom;
  guide.dataset.bubble = spaceAbove >= spaceBelow ? 'above' : 'below';
  guide.style.setProperty('--hint-space', Math.max(0, Math.max(spaceAbove, spaceBelow) - 16) + 'px');
}
