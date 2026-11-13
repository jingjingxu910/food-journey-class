import * as THREE from './vendor/three.module.js';
import {mucosaMaterial} from './journey-anatomy-v2.js';
import {neckMaterial,blendNeck,prepareNeckImage} from './journey-neck.js';
const V=a=>new THREE.Vector3(...a),smooth=THREE.MathUtils.smoothstep;
const decodedTissue=new Map();
export async function prepareLumenAssets(){await Promise.all(['esophagus-wall-v9.webp','large-intestine.webp','small-mucosa-v3.webp'].map(async file=>{const image=new Image();image.src='assets/journey/'+file;await image.decode();decodedTissue.set(file,image);}));await prepareNeckImage();}
function tissueTile(file,rect){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#b97265';ctx.fillRect(0,0,512,512);const texture=new THREE.CanvasTexture(canvas);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(15,3);const image=decodedTissue.get(file)||new Image();const paint=()=>{for(let y=0;y<2;y++)for(let x=0;x<2;x++){ctx.save();ctx.translate(x?512:0,y?512:0);ctx.scale(x?-1:1,y?-1:1);ctx.drawImage(image,...rect,0,0,256,256);ctx.restore();}texture.needsUpdate=true;};if(image.complete&&image.naturalWidth)paint();else{image.onload=paint;image.src='assets/journey/'+file;}return texture;
}
// A wall-only swatch avoids duplicating the source photograph's distant lumen.
function esophagusWallTexture(){const image=decodedTissue.get('esophagus-wall-v9.webp'),surface=document.createElement('canvas');surface.width=surface.height=1024;const c=surface.getContext('2d');c.setTransform(0,1,1,0,0,0);c.drawImage(image,0,0,1024,1024);const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;texture.repeat.set(6,2);texture.anisotropy=8;return texture;}
// Waves use an explicit centerline coordinate independent of material UVs.
import {stomachWallWave} from './journey-wall-wave.js';

