import {cloudDb,readOptionalDocument,groupId} from './student-data.js?v=20261116-tablet-fixes';

function gather(peer){
 if(peer.iceGatheringState==='complete')return Promise.resolve();
 return new Promise(resolve=>{
  const finish=()=>{
   clearTimeout(timer);
   peer.removeEventListener('icegatheringstatechange',changed);
   resolve();
  };
  const changed=()=>{if(peer.iceGatheringState==='complete')finish();};
  const timer=setTimeout(finish,3500);
  peer.addEventListener('icegatheringstatechange',changed);
 });
}

export function connectClassCamera({token,id=groupId,video,stream,signal,onStatus=()=>{},onClose=()=>{}}){
 // A same-LAN peer connection carries the video directly. The database carries SDP only.
 const peer=new RTCPeerConnection();
 let localRef;
 const close=()=>{
  if(peer.signalingState==='closed')return;
  peer.close();
  if(video)video.srcObject=null;
  void Promise.resolve(localRef?.remove()).catch(()=>{});
  onClose();
 };
 signal.addEventListener('abort',close,{once:true});
 peer.onconnectionstatechange=()=>{
  if(peer.connectionState==='connected')onStatus('');
  if(peer.connectionState==='failed'){onStatus('无法直连学生平板');close();}
 };
 async function negotiate(){
  const db=await cloudDb();
  if(signal.aborted)return;
  const collection=db.collection('food-journey-groups');
  const offer=collection.doc('camera-offer-'+id+'-'+token);
  const answer=collection.doc('camera-answer-'+id+'-'+token);
  localRef=video?offer:answer;
  async function write(description){
   await gather(peer);
   if(signal.aborted)return;
   const {type,sdp}=peer.localDescription;
   const result=await localRef.set({kind:'lesson-camera-signal',type,sdp,expiresAt:Date.now()+30000});
   if(result?.code)throw Error(result.message);
   if(signal.aborted)await localRef.remove();
  }
  async function read(ref,type){
   for(let i=0;i<18&&!signal.aborted;i++){
    const result=await readOptionalDocument(ref);
    const data=Array.isArray(result.data)?result.data[0]:result.data;
    if(data?.type===type&&data.expiresAt>Date.now())return {type,sdp:data.sdp};
    await new Promise(resolve=>setTimeout(resolve,1100));
   }
   if(!signal.aborted)throw Error('Camera connection timed out');
  }
  if(video){
   peer.ontrack=event=>{video.srcObject=event.streams[0];void video.play().catch(()=>{});};
   peer.addTransceiver('video',{direction:'recvonly'});
   await peer.setLocalDescription(await peer.createOffer());
   await write();
   const description=await read(answer,'answer');
   if(description&&!signal.aborted)await peer.setRemoteDescription(description);
  }else{
   const description=await read(offer,'offer');
   if(!description||signal.aborted)return;
   await peer.setRemoteDescription(description);
   for(const track of stream.getVideoTracks())peer.addTrack(track,stream);
   await peer.setLocalDescription(await peer.createAnswer());
   await write();
  }
 }
 negotiate().catch(()=>{if(!signal.aborted){onStatus('暂未连上学生相机');close();}});
 return close;
}
