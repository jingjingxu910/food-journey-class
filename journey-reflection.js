export function renderReflection(doc,organs,log,foodArt){
 const ids=['mouth','esophagus','stomach','small','large'];
 const forms=['bolus','bolus','chyme','residue','dry'];
 const roles=['牙齿磨碎，唾液润湿并开始消化','内壁蠕动，把食团送往胃','暂存食物，运动与胃液共同混合、消化','继续消化，吸收大部分营养和部分水分','吸收剩余部分水分，残渣逐渐形成'];
 const cards=ids.map((id,i)=>{const card=doc.createElement('div'),image=doc.createElement('img'),name=doc.createElement('b'),role=doc.createElement('span'),food=doc.createElement('canvas');image.src=organs[id].image;image.alt=organs[id].name+'的整体形态';image.className='recap-organ';name.textContent=organs[id].name;role.textContent=roles[i];food.width=food.height=160;food.className='recap-food';food.getContext('2d').drawImage(foodArt[forms[i]],0,0,160,160);card.append(image,name,role,food);return card;});
 doc.getElementById('recap').replaceChildren(...cards);
 const events=[...(log.attempts||[]).flatMap(a=>a.events||[]),...(log.events||[])],revised=new Set(events.filter(e=>e.type==='identify'&&e.choice!==organs[e.organId]?.name).map(e=>e.organId));if(log.stomach?.wrong||events.some(e=>e.type==='stomach-wrong'))revised.add('stomach');
 const evidence=[];if(log.chews>=3&&log.saliva)evidence.push('把饼干磨碎并与唾液混合');if(log.stomach?.mixed>=1)evidence.push('观察胃壁运动与食物变细软');if(log.absorbed>=1)evidence.push('观察营养颗粒移向小肠内壁');if(log.water>=1)evidence.push('观察水分离开内容物');
 const observations=events.filter(e=>e.type==='look'||e.type==='stomach-ahead'||e.type==='stomach-entry'||e.type==='stomach-pool').length;
 const locates=events.filter(e=>e.type==='locate'||e.type==='stomach-locate').length;
 const details=events.filter(e=>['villi-detail','fork-side-view'].includes(e.type)).length;
 const parts=[['我们观察到的变化',evidence.length?'我们'+evidence.join('，')+'。':'回想沿途食物的形态变化，与上面的器官作用对应起来。'],['我们怎样作出判断',revised.size?'我们完成了五处辨认，并在'+[...revised].map(id=>organs[id]?.name).filter(Boolean).join('、')+'的判断中作了修正。哪条观察证据帮助了我们？':'我们完成了五处辨认。试着为每一处各说出一条观察证据。'],['我们的探索过程',`我们环顾或改变观察方向 ${observations} 次，查看定位 ${locates} 次，查看放大或侧面剖面 ${details} 次。`+(log.coughs?`经历 ${log.coughs} 次误入呼吸道后的咳嗽，随后重新选择了食物的路线。`:'')+(log.vomits?`经历 ${log.vomits} 次反向排出后，重新完成了旅行。正常消化与这种特殊反应有什么不同？`:'')]];
 const feedback=doc.getElementById('feedback');feedback.replaceChildren(...parts.map(([title,text])=>{const p=doc.createElement('p'),b=doc.createElement('strong'),s=doc.createElement('span');b.textContent=title;s.textContent=text;p.append(b,s);return p;}));
 const next=doc.createElement('p');next.className='next-thought';next.textContent=log.coughs?'再想一想：吃东西时说笑，为什么可能影响食物选择通道？':revised.size?'再想一想：如果只看食物的形状，能判断所有器官吗？还需要哪些证据？':'再想一想：食管、小肠和大肠都会运动，它们的作用有哪些相同和不同？';feedback.append(next);
}
