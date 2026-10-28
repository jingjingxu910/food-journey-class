import { currentRecord } from "./student-data.js";

const appVersion = "0.3.0";

const params = new URLSearchParams(location.search);
const groupId = Number(params.get("group"));

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

document.querySelector("#fullscreen-button")?.addEventListener("click", () => document.documentElement.requestFullscreen?.());

function nextStep(record) {
  if (!record.v1?.completedAt) return 0;
  if (!record.observation?.completedAt) return 1;
  if (!record.v2?.completedAt) return 2;
  if (!record.assembly?.completedAt) return 3;
  if (!record.journey?.completedAt) return 4;
  return 5;
}

function showProgress(record) {
  const step = nextStep(record);
  document.querySelectorAll('.module-card[data-step]').forEach((card) => {
    const index = Number(card.dataset.step);
    card.hidden = index > step;
    card.classList.toggle('module-card--active', index === step);
    card.classList.toggle('module-card--complete', index < step);
    const action = card.querySelector('.module-action');
    action.dataset.startLabel ||= action.textContent;
    action.textContent = index < step ? '已完成 · 查看' : action.dataset.startLabel;
  });
  document.querySelector('.section-heading h2').textContent = [
    '从你的想法开始', '接下来，仔细观察', '回到模型，再想一想', '现在，动手拼装', '跟着食物去旅行', '完成的活动',
  ][step];
}

async function refreshProgress() {
  try { showProgress(await currentRecord()); }
  catch (error) { console.warn('本机进度暂时无法读取', error); }
}

void refreshProgress();
window.addEventListener('pageshow', (event) => { if (event.persisted) void refreshProgress(); });
