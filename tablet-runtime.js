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
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./ar-assets-sw.js', {updateViaCache:'none'}).catch(() => {});
  }
})();
