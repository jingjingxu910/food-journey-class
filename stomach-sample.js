import {bindSceneLongPress} from './journey-long-press.js';
import {stomachWallWave} from './journey-wall-wave.js';
import * as THREE from './vendor/three.module.js';
import {neckMaterial,blendNeck} from './journey-neck.js';
import {showAnatomyView,cancelAnatomyView} from './journey-anatomy-zoom.js';

// Local, isolated vertical slice. No CloudBase SDK, remote requests or student records.
const $ = id => document.getElementById(id);
const voyageParams=new URLSearchParams(location.search),inVoyage=voyageParams.get('voyage')==='1'&&window.parent!==window;
let voyageRestore=null;try{voyageRestore=JSON.parse(voyageParams.get('restore')||'null');}catch{}
if(inVoyage)document.documentElement.dataset.voyage='true';
let playerAction=false;
function withPlayerAction(action){
 const previous=playerAction;playerAction=true;
 try{return action();}finally{playerAction=previous;}
}
function voyageMessage(type,extra={}){if(inVoyage)parent.postMessage({channel:'food-journey-stomach',type,playerAction,state:{...state,seen:[...state.seen]},...extra},location.origin);}
const stage=$('stage'),host=$('world'),clock=new THREE.Clock();
const state={phase:'ready',fluid:false,motion:0,mixed:0,wrong:0,back:0,identified:false,finished:false,routeProgress:0,foodStage:'bolus',mixing:false,seen:new Set()};
let renderer,scene,camera,wall,liquid,food,gate,cardia,materialShader,liquidShader,foodInstances,bubbleInstances,bolusSprite,chymeSprite,wetCoat,wetSheen;
let wetUntil=0;
let elapsed=0,lastDraw=0,held=false,pointer=null,moving=null,viewTween=null,viewYaw=0,viewPitch=0,lastProgressAt=0;
let chymeInstances=null;
let desiredYaw=0,desiredPitch=0,anatomyTimer=0,ready=false,frame=0,photoFood=null,photoFoodShader=null;
const foodParts=[],drops=[],bubbles=[],targets=[],raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
const p=new THREE.Vector3(),q=new THREE.Vector3(),lookPoint=new THREE.Vector3();
const orientationProbe=new THREE.PerspectiveCamera();orientationProbe.rotation.order='YXZ';
const route=new THREE.CatmullRomCurve3([
 new THREE.Vector3(-2.5,7,0),new THREE.Vector3(-2.5,4.5,0),new THREE.Vector3(-2.1,2.7,0),
 new THREE.Vector3(-1.4,.8,0),new THREE.Vector3(.2,-.5,0),new THREE.Vector3(2.9,-1.15,0),
 new THREE.Vector3(4.6,-2.05,0),new THREE.Vector3(6.7,-2.12,0)
],false,'catmullrom',.32);
const points={entry:route.getPointAt(.17),pool:new THREE.Vector3(.1,-1.7,0),exit:route.getPointAt(.82)};
const routeRadii=[[0,.59],[.15,.65],[.26,1.35],[.38,2.22],[.52,2.35],[.62,2.02],[.7,1.45],[.76,.9],[.84,.43],[1,.55]];
function radius(u){for(let i=1;i<routeRadii.length;i++)if(u<=routeRadii[i][0]){const [a,x]=routeRadii[i-1],[b,y]=routeRadii[i];const f=THREE.MathUtils.smoothstep(u,a,b);return THREE.MathUtils.lerp(x,y,f);}return .55;}
function hint(text,kind='hint'){$('hint').textContent=text.replaceAll('周围的液体','下方的液体').replace('呢？再观察','呢？\n再观察');voyageMessage('hint',{text:$('hint').textContent,kind});}
function record(type){state.seen.add(type);try{sessionStorage.setItem('stomach-sample-observation',JSON.stringify({fluid:state.fluid,mixed:state.mixed,wrong:state.wrong,back:state.back,seen:[...state.seen]}));}catch{}voyageMessage('progress',{event:type});}
function progress(n,label){$('progress').value=n;$('step-label').textContent=label;}
function setFoodDepthTest(value){for(const s of [bolusSprite,chymeSprite,wetCoat,wetSheen])if(s&&s.material.depthTest!==value){s.material.depthTest=value;s.material.needsUpdate=true;}}
let evidenceKey;
function evidence(){const lines=[];if(state.fluid)lines.push('✓ 食物与胃液接触，更湿润了');if(state.mixed>.35)lines.push('✓ 碎块分散，反复翻动、混合');if(state.mixed>.9)lines.push('✓ 颗粒变细，逐渐成为食糜');const key=lines.join('|');if(key===evidenceKey)return;evidenceKey=key;$('evidence').replaceChildren(...lines.map(t=>{const d=document.createElement('div');d.textContent=t;return d;}));$('observation').hidden=!lines.length;}
function noiseTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const u=x/512*Math.PI*2,v=y/512*Math.PI*2;
  const pores=Math.sin(u*73+Math.sin(v*7))*Math.sin(v*67+Math.sin(u*9));
  const fine=Math.sin(u*127+v*39)*Math.cos(v*121-u*43);
  const vessels=Math.pow(Math.max(0,Math.cos(u*7+Math.sin(v*3)*1.7+Math.sin(v*7)*.15)),32)*9;
  const shade=pores*5+fine*2+Math.sin(u*3+v*2)*5;
  const k=(y*512+x)*4;image.data[k]=206+shade;image.data[k+1]=119+shade-vessels;image.data[k+2]=110+shade-vessels;image.data[k+3]=255;
 }
 ctx.putImageData(image,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);t.colorSpace=THREE.SRGBColorSpace;
 const source=new Image();source.onload=()=>{
  ctx.clearRect(0,0,512,512);
  // Mirror one clean mucosa patch into four quadrants. Mirroring makes every
  // outer edge meet its opposite edge without the dark triangular joins from
  // the earlier crop.
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   ctx.save();ctx.translate(x?512:0,y?512:0);ctx.scale(x?-1:1,y?-1:1);
   ctx.drawImage(source,820,45,300,255,0,0,256,256);ctx.restore();
  }
  t.needsUpdate=true;
 };source.src='assets/journey/stomach.webp';
 return t;
}
function buildWall(){
 const n=192,m=88,g=new THREE.TubeGeometry(route,n,1,m,false),pos=g.attributes.position,uv=g.attributes.uv;
 for(let j=0;j<=n;j++){
  const u=j/n,center=route.getPointAt(u),r=radius(u);
  for(let i=0;i<=m;i++){
   const k=j*(m+1)+i,a=i/m*Math.PI*2;
   p.fromBufferAttribute(pos,k).sub(center);
   // Broad longitudinal gastric rugae, with rounded smaller folds; not intestinal villi.
   const folds=(.10*Math.cos(a*13+Math.sin(u*17)*.8)+.025*Math.cos(a*27+u*20))*Math.sin(u*Math.PI)*Math.min(1,r*.4);
   p.multiplyScalar(r+folds);pos.setXYZ(k,center.x+p.x,center.y+p.y,center.z+p.z);
  }
 }
 g.computeVertexNormals();
 // Share identical normals at the UV seam to avoid a visible model join.
 for(let j=0;j<=n;j++){const a=j*(m+1),b=a+m;p.fromBufferAttribute(g.attributes.normal,a).add(q.fromBufferAttribute(g.attributes.normal,b)).normalize();g.attributes.normal.setXYZ(a,p.x,p.y,p.z);g.attributes.normal.setXYZ(b,p.x,p.y,p.z);}
 const texture=noiseTexture();
 const mat=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.045,roughness:.34,metalness:0,side:THREE.BackSide});
 mat.onBeforeCompile=s=>{
  s.uniforms.uTime={value:0};s.uniforms.uMotion={value:0};
  s.vertexShader='uniform float uTime; uniform float uMotion;\n'+stomachWallWave+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed-=normal*stomachWallWave(uv.x,uTime)*uMotion*smoothstep(.19,.28,uv.x)*(1.0-smoothstep(.76,.85,uv.x));');materialShader=s;
 };if(inVoyage){blendNeck(mat,6/n,186/n);g.clearGroups();const perRing=m*6;g.addGroup(0,6*perRing,1);g.addGroup(6*perRing,(186-6)*perRing,0);g.addGroup(186*perRing,(n-186)*perRing,1);}wall=new THREE.Mesh(g,inVoyage?[mat,neckMaterial()]:mat);wall.userData.kind='wall';scene.add(wall);targets.push(wall);
 // A continuous, slightly larger lining sits behind the detailed wall. It keeps
 // the tight bends around the stomach body watertight instead of exposing the
 // renderer background between overlapping tube triangles.
 const linerGeo=new THREE.TubeGeometry(route,224,1,92,false),linerPos=linerGeo.attributes.position;
 for(let j=0;j<=224;j++){
  const u=j/224,center=route.getPointAt(u),r=radius(u)*1.075;
  for(let i=0;i<=92;i++){const k=j*93+i;p.fromBufferAttribute(linerPos,k).sub(center).multiplyScalar(r);linerPos.setXYZ(k,center.x+p.x,center.y+p.y,center.z+p.z);}
 }
 linerGeo.computeVertexNormals();
 const linerMat=new THREE.MeshBasicMaterial({map:texture,color:0xffffff,side:THREE.BackSide});
 const liner=new THREE.Mesh(linerGeo,linerMat);liner.renderOrder=-2;scene.add(liner);
}
function buildLiquid(){
 const geo=new THREE.PlaneGeometry(6.5,4.3,50,36);geo.rotateX(-Math.PI/2);
 const mat=new THREE.MeshStandardMaterial({color:0xc7aa7b,roughness:.2,metalness:.16,transparent:true,opacity:.82,depthWrite:false,side:THREE.DoubleSide});
 mat.onBeforeCompile=s=>{
  s.uniforms.uTime={value:0};s.uniforms.uMotion={value:0};s.vertexShader='uniform float uTime;uniform float uMotion;varying vec2 vLiquid;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLiquid=position.xz;transformed.y+=sin(position.x*3.5+uTime*1.6)*cos(position.z*4.0-uTime)*(.045+uMotion*.12);');
  s.fragmentShader='uniform float uTime;uniform float uMotion;varying vec2 vLiquid;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(dot(vLiquid/vec2(3.25,2.15),vLiquid/vec2(3.25,2.15))>1.0)discard;float ripple=sin(vLiquid.x*15.0+sin(vLiquid.y*9.0+uTime)*2.0-uTime*2.0)*cos(vLiquid.y*13.0+uTime);diffuseColor.rgb*=.89+.11*ripple;diffuseColor.rgb+=vec3(.24,.18,.09)*pow(max(0.0,ripple),12.0);');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal=normalize(normal+vec3(cos(vLiquid.x*3.5+uTime*1.6)*.25,sin(vLiquid.y*4.0-uTime)*.25,0.0));');liquidShader=s;
 };
 liquid=new THREE.Mesh(geo,mat);liquid.position.set(.1,-1.65,0);liquid.userData.kind='fluid';scene.add(liquid);targets.push(liquid);
 const bubbleGeo=new THREE.SphereGeometry(1,12,8),bubbleMat=new THREE.MeshStandardMaterial({color:0xf3d29e,transparent:true,opacity:.35,roughness:.2,metalness:.1});
 bubbleInstances=new THREE.InstancedMesh(bubbleGeo,bubbleMat,28);scene.add(bubbleInstances);
 for(let i=0;i<28;i++){const a=i*2.3999,r=.3+Math.sqrt((i+.4)/28)*2;const mesh=new THREE.Object3D();mesh.position.set(.1+Math.cos(a)*r,-1.59,Math.sin(a)*r*.75);mesh.scale.setScalar(.025+(i%5)*.012);mesh.userData.initial=mesh.position.clone();mesh.updateMatrix();bubbleInstances.setMatrixAt(i,mesh.matrix);bubbles.push(mesh);}
}
function opening(at,label,kind){
 const center=route.getPointAt(at),dir=route.getTangentAt(at);
 const group=new THREE.Group();group.position.copy(center);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);
 // The connected stomach wall already forms the neck. Only its contracted
 // mucosal folds close here; no separate torus or flat circular door is drawn.
 const ring=new THREE.Object3D();group.add(ring);const positions=[],uv=[],indices=[],rings=18,sides=72,r=radius(at)*1.045;
 for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){const f=j/rings,a=i/sides*Math.PI*2,rr=r*f*(1+.025*Math.cos(a*7)*Math.sin(f*Math.PI)),depth=.14*(1-f*f)+.075*Math.cos(a*7+.2*Math.sin(a*3))*Math.sin(f*Math.PI);positions.push(Math.cos(a)*rr,Math.sin(a)*rr,depth);uv.push(.5+.48*f*Math.cos(a),.5+.48*f*Math.sin(a));if(j<rings&&i<sides){const k=j*(sides+1)+i,n=k+sides+1;indices.push(k,k+1,n,k+1,n+1,n);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const wallMaterial=Array.isArray(wall.material)?wall.material[0]:wall.material;const shutter=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:wallMaterial.map,bumpMap:wallMaterial.map,bumpScale:.018,color:0xf3d5c4,roughness:.4,side:THREE.DoubleSide}));shutter.userData.kind=kind;group.add(shutter);targets.push(shutter);
 const dot=document.createElement('div');dot.className='landmark';dot.textContent=label;dot.hidden=true;$('landmarks').append(dot);
 scene.add(group);return{group,ring,shutter,dot,at};
}
function foodTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#e5b976';ctx.fillRect(0,0,256,256);
 let seed=9;for(let i=0;i<3000;i++){seed=(seed*16807)%2147483647;const x=seed%256;seed=(seed*16807)%2147483647;const y=seed%256;ctx.fillStyle=i%3?'#f2cd9299':'#a66b3699';ctx.fillRect(x,y,1+i%3,1+i%2);}const texture=new THREE.CanvasTexture(c),image=new Image();image.onload=()=>{ctx.drawImage(image,image.width*.18,image.height*.32,image.width*.13,image.height*.26,0,0,256,256);texture.needsUpdate=true;};image.src='assets/journey/stomach-food-sample.webp';return texture;
}
function enterVoyage(){begin();animateFood(elapsed);placeFood();renderScene();}
function worldFrame(){food.traverse(o=>o.layers.set(1));if(inVoyage&&state.phase==='ready')cardia.shutter.visible=false;if(materialShader){materialShader.uniforms.uTime.value=elapsed;materialShader.uniforms.uMotion.value=state.motion;}if(liquidShader){liquidShader.uniforms.uTime.value=elapsed;liquidShader.uniforms.uMotion.value=state.motion;}camera.layers.set(0);renderer.render(scene,camera);return renderer.domElement;}
function capturePassage(){const source=worldFrame(),frame=document.createElement('canvas');frame.width=source.width;frame.height=source.height;frame.getContext('2d').drawImage(source,0,0);camera.updateMatrixWorld(true);const a=wall.geometry.attributes.position,m=wall.geometry.parameters.radialSegments,start=a.count-m-1,points=[];for(let i=0;i<m;i+=2){const v=new THREE.Vector3().fromBufferAttribute(a,start+i).project(camera);points.push({x:(v.x+1)/2,y:(1-v.y)/2});}const v=route.getPointAt(1).project(camera);return{frame,points,focus:{x:(v.x+1)/2,y:(1-v.y)/2}};}
function captureFood(){
 const iconScene=new THREE.Scene(),clone=food.clone(true);clone.position.set(0,0,0);clone.scale.setScalar(1);iconScene.add(clone);const ambient=new THREE.HemisphereLight(0xffdfc7,0x6a3027,1.25),light=new THREE.PointLight(0xffe7d5,16,18,1.7);ambient.layers.enable(1);light.layers.enable(1);light.position.set(0,.3,2.7);iconScene.add(ambient,light);const iconCamera=new THREE.OrthographicCamera(-.89,.89,.89,-.89,.1,10);iconCamera.position.z=4;iconCamera.layers.set(1);const target=new THREE.WebGLRenderTarget(256,256),pixels=new Uint8Array(256*256*4),oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha(),oldAuto=renderer.autoClear;target.texture.colorSpace=THREE.SRGBColorSpace;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.autoClear=true;renderer.render(iconScene,iconCamera);renderer.readRenderTargetPixels(target,0,0,256,256,pixels);const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),data=x.createImageData(256,256);for(let row=0;row<256;row++)data.data.set(pixels.subarray(row*1024,(row+1)*1024),(255-row)*1024);x.putImageData(data,0,0);renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);renderer.autoClear=oldAuto;target.dispose();clone.traverse(o=>{if(o.isInstancedMesh)o.dispose();});return c;
}
function wetTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.strokeStyle='rgba(255,247,220,.9)';x.lineCap='round';
 for(const [cx,cy,r,a,b,w] of [[116,112,55,3.65,4.75,8],[145,142,43,.15,1.05,6],[95,158,32,2.8,3.7,5]]){x.lineWidth=w;x.beginPath();x.arc(cx,cy,r,a,b);x.stroke();}
 for(const [px,py,r] of [[72,137,5],[180,109,4],[151,181,5],[91,79,3]]){const g=x.createRadialGradient(px-1,py-1,0,px,py,r);g.addColorStop(0,'rgba(255,255,245,.95)');g.addColorStop(1,'rgba(232,183,105,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function buildFood(){
 food=new THREE.Group();camera.add(food);food.position.set(0,-.7,-3.1);food.scale.setScalar(1.12);
 const tex=foodTexture();tex.colorSpace=THREE.SRGBColorSpace;
 const geo=new THREE.IcosahedronGeometry(1,2),mat=new THREE.MeshStandardMaterial({map:tex,color:0xffd497,roughness:.45});
 const positions=geo.attributes.position;for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);p.multiplyScalar(1+.045*Math.sin(p.x*17+p.y*13+p.z*21));positions.setXYZ(i,p.x,p.y,p.z);q.copy(p).normalize();geo.attributes.normal.setXYZ(i,q.x,q.y,q.z);}
 foodInstances=new THREE.InstancedMesh(geo,mat,52);foodInstances.userData.kind='food';food.add(foodInstances);targets.push(foodInstances);
 for(let i=0;i<52;i++){
  const angle=i*2.39996,r=.22+Math.sqrt((i+.5)/52)*.94,base=new THREE.Vector3(Math.cos(angle)*r,Math.sin(angle)*r*.62,Math.sin(i*17)*.24);
  const mesh=new THREE.Object3D();mesh.position.copy(base);const scale=.085+(i%7)*.012;mesh.scale.set(scale,scale*(.7+(i%3)*.2),scale*.9);mesh.rotation.set(i*.8,i*.3,i*.7);mesh.userData={kind:'food',base,scale};mesh.updateMatrix();foodInstances.setMatrixAt(i,mesh.matrix);foodParts.push(mesh);
 }
 const pasteGeo=new THREE.SphereGeometry(1,40,28),pastePos=pasteGeo.attributes.position;for(let i=0;i<pastePos.count;i++){const x=pastePos.getX(i),y=pastePos.getY(i),z=pastePos.getZ(i),r=1+.045*Math.sin(x*17+y*13+z*21);pastePos.setXYZ(i,x*r,y*r,z*r);}pasteGeo.computeVertexNormals();const paste=new THREE.Mesh(pasteGeo,new THREE.MeshStandardMaterial({map:tex,bumpMap:tex,bumpScale:.045,color:0xd8bb8a,roughness:.25,transparent:true}));paste.scale.set(.72,.46,.34);paste.position.z=-.12;paste.name='paste';food.add(paste);
 // Separate soft droplets preserve visible gaps: the stomach contents never become a single ball.
 chymeInstances=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshStandardMaterial({color:0xe5c38c,roughness:.2,transparent:true,opacity:0}),34);chymeInstances.name='dispersed-chyme';food.add(chymeInstances);
 new THREE.TextureLoader().load('assets/journey/food-atlas-v5.png',texture=>{
  // Bottom row cells 4 and 5: dispersed gastric fragments -> finer dispersed chyme.
  texture.colorSpace=THREE.SRGBColorSpace;texture.repeat.set(.25,.5);texture.offset.set(0,0);const tile=document.createElement('canvas');
  tile.width=texture.image.width/4;tile.height=texture.image.height/2;
  tile.getContext('2d').drawImage(texture.image,tile.width*3,0,tile.width,tile.height,0,0,tile.width,tile.height);
  const swallowed=new THREE.CanvasTexture(tile);swallowed.colorSpace=THREE.SRGBColorSpace;const fine=texture.clone();fine.offset.x=.25;fine.needsUpdate=true;
  bolusSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:swallowed,transparent:true,depthTest:true,depthWrite:false}));chymeSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:fine,transparent:true,depthTest:true,depthWrite:false}));
  for(const s of [bolusSprite,chymeSprite]){s.scale.set(1.75,1.75,1);s.renderOrder=4;food.add(s);}foodInstances.visible=true;paste.visible=false;bolusSprite.visible=false;chymeSprite.visible=false;
  const surface=new THREE.PlaneGeometry(1.78,1.78,28,28),surfaceMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.01,side:THREE.DoubleSide,toneMapped:false});surfaceMaterial.onBeforeCompile=s=>{s.uniforms.uFoodMix={value:state.mixed};s.uniforms.uFoodTime={value:elapsed};s.uniforms.uFoodMotion={value:state.motion};s.vertexShader='uniform float uFoodTime;uniform float uFoodMotion;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat ripple=sin(position.x*6.0+uFoodTime*3.1)*cos(position.y*4.5-uFoodTime*2.3);transformed.z+=.12*(1.0-clamp(length(position.xy)/1.25,0.0,1.0))+ripple*.065*uFoodMotion;transformed.x+=sin(position.y*5.0+uFoodTime*2.6)*.028*uFoodMotion;transformed.y+=sin(position.x*6.0-uFoodTime*3.0)*.025*uFoodMotion;');s.fragmentShader='uniform float uFoodMix;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','diffuseColor*=mix(texture2D(map,vMapUv),texture2D(map,vMapUv+vec2(.25,0.0)),uFoodMix);');photoFoodShader=s;};photoFood=new THREE.Mesh(surface,surfaceMaterial);photoFood.name='mixed-food';photoFood.visible=false;food.add(photoFood);
  wetCoat=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:0xffc66f,transparent:true,opacity:0,depthTest:false,depthWrite:false}));wetCoat.scale.set(1.77,1.77,1);wetCoat.position.z=.025;wetCoat.renderOrder=4.5;food.add(wetCoat);
  renderer.compile(scene,camera);clock.getDelta();$('start').disabled=false;$('start').textContent='跟着食团，出发 →';if(inVoyage){renderScene();voyageMessage('ready');if(voyageParams.get('autostart')!=='0')setTimeout(begin,100);}
 });
 wetSheen=new THREE.Sprite(new THREE.SpriteMaterial({map:wetTexture(),transparent:true,opacity:0,depthTest:false,depthWrite:false}));
 wetSheen.scale.set(1.7,1.7,1);wetSheen.position.z=.035;wetSheen.renderOrder=5;food.add(wetSheen);
 const dg=new THREE.SphereGeometry(.11,18,16),dp=dg.attributes.position;
 for(let i=0;i<dp.count;i++){const y=dp.getY(i)/.11,taper=.96-.3*y;dp.setXYZ(i,dp.getX(i)*taper,dp.getY(i)*(y>0?1.35:1),dp.getZ(i)*taper);}dg.computeVertexNormals();
 const dm=new THREE.MeshPhysicalMaterial({color:0xe9c580,emissive:0xffd886,emissiveIntensity:.25,roughness:.1,metalness:0,clearcoat:1,clearcoatRoughness:.04,transparent:true,opacity:.9,depthTest:false,depthWrite:false});
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;const gx=glowCanvas.getContext('2d'),gradient=gx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(255,232,176,.45)');gradient.addColorStop(.35,'rgba(255,220,140,.17)');gradient.addColorStop(1,'rgba(255,220,140,0)');gx.fillStyle=gradient;gx.fillRect(0,0,64,64);
 const glowMaterial=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),transparent:true,opacity:.58,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false});
 for(let i=0;i<48;i++){const mesh=new THREE.Mesh(dg,dm);mesh.renderOrder=8;mesh.visible=false;const glow=new THREE.Sprite(glowMaterial);glow.scale.set(.55,.64,1);glow.renderOrder=7;mesh.add(glow);camera.add(mesh);drops.push(mesh);}
}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:!inVoyage,alpha:false,powerPreference:'high-performance'});renderer.setClearColor(0x6b3633);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.93;host.append(renderer.domElement);
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9b5149);scene.fog=new THREE.FogExp2(0x673b34,.037);camera=new THREE.PerspectiveCamera(inVoyage?72:74,1,.045,65);camera.rotation.order='YXZ';scene.add(camera);
 scene.add(new THREE.HemisphereLight(0xffdfc7,0x6a3027,1.25));
 const lamp=new THREE.PointLight(0xffe7d5,16,18,1.7);lamp.position.set(0,.3,-.4);camera.add(lamp);
 const poolLight=new THREE.PointLight(0xffe4bd,13,10,1.8);poolLight.position.set(.7,-.8,1);scene.add(poolLight);
 buildWall();buildLiquid();cardia=opening(.17,'贲门','entry');gate=opening(.83,'幽门','exit');buildFood();
 camera.position.copy(route.getPointAt(inVoyage?.0125:.05));orient(route.getPointAt(inVoyage?.0575:.095));viewYaw=desiredYaw;viewPitch=desiredPitch;camera.rotation.set(viewPitch,viewYaw,0);resize();animateFood(0);placeFood();renderScene();new ResizeObserver(resize).observe(host);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('failure-text').textContent='画面暂时中断，请重新准备旅行。';$('failure').hidden=false;});
 ready=true;hint('食团从这儿接着往前走。');frame=requestAnimationFrame(draw);
}
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,inVoyage?1.25:1.5,Math.sqrt(900000/(w*h))));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function nearestYaw(value,from){return from+Math.atan2(Math.sin(value-from),Math.cos(value-from));}
function orient(target){orientationProbe.position.copy(camera.position);q.copy(target);if(Math.abs(q.z-camera.position.z)<.001)q.z-=.35;orientationProbe.lookAt(q);desiredYaw=nearestYaw(orientationProbe.rotation.y,viewYaw);desiredPitch=orientationProbe.rotation.x;}
function look(target,duration=1.1){lookPoint.copy(target);const dummy=camera.clone(false);dummy.rotation.order='YXZ';dummy.lookAt(target);viewTween={fromYaw:viewYaw,fromPitch:viewPitch,toYaw:nearestYaw(dummy.rotation.y,viewYaw),toPitch:dummy.rotation.x,start:elapsed,duration};}
function restartInStomach(){if(state.phase!=='vomited')return;Object.assign(state,{phase:'ready',fluid:false,motion:0,mixed:0,back:0,identified:false,finished:false,routeProgress:0,foodStage:'bolus',mixing:false});voyageRestore=null;held=false;wetUntil=0;camera.position.copy(route.getPointAt(.0125));orient(route.getPointAt(.06));state.seen.clear();gate.dot.hidden=true;gate.shutter.visible=true;food.visible=true;setFoodDepthTest(false);voyageMessage('retry');enterVoyage();}
function travel(from,to,duration,done){moving={from:from.clone(),to:to.clone(),start:elapsed,duration,done};}
function begin(){
 if(state.phase!=='ready')return;
 $('intro').hidden=true;state.phase='entering';$('food-caption').hidden=false;$('chapter').textContent='穿过入口';progress(1,'进入');cardia.shutter.visible=false;
 hint('入口打开啦，我们进去看看。');
 travel(camera.position,new THREE.Vector3(-.8,.45,1),inVoyage?1.7:4.4,()=>{
  state.phase='explore';state.routeProgress=.22;setFoodDepthTest(false);cardia.shutter.visible=true;cardia.dot.hidden=false;
  if(!inVoyage){
   for(const id of ['views','forward','back','map'])$(id).hidden=false;
  }
  $('chapter').textContent='仔细观察';hint('食团碰到底下的液体，会发生什么呢？');look(new THREE.Vector3(2,-1.2,-1));progress(2,'观察食物');
  if(inVoyage&&voyageRestore){state.fluid=!!voyageRestore.fluid;state.mixed=Math.min(1,Number(voyageRestore.mixed)||0);state.wrong=Number(voyageRestore.wrong)||0;state.back=Number(voyageRestore.back)||0;state.identified=!!voyageRestore.identified;evidence();if(state.identified){state.phase='exit';gate.dot.hidden=false;hint('找找看，食糜接下来从哪儿出去。');}else if(state.mixed>=1)setTimeout(()=>showQuestion(),500);else if(state.fluid)hint('点“前进”，看看胃壁怎么搅动食物。');}
  state.routeProgress=.22+state.mixed*.56;
  state.foodStage=state.mixed>=1?'chyme':state.fluid?'wet-fragments':'bolus';
  if(!state.fluid)wetFood();
 });
}
function openKnowledge(title,text){if(inVoyage){voyageMessage('report',{title,text,label:state.phase==='vomited'?'重新出发 →':'继续观察 →'});return;}hint(title+'。'+text,'report');$('knowledge-title').textContent=title;$('knowledge-text').textContent=text;$('knowledge').showModal();}
function wetFood(){
 if(state.phase!=='explore'||state.fluid)return;state.fluid=true;wetUntil=elapsed+1.35;record('fluid');evidence();
 $('food-name').textContent='食团';$('food-note').textContent='和刚才相比，有什么不同？';
 hint('食物一碰到胃液，就变得更湿了。点“前进”，看看胃壁怎么搅动食物。','feedback');
 for(let i=0;i<drops.length;i++){drops[i].visible=true;drops[i].userData.born=elapsed+i*.016;}
 look(points.pool);progress(3,'观察混合');
}
function startMixing(){
 if(state.phase!=='explore'||state.mixing||state.mixed>=1)return;
 wetFood();if(state.foodStage==='bolus')return;state.mixing=true;held=true;state.foodStage='dispersed-fragments';record('wall');hint('胃壁开始蠕动啦！看，碎块散开了，跟着胃液一起翻动，慢慢混到了一起。','feedback');
}
function showAnatomy(reveal=false){
 if(!reveal)record('locate');$('anatomy-title').textContent=reveal?'把局部放回身体中':'看看当前位置';$('anatomy-text').hidden=!reveal;$('anatomy-text').textContent=reveal?'刚才观察的胃位于腹部上方，偏身体左侧。':'';$('close-anatomy').textContent='返回继续观察 →';
 showAnatomyView($('anatomy'),{point:[590,1020],reveal,src:'assets/organs/stomach.png',onReveal:()=>{$('anatomy-title').textContent='胃';$('anatomy-text').textContent='胃暂时容纳食物。胃壁运动与胃液共同参与消化，食物逐渐成为更细软的食糜，再进入小肠。';}});
}
function showQuestion(){
 if(inVoyage)voyageMessage('question');else $('question').showModal();
}
function answer(value){
 if(state.phase!=='explore'||state.mixed<1)return;
 if(value!=='stomach'){state.wrong++;record('wrong');$('answer-hint').textContent=value==='esophagus'?'这里比细长的管道宽多了，食物还在不停地翻动。':'想一想，这里是在搅动食物，还是在吸收营养？';hint($('answer-hint').textContent,'retry');return;}
 state.identified=true;state.phase='exit';$('question').close();record('identified');if(!inVoyage)showAnatomy(true);gate.dot.hidden=false;
 if(inVoyage)voyageMessage('identified');else hint('点击前进，继续旅行。');progress(4,'寻找出口');
}
function forward(){
 if(moving||state.finished)return;
 if(state.phase==='explore'){
  if(state.mixed<.99){startMixing();return;}
  showQuestion();return;
 }
 if(state.phase==='exit'){look(points.exit,.6);leave();}
}
function leave(){
 if(state.phase!=='exit'||moving)return;viewYaw=Math.atan2(Math.sin(viewYaw),Math.cos(viewYaw));desiredYaw=viewYaw;desiredPitch=viewPitch;state.phase='leaving';voyageMessage('advance');setFoodDepthTest(false);$('views').hidden=true;gate.shutter.visible=false;gate.dot.hidden=true;
 $('food-name').textContent='即将离开的食糜';hint('看看食糜怎么从前面的开口出去。');viewTween=null;
 travel(camera.position,route.getPointAt(inVoyage?.92:.95),inVoyage?2.2:4.5,finish);
}
function backward(){
 if(moving||state.finished)return;state.back++;record('back');look(points.entry);
 hint('回头看看，刚才的入口还开着吗？\n食团还能从这儿退回去吗？');
 if(state.back>=2){held=false;viewTween=null;state.phase='vomiting';cardia.shutter.visible=false;cardia.dot.hidden=true;gate.dot.hidden=true;for(const id of ['forward','back','views','map','observation'])$(id).hidden=true;hint('呕吐了！看，食团正沿着来时的路往上退。');travel(camera.position,route.getPointAt(.04),3.8,()=>{state.phase='vomited';food.visible=false;hint('刚才发生了什么？');$('close-knowledge').textContent='重新出发 →';if(inVoyage){hint('食物吐出来了。我们回到胃里再试一次。');restartInStomach();}else openKnowledge('食物往回走了','食物从胃返回食管，再从嘴里吐出，这就是呕吐。');});}
}
function finish(){
 if(inVoyage){state.finished=true;state.phase='done';state.routeProgress=1;state.mixing=false;held=false;record('complete');voyageMessage('complete');return;}
 state.finished=true;state.phase='done';state.routeProgress=1;state.mixing=false;held=false;progress(5,'这一站完成');$('finished').hidden=false;
 for(const id of ['forward','back','map','food-caption','views','observation'])$(id).hidden=true;
 $('hint').hidden=true;$('chapter').textContent='我们用证据解释变化';
 $('feedback').textContent=state.back?'我们还探索了入口：知道正常消化通常向前进行。再想想，胃壁和胃液怎样合作？':state.wrong?'我们结合新的观察修正了判断。再试着说说，哪些变化来自运动，哪些与胃液有关？':'我们观察到了食物、液体和胃壁之间的联系。试着用这三条证据解释胃的作用。';
 drawComparison();record('complete');
}
function drawComparison(){
 const savedMix=state.mixed,savedRotation=food.rotation.clone();
 for(const[id,mix]of[['before-food',0],['after-food',1]]){state.mixed=mix;animateFood(0);const ctx=$(id).getContext('2d');ctx.clearRect(0,0,256,256);ctx.drawImage(captureFood(),0,0,256,256);}
 state.mixed=savedMix;animateFood(elapsed);food.rotation.copy(savedRotation);
}
function animateFood(t){
 const mix=state.mixed,wet=state.fluid;
 foodParts.forEach((mesh,i)=>{
  const b=mesh.userData.base,turn=t*.55*state.motion+i*.15;
  mesh.position.set(b.x*(1+mix*.1)+Math.sin(turn+i)*.12*state.motion,b.y+Math.cos(turn*1.4+i)*.10*state.motion,b.z+Math.sin(turn*1.2)*.08*state.motion);
  const size=mesh.userData.scale*(1-mix*.67);mesh.scale.set(size,size*(.85-mix*.15),size*.8);
  mesh.rotation.x=i*.8+t*.9*state.motion;mesh.rotation.z=i*.7+t*.65*state.motion;mesh.updateMatrix();foodInstances.setMatrixAt(i,mesh.matrix);
 });
 foodInstances.visible=!photoFood&&!bolusSprite;foodInstances.instanceMatrix.needsUpdate=true;foodInstances.material.roughness=wet?.2:.45;foodInstances.material.color.set(wet?0xf4d4a2:0xffd497);
 if(chymeInstances){const droplet=new THREE.Object3D();for(let i=0;i<34;i++){const a=i*2.39996,r=.18+Math.sqrt((i+.5)/34)*.96;droplet.position.set(Math.cos(a)*r+Math.sin(t*.8+i)*state.motion*.11,Math.sin(a)*r*.55+Math.cos(t+i)*state.motion*.07,-.06+Math.sin(i*3)*.1);const size=(.07+(i%5)*.012)*(.7+mix*.5);droplet.scale.set(size*1.55,size*.65,size);droplet.rotation.z=a+t*.12*state.motion;droplet.updateMatrix();chymeInstances.setMatrixAt(i,droplet.matrix);}chymeInstances.instanceMatrix.needsUpdate=true;chymeInstances.material.opacity=THREE.MathUtils.smoothstep(mix,.12,.9)*.92;chymeInstances.visible=mix>.12;}
 food.getObjectByName('paste').visible=false;
 for(const sprite of [bolusSprite,chymeSprite,wetCoat,wetSheen])if(sprite)sprite.visible=false;
 if(bolusSprite)bolusSprite.visible=state.foodStage==='bolus';
 if(photoFood){photoFood.visible=state.foodStage!=='bolus';chymeInstances.visible=false;photoFood.scale.set(1+Math.sin(t*3.4)*state.motion*.07,1-Math.sin(t*3.4)*state.motion*.05,1);if(photoFoodShader){photoFoodShader.uniforms.uFoodMix.value=mix;photoFoodShader.uniforms.uFoodMotion.value=state.motion;photoFoodShader.uniforms.uFoodTime.value=t;}}
 food.rotation.set(Math.sin(t*1.8)*state.motion*.05,Math.sin(t*1.45)*state.motion*.08,Math.sin(t*2.5)*state.motion*.045);
}

