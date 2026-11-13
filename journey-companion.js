import {voiceLines} from './journey-voice-lines.js?v=20261113-voice-retake';

const poses={idle:0,greet:1,guide:2,praise:3,think:4,discover:5};
const reactions={hint:'guide',feedback:'discover',praise:'praise',report:'discover',retry:'think',question:'think',greet:'greet'};

export class JourneyCompanion{
 constructor(stage){
  this.last='';
  this.pending=[];
  this.node=document.createElement('section');this.node.id='companion';this.node.hidden=true;this.node.setAttribute('aria-label','探险伙伴小芽');
  this.node.innerHTML='<button id="companion-help" aria-label="请小芽给我提示"><canvas width="512" height="512" aria-hidden="true"></canvas></button><div class="companion-message"><p id="companion-text" role="status" aria-live="polite"></p><button id="companion-continue" hidden>继续 →</button></div>';
  stage.append(this.node);this.text=this.node.querySelector('p');this.next=this.node.querySelector('#companion-continue');
  this.sprite=this.node.querySelector('canvas');
  this.context=this.sprite.getContext('2d');
  this.atlas=new Image();
  this.atlas.onload=()=>this.paint();
  this.atlas.src='assets/journey/companion-pink-poses.png';
  this.node.querySelector('#companion-help').onclick=()=>{
   this.react('guide');
   this.onHelp?.();
  };
  window.addEventListener('pagehide',()=>this.stopVoice());
  new ResizeObserver(()=>{stage.style.setProperty('--guide-height',this.node.getBoundingClientRect().height+'px');}).observe(this.node);
 }
 paint(){
  if(!this.atlas.naturalWidth)return;
  const pose=poses[this.node.dataset.pose]??poses.idle;
  const width=this.atlas.naturalWidth/3,height=this.atlas.naturalHeight/2;
  this.context.clearRect(0,0,512,512);
  const scale=512/Math.max(width,height);
  this.context.drawImage(this.atlas,(pose%3)*width,Math.floor(pose/3)*height,width,height,
   (512-width*scale)/2,(512-height*scale)/2,width*scale,height*scale);
 }
 react(pose){
  clearTimeout(this.idleTimer);
  delete this.node.dataset.pose;
  void this.sprite.offsetWidth;
  this.node.dataset.pose=pose;
  this.paint();
  this.idleTimer=setTimeout(()=>{
   this.node.dataset.pose='idle';
   this.paint();
  },pose==='praise'?2400:1800);
 }
 unlock(){
  this.node.hidden=false;
  this.react('greet');
  try{
   const AudioContext=window.AudioContext||window.webkitAudioContext;
   if(AudioContext){
    this.audio??=new AudioContext();
    this.audio.resume().catch(()=>{});
   }
  }catch{}
 }
 playCelebration(){
  if(this.audio?.state!=='running')return 0;
  const start=this.audio.currentTime;
  for(const [index,frequency] of [523.25,659.25,783.99,1046.5].entries()){
   const at=start+index*.075;
   const note=this.audio.createOscillator();
   const envelope=this.audio.createGain();
   note.type='sine';
   note.frequency.value=frequency;
   envelope.gain.setValueAtTime(.0001,at);
   envelope.gain.exponentialRampToValueAtTime(.085,at+.013);
   envelope.gain.exponentialRampToValueAtTime(.0001,at+.19);
   note.connect(envelope).connect(this.audio.destination);
   note.start(at);
   note.stop(at+.2);
  }
  return .45;
 }
 stopVoice(){
  const voice=this.voice;
  this.voice=null;
  this.pending.length=0;
  clearTimeout(voice?.timer);
  voice?.request.abort();
  voice?.source?.stop();
 }
 async playVoice(text,delay=0,opening=false){
  const file=voiceLines.get(text.replace(/\s+/g,' ').trim());
  const voice={request:new AbortController(),opening};
  this.voice=voice;
  const done=()=>{
   if(this.voice!==voice)return;
   clearTimeout(voice.timer);
   this.voice=null;
   const next=this.pending.shift();
   if(next)this.showLine(...next);
  };
  const allowReading=()=>{
   if(this.voice===voice)voice.timer=setTimeout(done,Math.max(1800,[...text].length*170));
  };
  if(!file||!this.audio){allowReading();return;}
  const earliestStart=this.audio.currentTime+delay;
  voice.timer=setTimeout(()=>{
   voice.request.abort();
   done();
  },8000);
  try{
   const url=new URL('./assets/audio/xiaoya/'+file,import.meta.url);
   url.searchParams.set('v','review');
   const response=await fetch(url,{signal:voice.request.signal});
   if(!response.ok)throw new Error('Voice clip unavailable');
   const buffer=await this.audio.decodeAudioData(await response.arrayBuffer());
   if(this.voice!==voice)return;
   if(this.audio.state!=='running'){clearTimeout(voice.timer);allowReading();return;}
   const source=this.audio.createBufferSource();
   source.buffer=buffer;
   source.connect(this.audio.destination);
   source.onended=done;
   source.start(earliestStart);
   voice.source=source;
   clearTimeout(voice.timer);
  }catch{clearTimeout(voice.timer);allowReading();}
 }
 say(text,kind='hint',options={}){
  if(!text)return;
  if(options.immediate&&!this.voice?.opening&&!this.pending.some(([, , line])=>line.opening))this.stopVoice();
  else if(this.voice){
   this.pending.push([text,kind,options]);
   return;
  }
  this.showLine(text,kind,options);
 }
 showLine(text,kind,{action=null,label='继续 →',onShow,celebrate=false,opening=false}){
  if(onShow?.()===false){
   const next=this.pending.shift();
   if(next)this.showLine(...next);
   return;
  }
  this.node.hidden=false;this.last=text;this.text.textContent=text;this.node.dataset.kind=kind;this.next.hidden=!action;this.next.textContent=label;this.next.onclick=()=>{this.next.hidden=true;this.stopVoice();action?.();};
  this.playVoice(text,celebrate?this.playCelebration():0,opening);
  this.react(reactions[kind]||'guide');
  this.node.classList.remove('arriving');void this.node.offsetWidth;this.node.classList.add('arriving');
 }
}
