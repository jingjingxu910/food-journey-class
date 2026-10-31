const $=s=>document.querySelector(s),resources=window.LESSON_RESOURCES;
const cacheName=`food-lesson-${resources.version}`,base=new URL('./',location.href);
const group=Math.max(1,Math.min(12,Number(new URLSearchParams(location.search).get('group'))||1));
$('#open-observation').href=`index.html?group=${group}`;
const mb=n=>(n/1048576).toFixed(1);
async function inspect(){
 if(!window.caches)return;
 const cache=await caches.open(cacheName);let count=0;
 for(const item of resources.files)if(await cache.match(new URL(item.path,base).href))count++;
 $('#bar').max=resources.files.length;$('#bar').value=count;
 $('#progress').textContent=count===resources.files.length?'本版本资源已备齐，可进入课堂。':`已备好 ${count}/${resources.files.length} 项，完整资源约 ${mb(resources.bytes)} MB。`;
}
$('#prepare').onclick=async()=>{
 $('#prepare').disabled=true;
 try{
  if(!('caches'in window)||!('serviceWorker'in navigator))throw new Error('请用 Chrome 或 Edge，通过 HTTPS 打开');
  await navigator.serviceWorker.register('./ar-assets-sw.js');await navigator.serviceWorker.ready;
  try{await navigator.storage?.persist?.();}catch{}
  const cache=await caches.open(cacheName);let count=0,bytes=0;const failed=[];
  for(const item of resources.files){
   const url=new URL(item.path,base).href;$('#progress').textContent=`下载资源 ${count+1}/${resources.files.length} · ${mb(bytes)} MB`;
   try{
    if(!await cache.match(url)){
     const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),60000);
     try{const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw new Error(item.path);await cache.put(url,response);}finally{clearTimeout(timer);}
    }
    bytes+=item.bytes;
   }catch{failed.push(item.path);}
   $('#bar').value=++count;
  }
  if(failed.length)throw new Error(`${failed.length} 项未完成，请重试；已完成文件会保留`);
  $('#progress').textContent=`已备齐 ${count} 项（${mb(bytes)} MB）。请进入课堂试用；断网时记录先保存在本机。`;
 }catch(error){$('#progress').textContent=`下载未完成：${error.message}`;}finally{$('#prepare').disabled=false;}
};
inspect().catch(()=>{$('#progress').textContent='暂时无法检查本机资源，请点击下载重试。';});
