import { discussionQuestions } from './discussion-content.js';

const requested = Number(new URLSearchParams(location.search).get('question'));
const index = Number.isInteger(requested)
  ? Math.max(0, Math.min(discussionQuestions.length - 1, requested))
  : 0;
const item = discussionQuestions[index];

document.querySelector('#question').textContent = item.question;
document.querySelector('#question-number').textContent = (index + 1) + ' / ' + discussionQuestions.length;
