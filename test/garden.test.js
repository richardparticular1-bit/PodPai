const {test}=require('node:test'),assert=require('node:assert/strict'),g=require('../garden');
test('garden paths avoid the lake, seats remain accessible and audio fades with distance',()=>{
 const a={x:.3,y:.57},b={x:.85,y:.57},path=g.route(a,b);assert.ok(path.length>1);let p=a;for(const next of path){assert.ok(g.clear(p,next));p=next;}assert.deepEqual(p,b);
 assert.equal(g.route(a,{x:.6,y:.57}).length,0);assert.deepEqual(g.safe(a,{x:.6,y:.57}),a);
 for(const [x,y] of g.seats)assert.ok(g.route({x:.175,y:.35},{x,y}).length);
 assert.equal(g.gain(a,a),1);assert.equal(g.gain(a,b),0);assert.ok(g.gain(a,{x:.46,y:.57})>0&&g.gain(a,{x:.46,y:.57})<1);
});
test('objects have exclusive holders, cooperative capacity, proximity checks and release',()=>{
 const os=g.createObjects(),p={moved:true,wx:.3,wy:.52};
 assert.ok(g.claim(os,'a','ball',p));assert.equal(g.claim(os,'b','ball',p),false);assert.equal(g.claim(os,'a','toy',{moved:true,wx:.39,wy:.70}),false);
 g.release(os,'a');assert.ok(g.claim(os,'b','ball',p));
 const near={moved:true,wx:.77,wy:.60};assert.ok(g.claim(os,'a','cart',near));assert.ok(g.claim(os,'c','cart',near));assert.equal(g.claim(os,'d','cart',near),false);
 g.release(os,'a');assert.deepEqual(os[2].holders,['c']);assert.equal(g.claim(os,'d','cart',p),false);
});
