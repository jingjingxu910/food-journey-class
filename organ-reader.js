import {organReadings} from './organ-reading-data.js';

export function createOrganReader(container, onDone, playPrompt) {
  const dialog = document.createElement('dialog');
  dialog.className = 'organ-reading-dialog';
  dialog.innerHTML = `<header><h2></h2><button type="button" autofocus>关闭资料</button></header>
    <p class="reading-abstract"></p><p><a target="_blank" rel="noopener">打开原文 ↗</a></p>`;
  document.body.append(dialog);
  dialog.querySelector('button').onclick = () => dialog.close();
  const visited = new Set();
  let system, organ, condition, openSource;

  function render(narrate = false) {
    const question = document.createElement('p');
    question.textContent = !system ? '你想查阅哪个器官的资料？'
      : !organ ? '选择一个' + system : !condition ? '想了解哪种疾病？' : condition;
    const options = document.createElement('div');
    options.className = 'reading-options';
    const choices = !system ? Object.keys(organReadings)
      : !organ ? Object.keys(organReadings[system])
      : !condition ? Object.keys(organReadings[system][organ])
      : organReadings[system][organ][condition].map(([title], index) => title + (visited.has(index) ? ' ✓' : ''));
    choices.forEach((label, index) => {
      const button = makeButton(label);
      button.onclick = () => {
        if (condition) {
          const [title, url, summary] = organReadings[system][organ][condition][index];
          openSource = index;
          dialog.querySelector('h2').textContent = title;
          dialog.querySelector('.reading-abstract').textContent = summary;
          const link = dialog.querySelector('a');
          link.href = url;
          link.textContent = '打开中文原文 ↗';
          dialog.showModal();
          return;
        }
        if (!system) system = label;
        else if (!organ) organ = label;
        else condition = label;
        render(true);
        optionsFocus();
      };
      options.append(button);
    });
    if (system) {
      const back = makeButton('返回上一步');
      back.onclick = () => {
        if (condition) { condition = undefined; visited.clear(); }
        else if (organ) organ = undefined;
        else system = undefined;
        render(true);
        optionsFocus();
      };
      options.append(back);
    }
    container.replaceChildren(question, options);
    if (narrate) playPrompt(!system ? 'choose-system'
      : !organ ? (system === '消化器官' ? 'choose-digestive' : 'choose-respiratory')
      : !condition ? 'choose-condition' : null);
  }
  function makeButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    return button;
  }
  function optionsFocus() { container.querySelector('button')?.focus({preventScroll:true}); }
  function reset() {
    system = organ = condition = openSource = undefined;
    visited.clear();
    container.replaceChildren();
  }
  dialog.addEventListener('close', () => {
    if (openSource === undefined) return;
    visited.add(openSource);
    openSource = undefined;
    if (visited.size === 2) {
      reset();
      onDone();
    } else {
      render();
      optionsFocus();
    }
  });
  return {show:()=>render(true), reset};
}
