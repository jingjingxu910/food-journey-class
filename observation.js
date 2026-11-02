import {BodyTracker,mapOverlay} from './ar-tracking.js';
import {groupId,currentRecord,saveRecord,submitRecord,homeUrl} from './student-data.js';
import {preparePoseResources} from './pose-resources.js';
const organs=[
 {id:'mouth',name:'口腔',question:'食物在这里怎样变小？',note:'牙齿咀嚼食物，舌帮助搅拌，唾液润湿食物。',feature:'局部模型：舌与上下颌牙龈。牙齿、嘴唇未包含在这个局部模型中。'},
 {id:'esophagus',name:'食管',question:'食物怎样沿着这条管道前进？',note:'食管连接咽和胃，管壁蠕动，把食物送向胃。',feature:'转动观察这条细长管道。'},
 {id:'stomach',name:'胃',question:'这个囊状器官与哪里相连？',note:'胃通过蠕动搅拌食物，食物与胃液混合，进一步消化。',feature:'观察胃的形状，以及入口和出口。'},
 {id:'small-intestine',name:'小肠',question:'为什么这条管道盘绕了这么多圈？',note:'小肠盘曲在腹部，是消化食物和吸收营养的主要场所。',feature:'观察小肠的整体形态。绒毛属于更小尺度的内壁结构。'},
 {id:'large-intestine',name:'大肠',question:'它与小肠的位置有什么关系？',note:'大肠围在小肠外侧，吸收食物残渣中的一部分水分。',feature:'与小肠比较粗细、盘曲方式和位置。'}
];
const $=s=>document.querySelector(s),asset=(id,ext)=>`assets/models/ar/${id}.${ext}`;
const tracker=new BodyTracker(),buttons=new Map(),displayed=new Map();
let record,observation,selected=null,selectedAt=0,stream,worker,mainDetector;
let frame=0,running=false,busy=false,hidden=false,dialogOpen=false,lastFrame=-1,lastSent=0,lastPose=0,targets=null;
let workerReady=false,starting=false,saveTimer,viewerDispose,viewerGeneration=0,captureWidth=384,interval=100,meanCost=0,lastPaint=0;
let startupController;
const metrics={samples:0,totalMs:0,maxMs:0,losses:0,mode:null};
$('#group-label').textContent=`第 ${groupId} 组`;$('#back-link').href=homeUrl();
$('.flow-fullscreen').onclick=()=>window.requestLessonFullscreen?.();
const status=message=>$('#observation-status').textContent=message;
function freshObservation(){return {startedAt:Date.now(),completedAt:null,views:[],local3dEntries:[],cameraStarted:false};}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(record)void saveRecord(record);},500);}
function closeSelected(){if(selected){const view=observation.views[observation.views.length-1];if(view&&view.organId===selected)view.durationMs=(view.durationMs||0)+Math.round(performance.now()-selectedAt);selectedAt=performance.now();}}
function renderList(){
 const seen=[...new Set(observation.views.map(v=>v.organId))];
 $('#organ-list').replaceChildren(...seen.map(id=>{const o=organs.find(o=>o.id===id);if(!o)return document.createElement('span');const b=document.createElement('button');b.type='button';b.className='is-seen';b.innerHTML=`<img src="${asset(id,'png')}" alt=""><span>${o.name}</span>`;b.onclick=()=>selectOrgan(id);return b;}));
}
function selectOrgan(id){
 if(!record)return;closeSelected();selected=id;selectedAt=performance.now();
 observation.views.push({organId:id,at:Date.now(),durationMs:0});observation.views=observation.views.slice(-120);
 const o=organs.find(o=>o.id===id);$('#organ-detail').hidden=false;
 $('#organ-detail').innerHTML=`<p class="organ-question">${o.question}</p><img src="${asset(id,'png')}" alt="${o.name}整体结构"><strong>${o.name}</strong><p>${o.note}</p>`;
 $('#open-local-3d').hidden=false;$('#open-local-3d').textContent=`转动观察${o.name}`;
 $('#finish-observation').disabled=!(observation.cameraStarted&&observation.views.length);
 for(const [key,b]of buttons)b.classList.toggle('is-selected',key===id);
 renderList();saveSoon();
}
for(const o of organs){const b=document.createElement('button');b.type='button';b.className='ar-organ';b.dataset.organ=o.id;b.setAttribute('aria-label',`观察${o.name}`);b.innerHTML=`<img src="${asset(o.id,'png')}" alt="" draggable="false">`;b.onclick=()=>selectOrgan(o.id);$('#ar-organs').append(b);buttons.set(o.id,b);}
$('#ar-organs').hidden=true;
function receivePose(data){
 busy=false;if(!running||hidden||dialogOpen)return;
 metrics.samples++;metrics.totalMs+=data.costMs;metrics.maxMs=Math.max(metrics.maxMs,data.costMs);
 meanCost=meanCost?meanCost*.85+data.costMs*.15:data.costMs;
 interval=Math.min(220,Math.max(66,meanCost*1.25));captureWidth=meanCost>95?320:384;
 const body=tracker.update(data.points,data.timestamp,$('#camera-video').videoWidth/$('#camera-video').videoHeight);
 if(body){targets=body;lastPose=performance.now();$('#camera-status').textContent='点击身体上的器官，仔细观察';}
 else{targets=null;metrics.losses++;$('#ar-organs').hidden=true;$('#camera-status').textContent='请面向镜头，让肩部和腰部都进入画面';}
 if(new URLSearchParams(location.search).has('diagnostics'))$('#ar-metrics').textContent=`识别上限 ${(1000/Math.max(interval,meanCost)).toFixed(1)} 次/秒 · 平均 ${Math.round(meanCost)} ms · ${metrics.mode}${data.delegate?' / '+data.delegate:''}`;
}
function waitStartup(promise,ms,label,onLate){
 const signal=startupController.signal;
 return new Promise((resolve,reject)=>{
  let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);error?reject(error):resolve(value);};
  const cancel=()=>finish(new DOMException('已取消','AbortError'));
  const timer=setTimeout(()=>finish(new Error(label)),ms);
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  promise.then(value=>{if(settled)onLate?.(value);else finish(null,value);},error=>finish(error));
 });
}
async function initMainDetector(){
 const {FilesetResolver,PoseLandmarker}=await import('./vendor/package/vision_bundle.mjs');
 const wasm=await FilesetResolver.forVisionTasks(new URL('./vendor/package/wasm',location.href).href);
 const creation=PoseLandmarker.createFromOptions(wasm,{baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_lite.task',location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.65});
 mainDetector=await waitStartup(creation,30000,'人体识别初始化超时，请重新开启',detector=>detector.close());
 if(startupController?.signal.aborted){mainDetector?.close();mainDetector=null;throw new DOMException('已取消','AbortError');}metrics.mode='main';interval=160;
}
async function initDetector(){
 if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||!window.createImageBitmap)return initMainDetector();
 try{
  worker=new Worker(new URL('./ar-pose-worker.js',import.meta.url));
  await new Promise((resolve,reject)=>{
   const signal=startupController.signal;
   const done=(error)=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);error?reject(error):resolve();};
   const cancel=()=>done(new DOMException('已取消','AbortError'));
   const timer=setTimeout(()=>done(new Error('后台识别启动超时')),35000);
   signal.addEventListener('abort',cancel,{once:true});
   worker.onmessage=({data})=>{if(data.type==='progress')$('#camera-status').textContent=data.message;
    else if(data.type==='ready'){workerReady=true;done();}else if(data.type==='error')done(new Error(data.message));};
   worker.onerror=e=>done(new Error(e.message||'后台识别不可用'));worker.postMessage({type:'init'});
  });
  metrics.mode='worker';worker.onmessage=({data})=>{if(data.type==='pose')receivePose(data);else if(data.type==='error'){busy=false;stopCamera();$('#camera-status').textContent='人体识别中断，请重新开启相机';}};
 }catch(error){worker?.terminate();worker=null;workerReady=false;if(startupController.signal.aborted)throw error;$('#camera-status').textContent='正在切换兼容识别模式…';console.info('Using compatible pose mode',error.message);await initMainDetector();}
}
async function sendFrame(now){
 const video=$('#camera-video');if(busy||video.readyState<2||video.currentTime===lastFrame)return;
 busy=true;lastFrame=video.currentTime;lastSent=now;
 if(workerReady){try{const bitmap=await createImageBitmap(video,{resizeWidth:captureWidth,resizeHeight:Math.round(captureWidth*video.videoHeight/video.videoWidth),resizeQuality:'low'});if(!running||!worker){bitmap.close();busy=false;return;}worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);}catch(error){busy=false;console.warn('Camera frame skipped',error);}}
 else if(mainDetector){const start=performance.now();try{const result=mainDetector.detectForVideo(video,now);receivePose({points:result.landmarks?.[0]||null,timestamp:now,costMs:performance.now()-start});}catch(error){busy=false;console.warn('Pose frame skipped',error);}}
}
function paint(now){
 if(!running)return;frame=requestAnimationFrame(paint);if(hidden||dialogOpen)return;
 const video=$('#camera-video'),stage=$('#camera-stage'),age=now-lastPose;
 if(targets&&age<Math.min(600,Math.max(280,interval+meanCost+80))){$('#ar-organs').hidden=false;const alpha=1-Math.exp(-Math.min(60,now-lastPaint)/38);
  for(const [id,b]of buttons){const point=targets[id];b.hidden=!point;if(!point)continue;const next=mapOverlay(point,stage.clientWidth,stage.clientHeight,video.videoWidth,video.videoHeight),prior=displayed.get(id);
   if(prior)for(const key of ['x','y','w','h','angle'])next[key]=prior[key]+(next[key]-prior[key])*alpha;
   displayed.set(id,next);b.style.width=`${next.w}px`;b.style.height=`${next.h}px`;b.style.transform=`translate3d(${next.x-next.w/2}px,${next.y-next.h/2}px,0) rotate(${next.angle}rad)`;
  }
 }else{$('#ar-organs').hidden=true;if(age>800&&lastPose)$('#camera-status').textContent='请面向镜头，让肩部和腰部都进入画面';}
 lastPaint=now;if(busy && now-lastSent>15000){stopCamera();$('#camera-status').textContent='识别暂时没有响应，请重新开启相机';return;}
 lastPaint=now;if(now-lastSent>=interval)void sendFrame(now);
}
function stopCamera(){running=false;cancelAnimationFrame(frame);worker?.terminate();worker=null;workerReady=false;mainDetector?.close();mainDetector=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera-video').srcObject=null;$('#ar-organs').hidden=true;targets=null;busy=false;tracker.reset();displayed.clear();$('#start-camera').disabled=false;$('#start-camera').textContent='开启后置相机';}
async function startCamera(){
 if(starting||running||!record)return;starting=true;startupController=new AbortController();$('#cancel-camera').hidden=false;$('#start-camera').disabled=true;
 try{$('#camera-status').textContent='正在开启后置相机…';if(!navigator.mediaDevices?.getUserMedia)throw new Error('请使用支持网页相机的浏览器，并通过 HTTPS 打开课件');
  stream=await waitStartup(navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:'environment'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}}),45000,'相机开启等待较久，请检查浏览器相机权限',late=>late.getTracks().forEach(t=>t.stop()));
  if(startupController.signal.aborted){stream.getTracks().forEach(t=>t.stop());throw new DOMException('已取消','AbortError');}
  $('#camera-video').srcObject=stream;await waitStartup($('#camera-video').play(),15000,'相机画面未就绪，请重新开启');$('#camera-placeholder').hidden=true;
  $('#camera-status').textContent='正在检查本机人体识别资源…';
  await preparePoseResources(startupController.signal,message=>{$('#camera-status').textContent=message;});
  if(startupController.signal.aborted)throw new DOMException('已取消','AbortError');
  $('#camera-status').textContent='资源已就绪，正在启动人体识别…';await initDetector();
  if(startupController.signal.aborted)throw new DOMException('已取消','AbortError');
  running=true;observation.cameraStarted=true;observation.cameraFacing='environment';saveSoon();$('#start-camera').textContent='相机已开启';$('#camera-status').textContent='请面向镜头，让肩部和腰部都进入画面';lastPose=0;lastSent=0;lastFrame=-1;frame=requestAnimationFrame(paint);
 }catch(error){stopCamera();$('#camera-status').textContent=error.name==='AbortError'?'已取消开启，下载完成的资源已保留':error.name==='NotAllowedError'?'请允许浏览器使用相机':error.name==='NotFoundError'?'未检测到相机。请在有后置相机的平板上用 Chrome 或 Edge 打开':error.name==='NotReadableError'?'相机暂时无法使用，请关闭其他正在使用相机的应用后重试':error.name==='OverconstrainedError'?'没有找到可用的后置相机':`开启未完成：${error.message}`;$('#start-camera').textContent='重新开启';}finally{starting=false;$('#cancel-camera').hidden=true;}
}
async function openViewer(){
 if(!selected)return;closeSelected();const id=selected,o=organs.find(o=>o.id===id),generation=++viewerGeneration;
 observation.local3dEntries.push({organId:id,at:Date.now()});observation.local3dEntries=observation.local3dEntries.slice(-120);saveSoon();dialogOpen=true;$('#ar-organs').hidden=true;$('#organ-dialog-title').textContent=o.name;$('#organ-dialog-note').textContent=o.feature;$('#organ-dialog').showModal();
 const mount=$('#organ-3d');mount.textContent='正在准备模型…';
 try{const {createOrganViewer}=await import('./ar-organ-viewer.js');const dispose=await createOrganViewer(mount,asset(id,'glb'),$('#reset-organ-view'),()=>generation===viewerGeneration&&$('#organ-dialog').open);if(generation!==viewerGeneration){dispose?.();return;}viewerDispose=dispose;}
 catch(error){if(generation===viewerGeneration)mount.innerHTML=`<img class="model-fallback-image" src="${asset(id,'png')}" alt="${o.name}"><p>模型加载未完成，请关闭后重试。</p>`;console.warn('Organ model failed',error);}
}
async function finishObservation(){if(!observation.cameraStarted||!observation.views.length)return;$('#finish-observation').disabled=true;closeSelected();selected=null;stopCamera();observation.completedAt=Date.now();observation.performance={...metrics,averageMs:metrics.samples?Math.round(metrics.totalMs/metrics.samples):null};status('正在保存…');const uploaded=await submitRecord(record);status(uploaded?'观察完成。':'已保存到本机，联网后可重试提交。');$('#finish-observation').disabled=false;$('#finish-observation').textContent='去修正模型 →';$('#finish-observation').onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;}
$('#cancel-camera').onclick=()=>{startupController?.abort();stopCamera();$('#camera-status').textContent='已取消开启，下载完成的资源已保留';};
$('#start-camera').onclick=startCamera;$('#open-local-3d').onclick=openViewer;$('#close-organ-dialog').onclick=()=>$('#organ-dialog').close();
$('#organ-dialog').addEventListener('close',()=>{viewerGeneration++;viewerDispose?.();viewerDispose=null;dialogOpen=false;selectedAt=performance.now();tracker.reset();targets=null;});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden)closeSelected();else{selectedAt=performance.now();targets=null;tracker.reset();}});
window.addEventListener('pagehide',()=>{startupController?.abort();closeSelected();clearTimeout(saveTimer);if(record)void saveRecord(record);stopCamera();viewerDispose?.();});
async function initialize(){
 $('#start-camera').disabled=true;$('#camera-status').textContent='正在读取本组记录…';
 let timer;try{record=await Promise.race([currentRecord(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('本组记录读取超时')),8000);})]);}finally{clearTimeout(timer);}
 $('#camera-status').textContent='等待开启';$('#start-camera').textContent='开启后置相机';$('#start-camera').onclick=startCamera;observation=record.observation||freshObservation();record.observation=observation;renderList();$('#start-camera').disabled=false;if(observation.completedAt){$('#finish-observation').disabled=false;$('#finish-observation').textContent='去修正模型 →';$('#finish-observation').onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;}else $('#finish-observation').onclick=finishObservation;}
function initializeOrRetry(){initialize().catch(error=>{status(`记录暂时无法读取：${error.message}`);$('#camera-status').textContent='页面准备未完成，请重试';$('#start-camera').disabled=false;$('#start-camera').textContent='重试准备';$('#start-camera').onclick=initializeOrRetry;});}
initializeOrRetry();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./ar-assets-sw.js').catch(error=>console.info('Resource cache unavailable',error));
