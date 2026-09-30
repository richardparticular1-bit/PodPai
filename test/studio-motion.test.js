const {test}=require('node:test');
const assert=require('node:assert/strict');
const motion=require('../studio-motion');
test('eight arrivals have separate entrance positions and a released position can be reused',()=>{
 const people=[];
 for(let i=0;i<8;i++){const p=motion.spawn(people);assert.ok(p.x>=.1&&p.x<=.9&&p.y>=.32&&p.y<=.84);assert.ok(people.every(q=>Math.hypot((p.x-q.wx)/.085,(p.y-q.wy)/.105)>=1));people.push({moved:true,wx:p.x,wy:p.y});}
 people.shift();assert.deepEqual(motion.spawn(people),{x:.175,y:.35});
});
test('tap paths route around the table and arrive without overshooting at different frame rates',()=>{
 const from={x:.175,y:.35},to={x:.67,y:.72},path=motion.route(from,to);assert.ok(path.length>1);
 let previous=from;for(const point of path){assert.ok(motion.clear(previous,point));previous=point;}
 assert.deepEqual(path.at(-1),to);
 for(const fps of [30,60]){let p=from,index=0;for(let i=0;i<fps*20&&index<path.length;i++){p=motion.toward(p,path[index],1/fps);if(p.arrived)index++;}assert.equal(index,path.length);assert.equal(p.x,to.x);assert.equal(p.y,to.y);}
 const middle=motion.route(from,{x:.5,y:.57}).at(-1);assert.ok(Math.hypot((middle.x-.5)/.245,(middle.y-.57)/.135)>1);
});
test('gait stops at rest, seated legs remain planted, reactions and reduced motion are distinct',()=>{
 const walking=motion.pose({walking:true,phase:Math.PI/2});assert.ok(walking.leftLeg>0);assert.ok(walking.rightLeg<0);
 assert.equal(motion.pose({walking:false,phase:Math.PI/2}).leftLeg,0);
 assert.equal(motion.pose({walking:true,seated:true,phase:Math.PI/2}).leftLeg,0);
 assert.ok(motion.pose({hand:true}).rightArm<-2);
 const a=motion.pose({reaction:2,time:100}),b=motion.pose({reaction:2,time:200});assert.notEqual(a.leftArm,b.leftArm);
 const reduced=motion.pose({walking:true,phase:Math.PI/2,reaction:1,reduced:true});assert.equal(reduced.leftLeg,0);assert.equal(reduced.bob,0);assert.equal(reduced.lean,0);
});
