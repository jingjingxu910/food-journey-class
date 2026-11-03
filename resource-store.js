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
    if (item.path === 'resource-manifest.js' || item.path.startsWith('resource-chunks/')) return null;
    // Older versions used canonical URLs. Validate content before migrating them.
    for (const name of await (legacyNames || (legacyNames = caches.keys()))) {
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
  async function partialBytes(item) {
    if(!item.chunks)return 0;
    const cache=await caches.open(CACHE);let bytes=0;
    for(const chunk of item.chunks)if(await cache.match(key(chunk)))bytes+=chunk.bytes;
    return bytes;
  }
  async function assemble(item,{signal,onProgress}) {
    const joined=new Uint8Array(item.bytes);let offset=0;
    const cache=await caches.open(CACHE);
    for(const chunk of item.chunks){
      if(signal?.aborted)throw new DOMException('已暂停','AbortError');
      const response=await obtain(chunk,{signal,onProgress:n=>onProgress?.(offset+n,item.bytes)});
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length!==chunk.bytes || await digest(bytes)!==chunk.hash){await cache.delete(key(chunk));throw new Error('下载片段校验未通过，请重试');}
      joined.set(bytes,offset);offset+=bytes.length;onProgress?.(offset,item.bytes);
    }
    if(offset!==item.bytes || await digest(joined)!==item.hash){
      for(const chunk of item.chunks)await cache.delete(key(chunk));
      throw new Error('资源完整性校验未通过，请重试');
    }
    const ext=item.path.split('.').pop();
    const mime={js:'application/javascript',mjs:'application/javascript',wasm:'application/wasm',png:'image/png',jpg:'image/jpeg',webp:'image/webp',glb:'model/gltf-binary',mp4:'video/mp4'}[ext]||'application/octet-stream';
    const complete=new Response(joined,{headers:{'Content-Type':mime}});
    await cache.put(key(item),complete.clone());
    // Only remove fragments after the verified complete file is durable.
    for(const chunk of item.chunks)await cache.delete(key(chunk));
    return complete;
  }
  async function obtain(item, {signal,onProgress}={}) {
    const prior = await find(item);if(prior)return prior;
    if (inflight.has(item.path)) return (await inflight.get(item.path)).clone();
    const work = (async()=>{
      if(item.chunks?.length)return assemble(item,{signal,onProgress});
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
      const headers=new Headers(response.headers);if(item.path.endsWith('.mp4'))headers.set('Content-Type','video/mp4');
      const complete=new Response(data,{status:200,headers});
      await (await caches.open(CACHE)).put(key(item),complete.clone());return complete;
      }catch(error){if(request.signal.aborted&&!signal?.aborted)throw new Error(`下载长时间没有响应：${item.path}，请重试`);throw error;}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    })();
    inflight.set(item.path,work);
    try{return (await work).clone();}finally{inflight.delete(item.path);}
  }
  self.LessonResourceStore={CACHE,key,find,obtain,partialBytes};
})();
