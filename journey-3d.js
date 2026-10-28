import * as THREE from './vendor/three.module.js';

// Lightweight anatomical teaching model: a real mesh viewed from inside.
// It deliberately uses stylised colours; the photographic scenes remain available.
export function createJourney3D(host){
  let renderer,scene,camera,wall,light,wallTexture,active=false,organ='',targetZ=7,lastFrame=0,frameId=0;
  let yaw=0,pitch=0;
  const settings={
    esophagus:{radius:2.65,fold:.26},
  };
  function init(){
    if(renderer)return true;
    try{
      renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
      renderer.setClearColor(0x573039);
      host.append(renderer.domElement);
      scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x51262d,.025);
      camera=new THREE.PerspectiveCamera(82,1,.08,75);
      scene.add(new THREE.AmbientLight(0xffd6c7,.65));
      light=new THREE.PointLight(0xffdcc9,24,19,1.35);scene.add(light);
      resize();return true;
    }catch(error){console.warn('三维场景不可用',error);renderer?.dispose();renderer=null;host.replaceChildren();return false;}
  }
  function tissueTexture(){
    if(wallTexture)return wallTexture;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
    const ctx=canvas.getContext('2d');const image=ctx.createImageData(512,512);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const u=x/512*2*Math.PI,v=y/512*2*Math.PI;
      const long=7*Math.sin(u*14+Math.sin(v*2)*.5)+5*Math.sin(u*30+Math.sin(v)*.6);
      const fold=8*Math.sin(v*8+Math.sin(u*2)*.5);
      const grain=3*Math.sin(u*83+v*59)*Math.sin(v*71-u*43);
      const shade=long+fold+grain;
      const p=(y*512+x)*4;image.data[p]=201+shade;image.data[p+1]=102+shade*.8;image.data[p+2]=98+shade*.75;image.data[p+3]=255;
    }
    ctx.putImageData(image,0,0);
    wallTexture=new THREE.CanvasTexture(canvas);wallTexture.wrapS=THREE.RepeatWrapping;wallTexture.wrapT=THREE.RepeatWrapping;
    wallTexture.repeat.set(1,3);wallTexture.colorSpace=THREE.SRGBColorSpace;
    const photo=new Image();photo.src='assets/journey/esophagus.webp';
    photo.onload=()=>{
      // Mirror both edges so the photographic tissue wraps around the tube without a cut line.
      ctx.drawImage(photo,0,0,Math.min(660,photo.width),photo.height,0,0,256,256);
      ctx.save();ctx.translate(512,0);ctx.scale(-1,1);
      ctx.drawImage(photo,0,0,Math.min(660,photo.width),photo.height,0,0,256,256);
      ctx.restore();
      ctx.save();ctx.translate(0,512);ctx.scale(1,-1);ctx.drawImage(canvas,0,0,512,256,0,0,512,256);ctx.restore();
      wallTexture.needsUpdate=true;
    };
    return wallTexture;
  }
  function build(type){
    if(wall){scene.remove(wall);wall.geometry.dispose();wall.material.dispose();wall=null;}
    const cfg=settings[type],segments=56,rings=180,stride=segments+1,positions=[],uvs=[],indices=[];
    for(let j=0;j<=rings;j++){
      const z=18-j*.42;
      for(let i=0;i<=segments;i++){
        const angle=i/segments*Math.PI*2;
        const lengthwise=Math.sin(z*3.15+Math.sin(angle)*.3);
        const haustra=type==='large'?Math.sin(z*1.4)*.18:0;
        const r=cfg.radius+cfg.fold*lengthwise+haustra+.035*Math.sin(angle*7+z*2.1);
        positions.push(Math.cos(angle)*r,Math.sin(angle)*r,z);
        uvs.push(i/segments,j/rings);
        if(j<rings&&i<segments){
          const a=j*stride+i,b=(j+1)*stride+i;
          const next=a+1,nextB=b+1;
          indices.push(a,b,next,b,nextB,next);
        }
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(indices);geo.computeVertexNormals();
    const normals=geo.getAttribute('normal');
    for(let j=0;j<=rings;j++){
      const a=j*stride,b=a+segments;
      const x=normals.getX(a)+normals.getX(b),y=normals.getY(a)+normals.getY(b),z=normals.getZ(a)+normals.getZ(b);
      const length=Math.hypot(x,y,z)||1;
      normals.setXYZ(a,x/length,y/length,z/length);normals.setXYZ(b,x/length,y/length,z/length);
    }
    normals.needsUpdate=true;
    wall=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tissueTexture(),color:0xffffff,side:THREE.DoubleSide,roughness:.52,metalness:0}));scene.add(wall);
  }
  function resize(){if(!renderer)return;const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function render(time){
    if(!active)return;
    frameId=requestAnimationFrame(render);
    if(time-lastFrame<31)return;lastFrame=time;
    camera.position.z+=(targetZ-camera.position.z)*.09;
    camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
    light.position.set(camera.position.x,camera.position.y,camera.position.z-1);
    renderer.render(scene,camera);
  }
  return {
    show(type,progress=0){
      if(!settings[type]||!init())return false;
      if(organ!==type){organ=type;build(type);yaw=0;pitch=0;camera.position.set(0,0,7);}
      targetZ=7-progress*5.5;
      host.hidden=false;const wasActive=active;active=true;resize();lastFrame=0;
      if(!wasActive)frameId=requestAnimationFrame(render);
      return true;
    },
    hide(){active=false;cancelAnimationFrame(frameId);frameId=0;host.hidden=true;},
    travel(progress){targetZ=7-progress*5.5;},
    look(dx,dy){yaw+=dx*.0055;pitch=Math.max(-1.35,Math.min(1.35,pitch+dy*.0055));host.dataset.heading=String(yaw);},
    resize,
    get active(){return active;},
    get angle(){return yaw;}
  };
}
