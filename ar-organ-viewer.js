import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
function disposeModel(group){group.traverse(node=>{node.geometry?.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];for(const m of materials)if(m){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});}
export async function createOrganViewer(mount,url,resetButton,isCurrent,options={}){
 const gltf=await new GLTFLoader().loadAsync(url);if(!isCurrent()){disposeModel(gltf.scene);return null;}
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'high-performance'});}catch(error){disposeModel(gltf.scene);throw error;}
 const scene=new THREE.Scene();scene.background=null;renderer.setClearColor(0,0);
 const camera=new THREE.OrthographicCamera(-1.65,1.65,1.65,-1.65,.05,30);camera.position.set(0,0,4.7);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1));mount.replaceChildren(renderer.domElement);
 const bounds=new THREE.Box3().setFromObject(gltf.scene),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),fit=2.65/size.length();const group=new THREE.Group();const framed=new THREE.Group();gltf.scene.position.sub(center);framed.add(gltf.scene);framed.scale.setScalar(fit);group.add(framed);const initial=options.initialRotation||[0,0,0];group.rotation.set(...initial);camera.zoom=options.zoom||1;camera.updateProjectionMatrix();scene.add(group);scene.add(new THREE.HemisphereLight(0xffffff,0x826c65,2));const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(2,3,4);scene.add(light);
 let frame=0,lastX,lastY,drag=false;
 const request=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
 const fingers=new Map();let pinch=0;
 renderer.domElement.onpointerdown=e=>{fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);if(fingers.size===2){const [a,b]=[...fingers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}};
 renderer.domElement.onpointermove=e=>{if(!drag)return;fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(fingers.size===2){const [a,b]=[...fingers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0)camera.zoom=Math.max(.65,Math.min(2.5,camera.zoom*distance/pinch));pinch=distance;camera.updateProjectionMatrix();}else{group.rotation.y+=(e.clientX-lastX)*.009;group.rotation.x=Math.max(-1.3,Math.min(1.3,group.rotation.x+(e.clientY-lastY)*.009));}lastX=e.clientX;lastY=e.clientY;request();};
 renderer.domElement.onpointerup=renderer.domElement.onpointercancel=e=>{fingers.delete(e.pointerId);drag=fingers.size>0;pinch=0;const remaining=[...fingers.values()][0];if(remaining){lastX=remaining.x;lastY=remaining.y;}};
 renderer.domElement.onwheel=e=>{e.preventDefault();camera.zoom=Math.max(.65,Math.min(2.5,camera.zoom*Math.exp(-e.deltaY*.001)));camera.updateProjectionMatrix();request();};
 const resize=()=>{if(!mount.clientWidth||!mount.clientHeight)return;renderer.setSize(mount.clientWidth,mount.clientHeight,false);const aspect=mount.clientWidth/mount.clientHeight,halfY=1.65/Math.min(1,aspect);camera.left=-halfY*aspect;camera.right=halfY*aspect;camera.top=halfY;camera.bottom=-halfY;camera.updateProjectionMatrix();request();};
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(mount);window.addEventListener('resize',resize);resize();
 resetButton.onclick=()=>{group.rotation.set(...initial);camera.zoom=options.zoom||1;camera.updateProjectionMatrix();request();};
 const dispose=()=>{cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',resize);resetButton.onclick=null;disposeModel(group);renderer.dispose();renderer.forceContextLoss();mount.replaceChildren();};
}
