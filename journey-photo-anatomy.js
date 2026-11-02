import * as THREE from './vendor/three.module.js';
import {mucosaMaterial} from './journey-anatomy-v2.js';
const clamp=THREE.MathUtils.clamp,smooth=THREE.MathUtils.smoothstep;
let mouthPhoto,pharynxPhoto;
export async function preparePhotoAnatomy(){const loader=new THREE.TextureLoader();[mouthPhoto,pharynxPhoto]=await Promise.all([loader.loadAsync('assets/journey/mouth.webp'),loader.loadAsync('assets/journey/pharynx-normal-unlabeled.webp')]);for(const photo of [mouthPhoto,pharynxPhoto]){photo.colorSpace=THREE.SRGBColorSpace;photo.anisotropy=4;photo.userData.shared=true;}pharynxPhoto.repeat.set(-.95,-.90);pharynxPhoto.offset.set(.975,.97);}
function line(x,points){for(let i=1;i<points.length;i++)if(x<=points[i][0]){const a=points[i-1],b=points[i];return THREE.MathUtils.lerp(a[1],b[1],smooth(x,a[0],b[0]));}return points.at(-1)[1];}
function surface(root,targets,photo,settings){
 const width=240,height=160,fov=settings.fov,aspect=settings.aspect||1.5,tan=Math.tan(fov*Math.PI/360),buckets=new Map();
 const sample=(i,j)=>{const u=i/width,v=j/height,{depth,kind,layer}=settings.sample(u,v),distance=depth+settings.camera.z,scale=settings.scale??1,p=[(u-.5)*2*distance*tan*aspect*scale,((.5-v)*scale+(settings.shiftY||0))*2*distance*tan,-depth];if(settings.wrap){const base=Math.atan((u-.5)*2*tan*aspect),angle=base+Math.sign(u-.5)*.18*smooth(Math.abs(u-.5),.42,.50),r=distance/Math.cos(base);p[0]=Math.sin(angle)*r;p[2]=settings.camera.z-Math.cos(angle)*r;}return{p,uv:[u,1-v],key:layer+':'+kind,layer,kind};};
 for(let j=0;j<height;j++)for(let i=0;i<width;i++)for(const triangle of [[[i,j],[i+1,j],[i,j+1]],[[i+1,j],[i+1,j+1],[i,j+1]]]){const center=settings.sample((i+.5)/width,(j+.5)/height);if(center.hole)continue;const key=center.layer+':'+center.kind;let b=buckets.get(key);if(!b){b={positions:[],uv:[],layer:center.layer,kind:center.kind};buckets.set(key,b);}for(const [x,y]of triangle){const vertex=sample(x,y);b.positions.push(...vertex.p);b.uv.push(...vertex.uv);}}
 const parts=[];for(const b of buckets.values()){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();const m=new THREE.MeshBasicMaterial({map:photo,side:THREE.DoubleSide,transparent:!!settings.feather});if(settings.feather)m.onBeforeCompile=s=>{s.vertexShader='varying vec2 vPhotoUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPhotoUv=uv;');s.uniforms.uFeather={value:typeof settings.feather==='number'?settings.feather:.12};s.uniforms.uEllipse={value:settings.wrap?0:1};s.fragmentShader='uniform float uFeather;uniform float uEllipse;varying vec2 vPhotoUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\nfloat border=min(min(vPhotoUv.x,1.0-vPhotoUv.x),min(vPhotoUv.y,1.0-vPhotoUv.y));float ellipse=length((vPhotoUv-vec2(.5))/vec2(.59,.64));diffuseColor.a*=smoothstep(0.0,uFeather,border)*(1.0-uEllipse*smoothstep(.87,1.04,ellipse));');};const o=new THREE.Mesh(g,m);o.userData.kind=b.kind;o.userData.photoRelief=true;(settings.parents[b.layer]||root).add(o);targets.push(o);parts.push(o);}return parts;
}
export function photoMouth(root,targets){
 const lower=new THREE.Group();root.add(lower);const camera=new THREE.Vector3(0,0,1.6),fov=66;
 const lowerEdge=x=>line(Math.abs(x-.5),[[0,.555],[.20,.555],[.26,.61],[.30,.74],[.36,.58],[.42,.49],[.50,.55]]);
 const toothTop=x=>line(Math.abs(x-.5),[[0,.90],[.17,.88],[.26,.83],[.34,.67],[.40,.51],[.46,.50],[.50,.80]]);
 const toothBottom=x=>line(Math.abs(x-.5),[[0,.095],[.20,.15],[.30,.30],[.39,.365],[.44,.29],[.50,.08]]);
 const parts=surface(root,targets,mouthPhoto,{camera,fov,wrap:true,feather:.045,parents:{lower},sample(u,v){
  const x=Math.abs(u-.5),inLower=v>=lowerEdge(u),tongue=inLower&&v<toothTop(u)&&x<.30,upperTooth=v<toothBottom(u)&&x<.46,lowerTooth=inLower&&v>=toothTop(u)&&x<.46;
  const outer=clamp(Math.max(x/.50,Math.abs(v-.47)/.53),0,1),central=Math.exp(-(((u-.5)/.22)**2+((v-.46)/.20)**2));
  let depth=THREE.MathUtils.lerp(2.5,7.4,1-outer*.72)+central*1.7;
  if(upperTooth||lowerTooth){const back=1-clamp(x/.43,0,1);depth=2.0+Math.pow(x/.46,.65)*2.5+(upperTooth?Math.max(0,v-.10)*2.2:Math.max(0,.89-v)*2);}
  if(tongue){const t=clamp((v-.55)/.36,0,1);depth=THREE.MathUtils.lerp(7.0,2.3,t)-.7*Math.sin(t*Math.PI)*Math.max(0,1-x*x/.09);}
  // The deepest painted surface is continued by the real posterior sleeve.
  const throat=((u-.5)/.093)**2+((v-.518)/.050)**2;
  return{depth,layer:inLower?'lower':'fixed',kind:upperTooth||lowerTooth?'teeth':tongue?'tongue':throat<1.35?'exit':'wall',hole:false};
 }});
 const shellCurve=new THREE.CatmullRomCurve3([[0,0,5.8],[0,0,1],[0,0,-3],[0,-.5,-7.7],[0,-1,-12]].map(p=>new THREE.Vector3(...p))),shell=new THREE.Mesh(new THREE.TubeGeometry(shellCurve,96,1,72,false),mucosaMaterial(0xd39487,.32)),p=shell.geometry.attributes.position;
 for(let j=0;j<=96;j++){const u=j/96,c=shellCurve.getPointAt(u),r=u<.10?THREE.MathUtils.lerp(1.3,10,smooth(u,0,.10)):THREE.MathUtils.lerp(10,.68,smooth(u,.67,.99));for(let i=0;i<=72;i++){const k=j*73+i,v=new THREE.Vector3().fromBufferAttribute(p,k).sub(c).multiplyScalar(r);v.y*=.72;p.setXYZ(k,c.x+v.x,c.y+v.y,c.z+v.z);}}shell.geometry.computeVertexNormals();shell.userData.kind='wall';root.add(shell);targets.push(shell);
 const outside=new THREE.Mesh(new THREE.SphereGeometry(2.7,32,20),new THREE.MeshBasicMaterial({color:0xcbd8ce,side:THREE.BackSide}));outside.position.set(0,0,7.2);root.add(outside);
 const throat=new THREE.Mesh(new THREE.SphereGeometry(.68,24,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));throat.position.set(0,-.4,-8.1);throat.userData.kind='exit';root.add(throat);targets.push(throat);
 lower.userData.animateChew=amount=>{lower.position.set(0,amount*.19,-amount*.06);lower.rotation.x=-amount*.025;};
 const tongue=parts.find(o=>o.userData.kind==='tongue');if(tongue)tongue.userData.referenceAnatomy=true;
 return{lower,tongue,teeth:parts.filter(o=>o.userData.kind==='teeth'),camera,pitch:0,fov,handoff:new THREE.Vector3(0,-.3,-8.5)};
}
export function photoPharynx(root,targets){
 // Welleschik, Larynx normal.jpg, CC BY-SA 3.0. The photograph is cropped and
 // rotated via UVs, not claimed to be a measured 3D scan. See ATTRIBUTION.md.
 const chamber=new THREE.Group();root.add(chamber);const camera=new THREE.Vector3(0,0,1.6),fov=66,pitch=-1.30;
 const parts=surface(chamber,targets,pharynxPhoto,{camera,fov,aspect:1.55,scale:.94,shiftY:-.19,feather:true,parents:{},sample(u,v){
  const x=u-.47,y=v-.37,airway=x*x/.006+(y*y/.028),posterior=((u-.48)/.24)**2+((v-.08)/.052)**2,leaf=((u-.5)/.42)**2+((v-.77)/.17)**2;
  const depression=Math.exp(-(x*x/.032+y*y/.065));let depth=3.7+depression*4.5;
  if(leaf<1)depth=THREE.MathUtils.lerp(depth,2.9,smooth(1-leaf,0,.50));
  return{depth,kind:posterior<1?'foodway':airway<1?'airway':leaf<.72?'flap':'wall',layer:'fixed',hole:false};
 }});
 const sleeveCurve=new THREE.CatmullRomCurve3([[0,0,5],[0,0,1],[0,0,-4],[0,.7,-8],[0,1,-13]].map(p=>new THREE.Vector3(...p))),shellGeometry=new THREE.TubeGeometry(sleeveCurve,96,1,72,false),pos=shellGeometry.attributes.position;
 for(let j=0;j<=96;j++){const u=j/96,c=sleeveCurve.getPointAt(u),r=THREE.MathUtils.lerp(8,.65,Math.max(1-smooth(u,0,.08),smooth(u,.71,1)));for(let i=0;i<=72;i++){const k=j*73+i,v=new THREE.Vector3().fromBufferAttribute(pos,k).sub(c).multiplyScalar(r);v.y*=.75;pos.setXYZ(k,c.x+v.x,c.y+v.y,c.z+v.z);}}shellGeometry.computeVertexNormals();const shell=new THREE.Mesh(shellGeometry,mucosaMaterial(0xc18c71,.35));shell.userData.kind='wall';chamber.add(shell);targets.push(shell);
 const leaf=parts.find(o=>o.userData.kind==='flap'),flap=new THREE.Group();flap.position.set(0,-3.5,-3.2);chamber.add(flap);chamber.updateMatrixWorld(true);if(leaf)flap.attach(leaf);let closed=false;flap.userData.close=()=>{closed=true;};flap.userData.animate=dt=>{flap.rotation.x+=((closed?-.48:0)-flap.rotation.x)*(1-Math.exp(-dt*5));};
 chamber.rotation.x=pitch;const rotation=chamber.rotation;return{flap,camera:camera.applyEuler(rotation),pitch,fov,handoff:new THREE.Vector3(0,2.0,-6.5).applyEuler(rotation)};
}
