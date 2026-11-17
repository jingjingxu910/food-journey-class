import { currentRecord } from "./student-data.js?v=20261116-tablet-fixes";
import { readDocument } from "./evaluation-data.js?v=classroom-remote";

const appVersion = "0.3.0";

const groupId = Number(new URLSearchParams(location.search).get("group"));
const phases = ['v1','observation','v2','assembly','journey','evaluation','forum'];
const cards = Array.from(document.querySelectorAll('.module-card[data-step]'), card => {
  const action = card.querySelector('.module-action');
  return {card, action, startLabel:action.textContent, href:card.href, phase:phases[Number(card.dataset.step)]};
});
let record, command;

if (Number.isInteger(groupId) && groupId >= 1 && groupId <= 12) {
  const groupBadge = document.querySelector("#home-group-badge");
  groupBadge.hidden = false;
  groupBadge.textContent = `第 ${groupId} 组`;
  document.querySelectorAll('a[href*=".html"]').forEach((link) => {
    const url = new URL(link.href);
    url.searchParams.set("group", groupId);
    link.href = url.href;
  });
}

console.info(`食物在身体里的旅行 v${appVersion}`);

document.querySelector("#fullscreen-button")?.addEventListener("click", () => window.requestLessonFullscreen?.());

function showProgress() {
  const currentRound = !command || (record?.resetId || null) === (command.resetId || null);
  for (const {card, action, startLabel, href, phase} of cards) {
    const complete = currentRound && Boolean(record?.[phase]?.completedAt);
    const open = command?.phase === phase;
    const round = command?.resetId ?? record?.resetId ?? null;
    const openedForum = phase==='forum' && localStorage.getItem('lesson-forum-open-round')===JSON.stringify(round);
    card.hidden = !complete && !open && !openedForum;
    card.classList.toggle('module-card--active', open && !complete);
    card.classList.toggle('module-card--complete', complete);
    action.textContent = complete ? '已完成 · 查看' : startLabel;
    const url = new URL(href);
    if (groupId >= 1 && groupId <= 12 && Number.isInteger(groupId)) url.searchParams.set('group',groupId);
    if (complete) {
      url.searchParams.set('review','1');
      if (command?.commandId != null) url.searchParams.set('reviewCommand',command.commandId);
    } else if (openedForum || (phase==='forum' && open)) {
      url.searchParams.set('round',round||'');
      url.searchParams.set('review','1');
      if (command?.commandId != null) url.searchParams.set('reviewCommand',command.commandId);
    } else if (open) {
      url.searchParams.set('controlled','1');
    }
    card.href = url.href;
  }
  const anyVisible = cards.some(({card}) => !card.hidden);
  document.body.classList.toggle('home-start', !anyVisible);
  document.querySelector('.section-heading h2').textContent = anyVisible ? '课堂活动' : '请等待老师开启课堂活动';
}

async function refreshProgress() {
  try {
    record = await currentRecord();
    showProgress();
    const forum=await readDocument('class-forum-open');
    if(forum.opened&&(forum.resetId||null)===(record.resetId||null)){
      localStorage.setItem('lesson-forum-open-round',JSON.stringify(record.resetId||null));
      showProgress();
    }
  }
  catch (error) { console.warn('本机进度暂时无法读取', error); }
}

window.addEventListener('class-command', event => {
  command = event.detail;
  showProgress();
});
void refreshProgress();
window.addEventListener('pageshow', (event) => { if (event.persisted) void refreshProgress(); });
