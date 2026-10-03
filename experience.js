// Seating and moderation are confirmed by the server.
const dock=document.createElement('div');dock.id='studio-controls';
dock.innerHTML='<div class="movement-controls"><button id="stand-button" type="button">Levantar</button><select id="seat-choice" aria-label="Poltrona livre"></select><button id="sit-button" type="button">Sentar</button><button id="climb-button" type="button">Subir na mesa</button></div><button id="raise-button" type="button">✋ Pedir a palavra</button><div class="mobile-actions"><button id="mobile-mic" type="button">Microfone</button><button id="mobile-chat" type="button">Chat</button></div>';
document.getElementById('bottom').before(dock);dock.prepend(document.getElementById('jzone'));
document.getElementById('mobile-mic').onclick=()=>toggleMic();
document.getElementById('mobile-chat').onclick=()=>document.getElementById('btn-panel').click();
let seatingPending=false;
function requestSeat(message){cancelWalk();if(seatingPending||!connected())return;seatingPending=true;movementDirty=false;joy.active=false;joy.dx=0;joy.dy=0;Object.keys(keys).forEach(k=>keys[k]=false);wsSend(message);}
document.getElementById('stand-button').onclick=()=>requestSeat({type:'stand'});
document.getElementById('sit-button').onclick=()=>walkToChair(Number(document.getElementById('seat-choice').value));
document.getElementById('raise-button').onclick=()=>wsSend({type:'hand_raise',raised:!players[myId]?.handRaisedAt});
document.getElementById('climb-button').onclick=()=>{const me=players[myId];if(!me)return;me.climbed=!me.climbed;wsSend({type:'move',space:'normalized',wx:me.wx,wy:me.wy,climbed:me.climbed});showToast(me.climbed?'Você subiu na mesa.':'Você desceu da mesa.');};
canvas.addEventListener('click',e=>{
  if(!running||players[myId]?.listener)return;
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(x>.115&&x<.235&&y>.07&&y<.32){exitThroughDoor();return;}
  if(Math.abs(x-.82)<.10&&y>.34&&y<.52){const me=players[myId];if(me?.moved){me.drinkUntil=performance.now()+2200;showToast('Você pegou água ou café.');}return;}
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
  const climb=document.getElementById('climb-button');climb.disabled=!me||me.listener||!me.moved;climb.textContent=me?.climbed?'Descer da mesa':'Subir na mesa';
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
const exitButton=document.createElement('button');exitButton.id='exit-studio';exitButton.type='button';exitButton.textContent='Sair do podcast';exitButton.onclick=exitThroughDoor;dock.append(exitButton);
function nearDoor(){const p=players[myId];return !!p&&(p.listener||(p.moved&&Math.abs(p.wx-.175)<.08&&Math.abs(p.wy-.35)<.08));}
function exitThroughDoor(){
 if(!running)return;
 if(!nearDoor()){showToast('Caminhe até a porta à esquerda para sair.');return;}
 if(recorder||recordPending||recordStarting||pendingUploads||unsavedParts){showToast('Finalize a gravação e conclua os envios antes de sair.');if(!document.getElementById('admin-dialog').open)document.getElementById('admin-dialog').showModal();return;}
 intentionalExit=true;running=false;localStream?.getTracks().forEach(t=>t.stop());Object.keys(peers).forEach(cleanPeer);ws?.close(1000,'Left studio');wakeLock?.release();location.reload();
}
setInterval(()=>{exitButton.disabled=!running;exitButton.title=nearDoor()?'Desligar o microfone e voltar à entrada':'Caminhe até a porta à esquerda';exitButton.classList.toggle('at-door',nearDoor());},250);
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
function cancelWalk(){walkPlan=null;}
function startWalk(target,seat=null){
 const me=players[myId];if(!me||me.listener||!connected()||seatingPending)return;
 document.activeElement?.blur();resetMovementInput();
 const route=StudioMotion.route(StudioMotion.point(me),target);
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
