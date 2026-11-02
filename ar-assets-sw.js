importScripts('./resource-manifest.js?v=20261102-esophagus-v10','./resource-store.js?v=20261031-3');
const ROOT=new URL('./',self.location.href);
const files=new Map(self.LESSON_RESOURCES.files.map(item=>[new URL(item.path,ROOT).href,item]));
self.addEventListener('install',()=>self.skipWaiting());
// Never discard earlier downloads on activation. Valid unchanged files are migrated lazily.
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==ROOT.origin||url.searchParams.has('__lessonHash'))return;
 url.search='';url.hash='';if(url.pathname.endsWith('/'))url.pathname+='index.html';
 const item=files.get(url.href);if(!item)return;
 event.respondWith(self.LessonResourceStore.obtain(item));
});
