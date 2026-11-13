import {organSegments} from './ar-media-segments.js';
const isPreview=new URLSearchParams(location.search).get('preview')==='1';
import {CameraMotion} from './ar-motion.js';
import {BodyTracker,mapOverlay} from './ar-tracking.js';
import {groupId,currentRecord,saveRecord,submitRecord,homeUrl} from './student-data.js?v=20261109-ui3';
const organs=[
 {id:'mouth',name:'口腔',question:'食物在这里怎样变小？',note:'牙齿咀嚼食物，舌帮助搅拌，唾液润湿食物。',feature:'转动、放大观察牙齿、牙龈和舌。'},
 {id:'esophagus',name:'食管',question:'食物怎样沿着这条管道前进？',note:'食管连接咽和胃，管壁蠕动，把食物送向胃。',feature:'转动观察这条细长管道。'},
 {id:'stomach',name:'胃',question:'这个囊状器官与哪里相连？',note:'胃通过蠕动搅拌食物，食物与胃液混合，进一步消化。',feature:'观察胃的形状，以及入口和出口。'},
 {id:'small-intestine',name:'小肠',question:'为什么这条管道盘绕了这么多圈？',note:'小肠盘曲在腹部，是消化食物和吸收营养的主要场所。',feature:'观察小肠的整体形态。绒毛属于更小尺度的内壁结构。'},
 {id:'large-intestine',name:'大肠',question:'它与小肠的位置有什么关系？',note:'大肠围在小肠外侧，吸收食物残渣中的一部分水分。',feature:'与小肠比较粗细、盘曲方式和位置。'}
];
for(const [id,name,note] of [['nasal-cavity','鼻腔','观察鼻腔与鼻咽的结构。'],['trachea','气管','气管在食管前方，把空气送向肺。'],['right-lung','右肺','肺参与气体交换。食物正常情况下不进入气管和肺。'],['left-lung','左肺','观察肺和消化器官的空间关系。'],['pharynx','咽','咽是空气和食物共同经过的部位。']])organs.push({id,name,question:'转动观察它与食管的位置关系。',note,feature:note});
for(const [id,name]of [['liver','肝'],['pancreas','胰'],['gallbladder','胆囊'],['heart','心脏'],['submandibular','下颌下腺'],['left-kidney','左肾'],['right-kidney','右肾'],['bladder','膀胱']])organs.push({id,name,question:'观察它与周围器官的位置关系。',feature:'转动放大观察形态与空间关系。',note:'比较外形、位置及局部结构。'});
const $=s=>document.querySelector(s),asset=(id,ext)=>id==='mouth'&&ext==='glb'?'assets/models/ar-detail/mouth-antipov.glb':`assets/models/${ext==='glb'?(id==='large-intestine'&&(!isPreview||window.__previewColonVariant!=='hra')?'ar-connected':['mouth','small-intestine','large-intestine','liver','pancreas'].includes(id)?'ar-detail':'ar-connected'):'ar'}/${id}.${ext}`;
const tracker=new BodyTracker(),buttons=new Map(),displayed=new Map();
const inferenceCanvas=document.createElement('canvas');
const inferenceContext=inferenceCanvas.getContext('2d');
let record,observation,selected=null,selectedAt=0,stream,worker,mainDetector,observationSubmitting=false;
let frame=0,running=false,busy=false,hidden=false,dialogOpen=false,lastFrame=-1,lastSent=0,lastPose=0,targets=null;
let workerReady=false,starting=false,saveTimer,viewerDispose,viewerGeneration=0,captureWidth=384,interval=100,meanCost=0,lastPaint=0;
let startupController,connected;const motion=new CameraMotion();let sentMotion=null,targetMotion=null;
const metrics={samples:0,totalMs:0,maxMs:0,losses:0,mode:null};
$('#group-label').textContent=`第 ${groupId} 组`;$('#back-link').href=homeUrl();
$('.flow-fullscreen').onclick=()=>window.requestLessonFullscreen?.();
new ResizeObserver(()=>{if(observation)renderList();}).observe($('#camera-stage'));
const status=message=>$('#observation-status').textContent=message;
function freshObservation(){return {startedAt:Date.now(),completedAt:null,views:[],local3dEntries:[],cameraStarted:false};}
function saveSoon(){if(isPreview)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(record)void saveRecord(record);},500);}
function closeSelected(){if(selected){const view=observation.views[observation.views.length-1];if(view&&view.organId===selected)view.durationMs=(view.durationMs||0)+Math.round(performance.now()-selectedAt);selectedAt=performance.now();}}
function renderList(){
 const seen=[...new Set(observation.views.map(v=>v.organId))];
 const columns=$('#camera-stage').clientWidth>=600?6:4;$('#organ-list').style.gridTemplateColumns=`repeat(${columns},minmax(0,1fr))`;$('#organ-list').style.gridTemplateRows=`repeat(${Math.max(1,Math.ceil(seen.length/columns))},minmax(0,1fr))`;const trayHeight=Math.min(Math.ceil(seen.length/columns)*44,$('#camera-stage').clientHeight*.24);$('.observe-panel').style.height=`${trayHeight}px`;$('#camera-stage').style.setProperty('--ar-tray-height',`${trayHeight}px`);$('#organ-list').replaceChildren(...seen.map(id=>{const o=organs.find(o=>o.id===id);if(!o)return document.createElement('span');const b=document.createElement('button');b.type='button';b.className='is-seen';b.innerHTML=`<img src="assets/models/ar-thumbnails/${id}.png" alt=""><span>${o.name}</span>`;b.onclick=()=>selectOrgan(id);return b;}));
}
function selectOrgan(id){
 if(!record)return;closeSelected();selected=id;selectedAt=performance.now();
 observation.views.push({organId:id,at:Date.now(),durationMs:0});observation.views=observation.views.slice(-120);
 const o=organs.find(o=>o.id===id);if(!o)return;connected?.select(id);$('.observe-panel').hidden=false;$('#organ-detail').hidden=false;
 $('#organ-detail').innerHTML=`<p class="organ-question">${o.question}</p>${["mouth","nasal-cavity","trachea","right-lung","left-lung","pharynx","liver","pancreas","gallbladder","heart","submandibular","left-kidney","right-kidney","spleen","bladder"].includes(id)?"":`<img src="${asset(id,'png')}" alt="${o.name}整体结构">`}<strong>${o.name}</strong><p>${o.note}</p>`;
 $('#open-local-3d').hidden=false;$('#open-local-3d').textContent=`转动观察${o.name}`;
 $('#finish-observation').disabled=!(observation.cameraStarted&&observation.views.length);
 for(const [key,b]of buttons)b.classList.toggle('is-selected',key===id);
 renderList();saveSoon();void openViewer();
}
for(const o of organs.filter(o=>['mouth','esophagus','stomach','small-intestine','large-intestine'].includes(o.id))){const b=document.createElement('button');b.type='button';b.className='ar-organ';b.dataset.organ=o.id;b.setAttribute('aria-label',`观察${o.name}`);b.innerHTML=`<img src="${asset(o.id,'png')}" alt="" draggable="false">`;b.onclick=()=>selectOrgan(o.id);$('#ar-organs').append(b);buttons.set(o.id,b);}
$('#ar-organs').hidden=true;
function receivePose(data){
 busy=false;if(!running||hidden)return;
 metrics.samples++;metrics.totalMs+=data.costMs;metrics.maxMs=Math.max(metrics.maxMs,data.costMs);
 meanCost=meanCost?meanCost*.85+data.costMs*.15:data.costMs;
 interval=Math.min(220,Math.max(66,meanCost*1.25));captureWidth=meanCost>95?320:384;
 // Only compensate for camera translation when both frames share a reliable reference.
 const matched=sentMotion?.sequence===motion.sequence;
 const video=$('#camera-video');
 if(!sentMotion||sentMotion.sceneRevision!==motion.sceneRevision||sentMotion.width!==video.videoWidth||sentMotion.height!==video.videoHeight||
    performance.now()-data.timestamp>trackingHold())return;
 let points=data.points;if(points&&matched){const dx=motion.x-sentMotion.x,dy=motion.y-sentMotion.y;points=points.map(p=>({...p,x:p.x+dx,y:p.y+dy}));}
 if(targetMotion?.sequence===motion.sequence)tracker.shift(motion.x-targetMotion.x,motion.y-targetMotion.y);
 const body=tracker.update(points,data.timestamp,$('#camera-video').videoWidth/$('#camera-video').videoHeight,data.worldPoints);
 if(body){motion.setRegion(points);targets=body;lastPose=performance.now();targetMotion={...motion.snapshot(),width:video.videoWidth,height:video.videoHeight};$('#camera-status').textContent='点击身体上的器官，仔细观察';}
 else{metrics.losses++;}
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
 }catch(error){worker?.terminate();worker=null;workerReady=false;if(startupController.signal.aborted)throw error;$('#camera-status').textContent='正在准备相机…';console.info('Using compatible pose mode',error.message);await initMainDetector();}
}
async function sendFrame(now){
 const video=$('#camera-video');if(busy||video.readyState<2||video.currentTime===lastFrame)return;
 busy=true;sentMotion={...motion.snapshot(),width:video.videoWidth,height:video.videoHeight};lastFrame=video.currentTime;lastSent=now;
 if(workerReady){try{const bitmap=await createImageBitmap(video,{resizeWidth:captureWidth,resizeHeight:Math.round(captureWidth*video.videoHeight/video.videoWidth),resizeQuality:'low'});if(!running||!worker){bitmap.close();busy=false;return;}worker.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);}catch(error){busy=false;console.warn('Camera frame skipped',error);}}
 else if(mainDetector){const start=performance.now();try{
  const height=Math.max(1,Math.round(captureWidth*video.videoHeight/video.videoWidth));
  if(inferenceCanvas.width!==captureWidth||inferenceCanvas.height!==height){inferenceCanvas.width=captureWidth;inferenceCanvas.height=height;}
  inferenceContext.drawImage(video,0,0,captureWidth,height);
  const result=mainDetector.detectForVideo(inferenceCanvas,now);receivePose({points:result.landmarks?.[0]||null,worldPoints:result.worldLandmarks?.[0]||null,timestamp:now,costMs:performance.now()-start});
 }catch(error){busy=false;console.warn('Pose frame skipped',error);}}
}
function trackingHold(){
 return Math.min(1200,Math.max(650,interval+meanCost*2+100));
}
function paint(now){
 if(!running)return;frame=requestAnimationFrame(paint);if(hidden||now-lastPaint<30)return;
 const video=$('#camera-video'),stage=$('#camera-stage'),age=now-lastPose;motion.update(video,now);
 const coherent=targetMotion?.sequence===motion.sequence;
 // A missed inference or a low-texture image must not immediately hide the body.
 const visible=targets&&age<trackingHold()&&targetMotion.sceneRevision===motion.sceneRevision&&targetMotion.width===video.videoWidth&&targetMotion.height===video.videoHeight;
 if(targets&&!visible){targets=null;tracker.reset();displayed.clear();}
 const currentTargets=targets?Object.fromEntries(Object.entries(targets).map(([id,p])=>[id,{...p,x:p.x+(coherent&&motion.reliable?motion.x-targetMotion.x:0),y:p.y+(coherent&&motion.reliable?motion.y-targetMotion.y:0)}])):null;
 if(visible){$('#ar-organs').hidden=false;connected?.update(mapOverlay(currentTargets.esophagus,stage.clientWidth,stage.clientHeight,video.videoWidth,video.videoHeight));updateLinks();const alpha=1-Math.exp(-Math.min(60,now-lastPaint)/38);
  for(const [id,b]of buttons){const point=currentTargets[id];b.hidden=!point;if(!point)continue;const next=mapOverlay(point,stage.clientWidth,stage.clientHeight,video.videoWidth,video.videoHeight),prior=displayed.get(id);
   if(prior)for(const key of ['x','y','w','h','angle'])next[key]=prior[key]+(next[key]-prior[key])*alpha;
   displayed.set(id,next);b.style.width=`${next.w}px`;b.style.height=`${next.h}px`;b.style.transform=`translate3d(${next.x-next.w/2}px,${next.y-next.h/2}px,0) rotate(${next.angle}rad)`;
  }
 }else{connected?.update(null);updateLinks();$('#ar-organs').hidden=true;if(lastPose&&!targets)$('#camera-status').textContent='请面向镜头，让肩部和腰部都进入画面';}
 lastPaint=now;if(busy && now-lastSent>15000){stopCamera();$('#camera-status').textContent='识别暂时没有响应，请重新开启相机';return;}
 lastPaint=now;if(now-lastSent>=interval)void sendFrame(now);
}
function stopCamera(){connected?.update(null);running=false;cancelAnimationFrame(frame);worker?.terminate();worker=null;workerReady=false;mainDetector?.close();mainDetector=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('#camera-video').srcObject=null;$('#ar-organs').hidden=true;targets=null;busy=false;tracker.reset();displayed.clear();motion.reset();targetMotion=null;$('#start-camera').disabled=false;$('#start-camera').textContent='开启后置相机';}
async function startCamera(){
 if(starting||running||!record)return;starting=true;startupController=new AbortController();$('#cancel-camera').hidden=false;$('#start-camera').disabled=true;
 try{$('#camera-status').textContent='正在开启后置相机…';if(!navigator.mediaDevices?.getUserMedia)throw new Error('请使用支持网页相机的浏览器，并通过 HTTPS 打开课件');
  stream=await waitStartup(navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:'environment'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}}),45000,'相机开启等待较久，请检查浏览器相机权限',late=>late.getTracks().forEach(t=>t.stop()));
  if(startupController.signal.aborted){stream.getTracks().forEach(t=>t.stop());throw new DOMException('已取消','AbortError');}
  $('#camera-video').srcObject=stream;await waitStartup($('#camera-video').play(),15000,'相机画面未就绪，请重新开启');$('#camera-placeholder').hidden=true;
  $('#camera-status').textContent='正在准备观察…';
  const {preparePoseResources}=await waitStartup(import('./pose-resources.js'),30000,'识别资源程序未加载完成，请检查网络后重试');
  await preparePoseResources(startupController.signal,message=>{$('#camera-status').textContent=message;});
  if(startupController.signal.aborted)throw new DOMException('已取消','AbortError');
  $('#camera-status').textContent='正在准备整套解剖模型…';
  if(!connected){const {createConnectedOverlay}=await import('./ar-connected.js');connected=await waitStartup(createConnectedOverlay($('#anatomy-overlay'),selectOrgan),45000,'解剖模型加载未完成，请重试',late=>late.dispose());}
  $('#camera-status').textContent='请站到镜头前。';await initDetector();
  if(startupController.signal.aborted)throw new DOMException('已取消','AbortError');
  running=true;observation.cameraStarted=true;observation.cameraFacing='environment';saveSoon();$('#start-camera').textContent='相机已开启';$('#camera-status').textContent='请面向镜头，让肩部和腰部都进入画面';lastPose=0;lastSent=0;lastFrame=-1;frame=requestAnimationFrame(paint);
 }catch(error){stopCamera();$('#camera-status').textContent=error.name==='AbortError'?'已取消开启，下载完成的资源已保留':error.name==='NotAllowedError'?'请允许浏览器使用相机':error.name==='NotFoundError'?'未检测到相机。请在有后置相机的平板上用 Chrome 或 Edge 打开':error.name==='NotReadableError'?'相机暂时无法使用，请关闭其他正在使用相机的应用后重试':error.name==='OverconstrainedError'?'没有找到可用的后置相机':`开启未完成：${error.message}`;$('#start-camera').textContent='重新开启';}finally{starting=false;$('#cancel-camera').hidden=true;}
}
async function openViewer(){
 if(!selected)return;viewerDispose?.();viewerDispose=null;processStop?.();closeSelected();const id=selected,o=organs.find(o=>o.id===id),generation=++viewerGeneration;
 observation.local3dEntries.push({organId:id,at:Date.now()});observation.local3dEntries=observation.local3dEntries.slice(-120);saveSoon();dialogOpen=true;stopMedia();$('#show-organ-media').hidden=!organSegments[id];$('#show-organ-media').textContent='科普短片';$('#ar-organs').hidden=true;$('#organ-dialog-title').textContent=o.name;$('#organ-dialog-note').textContent=o.feature;$('#organ-process').hidden=true;$('#organ-3d').hidden=false;$('#organ-dialog footer').hidden=false;$('#show-organ-process').hidden=['liver','pancreas','gallbladder','heart','submandibular','left-kidney','right-kidney','spleen','bladder'].includes(id);$('#organ-dialog').show();queueMicrotask(()=>{showCandidateMedia();});
 const credit=$('#organ-model-credit');credit.textContent=['small-intestine','large-intestine','liver','pancreas'].includes(id)?'模型：Human Reference Atlas / HuBMAP · CC BY 4.0':id==='mouth'?'模型：Alexander Antipov · CC BY 4.0':['right-lung','left-lung'].includes(id)?'模型：Human Reference Atlas · Kristen Browne、Heidi Schlehlein · CC BY 4.0':id==='pharynx'?'模型：BodyParts3D / OrganUI · CC BY-SA 2.1 Japan':'模型：BodyParts3D · DBCLS · CC BY 4.0';
 const mount=$('#organ-3d');mount.textContent='正在准备模型…';


 try{const {createOrganViewer}=await import('./ar-organ-viewer.js');const dispose=await createOrganViewer(mount,asset(id,'glb'),$('#reset-organ-view'),()=>generation===viewerGeneration&&$('#organ-dialog').open,id==='mouth'?{initialRotation:[.35,-.18,0]}:{});if(generation!==viewerGeneration){dispose?.();return;}viewerDispose=dispose;}
 catch(error){if(generation===viewerGeneration)mount.innerHTML=`<img class="model-fallback-image" src="${asset(id,'png')}" alt="${o.name}"><p>模型加载未完成，请关闭后重试。</p>`;console.warn('Organ model failed',error);}
}
async function finishObservation(){
 if(observationSubmitting||!observation.cameraStarted||!observation.views.length)return;
 observationSubmitting=true;
 const button=$('#finish-observation');button.disabled=true;
 try{
  closeSelected();selected=null;stopCamera();observation.completedAt=Date.now();
  observation.performance={...metrics,averageMs:metrics.samples?Math.round(metrics.totalMs/metrics.samples):null};
  observation.pendingSync=true;status('正在提交观察记录…');
  const uploaded=await submitRecord(record);
  if(!uploaded){status('发现已保存在本机，联网后点这里再提交一次。');button.textContent='重新提交观察';button.onclick=finishObservation;return;}
  observation.pendingSync=false;await saveRecord(record);
  status('观察记录已提交。哪些发现能帮助我们检查模型？');button.textContent='去修正模型 →';
  button.onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;
 }catch{status('暂时未能提交，请再试一次。');button.textContent='重新提交观察';button.onclick=finishObservation;}
 finally{button.disabled=false;observationSubmitting=false;}
}
$('#cancel-camera').onclick=()=>{startupController?.abort();stopCamera();$('#camera-status').textContent='已取消开启，下载完成的资源已保留';};
$('#start-camera').onclick=startCamera;$('#open-local-3d').onclick=openViewer;$('#close-organ-dialog').onclick=()=>$('#organ-dialog').close();
$('#organ-dialog').addEventListener('close',()=>{if($('#organ-dialog').open)return;viewerGeneration++;viewerDispose?.();viewerDispose=null;dialogOpen=false;selectedAt=performance.now();tracker.reset();targets=null;});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden)closeSelected();else{selectedAt=performance.now();targets=null;tracker.reset();}});
window.addEventListener('pagehide',()=>{connected?.dispose();connected=null;startupController?.abort();closeSelected();clearTimeout(saveTimer);if(record&&!isPreview)void saveRecord(record);stopCamera();viewerDispose?.();});
async function initialize(){
 $('#start-camera').disabled=true;$('#camera-status').textContent='正在读取本组记录…';
 let timer;try{record=isPreview?{id:'ar-local-preview',groupId:9,observation:freshObservation()}:await Promise.race([currentRecord(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('本组记录读取超时')),8000);})]);}finally{clearTimeout(timer);}
 $('#camera-status').textContent='等待开启';$('#start-camera').textContent='开启后置相机';$('#start-camera').onclick=startCamera;observation=record.observation||freshObservation();record.observation=observation;renderList();$('#start-camera').disabled=false;if(observation.completedAt&&!observation.pendingSync){$('#finish-observation').disabled=false;$('#finish-observation').textContent='去修正模型 →';$('#finish-observation').onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;}else {$('#finish-observation').onclick=finishObservation;if(observation.pendingSync){$('#finish-observation').disabled=false;$('#finish-observation').textContent='重新提交观察';}}}
