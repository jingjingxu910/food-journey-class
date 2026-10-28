import { FilesetResolver, PoseLandmarker } from './vendor/package/vision_bundle.mjs';
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { groupId, currentRecord, saveRecord, submitRecord, homeUrl } from './student-data.js';

const organData = [
  { id:'mouth', name:'口腔', image:'assets/organs/mouth-gentle.svg', note:'牙齿切碎食物，唾液把食物润湿。想想食物接下来从哪里走？' },
  { id:'esophagus', name:'食道', image:'assets/organs/esophagus.png', note:'食道是一条通向胃的管道。沿着它找一找胃。' },
  { id:'stomach', name:'胃', image:'assets/organs/stomach.png', note:'胃会收缩、搅拌食物。观察它在身体的哪一侧。' },
  { id:'small-intestine', name:'小肠', image:'assets/organs/small-intestine.png', note:'小肠盘绕在腹部，食物在这里继续消化，营养被吸收。' },
  { id:'large-intestine', name:'大肠', image:'assets/organs/large-intestine.png', note:'大肠围在小肠外侧，继续吸收水分。' },
];
const $ = (selector) => document.querySelector(selector);
$('#group-label').textContent = `第 ${groupId} 组`;
$('#back-link').href = homeUrl();
$('.flow-fullscreen').onclick = () => document.documentElement.requestFullscreen?.();
let record, observation, stream, landmarker, raf, lastDetection = 0, selected = null, selectedStarted = 0, viewer;

function freshObservation() { return { startedAt:Date.now(), completedAt:null, views:[], local3dEntries:[], cameraStarted:false }; }
function status(message) { $('#observation-status').textContent = message; }
function imageFor(id) { return organData.find((item) => item.id === id)?.image; }

function renderList() {
  const seen = [...new Set(observation.views.map((item) => item.organId))];
  $('#organ-list').replaceChildren(...seen.map((id) => {
    const organ = organData.find((item) => item.id === id);
    if (!organ) return document.createElement('span');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'is-seen';
    button.innerHTML = `<img src="${organ.image}" alt=""><span>${organ.name}</span>`;
    button.onclick = () => selectOrgan(organ.id);
    return button;
  }));
}

function closeSelectedView() {
  if (!selected) return;
  const view = observation.views[observation.views.length - 1];
  if (view && view.organId === selected && !view.durationMs) {
    view.durationMs = Math.max(0, Math.round(performance.now() - selectedStarted));
  }
  selected = null;
}
function selectOrgan(id) {
  closeSelectedView();
  selected = id;
  selectedStarted = performance.now();
  observation.views.push({ organId:id, at:Date.now(), durationMs:0 });
  observation.views = observation.views.slice(-120);
  const organ = organData.find((item) => item.id === id);
  $('#organ-detail').hidden = false;
  $('#organ-detail').innerHTML = `<img src="${organ.image}" alt=""><strong>${organ.name}</strong><p>${organ.note}</p>`;
  $('#open-local-3d').hidden = false;
  $('#finish-observation').disabled = !observation.cameraStarted;
  document.querySelectorAll('.ar-organ').forEach((node) => node.classList.toggle('is-selected',node.dataset.organ === id));
  renderList();
  void saveRecord(record);
}

function stopCamera() {
  if (raf) cancelAnimationFrame(raf);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  landmarker?.close();
  landmarker = null;
}

