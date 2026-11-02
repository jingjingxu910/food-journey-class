// Content-addressed public resources: updates reuse identical files across releases.
(() => {
  const CACHE = 'food-lesson-public-v1';
  const base = new URL('./', self.location.href);
  const key = item => {
    const url = new URL(item.path, base);
    url.searchParams.set('__lessonHash', item.hash);
    return url.href;
  };
  const digest = async data => [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const inflight = new Map();
  let legacyNames;
  async function find(item) {
    const cache = await caches.open(CACHE), current = await cache.match(key(item));
    if (current) return current;
    if (item.path === 'resource-manifest.js') return null;
    // Older versions used canonical URLs. Validate content before migrating them.
    for (const name of await (legacyNames ||= caches.keys())) {
      if (name === CACHE || !/^(food-lesson-|food-ar-assets-)/.test(name)) continue;
      const old = await (await caches.open(name)).match(new URL(item.path,base).href,{ignoreSearch:true});
      if (!old || !old.ok) continue;
      const data = await old.arrayBuffer();
      if (data.byteLength !== item.bytes || await digest(data) !== item.hash) continue;
      const migrated = new Response(data,{status:200,headers:old.headers});
      await cache.put(key(item),migrated.clone());return migrated;
    }
    return null;
  }
  async function obtain(item, {signal,onProgress}={}) {
    const prior = await find(item);if(prior)return prior;
    if (inflight.has(item.path)) return (await inflight.get(item.path)).clone();
    const work = (async()=>{
      const request=new AbortController(),cancel=()=>request.abort();signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)request.abort();
      let timer;const tick=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(),45000);};tick();
      try {
      const response = await fetch(key(item),{signal:request.signal,cache:'default'});
      if (!response.ok) throw new Error(`文件获取失败：${item.path}`);
      let data;
      if(response.body?.getReader){
        const reader=response.body.getReader(),chunks=[];let bytes=0;
        while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);bytes+=value.byteLength;tick();onProgress?.(bytes,item.bytes);}
        const joined=new Uint8Array(bytes);let offset=0;for(const part of chunks){joined.set(part,offset);offset+=part.byteLength;}data=joined.buffer;
      }else data=await response.arrayBuffer();
      if(item.path!=='resource-manifest.js' && (data.byteLength!==item.bytes || await digest(data)!==item.hash))throw new Error(`文件版本尚未更新：${item.path}，请稍后重试`);
      const complete=new Response(data,{status:200,headers:response.headers});
      await (await caches.open(CACHE)).put(key(item),complete.clone());return complete;
      }catch(error){if(request.signal.aborted&&!signal?.aborted)throw new Error(`下载长时间没有响应：${item.path}，请重试`);throw error;}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    })();
    inflight.set(item.path,work);
    try{return (await work).clone();}finally{inflight.delete(item.path);}
  }
  self.LessonResourceStore={CACHE,key,find,obtain};
})();
