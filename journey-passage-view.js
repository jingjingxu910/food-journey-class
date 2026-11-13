const smooth=(v,a=0,b=1)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const copy=source=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);return c;};
export class PassageView{
 constructor(stage){this.stage=stage;this.canvas=document.createElement('canvas');this.canvas.id='passage-view';this.canvas.hidden=true;stage.append(this.canvas);this.ctx=this.canvas.getContext('2d',{alpha:false});this.foreground=document.createElement('canvas');this.progress=0;this.softOpening=document.createElement('canvas');this.softOpening.width=this.softOpening.height=256;const c=this.softOpening.getContext('2d'),g=c.createRadialGradient(128,128,114,128,128,128);g.addColorStop(0,'#fff');g.addColorStop(1,'#fff0');c.fillStyle=g;c.fillRect(0,0,256,256);}
 begin({source,mask,focus={x:.5,y:.5},blend=false,push=0,blendStart=.08}){
  this.blend=blend;this.push=push;this.blendStart=blendStart;
  this.source=copy(source);this.opening={...(mask?.opening||{...focus,rx:.12,ry:.12})};this.opening.x=Math.max(.08,Math.min(.92,this.opening.x));this.opening.y=Math.max(.08,Math.min(.92,this.opening.y));this.canvas.hidden=false;this.progress=0;this.stage.classList.add('in-passage');this.draw(0,this.source);
 }
 draw(progress,destination){
  this.progress=progress;const r=this.stage.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.25),w=Math.round(r.width*d),h=Math.round(r.height*d);if(!w||!h||!destination?.width||!destination?.height)return false;if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.foreground.width=w;this.foreground.height=h;}
  const c=this.ctx;c.fillStyle='#281617';c.fillRect(0,0,w,h);if(progress>=1){c.drawImage(destination,0,0,w,h);return true;}
  if(this.blend){
   const scale=1+this.push*smooth(progress,0,this.blendStart);
   c.drawImage(this.source,this.opening.x*w*(1-scale),this.opening.y*h*(1-scale),w*scale,h*scale);
   c.globalAlpha=smooth(progress,this.blendStart,.97);
   const settle=smooth(progress,this.blendStart,1);
   const destinationScale=1+(this.push>1?.14:0)*(1-settle);
   c.drawImage(destination,w*(1-destinationScale)/2,h*(1-destinationScale)/2,w*destinationScale,h*destinationScale);
   c.globalAlpha=1;
   return true;
  }
  const o=this.opening,e=smooth(progress),z=1+.5*e,cx=o.x*w,cy=o.y*h;
  // Render the following cavity without changing its aspect ratio. It approaches
  // from behind the opening; it is never compressed to a slit or double-exposed.
  const pan=smooth(progress,.1,.95),cover=1+2*Math.max(Math.abs(o.x-.5),Math.abs(o.y-.5)),nextZoom=1+(cover-1)*(1-pan),nextX=cx+(w/2-cx)*pan,nextY=cy+(h/2-cy)*pan;
  c.drawImage(destination,nextX-w*nextZoom/2,nextY-h*nextZoom/2,w*nextZoom,h*nextZoom);
  const f=this.foreground.getContext('2d');f.globalCompositeOperation='source-over';f.clearRect(0,0,w,h);f.drawImage(this.source,cx-cx*z,cy-cy*z,w*z,h*z);
  const grow=smooth(progress,.1,.96),rx=(o.rx+(1.3-o.rx)*grow)*w,ry=(o.ry+(1.45-o.ry)*grow)*h;f.save();f.globalCompositeOperation='destination-out';f.globalAlpha=smooth(progress,0,.12);f.drawImage(this.softOpening,cx-rx,cy-ry,rx*2,ry*2);f.restore();c.drawImage(this.foreground,0,0);return true;
 }
 finish(){this.canvas.hidden=true;this.stage.classList.remove('in-passage');}
}
export function openingMask(source,points){const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const x=c.getContext('2d');x.fillStyle='#fff';x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x*c.width,p.y*c.height):x.moveTo(p.x*c.width,p.y*c.height));x.closePath();x.fill();const left=Math.max(0,Math.min(...points.map(p=>p.x))),right=Math.min(1,Math.max(...points.map(p=>p.x))),top=Math.max(0,Math.min(...points.map(p=>p.y))),bottom=Math.min(1,Math.max(...points.map(p=>p.y)));if(right>left&&bottom>top)c.opening={x:(left+right)/2,y:(top+bottom)/2,rx:(right-left)/2,ry:(bottom-top)/2};return c;}