function initializeOrRetry(){initialize().catch(error=>{status(`记录暂时无法读取：${error.message}`);$('#camera-status').textContent='页面准备未完成，请重试';$('#start-camera').disabled=false;$('#start-camera').textContent='重试准备';$('#start-camera').onclick=initializeOrRetry;});}
initializeOrRetry();if(isPreview)import('./ar-simulation.js').then(m=>m.startSimulation({mount:$('#anatomy-overlay'),select:selectOrgan,onReady:view=>{connected=view;$('#start-camera').hidden=true;$('#finish-observation').hidden=true;$('#camera-status').textContent='模拟预览 · 正面 / 侧面 / 背面';},onFrame:updateLinks}));
if('serviceWorker'in navigator)navigator.serviceWorker.register('./ar-assets-sw.js').catch(error=>console.info('Resource cache unavailable',error));

document.querySelector('#show-respiratory').onchange=e=>connected?.respiratory(e.target.checked);
document.querySelector('#anatomy-turn').oninput=e=>connected?.rotate(Number(e.target.value)*Math.PI/180);
function calibrate(){connected?.calibrate(Number($('#anatomy-size').value),Number($('#anatomy-x').value),Number($('#anatomy-y').value));}
for(const id of ['anatomy-size','anatomy-x','anatomy-y'])$('#'+id).oninput=calibrate;
$('#close-discovery').onclick=()=>{$('.observe-panel').hidden=true;};