function placeFood(){const halfHeight=3.1*Math.tan(camera.fov*Math.PI/360),referenceSize=Math.max(190,Math.min(460,parent.innerHeight*.39)),scale=inVoyage?referenceSize/Math.max(1,host.clientHeight)*(halfHeight*2)/1.78:1.12;food.position.set(0,inVoyage?-.22*halfHeight:-.78,-3.1);food.scale.setScalar(scale);setFoodDepthTest(false);}
function renderScene(){food.traverse(o=>o.layers.set(1));scene.traverse(o=>{if(o.isLight)o.layers.enable(1);});raycaster.layers.enable(1);camera.layers.set(0);renderer.render(scene,camera);const bg=scene.background;scene.background=null;renderer.autoClear=false;renderer.clearDepth();camera.layers.set(1);renderer.render(scene,camera);camera.layers.set(0);renderer.autoClear=true;scene.background=bg;}
function updateLandmark(o){
 if(o.dot.hidden)return;const v=o.group.position.clone().project(camera);
 const forward=new THREE.Vector3();camera.getWorldDirection(forward);const visible=o.group.position.clone().sub(camera.position).dot(forward)>0;
 o.dot.style.display=visible&&Math.abs(v.x)<.92&&Math.abs(v.y)<.88?'':'none';o.dot.style.left=`${(v.x+1)*50}%`;o.dot.style.top=`${(1-v.y)*50}%`;
}
function draw(ms){
 frame=requestAnimationFrame(draw);
 if(ms-lastDraw<16)return;
 lastDraw=ms;
 const dt=Math.min(clock.getDelta(),.083);
 if(document.hidden||!$('failure').hidden||document.querySelector('dialog[open]'))return;
 if(inVoyage&&state.phase==='ready'&&voyageParams.get('autostart')==='0')return;
 elapsed+=dt;
 if(moving){const k=Math.min(1,(elapsed-moving.start)/moving.duration),e=k*k*(3-2*k);moving.progress=k;if(state.phase==='entering'||state.phase==='leaving'){const entering=state.phase==='entering',u=entering?THREE.MathUtils.lerp(inVoyage?.0125:.05,.43,e):THREE.MathUtils.lerp(.43,inVoyage?.92:.95,e);camera.position.copy(route.getPointAt(u));if(entering)orient(route.getPointAt(Math.min(.999,u+.045)));else{orientationProbe.position.copy(camera.position);orientationProbe.lookAt(route.getPointAt(1));desiredYaw=nearestYaw(orientationProbe.rotation.y,viewYaw);desiredPitch=orientationProbe.rotation.x;}}else camera.position.lerpVectors(moving.from,moving.to,e);if(k>=1){const done=moving.done;moving=null;done?.();}}
 if(moving&&state.phase==='vomiting'){const u=THREE.MathUtils.lerp(.43,.04,THREE.MathUtils.smoothstep(moving.progress,0,1));camera.position.copy(route.getPointAt(u));orient(route.getPointAt(Math.max(0,u-.04)));}
 if(viewTween){const k=Math.min(1,(elapsed-viewTween.start)/viewTween.duration),e=k*k*(3-2*k);desiredYaw=THREE.MathUtils.lerp(viewTween.fromYaw,viewTween.toYaw,e);desiredPitch=THREE.MathUtils.lerp(viewTween.fromPitch,viewTween.toPitch,e);if(k===1)viewTween=null;}
 const viewBlend=1-Math.exp(-dt*7);viewYaw+=(nearestYaw(desiredYaw,viewYaw)-viewYaw)*viewBlend;viewPitch+=(desiredPitch-viewPitch)*viewBlend;camera.rotation.set(viewPitch,viewYaw,0,'YXZ');
 state.motion+=(Number(held)-state.motion)*(1-Math.exp(-dt*6.5));
 if(state.phase==='explore'&&state.fluid&&state.foodStage==='bolus'&&elapsed>=wetUntil){state.foodStage='wet-fragments';voyageMessage('visual');}
 if(state.mixing&&state.fluid&&state.phase==='explore'&&state.mixed<1){state.mixed=Math.min(1,state.mixed+dt*.14);state.routeProgress=.22+state.mixed*.56;evidence();if(state.mixed>=1){held=false;state.mixing=false;state.foodStage='chyme';hint('看，碎块跟胃液混在一起，慢慢变成了更细、更软的食糜。','report');$('food-name').textContent='变化后的食团';$('food-note').textContent='回想刚进入时的形状和颗粒';record('mixed');setTimeout(()=>{if(state.phase==='explore'&&!$('knowledge').open)showQuestion();},1600);}}
 if(materialShader){materialShader.uniforms.uTime.value=elapsed;materialShader.uniforms.uMotion.value=state.motion;}
 if(liquidShader){liquidShader.uniforms.uTime.value=elapsed;liquidShader.uniforms.uMotion.value=state.motion;}
 animateFood(elapsed);if(!state.finished)placeFood();
 bubbles.forEach((b,i)=>{const a=b.userData.initial;b.position.y=a.y+Math.sin(elapsed*1.9+i)*.025;b.position.x=a.x+Math.sin(elapsed*.5+i)*state.motion*.2;b.updateMatrix();bubbleInstances.setMatrixAt(i,b.matrix);});bubbleInstances.instanceMatrix.needsUpdate=true;
 drops.forEach((d,i)=>{if(!d.visible)return;const age=elapsed-d.userData.born;if(age<0){d.position.set(0,-100,0);return;}if(state.phase==='leaving'||state.phase==='done'){d.visible=false;return;}const f=age/1.15,a=i*2.399;if(f>=1){d.visible=false;return;}const r=1-f;d.position.set(Math.cos(a)*r*1.45,-.78+Math.sin(a)*r*.95+Math.sin(f*Math.PI)*.18,-3.02+Math.sin(a*1.7)*r*.4);d.scale.set(.48*(1-f*.5),.72*(1-f*.5),.48);});
 if(moving&&state.phase==='entering')state.routeProgress=moving.progress*.22;if(moving&&state.phase==='leaving')state.routeProgress=.78+moving.progress*.22;if(elapsed-lastProgressAt>.5){lastProgressAt=elapsed;voyageMessage('visual');}updateLandmark(cardia);updateLandmark(gate);renderScene();
}
function hit(event){const box=host.getBoundingClientRect();mouse.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);raycaster.setFromCamera(mouse,camera);return raycaster.intersectObjects(targets,false)[0];}
host.addEventListener('pointerdown',e=>{
 if(!ready||moving||state.finished||state.phase==='ready')return;host.setPointerCapture(e.pointerId);const h=hit(e);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,kind:h?.object.userData.kind,at:performance.now(),drag:false};
});
host.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>9)pointer.drag=true;if(pointer.drag){viewTween=null;desiredYaw-=dx*.005;desiredPitch=THREE.MathUtils.clamp(desiredPitch-dy*.005,-1.5,1.5);}pointer.x=e.clientX;pointer.y=e.clientY;});
function release(e){if(!pointer||e.pointerId!==pointer.id)return;const tap=!pointer.drag,kind=pointer.kind;pointer=null;if(!tap)return;if(kind==='exit'){if(state.phase==='exit')forward();else hint('点右边的“前进”，看看食物怎么翻动。');}else if(kind==='entry')backward();else if(state.phase==='explore'&&!state.mixing)hint('点右边的“前进”，胃壁就会动起来。');}
host.addEventListener('pointerup',e=>withPlayerAction(()=>release(e)));host.addEventListener('pointercancel',()=>{pointer=null;});window.addEventListener('blur',()=>{pointer=null;});document.addEventListener('visibilitychange',()=>{pointer=null;clock.getDelta();});
bindSceneLongPress(host,()=>pointer,()=>{
 if(moving||state.finished||!['explore','exit'].includes(state.phase)||document.querySelector('dialog[open]'))return;
 if(inVoyage){
  const navigation=parent.document.getElementById('forward');
  if(!navigation||navigation.hidden||parent.document.querySelector('dialog[open]'))return;
  pointer=null;
  navigation.click();
  return;
 }
 if($('forward').hidden)return;
 pointer=null;
 forward();
});

