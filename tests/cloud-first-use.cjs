const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 console.warn=()=>{}; global.location={search:'?group=9'};let mode='missing',writes=[];
 const db={collection:()=>({doc:id=>({get:async()=>{if(mode==='denied')throw Object.assign(new Error('denied'),{code:'PERMISSION_DENIED'});if(id==='class-reset')return {data:[{resetId:'round-test'}]};throw Object.assign(new Error('Document not found'),{code:'DOCUMENT_NOT_FOUND'});},set:async value=>{writes.push({id,value});return {upsertedId:id};}})})};
 global.window={cloudbase:{init:()=>({auth:()=>({getLoginState:async()=>true}),database:()=>db})}};
 const src=fs.readFileSync(require('node:path').join(__dirname,'../student-data.js'),'utf8');const m=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 assert.deepEqual(await m.readOptionalDocument({get:async()=>({code:'DOCUMENT_NOT_FOUND'})}),{data:[]});
 await assert.rejects(()=>m.readOptionalDocument({get:async()=>{throw Object.assign(new Error('offline'),{code:'NETWORK_ERROR'});}}),/offline/);
 const record={id:'test',groupId:9,resetId:'round-test',v1:{completedAt:1},evaluationDraft:{levels:[3,3,3]},evaluation:{completedAt:1,levels:[3,2,1]}};
 assert.equal(await m.submitRecord(record,{saveLocal:false}),true);assert.equal(writes[0].value.records[0].evaluation,null);assert.equal(writes[0].value.records[0].evaluationDraft,undefined);
 assert.equal(await m.submitRecord(record,{saveLocal:false,submitEvaluation:true}),true);assert.deepEqual(writes[1].value.records[0].evaluation.levels,[3,2,1]);
 assert.equal(await m.submitRecord({...record,resetId:'old'},{saveLocal:false}),false);assert.equal(writes.length,2);
 mode='denied';assert.equal(await m.submitRecord(record,{saveLocal:false}),false);assert.equal(writes.length,2);
 console.log('PASS: first submission, missing documents, explicit self-evaluation, round isolation, permission/network errors. All writes mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});

