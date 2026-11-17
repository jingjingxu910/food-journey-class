import {cloudDb, groupId} from './student-data.js?v=20261116-tablet-fixes';
import {roundId} from './evaluation-data.js?v=award-journey-evidence';
import {forumTopics} from './forum-content.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const teacher = params.get('mode') === 'teacher';
const group = Math.trunc(groupId);
const groupName = id => '第 ' + id + ' 组';
const discussionFields = [{name:'message', label:'我们组的想法', max:600}];
const replyFields = [{name:'message', label:'我们组的追问或补充', max:400}];
let collection, round, active;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function forumKey(topic, parent=0) {
  return ['forum', encodeURIComponent(round || 'initial'), topic.id, parent].join('-');
}

async function readEntries(key) {
  const result = await collection.where({forumKey:key}).limit(12).get();
  if (result.code) throw new Error('暂时无法读取论坛。');
  return result.data
    .filter(entry => Number.isInteger(entry.groupId) && entry.groupId >= 1 && entry.groupId <= 12)
    .sort((a,b) => a.groupId - b.groupId);
}

async function saveEntry(key, values) {
  const result = await collection.doc(key + '-' + group).set({
    kind:'lesson-forum', forumKey:key, resetId:round, groupId:group, values, updatedAt:Date.now()
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
  const details = element('details');
  const summary = element('summary', '查看回复');
  const replies = element('div', undefined, 'replies');
  const replyEditor = element('div');
  const key = forumKey(view.topic, post.groupId);
  let reading = false;
  async function showReplies() {
    reading = true;
    try {
      const entries = await readEntries(key);
      const messages = entries.map(entry => {
        const reply = element('div', undefined, 'reply');
        reply.append(element('strong', groupName(entry.groupId)), element('p', entry.values?.message));
        return reply;
      });
      replies.replaceChildren(...(messages.length ? messages : [element('p','还没有回复。')]));
      if (!teacher && post.groupId !== group && !replyEditor.firstChild) {
        replyEditor.append(composer(key, replyFields, '发布回复', entries.find(entry => entry.groupId === group), showReplies));
      }
    } catch {
      replies.replaceChildren(element('p','回复暂时无法读取，合上后重新展开可重试。'));
    } finally {
      reading = false;
    }
  }
  details.ontoggle = () => {
    if (details.open && !reading) void showReplies();
  };
  details.append(summary, replies, replyEditor);
  article.append(details);
  return article;
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
    // Keep open replies and drafts when an unchanged thread is refreshed.
    const previous = view.threads;
    view.threads = new Map();
    const cards = entries.map(post => {
      const cached = previous.get(post.groupId);
      const signature = JSON.stringify(post.values);
      const card = cached?.signature === signature ? cached.card : thread(view, post);
      view.threads.set(post.groupId, {signature, card});
      return card;
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
  const tab = element('button', view.topic.title);
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
  $('#prompt').textContent = view.topic.prompt;
  $('#composer').replaceChildren(...(view.editor ? [view.editor] : []));
  $('#threads').replaceChildren(...Array.from(view.threads.values(), entry => entry.card));
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
if (teacher) $('#instructions').textContent = '选择话题查看各组的帖子，展开帖子可查看回复。';
$('#fullscreen').onclick = () => window.requestLessonFullscreen?.();
$('#refresh').onclick = () => active ? void refresh(active) : void connect();
void connect();
