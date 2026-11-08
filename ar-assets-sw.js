importScripts('./resource-manifest.js?v=20261109-cloud2','./resource-store.js?v=20261106-student-voice');
const ROOT=new URL('./',self.location.href);
const files=new Map(self.LESSON_RESOURCES.files.map(item=>[new URL(item.path,ROOT).href,item]));
async function withRange(response,range){
 if(!range)return response;
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);
 // Ignore unsupported multi-range requests and serve a complete representation.
 if(!match||(!match[1]&&!match[2]))return response;
 const data=await response.arrayBuffer(),length=data.byteLength;
 const start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
 const end=match[1]&&match[2]?Math.min(Number(match[2]),length-1):length-1;
 if(start>=length||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`}});
 const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${length}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(data.slice(start,end+1),{status:206,headers});
}
self.addEventListener('install',()=>self.skipWaiting());
// Never discard earlier downloads on activation. Valid unchanged files are migrated lazily.
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==ROOT.origin||url.searchParams.has('__lessonHash'))return;
 url.search='';url.hash='';if(url.pathname.endsWith('/'))url.pathname+='index.html';
 const item=files.get(url.href);if(!item)return;
 event.respondWith(self.LessonResourceStore.obtain(item).then(response=>withRange(response,event.request.headers.get('Range'))).catch(async error=>{
  const response=await fetch(event.request);if(response.ok)return response;throw error;
 }));
});
