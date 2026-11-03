// Lightweight frame-to-frame camera translation. Only apply a consensus match.
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
export function estimateShift(previous,current,w,h,search=6,region={left:0,top:0,right:1,bottom:1}){
 const shifts=[];
 for(const fy of [.25,.45,.65,.8])for(const fx of [.2,.4,.6,.8]){
  const x=Math.max(9,Math.min(w-10,Math.round(w*(region.left+(region.right-region.left)*fx)))),y=Math.max(9,Math.min(h-10,Math.round(h*(region.top+(region.bottom-region.top)*fy))));let sum=0,sq=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const v=previous[(y+j)*w+x+i];sum+=v;sq+=v*v;}if(sq/25-(sum/25)**2<90)continue;
  let best=Infinity,bx=0,by=0;
  for(let dy=-search;dy<=search;dy++)for(let dx=-search;dx<=search;dx++){let error=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const d=previous[(y+j)*w+x+i]-current[(y+j+dy)*w+x+i+dx];error+=d*d;}if(error<best){best=error;bx=dx;by=dy;}}
  if(best/25<400&&Math.abs(bx)<search&&Math.abs(by)<search)shifts.push({x:bx,y:by});
 }
 if(shifts.length<5)return null;const x=median(shifts.map(s=>s.x)),y=median(shifts.map(s=>s.y));const good=shifts.filter(s=>Math.hypot(s.x-x,s.y-y)<1.5);return good.length>=Math.max(5,shifts.length*.6)?{x,y}:null;
}
export class CameraMotion{
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=128;this.canvas.height=96;this.ctx=this.canvas.getContext('2d',{willReadFrequently:true});this.reset();}
 reset(){this.previous=null;this.region=undefined;this.x=0;this.y=0;this.reliable=false;this.last=0;this.sequence=(this.sequence||0)+1;}
 setRegion(points){if(!points?.[11]||!points?.[24])return;const p=[11,12,23,24].map(i=>points[i]);this.region={left:Math.max(.08,Math.min(...p.map(p=>p.x))-.05),right:Math.min(.92,Math.max(...p.map(p=>p.x))+.05),top:Math.max(.08,Math.min(...p.map(p=>p.y))),bottom:Math.min(.92,Math.max(...p.map(p=>p.y)))};}
 snapshot(){return{x:this.x,y:this.y,sequence:this.sequence};}
 update(video,now){if(now-this.last<60||video.readyState<2)return;if(this.last&&now-this.last>250)this.reset();this.last=now;const w=128,h=96;this.ctx.drawImage(video,0,0,w,h);const rgba=this.ctx.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);for(let i=0;i<gray.length;i++)gray[i]=(rgba[i*4]*3+rgba[i*4+1]*6+rgba[i*4+2])/10;let shift=null;if(this.previous){let diff=0;for(let i=0;i<gray.length;i+=8)diff+=Math.abs(gray[i]-this.previous[i]);diff/=gray.length/8;shift=diff<2?{x:0,y:0}:estimateShift(this.previous,gray,w,h,6,this.region);}this.reliable=!!shift;if(shift){this.x+=shift.x/w;this.y+=shift.y/h;if(this.region){this.region.left+=shift.x/w;this.region.right+=shift.x/w;this.region.top+=shift.y/h;this.region.bottom+=shift.y/h;}}else if(this.previous){this.x=0;this.y=0;this.sequence++;}this.previous=gray;}
}
