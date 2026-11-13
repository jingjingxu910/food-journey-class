import {bindSceneLongPress} from './journey-long-press.js';
import * as THREE from './vendor/three.module.js';
import {JourneyCompanion} from './journey-companion.js?v=20261113-opening-queue';
import {JourneyMiniMap} from './journey-mini-map.js?v=20261113-map-sync';
import './live-sync.js';
import {prepareMucosa} from './journey-anatomy-v2.js';
import {prepareFixedScenes,FixedScenes,fixedStage} from './journey-fixed-scenes.js?v=20261113-pharynx-wall';
import {buildLumen,prepareLumenAssets} from './journey-lumen.js?v=20261113-stomach-wave';
import {PassageView} from './journey-passage-view.js?v=20261113-isolated-frames';
import {showAnatomyView,cancelAnatomyView} from './journey-anatomy-zoom.js';
import {renderReflection} from './journey-reflection.js';
import {groupId,homeUrl,allRecords,currentRecord,saveRecord,submitRecord} from './student-data.js?v=20261109-ui3';

const $=id=>document.getElementById(id),host=$('world'),stage=$('stage');
const companion=new JourneyCompanion(stage),miniMap=new JourneyMiniMap(stage);
const queuedHints=[];
let suppressHint=false, playerAction=false;
function onPlayerAction(action){
 return (...args)=>{
  const previous=playerAction;
  playerAction=true;
  try{return action(...args);}finally{playerAction=previous;}
 };
}
let motionRunning=false,chewRun=null,swallowRun=null,reportWaiting=false,lastLive=0;
const hintCounts=new Map();
const sequence=['outside','mouth','pharynx','esophagus','stomach','small','large'];
const organs={
 mouth:{name:'口腔',point:[307,374],image:'assets/organs/mouth.png',prompt:'食物在这里变湿变软变碎，你认为这是哪个器官？',options:['口腔','胃','食管'],fact:'牙齿把食物嚼碎，唾液让它变湿润，也开始帮助消化。',wrong:'想想刚才看到的牙齿和舌头，还有食物是怎样变化的。'},
 esophagus:{name:'食管',point:[455,690],image:'assets/organs/esophagus.png',prompt:'这里是什么形状，管壁又是怎么动的？',options:['气管','食管','小肠'],fact:'食管的肌肉一段段收缩，通过蠕动把食团送往胃。',wrong:'看看旁边的管壁，它是怎么把食团往前推的？'},
 stomach:{name:'胃',prompt:'哪里能先把食物储存一会儿，还能一边搅动，一边用液体帮忙消化？',options:['食管','胃','小肠'],point:[590,1020],image:'assets/organs/stomach.png',fact:'胃壁运动与胃液共同参与消化，食物逐渐成为更细软的食糜。'},
 small:{name:'小肠',point:[480,1280],image:'assets/organs/small-intestine.png',prompt:'看看内壁长什么样，再想想营养物质去了哪儿。',options:['大肠','小肠','胃'],fact:'小肠继续消化食物，并吸收大部分营养物质。',wrong:'想想那些密密的小绒毛。它们跟吸收营养有什么关系？'},
 large:{name:'大肠',point:[295,1210],image:'assets/organs/large-intestine.png',prompt:'这里的内壁跟刚才有什么不同？剩下的食物变成什么样了？',options:['食管','胃','大肠'],fact:'大肠吸收一部分水分，剩下的残渣逐渐变干。',wrong:'想想刚才看到的绒毛，再看看这里像一节节小袋子的内壁。水分去哪儿了？'}
};
const storageKey=`food-journey-game-v3-group-${groupId}`;
let saved=null;try{saved=JSON.parse(localStorage.getItem(storageKey));}catch{}
let lessonRecordId=null;
const fresh=()=>({version:3,groupId,lessonRecordId,stage:'outside',startedAt:Date.now(),completedAt:null,events:[],identified:[],visits:[],discoveries:[],attempts:[],chews:0,saliva:false,push:0,digested:false,absorbed:0,water:0,stomach:null,wrong:0,coughs:0,vomits:0});
let log=fresh(),where='outside',started=false,busy=false,holding=false,pointer=null,travel=0,time=0,last=0,bodyTimer=0,autoQuestion=0,cardAction=null,stomachFrame=null;
let renderer,scene,camera,environment,wallShaders=[],tongue=null,jaw=null,flap=null,teeth=[],targets=[],oralPulse=0,wallMotion=0,forkSide=false;
let yaw=0,pitch=0,targetYaw=0,targetPitch=0,foodCurrent='whole',foodFrom='whole',foodTo='whole',foodBlend=1,flowSerial=0;
let canal=null,canalU=.14,transport=null,arrival=null,stomachReady=false,sceneExit=null,head=null;
const guide=new THREE.PerspectiveCamera(),guideRotation=new THREE.Quaternion(),viewRotation=new THREE.Quaternion();
const fixedCanvas=document.createElement('canvas');fixedCanvas.id='fixed-scene';fixedCanvas.hidden=true;fixedCanvas.setAttribute('aria-label','口腔与咽部观察画面');stage.append(fixedCanvas);const fixedScenes=new FixedScenes(fixedCanvas);const passageView=new PassageView(stage);
const passages=[];
const preparedTubes=new Map(),sceneTimings=[];
const foodArt={},foodContext=$('food-canvas').getContext('2d'),particles=[],raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),tmp=new THREE.Vector3();
const fractureAtlas=new Image();fractureAtlas.src='assets/journey/biscuit-fractures-v4.webp';
const atlas=new Image(),stomachFood=new Image(),newFoodAtlas=new Image();newFoodAtlas.src='assets/journey/food-atlas-v5.png';atlas.src='assets/journey/food-stages-v3.webp';stomachFood.src='assets/journey/stomach-food-sample.webp';
for(const a of document.querySelectorAll('#home,#end-home'))a.href=homeUrl();
function persist(){if(!started)return;log.stage=where;try{localStorage.setItem(storageKey,JSON.stringify(log));}catch{}}
function event(type,extra={}){log.events.push({type,scene:where,at:Date.now(),...extra});persist();}
function liveState(){const progress=where==='mouth'?log.chews/3:where==='esophagus'?log.push:where==='small'?log.absorbed:where==='large'?log.water:where==='stomach'?(log.stomach?.routeProgress||0):where==='pharynx'?(swallowRun?Math.min(1,(time-swallowRun.born)/2):0):0;window.dispatchEvent(new CustomEvent('lesson-live-state',{detail:{phase:'journey',stage:where,food:foodCurrent,foodName:$('food-name').textContent,progress,hint:companion.last,identified:log.identified,completed:!!log.completedAt}}));return progress;}
function hint(s,kind='hint',options={}){
 if(!started)return;
 const {immediate=playerAction,onShow,...presentation}=options;
 if(suppressHint||transport?.mode==='passage'){queuedHints.push([s,kind,{...options,immediate:false,opening:true}]);return;}
 companion.say(s,kind,{...presentation,immediate,onShow:()=>{
  if(onShow?.()===false)return false;
  $('hint').textContent=s;
  queueMicrotask(liveState);
 }});
}
let recapHint=0;
let travelProgressTarget=0;
function updateTravelProgress(sceneProgress){
 const segment=Math.max(0,sequence.indexOf(where));
 const fraction=Math.max(0,Math.min(1,sceneProgress));
 const target=where==='done'?100:Math.min(99,(segment+fraction)*100/sequence.length);
 travelProgressTarget=Math.max(travelProgressTarget,target);
}
function drawTravelProgress(dt){
 const bar=$('progress');
 const remaining=travelProgressTarget-bar.value;
 if(remaining<=0)return;
 const step=Math.min(8*dt,remaining*(1-Math.exp(-dt*5)));
 bar.value=remaining<.02?travelProgressTarget:bar.value+step;
}
function help(){if($('question').open)return;if(miniMap.side.classList.contains('expanded')){explainSideMap(true,where);return;}if(where==='done'){
 const tips=['看看旅行中拍的照片，说说饼干一路上都有什么变化。','比一比口腔和食管里的食团。它的样子变了吗？食管做了什么？','在胃、小肠和大肠里各找一个变化，用自己的话介绍这趟旅行。'];
 hint(tips[recapHint++%tips.length]);return;
}if(busy||reportWaiting)return;
 if(where==='stomach'){
  const stomach=stomachFrame?.contentWindow.stomachSample?.state??log.stomach;
  if(!['explore','exit'].includes(stomach?.phase))return;
  if(stomach.phase==='exit')return hint('点击“前进”，我们接着走。');
  if(stomach.mixing)return hint('内壁开始一收一放啦！看，碎块散开了，跟着液体一起翻动。','feedback');
  if(stomach.phase==='explore'&&stomach.mixed>=1)return ask('stomach');
 }
 if(motionRunning){
  if(where==='small')return hint('仔细看，内壁正在吸收营养物质。');
  return hint('出发！内壁正在把食物往前推。','feedback');
 }
 const observationFinished=where==='esophagus'?log.push>=1:where==='small'?log.absorbed>=1:where==='large'?log.water>=1:false;
 if(observationFinished){
  if(!log.identified.includes(where))return ask(where);
  return hint('点击“前进”，我们接着走。');
 }
 const key=where+':'+(where==='mouth'?log.chews:where==='small'?log.digested:'');const n=(hintCounts.get(key)||0)+1;hintCounts.set(key,n);const direct={outside:'点一下张开的嘴巴，我们从这里进去。',mouth:log.saliva?'食团已经湿润了。点击右边的“前进”吧。':'点击牙齿试试看！',pharynx:'上面扁扁的开口连着食管，中间的开口连着气管。点击上面的开口试试。',esophagus:'点“前进”，看看管壁怎么把食团往前推。',small:'点击“前进”，看看营养物质去了哪儿。',large:'点击“前进”，看看水分去了哪儿，剩下的食物又有什么变化。',stomach:log.stomach?.fluid?'点击“前进”，看看这里的内壁怎么搅动食物。':'食团碰到底下的液体，会发生什么呢？'};hint(direct[where]||'点击“本组的探索与发现”，一起回顾这趟旅行吧！');}
