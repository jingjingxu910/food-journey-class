const steps = {
  v1: [
    ['#organ-palette', '把器官拖进去', '按住一个器官，拖到人体图上你认为合适的位置。'],
    ['#structure-button', '补画缺少的结构', '点「补画结构」，用橙色在人体图上画。'],
    ['#clear-structure-button', '橙色画错了怎么办', '点「清除橙色补画」重新画。误清后可点「撤销上一步」。'],
    ['#draw-route-button', '画食物的路线', '点「画食物路线」，用绿色画出食物经过的路线。'],
    ['#submit-model-button', '提交本组想法', '和组员看一遍器官位置和路线，再提交。'],
  ],
  v2: [
    ['#organ-palette', '用观察到的证据修改', '回想刚才的观察。把需要移动的器官拖到新位置。'],
    ['#draw-route-button', '重新画食物路线', '点「画食物路线」，用绿色画出食物经过的器官。'],
    ['#submit-model-button', '提交修正模型', '和组员说说改了哪儿、为什么改，再提交。'],
  ],
  observation: [
    ['#start-camera', '开启后置相机', '一位同学站到镜头前，另一位同学拿稳平板，点「开启后置相机」。'],
    ['#camera-framing p | #camera-placeholder p | #camera-stage', '对准画面里的虚框', '请同学正对镜头，让脸、双肩和裤腰两侧都在画面里。器官出现后，点一个器官观察。'],
    ['#finish-observation', '提交观察发现', '观察结束后，点这里把本组的发现提交给老师。'],
  ],
  assembly: [
    ['#photo-frame', '对照 V2 拼装', '看本组提交的 V2，找准器官的位置和连接，动手拼起来。'],
    ['#open-camera', '拍下拼装作品', '拼好后点「开启相机」，对准作品再点「拍照」。'],
    ['#submit-assembly', '提交照片', '先确认照片拍清楚了，再点「把作品提交给老师」。'],
  ],
  evaluation: [
    ['.self-stars', '商量后点星星', '观察、合作、坚持各点一次。点第几颗，就给这一项点亮几颗星。'],
    ['.self-panel button[type="submit"]', '提交自评', '三项都选好后，点「把星星提交给老师」。'],
  ],
  forum: [
    ['#topics', '选一个话题', '点上方的话题按钮，先看清楚要讨论的问题。'],
    ['#show-hint', '需要时点一下角色', '轻点角色可以听一条提示。挡住内容时，可以按住它拖到另一边。'],
    ['#composer button[type="submit"] | #composer', '发帖分享', '写下本组的想法，点「发布帖子」。'],
    ['.thread-actions | #board-title', '看看其他组怎么想', '读到有启发的帖子可以点赞，也可以点「评论」，写下你的问题或补充。'],
  ],
};

const pages = {
  'observation.html':'observation',
  'assembly.html':'assembly',
  'forum.html':'forum',
};

