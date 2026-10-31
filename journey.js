import { groupId, currentRecord, saveRecord, submitRecord, homeUrl } from './student-data.js';
import { createJourney3D } from './journey-3d.js';

const $ = (id) => document.getElementById(id);
const order = ['outside','mouth','pharynx','esophagus','stomach','small','large','exit'];
const organs = {
  mouth:{name:'口腔', clue:'牙齿磨碎了饼干，唾液也加入了。', options:['口腔','胃','食管'], image:'assets/organs/mouth.png', fact:'牙齿把食物嚼碎；唾液让它湿润，并开始帮助分解饼干中的淀粉。'},
  esophagus:{name:'食管', clue:'管壁一段段收缩，把食团向下推。', options:['气管','食管','小肠'], image:'assets/organs/esophagus.png', fact:'食管通过蠕动把食团送往胃。这里不会像胃一样搅拌食物。'},
  stomach:{name:'胃', clue:'食物从一个入口进来，胃壁和消化液一起搅拌它。', options:['胃','大肠','小肠'], image:'assets/journey/stomach-overview.webp', fact:'胃壁搅拌食物，胃液参与消化；食物逐渐变软、变碎，再从幽门前往小肠。'},
  small:{name:'小肠', clue:'内壁有褶皱和绒毛，营养从这里进入身体。', options:['大肠','食管','小肠'], image:'assets/organs/small-intestine.png', fact:'小肠继续消化食物，吸收大部分营养，也吸收一部分水。'},
  large:{name:'大肠', clue:'剩余食物继续前进，水分被肠壁吸收。', options:['大肠','胃','食管'], image:'assets/organs/large-intestine.png', fact:'大肠吸收剩余的水分，未被吸收的部分继续前行。'}
};
const sceneFiles = {
  outside:'outside.webp',mouth:'mouth.webp',pharynx:'pharynx.webp',
  esophagus:'esophagus.webp',stomach:'stomach.webp',small:'small-intestine.webp',
  large:'large-intestine.webp',exit:'esophagus.webp'
};
const $view=$('game-view'), $hotspots=$('scene-hotspots'), $food=$('food-wrap');
const panorama=createJourney3D($('scene-3d'));
let record, log, scene='outside', started=false, busy=false, revealNext=null, stomachBack=0, view3D=false;
let revealTimers=[];
let pendingSave=Promise.resolve();
let arrivalTimer;
function buildAnatomyArt(id){
  const art=$(id);
  const image=document.createElement('img');image.className='reference-anatomy';
  image.src='assets/journey/digestive-system-clean.png';
  image.alt='依据美国国立卫生研究院教学图制作的无标注消化系统图';
  art.prepend(image);
}
const decoded=new Set();
async function loadSceneImage(id){
  const filename=sceneFiles[id];if(decoded.has(filename))return;
  const img=new Image();img.src=`assets/journey/${filename}`;
  try{await img.decode();decoded.add(filename);}catch(error){console.warn('场景图片未能完整解码',filename,error);}
}

