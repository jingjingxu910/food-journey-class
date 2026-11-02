import * as THREE from './vendor/three.module.js';

// The chamber and both dental arches share one coordinate system. Teeth are
// children of their jaw, so chewing cannot separate a crown from its gum.
export function oralAnatomy(root,targets,texture){
 const flesh=new THREE.MeshStandardMaterial({color:0xffdfd8,map:texture,bumpMap:texture,bumpScale:.035,roughness:.48,side:THREE.DoubleSide});
 const enamel=new THREE.MeshStandardMaterial({color:0xe5d7c3,roughness:.34,metalness:0});
 const add=(g,m,kind,parent=root)=>{const o=new THREE.Mesh(g,m);parent.add(o);if(kind){o.userData.kind=kind;targets.push(o);}return o;};
 const upper=new THREE.Group(),lower=new THREE.Group();root.add(upper,lower);
 const shell=new THREE.SphereGeometry(1,64,44);const p=shell.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,x*3.25,y*2.35,z*6-1.7);}shell.computeVertexNormals();
 const interior=flesh.clone();interior.side=THREE.BackSide;add(shell,interior,'wall');
 const teeth=[];
 for(const top of [true,false]){
  const parent=top?upper:lower,y=top?1.3:-1.22,arch=[];
  for(let j=0;j<=40;j++){const a=-.12+j/40*(Math.PI+.24);arch.push(new THREE.Vector3(Math.cos(a)*2.42,y,Math.sin(a)*3.25-2.6));}
  const gum=add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arch),80,.34,12,false),flesh,'wall',parent);gum.scale.y=1.13;
  for(let j=0;j<14;j++){
   const a=j/13*Math.PI,x=Math.cos(a)*2.31,z=Math.sin(a)*3.13-2.6,front=Math.abs(a-Math.PI/2)<.58;
   const g=new THREE.SphereGeometry(1,28,20),v=g.attributes.position;
   for(let k=0;k<v.count;k++){const sx=v.getX(k),sy=v.getY(k),sz=v.getZ(k),round=n=>Math.sign(n)*Math.pow(Math.abs(n),front?.52:.72),width=front?.255:.29,depth=front?.145:.30;
    const crown=1-.1*Math.max(0,sy);let h=round(sy)*(front?.34:.29);
    // A shallow, rounded occlusal groove on molars, thin incisal edge in front.
    if(!front&&sy*(top?-1:1)>.45)h+=(top?1:-1)*.055*Math.exp(-(sx*sx+sz*sz)*8);
    v.setXYZ(k,round(sx)*width*crown,h,round(sz)*depth*crown);
   }g.computeVertexNormals();const t=add(g,enamel,'teeth',parent);t.position.set(x,y+(top?-.31:.31),z);t.rotation.y=-a+Math.PI/2;teeth.push(t);
  }
 }
 const tongue=add(new THREE.SphereGeometry(1,56,30),flesh,'tongue',lower);tongue.position.set(0,-1.15,-1.1);tongue.scale.set(1.92,.48,3.25);
 // A real posterior opening, with soft-palate arches and a uvula above it.
 const throat=add(new THREE.CircleGeometry(1,64),new THREE.MeshStandardMaterial({color:0x54272d,roughness:.7,side:THREE.DoubleSide}),'exit');throat.position.set(0,.05,-6.35);throat.scale.set(1.03,1.3,1);
 for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*1.38,-.75,-5.45),new THREE.Vector3(side*1.3,.65,-5.65),new THREE.Vector3(side*.65,1.35,-5.7),new THREE.Vector3(0,1.4,-5.7)]);add(new THREE.TubeGeometry(curve,32,.19,10,false),flesh,'wall');}
 const uvula=add(new THREE.SphereGeometry(1,24,16),flesh,'wall');uvula.position.set(0,1.02,-5.65);uvula.scale.set(.18,.5,.2);
 const palate=new THREE.PlaneGeometry(4.9,7.5,48,64),palateVertices=palate.attributes.position;for(let i=0;i<palateVertices.count;i++){const x=palateVertices.getX(i),z=palateVertices.getY(i)-1.4;palateVertices.setXYZ(i,x,1.62+.5*Math.max(0,1-x*x/6)+.035*Math.sin(z*10+Math.abs(x)*1.7)*Math.max(0,1-Math.abs(z)/4),z);}palate.computeVertexNormals();add(palate,flesh,'wall');
 const salivaMaterial=new THREE.MeshStandardMaterial({color:0xd3f4ff,emissive:0x4b8799,emissiveIntensity:.18,roughness:.1,transparent:true,opacity:.9});
 for(const side of [-1,1])for(let j=0;j<3;j++){const drop=add(dropGeometry(.11),salivaMaterial,'saliva');drop.position.set(side*(2.25-j*.11),-.33-j*.22,-1.9+j*.22);}
 return{lower,tongue,teeth};
}

