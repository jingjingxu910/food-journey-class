// Keep fullscreen on a stable same-origin parent while lesson pages navigate.
(() => {
  if (window === window.top && !document.currentScript?.hasAttribute('data-standalone')) {
    const target = new URL('lesson-shell.html', location.href);
    target.searchParams.set('page', location.pathname.split('/').pop() || 'index.html');
    target.searchParams.set('query', location.search);
    target.searchParams.set('hash', location.hash);
    // Run before page initialization: no duplicate camera, records, or render loops.
    window.stop();
    location.replace(target.href);
    return;
  }
  window.requestLessonFullscreen = async () => {
    let root = document.documentElement;
    try { if (parent.lessonShell) root = parent.document.documentElement; } catch {}
    const owner = root.ownerDocument;
    try {
      if (owner.fullscreenElement || owner.webkitFullscreenElement) {
        await (owner.exitFullscreen || owner.webkitExitFullscreen)?.call(owner);
        return;
      }
      const enter = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!enter) return;
      await enter.call(root);
    } catch { return; }
    // Lock the stable outer document so changing activities cannot unlock it.
    const teacher = new URLSearchParams(location.search).get('mode') === 'teacher';
    if (!teacher) {
      try { await root.ownerDocument.defaultView.screen.orientation?.lock?.('portrait'); }
      catch { /* Keep the usable responsive layout when this device disallows locking. */ }
    }
  };
})();
