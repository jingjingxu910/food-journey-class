// CloudBase is needed for records, never as a prerequisite for drawing the UI.
(() => {
  let pending;
  window.loadClassCloud = () => {
    if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))return import('./local-preview-db.js').then(module=>{module.installPreviewCloud();return window.cloudbase;});
    if (window.cloudbase) return Promise.resolve(window.cloudbase);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://static.cloudbase.net/cloudbase-js-sdk/latest/cloudbase.full.js';
      script.async = true;
      const timer = setTimeout(() => { script.remove(); pending = null; reject(new Error('云端连接超时，本机记录仍保留')); }, 6000);
      script.onload = () => { clearTimeout(timer); resolve(window.cloudbase); };
      script.onerror = () => { clearTimeout(timer); script.remove(); pending = null; reject(new Error('云端暂不可用')); };
      document.head.append(script);
    });
    return pending;
  };
})();
