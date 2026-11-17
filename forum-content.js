import {discussionQuestions} from './discussion-content.js';

export const forumTopics = [
  {
    id:'breathing', title:'研讨二 · 消化与呼吸', question:discussionQuestions[1].question,
    hints:[
      '吃饭和吸气都可能用到嘴。过了咽部，食物和空气还走同一条路吗？试着用手指比画两条路线。',
      '小肠吸收的营养和肺获得的氧气，都能到达离它们很远的腿。你猜身体靠什么把它们送过去？',
      '如果把腿想成一位正在工作的队员，消化和呼吸分别给它送去了什么？只送到其中一样，够它一直工作吗？'
    ]
  },
  {
    id:'movement', title:'研讨三 · 跳绳时的器官合作', question:discussionQuestions[2].question,
    hints:[
      '同样跳半分钟，慢跳和快跳之后，你猜哪一次呼吸更急？从什么现象可以判断？',
      '跳绳时嘴里没有食物，腿却能一直用力。它用到的营养可能来自什么时候吃的食物？那些营养是在哪里被吸收的？',
      '刚停下时，腿已经不跳了，呼吸为什么还可能很快？你猜身体还在忙什么？'
    ]
  },
  {
    id:'homework', title:'资料探究 · 我们可以怎样保护它？',
    question:'查阅资料，选择一种与呼吸或消化器官有关的常见疾病，记录疾病名称、一条预防方法和信息来源。',
    hints:[
      '看一看课上的器官图。吃进去的东西和吸进去的空气各会经过哪里？你想查哪一站容易遇到什么问题？',
      '你找到的预防方法，做了以后会改变什么？回到资料里找找有没有解释，这个改变为什么能保护器官。',
      '如果两个来源给的建议不一样，你会先看谁发布的，还是看它有没有解释原因？你会怎样核对？'
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