function useDeformedNormals(shader){
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 movedNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
 if(dot(movedNormal,normal)<0.0)movedNormal=-movedNormal;
 normal=normalize(mix(normal,movedNormal,.7));`);
}

// Instanced villi use the same transform as the underlying folded wall.
function animateTissue(material,shaders,type){
 material.onBeforeCompile=shader=>{
  shader.uniforms.uClock={value:0};
  shader.uniforms.uStrength={value:0};
  const esophagus=type==='esophagus';
  shader.uniforms.uSqueeze={value:esophagus?1:type==='small'?.27:.25};
  shader.vertexShader='uniform float uClock;uniform float uStrength;uniform float uSqueeze;attribute vec3 lumenCenter;attribute float lumenU;\n'+shader.vertexShader;
  if(esophagus){
   shader.uniforms.uViewOffset={value:0};
   shader.vertexShader='uniform float uViewOffset;\n'+stomachWallWave+shader.vertexShader;
  }
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 tissuePosition=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
   tissuePosition=instanceMatrix*tissuePosition;
   #endif
   vec3 radial=tissuePosition.xyz-lumenCenter;
   float wave=pow(.5+.5*cos(lumenU*58.0-uClock*2.5),4.0);
   float nextWave=pow(.5+.5*cos(lumenU*31.0-uClock*1.7+1.4),6.0);
   float taper=smoothstep(.105,.20,lumenU)*(1.0-smoothstep(.80,.895,lumenU));
   float contraction=${esophagus
    ? 'stomachWallWave(lumenU-uViewOffset,uClock)*uSqueeze*uStrength*taper'
    : '(wave+nextWave*.24)*uSqueeze*(.18+.82*uStrength)*taper'};
   tissuePosition.xyz=lumenCenter+radial*(1.0-contraction);
   vec4 mvPosition=modelViewMatrix*tissuePosition;
   gl_Position=projectionMatrix*mvPosition;`);
  useDeformedNormals(shader);
  shaders.push(shader);
 };
 material.customProgramCacheKey=()=> 'digestive-wall-motion-v15-'+type;
}
export function buildLumen(root,targets,type,shaders){
 const small=type==='small',large=type==='large',points=small?[[0,0,7],[0,0,2],[1.5,-.35,-3],[3.1,.5,-7],[.7,-.15,-11],[-2.7,-.6,-15],[-3.0,.25,-19],[.4,.65,-24],[3,-.25,-29],[1.4,0,-34]]:large?[[0,0,7],[0,0,2],[.3,.2,-4],[1.0,.15,-10],[.2,-.2,-16],[-1.2,-.15,-23],[-1,.2,-29],[.4,0,-34]]:[[0,0,7],[0,0,2],[.2,.05,-7],[.08,-.1,-15],[-.25,.1,-24],[0,0,-31]];
 const curve=new THREE.CatmullRomCurve3(points.map(V),false,'catmullrom',.35),rings=type==='esophagus'?384:320,sides=type==='esophagus'?128:96,frames=curve.computeFrenetFrames(rings,false),geometry=new THREE.TubeGeometry(curve,rings,1,sides,false),pos=geometry.attributes.position,centers=[],coordinates=[];
 const profile=u=>{const base=large?2.85:small?2.45:2.25,opening=Math.max(1-smooth(u,.018,.11),smooth(u,.88,.98));return THREE.MathUtils.lerp(base,.55,opening);};
 const ellipse=u=>small?.81+.055*Math.sin(u*18):large?.93:.88;
 function radiusAt(u,a){const end=Math.max(1-smooth(u,.02,.12),smooth(u,.88,.98));let r=profile(u);
  if(small){
   // Raised transverse shelves are independent of the centerline bends.
   const phase=u*119+.62*Math.sin(a*2+u*14)+.31*Math.sin(u*33),shelf=Math.pow(.5+.5*Math.cos(phase),2.5),partial=.32+.68*smooth(Math.cos(a+u*18),-.95,.05);
   r-=(.90*shelf*partial+.16*Math.pow(.5+.5*Math.cos(u*193+a*3),5))*(1-end);r+=.13*Math.sin(a*3+u*17);
  }else if(large){
   const axial=u*74,bulge=.5+.5*Math.cos(axial),fold=Math.pow(.5+.5*Math.cos(axial+.48*Math.sin(a*3)),4),partial=.22+.78*Math.pow(.5+.5*Math.cos(a*3+u*8),2);
   r+=(.32*bulge-.80*fold*partial+.22*Math.cos(a*3+u*8))*(1-end);
  }else r+=(.22*Math.cos(a*5+.40*Math.sin(u*24))+.035*Math.cos(a*11+u*13)+.015*Math.cos(a*19+u*47))*(1-end);
  return r+end*(type==='esophagus'?.018:.055)*Math.cos(a*9+u*20);
 }
 function pointAt(u,a){const j=Math.min(rings,Math.floor(u*rings)),c=curve.getPointAt(u),r=radiusAt(u,a);return c.addScaledVector(frames.normals[j],Math.cos(a)*r).addScaledVector(frames.binormals[j],Math.sin(a)*r*ellipse(u));}
 for(let j=0;j<=rings;j++){const u=j/rings,c=curve.getPointAt(u);for(let i=0;i<=sides;i++){const p=pointAt(u,i/sides*Math.PI*2),k=j*(sides+1)+i;pos.setXYZ(k,p.x,p.y,p.z);centers.push(c.x,c.y,c.z);coordinates.push(u);}}
 geometry.setAttribute('lumenCenter',new THREE.Float32BufferAttribute(centers,3));geometry.setAttribute('lumenU',new THREE.Float32BufferAttribute(coordinates,1));geometry.computeVertexNormals();const normals=geometry.attributes.normal;for(let j=0;j<=rings;j++){const a=j*(sides+1),b=a+sides,n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}
 const texture=small?new THREE.Texture(decodedTissue.get('small-mucosa-v3.webp')):large?tissueTile('large-intestine.webp',[35,520,270,245]):esophagusWallTexture();texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=type==='esophagus'?THREE.MirroredRepeatWrapping:THREE.RepeatWrapping;if(small)texture.repeat.set(14,3);
 const material=type==='esophagus'?new THREE.MeshStandardMaterial({color:0xffe7da,map:texture,bumpMap:texture,bumpScale:.004,roughness:.46,emissive:0xffdacf,emissiveMap:texture,emissiveIntensity:.035,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:small?0xffe3cc:0xfff3eb,map:texture,bumpMap:texture,bumpScale:small?.030:.045,emissive:0xffe1d4,emissiveMap:texture,emissiveIntensity:small?.035:.12,roughness:small?.39:.32,side:THREE.DoubleSide});animateTissue(material,shaders,type);
 // The two ends share the same narrow mucosal sleeve, material and UV phase.
 // Hand-offs happen within these sleeves, while the next cavity is still ahead.
 const first=Math.round(rings*.025),last=rings-first,indexPerRing=sides*6;geometry.clearGroups();geometry.addGroup(0,first*indexPerRing,1);geometry.addGroup(first*indexPerRing,(last-first)*indexPerRing,0);geometry.addGroup(last*indexPerRing,(rings-last)*indexPerRing,1);blendNeck(material);const wall=new THREE.Mesh(geometry,[material,neckMaterial()]);wall.userData.kind='wall';root.add(wall);targets.push(wall);
 let villi=null;
 if(small){
  const vg=new THREE.SphereGeometry(1,5,3),vm=mucosaMaterial(0xc77f6b,.42),count=21000,instances=new THREE.InstancedMesh(vg,vm,count),dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),ic=[],iu=[];animateTissue(vm,shaders,type);
  for(let i=0;i<count;i++){const random=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);},u=.105+random(i+.41)*.765,a=random(i+201.7)*Math.PI*2,surface=pointAt(u,a),c=curve.getPointAt(u),ds=.00025,da=.001,tangent=pointAt(u+ds,a).sub(pointAt(u-ds,a)),around=pointAt(u,a+da).sub(pointAt(u,a-da)),towards=tangent.cross(around).normalize();if(towards.dot(c.clone().sub(surface))<0)towards.negate();const length=.065+random(i+80)*.055;dummy.position.copy(surface).addScaledVector(towards,length*.42);dummy.quaternion.setFromUnitVectors(up,towards);dummy.scale.set(.019+random(i+3)*.009,length*.55,.019+random(i+5)*.008);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);ic.push(c.x,c.y,c.z);iu.push(u);}
  vg.setAttribute('lumenCenter',new THREE.InstancedBufferAttribute(new Float32Array(ic),3));vg.setAttribute('lumenU',new THREE.InstancedBufferAttribute(new Float32Array(iu),1));instances.instanceMatrix.needsUpdate=true;root.add(instances);instances.userData.kind='wall';villi=instances;
 }
 const entry=new THREE.Object3D(),exit=new THREE.Object3D();entry.position.copy(curve.getPointAt(.025));exit.position.copy(curve.getPointAt(.97));root.add(entry,exit);
 return{curve,entry,exit,wall,villi,start:type==='esophagus'?.24:.14,end:small?.95:.77,exitU:.9875,type};
}
