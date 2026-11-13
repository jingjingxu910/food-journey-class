const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../model-workbench.js'),'utf8');
function extract(name){const start=source.indexOf('function '+name+'('),body=source.indexOf('{',start);let depth=1,i=body+1;for(;depth&&i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i);}
const context=vm.createContext({});
vm.runInContext(source.slice(0,source.indexOf('const CLOUD_ENV'))+'\n'+['organById','appearanceFor','colonWallDistance','sampleFoodRoute','routeOrganDistance','intestinalContacts','inferRouteOrder','routeLayers','compareModels'].map(extract).join('\n')+'\nthis.infer=inferRouteOrder;this.layers=routeLayers;this.compare=compareModels;',context);
const model={positions:{'small-intestine':{x:50,y:60},'large-intestine':{x:50,y:60}},routePoints:[]};
const order=points=>Array.from(context.infer({...model,routePoints:points.map(([x,y])=>({x,y}))}).order);
assert.deepEqual(order([[50,40],[50,60],[42,60],[42,52]]),['small-intestine','large-intestine'],'Passing behind transverse colon must reach small intestine first');
const routePoints=[{x:50,y:42},{x:50,y:60},{x:50,y:68},{x:48,y:76}];
const layers=context.layers({...model,routePoints});
assert.equal(layers.behind[0],routePoints[0]);
assert.equal(layers.front.at(-1),routePoints.at(-1));
assert.equal(layers.behind.at(-1),layers.front[0],'Front and back strokes meet without a gap');
assert(layers.front[0].y>60 && layers.front[0].y<68,'Front stroke starts at the colon wall');
const overlap=context.layers({...model,routePoints:[{x:50,y:40},{x:50,y:60},{x:42.5,y:60}]});
assert(overlap.front.length>1 && overlap.front[0].x>42.5,'Colon wall changes layers while still inside the small intestine image');
assert.equal(context.layers({...model,routePoints:routePoints.slice(0,2)}).front.length,0,'A route still in the small intestine stays below the colon');
assert.deepEqual(order([[49,59],[51,60]]),['small-intestine'],'Empty centre of colon must not count as colon');
assert.deepEqual(order([[40,60],[42,60],[50,60]]),['large-intestine','small-intestine'],'A real entry through colon side should retain student order');
assert.deepEqual(order([[10,10],[12,12]]),[],'Unrelated stroke must not hit organs');
const noSmall={positions:{'large-intestine':{x:50,y:60}},routePoints:[{x:50,y:40},{x:50,y:60}]};
assert.deepEqual(Array.from(context.infer(noSmall).order),['large-intestine'],'Transverse colon remains a valid organ when not passing into small intestine');
const dashboard=fs.readFileSync(require('node:path').join(__dirname,'../live-dashboard.js'),'utf8');
vm.runInContext(dashboard.slice(dashboard.indexOf('function demoState('))+'\nthis.demo=demoState;',context);
for(const phase of ['v1','v2']){
 const submitted=context.demo(4,phase).model;
 assert.deepEqual(Array.from(context.infer(submitted).order),['mouth','esophagus','stomach','small-intestine','large-intestine']);
 assert(context.layers(submitted).front.length>1,'The distal route rises above the colon after reaching the small intestine');
}
const first=context.demo(4,'v1').model,second=context.demo(4,'v2').model;
assert.equal(context.compare(first,second).routeChanged,false,'A shifted stomach waypoint does not change the organ sequence');
assert.equal(context.compare(first,{...first,routePoints:[...first.routePoints].reverse()}).routeChanged,true,'Reversing the organ sequence changes the route');
const ar=fs.readFileSync(require('node:path').join(__dirname,'../class-evaluation.js'),'utf8');
assert(!ar.includes('names[v.organId]||v.organId'),'AR report must not leak internal English organ identifiers');
const drag=vm.createContext({});
vm.runInContext(`
  var drawMode=false,dragState=null,selectedOrgan=null,created=0,removed=0,placements=0;
  const sourceNode={dataset:{organ:'mouth'},classList:{add(){},remove(){}},setPointerCapture(){}};
  const state={positions:{},placementOrder:[],moves:[],modificationCount:0};
  const stage={clientWidth:100,clientHeight:150,getBoundingClientRect:()=>({left:0,top:0,right:100,bottom:150})};
  const activeModel=()=>state,organById=()=>({id:'mouth'}),appearanceFor=()=>({width:12,angle:0});
  const clone=v=>JSON.parse(JSON.stringify(v)),snapshot=()=>{},render=()=>{placements++},queueDraftSave=()=>{};
  const saveStatus={},pointerPosition=e=>({x:e.clientX,y:e.clientY});
  const document={body:{append(){}},querySelectorAll:()=>[]};
  function createOrganButton(){created++;return {classList:{add(){}},style:{},querySelector:()=>({remove(){},style:{}}),remove(){removed++}};}
  function event(id,primary=true){return {pointerId:id,isPrimary:primary,button:0,currentTarget:sourceNode,preventDefault(){},clientX:50,clientY:70};}
`+['beginOrganDrag','moveOrganDrag','endOrganDrag','cancelOrganDrag'].map(extract).join('\n'),drag);
vm.runInContext('beginOrganDrag(event(1));beginOrganDrag(event(2,false));endOrganDrag(event(2,false));',drag);
assert.equal(drag.created,1,'Second touch must not create an orphan duplicate');
assert.equal(drag.placements,0,'Second touch must not drop first touch organ');
vm.runInContext('endOrganDrag(event(1));',drag);
assert.equal(drag.placements,1);assert.equal(drag.removed,1);assert.equal(drag.dragState,null);
vm.runInContext('beginOrganDrag(event(3));cancelOrganDrag();',drag);
assert.equal(drag.created,2);assert.equal(drag.removed,2);assert.equal(drag.dragState,null);
console.log('PASS: underpass, hollow colon, reverse order, unrelated paths, transverse entry, Chinese names, multi-touch drag ownership and cleanup');