$('start').onclick=begin;$('forward').onclick=forward;$('back').onclick=backward;$('map').onclick=()=>showAnatomy(false);
for(const b of document.querySelectorAll('[data-look]'))b.onclick=()=>{record(b.dataset.look);look(b.dataset.look==='entry'?points.entry:b.dataset.look==='pool'?points.pool:points.exit);};
for(const b of document.querySelectorAll('[data-answer]'))b.onclick=()=>answer(b.dataset.answer);
$('close-anatomy').onclick=()=>{$('anatomy').close();clearTimeout(anatomyTimer);};$('close-knowledge').onclick=()=>{if(state.phase==='vomited'){if(inVoyage)voyageMessage('restart');else location.reload();}else $('knowledge').close();};
$('replay').onclick=()=>location.reload();$('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();try{await screen.orientation?.lock('portrait');}catch{} }catch{hint('可以点浏览器的全屏按钮。');}};
// A read-only diagnostic is deliberately separate from classroom data and stays on this device.
window.addEventListener('message',e=>{if(!inVoyage||e.origin!==location.origin||e.source!==parent||e.data?.channel!=='food-journey-parent')return;if(e.data.type==='enter'&&ready)enterVoyage();if(e.data.type==='answer')withPlayerAction(()=>answer(e.data.value));if(e.data.type==='navigate'&&['explore','exit'].includes(state.phase)){withPlayerAction(()=>{if(e.data.direction==='forward')forward();else if(e.data.direction==='back')backward();});}if(e.data.type==='knowledge-continue')$('close-knowledge').onclick();});
window.stomachSample={get visualState(){return{phase:state.phase,yaw:viewYaw,pitch:viewPitch,camera:camera?.position.toArray(),quaternion:camera?.quaternion.toArray()};},enterVoyage,worldFrame,capturePassage,captureFood,captureFrame(){renderScene();return renderer.domElement.toDataURL('image/jpeg',.82);},get foodVisual(){let worldLayerCount=0;food?.traverse(o=>{if((o.isMesh||o.isSprite)&&(o.layers.mask&1))worldLayerCount++;});return{worldLayerCount,center:food?.position.toArray(),rotation:food?.rotation.toArray(),scale:food?.scale.toArray(),solid:false,dispersed:!!(photoFood?.visible||foodInstances?.visible),mixed:state.mixed,motion:state.motion};},get state(){return{...state,seen:[...state.seen]}},get diagnostics(){return renderer?{triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,pixelRatio:renderer.getPixelRatio(),phase:state.phase,webgl:true,held,pickGrid:[.16,.32,.5,.68,.84].flatMap(x=>[.3,.45,.6,.75].map(y=>{raycaster.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),camera);return{x,y,kind:raycaster.intersectObjects(targets,false)[0]?.object.userData.kind};}))}:{};}};
try{init();}catch(error){console.error(error);$('failure-text').textContent='请使用 Chrome 或 Edge 重新打开，检查浏览器是否支持 WebGL。';$('failure').hidden=false;}
