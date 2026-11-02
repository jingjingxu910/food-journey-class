import * as THREE from './vendor/three.module.js';
// Tooth crowns translate as a rigid region; the blend is confined to soft tissue.
export class MouthChew{
 constructor(image){
  this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});this.renderer.setSize(1536,1024,false);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0xbd897e);
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,1536,1024,0,.1,10);this.camera.position.z=2;
  const texture=new THREE.Texture(image);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  const geometry=new THREE.PlaneGeometry(1536,1024,180,128),uv=geometry.attributes.uv,weights=[];
  const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
  for(let i=0;i<uv.count;i++){const x=uv.getX(i),y=1-uv.getY(i),edge=Math.min(x,1-x),jawTop=.43+.39*smooth(0,.35,edge),blend=.20-.06*smooth(.23,.39,edge),start=Math.max(.40,jawTop-blend);weights.push(Math.max(smooth(start,jawTop,y),.25*smooth(.73,.81,y)));}
  geometry.setAttribute('jawWeight',new THREE.Float32BufferAttribute(weights,1));this.uniform={value:0};
  const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});material.onBeforeCompile=s=>{s.uniforms.uJawLift=this.uniform;s.vertexShader='attribute float jawWeight;uniform float uJawLift;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=uJawLift*jawWeight;\ntransformed.x+=(position.x/768.0)*uJawLift*.10*(4.0*jawWeight*(1.0-jawWeight));');};
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(768,512,0);this.scene.add(mesh);
  // Reflect the existing lower strip at its original pixel scale to cover the
  // crop during jaw lift. The approved image mesh and tooth motion stay intact.
  const skirt=new THREE.PlaneGeometry(1536,80,1,1),skirtUv=skirt.attributes.uv;for(let i=0;i<skirtUv.count;i++)skirtUv.setY(i,i<2?0:80/1024);skirt.setAttribute('jawWeight',new THREE.Float32BufferAttribute([1,1,1,1],1));const extension=new THREE.Mesh(skirt,material);extension.position.set(768,-40,0);this.scene.add(extension);
 }
 draw(amount){this.uniform.value=amount*34;this.renderer.render(this.scene,this.camera);return this.renderer.domElement;}
}
