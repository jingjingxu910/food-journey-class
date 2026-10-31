(() => {
  // Fit the original 2:3 coordinate plane; never stretch the student's model.
  const wrap = document.querySelector('.body-stage-wrap');
  const stage = document.querySelector('#body-stage');
  if (wrap && stage) {
    const fit = () => {
      if (!wrap.clientWidth || !wrap.clientHeight) return;
      const h = Math.min(wrap.clientHeight - 8, (wrap.clientWidth - 8) * 1.5);
      stage.style.width = `${Math.floor(h / 1.5)}px`;
      stage.style.height = `${Math.floor(h)}px`;
    };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
    window.addEventListener('resize', fit); fit();
  }
  document.querySelector('#portrait-button')?.addEventListener('click', async () => {
    const button = document.querySelector('#portrait-button');
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!screen.orientation?.lock) throw new Error('unsupported');
      await screen.orientation.lock('portrait');
      button.textContent = '竖屏';
    } catch {
      button.textContent = '已适应当前屏幕';
      button.setAttribute('aria-label', '设备限制旋转，已使用当前屏幕布局');
    }
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./ar-assets-sw.js').catch(() => {});
  }
})();