companion.onHelp=onPlayerAction(help);
let sideHint=null;
const sideExplanations={
 small:'上图中，这些像小手指的突起叫小肠绒毛，能帮小肠吸收营养。下图是显微照片，可以看看绒毛的横切面。',
 pharynx:'从侧面看，气管在前，食管在后。吞咽的时候，会厌会盖住气管的入口，食团就能进食管了。'
};
function explainSideMap(open,scene){
 if($('question').open)return;
 const explanation=scene==='small'&&!log.identified.includes('small')
  ? '上图中，内壁上有许多像小手指一样的突起。下图是显微照片，可以看看这些突起的横切面。' : sideExplanations[scene];
 if(open&&explanation){
  if(companion.last!==explanation)sideHint={scene,text:companion.last,kind:companion.node.dataset.kind};
  hint(explanation,'hint');
 }else if(sideHint){
  const previous=sideHint;
  sideHint=null;
  if(previous.scene===where&&companion.last===explanation)hint(previous.text,previous.kind);
 }
}
miniMap.onSideChange=explainSideMap;
miniMap.side.onclick=onPlayerAction(miniMap.side.onclick);
miniMap.button.onclick=onPlayerAction(miniMap.button.onclick);
function controls(show){for(const id of ['forward','back','map'])$(id).hidden=!show;$('views').hidden=!show||fixedStage(where);}
let evidenceKey;
function discoveries(lines){
 const key=lines.join('|');
 if(key===evidenceKey){$('observation').hidden=!lines.length;return;}
 evidenceKey=key;
 $('evidence').replaceChildren(...lines.map(s=>{const d=document.createElement('div');d.textContent='✓ '+s;return d;}));$('observation').hidden=!lines.length;}
function food(form,label,note=''){if(foodTo!==form){foodFrom=foodCurrent;foodTo=form;foodBlend=0;}foodCurrent=form;$('food-name').textContent=label;$('food-note').textContent=note;}
function prepareArt(){
 const names=['whole','chunks','pieces','bolus','gastric','chyme','residue','dry'];
 names.forEach((name,i)=>{const c=document.createElement('canvas');c.width=c.height=512;c.getContext('2d').drawImage(newFoodAtlas,(i%4)*newFoodAtlas.width/4,Math.floor(i/4)*newFoodAtlas.height/2,newFoodAtlas.width/4,newFoodAtlas.height/2,0,0,512,512);foodArt[name]=c;});
 foodArt.crumbs=foodArt.pieces;foodArt['fine-chyme']=foodArt.chyme;
}
let drawnFood,drawnBlend,drawnFrom;
function drawFood(dt){
 foodBlend=Math.min(1,foodBlend+dt*1.2);
 const from=foodArt[foodFrom],to=foodArt[foodTo];
 if(to===drawnFood&&foodBlend===drawnBlend&&(foodBlend===1||from===drawnFrom))return;
 drawnFood=to;drawnBlend=foodBlend;drawnFrom=from;foodContext.clearRect(0,0,512,512);foodContext.globalCompositeOperation="source-over";const a=foodArt[foodFrom],b=foodArt[foodTo];if(a&&foodBlend<1){foodContext.globalAlpha=1-foodBlend;foodContext.drawImage(a,0,0,512,512);}if(b){foodContext.globalCompositeOperation="lighter";foodContext.globalAlpha=foodBlend;foodContext.drawImage(b,0,0,512,512);}foodContext.globalAlpha=1;foodContext.globalCompositeOperation="source-over";}
function disposeEnvironment(){if(!environment)return;scene.remove(environment);if(!environment.userData.preparedTube){const geos=new Set(),mats=new Set();environment.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});geos.forEach(g=>g.dispose());mats.forEach(m=>{if(!m.map?.userData.shared)m.map?.dispose();if(m.bumpMap!==m.map)m.bumpMap?.dispose();m.dispose();});}environment=null;head=null;targets=[];teeth=[];tongue=null;wallShaders=[];forkSide=false;}
async function prepareTubeScenes(){
 const position=camera.position.clone(),rotation=camera.quaternion.clone();
 for(const type of ['esophagus','small','large']){
  await new Promise(requestAnimationFrame);const born=performance.now(),root=new THREE.Group(),pick=[],shaders=[];root.userData.preparedTube=true;const tube=buildLumen(root,pick,type,shaders);scene.add(root);camera.position.copy(tube.curve.getPointAt(tube.start));camera.lookAt(tube.curve.getPointAt(tube.start+.025));await renderer.compileAsync(scene,camera);renderer.render(scene,camera);scene.remove(root);preparedTubes.set(type,{root,targets:pick,shaders,canal:tube});sceneTimings.push({type,preparationMs:performance.now()-born});
 }
 camera.position.copy(position);camera.quaternion.copy(rotation);
 renderer.clear();
}

