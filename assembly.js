import { groupId, currentRecord, saveRecord, submitRecord, homeUrl } from './student-data.js';
const $=(selector)=>document.querySelector(selector);
$('#group-label').textContent=`第 ${groupId} 组`;
$('#back-link').href=homeUrl();
$('#journey-link').href=`journey.html?group=${groupId}`;
$('.flow-fullscreen').onclick=()=>window.requestLessonFullscreen?.();
let record,stream;
const video=$('#assembly-camera');
function closeCamera(){
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;
  video.srcObject=null;
  video.hidden=true;
  $('#open-camera').hidden=false;
  $('#take-photo').hidden=true;
  $('#close-camera').hidden=true;
}
async function openCamera(){
  const button=$('#open-camera');
  button.disabled=true;
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error();
    const camera=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}}});
    if(document.hidden){camera.getTracks().forEach(track=>track.stop());return;}
    stream=camera;
    video.srcObject=stream;
    await video.play();
    if(stream!==camera)return;
    video.hidden=false;
    button.hidden=true;
    $('#take-photo').hidden=false;
    $('#close-camera').hidden=false;
    $('#assembly-status').textContent='对准作品后，点击拍照。';
  }catch{
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
function showPhoto(data) {
  $('#photo-preview').src=data;
  $('#photo-preview').hidden=false;
  $('#photo-frame').querySelector('span').hidden=true;
}
async function savePhoto(file) {
  if(!file||!record)return;
  if(!file.type.startsWith('image/')) { $('#assembly-status').textContent='请选择照片。';return; }
  try {
    $('#assembly-status').textContent='正在处理照片…';
    const local=await photoData(file,1280,.72);
    const preview=await photoData(file,500,.55);
    record.assembly ||= { startedAt:Date.now(), completedAt:null };
    record.assembly.photoLocal=local;
    record.assembly.photoPreview=preview;
    record.assembly.photoTakenAt=Date.now();
    showPhoto(local);
    await saveRecord(record);
    $('#assembly-status').textContent='照片已保存在本机。';
  } catch(error) { $('#assembly-status').textContent=error.message; }
}
async function submit() {
  record.assembly ||= { startedAt:Date.now(),completedAt:null };
  if(!record.assembly.photoLocal && !record.assembly.photoPreview) { $('#assembly-status').textContent='先拍下拼装结果。';return; }
  const button=$('#submit-assembly');button.disabled=true;
  record.assembly.note=$('#assembly-note').value.trim();
  record.assembly.completedAt=Date.now();
  $('#assembly-status').textContent='正在提交…';
  const uploaded=await submitRecord(record);
  $('#assembly-status').textContent=uploaded?'拼装记录已提交。':'已保存在本机，暂未传给老师。';
  $('#journey-link').hidden=false;
  button.disabled=false;
}
async function initialize() {
  record=await currentRecord();
  if(record.assembly?.photoLocal||record.assembly?.photoPreview) showPhoto(record.assembly.photoLocal||record.assembly.photoPreview);
  $('#assembly-note').value=record.assembly?.note||'';
  if(record.assembly?.completedAt) $('#journey-link').hidden=false;
  $('#open-camera').disabled=false;
}
$('#photo-input').onchange=event=>{closeCamera();void savePhoto(event.target.files?.[0]);event.target.value='';};
$('#submit-assembly').onclick=submit;
$('#assembly-note').oninput=()=>{if(record){record.assembly||={startedAt:Date.now(),completedAt:null};record.assembly.note=$('#assembly-note').value.slice(0,160);void saveRecord(record);}};
initialize().catch((error)=>$('#assembly-status').textContent=`记录无法读取：${error.message}`);
