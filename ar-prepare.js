import './resource-store.js';
import {selectedResources} from './resource-selection.js';
const $=s=>document.querySelector(s),store=window.LessonResourceStore;
const group=Math.max(1,Math.min(12,Number(new URLSearchParams(location.search).get('group'))||1));
$('#open-observation').href=`index.html?group=${group}`;
const mb=n=>(n/1048576).toFixed(1);let controller,working=false;
const first=document.createElement('button');first.id='prepare-ar';first.className='flow-primary';first.textContent='先准备人体识别';first.style.marginRight='12px';$('#prepare').before(first);
const pause=document.createElement('button');pause.textContent='暂停';pause.hidden=true;pause.style.marginLeft='12px';$('#prepare').after(pause);
const fileStatus=document.createElement('p');fileStatus.setAttribute('role','status');$('#bar').after(fileStatus);
$('#prepare').textContent='准备完整课件';
function label(item){if(item.path.endsWith('.wasm'))return '人体识别运行资源';if(item.path.endsWith('.task'))return '人体识别模型';return item.path;}
async function inspection(items){let count=0,bytes=0;const missing=[];for(const item of items){if(await store.find(item)){count++;bytes+=item.bytes;}else missing.push(item);}return{count,bytes,missing};}
function show(result,items){$('#bar').max=items.length;$('#bar').value=result.count;$('#progress').textContent=`已备好 ${result.count}/${items.length} 项 · ${mb(result.bytes)} / ${mb(items.reduce((n,x)=>n+x.bytes,0))} MB`;}
async function prepare(kind){
 if(working)return;working=true;controller=new AbortController();$('#prepare').disabled=first.disabled=true;pause.hidden=false;
 try{
  if(!store||!('serviceWorker'in navigator))throw new Error('请用 Chrome 或 Edge，通过 HTTPS 打开');
  fileStatus.textContent='正在检查本机已有文件…';
  const items=await selectedResources(kind),result=await inspection(items);show(result,items);
  await navigator.serviceWorker.register('./ar-assets-sw.js',{updateViaCache:'none'});
  try{await navigator.storage?.persist?.();}catch{}
  let next=0;const active=new Map();
  const update=()=>{fileStatus.textContent=`正在下载 ${active.size} 项 · 已接收 ${mb([...active.values()].reduce((n,v)=>n+v,0))} MB`;};
  async function download(){
   while(next<result.missing.length){
    if(controller.signal.aborted)throw new DOMException('已暂停','AbortError');
    const item=result.missing[next++];active.set(item.path,0);
    for(let attempt=0;;attempt++){
     try{await store.obtain(item,{signal:controller.signal,onProgress:bytes=>{active.set(item.path,bytes);update();}});break;}
     catch(error){if(controller.signal.aborted||attempt>=1)throw error;fileStatus.textContent=`正在重试：${label(item)}`;}
    }
    active.delete(item.path);result.count++;result.bytes+=item.bytes;show(result,items);
   }
  }
  const results=await Promise.allSettled([download(),download()]);
  const failed=results.find(x=>x.status==='rejected');if(failed)throw failed.reason;
  $('#progress').textContent=`${kind==='ar'?'人体识别所需资源':'本版本课堂资源'}已备齐，共 ${items.length} 项。`;
  fileStatus.textContent='已保存到这个浏览器，可进入课堂。';
 }catch(error){fileStatus.textContent=error.name==='AbortError'?'已暂停。完成的文件已保留，下次继续。':`准备未完成：${error.message}。完成的文件已保留。`;}
 finally{working=false;$('#prepare').disabled=first.disabled=false;pause.hidden=true;}
}
$('#prepare').onclick=()=>prepare('all');first.onclick=()=>prepare('ar');pause.onclick=()=>controller?.abort();
selectedResources('all').then(async items=>show(await inspection(items),items)).catch(()=>{$('#progress').textContent='点击准备，检查并继续下载。';});
