window.lessonShell = true;
const frame = document.querySelector('#lesson-frame');
const base = new URL('./', location.href);
const allowed = new Set(['index.html','model-workbench.html','observation.html','assembly.html','journey.html','journey-game.html','ar-prepare.html']);
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
    if (document.fullscreenElement && child.searchParams.get('mode') !== 'teacher') {
      screen.orientation?.lock('portrait').catch(() => {});
    }
  } catch { /* Never inspect unrelated origins. */ }
});

// One orientation policy across all student activities; teacher presentation stays landscape.
const portraitGuard=document.querySelector('#portrait-guard');
function isTeacherView(){
 try{const child=new URL(frame.contentWindow.location.href);if(child.protocol==='http:'||child.protocol==='https:')return child.searchParams.get('mode')==='teacher';}catch{}
 return new URLSearchParams(params.get('query')||'').get('mode')==='teacher';
}
function syncPortrait(){
 const blocked=!isTeacherView()&&innerWidth>innerHeight;
 portraitGuard.hidden=!blocked;
 frame.inert=blocked;
 frame.setAttribute('aria-hidden',String(blocked));
}
async function requestPortrait(){
 if(isTeacherView())return;
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();await screen.orientation?.lock?.('portrait');}
 catch{document.querySelector('#portrait-status').textContent='浏览器未能自动旋转，请将设备转为竖屏。';}
 syncPortrait();
}
document.querySelector('#portrait-retry').onclick=requestPortrait;
frame.addEventListener('load',syncPortrait);
window.addEventListener('resize',syncPortrait);
window.addEventListener('orientationchange',syncPortrait);
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)void requestPortrait();else syncPortrait();});
syncPortrait();
