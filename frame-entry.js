// Keep fullscreen on a stable same-origin parent while lesson pages navigate.
(() => {
  if (window === window.top) {
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
    if (!owner.fullscreenElement) await root.requestFullscreen?.();
  };
})();
