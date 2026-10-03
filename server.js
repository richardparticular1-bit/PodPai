/**
 * PODPAI CAST — Servidor WebSocket + HTTP
 * Serve client.html, manifest.json, sw.js, icons
 * Deploy: Render.com
 */
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const movement=require('./movement');
const studioMotion=require('./studio-motion');
const garden=require('./garden'),gardenObjects=garden.createObjects();

const episodeStorage=require('./episode-storage').createEpisodeStorage();

const PORT = process.env.PORT || 3001;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: clients.size, uptime: process.uptime() }));
    return;
  }

  // Serve static files
  const fileMap = {
    '/':            'client.html',
    '/index.html':  'client.html',
    '/manifest.json':'manifest.json',
    '/sw.js':       'sw.js',
    '/admin.js':    'admin.js',
    '/movement.js': 'movement.js',
    '/studio-motion.js': 'studio-motion.js',
    '/experience.js': 'experience.js',
    '/garden.js':'garden.js',
    '/garden-view.js':'garden-view.js',
    '/episodes.js': 'episodes.js',
    '/tus.min.js': 'node_modules/tus-js-client/dist/tus.min.js',
    '/icon-192.png':'icon-192.png',
    '/icon-512.png':'icon-512.png',
  };

  const fileName = fileMap[url];
  if (!fileName) { res.writeHead(404); res.end('Not found'); return; }

  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(`${fileName} not found`); return; }

  const ext = path.extname(fileName);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ['client.html','admin.js','episodes.js','movement.js','studio-motion.js','experience.js','garden.js','garden-view.js','sw.js'].includes(fileName) ? 'no-cache' : 'public, max-age=86400',
  });
  fs.createReadStream(filePath).pipe(res);
});

// ── WEBSOCKET ────────────────────────────────────────────────
const wss = new WebSocketServer({ server, maxPayload: 65536 });
const clients = new Map();
const removedIds = new Set();
const authFailures = new Map();
const adminPassword = process.env.ADMIN_PASSWORD || '';
let recording = null;
const snapshot = (id,c) => ({id,name:c.name,avatar:c.avatar,color:c.color,seat:c.seat,wx:c.wx,wy:c.wy,moved:c.moved,handRaisedAt:c.handRaisedAt||null,listener:c.listener,isAdmin:c.isAdmin,adminMuted:c.adminMuted});
function recordingState(){return {type:'recording_state',recording};}
function endRecording(id){if(recording?.by===id){recording=null;broadcast(recordingState());}}

