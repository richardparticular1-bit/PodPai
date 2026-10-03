// Seating and moderation are confirmed by the server.
const dock=document.createElement('div');dock.id='studio-controls';
dock.innerHTML='<div class="movement-controls"><button id="stand-button" type="button">Levantar</button><select id="seat-choice" aria-label="Poltrona livre"></select><button id="sit-button" type="button">Sentar</button></div><button id="raise-button" type="button">✋ Pedir a palavra</button><div class="mobile-actions"><button id="mobile-mic" type="button">Microfone</button><button id="mobile-chat" type="button">Chat</button></div>';
document.getElementById('bottom').before(dock);dock.prepend(document.getElementById('jzone'));
document.getElementById('mobile-mic').onclick=()=>toggleMic();
document.getElementById('mobile-chat').onclick=()=>document.getElementById('btn-panel').click();
let seatingPending=false;
function requestSeat(message){cancelWalk();if(seatingPending||!connected())return;seatingPending=true;movementDirty=false;joy.active=false;joy.dx=0;joy.dy=0;Object.keys(keys).forEach(k=>keys[k]=false);wsSend(message);}
document.getElementById('stand-button').onclick=()=>requestSeat({type:'stand'});
document.getElementById('sit-button').onclick=()=>walkToChair(Number(document.getElementById('seat-choice').value));
document.getElementById('raise-button').onclick=()=>wsSend({type:'hand_raise',raised:!players[myId]?.handRaisedAt});
canvas.addEventListener('click',e=>{
  if(!running||players[myId]?.listener)return;
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(x>.115&&x<.235&&y>.07&&y<.32){exitThroughDoor();return;}
  if(currentRoom==='backstage'&&x>.765&&x<.885&&y>.07&&y<.32){exitThroughDoor('garden');return;}
  const seat=CHAIRS.findIndex(([cx,cy])=>Math.abs(x-cx)<.04&&Math.abs(y-cy)<.055);
  if(seat>=0)walkToChair(seat);else if(y>=.30)startWalk({x,y});
});
const host=document.createElement('section');host.id='host-controls';
host.innerHTML='<h2>Painel do apresentador</h2><button type="button" id="mute-all">Silenciar participantes</button><h3>Pedidos de palavra</h3><div id="hand-queue"></div><h3>Participantes</h3><div id="host-participants"></div>';
document.getElementById('record-controls').prepend(host);
document.getElementById('mute-all').onclick=()=>wsSend({type:'admin_action',action:'mute_all'});
host.addEventListener('click',e=>{
 const b=e.target.closest('[data-admin-action]');if(!b||!isAdmin)return;
 if(b.dataset.adminAction==='remove'){
   pendingRemoval=b.dataset.target;document.getElementById('remove-description').textContent='Remover '+(players[pendingRemoval]?.name||'participante')+' desta sessão?';document.getElementById('remove-dialog').showModal();
 }else wsSend({type:'admin_action',action:b.dataset.adminAction,target:b.dataset.target});
});
const originalParts=updParts;
updParts=function(){originalParts();refreshExperience();};
function refreshExperience(){
 const me=players[myId],select=document.getElementById('seat-choice'),previous=select.value;
 select.replaceChildren();
 CHAIRS.forEach((_,i)=>{const occupant=Object.values(players).find(p=>!p.listener&&!p.moved&&p.seat===i);const o=document.createElement('option');o.value=i;o.textContent=String(i+1).padStart(2,'0')+(occupant?' · ocupada':' · livre');o.disabled=!!occupant;select.append(o);});
 if([...select.options].some(o=>o.value===previous&&!o.disabled))select.value=previous;
 else select.value=[...select.options].find(o=>!o.disabled)?.value||'';
 document.getElementById('stand-button').disabled=!me||me.listener||me.moved;
 document.getElementById('sit-button').disabled=!me||me.listener||select.value==='';
 const raise=document.getElementById('raise-button');raise.disabled=!me||me.listener;raise.textContent=me?.handRaisedAt?'✋ Cancelar pedido':'✋ Pedir a palavra';raise.setAttribute('aria-pressed',!!me?.handRaisedAt);
 document.getElementById('host-participants').innerHTML=Object.values(players).map(p=>'<div class="host-person"><strong>'+esc(p.name)+'</strong>'+adminParticipantControls(p)+'</div>').join('');
 const queue=Object.values(players).filter(p=>p.handRaisedAt).sort((a,b)=>a.handRaisedAt-b.handRaisedAt);
 if(isAdmin)document.getElementById('btn-admin').textContent='👑 Administrar'+(queue.length?' · ✋ '+queue.length:'');
 document.getElementById('hand-queue').innerHTML=queue.length?queue.map(p=>'<div class="host-person">✋ '+esc(p.name)+(p.isAdmin?'':' <button type="button" data-admin-action="approve" data-target="'+p.id+'">Liberar palavra</button>')+'</div>').join(''):'Nenhum pedido pendente.';
}
const originalAdminMessage=handleAdminMessage;
handleAdminMessage=function(msg){
 if(msg.type==='admin_error'||msg.type==='room_state'){seatingPending=false;cancelWalk();}
 if(msg.type==='seat_state'){if(players[msg.id])Object.assign(players[msg.id],msg);if(msg.id===myId){seatingPending=false;movementDirty=false;joy.active=false;joy.dx=0;joy.dy=0;Object.keys(keys).forEach(k=>keys[k]=false);}updParts();return true;}
 if(msg.type==='hand_state'){if(isAdmin&&msg.handRaisedAt&&!players[msg.id]?.handRaisedAt){showToast((players[msg.id]?.name||'Participante')+' pediu a palavra ✋');}if(players[msg.id])players[msg.id].handRaisedAt=msg.handRaisedAt;updParts();return true;}
 return originalAdminMessage(msg);
};
const style=document.createElement('style');style.textContent=`
#studio-controls{display:flex;align-items:center;gap:12px;flex-shrink:0;min-height:88px}#studio-controls #jzone{position:relative;left:auto;bottom:auto;flex:0 0 84px}#studio-controls button,#studio-controls select{background:#241c34;color:#f1e8ff;border:1px solid #675078;border-radius:10px;padding:10px;min-height:42px}#studio-controls button:disabled{opacity:.45}.movement-controls{display:flex;align-items:center;gap:8px}.mobile-actions{display:none}.host-person{padding:10px 0;border-bottom:1px solid #ffffff15}.host-person .admin-tools{display:flex;gap:6px;flex-wrap:wrap}.pr meter{width:52px;height:8px}#episode-title,#replay-list input{box-sizing:border-box;width:100%;min-width:0;background:#151020;color:#f2e9ff;border:1px solid #675078;border-radius:8px;padding:10px;margin:8px 0}#replay-list>div{border-bottom:1px solid #ffffff20;padding:10px 0}#host-controls h3{font-size:14px;margin:16px 0 8px}body.listener #studio-controls{display:none}
@media(max-width:760px){#studio-controls{display:grid;grid-template-columns:84px 1fr;gap:6px;min-height:94px}#studio-controls #jzone{grid-row:1/3}.movement-controls{gap:4px}.movement-controls select{max-width:100px;font-size:12px}#studio-controls button{padding:6px;font-size:12px;min-height:36px}#raise-button{grid-column:2}.mobile-actions{display:flex;gap:6px;grid-column:1/3}.mobile-actions button{flex:1}#erow{display:none}#topbar #btn-mic,#topbar #btn-panel{display:none}#bottom .rb{min-height:36px;padding:5px}#shell{gap:4px}#studio-controls #jzone{height:76px}#main{min-height:140px}body.listener #topbar #btn-panel{display:block}}
`;document.head.append(style);
refreshExperience();

