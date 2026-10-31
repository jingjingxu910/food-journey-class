window.lessonShell = true;
const frame = document.querySelector('#lesson-frame');
const base = new URL('./', location.href);
const allowed = new Set(['index.html','model-workbench.html','observation.html','assembly.html','journey.html','ar-prepare.html']);
const params = new URLSearchParams(location.search);
const initial = new URL(allowed.has(params.get('page')) ? params.get('page') : 'index.html', base);
initial.search = params.get('query') || '';
initial.hash = params.get('hash') || '';
frame.src = initial.href;
frame.addEventListener('load', () => {
  try {
    const child = new URL(frame.contentWindow.location.href);
    if (child.origin !== base.origin || !child.pathname.startsWith(base.pathname)) return;
    const shell = new URL(location.href);
    shell.search = '';
    shell.searchParams.set('page', child.pathname.slice(base.pathname.length));
    shell.searchParams.set('query', child.search);
    if (child.hash) shell.searchParams.set('hash', child.hash);
    history.replaceState(null, '', shell);
    document.title = frame.contentDocument.title || '食物在身体里的旅行';
  } catch { /* Never inspect unrelated origins. */ }
});