function event(type,extra={}) {
  log.events.push({type,scene,at:Date.now(),...extra});
}
function save() {
  log.phase=scene;log.updatedAt=Date.now();record.journey=log;
  const snapshot={...record,journey:JSON.parse(JSON.stringify(log)),updatedAt:log.updatedAt};
  pendingSave=pendingSave.catch(error=>{console.error('旅程记录暂存失败',error);})
    .then(()=>saveRecord(snapshot));
}
function newLog(attempts=[],history=[]) {
  return {schema:2,startedAt:Date.now(),completedAt:null,phase:'outside',
    attempts,history,events:[],visits:[],discoveries:[],activities:{},forkChoices:[],identified:[],
    state:{chews:0,saliva:false,pushes:0,juice:false,mixing:0,pylorus:false,
      zoom:false,nutrients:[],water:[]}};
}
function progress() {
  $('progress-fill').style.width=`${Math.round(order.indexOf(scene)/(order.length-1)*100)}%`;
  $('step-indicator').textContent=scene==='outside'?'准备出发':scene==='exit'?'旅程终点':'旅行中';
}
function setFoodForm() {
  const form=scene==='outside'?'whole':
    scene==='mouth'?(log.state.saliva?'bolus':log.state.chews>=2?'crumbs':log.state.chews===1?'bitten':'whole'):
    ['pharynx','esophagus'].includes(scene)?'bolus':
    scene==='stomach'?(log.state.mixing>=1?'soft':'bolus'):
    scene==='small'?(log.state.nutrients.length>=3?'residue':'soft'):'residue';
  $food.dataset.form=form;
  $food.dataset.chews=String(log.state.chews);
  $food.dataset.mixing=String(log.state.mixing);
  $food.dataset.juice=String(log.state.juice);
  $food.dataset.nutrients=String(log.state.nutrients.length);
  $food.dataset.water=String(log.state.water.length);
  $food.dataset.pushes=String(log.state.pushes);
  const descriptions={whole:'整块饼干',bitten:'出现裂口',crumbs:'碎成小块',bolus:'湿润的食团',soft:'更细软的食物',residue:'剩余部分'};
  $('food-label').textContent=descriptions[form];
  $food.style.opacity='1';
}
function caption(message){$('scene-caption').textContent=message;}
function dialog(message,callback) {
  $('dialog-text').textContent=message;$('dialog').hidden=false;
  $('dialog-ok').onclick=()=>{$('dialog').hidden=true;callback?.();};
}
function flashFood(className,duration=700) {
  $food.classList.remove(className);void $food.offsetWidth;$food.classList.add(className);
  setTimeout(()=>$food.classList.remove(className),duration);
}
function particles(count,kind,x=50,y=60) {
  for(let i=0;i<count;i++){
    const dot=document.createElement('i');dot.className=`particle ${kind}`;
    dot.style.left=`${x+(Math.random()-.5)*14}%`;dot.style.top=`${y+(Math.random()-.5)*10}%`;
    dot.style.setProperty('--dx',`${(Math.random()-.5)*220}px`);
    dot.style.setProperty('--dy',`${-50-Math.random()*130}px`);
    $('effects').append(dot);setTimeout(()=>dot.remove(),1300);
  }
}
function transferFromFood(kind,count=12){
  const a=$food.getBoundingClientRect(),b=$view.getBoundingClientRect();
  const x=(a.left+a.width/2-b.left)/b.width*100,y=(a.top+a.height/2-b.top)/b.height*100;
  for(let i=0;i<count;i++){
    const dot=document.createElement('i');dot.className=`particle transfer ${kind}`;
    dot.style.left=`${x+(Math.random()-.5)*8}%`;dot.style.top=`${y+(Math.random()-.5)*8}%`;
    const side=i%2?-1:1;
    dot.style.setProperty('--dx',`${side*(b.width*.28+Math.random()*b.width*.1)}px`);
    dot.style.setProperty('--dy',`${(Math.random()-.5)*b.height*.35}px`);
    $('effects').append(dot);setTimeout(()=>dot.remove(),1600);
  }
}
function transferToFood(kind,count=18){
  const a=$food.getBoundingClientRect(),b=$view.getBoundingClientRect();
  const endX=a.left+a.width*.5,endY=a.top+a.height*.47;
  for(let i=0;i<count;i++){
    const dot=document.createElement('i');dot.className=`particle incoming ${kind}`;
    const side=i%2?-1:1;
    const sx=b.left+b.width*(kind==='gastric'?.3+Math.random()*.4:side<0?.23:.77)+(Math.random()-.5)*b.width*.08;
    const sy=b.top+b.height*(kind==='gastric'?.83+Math.random()*.08:.44+Math.random()*.14);
    dot.style.left=`${sx-b.left}px`;dot.style.top=`${sy-b.top}px`;
    dot.style.setProperty('--dx',`${endX-sx+(Math.random()-.5)*a.width*.35}px`);
    dot.style.setProperty('--dy',`${endY-sy+(Math.random()-.5)*a.height*.25}px`);
    dot.style.animationDelay=`${i*32}ms`;
    $('effects').append(dot);setTimeout(()=>dot.remove(),1700);
  }
}
function hotspot(label,x,y,action,options={}) {
  const b=document.createElement('button');b.type='button';b.className=`hotspot ${options.className||''}`;
  b.textContent=label;b.style.left=`${x}%`;b.style.top=`${y}%`;
  b.onclick=(e)=>{e.stopPropagation();action(e,b);};$hotspots.append(b);return b;
}
function markVisit(){
  if(!organs[scene])return;
  if(!log.visits.some(v=>v.organId===scene))log.visits.push({organId:scene,firstAt:Date.now()});
}
async function go(next){
  if(busy)return;
  clearTimeout(arrivalTimer);$('stomach-arrival').hidden=true;
  busy=true;$hotspots.replaceChildren();caption('正在进入下一处……');
  $view.classList.remove('is-traveling');void $view.offsetWidth;$view.classList.add('is-traveling');
  await Promise.all([loadSceneImage(next),new Promise(resolve=>setTimeout(resolve,420))]);
  busy=false;
  scene=next;view3D=next==='esophagus';resetLook();markVisit();event('enter');save();render();
  if(next==='stomach')showStomachArrival();
  setTimeout(()=>$view.classList.remove('is-traveling'),440);
}
function showStomachArrival(){
  const arrival=$('stomach-arrival');arrival.hidden=false;
  arrival.classList.remove('is-playing');void arrival.offsetWidth;arrival.classList.add('is-playing');
  caption('从贲门进入胃。下面的液体是什么？');
  arrivalTimer=setTimeout(()=>{arrival.hidden=true;arrival.classList.remove('is-playing');},3600);
}
function identify(id){
  const organ=organs[id];if(!organ || log.identified.includes(id))return;
  event('identify_prompt',{organId:id});
  $('identify-clue').textContent=organ.clue;
  $('identify-feedback').textContent='';
  const choices=$('identify-options');choices.replaceChildren();
  organ.options.forEach(name=>{
    const b=document.createElement('button');b.type='button';b.textContent=name;
    b.onclick=()=>{
      event('identify_choice',{organId:id,choice:name});
      if(name!==organ.name){b.classList.add('is-wrong');$('identify-feedback').textContent='再看看刚才发现的线索。';save();return;}
      log.identified.push(id);log.discoveries.push({organId:id,at:Date.now()});
      $('identify').hidden=true;showOrgan(id);save();
    };choices.append(b);
  });
  $('identify').hidden=false;
}
function showOrgan(id){
  const o=organs[id];
  const focus={mouth:[25,22],esophagus:[48,41],stomach:[58,61],small:[48,75],large:[31,76]}[id];
  $('organ-image').src=o.image;$('organ-image').alt=o.name+'完整外形';
  $('organ-name').textContent=o.name;$('organ-fact').textContent='它在身体里的位置';
  $('map-marker').dataset.organ=id;
  $('map-marker').dataset.label=o.name;
  $('reveal-art').dataset.current=id;
  $('body-map').hidden=false;$('organ-image').hidden=true;
  $('body-map').classList.remove('is-zooming');
  $('body-map').style.setProperty('--map-origin',`${focus[0]}% ${focus[1]}%`);
  $('reveal-art').style.setProperty('--focus-x',`${focus[0]}%`);
  $('reveal-art').style.setProperty('--focus-y',`${focus[1]}%`);
  $('reveal-close').hidden=true;
  $('organ-reveal').hidden=false;
  revealNext=id;
  revealTimers.forEach(clearTimeout);
  revealTimers=[setTimeout(()=>$('body-map').classList.add('is-zooming'),1450),
    setTimeout(()=>{
      if(revealNext!==id)return;
      $('body-map').hidden=true;$('organ-image').hidden=false;
      $('organ-image').classList.remove('detail-enter');void $('organ-image').offsetWidth;
      $('organ-image').classList.add('detail-enter');
      $('organ-fact').textContent=o.fact;
      $('reveal-close').hidden=false;
    },3450)];
}
function finishReveal(){
  if($('reveal-close').hidden)return;
  $('organ-reveal').hidden=true;
  if(revealNext==='stomach'){
    caption('看看胃壁的另一端，哪儿渐渐收窄？');$('location-button').hidden=false;renderHotspots();revealNext=null;return;
  }
  if(revealNext==='mouth')go('pharynx');
  if(revealNext==='esophagus')go('stomach');
  if(revealNext==='small')go('large');
  if(revealNext==='large')go('exit');
  revealNext=null;
}
function render(){
  $view.dataset.scene=scene;
  $('location-panel').hidden=true;
  $('location-button').hidden=!['mouth','pharynx','esophagus','stomach','small','large'].includes(scene);
  syncViewMode();
  $('scene-image').style.backgroundImage=`url("assets/journey/${sceneFiles[scene]}")`;
  $('scene-image').style.filter='';
  updateTravel();
  $('micrograph').hidden=scene!=='small'||!log.state.zoom;
  $('effects').replaceChildren();setFoodForm();progress();renderHotspots();
  $('backward').disabled=scene==='outside'||scene==='exit';
  $('forward').disabled=false;
  $('game-status').textContent='';
  const messages={
    outside:'找到入口，送饼干出发。',mouth:log.state.saliva?'碎屑变湿润了。':log.state.chews>=2?'碎屑还很干，谁来帮忙？':'这么大块的饼干，能直接咽下去吗？',
    pharynx:'两条路，食物要走哪一条？',esophagus:log.state.pushes?'管壁正在把食物向前推。':'观察管壁的动作。',
    stomach:log.state.mixing?'食物正在变软、变细。':'看看食物遇到了什么。',small:log.state.zoom?'轻触食物，观察营养的去向。':'贴近内壁看看。',
    large:'轻触剩余食物，观察水分的去向。',exit:'来到消化道末端，回想饼干一路的变化。'
  };caption(messages[scene]);
}
function updateTravel(){
  const image=$('scene-image');
  const count=scene==='esophagus'?log.state.pushes:scene==='small'?log.state.nutrients.length:scene==='large'?log.state.water.length:0;
  image.style.setProperty('--travel-scale',String(1.17+count*(scene==='esophagus'?.17:.065)));
  image.style.setProperty('--travel-x',scene==='small'||scene==='large'?`${-count*2}%`:'0%');
  image.style.setProperty('--travel-y',`${-count*(scene==='esophagus'?4:1.5)}%`);
}
function outsideHit(e){
  const box=$view.getBoundingClientRect(),x=(e.clientX-box.left)/box.width,y=(e.clientY-box.top)/box.height;
  // The generated image uses cover cropping; the mouth occupies a broad central area.
  if(x>.41&&x<.59&&y>.47&&y<.71){
    event('mouth_entry',{x:+x.toFixed(3),y:+y.toFixed(3)});
    busy=true;flashFood('is-swallowing',1050);
    setTimeout(()=>{busy=false;go('mouth');},1000);
  }else{
    event('missed_mouth',{x:+x.toFixed(3),y:+y.toFixed(3)});flashFood('is-hit');
    caption('这里进不了身体。饼干该从哪里进去？');save();
  }
}
function chew(){
  if(log.state.chews>=3)return;
  log.state.chews++;log.activities.mouth=log.state.chews;
  event('chew',{count:log.state.chews});flashFood('is-chewing',550);particles(7,'',48,54);
  if(log.state.chews===2)caption('咔嚓！饼干裂开，变成小块。');
  if(log.state.chews===3)caption('碎屑还很干，周围有什么能帮忙？');
  setFoodForm();renderHotspots();save();
}
function addSaliva(){
  if(log.state.chews<2){dialog('先让牙齿嚼一嚼。');return;}
  log.state.saliva=true;event('saliva_mix');busy=true;transferToFood('water',24);
  renderHotspots();caption('唾液正流向干燥的饼干碎屑。');save();
  setTimeout(()=>{busy=false;setFoodForm();caption('碎屑被唾液湿润，聚成了食团。');
    dialog('唾液和碎屑混在一起，形成了更容易吞咽的食团。',()=>identify('mouth'));},1150);
}
function chooseRoute(choice){
  log.forkChoices.push({choice,at:Date.now()});event('route_choice',{choice});save();
  if(choice==='trachea'){
    busy=true;$view.classList.add('cough');caption('咳咳！食物走错路啦。');
    setTimeout(()=>{$view.classList.remove('cough');busy=false;fail('trachea');},900);
  }else{dialog('食团进入了后方的通道。',()=>go('esophagus'));}
}
function push(){
  if(log.state.pushes>=3||busy)return;
  busy=true;
  log.state.pushes++;log.activities.esophagus=log.state.pushes;
  event('peristalsis',{wave:log.state.pushes});
  flashFood('is-propelled',800);$view.classList.remove('wave-run');void $view.offsetWidth;$view.classList.add('wave-run');
  setTimeout(()=>$view.classList.remove('wave-run'),1400);
  caption(`管壁接力收缩，食物向前移动了。`);
  setFoodForm();
  $('scene-image').style.setProperty('--travel-scale',String(1.17+log.state.pushes*.17));
  $('scene-image').style.setProperty('--travel-y',`${-log.state.pushes*4}%`);
  panorama.travel(log.state.pushes);
  $('scene-3d').dataset.progress=String(log.state.pushes);
  renderHotspots();save();
  setTimeout(()=>{busy=false;if(log.state.pushes===3)dialog('管壁接力收缩，把食团送到了下方。',()=>identify('esophagus'));},1000);
}
function mix(){
  log.state.mixing=Math.min(3,log.state.mixing+1);log.activities.stomach=log.state.mixing;
  event('stomach_mix',{count:log.state.mixing});
  flashFood('is-mixing',1000);particles(12,'',55,62);setFoodForm();
  caption(log.state.mixing>=2?'食物已经变得更细软。':'胃壁正搅动食物和胃液。');
  if(log.state.mixing===3&&log.state.juice)dialog('食物变得更软、更碎了。',()=>identify('stomach'));
  renderHotspots();save();
}
function juice(){
  if(log.state.juice)return;log.state.juice=true;event('gastric_juice');
  busy=true;transferToFood('gastric',36);flashFood('is-soaking',1450);setFoodForm();caption('胃液汇入食团，观察它接下来会怎样变化。');
  renderHotspots();save();
  setTimeout(()=>{busy=false;dialog('胃液与食团混合；接着看看胃壁的动作。');},1450);
}
function zoomVilli(){
  if(log.state.zoom)return;log.state.zoom=true;event('villi_zoom');
  $('micrograph').hidden=false;renderHotspots();
  dialog('显微镜下，褶皱上有许多细小的绒毛。');save();
}
function absorbNutrient(index){
  if(log.state.nutrients.includes(index))return;
  log.state.nutrients.push(index);event('nutrient_absorbed',{particle:index});
  transferFromFood('nutrient',64);flashFood('is-absorbing',1350);setFoodForm();renderHotspots();
  updateTravel();
  caption('一部分营养从食物中离开，穿过肠壁。');
  if(log.state.nutrients.length===3)dialog('一部分营养穿过肠壁，进入身体。',()=>identify('small'));
  save();
}
function absorbWater(index){
  if(log.state.water.includes(index))return;
  log.state.water.push(index);event('water_absorbed',{droplet:index});
  transferFromFood('water',28);setFoodForm();renderHotspots();
  updateTravel();
  caption('水分从剩余食物中离开，被肠壁吸收。');
  if(log.state.water.length===3)dialog('剩余食物的水分又少了一些。',()=>identify('large'));
  save();
}
function renderHotspots(){
  $hotspots.replaceChildren();
  $food.querySelector('.food-touch')?.remove();
  if(scene==='outside'){
    const target=document.createElement('button');target.type='button';target.className='outside-target';
    target.setAttribute('aria-label','点选口腔入口');target.onclick=outsideHit;$hotspots.append(target);return;
  }
  if(scene==='mouth'){
    if(log.state.chews<3){
      [[16,7],[84,7],[16,93],[84,93]].forEach(([x,y])=>hotspot('',x,y,chew,{className:'tooth-target'}));
    }
    if(!log.state.saliva&&log.state.chews>=2)hotspot('看看唾液',53,65,addSaliva);
  }
  if(scene==='pharynx'){
    hotspot('靠前的通道',49,73,()=>chooseRoute('trachea'));
    hotspot('靠后的通道',71,73,()=>chooseRoute('esophagus'));
  }
  if(scene==='esophagus'&&log.state.pushes<3){
    hotspot('食管左侧管壁',21,48,push,{className:'wall-target'});
    hotspot('食管右侧管壁',79,48,push,{className:'wall-target'});
  }
  if(scene==='stomach'){
    if(!log.state.juice)hotspot('观察液体',52,76,juice);
    if(log.state.mixing<3)hotspot('跟着内壁搅动',32,36,mix);
    if(log.identified.includes('stomach')&&!log.state.pylorus)
      hotspot('胃壁收窄处',92,27,()=>{log.state.pylorus=true;event('pylorus_found');
        dialog('找到了！食物从幽门进入小肠。',()=>go('small'));save();},{className:'pylorus-target'});
  }
  if(scene==='small'){
    if(!log.state.zoom)hotspot('靠近内壁',36,41,zoomVilli);
    else if(log.state.nutrients.length<3)foodTouch(()=>absorbNutrient(log.state.nutrients.length));
  }
  if(scene==='large'&&log.state.water.length<3)
    foodTouch(()=>absorbWater(log.state.water.length));
}
function foodTouch(action){
  const target=document.createElement('button');target.type='button';target.className='food-touch';
  target.setAttribute('aria-label','轻触食物');target.onclick=e=>{e.stopPropagation();action();};
  $food.append(target);
}
function forward(){
  if(!started||busy||!$('identify').hidden||!$('organ-reveal').hidden||!$('dialog').hidden||!$('location-panel').hidden)return;
  event('forward_try');
  if(scene==='outside'){caption('点到口腔，饼干才能进入身体。');return;}
  if(scene==='mouth'){
    if(log.state.chews<3){caption('饼干还这么大块，咽得下去吗？');return;}
    if(!log.state.saliva){caption('太干啦，咽不下去。周围有什么能帮忙？');return;}
    if(log.identified.includes('mouth'))go('pharynx');else identify('mouth');return;
  }
  if(scene==='pharynx'){caption('先选一条通道。');return;}
  if(scene==='esophagus'){if(log.state.pushes<3)caption('食团还停着，摸摸两侧管壁。');else if(log.identified.includes('esophagus'))go('stomach');else identify('esophagus');return;}
  if(scene==='stomach'){
    if(!log.state.juice){caption('下方的液体是什么？它会怎样改变食物？');return;}
    if(log.state.mixing<3){caption('胃壁正在动，食物会有什么变化？');return;}
    if(!log.identified.includes('stomach'))identify('stomach');else caption('另一端有个收窄的通道，找找看。');
    return;
  }
  if(scene==='small'){if(!log.state.zoom||log.state.nutrients.length<3)caption('食物还在变化，再看看内壁。');else if(log.identified.includes('small'))go('large');else identify('small');return;}
  if(scene==='large'){if(log.state.water.length<3)caption('剩余食物还在变化，轻触它看看。');else if(log.identified.includes('large'))go('exit');else identify('large');return;}
  if(scene==='exit')void finish();
}
function backward(){
  if(!started||busy||!$('identify').hidden||!$('organ-reveal').hidden||!$('dialog').hidden||!$('location-panel').hidden)return;
  event('backward_try');save();
  if(scene==='mouth'){flashFood('is-hit');caption('还没吞咽，饼干向嘴边退了一点。');}
  if(scene==='pharynx')go('mouth');
  if(scene==='esophagus'){flashFood('is-hit');caption('管壁一缩，又把食团推向胃。');}
  if(scene==='stomach'){
    stomachBack++;
    if(stomachBack===1){caption('咦，进来的门已经关上了！');dialog('贲门通常会帮助阻止胃里的东西倒流。');}
    else{
      event('vomit_branch');save();
      busy=true;caption('身体突然发生呕吐，胃里的食物被向上排出。');
      flashFood('is-swallowing',1100);setTimeout(()=>{busy=false;fail('vomit');},1200);
    }
  }
  if(scene==='small'||scene==='large'){flashFood('is-hit');caption('肠壁正在推动食物向前。');}
}
function fail(reason){
  log.attempts.push({reason,at:Date.now()});event('attempt_failed',{reason});save();
  started=false;
  $('ending').classList.remove('is-success');$('ending-start').hidden=true;$('award-track').hidden=true;$('ending-foods').hidden=true;$('ending-feedback').hidden=true;$('ending-home').hidden=true;$('game').classList.remove('journey-complete');
  $('ending-title').textContent=reason==='trachea'?'咳咳，走错路啦！':'哎呀，身体把食物送出来啦！';
  $('ending-text').textContent=reason==='trachea'?'气管是空气的路。再帮饼干找到食物的路吧。':'这次从入口重新出发，看看正常的旅行路线。';
  $('ending-button').textContent='重新出发';$('ending-button').onclick=restart;$('ending').hidden=false;
}
function restart(){
  clearTimeout(arrivalTimer);$('stomach-arrival').hidden=true;
  const attempts=log.attempts;
  const history=Array.isArray(log.history)?[...log.history]:[];
  if(log.completedAt)history.push({startedAt:log.startedAt,completedAt:log.completedAt,identified:log.identified,activities:log.activities,forkChoices:log.forkChoices});
  log=newLog(attempts,history.slice(-8));scene='outside';view3D=false;stomachBack=0;resetLook();
  $('ending').classList.remove('is-success');$('ending-start').hidden=true;$('award-track').hidden=true;$('ending-foods').hidden=true;$('ending-feedback').hidden=true;$('ending-home').hidden=true;$('game').classList.remove('journey-complete');
  $('ending').hidden=true;started=true;save();render();
}
function successFeedback(){
  const notes=[];
  if(log.attempts.some(item=>item.reason==='trachea'))notes.push('咽部曾选到气管；再次尝试后，食团找到了食管。');
  if(log.attempts.some(item=>item.reason==='vomit')||log.events.some(item=>item.type==='backward_try'&&item.scene==='stomach'))notes.push('胃里尝试过后退；贲门通常会阻止胃内容物倒流。');
  if(notes.length<2&&log.events.some(item=>item.type==='identify_choice'&&organs[item.organId]&&item.choice!==organs[item.organId].name))notes.push('辨认器官时重新核对过线索；还可以比较它们的外形和作用。');
  return notes.length?notes.slice(0,2).join(' '):'这次完成了整条路线。再走一次，看看饼干在哪些位置发生了变化。';
}
function showSuccess(){
  $('ending').classList.add('is-success');$('ending-start').hidden=false;$('award-track').hidden=false;$('ending-foods').hidden=false;$('ending-feedback').hidden=false;$('ending-home').hidden=false;$('game').classList.add('journey-complete');
  $('ending-title').textContent='饼干旅行完成！';
  $('ending-group').textContent=groupId;
  $('ending-text').textContent='沿着路线看看：饼干在每一站怎样变化？';
  $('ending-feedback-text').textContent=successFeedback();
  $('ending-button').textContent='再旅行一次';$('ending-button').onclick=restart;
  $('ending-home').onclick=()=>location.href=homeUrl();
  $('ending').hidden=false;
}
async function finish(){
  if(log.completedAt)return;
  log.completedAt=Date.now();event('completed');started=false;save();
  const completedRecord=JSON.parse(JSON.stringify(record));
  showSuccess();
  try{await pendingSave;const uploaded=await submitRecord(completedRecord,{saveLocal:false});if(!uploaded)$('game-status').textContent='记录留在本机';}
  catch(error){console.error(error);$('game-status').textContent='记录留在本机';}
}
async function init(){
  buildAnatomyArt('reveal-art');buildAnatomyArt('location-art');
  $('group-label').textContent=`第 ${groupId} 组`;$('back-link').href=homeUrl();
  record=await currentRecord();
  if(record.journey?.schema===2&&record.journey.completedAt){
    log=record.journey;scene='exit';started=false;
    await loadSceneImage(scene);render();$('opening').hidden=true;
    showSuccess();return;
  }
  log=record.journey?.schema===2?record.journey:newLog(record.journey?.attempts||[]);
  log.state ||= newLog().state;
  scene=order.includes(log.phase)?log.phase:'outside';view3D=scene==='esophagus';
  started=false;await loadSceneImage(scene);render();
}
$('fullscreen').onclick=()=>window.requestLessonFullscreen?.();
$('location-button').onclick=()=>{
  $('location-marker').dataset.organ=scene;
  $('location-marker').dataset.label=log.identified.includes(scene)?organs[scene]?.name||'':'';
  $('location-art').dataset.current=scene;
  $('location-name').textContent=log.identified.includes(scene)?`现在在：${organs[scene]?.name||'消化道'}`:'看看周围，你现在在哪里？';
  $('location-panel').hidden=false;
};
$('location-close').onclick=()=>$('location-panel').hidden=true;
$('view-mode').onclick=()=>{view3D=!view3D;syncViewMode();};
$('start').onclick=()=>{$('opening').hidden=true;started=true;event('started');save();render();};
$('forward').onclick=forward;$('backward').onclick=backward;
$('reveal-close').onclick=finishReveal;
let lookStart=null,lookX=0,lookY=0;
function resetLook(){lookX=0;lookY=0;applyLook();}
function applyLook(){
  $('scene-image').style.setProperty('--look-x',`${lookX}px`);
  $('scene-image').style.setProperty('--look-y',`${lookY}px`);
  $hotspots.style.translate=scene==='stomach'?'0 0':`${lookX}px ${lookY}px`;
}
function syncViewMode(){
  const supported=scene==='esophagus';
  $('view-mode').hidden=!supported;
  if(supported&&view3D&&panorama.show(scene,scene==='esophagus'?log.state.pushes:0)){
    $view.classList.add('in-3d');$('view-mode').textContent='返回器官画面';
    $('scene-3d').dataset.progress=String(scene==='esophagus'?log.state.pushes:0);
  }else{
    view3D=false;panorama.hide();$view.classList.remove('in-3d');$('view-mode').textContent='360° 环顾';
  }
}
$view.addEventListener('pointerdown',e=>{
  if(!started||!['esophagus','stomach','small','large'].includes(scene)||e.target.closest('button,.dialog,.identify,.organ-reveal'))return;
  lookStart={x:e.clientX,y:e.clientY,ox:lookX,oy:lookY};
});
$view.addEventListener('pointermove',e=>{
  if(!lookStart)return;
  if(view3D){panorama.look(e.clientX-lookStart.x,e.clientY-lookStart.y);lookStart.x=e.clientX;lookStart.y=e.clientY;return;}
  const width=$view.clientWidth,height=$view.clientHeight;
  lookX=Math.max(-width*.08,Math.min(width*.08,lookStart.ox+e.clientX-lookStart.x));
  lookY=Math.max(-height*.08,Math.min(height*.08,lookStart.oy+e.clientY-lookStart.y));
  applyLook();
});
window.addEventListener('pointerup',()=>lookStart=null);
window.addEventListener('resize',()=>panorama.resize());
window.addEventListener('keydown',e=>{if(e.repeat)return;if(e.key==='ArrowUp')forward();if(e.key==='ArrowDown')backward();});
window.addEventListener('pagehide',()=>{if(record&&started)save();});
init().catch(error=>{$('game-status').textContent='记录无法读取';console.error(error);});
