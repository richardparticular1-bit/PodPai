const {test}=require('node:test');
const assert=require('node:assert/strict');
const movement=require('../movement');
test('client loop sends normalized movement, flushes the last position and pauses input',()=>{
  const vm=require('node:vm'),html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../client.html'),'utf8');
  const source=html.match(/function gameLoop\(ts\)\{[\s\S]*?\n\}/)[0],messages=[];
  const ctx=vm.createContext({StudioMovement:movement,players:{me:{seat:0,moved:false}},myId:'me',CHAIRS:[[.5,.36]],running:true,entryMode:'part',lastMovementFrame:0,lastBC:0,movementDirty:false,typing:false,input:1,
    currentRoom:'studio',tickEnergy:()=>{},requestAnimationFrame:()=>{},updParts:()=>{},jdx:()=>0,jdy:()=>0,wsSend:m=>messages.push(m)});
  vm.runInContext('function isTyping(){return typing;}function kd(){return{x:input,y:0};}'+source,ctx);
  vm.runInContext('gameLoop(20);input=0;gameLoop(80);',ctx);
  assert.equal(messages.length,1);assert.equal(messages[0].space,'normalized');assert.ok(messages[0].wx>.5&&messages[0].wx<.51);
  vm.runInContext('typing=true;input=1;gameLoop(160);',ctx);assert.equal(messages.length,1);
});
test('movement speed is independent of frame rate and stays inside the studio',()=>{
  const simulate=fps=>{let p={x:.5,y:.5};for(let i=0;i<fps;i++)p=movement.step(p.x,p.y,1,1,1/fps);return p;};
  const a=simulate(30),b=simulate(60);assert.ok(Math.abs(a.x-b.x)<1e-10);assert.ok(Math.abs(a.y-b.y)<1e-10);
  assert.deepEqual(movement.clamp(-50,999),{x:.1,y:.84});
});
test('actual client projection preserves relative positions across phone and desktop',()=>{
  const vm=require('node:vm'),html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../client.html'),'utf8');
  const source=html.match(/function ppos\(p\)\{[\s\S]*?\n\}/)[0];
  for(const [width,height] of [[320,500],[390,604],[1280,720],[740,220]]){
    const ctx=vm.createContext({CW:width,CH:height,CHAIRS:[[.5,.36]],StudioMovement:movement});vm.runInContext(source,ctx);
    const p=vm.runInContext('ppos({moved:true,wx:.7,wy:.6})',ctx);assert.equal(p.sx/width,.7);assert.equal(p.sy/height,.6);
    const edge=vm.runInContext('ppos({moved:true,wx:100,wy:-100})',ctx),scale=Math.min(width/700,height/360,1.3);
    assert.ok(edge.sx+66*scale<=width);assert.ok(edge.sy-100*scale>=0);
  }
});
