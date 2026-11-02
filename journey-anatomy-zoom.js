const pending=new WeakMap();
export function cancelAnatomyView(dialog){const p=pending.get(dialog);if(p)clearTimeout(p.timer);pending.delete(dialog);}
export function showAnatomyView(dialog,{point,reveal=false,src,onReveal}){
 cancelAnatomyView(dialog);const pic=dialog.querySelector('.anatomy-picture'),svg=dialog.querySelector('#body-diagram'),detail=dialog.querySelector('#organ-detail');pic.classList.remove('zoom');svg.style.transition='none';detail.style.transition='none';detail.hidden=!reveal;if(src)detail.src=src;dialog.showModal();
 const b=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,s=Math.min(b.width/v.width,b.height/v.height);pic.style.setProperty('--organ-focus',`${((b.width-v.width*s)/2+point[0]*s)/b.width*100}% ${((b.height-v.height*s)/2+point[1]*s)/b.height*100}%`);void pic.offsetWidth;svg.style.transition='';detail.style.transition='';
 if(!reveal)return;const ticket={timer:0};pending.set(dialog,ticket);ticket.timer=setTimeout(async()=>{try{await detail.decode();}catch{}if(pending.get(dialog)!==ticket||!dialog.open)return;pic.classList.add('zoom');onReveal?.();},1250);
}
