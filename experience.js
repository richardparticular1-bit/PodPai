// Seating and moderation are confirmed by the server.
const dock=document.createElement('div');dock.id='studio-controls';
dock.innerHTML='<div class="movement-controls"><button id="stand-button" type="button">Levantar</button><select id="seat-choice" aria-label="Poltrona livre"></select><button id="sit-button" type="button">Sentar</button></div><button id="raise-button" type="button">✋ Pedir a palavra</button><div class="mobile-actions"><button id="mobile-mic" type="button">Microfone</button><button id="mobile-chat" type="button">Chat</button></div>';
document.getElementById('bottom').before(dock);dock.prepend(document.getElementById('jzone'));
document.getElementById('mobile-mic').onclick=()=>toggleMic();
document.getElementById('mobile-chat').onclick=()=>document.getElementById('btn-panel').click();
let seatingPending=false;
function requestSeat(message){if(seatingPending||!connected())return;seatingPending=true;movementDirty=false;joy.active=false;joy.dx=0;joy.dy=0;Object.keys(keys).forEach(k=>keys[k]=false);wsSend(message);}
document.getElementById('stand-button').onclick=()=>requestSeat({type:'stand'});
document.getElementById('sit-button').onclick=()=>requestSeat({type:'sit',seat:Number(document.getElementById('seat-choice').value)});
document.getElementById('raise-button').onclick=()=>wsSend({type:'hand_raise',raised:!players[myId]?.handRaisedAt});
canvas.addEventListener('click',e=>{
  if(!running||players[myId]?.listener)return;
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  const seat=CHAIRS.findIndex(([cx,cy])=>Math.abs(x-cx)<.04&&Math.abs(y-cy)<.055);
  if(seat>=0)requestSeat({type:'sit',seat});
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
 document.getElementById('hand-queue').innerHTML=queue.length?queue.map(p=>'<div class="host-person">✋ '+esc(p.name)+(p.isAdmin?'':' <button type="button" data-admin-action="approve" data-target="'+p.id+'">Liberar palavra</button>')+'</div>').join(''):'Nenhum pedido pendente.';
}
const originalAdminMessage=handleAdminMessage;
handleAdminMessage=function(msg){
 if(msg.type==='admin_error'||msg.type==='room_state')seatingPending=false;
 if(msg.type==='seat_state'){if(players[msg.id])Object.assign(players[msg.id],msg);if(msg.id===myId){seatingPending=false;movementDirty=false;joy.active=false;joy.dx=0;joy.dy=0;Object.keys(keys).forEach(k=>keys[k]=false);}updParts();return true;}
 if(msg.type==='hand_state'){if(players[msg.id])players[msg.id].handRaisedAt=msg.handRaisedAt;updParts();return true;}
 return originalAdminMessage(msg);
};
const style=document.createElement('style');style.textContent=`
#studio-controls{display:flex;align-items:center;gap:12px;flex-shrink:0;min-height:88px}#studio-controls #jzone{position:relative;left:auto;bottom:auto;flex:0 0 84px}#studio-controls button,#studio-controls select{background:#241c34;color:#f1e8ff;border:1px solid #675078;border-radius:10px;padding:10px;min-height:42px}#studio-controls button:disabled{opacity:.45}.movement-controls{display:flex;align-items:center;gap:8px}.mobile-actions{display:none}.host-person{padding:10px 0;border-bottom:1px solid #ffffff15}.host-person .admin-tools{display:flex;gap:6px;flex-wrap:wrap}.pr meter{width:52px;height:8px}#episode-title,#replay-list input{box-sizing:border-box;width:100%;min-width:0;background:#151020;color:#f2e9ff;border:1px solid #675078;border-radius:8px;padding:10px;margin:8px 0}#replay-list>div{border-bottom:1px solid #ffffff20;padding:10px 0}#host-controls h3{font-size:14px;margin:16px 0 8px}body.listener #studio-controls{display:none}
@media(max-width:760px){#studio-controls{display:grid;grid-template-columns:84px 1fr;gap:6px;min-height:94px}#studio-controls #jzone{grid-row:1/3}.movement-controls{gap:4px}.movement-controls select{max-width:100px;font-size:12px}#studio-controls button{padding:6px;font-size:12px;min-height:36px}#raise-button{grid-column:2}.mobile-actions{display:flex;gap:6px;grid-column:1/3}.mobile-actions button{flex:1}#erow{display:none}#topbar #btn-mic,#topbar #btn-panel{display:none}#bottom .rb{min-height:36px;padding:5px}#shell{gap:4px}#studio-controls #jzone{height:76px}#main{min-height:140px}body.listener #topbar #btn-panel{display:block}}
`;document.head.append(style);
refreshExperience();

const titleField=document.createElement('label');titleField.textContent='Título do episódio ';const titleInput=document.createElement('input');titleInput.id='episode-title';titleInput.maxLength=120;titleInput.placeholder='Conversa no PodPai';titleField.append(titleInput);document.getElementById('btn-record').before(titleField);

const originalMicUI=updMicUI;updMicUI=function(){originalMicUI();document.getElementById('mobile-mic').textContent=isMuted?'🔇 Ativar mic':'🎤 Silenciar mic';};updMicUI();
