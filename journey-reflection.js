export function renderReflection(doc,organs,log,foodArt){
 const stages=[['出发前','整块饼干','whole'],['口腔','变碎、变湿润','bolus'],['食管','蠕动推动食团','bolus','esophagus'],['胃','变成细软的食糜','chyme'],['小肠','营养被吸收','residue'],['大肠','留下残渣','dry']];
 doc.getElementById('recap').replaceChildren(...stages.map(([place,change,form,key])=>{
  const card=doc.createElement('div'),name=doc.createElement('b'),food=doc.createElement('canvas'),caption=doc.createElement('span');
  name.textContent=place;caption.textContent=change;food.width=food.height=360;food.className='recap-food';food.setAttribute('role','img');food.setAttribute('aria-label',place+'：'+change);food.getContext('2d').drawImage(foodArt[form],0,0,360,360);const organFiles={'口腔':'mouth','食管':'esophagus','胃':'stomach','小肠':'small-intestine','大肠':'large-intestine'};const images=doc.createElement('div');images.className='recap-images';if(organFiles[place]||key==='pharynx'){const img=doc.createElement('img');img.src=key==='pharynx'?'assets/journey/pharynx.webp':'assets/organs/'+organFiles[place]+'.png';img.alt=place;images.append(img);}images.append(food);card.append(name,images,caption);return card;
 }));
 const feedback=doc.getElementById('feedback');feedback.replaceChildren();
}