const titleField=document.createElement('label');titleField.textContent='Título do episódio ';const titleInput=document.createElement('input');titleInput.id='episode-title';titleInput.maxLength=120;titleInput.placeholder='Conversa no PodPai';titleField.append(titleInput);document.getElementById('btn-record').before(titleField);

const originalMicUI=updMicUI;updMicUI=function(){originalMicUI();document.getElementById('mobile-mic').textContent=isMuted?'🔇 Ativar mic':'🎤 Silenciar mic';};updMicUI();

// The door never disconnects someone merely for walking past it.
const exitButton=document.createElement('button');exitButton.id='exit-studio';exitButton.type='button';exitButton.textContent='Ir aos bastidores';exitButton.onclick=exitThroughDoor;dock.append(exitButton);
const gardenButton=document.createElement('button');gardenButton.id='exit-garden';gardenButton.type='button';gardenButton.textContent='Ir ao jardim';gardenButton.hidden=true;gardenButton.onclick=()=>exitThroughDoor('garden');dock.append(gardenButton);
function nearDoor(target){const p=players[myId],x=currentRoom==='backstage'&&target==='garden'?.825:.175;return !!p&&(p.listener||(p.moved&&Math.abs(p.wx-x)<.08&&Math.abs(p.wy-.35)<.08));}
function exitThroughDoor(target){
 if(!running)return;
 const destination=target==='garden'?'garden':currentRoom==='backstage'?'studio':'backstage';
 if(!nearDoor(destination)){showToast(destination==='garden'?'Caminhe até a porta do jardim à direita.':'Caminhe até a porta à esquerda.');return;}
 if(recorder||recordPending||recordStarting||pendingUploads||unsavedParts){showToast('Finalize a gravação e conclua os envios antes de sair.');if(!document.getElementById('admin-dialog').open)document.getElementById('admin-dialog').showModal();return;}
  resetMovementInput();wsSend({type:'change_room',room:destination});
}
function paintBackstage(c){
 const w=CW,h=CH;
 const wall=c.createLinearGradient(0,0,0,h);wall.addColorStop(0,'#35243e');wall.addColorStop(.34,'#604054');wall.addColorStop(1,'#211c30');c.fillStyle=wall;c.fillRect(0,0,w,h);
 c.fillStyle='#221b2a';c.fillRect(0,h*.30,w,h*.70);
 for(let i=0;i<15;i++){c.strokeStyle='#baa08415';c.beginPath();c.moveTo(w*.5+(i-7)*w*.025,h*.30);c.lineTo((i-3)*w*.14,h);c.stroke();}
 pill(c,w*.34,h*.055,w*.35,h*.16,12,'#221c30','#c89b7155');
 c.textAlign='center';c.fillStyle='#f1d5aa';c.font=`800 ${Math.max(15,w*.034)}px Nunito,sans-serif`;c.fillText('BASTIDORES',w*.515,h*.13,w*.31);
 c.font=`600 ${Math.max(9,w*.012)}px Nunito,sans-serif`;c.fillStyle='#d2b9c7';c.fillText('Uma pausa entre boas conversas',w*.515,h*.185,w*.30);
 oval(c,w*.51,h*.65,w*.39,h*.23,'#181522');oval(c,w*.51,h*.63,w*.38,h*.22,'#564352');
 c.strokeStyle='#bc927d55';c.lineWidth=2;c.beginPath();c.ellipse(w*.51,h*.63,w*.36,h*.20,0,0,Math.PI*2);c.stroke();
 // Upholstered three-seat couch, with a back, cushions, arms and feet.
 const x=w*.35,y=h*.28,sw=w*.33,sh=h*.12;
 pill(c,x+sw*.06,y+sh,sw*.05,h*.025,2,'#b38967');pill(c,x+sw*.89,y+sh,sw*.05,h*.025,2,'#b38967');
 pill(c,x,y,sw,sh,12,'#8c657b','#bd92a277');
 for(let i=0;i<3;i++){pill(c,x+sw*(.065+i*.29),y+sh*.1,sw*.27,sh*.58,8,'#a77a8f','#d3a0ac55');pill(c,x+sw*(.065+i*.29),y+sh*.70,sw*.27,sh*.28,5,'#75566d');}
 pill(c,x-sw*.035,y+sh*.35,sw*.09,sh*.68,7,'#63485e');pill(c,x+sw*.945,y+sh*.35,sw*.09,sh*.68,7,'#63485e');
 // Warm floor lamp and framed art make the lounge distinct from the studio.
 const lx=w*.94;studioGlow(c,lx,h*.24,w*.10,'#efba5933');
 pill(c,lx-2,h*.18,4,h*.25,2,'#b49779');oval(c,lx,h*.44,w*.035,h*.012,'#100f19');
 c.fillStyle='#edcca0';c.beginPath();c.moveTo(lx-w*.026,h*.12);c.lineTo(lx+w*.026,h*.12);c.lineTo(lx+w*.045,h*.22);c.lineTo(lx-w*.045,h*.22);c.closePath();c.fill();
 pill(c,w*.70,h*.065,w*.055,h*.14,4,'#201c2b','#bd9a76');oval(c,w*.727,h*.12,w*.016,h*.027,'#bc8c6c');
 drawBackstageShelf(c,w,h);
}
function drawBackstageShelf(c,w,h){
 pill(c,w*.04,h*.09,w*.055,h*.19,4,'#211d2c','#9b7c67');
 for(let i=0;i<5;i++)pill(c,w*(.045+i*.009),h*(.13+(i%2)*.015),w*.006,h*.075,1,['#c99a73','#92769f','#6d9d91'][i%3]);
 pill(c,w*.042,h*.21,w*.05,3,1,'#b29276');
}
function paintGarden(c){
 const w=CW,h=CH;
 const sky=c.createLinearGradient(0,0,0,h*.5);sky.addColorStop(0,'#263e58');sky.addColorStop(1,'#9eb3a1');c.fillStyle=sky;c.fillRect(0,0,w,h);
 oval(c,w*.86,h*.09,w*.018,h*.032,'#ffdf9f');studioGlow(c,w*.86,h*.09,w*.10,'#ffdda033');
 // A sheltered garden at dusk, with the backstage entrance in the facade.
 c.fillStyle='#293e39';c.beginPath();c.moveTo(0,h*.24);c.bezierCurveTo(w*.25,h*.06,w*.50,h*.25,w,h*.13);c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();
 c.fillStyle='#354a3e';c.fillRect(0,h*.30,w,h*.70);
 for(let i=0;i<28;i++){const x=w*i/27;c.fillStyle=i%2?'#bbad8833':'#adac8333';c.fillRect(x,h*.21,w*.006,h*.11);}
 pill(c,0,h*.065,w*.285,h*.255,6,'#514656','#b9997955');
 c.strokeStyle='#c9b39744';c.lineWidth=2;c.beginPath();c.moveTo(0,h*.31);c.lineTo(w*.285,h*.31);c.stroke();
 const lawn=c.createRadialGradient(w*.55,h*.6,0,w*.55,h*.6,w*.65);lawn.addColorStop(0,'#536b4c');lawn.addColorStop(1,'#263d36');c.fillStyle=lawn;c.fillRect(w*.29,h*.31,w*.71,h*.69);
 oval(c,w*.5,h*.65,w*.405,h*.25,'#26352f');oval(c,w*.5,h*.63,w*.385,h*.235,'#918974');oval(c,w*.5,h*.625,w*.369,h*.22,'#aaa18a');
 // Stone paving and a path from the building to the patio.
 pill(c,w*.13,h*.32,w*.09,h*.20,10,'#aaa18a');
 c.strokeStyle='#5c64522b';c.lineWidth=1;
 for(let i=0;i<6;i++){c.beginPath();c.moveTo(w*.25,h*(.47+i*.055));c.lineTo(w*.75,h*(.47+i*.055));c.stroke();}
 function tree(x,y,size){
  pill(c,x-size*.06,y-size*.1,size*.12,size*.48,3,'#67513d');
  oval(c,x,y-size*.25,size*.38,size*.52,'#233f37');oval(c,x-size*.18,y-size*.43,size*.32,size*.40,'#41624b');oval(c,x+size*.18,y-size*.42,size*.28,size*.36,'#526e50');
 }
 tree(w*.94,h*.36,Math.min(w*.15,h*.22));tree(w*.055,h*.52,Math.min(w*.10,h*.18));
 for(let i=0;i<10;i++){const x=w*(.36+i*.056),y=h*(.30+(i%2)*.014);oval(c,x,y,w*.025,h*.033,'#365641');oval(c,x,y-h*.013,w*.004,h*.008,i%2?'#d5a7a5':'#dbc48b');}
 // Warm string lights above the seating area.
 c.strokeStyle='#202e32';c.lineWidth=2;c.beginPath();c.moveTo(w*.31,h*.055);c.quadraticCurveTo(w*.62,h*.22,w*.97,h*.07);c.stroke();
 for(let i=0;i<9;i++){const t=i/8,x=w*(.31+.66*t),y=h*((1-t)*(1-t)*.055+2*(1-t)*t*.22+t*t*.07);studioGlow(c,x,y+5,Math.max(7,w*.013),'#f7d49355');oval(c,x,y+5,2.6,4,'#ffe2a6');}
 pill(c,w*.39,h*.19,w*.23,h*.073,9,'#253b32','#ceb68766');c.textAlign='center';c.font=`800 ${Math.max(12,w*.022)}px Nunito,sans-serif`;c.fillStyle='#f2dfb5';c.fillText('JARDIM PODPAI',w*.505,h*.239,w*.21);
}
style.textContent+=`#surprise-room{position:fixed;inset:0;z-index:50;display:grid;place-items:center;align-content:center;gap:14px;text-align:center;color:#f3e8ff;background:radial-gradient(circle at 50% 30%,#49306d,#140d22 58%,#080611);overflow:hidden}#surprise-room h1{font-size:clamp(24px,5vw,54px);margin:0;text-shadow:0 0 22px #c78cff}#surprise-room p{font-size:clamp(14px,2vw,21px);color:#c9b6dd;margin:0}.surprise-stars{position:absolute;top:12%;font-size:28px;color:#d8b5ff;letter-spacing:10px}.surprise-sign{padding:9px 22px;border:1px solid #d3a6ff88;border-radius:999px;color:#e1b8ff;letter-spacing:6px;font-weight:800}.surprise-lounge{width:min(640px,82vw);height:150px;position:relative;border-bottom:8px solid #8a5bb0;border-radius:50%;background:linear-gradient(#21172f,#171124);box-shadow:0 18px 40px #0008}.surprise-lamp{position:absolute;left:12%;top:12px;font-size:58px;color:#ffd58f}.surprise-sofa{position:absolute;left:34%;top:62px;font-size:52px;letter-spacing:7px;color:#956db8;filter:drop-shadow(0 10px 8px #000)}.surprise-table{position:absolute;right:8%;top:80px;padding:17px 15px;border-radius:50%;background:#9c6d54;color:#ffe2bd;box-shadow:0 10px 0 #4c2f3a;font-size:22px}#return-studio{background:#9b6bd5;color:white;border:0;border-radius:12px;padding:13px 24px;font:700 16px Nunito,sans-serif;cursor:pointer;box-shadow:0 7px 0 #593d83}#return-studio:active{transform:translateY(3px);box-shadow:0 4px 0 #593d83}`;
setInterval(()=>{exitButton.disabled=!running;exitButton.title=nearDoor()?'Atravessar a porta':'Caminhe até a porta à esquerda';exitButton.classList.toggle('at-door',nearDoor());},250);
style.textContent+=`
#studio-controls{min-height:60px;gap:8px;flex-wrap:wrap}#studio-controls #jzone{width:56px;height:56px;flex-basis:56px}#jbase{width:56px;height:56px}#jknob{width:28px;height:28px}#studio-controls button,#studio-controls select{padding:7px 10px;min-height:36px;font-size:12px}.movement-controls{gap:5px}#exit-studio{margin-left:auto}#exit-studio.at-door{border-color:#9edcc2;background:#234238}#bottom{gap:12px}#bottom .rb{min-height:34px;padding:6px 10px}#bottom #erow{width:120px}#shell{gap:8px}#pwrap{padding:10px 14px;max-height:25%;min-height:72px}#ptitle{margin-bottom:5px}#lcount{margin-top:4px}#ewrap{padding:6px 12px}#etitle{display:none}#ecard{padding:7px 9px}#eicon{font-size:18px;margin:0}#ctbar{padding:9px 12px}#cmsgs{padding:10px 14px;gap:8px;flex:1;min-height:100px}#cinrow{padding:8px}#cwrap{min-height:190px}#rpanel{overflow:hidden}.pr{padding:3px 0}.room-hint{bottom:12px;font-size:10px}
@media(max-width:760px){#studio-controls{grid-template-columns:56px 1fr;min-height:0;gap:4px}#studio-controls #jzone{height:56px;grid-row:1/3}#studio-controls button{min-height:36px;padding:6px;font-size:11px}#raise-button{grid-column:2}#exit-studio{grid-column:2;margin:0;grid-row:3;justify-self:end;width:104px;z-index:1}.mobile-actions{grid-row:3;padding-right:108px}#cwrap{min-height:160px}#pwrap{max-height:24%}body.listener #studio-controls{display:flex}body.listener #studio-controls>*:not(#exit-studio){display:none}}
`;