function placeOverlay(landmarks) {
  const mid = (a,b) => ({ x:(a.x+b.x)/2, y:(a.y+b.y)/2 });
  const shoulders = mid(landmarks[11],landmarks[12]);
  const hips = mid(landmarks[23],landmarks[24]);
  const shoulderWidth = Math.abs(landmarks[11].x-landmarks[12].x);
  const torsoHeight = Math.max(.12,hips.y-shoulders.y);
  const locations = {
    mouth: { x:mid(landmarks[9],landmarks[10]).x, y:mid(landmarks[9],landmarks[10]).y, w:shoulderWidth*.27, h:torsoHeight*.22 },
    esophagus: { x:shoulders.x, y:shoulders.y+torsoHeight*.10, w:shoulderWidth*.18, h:torsoHeight*.56 },
    stomach: { x:shoulders.x+shoulderWidth*.15, y:shoulders.y+torsoHeight*.53, w:shoulderWidth*.47, h:torsoHeight*.49 },
    'small-intestine': { x:hips.x, y:shoulders.y+torsoHeight*.93, w:shoulderWidth*.54, h:torsoHeight*.51 },
    'large-intestine': { x:hips.x, y:shoulders.y+torsoHeight*.89, w:shoulderWidth*.72, h:torsoHeight*.62 },
  };
  const layer = $('#ar-organs');
  if (!layer.children.length) {
    organData.forEach((organ) => {
      const button = document.createElement('button');
      button.type='button'; button.className='ar-organ'; button.dataset.organ=organ.id;
      button.setAttribute('aria-label',`观察${organ.name}`);
      button.innerHTML=`<img src="${imageFor(organ.id)}" alt="">`;
      button.onclick=()=>selectOrgan(organ.id);
      layer.append(button);
    });
  }
  const stage = $('#camera-stage');
  const video = $('#camera-video');
  const stageWidth = stage.clientWidth, stageHeight = stage.clientHeight;
  const videoWidth = video.videoWidth || stageWidth, videoHeight = video.videoHeight || stageHeight;
  const coverScale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight);
  const visibleWidth = videoWidth * coverScale, visibleHeight = videoHeight * coverScale;
  const offsetX = (stageWidth - visibleWidth) / 2, offsetY = (stageHeight - visibleHeight) / 2;
  for (const [id,point] of Object.entries(locations)) {
    const element = layer.querySelector(`[data-organ="${id}"]`);
    element.style.left=`${offsetX+point.x*visibleWidth}px`;
    element.style.top=`${offsetY+point.y*visibleHeight}px`;
    element.style.width=`${Math.max(28,point.w*visibleWidth)}px`;
    element.style.height=`${Math.max(36,point.h*visibleHeight)}px`;
  }
  layer.hidden=false;
}

function detectionLoop(time) {
  if (!stream || !landmarker) return;
  if (time-lastDetection>100 && $('#camera-video').readyState>=2) {
    lastDetection=time;
    try {
      const result=landmarker.detectForVideo($('#camera-video'),time);
      if (result.landmarks?.length) {
        placeOverlay(result.landmarks[0]);
        $('#camera-status').textContent='已找到人体';
      } else {
        $('#ar-organs').hidden=true;
        $('#camera-status').textContent='请站到镜头前';
      }
    } catch(error) { console.warn('姿态识别暂停',error); }
  }
  raf=requestAnimationFrame(detectionLoop);
}

async function startCamera() {
  const button=$('#start-camera'); button.disabled=true;
  $('#camera-status').textContent='正在开启…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('此浏览器没有网页相机接口');
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:'environment'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:15,max:20}}});
    const video=$('#camera-video'); video.srcObject=stream; await video.play();
    $('#camera-placeholder').hidden=true;
    $('#camera-status').textContent='正在加载人体识别…';
    const wasm=await FilesetResolver.forVisionTasks(new URL('./vendor/package/wasm',location.href).href);
    landmarker=await PoseLandmarker.createFromOptions(wasm,{baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_lite.task',location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5});
    observation.cameraStarted=true;
    $('#finish-observation').disabled = observation.views.length === 0;
    await saveRecord(record);
    button.textContent='相机已开启';
    raf=requestAnimationFrame(detectionLoop);
  } catch(error) {
    console.warn('相机或人体识别不可用',error);
    stopCamera();
    $('#camera-status').textContent=error.name==='NotAllowedError'?'浏览器没有获得相机权限':error.name==='OverconstrainedError'?'没有找到后置相机':`未能开启：${error.message}`;
    button.disabled=false; button.textContent='重试后置相机';
  }
}

function organMesh(id) {
  const group=new THREE.Group();
  const pink=new THREE.MeshStandardMaterial({color:0xd8776d,roughness:.73,side:THREE.DoubleSide});
  const inner=new THREE.MeshStandardMaterial({color:0xb75c65,roughness:.8,side:THREE.DoubleSide});
  const make=(geometry,material=pink)=>{const mesh=new THREE.Mesh(geometry,material);group.add(mesh);return mesh;};
  if (id==='mouth') {
    make(new THREE.SphereGeometry(1,24,16)).scale.set(1.15,.55,.7);
    make(new THREE.SphereGeometry(.67,20,12),inner).position.set(0,0,.51);
  } else if (id==='esophagus') {
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,1.5,0),new THREE.Vector3(-.12,.5,.04),new THREE.Vector3(.1,-.5,.08),new THREE.Vector3(0,-1.5,0)]);
    make(new THREE.TubeGeometry(path,38,.23,10,false));
  } else if (id==='stomach') {
    const body=make(new THREE.SphereGeometry(1,28,20));body.scale.set(.78,1.14,.56);body.rotation.z=-.36;
    make(new THREE.SphereGeometry(.35,18,12)).position.set(-.39,.84,0);
    make(new THREE.SphereGeometry(.32,18,12)).position.set(.47,-.78,0);
  } else {
    const count=id==='small-intestine'?5:3;
    for(let n=0;n<count;n++) {
      const points=[];
      for(let i=0;i<=28;i++) {
        const t=i/28, x=-1.05+2.1*t;
        points.push(new THREE.Vector3(x,(n-(count-1)/2)*.38+Math.sin(t*Math.PI*4+n)*.13,Math.sin(t*Math.PI*2+n)*.12));
      }
      make(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,id==='small-intestine'?.12:.2,8,false));
    }
  }
  return group;
}

