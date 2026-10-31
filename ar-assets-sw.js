// Only public lesson files, never CloudBase requests, camera frames or records.
importScripts('./resource-manifest.js?v=20261031-2');
const CACHE=`food-lesson-${self.LESSON_RESOURCES.version}`;
const ROOT=new URL('./',self.location.href);
const ALLOWED=new Set(self.LESSON_RESOURCES.files.map(item=>new URL(item.path,ROOT).href));
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 for(const key of await caches.keys())if((key.startsWith('food-lesson-')||key.startsWith('food-ar-assets-'))&&key!==CACHE)await caches.delete(key);
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==ROOT.origin)return;
 url.search='';url.hash='';if(url.pathname.endsWith('/'))url.pathname+='index.html';
 if(!ALLOWED.has(url.href))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),prior=await cache.match(url.href);if(prior)return prior;
  const response=await fetch(event.request);if(response.ok&&response.type!=='opaque')await cache.put(url.href,response.clone());return response;
 })());
});