style.textContent+=`
#pwrap{min-height:150px;max-height:34%}
@media(max-width:760px){#bottom #rbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;width:100%;overflow:visible}#bottom .rb{min-width:0;width:100%;padding:5px 2px;flex-direction:column;gap:2px;min-height:44px}#bottom .rb span{font-size:9px;white-space:nowrap}#pwrap{min-height:138px;max-height:32%}.movement-controls{min-width:0}.movement-controls select{min-width:0;flex:1}}
`;

// A tap selects a route; keyboard and joystick always take precedence.
let walkPlan=null;
style.textContent+='@media(max-width:760px){#exit-garden:not([hidden]){grid-column:1/3;grid-row:4;width:100%}}body.listener #studio-controls>#exit-garden:not([hidden]){display:block}';
function cancelWalk(){walkPlan=null;}
function startWalk(target,seat=null){
 const me=players[myId];if(!me||me.listener||!connected()||seatingPending)return;
 document.activeElement?.blur();resetMovementInput();
 const route=currentRoom!=='studio'?[StudioMovement.clamp(target.x,target.y)]:StudioMotion.route(StudioMotion.point(me),target);
 if(!route.length){showToast('Escolha outro ponto no chão.');return;}
 walkPlan={route,seat};
}
function walkToChair(seat){
 if(!Number.isInteger(seat)||!CHAIRS[seat])return;
 if(Object.values(players).some(p=>p.id!==myId&&!p.listener&&!p.moved&&p.seat===seat)){showToast('Esta poltrona está ocupada.');return;}
 startWalk({x:CHAIRS[seat][0],y:CHAIRS[seat][1]},seat);
}
function advanceWalk(me,dt){
 if(!walkPlan)return;
 const plan=walkPlan,next=StudioMotion.toward(StudioMotion.point(me),plan.route[0],dt),first=!me.moved;
 Object.assign(me,{wx:next.x,wy:next.y,moved:true});movementDirty=true;if(first)updParts();
 if(next.arrived){plan.route.shift();if(!plan.route.length){walkPlan=null;
   wsSend({type:'move',space:'normalized',wx:me.wx,wy:me.wy});movementDirty=false;
   if(plan.seat!==null)requestSeat({type:'sit',seat:plan.seat});
 }}
}
window.addEventListener('blur',cancelWalk);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelWalk();});
const originalResetInput=resetMovementInput;resetMovementInput=function(){originalResetInput();cancelWalk();};
const audioLabels={new:'Conectando áudio…',connecting:'Conectando áudio…',connected:'Áudio conectado',disconnected:'Áudio interrompido',reconnecting:'Reconectando áudio…',failed:'Falha no áudio',closed:'Áudio desconectado',blocked:'Toque para ouvir'};
function refreshAudioLabels(){
 for(const p of Object.values(players)){
   const el=document.getElementById('audio-state-'+p.id);if(!el)continue;
   const state=p.id===myId?'self':audioStates[p.id]||peers[p.id]?.connectionState||'new';
   const text=p.listener?'Ouvinte':p.id===myId?(localStream?(isMuted?'Seu microfone desligado':'Seu microfone ligado'):'Sem acesso ao microfone'):audioLabels[state]||'Conectando áudio…';
   if(el.textContent!==text)el.textContent=text;
   el.dataset.state=state;el.setAttribute('aria-label',p.name+': '+text);
 }
}
setInterval(refreshAudioLabels,500);
document.getElementById('plist').addEventListener('click',e=>{
 const button=e.target.closest('[data-audio-resume]');if(!button)return;
 document.getElementById('aud-'+button.dataset.audioResume)?.play().then(()=>{audioStates[button.dataset.audioResume]='connected';refreshAudioLabels();}).catch(()=>showToast('O navegador ainda não conseguiu reproduzir o áudio.'));
});
style.textContent+='.audio-state{background:transparent;border:0;text-align:left;padding-top:0;padding-bottom:0;font-size:10px;color:#b5a6c6;flex-basis:100%;padding-left:40px}.audio-state[data-state="connected"]{color:#a6d9bd}.audio-state[data-state="failed"],.audio-state[data-state="disconnected"]{color:#edba92}';