export function installStudentGuide(frame, url) {
  const params=url.searchParams;
  if(params.get('mode')==='teacher'||params.get('review')==='1'||params.get('preview')==='1'||params.get('observe')==='1')return;
  const page=url.pathname.split('/').pop();
  const doc=frame.contentDocument, view=frame.contentWindow;
  if(!doc?.body||typeof view.HTMLDialogElement?.prototype.showModal!=='function')return;
  let stage=pages[page];
  if(page==='model-workbench.html')stage=params.get('phase')==='v2'?'v2':'v1';
  if(page==='evaluation.html')stage='evaluation';
  if(!stage)return;

  const stylesheet=doc.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=new URL('./student-guide.css?v=anchored-guide',import.meta.url).href;
  stylesheet.onload=()=>mount();
  doc.head.append(stylesheet);

  function mount(){
    if(frame.contentDocument!==doc)return;
    const replay=doc.createElement('button');
    replay.type='button';
    replay.className='student-guide-replay';
    replay.textContent='操作指引';
    doc.querySelector('.home-actions, .header-actions, .model-topbar, .flow-topbar, .ev-heading, main > header, body > header')?.append(replay);

    const dialog=doc.createElement('dialog');
    dialog.className='student-guide';
    dialog.setAttribute('aria-labelledby','student-guide-title');
    dialog.innerHTML=`<div class="student-guide-spotlight" hidden></div>
      <section class="student-guide-card">
        <p class="student-guide-count"></p><h2 id="student-guide-title"></h2><p class="student-guide-text"></p>
        <div class="student-guide-actions">
          <button type="button" data-guide-skip>跳过</button>
          <button type="button" data-guide-back>上一步</button>
          <button type="button" data-guide-next>下一步</button>
        </div>
      </section>`;
    doc.body.append(dialog);
    const spot=dialog.querySelector('.student-guide-spotlight');
    const card=dialog.querySelector('.student-guide-card');
    const next=dialog.querySelector('[data-guide-next]');
    const back=dialog.querySelector('[data-guide-back]');
    let index=0, target;
    const seenKey='food-lesson-guide-v2:'+(params.get('group')||'1')+':'+stage;
    const currentRound=()=>view.localStorage.getItem('lesson-known-round')||'null';
    function hasSeen(){
      try{return view.localStorage.getItem(seenKey)===currentRound();}catch{return false;}
    }
    function close(){
      try{view.localStorage.setItem(seenKey,currentRound());}catch{}
      dialog.close();
    }
    function position(){
      if(!dialog.open)return;
      const rect=target?.getBoundingClientRect();
      card.style.maxHeight='';
      const width=view.innerWidth, height=view.innerHeight;
      if(!rect?.width||!rect.height||rect.bottom<=0||rect.top>=height||rect.right<=0||rect.left>=width){
        spot.hidden=true;
        card.style.left=(width-card.offsetWidth)/2+'px';
        card.style.top=Math.max(8,height-card.offsetHeight-12)+'px';
        return;
      }
      const left=Math.max(4,rect.left-5),top=Math.max(4,rect.top-5);
      const right=Math.min(view.innerWidth-4,rect.right+5),bottom=Math.min(view.innerHeight-4,rect.bottom+5);
      spot.hidden=right<=left||bottom<=top;
      spot.style.left=left+'px';
      spot.style.top=top+'px';
      spot.style.width=Math.max(0,right-left)+'px';
      spot.style.height=Math.max(0,bottom-top)+'px';
      const gap=10, margin=8, cardWidth=card.offsetWidth, cardHeight=card.offsetHeight;
      const clamp=(value,max)=>Math.max(margin,Math.min(value,max-margin));
      const centerX=clamp((left+right-cardWidth)/2,width-cardWidth);
      const centerY=clamp((top+bottom-cardHeight)/2,height-cardHeight);
      const above=top-gap-margin, below=height-bottom-gap-margin;
      let x=centerX, y=bottom+gap;
      if(below<cardHeight){
        if(above>=cardHeight)y=top-gap-cardHeight;
        else if(width-right-gap-margin>=cardWidth){x=right+gap;y=centerY;}
        else if(left-gap-margin>=cardWidth){x=left-gap-cardWidth;y=centerY;}
        else{
          const room=Math.max(above,below);
          if(room>=100)card.style.maxHeight=room+'px';
          y=above>below?Math.max(margin,top-gap-card.offsetHeight):clamp(bottom+gap,height-card.offsetHeight);
        }
      }
      card.style.left=x+'px';
      card.style.top=y+'px';
    }
    function render(){
      const list=steps[stage];
      const [selector,title,message]=list[index];
      target=selector.split(' | ').flatMap(part=>[...doc.querySelectorAll(part)])
        .find(node=>node.getClientRects().length>0);
      const bounds=target?.getBoundingClientRect();
      if(bounds&&(bounds.top<8||bounds.bottom>view.innerHeight-8)){
        target.scrollIntoView({block:'center',inline:'nearest'});
      }
      dialog.querySelector('.student-guide-count').textContent=(index+1)+' / '+list.length;
      dialog.querySelector('h2').textContent=title;
      dialog.querySelector('.student-guide-text').textContent=message;
      back.hidden=index===0;
      next.textContent=index===list.length-1?'我明白了':'下一步';
      position();
      view.requestAnimationFrame(position);
      next.focus({preventScroll:true});
    }
    function open(){
      index=0;
      if(!dialog.open)dialog.showModal();
      render();
    }
    replay.onclick=open;
    next.onclick=()=>{if(index===steps[stage].length-1)close();else{index++;render();}};
    back.onclick=()=>{index--;render();};
    dialog.querySelector('[data-guide-skip]').onclick=close;
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    view.addEventListener('resize',position);
    doc.addEventListener('scroll',position,true);

    if(page==='evaluation.html'){
      function showEvaluationGuide(activity){
        replay.hidden=activity!=='evaluation';
        if(replay.hidden&&dialog.open)dialog.close();
        if(activity==='evaluation'&&!hasSeen()&&!dialog.open)open();
      }
      replay.hidden=true;
      view.addEventListener('class-command',event=>showEvaluationGuide(event.detail?.phase));
      showEvaluationGuide(params.get('activity'));
    }else if(!hasSeen()){
      const medal=doc.querySelector('#award-unlock[open]');
      if(medal)medal.addEventListener('close',open,{once:true});
      else open();
    }
  }
}
