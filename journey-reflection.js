export function renderReflection(doc,organs,log,foodArt){
 const ids=['mouth','esophagus','stomach','small','large'];
 const forms=['bolus','bolus','chyme','residue','dry'];
 const roles=['牙齿磨碎，唾液润湿并开始消化','内壁蠕动，把食团送往胃','暂存食物，运动与胃液共同混合、消化','继续消化，吸收大部分营养和部分水分','吸收剩余部分水分，残渣逐渐形成'];
 const cards=ids.map((id,i)=>{const card=doc.createElement('div'),image=doc.createElement('img'),name=doc.createElement('b'),role=doc.createElement('span'),food=doc.createElement('canvas');image.src=organs[id].image;image.alt=organs[id].name+'的整体形态';image.className='recap-organ';name.textContent=organs[id].name;role.textContent=roles[i];food.width=food.height=160;food.className='recap-food';food.getContext('2d').drawImage(foodArt[forms[i]],0,0,160,160);card.append(image,name,role,food);return card;});
 doc.getElementById('recap').replaceChildren(...cards);
 const events=[...(log.attempts||[]).flatMap(a=>a.events||[]),...(log.events||[])],revised=new Set(events.filter(e=>e.type==='identify'&&e.choice!==organs[e.organId]?.name).map(e=>e.organId));if(log.stomach?.wrong||events.some(e=>e.type==='stomach-wrong'))revised.add('stomach');
 const evidence=[];
 if(log.chews>=3&&log.saliva)evidence.push('饼干被牙齿嚼碎，和唾液混在一起，变成了湿润的食团。');
 if(log.push>=1)evidence.push('食管一段段收紧，把食团往前推。');
 if(log.stomach?.mixed>=1)evidence.push('胃壁来回收缩，把食物和胃液混在一起，食物变成了细软的食糜。');
 if(log.absorbed>=1)evidence.push('在小肠里，我们看到代表营养的小颗粒移向肠壁。小肠吸收了大部分营养。');
 if(log.water>=1)evidence.push('到了大肠，剩下的东西少了一些水，变得更干、更紧实。');

 const used=types=>events.some(e=>types.includes(e.type));
 const steps=[];
 if(used(['look','stomach-ahead','stomach-entry','stomach-pool']))steps.push('我们换个方向，看看四周有什么。');
 if(used(['locate','stomach-locate']))steps.push('我们打开人体图，把眼前的器官和身体中的位置对照起来。');
 if(used(['fork-side-view']))steps.push('在咽部，我们从侧面比较了两条通道。');
 if(used(['villi-detail']))steps.push('在小肠里，我们凑近看了肠壁上的绒毛。');
 if(log.coughs)steps.push('食团走错了路，引起了咳嗽。我们回去再选了一次。');
 if(log.vomits)steps.push('我们还看到食物往回走，从嘴里吐了出来。后来我们重新出发，走完了这趟旅行。');

 const corrections=[...revised].map(id=>organs[id]?.name).filter(Boolean);
 const judgment=corrections.length
  ? `我们一开始猜错了${corrections.join('、')}。后来看到什么，才改了主意？`
  : '我们认出了五个器官。你能选一个，说说是凭什么认出来的吗？';
 const parts=[
  ['食物变成了什么样？',evidence.join('')||'回想一下，饼干出发时是什么样，走到最后又是什么样？'],
  ['我们是怎么认出来的？',judgment],
  ['我们是怎么找线索的？',steps.join('')||'我们一路看食物怎么变，也留意每一站的内壁是什么样、会不会动。']
 ];
 const feedback=doc.getElementById('feedback');feedback.replaceChildren(...parts.map(([title,text])=>{const p=doc.createElement('p'),b=doc.createElement('strong'),s=doc.createElement('span');b.textContent=title;s.textContent=text;p.append(b,s);return p;}));
 const next=doc.createElement('p');next.className='next-thought';next.textContent=log.coughs?'再想一想：为什么边吃边说笑，更容易呛到？':revised.size?'再想一想：只看食物的样子，能知道到了哪一站吗？你还会看什么？':'再想一想：食管、小肠和大肠都会动。它们各帮了食物什么忙？';feedback.append(next);
}
