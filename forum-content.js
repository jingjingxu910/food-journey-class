import {discussionQuestions} from './discussion-content.js';

export const forumTopics = [
  {
    id:'breathing', title:'研讨二 · 消化与呼吸', question:discussionQuestions[1].question,
    hints:[
      '回想食物旅行到小肠时发生了什么。食物里的营养是怎么到达身体其他地方的？',
      '比一比：吃完饭和刚跑完步时，你的呼吸有什么不同？身体这时在忙什么？',
      '腿在运动时，消化得到的营养和呼吸带进来的氧气，可能怎样一起帮上忙？'
    ]
  },
  {
    id:'movement', title:'研讨三 · 跳绳时的器官合作', question:discussionQuestions[2].question,
    hints:[
      '比一比跳绳前和刚停下时的呼吸。哪一次更快？空气从鼻或口进入后，会经过哪些器官？',
      '跳绳时腿一直在用力。回想食物在身体里的旅行，食物在哪里被消化，营养又主要在哪里被吸收？',
      '跳绳时，腿需要营养和氧气。想一想，消化系统和呼吸系统分别帮了什么忙？'
    ]
  },
  {
    id:'homework', title:'资料探究 · 我们可以怎样保护它？',
    question:'查阅资料，选择一种与呼吸或消化器官有关的常见疾病，记录疾病名称、一条预防方法和信息来源。',
    hints:[
      '想想吃饭或呼吸时，身体的哪些地方和外界接触？你对其中哪个器官最想多了解一点？',
      '找到一条预防方法后，想想它保护的是哪个器官。它可能是怎么保护这个器官的？',
      '看看其他组查到的方法。哪一条和你的日常生活最有关？你能从哪件小事做起？'
    ],
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
  title.textContent = '小论坛';
  title.tabIndex = -1;
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
  return [title, topics, actions];
}
