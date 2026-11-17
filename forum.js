import {cloudDb, groupId} from './student-data.js?v=20261116-tablet-fixes';
import {roundId} from './evaluation-data.js?v=award-journey-evidence';
import {forumTopics} from './forum-content.js?v=tap-hints';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const teacher = params.get('mode') === 'teacher';
const group = Math.trunc(groupId);
const groupName = id => '第 ' + id + ' 组';
const discussionFields = [{name:'message', label:'我们组的想法', max:600}];
const replyFields = [{name:'message', label:'我们组想说', placeholder:'我想补充…… / 我还想问……', max:400}];
const topicLabels = {
  breathing:['💨','消化与呼吸'],
  movement:['🪢','跳绳时'],
  homework:['🛡️','保护器官']
};
let collection, round, active;
let hintIndex = -1;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function forumKey(topic, parent=0) {
  return ['forum', encodeURIComponent(round || 'initial'), topic.id, parent].join('-');
}

async function readEntries(key, limit=12) {
  const result = await collection.where({forumKey:key}).limit(limit).get();
  if (result.code) throw new Error('暂时无法读取论坛。');
  return result.data
    .filter(entry => Number.isInteger(entry.groupId) && entry.groupId >= 1 && entry.groupId <= 12)
    .sort((a,b) => a.groupId - b.groupId);
}

async function saveEntry(key, values, like=false) {
  const result = await collection.doc(key + (like ? '-like-' : '-') + group).set({
    kind:like ? 'lesson-forum-like' : 'lesson-forum',
    forumKey:key, resetId:round, groupId:group, values, updatedAt:Date.now()
  });
  if (result.code || !(result.updated > 0 || result.upsertedId || result.id)) {
    throw new Error('暂时无法保存，请再试一次。');
  }
}

function composer(key, fields, publishText, saved, onSave) {
  const form = element('form');
  const controls = fields.map(field => {
    const label = element('label', field.label);
    const input = element('textarea');
    input.name = field.name;
    input.rows = fields.length === 1 ? 3 : 1;
    input.maxLength = field.max;
    if (field.placeholder) input.placeholder = field.placeholder;
    input.required = true;
    input.value = saved?.values?.[field.name] || '';
    input.oninput = () => input.setCustomValidity('');
    label.append(input);
    form.append(label);
    return input;
  });
  const submit = element('button', saved ? '保存修改' : publishText);
  submit.type = 'submit';
  const status = element('p', '', 'form-status');
  status.setAttribute('role','status');
  form.append(submit, status);
  form.onsubmit = async event => {
    event.preventDefault();
    const empty = controls.find(input => !input.value.trim());
    if (empty) {
      empty.setCustomValidity('请先填写这一项。');
      empty.reportValidity();
      return;
    }
    const values = Object.fromEntries(controls.map(input => [input.name, input.value.trim()]));
    submit.disabled = true;
    status.textContent = '正在保存…';
    try {
      await saveEntry(key, values);
      submit.textContent = '保存修改';
      status.textContent = '已发布';
      onSave();
    } catch {
      status.textContent = '暂时未能发布，填写的内容还在，可以重试。';
    } finally {
      submit.disabled = false;
    }
  };
  return form;
}

function thread(view, post) {
  const article = element('article', undefined, 'thread');
  const fields = view.topic.fields || discussionFields;
  article.append(element('h3', groupName(post.groupId)));
  for (const field of fields) {
    const value = post.values?.[field.name];
    if (typeof value !== 'string') continue;
    const line = element('p');
    if (view.topic.fields) line.append(element('strong', field.label + '　'));
    line.append(value);
    article.append(line);
  }
  const actions = element('div', undefined, 'thread-actions');
  const like = element(teacher ? 'span' : 'button', '♡ 点赞', teacher ? 'like-total' : 'like');
  const comment = element('button', '💬 评论', 'comment-toggle');
  const feedback = element('p', '', 'thread-status');
  const panel = element('div', undefined, 'comment-panel');
  panel.id = 'comments-' + view.topic.id + '-' + post.groupId;
  panel.hidden = true;
  comment.type = 'button';
  comment.setAttribute('aria-controls', panel.id);
  comment.setAttribute('aria-expanded','false');
  feedback.setAttribute('role','status');
  const replies = element('div', undefined, 'replies');
  const replyEditor = element('div');
  const key = forumKey(view.topic, post.groupId);
  let liked = false, likeCount = 0, savingLike = false, loaded = false, revision = 0;
  function drawLike() {
    like.textContent = (liked ? '♥ 已点赞' : '♡ 点赞') + (loaded ? ' ' + likeCount : '');
    if (!teacher) {
      like.disabled = !loaded || savingLike;
      like.setAttribute('aria-pressed', String(liked));
    }
  }
  async function update() {
    const request = ++revision;
    try {
      const entries = await readEntries(key, 24);
      if (request !== revision) return;
      const likes = entries.filter(entry => entry.kind === 'lesson-forum-like' && entry.values?.liked === true);
      const comments = entries.filter(entry => entry.kind !== 'lesson-forum-like' && typeof entry.values?.message === 'string');
      if (!savingLike) {
        liked = !teacher && likes.some(entry => entry.groupId === group);
        likeCount = likes.length;
      }
      loaded = true;
      drawLike();
      comment.textContent = '💬 评论 ' + comments.length;
      feedback.textContent = '';
      const messages = comments.map(entry => {
        const reply = element('div', undefined, 'reply');
        reply.append(element('strong', groupName(entry.groupId)), element('p', entry.values.message));
        return reply;
      });
      replies.replaceChildren(...(messages.length ? messages : [element('p','还没有评论。')]));
      if (!teacher && !panel.hidden && !replyEditor.firstChild) {
        replyEditor.append(composer(key, replyFields, '发布评论', comments.find(entry => entry.groupId === group), update));
      }
    } catch {
      if (request === revision) feedback.textContent = '暂时读不到点赞和评论，可以刷新重试。';
    }
  }
  if (!teacher) {
    like.type = 'button';
    like.onclick = async () => {
      if (savingLike || !loaded) return;
      savingLike = true;
      drawLike();
      try {
        await saveEntry(key, {liked:!liked}, true);
        liked = !liked;
        likeCount = Math.max(0, likeCount + (liked ? 1 : -1));
        void update();
      } catch {
        feedback.textContent = '点赞没有保存，请再点一次。';
      } finally {
        savingLike = false;
        drawLike();
      }
    };
  }
  drawLike();
  comment.onclick = () => {
    panel.hidden = !panel.hidden;
    comment.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) void update();
  };
  actions.append(like, comment);
  panel.append(replies, replyEditor);
  article.append(actions, feedback, panel);
  return {node:article, update};
}