function send(ws, data)        { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(data, skip, room=clients.get(data.from||data.id||skip)?.room||'studio') { for (const [id, c] of clients) if (id !== skip&&(c.room||'studio')===room) send(c.ws, data); }
function sendTo(id, data)      { const c = clients.get(id); if (c) send(c.ws, data); }
function gardenState(){broadcast({type:'garden_state',objects:gardenObjects,time:Date.now()},null,'garden');}
function dropObjects(id){garden.release(gardenObjects,id);gardenState();}

wss.on('connection', (ws,req) => {
  let myId = null;
  ws.alive=true;
  ws.on('pong',()=>{ws.alive=true;});
  const address=req.socket.remoteAddress;


  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
    const reject=message=>send(ws,{type:'admin_error',requestType:msg.type,message});

    if (msg.type === 'join') {
      if(myId)return;
      if(typeof msg.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(msg.id)||clients.has(msg.id)){ws.close(1008,'Invalid or duplicate identity');return;}
      if(removedIds.has(msg.id)){send(ws,{type:'removed',message:'Você foi removido desta sessão.'});ws.close(4003,'Removed');return;}
      const room=['backstage','garden'].includes(msg.room)?msg.room:'studio';
      const occupied=new Set([...clients.values()].filter(c=>(c.room||'studio')===room&&!c.moved).map(c=>c.seat));
      const seat=msg.listener===true?null:Array.from({length:8},(_,i)=>i).find(i=>!occupied.has(i));
      if(msg.listener!==true&&[...clients.values()].filter(c=>!c.listener&&(c.room||'studio')===room).length>=8){send(ws,{type:"room_full",message:"Este ambiente está cheio. Entre como ouvinte."});ws.close(1008,"Room full");return;}
      const entry=studioMotion.spawn([...clients.values()].filter(c=>(c.room||'studio')===room));
      myId = msg.id;
      clients.set(myId, {ws,seat,name:String(msg.name||'Convidado').slice(0,32),avatar:Number.isInteger(msg.avatar)&&msg.avatar>=0&&msg.avatar<8?msg.avatar:0,color:/^#[0-9a-f]{6}$/i.test(msg.color)?msg.color:'#b896da',wx:entry.x,wy:entry.y,moved:msg.listener!==true,listener:msg.listener===true,isAdmin:false,adminMuted:false});
      clients.get(myId).room=room;
      if(room==='garden')Object.assign(clients.get(myId),{wx:.175,wy:.35});
      const existing = [...clients.entries()]
        .filter(([id,c]) => id !== myId&&(c.room||'studio')===room)
        .map(([id, c]) => snapshot(id,c));
      send(ws, { type: 'room_state', room, players: existing, self:snapshot(myId,clients.get(myId)), recording:room==='studio'?recording:null });
      broadcast({ type: 'join', from: myId, ...snapshot(myId,clients.get(myId)) }, myId);
      if(room==='garden')gardenState();
      console.log(`[+] Participant joined | ${clients.size} online`);
    }
    else if(!myId||clients.get(myId)?.ws!==ws)return;
    else if(msg.type==='change_room'){
      const c=clients.get(myId),room=msg.room;
      const destinations={studio:['backstage'],backstage:['studio','garden'],garden:['backstage']};
      if(!destinations[c.room]?.includes(room)){reject('Esta porta não leva a esse ambiente.');return;}
      if(room===c.room)return;
      if(recording?.by===myId){reject('Encerre a gravação antes de trocar de ambiente.');return;}
      const doorX=c.room==='backstage'&&room==='garden'?.825:.175;
      if(!c.listener&&(!c.moved||Math.abs(c.wx-doorX)>.08||Math.abs(c.wy-.35)>.08)){reject('Aproxime-se da porta.');return;}
      const others=[...clients.entries()].filter(([id,p])=>id!==myId&&(p.room||'studio')===room);
      if(!c.listener&&others.filter(([,p])=>!p.listener).length>=8){reject('Este ambiente está cheio. Aguarde uma vaga.');return;}
      broadcast({type:'leave',from:myId},myId,c.room);
      dropObjects(myId);
      const origin=c.room;c.room=room;c.handRaisedAt=null;c.moved=!c.listener;
      c.seat=c.listener?null:Array.from({length:8},(_,i)=>i).find(i=>!others.some(([,p])=>!p.moved&&p.seat===i));
      Object.assign(c,{wx:origin==='garden'?.825:.175,wy:.35});
      send(ws,{type:'room_state',room,players:others.map(([id,p])=>snapshot(id,p)),self:snapshot(myId,c),recording:room==='studio'?recording:null});
      broadcast({type:'join',from:myId,...snapshot(myId,c)},myId);
      if(room==='garden')gardenState();
    }
    else if(msg.type==='garden_object'){
      const c=clients.get(myId);if(c.room!=='garden'||c.listener)return;
      if(msg.action==='drop'){dropObjects(myId);return;}
      if(msg.action!=='take')return;
      if(!c.moved||!garden.claim(gardenObjects,myId,msg.id,c)){reject('Aproxime-se de um objeto livre. Cada pessoa segura apenas um objeto.');return;}
      gardenState();
    }
    else if(msg.type==='cloud_request'){
      const c=clients.get(myId);
      const reply=(result,error)=>send(ws,{type:'cloud_result',requestId:msg.requestId,result,error});
      if(typeof msg.requestId!=='string'||msg.requestId.length>80)return;
      if(!c.isAdmin){reply(null,'Esta ação exige acesso de administrador.');return;}
      if((c.cloudPending||0)>=4){reply(null,'Aguarde as operações em andamento.');return;}
      c.cloudPending=(c.cloudPending||0)+1;
      episodeStorage.request(msg.action,msg.input||{}).then(result=>{
        if(clients.get(myId)===c&&c.isAdmin)reply(result);
      }).catch(error=>reply(null,error.message)).finally(()=>c.cloudPending--);
    }
    else if(msg.type==='admin_login'){

      if(!adminPassword){reject('Configure ADMIN_PASSWORD no Render para habilitar a administração.');return;}
      const now=Date.now();
      for(const [key,value] of authFailures)if(value.until<now)authFailures.delete(key);
      const failure=authFailures.get(address);
      if(failure?.count>=5){reject('Muitas tentativas. Aguarde um minuto.');return;}
      const supplied=typeof msg.password==='string'?msg.password:'';
      const digest=value=>crypto.createHash('sha256').update(value).digest();
      if(!crypto.timingSafeEqual(digest(supplied),digest(adminPassword))){
        if(authFailures.size<1000||authFailures.has(address))authFailures.set(address,{count:(failure?.count||0)+1,until:now+60000});
        reject('Senha incorreta.');return;
      }
      authFailures.delete(address);clients.get(myId).isAdmin=true;
      send(ws,{type:'admin_authenticated'});broadcast({type:'participant_role',id:myId,isAdmin:true});
    }
    else if(msg.type==='admin_action'){
      if(!clients.get(myId).isAdmin){reject('Esta ação exige acesso de administrador.');return;}
      if(msg.action==='mute_all'){
        for(const [id,c] of clients)if(c.room===clients.get(myId).room&&!c.isAdmin&&!c.listener){c.adminMuted=true;broadcast({type:'participant_moderation',id,adminMuted:true});}
        return;
      }
      const target=clients.get(msg.target);
      if(!target||target.room!==clients.get(myId).room||msg.target===myId||target.isAdmin){reject('Selecione outro participante que não seja administrador.');return;}
      if(msg.action==='approve'){
        target.handRaisedAt=null;target.adminMuted=false;
        broadcast({type:'hand_state',id:msg.target,handRaisedAt:null});
        broadcast({type:'participant_moderation',id:msg.target,adminMuted:false});
      }else if(msg.action==='mute'||msg.action==='unmute'){
        target.adminMuted=msg.action==='mute';
        broadcast({type:'participant_moderation',id:msg.target,adminMuted:target.adminMuted});
      }else if(msg.action==='remove'){
        if(removedIds.size<10000)removedIds.add(msg.target);
        send(target.ws,{type:'removed',message:'Você foi removido da sala pelo administrador.'});
        dropObjects(msg.target);clients.delete(msg.target);broadcast({type:'leave',from:msg.target},null,target.room);endRecording(msg.target);
        target.ws.close(4003,'Removed by administrator');
      }
    }
    else if(msg.type==='recording_start'){
      if(clients.get(myId).room!=='studio'){reject('A gravação está disponível no estúdio.');return;}
      if(!clients.get(myId).isAdmin){reject('Somente administradores podem gravar.');return;}
      if(recording){reject('Já existe uma gravação em andamento.');return;}
      recording={by:myId,name:clients.get(myId).name,startedAt:Date.now(),mode:msg.mode==='video'?'video':'audio'};
      broadcast(recordingState());
    }
    else if(msg.type==='recording_stop'){
      if(recording?.by!==myId){reject('Somente quem iniciou pode encerrar a gravação.');return;}
      endRecording(myId);
    }
    else if(msg.type==='hand_raise'){
      const c=clients.get(myId);if(c.listener)return;
      c.handRaisedAt=msg.raised?(c.handRaisedAt||Date.now()):null;
      broadcast({type:'hand_state',id:myId,handRaisedAt:c.handRaisedAt});
    }
    else if(msg.type==='sit'||msg.type==='stand'){
      const c=clients.get(myId);if(c.listener)return;
      if(msg.type==='sit'){
        if(c.room==='garden'&&gardenObjects.some(o=>o.holders.includes(myId))){reject('Solte o objeto antes de sentar.');return;}
        if(!Number.isInteger(msg.seat)||msg.seat<0||msg.seat>7)return;
        if(c.room==='garden'&&garden.distance(garden.point(c),{x:garden.seats[msg.seat][0],y:garden.seats[msg.seat][1]})>100){reject('Aproxime-se do assento.');return;}
        if([...clients.entries()].some(([id,p])=>id!==myId&&p.room===c.room&&!p.listener&&!p.moved&&p.seat===msg.seat)){reject('Esta poltrona já está ocupada.');return;}
        c.seat=msg.seat;c.moved=false;
      }else{
        const chairs=[[.5,.36],[.31,.43],[.69,.43],[.33,.72],[.67,.72],[.5,.79],[.17,.60],[.83,.60]];
        if(!c.moved){[c.wx,c.wy]=(c.room==='garden'?garden.seats:chairs)[c.seat];c.moved=true;}
      }
      broadcast({type:'seat_state',...snapshot(myId,c)});
    }
    else if(msg.type==='move'){
      const c=clients.get(myId);
      if(c.listener||msg.space!=='normalized'||!Number.isFinite(msg.wx)||!Number.isFinite(msg.wy))return;
      const position=movement.clamp(msg.wx,msg.wy);
      if(c.room==='garden'){
        const from=garden.point(c),held=gardenObjects.find(o=>o.holders.includes(myId));
        let target=garden.safe(from,position);
        const maxStep=145*Math.min(.25,Math.max(.065,(Date.now()-(c.lastGardenMove||Date.now()))/1000));
        const d=garden.distance(from,target);if(d>maxStep){const f=maxStep/d;target={x:from.x+(target.x-from.x)*f,y:from.y+(target.y-from.y)*f};}
        if(held?.required>1){
          if(held.holders.length<held.required)target=from;
          const dx=target.x-from.x,dy=target.y-from.y;
          const members=held.holders.map(id=>[id,clients.get(id)]);
          if(!garden.clear(held,{x:held.x+dx,y:held.y+dy})||members.some(([,p])=>!p||garden.distance(garden.point(p),held)>160||!garden.clear(garden.point(p),{x:p.wx+dx,y:p.wy+dy})||p.wx+dx<.1||p.wx+dx>.9||p.wy+dy<.32||p.wy+dy>.84))target=from;
          else if(target!==from){held.x+=dx;held.y+=dy;for(const [id,p] of members)if(id!==myId){p.wx+=dx;p.wy+=dy;broadcast({type:'move',from:id,wx:p.wx,wy:p.wy,moved:true,space:'normalized'},null,'garden');}}
        }else if(held){held.x=target.x;held.y=target.y;}
        Object.assign(c,{wx:target.x,wy:target.y,moved:true,lastGardenMove:Date.now()});
        broadcast({type:'move',from:myId,wx:c.wx,wy:c.wy,moved:true,space:'normalized'},null,'garden');if(held)gardenState();return;
      }
      Object.assign(c,{wx:position.x,wy:position.y,moved:true});
      broadcast({type:'move',from:myId,wx:c.wx,wy:c.wy,moved:true,space:'normalized'},myId);
    }
    else if (msg.type === 'chat' && myId) {
      if(typeof msg.text!=='string')return;
      broadcast({ type: 'chat', from: myId, text: msg.text.slice(0,500) }, myId);
    }
    else if (msg.type === 'skill' && myId) {
      if(!Number.isInteger(msg.cardId)||msg.cardId<0||msg.cardId>4||!Number.isFinite(msg.wx)||!Number.isFinite(msg.wy))return;
      broadcast({ type: 'skill', from: myId, cardId: msg.cardId, wx: msg.wx, wy: msg.wy }, myId);
    }
    else if (['offer','answer','ice-candidate'].includes(msg.type) && myId) {
      if(clients.get(msg.to)?.room!==clients.get(myId).room)return;
      sendTo(msg.to, {type:msg.type,from:myId,sdp:msg.sdp,candidate:msg.candidate});
    }
  });

  ws.on('close', () => {
    if (!myId) return;
    const c = clients.get(myId);
    if (c?.ws===ws) { dropObjects(myId);clients.delete(myId);broadcast({ type: 'leave', from: myId },null,c.room);endRecording(myId);console.log(`[-] Participant left | ${clients.size} online`); }
  });

  ws.on('error', () => {});
});

// Release seats when a device disappears without a clean close frame.
const heartbeat=setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
},30000);
wss.on('close',()=>clearInterval(heartbeat));
server.listen(PORT, () => console.log(`🎙️  PODPAI CAST — porta ${server.address().port}`));
