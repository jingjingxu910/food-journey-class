// Coordinates are in the unmirrored camera image, not the cropped screen.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export class AdaptiveFilter {
  constructor(){this.value=null;this.time=0;this.speed=0;}
  update(value,time){
    if(this.value===null||time-this.time>500){this.value=value;this.time=time;return value;}
    const dt=clamp((time-this.time)/1000,.005,.3),raw=(value-this.value)/dt;
    const a=1/(1+1/(2*Math.PI*1.2*dt));this.speed+=a*(raw-this.speed);
    const cutoff=1.8+1.5*Math.abs(this.speed),alpha=1/(1+1/(2*Math.PI*cutoff*dt));
    this.value+=alpha*(value-this.value);this.time=time;return this.value;
  }
}
export function fitBody(points,aspect=1){
  const required=[11,12,23,24];
  if(!points||required.some(i=>!points[i]||!Number.isFinite(points[i].x)||!Number.isFinite(points[i].y)||(points[i].visibility??0)<.65))return null;
  points=points.map(p=>({...p,x:p.x*aspect}));
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const shoulder=mid(points[11],points[12]),hip=mid(points[23],points[24]);
  const dx=points[11].x-points[12].x,dy=points[11].y-points[12].y;
  const width=Math.hypot(dx,dy),tx=hip.x-shoulder.x,ty=hip.y-shoulder.y,height=Math.hypot(tx,ty);
  if(width<.10*aspect||height<.14||width>height*1.8||width<height*.35||ty<.08)return null;
  // Person's left is landmark 11; it must not be inferred from screen X.
  const right={x:dx/width,y:dy/width};
  const down={x:-right.y,y:right.x};if(down.y<0){down.x*=-1;down.y*=-1;}
  const anchor=(x,y,w,h)=>({x:shoulder.x+right.x*width*x+down.x*height*y,y:shoulder.y+right.y*width*x+down.y*height*y,w:width*w,h:height*h,angle:Math.atan2(right.y,right.x)});
  const result={
    esophagus:anchor(0,.09,.12,.60),stomach:anchor(.16,.47,.46,.43),
    'small-intestine':anchor(.01,.83,.61,.49),'large-intestine':anchor(0,.86,.83,.66)
  };
  if(points[9]?.visibility>.55&&points[10]?.visibility>.55){const mouth=mid(points[9],points[10]);result.mouth={...anchor(0,0,.25,.22),...mouth};}
  for(const p of Object.values(result)){p.x/=aspect;p.w/=aspect;p.angle=Math.atan2(Math.sin(p.angle),Math.cos(p.angle)/aspect);}
  return result;
}
export function mapOverlay(point,stageWidth,stageHeight,videoWidth,videoHeight){
  const scale=Math.max(stageWidth/videoWidth,stageHeight/videoHeight),w=videoWidth*scale,h=videoHeight*scale;
  return {x:(stageWidth-w)/2+point.x*w,y:(stageHeight-h)/2+point.y*h,w:point.w*w,h:point.h*h,angle:Math.atan2(Math.sin(point.angle)*h,Math.cos(point.angle)*w)};
}
export class BodyTracker {
  constructor(){this.filters=new Map();}
  update(points,time,aspect=1){
    const body=fitBody(points,aspect);if(!body)return null;
    for(const [id,p] of Object.entries(body))for(const axis of ['x','y','w','h','angle']){
      const key=id+axis;if(!this.filters.has(key))this.filters.set(key,new AdaptiveFilter());
      p[axis]=this.filters.get(key).update(p[axis],time);
    }
    return body;
  }
  reset(){this.filters.clear();}
}
