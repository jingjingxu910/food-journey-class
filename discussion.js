import { discussionQuestions } from './discussion-content.js';

const requested = Number(new URLSearchParams(location.search).get('question'));
const index = Number.isInteger(requested)
  ? Math.max(0, Math.min(discussionQuestions.length - 1, requested))
  : 0;
const item = discussionQuestions[index];
const layout = document.querySelector('#hints');
const template = document.querySelector('#hint-template');

document.querySelector('#question').textContent = item.question;
document.querySelector('#question-number').textContent = (index + 1) + ' / ' + discussionQuestions.length;

item.hints.forEach((hint, index) => {
  const fragment = template.content.cloneNode(true);
  const button = fragment.querySelector('button');
  const note = fragment.querySelector('.hint-note');
  const label = '思考提示 ' + (index + 1);
  button.setAttribute('aria-label', label);
  note.querySelector('.hint-label').textContent = label;
  note.querySelector('p').textContent = hint;

  button.addEventListener('click', () => {
    button.hidden = true;
    note.hidden = false;
    note.focus({ preventScroll: true });
  });
  layout.append(fragment);
});
