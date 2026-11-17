import { groupId, currentRecord, saveRecord, submitRecord, homeUrl, isPhotoPreview } from './student-data.js?v=20261116-tablet-fixes';
import { readDocument } from './evaluation-data.js?v=award-journey-evidence';
import { miniModel } from './model-preview.js';
const $=(selector)=>document.querySelector(selector);
$('#group-label').textContent=`第 ${groupId} 组`;
$('#back-link').href=homeUrl();
$('.flow-fullscreen').onclick=()=>window.requestLessonFullscreen?.();
let record,stream;
let cameraRequest=0, showingPhoto=false;
const video=$('#assembly-camera');
const reference=$('#assembly-model');
const photo=$('#photo-preview');
const previewButton=$('#toggle-preview');

function renderFrame(){
  const cameraOpen=Boolean(stream);
  const hasPhoto=photo.hasAttribute('src');
  reference.hidden=cameraOpen||showingPhoto;
  video.hidden=!cameraOpen;
  photo.hidden=cameraOpen||!showingPhoto;
  $('#open-camera').hidden=cameraOpen;
  $('#open-camera').textContent=showingPhoto?'重新拍摄':'开启相机';
  $('#take-photo').hidden=!cameraOpen;
  $('#close-camera').hidden=!cameraOpen;
  previewButton.hidden=cameraOpen||!hasPhoto;
  previewButton.textContent=showingPhoto?'返回 V2 参考':'查看拼装照片';
}

function closeCamera(){
  cameraRequest++;
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;
  video.srcObject=null;
  if($('#assembly-status').textContent==='对准作品后，点击拍照。')$('#assembly-status').textContent='';
  renderFrame();
}
async function openCamera(){
  const button=$('#open-camera');
  const request=++cameraRequest;
  button.disabled=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error();
    const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:960},height:{ideal:720}}});
    if(document.hidden||request!==cameraRequest){camera.getTracks().forEach(track=>track.stop());return;}
    stream=camera;
    video.srcObject=stream;
    video.muted=true;
    video.playsInline=true;
    renderFrame();
    await video.play();
    if(stream!==camera)return;
    $('#assembly-status').textContent='对准作品后，点击拍照。';
  }catch{
    if(request!==cameraRequest)return;
    closeCamera();
    $('#assembly-status').textContent='相机无法开启，可以选择已拍好的照片。';
  }finally{button.disabled=false;}
}
function takePhoto(){
  if(!video.videoWidth||!video.videoHeight)return;
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.round(video.videoWidth*scale);
  canvas.height=Math.round(video.videoHeight*scale);
  canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
  closeCamera();
  canvas.toBlob(file=>{if(file)void savePhoto(file);},'image/jpeg',.9);
}
$('#open-camera').onclick=openCamera;
$('#take-photo').onclick=takePhoto;
$('#close-camera').onclick=closeCamera;
previewButton.onclick=()=>{showingPhoto=!showingPhoto;renderFrame();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCamera();});
window.addEventListener('pagehide',closeCamera);

function photoData(file, maxSide, quality) {
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片无法读取'));};
    img.src=url;
  });
}
async function savePhoto(file) {
  const button=$('#submit-assembly');
  if(!file||!record||button.disabled)return;
  if(!file.type.startsWith('image/')) { $('#assembly-status').textContent='请选择照片。';return; }
  button.disabled=true;
  try {
    $('#assembly-status').textContent='正在处理照片…';
    const local=await photoData(file,1280,.72);
    let preview=await photoData(file,500,.55);
    if(!isPhotoPreview(preview)) preview=await photoData(file,320,.45);
    if(!isPhotoPreview(preview)) throw new Error('照片无法压缩，请重新拍摄。');
    record.assembly ||= { startedAt:Date.now(), completedAt:null };
    record.assembly.completedAt=null;
    record.assembly.photoLocal=local;
    record.assembly.photoPreview=preview;
    record.assembly.photoTakenAt=Date.now();
    photo.src=local;
    showingPhoto=true;
    renderFrame();
    await saveRecord(record);
    $('#assembly-status').textContent='照片已保存在本机。';
  } catch(error) { $('#assembly-status').textContent=error.message; }
  finally { button.disabled=false; }
}
async function submit() {
  if(!record||$('#submit-assembly').disabled)return;
  record.assembly ||= { startedAt:Date.now(),completedAt:null };
  if(!record.assembly.photoLocal && !record.assembly.photoPreview) { $('#assembly-status').textContent='先拍下拼装结果。';return; }
  const button=$('#submit-assembly');button.disabled=true;
  record.assembly.note=$('#assembly-note').value.trim();
  record.assembly.completedAt=Date.now();
  record.assembly.pendingSync=true;
  $('#assembly-status').textContent='正在提交…';
  try {
    if(!isPhotoPreview(record.assembly.photoPreview)) {
      const source=record.assembly.photoLocal||record.assembly.photoPreview;
      const file=await (await fetch(source)).blob();
      record.assembly.photoPreview=await photoData(file,320,.45);
      if(!isPhotoPreview(record.assembly.photoPreview)) throw new Error('照片无法压缩，请重新拍摄。');
    }
    const uploaded=await submitRecord(record);
    if(uploaded){record.assembly.pendingSync=false;await saveRecord(record);}
    $('#assembly-status').textContent=uploaded?'拼装记录已提交。':'已保存在本机，联网后请再次提交。';
  } catch(error) {
    $('#assembly-status').textContent=error.message||'暂时无法提交，请重试。';
  } finally {
    button.disabled=false;
  }
}
async function loadReference() {
  let model=record.v2?.completedAt?record.v2:null;
  try {
    if(!model){
      const group=await readDocument('group-'+groupId);
      model=(group.records||[])
        .filter(item=>Number(item.groupId)===groupId && (item.resetId||null)===(record.resetId||null) && item.v2?.completedAt)
        .sort((first,second)=>second.v2.completedAt-first.v2.completedAt)[0]?.v2;
    }
    if(model)reference.innerHTML=miniModel(model,'本组提交的 V2',{phase:'v2'});
    else reference.querySelector('p').textContent='本组还没有提交 V2。';
  } catch {
    reference.querySelector('p').textContent='暂时无法读取本组提交的 V2。';
  }
}

async function initialize() {
  record=await currentRecord();
  const savedPhoto=record.assembly?.photoLocal||record.assembly?.photoPreview;
  if(savedPhoto)photo.src=savedPhoto;
  $('#assembly-note').value=record.assembly?.note||'';
  $('#open-camera').disabled=false;
  renderFrame();
  void loadReference();
}
$('#photo-input').onchange=event=>{closeCamera();void savePhoto(event.target.files?.[0]);event.target.value='';};
$('#submit-assembly').onclick=submit;
$('#assembly-note').oninput=()=>{if(record){record.assembly||={startedAt:Date.now(),completedAt:null};record.assembly.note=$('#assembly-note').value.slice(0,160);void saveRecord(record);}};
initialize().catch((error)=>{
  reference.querySelector('p').textContent='暂时无法读取本组提交的 V2。';
  $('#assembly-status').textContent=`记录无法读取：${error.message}`;
});

window.prepareClassNavigation = async () => { if (!record || $('#submit-assembly').disabled) return false; await saveRecord(record); closeCamera(); };
