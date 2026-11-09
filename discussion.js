import {discussionQuestions} from './discussion-content.js';
const index=Math.max(0,Math.min(2,Number(new URLSearchParams(location.search).get('question'))||0));
const item=discussionQuestions[index];
document.querySelector('#question').textContent=item.question;
document.querySelector('#question-number').textContent=(index+1)+' / '+discussionQuestions.length;
item.hints.forEach((hint,i)=>{const b=document.createElement('button');b.textContent='💡';b.setAttribute('aria-label','思考提示 '+(i+1));b.setAttribute('aria-pressed','false');b.onclick=()=>{document.querySelectorAll('#hints button').forEach(other=>other.setAttribute('aria-pressed',String(other===b)));document.querySelector('#hint-text').textContent=hint;};document.querySelector('#hints').append(b);});