async function refresh(view) {
  if (active !== view) return;
  const request = ++view.request;
  $('#refresh').disabled = true;
  $('#status').textContent = '正在读取帖子…';
  try {
    const key = forumKey(view.topic);
    const entries = await readEntries(key);
    if (active !== view || request !== view.request) return;
    const threads = $('#threads');
    // Keep open comments and drafts when an unchanged post is refreshed.
    const previous = view.threads;
    view.threads = new Map();
    const cards = entries.map(post => {
      const cached = previous.get(post.groupId);
      const signature = JSON.stringify(post.values);
      const card = cached?.signature === signature ? cached.card : thread(view, post);
      view.threads.set(post.groupId, {signature, card});
      void card.update();
      return card.node;
    });
    cards.forEach((card, index) => {
      if (threads.children[index] !== card) threads.insertBefore(card, threads.children[index] || null);
    });
    for (const child of Array.from(threads.children).slice(cards.length)) child.remove();
    if (!teacher && !view.editor) {
      view.editor = composer(key, view.topic.fields || discussionFields, '发布帖子',
        entries.find(entry => entry.groupId === group), () => void refresh(view));
      $('#composer').append(view.editor);
    }
    $('#status').textContent = entries.length ? '已有 ' + entries.length + ' 组发帖。' : '还没有帖子。';
  } catch {
    if (active === view && request === view.request) $('#status').textContent = '暂时无法读取论坛，请点击“刷新帖子”重试。';
  } finally {
    if (active === view && request === view.request) $('#refresh').disabled = false;
  }
}

const views = forumTopics.map(topic => ({topic, request:0, threads:new Map()}));
const tabs = views.map(view => {
  const [symbol, label] = topicLabels[view.topic.id];
  const tab = element('button', undefined, 'topic-tab');
  const icon = element('span', symbol, 'topic-icon');
  icon.setAttribute('aria-hidden','true');
  tab.dataset.topic = view.topic.id;
  tab.append(icon, element('span',label));
  tab.type = 'button';
  tab.onclick = () => select(view);
  return tab;
});

function select(view) {
  if (active === view) return;
  active = view;
  tabs.forEach((tab,index) => tab.setAttribute('aria-pressed', String(views[index] === view)));
  $('#topic-title').textContent = view.topic.title;
  $('#question').textContent = view.topic.question;
  hintIndex = -1;
  $('#prompt').textContent = '需要一点灵感？';
  $('#hint-label').textContent = '点我看提示';
  $('#show-hint').disabled = false;
  $('#composer').replaceChildren(...(view.editor ? [view.editor] : []));
  $('#threads').replaceChildren(...Array.from(view.threads.values(), entry => entry.card.node));
  void refresh(view);
}

async function connect() {
  $('#refresh').disabled = true;
  $('#status').textContent = '正在连接论坛…';
  try {
    const db = await cloudDb();
    round = params.has('round') ? params.get('round') || null : await roundId();
    collection = db.collection('food-journey-groups');
    $('#topics').replaceChildren(...tabs);
    select(views[0]);
  } catch {
    $('#status').textContent = '暂时无法连接论坛，请点击“刷新帖子”重试。';
    $('#refresh').disabled = false;
  }
}

$('#audience').textContent = teacher ? '教师查看' : groupName(group);
if (teacher) $('#instructions').textContent = '选择话题查看各组的帖子、点赞和评论。';
$('#fullscreen').onclick = () => window.requestLessonFullscreen?.();
$('#show-hint').onclick = () => {
  const hints = active.topic.hints;
  hintIndex = (hintIndex + 1) % hints.length;
  $('#prompt').textContent = hints[hintIndex];
  $('#hint-label').textContent = '换个提示';
};
$('#refresh').onclick = () => active ? void refresh(active) : void connect();
void connect();
