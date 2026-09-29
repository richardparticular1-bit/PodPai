// Moderator identity is granted by the server, never by the name or avatar.
let isAdmin=false,removedFromRoom=false,roomRecording=null,pendingRemoval=null;
let recorder=null,recordDestination=null,recordCompressor=null,recordStreams=new Map();
let recordChunks=[],recordBytes=0,recordTimer=null,recordPending=false,recordTracks=[];
let recordingCanvas=null;
let recordStarting=false,recordRotating=false,partTimer=null,recordEpisode=null,recordPart=0;
const recordingLimit=40*1024*1024;
const adminFeedback=document.getElementById('admin-feedback');
const recordFeedback=document.getElementById('record-feedback');
document.getElementById('record-mode').value='video';
document.getElementById('admin-dialog').addEventListener('close',()=>document.getElementById('replay-player').pause());

function connected(){return ws?.readyState===WebSocket.OPEN;}
document.getElementById('admin-login').addEventListener('submit',e=>{
  e.preventDefault();
  if(!connected()){adminFeedback.textContent='Entre na sala e aguarde a conexão.';return;}
  const field=document.getElementById('admin-password');
  wsSend({type:'admin_login',password:field.value});field.value='';
  adminFeedback.textContent='Verificando acesso…';
});
function adminParticipantControls(p){
  if(!isAdmin||p.id===myId||p.isAdmin)return '';
  // IDs in this data attribute have been validated by the server.
  return `<div class="admin-tools">${p.listener?'':`<button type="button" data-admin-action="${p.adminMuted?'unmute':'mute'}" data-target="${p.id}">${p.adminMuted?'Liberar mic':'Silenciar'}</button>`}<button type="button" data-admin-action="remove" data-target="${p.id}">Remover</button></div>`;
}
document.getElementById('plist').addEventListener('click',e=>{
  const button=e.target.closest('[data-admin-action]');if(!button||!isAdmin)return;
  if(button.dataset.adminAction==='remove'){
    pendingRemoval=button.dataset.target;
    document.getElementById('remove-description').textContent=`Remover ${players[pendingRemoval]?.name||'participante'}? Esta ação encerra a sessão atual. Não é um banimento permanente.`;
    document.getElementById('remove-dialog').showModal();
  }else wsSend({type:'admin_action',action:button.dataset.adminAction,target:button.dataset.target});
});
function confirmRemoval(){
  if(isAdmin&&pendingRemoval)wsSend({type:'admin_action',action:'remove',target:pendingRemoval});
  pendingRemoval=null;document.getElementById('remove-dialog').close();
}
function handleAdminMessage(msg){
  if(handleCloudMessage(msg))return true;
  if(msg.type==='admin_authenticated'){
    isAdmin=true;document.body.classList.add('is-admin');
    document.getElementById('admin-login').hidden=true;
    document.getElementById('record-controls').hidden=false;
    document.getElementById('replay-controls').hidden=false;loadReplays();
    document.getElementById('btn-admin').textContent='👑 Administrar';
    adminFeedback.textContent='Acesso de administrador liberado.';updParts();return true;
  }
  if(msg.type==='admin_error'){
    adminFeedback.textContent=msg.message;showToast(msg.message);
    if(recordPending&&msg.requestType==='recording_start'){recordPending=false;cleanupRecording();recordFeedback.textContent=msg.message;}
    return true;
  }
  if(msg.type==='participant_role'){
    if(players[msg.id])players[msg.id].isAdmin=msg.isAdmin;
    updParts();return true;
  }
  if(msg.type==='participant_moderation'){
    const p=players[msg.id];if(p)p.adminMuted=msg.adminMuted;
    if(msg.id===myId&&msg.adminMuted){
      isMuted=true;localStream?.getAudioTracks().forEach(t=>t.enabled=false);updMicUI();
    }
    const audio=document.getElementById('aud-'+msg.id);if(audio)audio.muted=msg.adminMuted;
    const source=recordStreams.get(msg.id);if(source)source.gain.gain.value=msg.adminMuted?0:1;
    if(msg.adminMuted){speaking[msg.id]=false;updSpeaking(msg.id,false);}
    addChat(null,`${p?.name||'Participante'}: ${msg.adminMuted?'microfone bloqueado pelo administrador.':'microfone liberado; o participante pode ativá-lo.'}`,'sys');
    updParts();return true;
  }
  if(msg.type==='recording_state'){
    updateRecordingNotice(msg.recording);
    if(recordPending&&msg.recording?.by===myId){
      recordPending=false;
      try{startRecordingPart();recordFeedback.textContent='Gravando. As partes serão enviadas ao Supabase automaticamente.';document.getElementById('admin-dialog').close();updateRecordButton();}
      catch(error){recordFeedback.textContent='Não foi possível iniciar: '+error.message;wsSend({type:'recording_stop'});cleanupRecording();}
    }else if(!msg.recording&&recorder?.state==='recording')finishRecording(false);
    return true;
  }
  if(msg.type==='removed'){
    removedFromRoom=true;running=false;
    localStream?.getTracks().forEach(t=>t.stop());Object.keys(peers).forEach(cleanPeer);
    document.getElementById('conn').textContent='● removido';
    const notice=document.getElementById('recording-notice');notice.classList.add('active');notice.textContent=msg.message;
    showToast(msg.message);return true;
  }
  return false;
}
function adminDisconnected(){
  cloudDisconnected();
  if(recorder?.state==='recording')finishRecording(false);
  else if(recordPending){recordPending=false;cleanupRecording();}
  isAdmin=false;document.body.classList.remove('is-admin');
  document.getElementById('admin-login').hidden=false;document.getElementById('record-controls').hidden=true;
  document.getElementById('btn-admin').textContent='Administrar';
  if(players[myId])players[myId].isAdmin=false;
  if(!removedFromRoom)updateRecordingNotice(null);
  adminFeedback.textContent='A conexão terminou. Entre novamente como administrador após reconectar.';
  updParts();
}
function updateRecordingNotice(recording){
  roomRecording=recording;
  const notice=document.getElementById('recording-notice');
  if(notice.dataset.entryError&&!recording)return;
  notice.classList.toggle('active',!!recording);
  clearInterval(recordTimer);
  function renderNotice(){
    if(!roomRecording)return;
    const seconds=Math.max(0,Math.floor((Date.now()-roomRecording.startedAt)/1000));
    const elapsed=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    notice.textContent=`● Gravação de ${roomRecording.mode==='video'?'vídeo e áudio':'áudio'} em andamento · ${elapsed} · ${roomRecording.name}`;
  }
  if(recording){renderNotice();recordTimer=setInterval(renderNotice,1000);}else notice.textContent='';
  updateRecordButton();resize();
}
function updateRecordButton(){
  const button=document.getElementById('btn-record');
  button.textContent=recorder?.state==='recording'?'■ Finalizar gravação':'● Iniciar gravação';
  button.disabled=recordStarting||recordPending||!!(recorder&&recorder.state==='inactive')||!!(roomRecording&&roomRecording.by!==myId);
  document.getElementById('record-mode').disabled=!!recorder||recordStarting;
}
function recordingAttach(id,stream){
  if(!recordDestination||!stream?.getAudioTracks().length)return;
  recordingDetach(id);
  const source=getAC().createMediaStreamSource(stream),gain=getAC().createGain();
  gain.gain.value=players[id]?.adminMuted?0:1;
  source.connect(gain);gain.connect(recordCompressor);
  recordStreams.set(id,{source,gain});
}
function recordingDetach(id){
  const entry=recordStreams.get(id);if(!entry)return;
  entry.source.disconnect();entry.gain.disconnect();recordStreams.delete(id);
}
async function toggleRecording(){
  if(recorder?.state==='recording'){finishRecording(true);return;}
  if(recordStarting||recordPending||recorder)return;
  if(!isAdmin||!connected()){recordFeedback.textContent='Entre como administrador para gravar.';return;}
  if(unsavedParts>=4){recordFeedback.textContent='Envie as partes pendentes antes de iniciar outro episódio.';return;}
  const mode=document.getElementById('record-mode').value;
  if(!window.MediaRecorder||(mode==='video'&&!canvas.captureStream)){recordFeedback.textContent='Este navegador não oferece esta gravação. Tente Chrome ou Edge no computador.';return;}
  recordStarting=true;updateRecordButton();
  document.getElementById('replay-player').pause();
  try{
    await cloudRequest('status');
    await getAC().resume();
    if(!isAdmin||!connected())throw new Error('A conexão com a sala foi perdida.');
    recordDestination=getAC().createMediaStreamDestination();
    recordCompressor=getAC().createDynamicsCompressor();recordCompressor.connect(recordDestination);
    recordingAttach(myId,localStream);
    document.querySelectorAll('audio[id^="aud-"]').forEach(el=>recordingAttach(el.id.slice(4),el.srcObject));
    if(mode==='video'){recordingCanvas=document.createElement('canvas');recordingCanvas.width=1280;recordingCanvas.height=720;recordingPaintFrame();}
    recordTracks=recordingCanvas?recordingCanvas.captureStream(24).getVideoTracks():[];
    const media=new MediaStream([...recordTracks,...recordDestination.stream.getAudioTracks()]);
    const formats=mode==='video'?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4']:['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    const mimeType=formats.find(type=>MediaRecorder.isTypeSupported(type));
    recorder=new MediaRecorder(media,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:600000,audioBitsPerSecond:96000});
    recordEpisode=Date.now()+'_'+crypto.randomUUID();recordPart=0;
    recordChunks=[];recordBytes=0;
    recorder.ondataavailable=e=>{
      if(e.data.size){recordChunks.push(e.data);recordBytes+=e.data.size;}
      if(recordBytes>=recordingLimit&&recorder?.state==='recording'){
        rotateRecordingPart();
      }
    };
    const outputType=recorder.mimeType;
    recorder.onstop=()=>{
      clearTimeout(partTimer);
      const blob=new Blob(recordChunks,{type:outputType});
      recordChunks=[];recordBytes=0;
      if(blob.size)saveEpisodePart(blob,recordEpisode,++recordPart);
      else recordFeedback.textContent='Esta parte terminou sem dados.';
      if(recordRotating&&connected()&&isAdmin&&unsavedParts<4){
        recordRotating=false;
        try{startRecordingPart();return;}catch(error){recordFeedback.textContent='Não foi possível continuar: '+error.message;}
      }
      if(recordRotating){recordFeedback.textContent='Gravação encerrada. Aguarde os envios ou tente novamente nas partes pendentes.';if(connected())wsSend({type:'recording_stop'});}
      recordRotating=false;cleanupRecording();
      if(!document.getElementById('admin-dialog').open)document.getElementById('admin-dialog').showModal();
    };
    recorder.onerror=()=>{recordFeedback.textContent='Erro na gravação. Finalizando os dados disponíveis.';finishRecording(true);};
    recordPending=true;wsSend({type:'recording_start',mode});
    recordFeedback.textContent='Avisando os participantes…';
  }catch(error){recordFeedback.textContent='Não foi possível gravar: '+error.message;cleanupRecording();}
  finally{recordStarting=false;updateRecordButton();}
}
function recordingPaintFrame(){
  if(!recordingCanvas||!canvas.width||!canvas.height)return;
  const context=recordingCanvas.getContext('2d'),scale=Math.min(1280/canvas.width,720/canvas.height);
  context.fillStyle='#0c0913';context.fillRect(0,0,1280,720);
  const w=canvas.width*scale,h=canvas.height*scale;
  context.drawImage(canvas,(1280-w)/2,(720-h)/2,w,h);
}
function startRecordingPart(){
  recorder.start(1000);partTimer=setTimeout(rotateRecordingPart,4*60*1000);updateRecordButton();
}
function rotateRecordingPart(){
  if(recorder?.state!=='recording')return;
  recordRotating=true;clearTimeout(partTimer);recorder.stop();updateRecordButton();
}
function finishRecording(notify){
  recordRotating=false;clearTimeout(partTimer);
  recordFeedback.textContent='Gravação encerrada. Aguarde a confirmação de envio de todas as partes abaixo.';
  if(recorder&&recorder.state!=='inactive')recorder.stop();
  if(notify&&connected())wsSend({type:'recording_stop'});
  updateRecordButton();
}
function cleanupRecording(){
  clearTimeout(partTimer);
  for(const id of recordStreams.keys())recordingDetach(id);
  recordCompressor?.disconnect();recordCompressor=null;
  recordTracks.forEach(t=>t.stop());recordTracks=[];recordingCanvas=null;
  recordDestination?.stream.getTracks().forEach(t=>t.stop());recordDestination=null;
  recordChunks=[];recordBytes=0;recorder=null;recordPending=false;updateRecordButton();
}
window.addEventListener('beforeunload',e=>{
  if(recorder?.state==='recording'||recordPending||unsavedParts>0||pendingUploads>0){e.preventDefault();e.returnValue='';}
});
