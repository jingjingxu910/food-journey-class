// Pure local checks: no browser, SDK, cloud reads or cloud writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../evaluation-data.js'),'utf8')
   .replace(/^import .* from '\.\/student-data\.js(?:\?[^']+)?';/m,
     "const cloudDb=()=>{throw new Error('Cloud access forbidden in local test')};");
 const {makeAwards,journeyEvents}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const record=(id,n,side=0)=>({id:'record-'+id,groupId:id,resetId:'test',journey:{events:[...Array.from({length:n},()=>({type:'villi-detail'})),...Array.from({length:side},()=>({type:'fork-side-view'}))]},evaluation:{completedAt:1,levels:[2,2,2]}});
 const fixed=[10,11,12].map((id,index)=>{
   const row=record(id,0);row.evaluation.levels[index]=3;return row;
 });
 const rows=[record(1,1),record(9,8),record(3,2,5),...fixed],stars={1:{stars:[5,5,5]},9:{stars:[0,0,0]},3:{stars:[1,1,1]}};
 const awards=makeAwards(rows,stars);
 assert.equal(awards.find(a=>a.evidenceKey==='villi').groupId,9);
 assert.equal(awards.find(a=>a.evidenceKey==='side-view').groupId,3);
 assert.deepEqual(makeAwards([...rows].reverse(),stars).map(a=>a.evidenceKey),awards.map(a=>a.evidenceKey));
 for(const dimension of [0,1,2]){
   const rows=[record(1,0),record(9,0),...fixed.filter((_,index)=>index<dimension)],low=[0,0,0],high=[0,0,0];low[dimension]=1;high[dimension]=4;
   const result=makeAwards(rows,{1:{stars:low},9:{stars:high}});
   assert.equal(result.find(a=>a.evidenceKey===['teacher-observation','teacher-cooperation','teacher-persistence'][dimension]).groupId,9);
 }
 const repeated=makeAwards(Array.from({length:12},(_,i)=>record(i+1,2)),{});
 assert.equal(new Set(repeated.map(a=>a.title)).size,12);
 assert.equal(new Set(repeated.map(a=>a.icon)).size,12);
 assert.equal(repeated.filter(a=>a.evidenceKey==='villi'&&!a.awardBasis.isAdditional).length,1);
 const current=[{type:'safe-swallow'}],past=[{type:'airway'}];
 assert.deepEqual(journeyEvents({history:current,events:current,attempts:[{events:past}]}),[...past,...current]);
 assert.equal(makeAwards([{id:'a',groupId:9,journey:{events:current,attempts:[{events:past}]}},...fixed],{})[0].evidenceKey,'swallow-correction');
 console.log('Awards verified: unique families/icons, observed evidence, counts, teacher dimensions, stable ties, earlier attempts.');
})().catch(error=>{console.error(error);process.exitCode=1});
