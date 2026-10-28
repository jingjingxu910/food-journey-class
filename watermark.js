// Keep authorship visible on normal pages and inside the active fullscreen element.
(() => {
  const mark = document.createElement('div');
  mark.textContent = '@许静竞2026';
  mark.setAttribute('aria-hidden', 'true');
  mark.style.cssText = 'position:fixed;left:50%;top:20px;transform:translate(-50%,-50%);z-index:2147483647;pointer-events:none;user-select:none;padding:2px 6px;border-radius:5px;background:rgba(255,255,255,.55);color:rgba(15,65,70,.68);font:600 12px/1.4 system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.2px;white-space:nowrap;';
  const place = () => {
    const root = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    root.append(mark);
    const header = root.querySelector('.game-bar,.model-topbar,.flow-topbar,.site-topbar');
    const box = header?.getBoundingClientRect();
    mark.style.top = box && box.height ? `${box.top + box.height / 2}px` : '16px';
  };
  document.addEventListener('fullscreenchange', place);
  document.addEventListener('webkitfullscreenchange', place);
  window.addEventListener('resize', place);
  place();
})();
