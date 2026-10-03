const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('delayed garden acknowledgements preserve newer local movement; corrections still apply',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../client.html'),'utf8');
 const handler=html.slice(html.indexOf('async function onMsg(msg){'));
 const end=handler.indexOf("if(msg.type==='move'&&msg.from===myId&&currentRoom==='garden')");
 const line=handler.slice(end).split('\n')[0];
 const me={wx:.2,wy:.35,moved:true};
 const context=vm.createContext({players:{self:me},myId:'self',currentRoom:'garden'});
 vm.runInContext(`async function receive(msg){${line}}`,context);
 const pending=[];
 // Five newer frames are predicted before each server response arrives.
 for(let frame=0;frame<60;frame++){
  me.wx+=.001;
  pending.push({type:'move',from:'self',wx:me.wx,wy:me.wy,accepted:true});
  if(pending.length>5){const before=me.wx;await context.receive(pending.shift());assert.equal(me.wx,before);}
 }
 const final=me.wx;
 for(const ack of pending)await context.receive(ack);
 assert.equal(me.wx,final);
 await context.receive({type:'move',from:'self',wx:.21,wy:.36,accepted:false});
 assert.equal(me.wx,.21);assert.equal(me.wy,.36);
 // Movement caused by the other carrier remains authoritative.
 await context.receive({type:'move',from:'self',wx:.22,wy:.37});
 assert.equal(me.wx,.22);assert.equal(me.wy,.37);
});
