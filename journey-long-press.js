const holdDurationMs = 650;

export function bindSceneLongPress(surface, currentPointer, advance) {
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const pointer = currentPointer();
    if (pointer?.id !== event.pointerId) return;

    setTimeout(() => {
      if (document.hidden || currentPointer() !== pointer || pointer.drag) return;
      if (surface.hasPointerCapture(pointer.id)) advance();
    }, holdDurationMs);
  });

  surface.addEventListener('contextmenu', event => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') event.preventDefault();
  });
}
