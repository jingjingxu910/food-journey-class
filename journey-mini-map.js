// Coordinates follow the supplied anatomy illustration; duration follows game progress.
export const journeyRoutes={
 outside:'M 226 372 L 253 372',
 mouth:'M 253 372 C 269 357 285 357 308 357 C 324 357 335 355 344 352',
 pharynx:'M 344 352 C 361 352 374 362 387 373 C 402 386 415 402 419 419 C 425 441 424 467 433 492 Q 447 520 451 555',
 esophagus:'M 451 555 C 463 653 451 768 491 890',
 stomach:'M 491 890 C 508 938 579 909 603 945 C 627 995 590 1063 539 1078 Q 467 1103 418 1067',
 small:'M 418 1067 C 425 1078 466 1081 500 1083 M 613 1136 C 610 1159 551 1166 552 1186 C 555 1208 612 1182 620 1171 C 639 1220 555 1224 548 1248 C 550 1269 591 1242 616 1255 C 635 1267 613 1291 581 1276 C 558 1284 611 1310 596 1329 C 576 1353 550 1322 542 1286 C 528 1254 532 1217 499 1217 C 472 1241 442 1200 435 1235 C 436 1276 406 1272 398 1249 C 377 1217 402 1188 420 1181 C 460 1179 492 1190 523 1170 C 497 1149 417 1170 378 1160 C 343 1158 335 1145 327 1148 C 317 1174 348 1183 378 1185 C 400 1208 356 1215 336 1214 C 315 1227 322 1280 345 1287 C 369 1300 341 1248 360 1236 C 379 1228 372 1275 381 1291 C 405 1328 453 1307 480 1283 C 502 1260 505 1302 486 1319 C 466 1341 441 1336 421 1341 C 399 1350 401 1320 384 1331 Q 372 1342 356 1348',
 large:'M 356 1348 C 315 1320 284 1272 290 1228 Q 295 1167 310 1110 C 352 1097 386 1126 443 1127 C 513 1134 580 1107 630 1066 Q 655 1075 655 1154 L 651 1309 C 646 1381 597 1410 550 1398 Q 503 1381 477 1375 Q 453 1379 457 1431 L 462 1528',
 done:'M 462 1528 L 462 1532'};
export class JourneyMiniMap{
 constructor(stage){
  this.button=document.createElement('button');this.button.id='journey-minimap';this.button.hidden=true;this.button.setAttribute('aria-label','我在哪儿，点击放大');this.button.setAttribute('aria-expanded','false');
  this.button.innerHTML=`<span>我在哪儿 <small>＋</small></span>
   <svg viewBox="225 305 465 1240" aria-hidden="true">
    <defs><mask id="map-liver-occlusion" maskUnits="userSpaceOnUse" x="0" y="0" width="951" height="1653">
     <rect width="951" height="1653" fill="white"/>
     <path fill="black" d="M269 1058 C267 1027 261 974 273 933 C291 865 336 862 380 862 C426 862 465 880 483 892 C504 887 532 903 567 904 C591 904 621 909 627 921 C626 925 619 927 613 930 C587 945 566 982 538 1001 C521 1013 499 1019 480 1014 C451 1038 405 1054 367 1055 C335 1056 314 1087 287 1088 C272 1090 265 1079 269 1058 Z"/>
    </mask></defs>
    <image href="assets/journey/digestive-system-clean.png" width="951" height="1653"/>
    <g mask="url(#map-liver-occlusion)"><g class="map-history"></g><path class="map-trail" fill="none"/></g>
    <circle class="map-halo" r="35"/><circle class="map-dot" r="18"/>
   </svg>`;
  stage.append(this.button);this.path=this.button.querySelector('path.map-trail');this.history=this.button.querySelector('.map-history');this.dots=this.button.querySelectorAll('circle');this.button.onclick=()=>this.toggle();
  const old=document.querySelector('#fork-side .side-cut');this.side=document.createElement('button');this.side.id='journey-side-map';this.side.hidden=true;this.side.setAttribute('aria-label','咽部侧面图，点击放大');this.side.innerHTML='<span>从侧面看 <small>＋</small></span>'+old.outerHTML.replaceAll('id="side-food"','class="side-food"')+'<em>气管在前 · 食管在后</em>';stage.append(this.side);this.forkMarkup=this.side.innerHTML;
  this.side.onclick=()=>this.toggleSide();
 }
 toggleSide(force){
  const wasExpanded=this.side.classList.contains('expanded');
  const expanded=force??!wasExpanded;
  this.side.classList.toggle('expanded',expanded);
  this.side.setAttribute('aria-expanded',String(expanded));
  this.side.querySelector('small').textContent=expanded?'－':'＋';
  if(expanded)this.toggle(false);
  if(expanded!==wasExpanded)this.onSideChange?.(expanded,this.scene);
 }
 toggle(force){const on=force??!this.button.classList.contains('expanded');this.button.classList.toggle('expanded',on);this.button.setAttribute('aria-expanded',String(on));this.button.querySelector('small').textContent=on?'－':'＋';if(on)this.toggleSide(false);}
 update(scene,progress=0,foodImage){this.button.hidden=scene==='outside'||scene==='done';this.side.hidden=!['pharynx','small'].includes(scene);if(this.scene!==scene){this.scene=scene;const keys=Object.keys(journeyRoutes);const prior=keys.slice(0,keys.indexOf(scene));this.history.innerHTML=prior.map(key=>'<path class="map-trail'+'" fill="none" d="'+journeyRoutes[key]+'"/>').join('');this.side.innerHTML=scene==='small'?'<div class="villi-pair"><img src="assets/journey/small-intestine.webp" alt="小肠内壁"><img src="assets/journey/villi-micrograph.jpg" alt="小肠绒毛显微图"></div><small>＋</small>':this.forkMarkup;this.side.setAttribute('aria-label',scene==='small'?'小肠绒毛图，点击放大':'咽部侧面图，点击放大');this.path.setAttribute('d',journeyRoutes[scene]||journeyRoutes.mouth);this.length=this.path.getTotalLength();this.toggle(false);this.side.classList.remove('expanded');}const p=Math.max(0,Math.min(1,progress));const point=this.path.getPointAtLength(this.length*p);for(const dot of this.dots){dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);}this.path.style.strokeDasharray=String(this.length);this.path.style.strokeDashoffset=String(this.length*(1-p));if(foodImage&&scene==='pharynx')this.side.querySelector('.side-food').setAttribute('href',foodImage);}
}