function buildMouth(){fixedCanvas.hidden=false;fixedScenes.draw('mouth');}
function buildFork(){fixedCanvas.hidden=false;fixedScenes.draw('pharynx');}
function buildTube(type){const prepared=preparedTubes.get(type);if(!prepared)throw Error('Scene not prepared: '+type);scene.remove(environment);environment=prepared.root;scene.add(environment);targets=prepared.targets;wallShaders=prepared.shaders;canal=prepared.canal;canalU=canal.start;for(const [object,label] of [[canal.entry,type==='small'?'幽门':'入口'],[canal.exit,type==='esophagus'?'贲门':'前方的通道']]){const tag=document.createElement('span');tag.className='passage-title';tag.textContent=label;$('passages').append(tag);passages.push({object,tag});}positionCanal(canalU,1);}
function positionCanal(u,blend){if(!canal)return;const p=canal.curve.getPointAt(u);camera.position.copy(p);guide.position.copy(p);guide.lookAt(canal.curve.getPointAt(Math.min(.999,u+.025)));guideRotation.slerp(guide.quaternion,blend);viewRotation.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));camera.quaternion.copy(guideRotation).multiply(viewRotation);}
function init3D(){renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;host.append(renderer.domElement);scene=new THREE.Scene();scene.background=new THREE.Color(0x281617);scene.fog=new THREE.FogExp2(0x4a2526,.033);camera=new THREE.PerspectiveCamera(72,1,.05,85);camera.rotation.order='YXZ';scene.add(camera);scene.add(new THREE.HemisphereLight(0xfff2ed,0x8e5e5c,1.2));const lamp=new THREE.PointLight(0xfff3eb,19,17,1.5);lamp.position.set(0,.3,0);camera.add(lamp);resize();new ResizeObserver(resize).observe(host);renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('failure').hidden=false;});requestAnimationFrame(draw);}
function resize(){if(!renderer||!host.clientWidth||!host.clientHeight)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25,Math.sqrt(900000/(host.clientWidth*host.clientHeight))));renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();positionMouth();}
function positionMouth(){const w=stage.clientWidth,h=stage.clientHeight,scale=Math.max(w/1586,h/992),iw=1586*scale,ih=992*scale;Object.assign($('mouth-entry').style,{left:`${(w-iw)/2+iw*.413}px`,top:`${(h-ih)/2+ih*.49}px`,width:`${iw*.17}px`,height:`${ih*.23}px`});}
function prepareStomach(restore=false){
 if(stomachFrame)return;stomachReady=false;stomachFrame=$('stomach-frame');stomachFrame.style.transition='none';stomachFrame.hidden=false;stomachFrame.style.opacity='0';stomachFrame.style.pointerEvents='none';const u=new URL('stomach-sample.html',location.href);u.searchParams.set('v','20261113-opening-queue');u.searchParams.set('voyage','1');u.searchParams.set('autostart','0');u.searchParams.set('group',groupId);if(restore&&log.stomach)u.searchParams.set('restore',JSON.stringify(log.stomach));stomachFrame.src=u.href;
}
function zoomInto(next,options,source,focus,scale,duration){
 const frame=stage.getBoundingClientRect();
 const x=focus.x*frame.width,y=focus.y*frame.height;
 busy=true;
 controls(false);
 source.style.transformOrigin=x+'px '+y+'px';
 const zoom=source.animate([{transform:'scale(1)'},{transform:'scale('+scale+')'}],{
  duration,easing:'ease-in',fill:'forwards'
 });
 zoom.finished.then(()=>{
  const snapshot=document.createElement('canvas');
  snapshot.width=Math.round(frame.width);
  snapshot.height=Math.round(frame.height);
  const width=source.naturalWidth||source.width;
  const height=source.naturalHeight||source.height;
  const cover=Math.max(frame.width/width,frame.height/height);
  const scaledWidth=width*cover*scale,scaledHeight=height*cover*scale;
  snapshot.getContext('2d').drawImage(source,(frame.width*scale-scaledWidth)/2+x*(1-scale),(frame.height*scale-scaledHeight)/2+y*(1-scale),scaledWidth,scaledHeight);
  beginPassage(next,options,{source:snapshot,blendStart:0},.65);
 }).finally(()=>{
  zoom.cancel();
  source.style.transformOrigin='';
 });
}
function enterMouth(options){
 const photo=$('outside-photo');
 const frame=photo.getBoundingClientRect();
 const opening=$('mouth-entry').getBoundingClientRect();
 const focus={x:(opening.left+opening.width/2-frame.left)/frame.width,y:(opening.top+opening.height/2-frame.top)/frame.height};
 return zoomInto('mouth',options,photo,focus,3.8,1050);
}
function beginPassage(next,options,spec,duration){
 const setupStart=performance.now();
 const foodDisplay=$('food-display');
 const fromFood=foodDisplay.hidden?null:foodDisplay.getBoundingClientRect();
 passageView.begin({...spec,blend:true});transport=null;suppressHint=true;try{commitScene(next,{...options,deferEntry:true,immediate:false});}finally{suppressHint=false;}arrival=null;if(canal){resize();canalU=.04;positionCanal(canalU,1);}busy=true;controls(false);$('detail').hidden=true;$('observation').hidden=true;$('hint').style.opacity='0';
 drawFood(0);if(next==='stomach'){stage.classList.add('stomach-handoff');$('food-display').hidden=false;stomachFrame.style.opacity='0';stomachFrame.style.pointerEvents='none';}
 const toFood=foodDisplay.getBoundingClientRect();
 if(fromFood?.width&&toFood.width&&next!=='stomach'){
  const dx=fromFood.left+fromFood.width/2-toFood.left-toFood.width/2;
  const dy=fromFood.top+fromFood.height/2-toFood.top-toFood.height/2;
  foodDisplay.animate([{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${fromFood.width/toFood.width})`},{transform:'translate(-50%,-50%)'}],{duration:duration*1000,easing:'ease-in-out'});
 }
 transport={mode:'passage',next,born:time,duration};sceneTimings.push({type:next,handoffSetupMs:performance.now()-setupStart});
}
function go(next,options={}){
 options={...options,immediate:playerAction};
 if(options.restore||next==='outside'||!started)return commitScene(next,options);
 if(transport||busy)return;
 if(where==='outside'&&next==='mouth')return enterMouth(options);
 if(fixedStage(where)){
  const spec=fixedScenes.passageSpec(where);
  if(where==='mouth')return zoomInto(next,options,spec.source,spec.focus,2.35,950);
  return beginPassage(next,options,{...spec,push:.13},1.8);
 }
 if(where==='stomach'){
  const source=stomachFrame?.contentWindow.stomachSample?.worldFrame();
  if(source){
   foodCurrent=foodTo=foodFrom='chyme';
   foodBlend=1;
   return beginPassage(next,options,{source},1.55);
  }
  return commitScene(next,options);
 }
 holding=false;pointer=null;busy=true;controls(false);$('hint').style.opacity='0';camera.updateMatrixWorld(true);const keepView=Math.cos(yaw)>=0&&Math.cos(targetYaw)>=0;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));targetYaw=yaw;targetPitch=pitch;transport={mode:'approach',next,options,born:time,approachDuration:where==='small'?Math.max(1,(.955-canalU)*35/(canal.end-canal.start)):1.7,u:canalU,yaw,pitch,keepView};
}
function advanceTransport(){
 if(!transport)return false;const t=transport;
 if(t.mode==='passage'){
   let destination;if(t.next==='stomach'){if(!stomachReady){t.born=time;return true;}const stomach=stomachFrame.contentWindow.stomachSample;
    if(!t.entered){stomach.enterVoyage({handoff:true});t.entered=true;}
    destination=stomach.worldFrame();}else if(fixedStage(t.next)){fixedScenes.draw(t.next,0);destination=fixedCanvas;}else{const entryProgress=THREE.MathUtils.smoothstep(Math.min(1,(time-t.born)/t.duration),0,1);canalU=THREE.MathUtils.lerp(.04,canal.start,entryProgress);positionCanal(canalU,1);renderer.render(scene,camera);destination=renderer.domElement;}
   const k=Math.min(1,(time-t.born)/t.duration);
   if(!passageView.draw(k,destination))return true;
   // Keep the fully revealed frame on screen for one paint before swapping canvases.
  if(!t.finalFrame){t.finalFrame=k===1;return true;}
  passageView.finish();transport=null;if(t.next==='stomach'){$('food-caption').hidden=true;stomachFrame.style.opacity='1';stomachFrame.style.pointerEvents='auto';busy=false;}else if(canal){arrival=null;busy=false;controls(true);$('detail').hidden=t.next!=='small';$('hint').style.opacity='1';}else{fixedCanvas.hidden=false;busy=false;controls(true);$('detail').hidden=where!=='pharynx';$('hint').style.opacity='1';}
  for(const nextHint of queuedHints.splice(0))hint(...nextHint);
  return true;
 }
 const k=Math.min(1,(time-t.born)/t.approachDuration),aim=where==='small'?k:k*k*(3-2*k);yaw=t.yaw*(t.keepView?1:1-aim);pitch=t.pitch*(t.keepView?1:1-aim);targetYaw=yaw;targetPitch=pitch;canalU=THREE.MathUtils.lerp(t.u,.955,aim);positionCanal(canalU,1-Math.exp(-.05*7));renderer.render(scene,camera);
 if(k===1&&(t.next!=='stomach'||stomachReady)){
  if(t.next==='stomach')beginPassage(t.next,t.options,{source:renderer.domElement,blend:true},1.2);
  else beginPassage(t.next,t.options,{source:renderer.domElement},1.55);
 }return true;
}
function commitScene(next,{restore=false,deferEntry=false,immediate=false}={}){
 if(immediate)companion.stopVoice();
 stage.classList.remove('stomach-question','stomach-handoff');const commitStart=performance.now(),previous=where;arrival=null;motionRunning=false;chewRun=null;swallowRun=null;reportWaiting=false;fixedScenes.swallow=0;fixedCanvas.hidden=true;wallMotion=0;
 camera.fov=72;camera.updateProjectionMatrix();
 clearTimeout(autoQuestion);clearTimeout(bodyTimer);holding=false;pointer=null;busy=false;travel=0;particles.splice(0).forEach(p=>p.node.remove());passages.splice(0).forEach(p=>p.tag.remove());for(const d of document.querySelectorAll('dialog[open]'))d.close();
 if(stomachFrame&&next!=='stomach'&&where==='stomach'){stomachFrame.removeAttribute('src');stomachFrame.hidden=true;stomachFrame=null;stomachReady=false;}
 where=next;stage.dataset.scene=next;log.stage=next;event('enter');if(organs[next]&&!log.visits.some(v=>v.organId===next))log.visits.push({organId:next,firstAt:Date.now()});
 $('food-display').style.visibility=$('food-caption').style.visibility='visible';disposeEnvironment();canal=null;environment=new THREE.Group();scene.add(environment);yaw=pitch=targetYaw=targetPitch=0;camera.position.set(0,0,1.3);camera.rotation.set(0,0,0);camera.children.find(o=>o.isPointLight).intensity=next==='esophagus'?8:19;controls(next!=='outside');$('hint').style.opacity='1';$('outside-photo').hidden=next!=='outside';$('mouth-entry').hidden=next!=='outside';host.hidden=next==='outside'||fixedStage(next)||next==='stomach';$('food-display').hidden=false;$('food-caption').hidden=false;$('observation').hidden=true;$('detail').hidden=!['small','pharynx'].includes(next);$('detail').textContent=next==='pharynx'?'⊕ 从侧面看看':'⊕ 凑近观察';$('chapter').textContent=next==='outside'?'寻找入口':'仔细观察';$('step-label').textContent='旅行中';if(next==='outside'){travelProgressTarget=0;$('progress').value=0;}
 jaw=flap=null;
 if(next==='outside'){hint('从哪儿能进到身体里面呢？','greet',{opening:true});food('whole','一块饼干');positionMouth();}
 else if(next==='mouth'){buildMouth();food(log.saliva?'bolus':log.chews>=3?'crumbs':log.chews===2?'pieces':log.chews===1?'chunks':'whole',log.saliva?'湿润的食团':log.chews>=3?'干的碎块':log.chews===2?'更小的饼干块':log.chews===1?'大块的饼干':'一块饼干');hint(log.saliva?'跟刚进来的时候比，食团有什么变化？':'这么大的一块饼干，咽不下去呀。看看怎样能把它变小？');}
 else if(next==='pharynx'){buildFork();food('bolus','湿润的食团');hint('这里有两条路！上面扁扁的开口连着食管，中间的开口连着气管。我们走哪一条呢？');}
 else if(next==='esophagus'){buildTube(next);prepareStomach();food('bolus','湿润的食团');hint('点“前进”，看看管壁怎么把食团往前推。');}
 else if(next==='stomach'){host.hidden=true;controls(false);$('food-display').hidden=true;$('food-caption').hidden=!deferEntry;$('detail').hidden=true;prepareStomach(restore);stomachFrame.style.opacity='1';stomachFrame.style.pointerEvents='auto';if(stomachReady&&!deferEntry)stomachFrame.contentWindow.postMessage({channel:'food-journey-parent',type:'enter'},location.origin);}
 else if(next==='small'){buildTube(next);food(log.absorbed>=1?'residue':'chyme',log.absorbed>=1?'吸收后留下的内容物':'更细软的食糜');hint(log.digested?'点击“前进”，看看营养物质去了哪儿。':'这里的内壁有什么不一样？点击“前进”，一起看看食糜怎么变。');}
 else if(next==='large'){buildTube(next);food(log.water>=1?'dry':'residue','剩余的内容物');hint('点击“前进”，看看水分去了哪儿，剩下的食物又有什么变化。');}
 if(restore){travel=next==='esophagus'?log.push*24:next==='small'?log.absorbed*13:next==='large'?log.water*13:0;if(canal){const progress=next==='esophagus'?log.push:next==='small'?log.absorbed:log.water;canalU=THREE.MathUtils.lerp(canal.start,canal.end,progress||0);positionCanal(canalU,1);}}
 else if(canal&&previous!=='outside'){canalU=.0125;positionCanal(canalU,1);arrival={born:time};busy=true;controls(false);}
 miniMap.update(where,0,where==='pharynx'?foodArt.bolus.toDataURL():null);refreshEvidence();persist();sceneTimings.push({type:next,commitMs:performance.now()-commitStart});
}
function refreshEvidence(){if(where==='mouth')discoveries([...(log.chews>=3?['饼干碎成了小块']:[]),...(log.saliva?['碎块变成湿润的食团']:[])]);else if(where==='esophagus')discoveries(log.push>.3?['内壁一段段收缩','食团沿管道向前']:[]);else if(where==='small')discoveries([...(log.digested?['食糜继续发生变化']:[]),...(log.absorbed>.3?['营养物质从食糜移向内壁']:[]),...(log.absorbed>=1?['吸收后还留下部分内容物']:[])]);else if(where==='large')discoveries([...(log.water>.3?['水分从内容物移向内壁']:[]),...(log.water>=1?['留下的残渣更干、更紧实']:[])]);}
function hit(e){camera.updateMatrixWorld(true);environment?.updateMatrixWorld(true);const b=host.getBoundingClientRect();mouse.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(targets,false)[0]?.object.userData.kind;}
function spawnFlow(kind,count=34){const b=stage.getBoundingClientRect(),food=$('food-display').getBoundingClientRect(),center={x:food.left+food.width*.5-b.left,y:food.top+food.height*.5-b.top};for(let i=0;i<count;i++){const a=(flowSerial++)*2.399963+Math.random()*.5,r=.30+Math.random()*.14,edge={x:b.width*(.5+Math.cos(a)*r),y:b.height*(.52+Math.sin(a)*(.27+Math.random()*.12))},node=document.createElement('i');node.className='flow-particle '+kind;if(kind==='nutrient'&&flowSerial%3===0)node.classList.add('amino');node.style.left=node.style.top='0';$('effects').append(node);const incoming=kind==='saliva',start=incoming?edge:{x:center.x+(Math.random()-.5)*food.width*.48,y:center.y+(Math.random()-.5)*food.height*.48},end=incoming?{x:center.x+(Math.random()-.5)*food.width*.45,y:center.y+(Math.random()-.5)*food.height*.4}:edge;node.style.opacity='0';node.style.transform='translate3d('+start.x+'px,'+start.y+'px,0) translate(-50%,-50%)';particles.push({node,start,end,bend:(Math.random()-.5)*80,born:time+i*.014,duration:incoming?1.0:1.35,kind});}}
function chew(){
 if(busy||chewRun||log.saliva)return;if(document.querySelector('dialog[open]'))return;
 chewRun={born:time,step:0};busy=true;event('chew-start');hint('看看牙齿咀嚼饼干的时候，饼干有什么变化。','feedback');
}
function tickChew(){
 if(!chewRun)return;const elapsed=time-chewRun.born,step=Math.min(3,1+Math.floor(elapsed/1.5));
 oralPulse=(Math.sin(elapsed*6)+1)/2;
 if(step!==chewRun.step){chewRun.step=step;log.chews=step;spawnFlow('crumb',10);spawnFlow('saliva',16);food(step===1?'chunks':step===2?'pieces':'bolus',step===1?'湿润的大碎块':step===2?'湿润的小碎块':'湿润的食团');event('chew');if(step===2)hint('快看，饼干碎了，变湿了，变软了！','feedback');}
 if(elapsed>=4.8){chewRun=null;log.saliva=true;busy=false;oralPulse=0;event('saliva');refreshEvidence();setTimeout(()=>ask('mouth'),900);}
}
function wetMouth(){help();}
function beginIntestinalAbsorption(){if(log.digested)return;log.digested=true;log.absorbed=Math.max(log.absorbed,0);spawnFlow('nutrient',28);food('fine-chyme','继续变细的食糜');event('continued-digestion');event('nutrient-absorption-start');hint('仔细看，内壁正在吸收营养物质。');refreshEvidence();}
const organReveal=document.createElement('figure');organReveal.id='organ-reveal';organReveal.hidden=true;stage.append(organReveal);
function revealOrgan(name,src){const img=new Image(),caption=document.createElement('figcaption');img.src=src;img.alt='';caption.textContent=name;organReveal.replaceChildren(img,caption);organReveal.hidden=false;}
function ask(id){if(where!==id||log.identified.includes(id)||document.querySelector('dialog[open]'))return;motionRunning=false;const o=organs[id];hint(id==='mouth'?'你认为这是哪个器官？':o.prompt+' 你认为这是哪个器官？','question',{onShow:()=>{
 if(where!==id||busy||transport||log.identified.includes(id)||document.querySelector('dialog[open]'))return false;
 sideHint=null;miniMap.toggleSide(false);miniMap.toggle(false);$('question-text').textContent=o.prompt;$('question').querySelector('h2').textContent=id==='mouth'?o.prompt:'这是哪个器官？';$('answer-hint').textContent='';$('answers').replaceChildren(...o.options.map(name=>{const b=document.createElement('button');b.textContent=name;b.onclick=onPlayerAction(()=>{event('identify',{organId:id,choice:name});if(id==='stomach'){stomachFrame.contentWindow.postMessage({channel:'food-journey-parent',type:'answer',value:name==='胃'?'stomach':name==='食管'?'esophagus':'small'},location.origin);return;}if(name!==o.name){log.wrong++;hint(o.wrong+' 再选一次。','retry');persist();return;}log.identified.push(id);log.discoveries.push({organId:id,at:Date.now()});$('question').close();revealOrgan(o.name,o.image);hint('点击“前进”，我们接着走。','praise',{celebrate:true});persist();});return b;}));$('question').show();
 }});
}
function showMap(reveal=false){const id=where==='pharynx'||where==='outside'?'mouth':where,o=organs[id];if(!o)return;$('anatomy-target').setAttribute('transform',`translate(${o.point[0]} ${o.point[1]})`);for(const c of $('anatomy-target').querySelectorAll('circle')){c.setAttribute('cx','0');c.setAttribute('cy','0');}$('anatomy-title').textContent=reveal?'把局部放回身体中':'看看当前位置';$('anatomy-text').hidden=!reveal;$('anatomy-text').textContent=reveal?`刚才观察的${o.name}在这里。`:'';showAnatomyView($('anatomy'),{point:o.point,reveal,src:o.image,onReveal:()=>{if(!log.identified.includes(id))return;$('anatomy-title').textContent=o.name;$('anatomy-text').textContent=o.fact;}});}
function card(title,text,action=null,label='继续看看 →'){motionRunning=false;busy=true;hint(title+' '+text,'report',{action:()=>{busy=false;action?.();},label});}
function failCough(){log.coughs++;event('airway');busy=true;stage.classList.add('is-changing');hint('咳，咳！食团回到咽部了。点上面的食管入口试试。');setTimeout(()=>{stage.classList.remove('is-changing');busy=false;},850);}
function swallow(){if(busy)return;busy=true;swallowRun={born:time};event('safe-swallow');hint('选对了！会厌盖住气管的入口，食团就能进食管了。','praise');}
function sendStomachNavigation(direction){
 if(document.querySelector('dialog[open]')||!['explore','exit'].includes(log.stomach?.phase))return;
 stomachFrame?.contentWindow.postMessage({channel:'food-journey-parent',type:'navigate',direction},location.origin);
}
function forward(){
 if(busy||!started||reportWaiting||document.querySelector('dialog[open]'))return;if(where==='stomach'){sendStomachNavigation('forward');return;}organReveal.hidden=true;event('forward');
 if(where==='outside'||where==='pharynx')return help();
 if(canal&&Math.cos(targetYaw)<0){
  targetYaw=Math.round(yaw/(2*Math.PI))*2*Math.PI;
  targetPitch=0;
 }
 const ready=where==='mouth'?log.saliva:where==='esophagus'?log.push>=1:where==='small'?log.absorbed>=1:log.water>=1;
 if(!ready){if(where==='mouth')return help();if(motionRunning)return;motionRunning=true;if(where==='small'&&!log.digested)beginIntestinalAbsorption();else hint('出发！内壁正在把食物往前推。','feedback');return;}
 if(!log.identified.includes(where)){ask(where);return;}if(where==='mouth')go('pharynx');else if(where==='esophagus')go('stomach');else if(where==='small')go('large');else finish();
}
function backward(){
 if(busy||!started||reportWaiting||document.querySelector('dialog[open]'))return;
 if(where==='stomach'){sendStomachNavigation('back');return;}
 if(where==='mouth'){
  const line=log.chews===0?'食物还在嘴里。看看前面有什么能让它变小？':log.saliva?'跟刚进来的时候比，食团有什么变化？':'饼干已经碎成了几块，接下来还会怎样变化？';
  event('backward');
  if(companion.last!==line)hint(line);
  return;
 }
 if(!canal)return;
 const facingBack=Math.cos(targetYaw)<0;
 const destination=facingBack?0:Math.PI;
 targetYaw=destination+Math.round((targetYaw-destination)/ (2*Math.PI))*2*Math.PI;
 targetPitch=0;
 event('backward');
 if(facingBack){
  if(motionRunning){hint('出发！内壁正在把食物往前推。','feedback');return;}
  if(log.identified.includes(where)){hint('点击“前进”，我们接着走。');return;}
  const completed=where==='esophagus'?log.push>=1:where==='small'?log.absorbed>=1:log.water>=1;
  if(completed){ask(where);return;}
  help();
  return;
 }
 const rearHints={
  esophagus:'回头还能看到刚才的入口吗？\n再看看，食团旁边的管壁是怎么动的？',
  small:'回头看看，刚才那个开口现在是什么样？',
  large:'回头看看这段路。\n食物到了这里，跟刚才有什么不同？'
 };
 if(rearHints[where])hint(rearHints[where]);
}
function restart(){const previous=log;log=fresh();log.attempts=[...previous.attempts,{at:Date.now(),reason:'restart',wrong:previous.wrong,events:previous.events}];log.coughs=previous.coughs;log.vomits=previous.vomits;started=true;foodCurrent=foodTo=foodFrom='whole';foodBlend=1;drawFood(0);$('save-status').textContent='';organReveal.hidden=true;$('finished').hidden=true;$('intro').hidden=true;go('outside');}
function finish(){motionRunning=false;where='done';stage.dataset.scene='done';miniMap.update('done');hint('牙齿把饼干嚼碎，食管把食团送进胃。胃把食物搅成食糜。接下来，小肠吸收营养，大肠再吸收一部分水分。','report',{immediate:false});log.stage='done';log.completedAt??=Date.now();holding=false;event('complete');controls(false);$('detail').hidden=true;$('food-display').hidden=true;$('food-caption').hidden=true;$('observation').hidden=true;$('hint').hidden=true;updateTravelProgress(1);$('step-label').textContent='旅行完成';$('finished').hidden=false;renderReflection(document,organs,log,foodArt);persist();liveState();}
function draw(ms){
 requestAnimationFrame(draw);
 const dt=Math.min(.083,last?(ms-last)/1000:.016);last=ms;
 if(document.hidden||!renderer)return;
 if(started)drawTravelProgress(dt);
 if(where==='done'||document.querySelector('dialog[open]'))return;
 time+=dt;const mapProgress=where==='mouth'?log.chews/3:where==='esophagus'?log.push:where==='small'?log.absorbed:where==='large'?log.water:where==='stomach'?(log.stomach?.routeProgress||0):where==='pharynx'?(swallowRun?Math.min(1,(time-swallowRun.born)/2):0):0;miniMap.update(where,mapProgress);if(started&&where!=='done')updateTravelProgress(mapProgress);if(time-lastLive>.4){lastLive=time;liveState();}tickChew();if(swallowRun){fixedScenes.swallow=Math.min(1,(time-swallowRun.born)/1.2);if(time-swallowRun.born>2.3){swallowRun=null;busy=false;go('esophagus');}}
 if(transport){if(!transport.finalFrame)for(const shader of wallShaders){if(shader.uniforms.uClock)shader.uniforms.uClock.value=time};drawFood(dt);if(advanceTransport())return;}
 // The visible stomach frame owns its food and scene. The parent only draws during handoffs.
 if(where==='stomach')return;
 drawFood(dt);
 yaw+=(targetYaw-yaw)*(1-Math.exp(-dt*7));pitch+=(targetPitch-pitch)*(1-Math.exp(-dt*7));camera.rotation.set(pitch,yaw,0,'YXZ');

 const active=motionRunning&&started&&!busy&&!document.querySelector('dialog[open]');wallMotion+=(Number(active)-wallMotion)*(1-Math.exp(-dt*6));
 if(active&&where==='esophagus'&&log.push<1){log.push=Math.min(1,log.push+dt/5);travel=log.push*24;refreshEvidence();if(log.push===1){motionRunning=false;hint('看，管壁一段一段地收紧，把食团推到了胃的入口！','praise');event('peristalsis');setTimeout(()=>ask('esophagus'),900);}}
 if(active&&where==='small'&&log.digested&&log.absorbed<1){const before=log.absorbed;log.absorbed=Math.min(1,before+dt/35);if(before<.5&&log.absorbed>=.5)hint('这条路真的好长呀，看看右下角的定位吧，我们走到哪儿啦？');travel=log.absorbed*13;if(Math.floor(time*6)!==Math.floor((time-dt)*6))spawnFlow('nutrient',3);if(log.absorbed>.55)food('residue','吸收后留下的内容物');refreshEvidence();if(log.absorbed===1){motionRunning=false;hint('看，弯弯曲曲的内壁吸收了很多营养，剩下的东西还在往前走。','praise');event('nutrient-absorption');setTimeout(()=>ask('small'),900);}}
 if(active&&where==='large'&&log.water<1){log.water=Math.min(1,log.water+dt/12);travel=log.water*13;if(Math.floor(time*6)!==Math.floor((time-dt)*6))spawnFlow('water',3);if(log.water>.55)food('dry','水分减少后的残渣');refreshEvidence();if(log.water===1){motionRunning=false;hint('这里吸收了一些水分，剩下的残渣变干了。','praise');event('water-absorption');setTimeout(()=>ask('large'),900);}}
 if(canal){const progress=where==='esophagus'?log.push:where==='small'?log.absorbed:log.water;if(arrival){const f=Math.min(1,(time-arrival.born)/1.35),ease=f;canalU=THREE.MathUtils.lerp(arrival.fromU??.0125,canal.start,ease);if(f===1){arrival=null;busy=false;controls(true);}}else canalU+=(THREE.MathUtils.lerp(canal.start,canal.end,progress||0)-canalU)*(1-Math.exp(-dt*3));positionCanal(canalU,1-Math.exp(-dt*5));}for(const s of wallShaders){if(s.uniforms.uClock)s.uniforms.uClock.value=where==='esophagus'?log.push*5:time;s.uniforms.uStrength.value=wallMotion;if(s.uniforms.uViewOffset)s.uniforms.uViewOffset.value=canalU-canal.start;}
 flap?.userData.animate?.(dt);oralPulse=Math.max(0,oralPulse-dt*1.3);if(jaw?.userData.animateChew)jaw.userData.animateChew(Math.sin(oralPulse*Math.PI));if(tongue&&!tongue.userData.referenceAnatomy)tongue.scale.y=.48+Math.sin(oralPulse*Math.PI)*.07;
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],f=(time-p.born)/p.duration;if(f<0){p.node.style.opacity='0';continue;}if(f>=1){p.node.remove();particles.splice(i,1);continue;}const ease=f,x=p.start.x+(p.end.x-p.start.x)*ease+Math.sin(f*Math.PI)*p.bend,y=p.start.y+(p.end.y-p.start.y)*ease-Math.sin(f*Math.PI)*24;p.node.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%)';p.node.style.opacity=String(Math.min(1,f*7,(1-f)*5));}
 camera.updateMatrixWorld(true);for(const passage of passages){const point=passage.object.position.clone().project(camera);passage.tag.hidden=point.z<0||point.z>1||Math.abs(point.x)>.88||Math.abs(point.y)>.84;if(!passage.tag.hidden&&canal){if(time-(passage.checkedAt??-1)>.2){const delta=passage.object.position.clone().sub(camera.position),distance=delta.length();raycaster.set(camera.position,delta.normalize());const first=raycaster.intersectObject(canal.wall,false)[0];passage.obscured=!!first&&first.distance<distance-.15;passage.checkedAt=time;}passage.tag.hidden=passage.obscured;}passage.tag.style.left=((point.x+1)*50)+'%';passage.tag.style.top=((1-point.y)*50)+'%';}if(fixedStage(where)){fixedScenes.draw(where,Math.sin(oralPulse*Math.PI));}else if(where!=='outside')renderer.render(scene,camera);
}
host.addEventListener('pointerdown',e=>{if(!started||busy||where==='stomach')return;host.setPointerCapture(e.pointerId);const kind=hit(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,kind,drag:false,at:performance.now()};});
host.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(Math.hypot(e.clientX-pointer.sx,e.clientY-pointer.sy)>9)pointer.drag=true;if(pointer.drag){holding=false;targetYaw-=(e.clientX-pointer.x)*.004;targetPitch=THREE.MathUtils.clamp(targetPitch-(e.clientY-pointer.y)*.004,-1.5,1.5);}pointer.x=e.clientX;pointer.y=e.clientY;});
function releasePointer(e){if(!pointer||e.pointerId!==pointer.id)return;const p=pointer;pointer=null;holding=false;if(p.drag||busy||document.querySelector('dialog[open]'))return;event('touch',{target:p.kind||'space',durationMs:Math.round(performance.now()-p.at)});if(log.identified.includes(where)&&['wall','exit','entry','tongue'].includes(p.kind)){forward();return;}if(where==='mouth'){if(p.kind==='teeth')chew();else if(['tongue','saliva'].includes(p.kind)||(p.kind==='wall'&&log.chews>=3))wetMouth();else if(p.kind==='exit')forward();else help();}else if(where==='pharynx'){if(p.kind==='airway')failCough();else if(p.kind==='foodway'){swallow();}else hint('食物走哪条路呢？从侧面看看吧。');}else if(where==='small'&&!log.digested)beginIntestinalAbsorption();persist();}
host.addEventListener('pointerup',onPlayerAction(releasePointer));
fixedCanvas.addEventListener('pointerdown',e=>{if(!started||busy||!fixedStage(where))return;fixedCanvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,kind:fixedScenes.pick(where,e.clientX,e.clientY),drag:false,at:performance.now()};});
fixedCanvas.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.sx,e.clientY-pointer.sy)>12)pointer.drag=true;});
fixedCanvas.addEventListener('pointerup',onPlayerAction(releasePointer));fixedCanvas.addEventListener('pointercancel',()=>{pointer=null;});
function advanceFromScene(){
 if($('forward').hidden||busy||reportWaiting||motionRunning||document.querySelector('dialog[open]'))return;
 pointer=null;
 forward();
}
const advanceByHold=onPlayerAction(advanceFromScene);
bindSceneLongPress(host,()=>pointer,advanceByHold);
bindSceneLongPress(fixedCanvas,()=>pointer,advanceByHold);
host.addEventListener('pointercancel',()=>{pointer=null;holding=false;});window.addEventListener('blur',()=>{holding=false;pointer=null;});document.addEventListener('visibilitychange',()=>{holding=false;pointer=null;last=0;persist();});
$('mouth-entry').onclick=onPlayerAction(()=>{if(started)go('mouth');});$('outside-photo').onclick=onPlayerAction(()=>{if(!started)return;const food=$('food-display');food.classList.remove('wrong-entry');void food.offsetWidth;food.classList.add('wrong-entry');hint('这里可进不了身体呀，再找找入口。');event('missed-entry');});
$('forward').onclick=onPlayerAction(forward);$('back').onclick=onPlayerAction(backward);$('map').onclick=()=>{event('locate');showMap(false);};$('close-anatomy').onclick=()=>{clearTimeout(bodyTimer);cancelAnatomyView($('anatomy'));$('anatomy').close();};$('close-knowledge').onclick=()=>{const action=cardAction;cardAction=null;$('knowledge').close();busy=false;action?.();};$('close-micro').onclick=()=>$('micro').close();$('close-fork-side').onclick=()=>$('fork-side').close();$('detail').onclick=()=>{if(where==='small'){$('micro').showModal();event('villi-detail');}else{$('side-food').setAttribute('href',foodArt.bolus.toDataURL());$('fork-side').showModal();event('fork-side-view');}};
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>{const view=b.dataset.look;if(view==='ahead'){targetYaw+=Math.PI/2;targetPitch=0;}else if(view==='behind'){targetYaw+=Math.PI;targetPitch=0;}else targetPitch=view==='up'?.9:-.8;event('look',{direction:view});};
$('fullscreen').onclick=()=>window.requestLessonFullscreen?.();
$('start').onclick=()=>{log=fresh();started=true;companion.unlock();$('intro').hidden=true;go('outside');};$('resume').onclick=()=>{log=saved;started=true;companion.unlock();$('intro').hidden=true;if(log.completedAt){finish();}else go(sequence.includes(log.stage)?log.stage:'outside',{restore:true});};$('replay').onclick=onPlayerAction(()=>{$('hint').hidden=false;restart();});
$('submit').onclick=async()=>{if(!log.completedAt)return;const button=$('submit');button.disabled=true;$('save-status').textContent='正在保存本组发现…';try{await import('./cloud-loader.js');const record=await currentRecord();if(log.lessonRecordId&&record.id!==log.lessonRecordId){$('save-status').textContent='课堂已开始新一轮，请返回课堂重新出发。';return;}record.journey={...log,schema:3,phase:'exit',history:log.events,identified:log.identified,activities:{chews:log.chews,saliva:log.saliva,nutrientAbsorption:log.absorbed,waterAbsorption:log.water}};record.pendingSync=true;await saveRecord(record);const ok=await submitRecord(record);if(ok){record.pendingSync=false;await saveRecord(record);}$('save-status').textContent=ok?'本组发现已提交。':'本机已保存，网络恢复后可再次提交。';}catch{$('save-status').textContent='暂时无法提交，请重试；旅行记录仍保留在本机。';}finally{button.disabled=false;}};
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||!stomachFrame||e.source!==stomachFrame.contentWindow||e.data?.channel!=='food-journey-stomach')return;
 if(e.data.type==='ready'){stomachReady=true;if(where==='stomach'&&transport?.mode!=='passage')stomachFrame.contentWindow.postMessage({channel:'food-journey-parent',type:'enter'},location.origin);return;}
 if(where!=='stomach')return;
 if(e.data.type==='question'){if(e.data.playerAction)onPlayerAction(ask)('stomach');else ask('stomach');}
 if(e.data.type==='advance')organReveal.hidden=true;
 if(e.data.type==='retry'){log.vomits++;event('vomit');organReveal.hidden=true;stage.classList.remove('stomach-question');}
 if(e.data.state){
  const showNavigation=!transport&&['explore','exit'].includes(e.data.state.phase);
  for(const id of ['forward','back'])document.getElementById(id).hidden=!showNavigation;
  const previousWrong=log.stomach?.wrong||0;log.wrong+=Math.max(0,(e.data.state.wrong||0)-previousWrong);log.stomach=e.data.state;foodCurrent=({ 'dispersed-fragments':'gastric','wet-fragments':'gastric' }[e.data.state.foodStage]||e.data.state.foodStage||'bolus');$('food-name').textContent=foodCurrent==='chyme'?'分散细软的食糜':'湿润分散的食物碎块';miniMap.update('stomach',e.data.state.routeProgress||0);liveState();}
 if(e.data.type==='handoff-food'){$('food-display').hidden=true;stage.classList.remove('stomach-handoff');}
 if(e.data.type==='hint')hint(e.data.text,e.data.kind||'hint',{immediate:e.data.opening||e.data.state?.phase==='leaving'?false:e.data.playerAction,opening:e.data.opening});
 else if(e.data.type==='report')card(e.data.title,e.data.text,()=>stomachFrame?.contentWindow.postMessage({channel:'food-journey-parent',type:'knowledge-continue'},location.origin),e.data.label);
 else if(e.data.type==='progress'){if(e.data.event!=='complete')event('stomach-'+e.data.event);}
 else if(e.data.type==='complete'){organReveal.hidden=true;if(!log.identified.includes('stomach')){log.identified.push('stomach');log.discoveries.push({organId:'stomach',at:Date.now()});}event('stomach-complete');go('small');}
 else if(e.data.type==='identified'){$('question').close();revealOrgan('胃',organs.stomach.image);hint('点击“前进”，我们接着走。','praise',{immediate:true,celebrate:true});}
 else if(e.data.type==='restart'){log.vomits++;event('vomit');log.stomach=null;organReveal.hidden=true;stomachFrame.removeAttribute('src');stomachFrame.hidden=true;stomachFrame=null;stomachReady=false;commitScene('stomach');}
});
window.addEventListener('pagehide',persist);
function anatomyProbe(){raycaster.setFromCamera(new THREE.Vector2(0,0),camera);return raycaster.intersectObjects(targets,false).slice(0,6).map(h=>({name:h.object.name,kind:h.object.userData.kind,distance:h.distance,point:h.point.toArray()}));}
$('show-reflection').onclick=()=>$('reflection').showModal();$('close-reflection').onclick=()=>$('reflection').close();
window.journeyGame={get visualState(){return{where,busy,motionTime:time,wallMotion,foodStage:foodTo,foodBlend,preparedScenes:[...preparedTubes.keys()],sceneTimings:sceneTimings.slice(-8),flows:particles.map(p=>({kind:p.kind,start:p.start,end:p.end})),yaw,pitch,canalU,cameraQuaternion:camera?.quaternion.toArray(),camera:camera?.position.toArray(),jawMotion:fixedScenes.chew,jawLift:fixedScenes.chew*34,transition:transport?{mode:transport.mode,to:transport.next,progress:passageView.progress,keepView:transport.keepView}:null};},get state(){return{where,busy,holding,...JSON.parse(JSON.stringify(log))};},get diagnostics(){const visible=[],pickGrid=[];if(canal)for(const x of [.16,.32,.5,.68,.84])for(const y of [.3,.45,.6,.75]){raycaster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);pickGrid.push({x,y,kind:raycaster.intersectObjects(targets,false)[0]?.object.userData.kind});}if(camera&&!fixedStage(where)){for(const o of targets.filter(o=>o.userData.kind!=='wall')){const v=o.getWorldPosition(new THREE.Vector3()).project(camera);if(v.z>1||v.z<0)continue;raycaster.setFromCamera(new THREE.Vector2(v.x,v.y),camera);if(raycaster.intersectObjects(targets,false)[0]?.object.userData.kind===o.userData.kind)visible.push({kind:o.userData.kind,x:(v.x+1)/2,y:(1-v.y)/2});}if(['mouth','pharynx'].includes(where))for(let x=.12;x<.9;x+=.065)for(let y=.26;y<.82;y+=.055){raycaster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);const kind=raycaster.intersectObjects(targets,false)[0]?.object.userData.kind;if(kind&&kind!=='wall')visible.push({kind,x,y});}}if(fixedStage(where))visible.push(...fixedScenes.targets(where));return{pickGrid,fixedView:fixedStage(where),jawMotion:fixedScenes.chew,jawLift:fixedScenes.chew*34,transition:transport?{mode:transport.mode,to:transport.next,progress:passageView.progress}:null,portalProgress:transport?.mode==='passage'?passageView.progress:fixedScenes.progress,webgl:!!renderer,triangles:renderer?.info.render.triangles,particles:particles.length,peristalsis:wallShaders.map(s=>({strength:s.uniforms.uStrength.value,clock:s.uniforms.uClock?.value,maximum:s.uniforms.uSqueeze?.value})),villi:canal?.villi?.count||0,yaw,pitch,camera:camera?.position.toArray(),jaw:jaw?{y:jaw.position.y,rotation:jaw.rotation.x}:null,targets:visible};}};
Object.defineProperty(window.journeyGame,'anatomyProbe',{get:anatomyProbe});
try{await Promise.all([newFoodAtlas.decode(),atlas.decode(),stomachFood.decode(),fractureAtlas.decode(),prepareMucosa(),prepareFixedScenes(),prepareLumenAssets(),$('outside-photo').decode()]);const records=await allRecords();lessonRecordId=records.filter(r=>r.lesson==='food-journey'&&Number(r.groupId)===groupId).sort((a,b)=>Number(b.updatedAt)-Number(a.updatedAt))[0]?.id||null;log=fresh();if((saved?.lessonRecordId??null)!==lessonRecordId)saved=null;prepareArt();init3D();await prepareTubeScenes();if(saved?.stage!=='stomach'){prepareStomach();await new Promise((resolve,reject)=>{const until=performance.now()+60000;const check=()=>{if(stomachReady)resolve();else if(performance.now()>until)reject(Error('Stomach preparation timed out'));else requestAnimationFrame(check);};check();});}food('whole','一块饼干');$('start').disabled=false;$('start').textContent='开始旅行 →';if(saved?.version===3&&saved.groupId===groupId)$('resume').hidden=false;}catch(e){console.error(e);$('failure').hidden=false;}

window.prepareClassNavigation = () => { persist(); };
