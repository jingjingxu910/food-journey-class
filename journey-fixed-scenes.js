const W=1536,H=1024,clamp=x=>Math.max(0,Math.min(1,x)),smooth=(x,a,b)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const canvas=()=>Object.assign(document.createElement('canvas'),{width:W,height:H});
// Leave space above the two openings for the companion bubble.
const pharynxExtension=128;
const pharynxUpperMargin=96;
const pharynxHeight=H+pharynxExtension;
const sceneHeight=name=>name==='pharynx'?pharynxHeight:H;
let mouth,pharynx,closedPharynx,upper,lower,oralPortal,pharynxFrame,pharynxPortal,mouthChew,swallowOverlay;
export const fixedStage=name=>name==='mouth'||name==='pharynx';
export function lowerJawPath(ctx){ctx.beginPath();ctx.moveTo(0,H*.40);ctx.bezierCurveTo(W*.05,H*.42,W*.10,H*.43,W*.16,H*.43);ctx.bezierCurveTo(W*.18,H*.43,W*.22,H*.50,W*.24,H*.56);ctx.bezierCurveTo(W*.30,H*.50,W*.40,H*.51,W*.50,H*.515);ctx.bezierCurveTo(W*.60,H*.51,W*.70,H*.50,W*.76,H*.56);ctx.bezierCurveTo(W*.78,H*.50,W*.82,H*.43,W*.84,H*.43);ctx.bezierCurveTo(W*.90,H*.43,W*.95,H*.42,W,H*.40);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();}
export async function prepareFixedScenes(){
 mouth=new Image();pharynx=new Image();closedPharynx=new Image();
 mouth.src='assets/journey/mouth.webp';
 pharynx.src='assets/journey/pharynx-mouth-style-v5.webp';
 closedPharynx.src='assets/journey/pharynx-closed-v1.png';
 await Promise.all([mouth.decode(),pharynx.decode(),closedPharynx.decode()]);
 mouthChew=new MouthChew(mouth);mouthChew.draw(0);
 upper=canvas();lower=canvas();const u=upper.getContext('2d'),l=lower.getContext('2d');u.drawImage(mouth,0,0,W,H);u.globalCompositeOperation='destination-out';lowerJawPath(u);u.fill();u.globalCompositeOperation='source-over';l.save();lowerJawPath(l);l.clip();l.drawImage(mouth,0,0,W,H);l.restore();
 oralPortal=canvas();const o=oralPortal.getContext('2d');o.fillStyle='#fff';o.beginPath();o.moveTo(W*.285,H*.61);o.bezierCurveTo(W*.30,H*.47,W*.30,H*.37,W*.385,H*.355);o.bezierCurveTo(W*.435,H*.34,W*.463,H*.365,W*.475,H*.40);o.lineTo(W*.478,H*.458);o.bezierCurveTo(W*.48,H*.486,W*.52,H*.486,W*.525,H*.458);o.lineTo(W*.535,H*.40);o.bezierCurveTo(W*.55,H*.365,W*.60,H*.34,W*.647,H*.355);o.bezierCurveTo(W*.72,H*.38,W*.72,H*.50,W*.72,H*.61);o.closePath();o.fill();o.globalCompositeOperation='destination-out';lowerJawPath(o);o.fill();
 // The scene uses the mouth-style generated mucosal illustration.
 // It remains a teaching illustration rather than a clinical photograph.
 pharynxFrame=canvas();pharynxFrame.getContext('2d').drawImage(pharynx,0,0,W,H);
 // Preserve the original upper passage while the epiglottis closes below it.
 swallowOverlay=canvas();
 const overlay=swallowOverlay.getContext('2d');
 overlay.drawImage(closedPharynx,0,0,W,H);
 const fade=overlay.createLinearGradient(0,H*.24,0,H*.36);
 fade.addColorStop(0,'transparent');
 fade.addColorStop(1,'black');
 overlay.globalCompositeOperation='destination-in';
 overlay.fillStyle=fade;
 overlay.fillRect(0,0,W,H);
 pharynxPortal=canvas();pharynxPortal.height=pharynxHeight;const p=pharynxPortal.getContext('2d');p.fillStyle='#fff';p.beginPath();p.ellipse(W*.5,pharynxExtension+H*.151,W*.155,H*.026,0,0,Math.PI*2);p.fill();
}
export class FixedScenes{
 constructor(element){this.canvas=element;this.ctx=element.getContext('2d');this.foreground=canvas();this.frame=canvas();this.pharynxDisplay=canvas();this.pharynxDisplay.height=pharynxHeight;this.chew=0;this.phase='mouth';this.progress=0;}
 fit(name=this.phase){const rect=this.canvas.getBoundingClientRect(),sourceHeight=sceneHeight(name),scale=Math.max(rect.width/W,rect.height/sourceHeight);return{width:rect.width,height:rect.height,scale,left:(rect.width-W*scale)/2,top:(rect.height-sourceHeight*scale)/2};}
 resize(){const b=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5),w=Math.round(b.width*ratio),h=Math.round(b.height*ratio);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;return true;}return false;}
 sourcePoint(clientX,clientY){const b=this.canvas.getBoundingClientRect(),r=this.fit();return{x:(clientX-b.left-r.left)/(W*r.scale),y:(clientY-b.top-r.top)/(H*r.scale)};}
 project(x,y){const r=this.fit();return{x:(r.left+x*W*r.scale)/r.width,y:(r.top+y*H*r.scale)/r.height};}
 pick(name,clientX,clientY){const {x,y}=this.sourcePoint(clientX,clientY);return this.kind(name,x,y);}
 kind(name,x,y){if(name==='pharynx')y-=pharynxExtension/H;if(name==='mouth'){const dx=Math.abs(x-.5),upper=.10+Math.pow(Math.min(1,dx/.43),2)*.26;if(y<upper&&x>.045&&x<.955)return'teeth';if((y>.49&&(x<.225||x>.775))||y>.875)return'teeth';if(y>.54&&x>.24&&x<.76)return'tongue';if(((x-.5)/.17)**2+((y-.51)/.07)**2<1)return'exit';return'wall';}if(((x-.5)/.165)**2+((y-.151)/.035)**2<1)return'foodway';if(((x-.5)/.105)**2+((y-.49)/.12)**2<1)return'airway';return'wall';}
 targets(name){const result=[],b=this.canvas.getBoundingClientRect();for(let x=.10;x<=.9;x+=.065)for(let y=.16;y<=.84;y+=.055){const p=this.project(x,y),kind=this.kind(name,x,y);if(kind!=='wall'&&p.x>.05&&p.x<.95&&p.y>.05&&p.y<.95&&document.elementFromPoint(b.left+b.width*p.x,b.top+b.height*p.y)===this.canvas)result.push({kind,...p});}return result;}
 mouthFrame(amount){return amount>.0001?mouthChew.draw(amount):mouth;}
 passageSpec(name){const mask=canvas();mask.width=this.canvas.width;mask.height=this.canvas.height;const height=sceneHeight(name),s=Math.max(mask.width/W,mask.height/height);mask.getContext('2d').drawImage(name==='mouth'?oralPortal:pharynxPortal,(mask.width-W*s)/2,(mask.height-height*s)/2,W*s,height*s);const o=name==='mouth'?{x:.5025,y:.445,rx:.2175,ry:.10}:{x:.5,y:.151+pharynxExtension/H,rx:.155,ry:.026},fit=this.fit(),center=this.project(o.x,o.y);mask.opening={...center,rx:o.rx*W*fit.scale/fit.width,ry:o.ry*H*fit.scale/fit.height};return{source:this.canvas,mask,focus:center};}
 drawSource(source,scale=1,focus={x:.5,y:.5},height=H){const c=this.canvas,fit=Math.max(c.width/W,c.height/height),w=W*fit*scale,h=height*fit*scale;this.ctx.drawImage(source,c.width*.5-focus.x*w,c.height*.5-focus.y*h,w,h);}
 pharynxView(){
  if(!this.swallow)return pharynxFrame;
  const c=this.frame.getContext('2d');
  const blend=smooth(this.swallow,0,1);
  c.drawImage(pharynxFrame,0,0,W,H);
  c.save();
  c.globalAlpha=blend;
  c.drawImage(swallowOverlay,0,0,W,H);
  c.restore();
  return this.frame;
 }
 draw(name,amount=0){
 const resized=this.resize();
 if(!resized&&this.painted&&this.phase===name&&(name==='pharynx'?this.paintedSwallow===this.swallow:this.chew===amount)&&this.progress===0)return;
 this.paintedSwallow=this.swallow;
 this.painted=true;this.phase=name;this.chew=amount;this.progress=0;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);if(name==='mouth'){this.drawSource(this.mouthFrame(amount));return;}
 const frame=this.pharynxView(),display=this.pharynxDisplay.getContext('2d');
 // Continue the original texture above its top edge without rescaling the anatomy.
 for(let row=0;row<pharynxUpperMargin;row++){
  const extend=y=>{
   const t=y/pharynxUpperMargin;
   return Math.round(y+pharynxExtension*t*(2-t));
  };
  const top=extend(row),bottom=extend(row+1);
  display.drawImage(frame,0,row,W,1,0,top,W,bottom-top);
 }
 display.drawImage(frame,0,pharynxUpperMargin,W,H-pharynxUpperMargin,
  0,pharynxUpperMargin+pharynxExtension,W,H-pharynxUpperMargin);
 this.drawSource(this.pharynxDisplay,1,undefined,pharynxHeight);}
 portal(from,to,progress,liveBackground){this.resize();this.progress=progress;const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(from==='mouth')this.drawSource(this.pharynxView(liveBackground));else if(liveBackground){const fit=Math.max(w/W,h/H),a=smooth(progress,0,.86),mix=(x,y)=>x+(y-x)*a;c.drawImage(liveBackground,mix((w-W*fit)/2+W*.29*fit,0),mix((h-H*fit)/2+H*.23*fit,0),mix(W*.42*fit,w),mix(H*.15*fit,h));}const f=this.foreground.getContext('2d');f.clearRect(0,0,W,H);f.globalCompositeOperation='source-over';f.drawImage(from==='mouth'?this.mouthFrame(0):pharynxFrame,0,0);f.globalCompositeOperation='destination-out';f.globalAlpha=smooth(progress,.06,.33);f.drawImage(from==='mouth'?oralPortal:pharynxPortal,0,0);f.globalAlpha=1;f.globalCompositeOperation='source-over';const pan=smooth(progress,0,.42),zoom=Math.exp(Math.log(from==='mouth'?40:16)*smooth(progress,.08,1)),focus={x:.5,y:.5+((from==='mouth'?.5005:.31)-.5)*pan};this.drawSource(this.foreground,zoom,focus);}
}
import {MouthChew} from './journey-mouth-chew.js';
