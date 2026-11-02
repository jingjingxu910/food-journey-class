import './resource-manifest.js';
import './resource-store.js';
import {selectedResources} from './resource-selection.js';
// Fetch the selected WASM implementation only; preparation is reusable by the download screen.
export async function preparePoseResources(signal,report){
 const files=(await selectedResources('ar')).filter(x=>x.path.startsWith('vendor/package/')||x.path==='vendor/pose_landmarker_lite.task');
 const store=window.LessonResourceStore;const mb=n=>(n/1048576).toFixed(1);
 for(const item of files){
  if(signal.aborted)throw new DOMException('已取消','AbortError');
  if(await store.find(item))continue;
  const label=item.path.endsWith('.task')?'人体识别模型':item.path.endsWith('.wasm')?'人体识别运行资源':'人体识别程序';
  const request=new AbortController();const cancel=()=>request.abort();signal.addEventListener('abort',cancel,{once:true});let timer;
  const tick=()=>{clearTimeout(timer);timer=setTimeout(()=>request.abort(),45000);};tick();
  try{report(`正在准备${label} · 0 / ${mb(item.bytes)} MB`);await store.obtain(item,{signal:request.signal,onProgress:bytes=>{tick();report(`正在准备${label} · ${mb(bytes)} / ${mb(item.bytes)} MB`);}});}
  catch(error){if(!signal.aborted&&request.signal.aborted)throw new Error('识别资源下载暂时中断。已完成的文件会保留，请重新开启');throw error;}
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
 }
}