export function dropGeometry(radius){const points=[];for(let i=0;i<=20;i++){const y=i/20;points.push(new THREE.Vector2(radius*Math.sin(Math.PI*y)*(.97-.22*y),radius*(y*2.5-1)));}return new THREE.LatheGeometry(points,18);}

export function pharynxAnatomy(root,targets,texture){
 const flesh=new THREE.MeshStandardMaterial({color:0xffd9ce,map:texture,bumpMap:texture,bumpScale:.025,roughness:.5,side:THREE.DoubleSide});flesh.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(.50,.20,.18),diffuseColor.rgb,.32);');};
 const add=(g,m,kind)=>{const o=new THREE.Mesh(g,m);root.add(o);if(kind){o.userData.kind=kind;targets.push(o);}return o;};
 const interior=flesh.clone();interior.side=THREE.BackSide;const room=add(new THREE.SphereGeometry(1,56,36),interior,'wall');room.position.set(0,-1,-3.8);room.scale.set(3.3,4.5,5.8);
 const floorShape=new THREE.Shape();floorShape.moveTo(-3.5,1);floorShape.lineTo(3.5,1);floorShape.lineTo(3.5,-8);floorShape.lineTo(-3.5,-8);floorShape.closePath();for(const [z,r] of [[-2.7,.7],[-5.2,.8]]){const hole=new THREE.Path();hole.absellipse(0,z,r,r,0,Math.PI*2,true,0);floorShape.holes.push(hole);}const floorGeometry=new THREE.ShapeGeometry(floorShape,48),floorVertices=floorGeometry.attributes.position;for(let i=0;i<floorVertices.count;i++){const x=floorVertices.getX(i),z=floorVertices.getY(i);floorVertices.setXYZ(i,x,-1.38,z);floorGeometry.attributes.uv.setXY(i,(x+3.5)/7,(z+8)/9);}floorGeometry.computeVertexNormals();add(floorGeometry,flesh,'wall');
 for(const [kind,z,r] of [['airway',-2.7,.67],['foodway',-5.2,.77]]){
  const tube=add(new THREE.CylinderGeometry(r,r*.77,5,56,12,true),flesh,kind);tube.position.set(0,-3.9,z);
  const rim=add(new THREE.TorusGeometry(r,.12,12,64),flesh,kind);rim.rotation.x=Math.PI/2;rim.position.set(0,-1.38,z);rim.scale.y=1.25;
  const dark=add(new THREE.CircleGeometry(r*.94,48),new THREE.MeshStandardMaterial({color:0x48282a,roughness:.75,side:THREE.DoubleSide}),kind);dark.rotation.x=-Math.PI/2;dark.position.set(0,-1.6,z);dark.scale.y=1.25;
  if(kind==='airway'){for(let j=0;j<4;j++){const ring=add(new THREE.TorusGeometry(r*.92,.035,8,40),new THREE.MeshStandardMaterial({color:0xcba99e,roughness:.55}));ring.rotation.x=Math.PI/2;ring.position.set(0,-2-j*.6,z);}for(const side of [-1,1]){const fold=add(new THREE.SphereGeometry(1,24,16),flesh,kind);fold.position.set(side*.37,-1.25,z);fold.scale.set(.13,.1,.7);}}
 }
 const leaf=new THREE.Shape();leaf.moveTo(0,-.58);leaf.bezierCurveTo(-.18,-.2,-.65,.15,-.47,.56);leaf.bezierCurveTo(-.26,.9,.26,.9,.47,.56);leaf.bezierCurveTo(.65,.15,.18,-.2,0,-.58);
 const flap=add(new THREE.ExtrudeGeometry(leaf,{depth:.07,bevelEnabled:true,bevelThickness:.06,bevelSize:.07,bevelSegments:3,steps:1}),flesh,'flap');flap.position.set(-.58,-.55,-2.6);flap.scale.setScalar(.72);flap.rotation.set(-.8,0,.4);
 return{flap};
}
