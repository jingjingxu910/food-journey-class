import {discussionQuestions} from './discussion-content.js';

export const forumTopics = [
  {
    id:'breathing', title:'研讨二 · 消化与呼吸', question:discussionQuestions[1].question,
    prompt:'先写下你们的推测，再说说哪条课堂发现或生活经验支持它。'
  },
  {
    id:'movement', title:'研讨三 · 跳绳时的器官合作', question:discussionQuestions[2].question,
    prompt:'试着用“我发现……，我推测……也在工作，因为……”说清楚你们的想法。'
  },
  {
    id:'homework', title:'课后作业 · 我们可以怎样保护它？',
    question:'查阅资料，选择一种与呼吸或消化器官有关的常见疾病，记录疾病名称、一条预防方法和信息来源。',
    prompt:'读一读其他组的资料帖，交流“我们可以怎样保护它”。信息来源可以写书名和页码，或网页标题和网址。',
    fields:[
      {name:'disease', label:'疾病名称', max:60},
      {name:'prevention', label:'一条预防方法', max:280},
      {name:'source', label:'信息来源', max:400}
    ]
  }
];

export function forumLink(text, {resetId, teacher=false}={}) {
  const link = document.createElement('a');
  const params = new URLSearchParams();
  if (resetId !== undefined) params.set('round', resetId || '');
  if (teacher) {
    params.set('mode', 'teacher');
    link.target = '_blank';
    link.rel = 'noopener';
  }
  link.href = 'forum.html?' + params;
  link.textContent = text;
  link.className = 'ev-button primary forum-link';
  return link;
}

export function forumSlide(resetId) {
  const title = document.createElement('h1');
  title.textContent = '课后论坛';
  title.tabIndex = -1;
  const intro = document.createElement('p');
  intro.className = 'forum-slide-intro';
  intro.textContent = '课堂上来不及讨论的题，课后继续。各小组先发帖，再选一组追问或补充。';
  const topics = document.createElement('ul');
  topics.className = 'forum-slide-topics';
  for (const topic of forumTopics) {
    const item = document.createElement('li');
    const heading = document.createElement('strong');
    heading.textContent = topic.title;
    item.append(heading, topic.question);
    topics.append(item);
  }
  const actions = document.createElement('div');
  actions.className = 'lesson-slide-actions';
  actions.append(forumLink('查看各组发帖与回复 ↗', {resetId, teacher:true}));
  return [title, intro, topics, actions];
}
