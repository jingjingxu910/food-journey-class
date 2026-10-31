import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
function disposeModel(group){group.traverse(node=>{node.geometry?.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];for(const m of materials)if(m){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});}
export async function createOrganViewer(mount,url,resetButton,isCurrent){
 const gltf=await new GLTFLoader().loadAsync(url);if(!isCurrent()){disposeModel(gltf.scene);return null;}
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});}catch(error){disposeModel(gltf.scene);throw error;}
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f5ef);
 const camera=new THREE.PerspectiveCamera(40,1,.05,30);camera.position.set(0,0,4.7);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));mount.replaceChildren(renderer.domElement);
 const group=new THREE.Group();group.add(gltf.scene);scene.add(group);scene.add(new THREE.HemisphereLight(0xffffff,0x826c65,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,3,4);scene.add(light);
 let frame=0,lastX,lastY,drag=false;
 const request=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
 renderer.domElement.onpointerdown=e=>{drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);};
 renderer.domElement.onpointermove=e=>{if(!drag)return;group.rotation.y+=(e.clientX-lastX)*.009;group.rotation.x=Math.max(-1.3,Math.min(1.3,group.rotation.x+(e.clientY-lastY)*.009));lastX=e.clientX;lastY=e.clientY;request();};
 renderer.domElement.onpointerup=renderer.domElement.onpointercancel=()=>drag=false;
 const resize=()=>{if(!mount.clientWidth)return;renderer.setSize(mount.clientWidth,mount.clientHeight,false);camera.aspect=mount.clientWidth/mount.clientHeight;camera.updateProjectionMatrix();request();};
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(mount);window.addEventListener('resize',resize);resize();
 resetButton.onclick=()=>{group.rotation.set(0,0,0);request();};
 return ()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resize);resetButton.onclick=null;disposeModel(group);renderer.dispose();renderer.forceContextLoss();mount.replaceChildren();};
}
