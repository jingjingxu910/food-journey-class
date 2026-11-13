const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../stomach-sample.js'), 'utf8');
function functionSource(name, next) {
  return source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
}
const nodes = new Map(), events = [], hints = [];
const context = vm.createContext({
  state: { phase:'explore', fluid:false, foodStage:'bolus', mixed:0, mixing:false, finished:false, seen:new Set() },
  held:false, moving:null, elapsed:0, wetUntil:0, drops:[], pointer:null,
  $: id => { if(!nodes.has(id))nodes.set(id,{showModal(){this.open=true;}});return nodes.get(id); },
  record: name => events.push(name), evidence(){}, hint: (text,kind) => hints.push({text,kind}),
  desiredYaw:0, viewTween:null, camera:{position:{}}, orientationProbe:{position:{copy(){}},rotation:{y:0},lookAt(){}},
  look(){context.turns=(context.turns||0)+1;}, progress(){}, voyageMessage(){}, points:{pool:{},exit:{}}, leave(){context.left=true;}, backward(){},
});
context.inVoyage=false;
vm.runInContext(functionSource('wetFood', 'startMixing') + functionSource('startMixing', 'showAnatomy') + functionSource('showQuestion','answer') + functionSource('forward', 'leave'), context);
vm.runInContext('forward()', context);
assert.equal(context.state.fluid, true, 'One forward click wets the food without touching the liquid');
assert.equal(context.state.mixing, false, 'Mixing waits for the fluid effect');
assert.equal(context.state.foodStage, 'bolus', 'Arrival still shows the swallowed food');
context.elapsed=1.4;
vm.runInContext(source.split('\n').find(line=>line.includes('elapsed>=wetUntil')),context);
assert.equal(context.state.foodStage,'wet-fragments');
vm.runInContext('forward()', context);
assert.equal(context.state.mixing, true, 'One click starts sustained mixing after wetting');
assert.equal(context.held, true);
assert.deepEqual(events, ['fluid','wall']);
vm.runInContext('forward()', context);
assert.deepEqual(events, ['fluid','wall'], 'Repeated click must not restart the sequence');
assert.equal(context.turns,1,'Only the initial wetting effect directs the view');
context.viewTween={toYaw:Math.PI};
vm.runInContext('forward()',context);
assert.equal(context.turns,2,'Forward reverses a turn already heading backward');
context.viewTween=null;
const releaseCode = source.slice(source.indexOf('function release(e){'), source.indexOf("host.addEventListener('pointerup',"));
vm.runInContext(releaseCode, context);
context.pointer = {id:1,drag:false,kind:'wall'};
vm.runInContext('release({pointerId:1})', context);
assert.equal(context.held, true, 'Pointer release does not stop click-triggered mixing');
assert.equal(context.state.mixing, true);
context.state.mixed = 1;context.state.mixing = false;
vm.runInContext('forward()', context);
assert.equal(nodes.get('question').open,true,'Completed mixing opens identification');
context.state.phase = 'exit';
vm.runInContext('forward()', context);
assert.equal(context.left,true,'Forward exits without requiring a manually aligned camera');
assert.match(source,/if\(!state\.fluid\)wetFood\(\)/,'Entry automatically wets food');
assert.match(source,/food-atlas-v5\.png/,'Uses the new food atlas');
assert.match(source,/texture\.repeat\.set\(\.25,\.5\)/,'Uses a 4-by-2 atlas');
Object.assign(context,{food:{visible:false},gate:{dot:{},shutter:{}},cardia:{dot:{},shutter:{}},setFoodDepthTest(){}});
Object.assign(context,{camera:{position:{copy(){}}},route:{getPointAt:u=>u},orient(){}});
Object.assign(context.state,{phase:'vomited',back:2,identified:true,finished:true});
hints.length=0;
vm.runInContext(functionSource('restartInStomach','travel')+'restartInStomach()',context);
assert.equal(context.state.phase,'explore');
assert.deepEqual(hints.map(({text})=>text),['食物吐出来了。我们回到刚才的地方，再试一次。']);
assert.equal(context.state.back,0);
assert.equal(context.state.foodStage,'bolus');
assert.equal(context.state.fluid,true);
console.log('PASS: one-click mixing, auto-wetting, repeated clicks, pointer release, identification, exit, atlas');
