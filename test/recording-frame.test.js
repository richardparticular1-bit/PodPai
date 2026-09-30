const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('recording composition is fixed and restores the live canvas even on draw failure',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../admin.js'),'utf8');
 const draw=source.slice(source.indexOf('function recordingPaintFrame(){'),source.indexOf('function startRecordingPart(){'));
 for(const [width,height] of [[390,560],[1440,800]]){
  const calls=[],live={},record=new Proxy({}, {get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});
  const state={ctx:live,CW:width,CH:height,recordingCanvas:{getContext:()=>record},episodeTitle:'Episódio teste',players:{a:{seat:1}},paintStudio:()=>calls.push(['studio',state.CW,state.CH]),drawStudioDoor:()=>{},drawChairs:()=>{},ppos:()=>({sx:100,sy:200}),drawPlayer:()=>{}};
  vm.createContext(state);vm.runInContext(draw,state);state.recordingPaintFrame();
  assert.deepEqual(calls.find(c=>c[0]==='studio'),['studio',1280,680]);
  assert.ok(calls.some(c=>c[0]==='fillText'&&c[1]==='Episódio teste'));
  assert.equal(state.ctx,live);assert.equal(state.CW,width);assert.equal(state.CH,height);
  state.drawPlayer=()=>{throw Error('draw failed')};assert.throws(()=>state.recordingPaintFrame(),/draw failed/);
  assert.equal(state.ctx,live);assert.equal(state.CW,width);assert.equal(state.CH,height);assert.equal(calls.at(-1)[0],'restore');
 }
});
