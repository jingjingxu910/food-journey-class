const steps = {
  home: [
    ['.hero h1', '等老师开任务', '老师开启活动后，页面会带你进入任务。'],
    ['.section-heading', '回看做过的任务', '做完的任务会留在首页。点「已完成 · 查看」，就能回看。'],
  ],
  v1: [
    ['#organ-palette', '把器官拖进去', '按住一个器官，拖到人体图上你认为合适的位置。'],
    ['#structure-button', '补画缺少的结构', '点「补画结构」，用橙色在人体图上画。画错了可撤销，也可点「清除橙色补画」。'],
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
    ['#camera-stage', '点一个器官观察', '相机画面上出现器官后，点一个器官。进入三维观察时，可以用手指转一转。'],
    ['#finish-observation', '提交观察发现', '观察结束后，点这里把本组的发现提交给老师。'],
  ],
  assembly: [
    ['#photo-frame', '对照 V2 拼装', '看本组提交的 V2，找准器官的位置和连接，动手拼起来。'],
    ['#open-camera', '拍下拼装作品', '拼好后点「开启相机」，对准作品再点「拍照」。'],
    ['#submit-assembly', '提交照片', '先确认照片拍清楚了，再点「把作品提交给老师」。'],
  ],
  journey: [
    ['#start', '开始旅行', '点「开始旅行」。出现张开的嘴巴后，点嘴巴进去。'],
    ['#intro .intro-card', '按画面提示动手', '小伙伴会告诉你可以试什么。比如在口腔里，点牙齿可以咀嚼饼干。'],
    ['#intro .intro-card', '到终点后提交', '看到「前进」就可以试着往下走。完成旅行后，记得点「提交发现」。'],
  ],
  discussion: [
    ['#question', '和组员一起想', '先读屏幕上的问题，再用刚才看到的现象或模型，说说你们的想法。'],
  ],
  evaluation: [
    ['.self-stars', '商量后点星星', '观察、合作、坚持各点一次。点第几颗，就给这一项点亮几颗星。'],
    ['.self-panel button[type="submit"]', '提交自评', '三项都选好后，点「把星星提交给老师」。'],
  ],
  awards: [
    ['.ev-award', '看看本组的奖状', '读一读本组的闪光时刻，和组员说说哪件事给你留下了印象。'],
  ],
  forum: [
    ['#topics', '选一个话题', '点上方的话题按钮，先看清楚要讨论的问题。'],
    ['#show-hint', '需要时点一下角色', '轻点角色可以听一条提示。挡住内容时，可以按住它拖到另一边。'],
    ['#composer', '发帖分享', '写下本组的想法，点「发布帖子」。'],
    ['.thread-actions, #board-title', '看看其他组怎么想', '读到有启发的帖子可以点赞，也可以点「评论」，写下你的问题或补充。'],
  ],
};

const pages = {
  'index.html':'home',
  'observation.html':'observation',
  'assembly.html':'assembly',
  'journey-game.html':'journey',
  'discussion.html':'discussion',
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
  if(page==='evaluation.html')stage=params.get('activity')==='awards'?'awards':'evaluation';
  if(!stage)return;

  const stylesheet=doc.createElement('link');
  stylesheet.rel='stylesheet';
  stylesheet.href=new URL('./student-guide.css?v=student-walkthrough',import.meta.url).href;
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
    const next=dialog.querySelector('[data-guide-next]');
    const back=dialog.querySelector('[data-guide-back]');
    let index=0, target;
    const seenKey=()=> 'food-lesson-guide-v1:'+stage;
    function hasSeen(){
      try{return view.localStorage.getItem(seenKey())==='1';}catch{return false;}
    }
    function close(){
      try{view.localStorage.setItem(seenKey(),'1');}catch{}
      dialog.close();
    }
    function position(){
      if(!dialog.open)return;
      const rect=target?.getBoundingClientRect();
      if(!rect?.width||!rect.height){spot.hidden=true;dialog.dataset.panel='bottom';return;}
      const left=Math.max(4,rect.left-5),top=Math.max(4,rect.top-5);
      const right=Math.min(view.innerWidth-4,rect.right+5),bottom=Math.min(view.innerHeight-4,rect.bottom+5);
      spot.hidden=right<=left||bottom<=top;
      dialog.dataset.panel=top>view.innerHeight-bottom?'top':'bottom';
      spot.style.left=left+'px';
      spot.style.top=top+'px';
      spot.style.width=Math.max(0,right-left)+'px';
      spot.style.height=Math.max(0,bottom-top)+'px';
    }
    function render(){
      const list=steps[stage];
      const [selector,title,message]=list[index];
      target=[...doc.querySelectorAll(selector)].find(node=>node.getClientRects().length>0);
      target?.scrollIntoView({block:'center',inline:'nearest'});
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
      view.addEventListener('class-command',event=>{
        const activity=event.detail?.phase;
        if(!['evaluation','awards'].includes(activity)||stage===activity)return;
        if(dialog.open)dialog.close();
        stage=activity;
        if(!hasSeen())open();
      });
    }
    if(!hasSeen())open();
  }
}