function openViewer() {
  if (!selected) return;
  closeSelectedView();
  const id=observation.views[observation.views.length-1]?.organId;
  selected=id;
  selectedStarted=performance.now();
  observation.local3dEntries.push({organId:id,at:Date.now()});
  void saveRecord(record);
  $('#organ-dialog-title').textContent=organData.find((item)=>item.id===id).name;
  $('#organ-dialog').showModal();
  const mount=$('#organ-3d');
  try {
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0xeaf3ee);
    const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(0,0,5);
    const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));mount.replaceChildren(renderer.domElement);
    const group=new THREE.Group();scene.add(group);
    const realAsset=id==='stomach'?'stomach.glb':id==='small-intestine'||id==='large-intestine'?'intestines.glb':null;
    if(realAsset) {
      mount.setAttribute('aria-busy','true');
      new GLTFLoader().load(`assets/models/${realAsset}`,(gltf)=>{
        if(!$('#organ-dialog').open)return;
        const model=gltf.scene;
        const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        const scale=2.7/Math.max(size.x,size.y,size.z);
        model.scale.setScalar(scale);model.position.copy(center.multiplyScalar(-scale));
        group.add(model);mount.removeAttribute('aria-busy');
      },undefined,(error)=>{console.warn('真实模型加载失败',error);group.add(organMesh(id));mount.removeAttribute('aria-busy');});
    } else group.add(organMesh(id));
    scene.add(new THREE.HemisphereLight(0xffffff,0x775a62,2));
    const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(2,3,4);scene.add(light);
    const resize=()=>renderer.setSize(mount.clientWidth,mount.clientHeight,false);resize();
    let lastX=0,dragging=false,frame;
    renderer.domElement.onpointerdown=(event)=>{dragging=true;lastX=event.clientX;renderer.domElement.setPointerCapture(event.pointerId);};
    renderer.domElement.onpointermove=(event)=>{if(dragging){group.rotation.y+=(event.clientX-lastX)*.012;lastX=event.clientX;}};
    renderer.domElement.onpointerup=()=>dragging=false;
    const animate=()=>{group.rotation.y+=dragging?0:.005;renderer.render(scene,camera);frame=requestAnimationFrame(animate);};animate();
    viewer=()=>{cancelAnimationFrame(frame);renderer.dispose();group.traverse((node)=>{node.geometry?.dispose();if(Array.isArray(node.material))node.material.forEach((m)=>m.dispose());else node.material?.dispose();});mount.replaceChildren();};
  } catch(error) { mount.textContent='这台设备暂时无法显示局部 3D。'; console.warn(error); }
}

async function finishObservation() {
  if (!observation.cameraStarted || !observation.views.length) {
    status('先开启相机，点击器官观察。');
    return;
  }
  closeSelectedView();
  observation.completedAt=Date.now();
  status('正在保存…');
  const uploaded=await submitRecord(record);
  status(uploaded?'观察记录已提交。':'观察记录已保存在本机，联网后可重试提交。');
  $('#finish-observation').textContent='进入模型修正 →';
  $('#finish-observation').onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;
}

async function initialize() {
  record=await currentRecord();
  observation=record.observation||freshObservation();
  record.observation=observation;
  renderList();
  $('#finish-observation').disabled = !(observation.cameraStarted && observation.views.length);
  if(observation.completedAt) {
    $('#finish-observation').textContent='进入模型修正 →';
    $('#finish-observation').onclick=()=>location.href=`model-workbench.html?group=${groupId}&phase=v2`;
  } else $('#finish-observation').onclick=finishObservation;
}
$('#start-camera').onclick=startCamera;
$('#open-local-3d').onclick=openViewer;
$('#close-organ-dialog').onclick=()=>$('#organ-dialog').close();
$('#organ-dialog').addEventListener('close',()=>{viewer?.();viewer=null;});
window.addEventListener('pagehide',()=>{closeSelectedView();if(record)void saveRecord(record);stopCamera();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeSelectedView();});
initialize().catch((error)=>status(`记录无法读取：${error.message}`));
