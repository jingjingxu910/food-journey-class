import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
export async function createConnectedOverlay(mount,onSelect){
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setClearColor(0,0);mount.prepend(renderer.domElement);
 const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,5000);camera.position.z=2000;
 scene.add(new THREE.HemisphereLight(0xffffff,0x866865,2.1));const key=new THREE.DirectionalLight(0xffeee2,2.2);key.position.set(-300,500,1000);scene.add(key);
 const models=new Map(),pickable=[],loader=new GLTFLoader();let manifest;
 try{const response=await fetch('assets/models/ar-connected/manifest.json');if(!response.ok)throw new Error('解剖模型清单加载失败');manifest=await response.json();
 for(const [id,entry]of Object.entries(manifest)){
  const gltf=await loader.loadAsync(`assets/models/ar-connected/${id}.glb`),geometries=[],sourceMaterials=[];gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o=>{if(o.isMesh){const g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);geometries.push(g);sourceMaterials.push((Array.isArray(o.material)?o.material[0]:o.material).clone());}});
  const geometry=mergeGeometries(geometries,id==='mouth');geometries.forEach(g=>g.dispose());
  const respiratory=['trachea','right-lung','left-lung','nasal-cavity'].includes(id);
  const material=new THREE.MeshStandardMaterial({color:respiratory?0x88bbc8:id==='liver'?0x934b3d:id==='pancreas'?0xe9b898:id==='gallbladder'?0x709667:id==='heart'?0xb05259:id==='large-intestine'?0xb95d64:0xe59683,roughness:.53,metalness:0,transparent:respiratory,opacity:respiratory?.28:1,depthWrite:!respiratory});
  const mesh=new THREE.Mesh(geometry,id==='mouth'?sourceMaterials:material);mesh.userData.id=id;mesh.visible=true;root.add(mesh);models.set(id,mesh);pickable.push(mesh);
 }
 }catch(error){for(const m of models.values()){m.geometry.dispose();for(const mat of (Array.isArray(m.material)?m.material:[m.material]))mat.dispose();}renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();throw error;}
 let w=1,h=1;const resize=()=>{w=mount.clientWidth;h=mount.clientHeight;renderer.setSize(w,h,false);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(mount);resize();
 let active=false,rotation=0,scale=1,offset={x:0,y:0};
 const ray=new THREE.Raycaster();renderer.domElement.onpointerup=e=>{if(!active)return;const b=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);const hit=ray.intersectObjects(pickable.filter(m=>m.visible))[0];if(hit)onSelect(hit.object.userData.id);};
 return {manifest,models,
 update(point){active=!!point;root.visible=active;if(point){const a=point.angle,width=point.w/.12,height=point.h/.60;const x=point.x-Math.sin(a)*height*.42,y=point.y+Math.cos(a)*height*.42;root.position.set(x-w/2+offset.x,h/2-y-offset.y,0);root.scale.set(width/.99*scale,height/1.35*scale,width/.99*scale);root.rotation.set(0,rotation+(point.yaw||0),-a);}renderer.render(scene,camera);},
 calibrate(s,x,y){scale=s;offset={x,y};},rotate(value){rotation=value;},
 respiratory(show){for(const [id,m]of models)if(['trachea','right-lung','left-lung','nasal-cavity'].includes(id))m.visible=show;},
 contextImage(){renderer.render(scene,camera);return renderer.domElement.toDataURL("image/png");},
 anchor(id){const m=models.get(id);if(!m||!active)return null;const center=new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).project(camera);return{x:(center.x+1)*w/2,y:(1-center.y)*h/2};},
 select(id){for(const [key,m]of models)for(const mat of (Array.isArray(m.material)?m.material:[m.material]))mat.emissive?.setHex(key===id?0x482418:0);},
 dispose(){observer.disconnect();for(const m of models.values()){m.geometry.dispose();for(const mat of (Array.isArray(m.material)?m.material:[m.material]))mat.dispose();}renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
 };
}
