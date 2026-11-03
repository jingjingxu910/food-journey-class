// Report module/network errors instead of leaving a permanently disabled camera button.
(() => {
 const button=document.querySelector('#start-camera'),status=document.querySelector('#camera-status');
 let settled=false;
 const fail=message=>{if(settled)return;status.textContent=message;button.disabled=false;button.textContent='重新加载观察页';button.onclick=()=>location.reload();};
 const timer=setTimeout(()=>fail('观察页加载较慢，请检查网络或课前下载资源后重试'),20000);
 import('./observation.js?v=20261104-ar-review-14').then(()=>{settled=true;clearTimeout(timer);}).catch(error=>{clearTimeout(timer);fail('观察页程序未加载完成。原因：'+(error.name||'加载错误')+'：'+(error.message||'无法获取程序文件')+'。请将这条提示告诉老师。');console.error('AR page startup failed',error);});
})();
