const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const WebSocket=require('ws');

test('authoritative seating, moderator permissions, removal and recording lifecycle',async t=>{
  const password=randomUUID(),child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,PORT:'0',ADMIN_PASSWORD:password,SUPABASE_URL:'',SUPABASE_SECRET_KEY:''}});
  t.after(()=>child.kill());
  const port=await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{const m=String(b).match(/porta (\d+)/);if(m)resolve(m[1]);});child.on('error',reject);});
  const clients=[];t.after(()=>clients.forEach(c=>c.ws.terminate()));
  async function connect(id,listener=false){
    const ws=new WebSocket(`ws://localhost:${port}`),messages=[];
    ws.on('message',raw=>messages.push(JSON.parse(raw)));
    await once(ws,'open');
    const c={ws,messages,send:m=>ws.send(JSON.stringify(m)),async next(type){
      const until=Date.now()+3000;while(Date.now()<until){const i=messages.findIndex(m=>m.type===type);if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}throw new Error('Missing '+type);
    }};clients.push(c);c.send({type:'join',id,name:id,listener,seat:7,isAdmin:true});return c;
  }
  const admin=await connect('admin'),first=await admin.next('room_state');
  assert.equal(first.self.seat,0);assert.equal(first.self.isAdmin,false);assert.equal(first.self.moved,true);assert.equal(first.self.wx,.175);assert.equal(first.self.wy,.35);
  admin.send({type:'sit',seat:0});await admin.next('seat_state');
  const b=await connect('guest');assert.equal((await b.next('room_state')).self.seat,1);b.send({type:'sit',seat:1});await b.next('seat_state');
  b.send({type:'admin_action',action:'mute',target:'admin'});await b.next('admin_error');
  b.send({type:'cloud_request',requestId:'forbidden',action:'list'});assert.match((await b.next('cloud_result')).error,/administrador/);
  b.send({type:'recording_start'});await b.next('admin_error');
  admin.send({type:'admin_login',password:'wrong'});await admin.next('admin_error');
  admin.send({type:'admin_login',password});await admin.next('admin_authenticated');
  admin.send({type:'admin_action',action:'mute',target:'guest'});assert.equal((await b.next('participant_moderation')).adminMuted,true);
  admin.send({type:'admin_action',action:'unmute',target:'guest'});assert.equal((await b.next('participant_moderation')).adminMuted,false);
  b.send({type:'move',wx:99999,wy:-5000});
  const listener=await connect('listener',true),snapshot=await listener.next('room_state');
  assert.equal(snapshot.self.seat,null);assert.equal(snapshot.players.find(p=>p.id==='guest').seat,1);assert.equal(snapshot.players.find(p=>p.id==='guest').wx,.175);
  b.send({type:'move',space:'normalized',wx:.7,wy:.6});
  const moved=await listener.next('move');assert.equal(moved.wx,.7);assert.equal(moved.wy,.6);assert.equal(moved.from,'guest');
  b.send({type:'move',space:'normalized',wx:8,wy:-5});
  const bounded=await listener.next('move');assert.equal(bounded.wx,.9);assert.equal(bounded.wy,.32);
  listener.send({type:'move',space:'normalized',wx:.4,wy:.5});
  b.send({type:'chat',from:'admin',text:'hello'});assert.equal((await admin.next('chat')).from,'guest');
  admin.send({type:'recording_start',mode:'video'});assert.equal((await listener.next('recording_state')).recording.mode,'video');
  b.send({type:'recording_stop'});await b.next('admin_error');
  b.send({type:'sit',seat:0});await b.next('admin_error');
  b.send({type:'sit',seat:1});assert.equal((await b.next('seat_state')).moved,false);
  b.send({type:'stand'});assert.equal((await b.next('seat_state')).moved,true);
  b.send({type:'sit',seat:1});await b.next('seat_state');
  b.send({type:'hand_raise',raised:true});assert.ok((await b.next('hand_state')).handRaisedAt);
  admin.send({type:'admin_action',action:'mute_all'});assert.equal((await b.next('participant_moderation')).adminMuted,true);
  admin.send({type:'admin_action',action:'approve',target:'guest'});assert.equal((await b.next('hand_state')).handRaisedAt,null);assert.equal((await b.next('participant_moderation')).adminMuted,false);
  const late=await connect('late');const lateState=await late.next('room_state');assert.equal(lateState.recording.by,'admin');assert.equal(lateState.self.seat,2);assert.equal(lateState.players.find(p=>p.id==='guest').wx,.31);assert.equal(lateState.players.find(p=>p.id==='guest').moved,false);assert.equal(lateState.players.find(p=>p.id==='listener').moved,false);
  late.send({type:'sit',seat:2});await late.next('seat_state');
  for(let n=3;n<8;n++){const c=await connect('seat'+n);assert.equal((await c.next('room_state')).self.seat,n);c.send({type:'sit',seat:n});await c.next('seat_state');}
  const full=await connect('full');await full.next('room_full');
  admin.send({type:'admin_action',action:'remove',target:'guest'});await b.next('removed');
  const removed=await connect('guest');await removed.next('removed');
  const replacement=await connect('replacement');assert.equal((await replacement.next('room_state')).self.seat,1);
  // Remaining occupants keep their seat; disconnecting the recorder clears the notice.
  admin.ws.close();assert.equal((await listener.next('recording_state')).recording,null);
  const fresh=await connect('fresh',true);assert.equal((await fresh.next('room_state')).players.find(p=>p.id==='late').seat,2);
});