let processStop;
function stopMedia(){const video=$('#organ-video');video.autoplay=false;video.pause();video.classList.remove('is-animation');video.removeAttribute('src');video.load();$('#organ-media').hidden=true;$('#candidate-science-video')?.remove();$('#organ-media-choices')?.remove();$('#organ-media').classList.remove('has-choices');video.hidden=false;$('#organ-micrograph').hidden=true;}
function showCandidateMedia(choiceIndex=0){
 processStop?.();stopMedia();$('#organ-3d').hidden=false;$('#organ-process').hidden=true;
 const entry=organSegments[selected],choices=entry?.variants,index=Number.isInteger(choiceIndex)?choiceIndex:0,clip=choices?.[index]||entry,video=$('#organ-video'),image=$('#organ-micrograph');
 if(clip){$('#organ-media').hidden=false;video.hidden=false;video.classList.add('is-animation');video.title=clip.label;video.poster=clip.poster;video.preload='auto';video.muted=true;video.defaultMuted=true;video.playsInline=true;video.autoplay=true;video.loop=false;video.src=clip.path;video.load();void video.play().catch(()=>{/* Native controls remain available if the browser blocks autoplay or a switch cancels loading. */});if(choices){const controls=document.createElement('div');controls.id='organ-media-choices';controls.setAttribute('aria-label','肺部视频选择');choices.forEach((option,i)=>{const b=document.createElement('button');b.type='button';b.textContent=option.label;b.setAttribute('aria-pressed',String(i===index));b.onclick=()=>showCandidateMedia(i);controls.append(b);});$('#organ-media').classList.add('has-choices');$('#organ-media').prepend(controls);}}
 else if(['nasal-cavity','trachea','pharynx'].includes(selected)){$('#organ-media').hidden=false;video.hidden=true;image.src='assets/organs/upper-airway-openstax.jpg';image.alt='上呼吸道侧面剖视参考';image.hidden=false;}
 else{$('#organ-media').hidden=true;}
}

$('#show-organ-media').onclick=showCandidateMedia;
$('#show-organ-process').onclick=showCandidateMedia;
$('#show-organ-structure').onclick=()=>{window.dispatchEvent(new Event('resize'));};
$('#organ-dialog').addEventListener('close',()=>{if($('#organ-dialog').open)return;processStop?.();stopMedia();});

$('#compare-airways').onclick=()=>{$('#show-respiratory').checked=true;connected?.respiratory(true);$('#anatomy-turn').value=65;connected?.rotate(65*Math.PI/180);};

$('#reset-alignment').onclick=()=>{$('#anatomy-size').value=1;$('#anatomy-x').value=0;$('#anatomy-y').value=0;$('#anatomy-turn').value=0;connected?.calibrate(1,0,0);connected?.rotate(0);tracker.reset();displayed.clear();motion.reset();targetMotion=null;};

function updateLinks(){
 if(!$('#organ-dialog').open)return;const p=connected?.anchor(selected),svg=$('#organ-links');if(!p){svg.replaceChildren();return;}
 const stage=$('#camera-stage'),bounds=stage.getBoundingClientRect(),paths=[];svg.setAttribute('viewBox',`0 0 ${stage.clientWidth} ${stage.clientHeight}`);
 for(const panel of [$('#organ-3d'),$('#organ-media')]){const b=panel.getBoundingClientRect();if(panel.hidden||!b.width||!b.height)continue;const l=b.left-bounds.left,r=b.right-bounds.left,t=b.top-bounds.top,d=b.bottom-bounds.top;if(p.x>=l&&p.x<=r&&p.y>=t&&p.y<=d)continue;const clamp=(v,a,z)=>Math.max(a,Math.min(z,v));const ends=[{x:clamp(p.x,l+16,r-16),y:t},{x:clamp(p.x,l+16,r-16),y:d},{x:l,y:clamp(p.y,t+16,d-16)},{x:r,y:clamp(p.y,t+16,d-16)}];ends.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));const e=ends[0],mid=(p.y+e.y)/2;paths.push(`M ${p.x} ${p.y} C ${p.x} ${mid}, ${e.x} ${mid}, ${e.x} ${e.y}`);}
 svg.innerHTML=paths.length?`<path d="${paths.join(' ')}"/><circle cx="${p.x}" cy="${p.y}" r="4"/>`:'';
}

window.prepareClassNavigation = async () => { if (!record||observationSubmitting) return false; clearTimeout(saveTimer); if (!isPreview) await saveRecord(record); };
