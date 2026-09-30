const cloudRequests=new Map();
let pendingUploads=0,unsavedParts=0,replayItems=[],replayOffset=null,replayGeneration=0;
function cloudRequest(action,input={}){
  return new Promise((resolve,reject)=>{
    if(!isAdmin||!connected()){reject(new Error('Entre como administrador para acessar os episódios.'));return;}
    const requestId=crypto.randomUUID();
    const timer=setTimeout(()=>{cloudRequests.delete(requestId);reject(new Error('O Supabase demorou para responder. Tente novamente.'));},20000);
    cloudRequests.set(requestId,{resolve,reject,timer});wsSend({type:'cloud_request',requestId,action,input});
  });
}
function handleCloudMessage(msg){
  if(msg.type!=='cloud_result')return false;
  const request=cloudRequests.get(msg.requestId);if(!request)return true;
  clearTimeout(request.timer);cloudRequests.delete(msg.requestId);
  if(msg.error)request.reject(new Error(msg.error));else request.resolve(msg.result);
  return true;
}
function cloudDisconnected(){
  for(const request of cloudRequests.values()){clearTimeout(request.timer);request.reject(new Error('Conexão encerrada. Entre novamente para tentar o envio.'));}
  cloudRequests.clear();replayGeneration++;
  document.getElementById('replay-controls').hidden=true;
  const video=document.getElementById('replay-player');video.pause();video.removeAttribute('src');video.load();video.hidden=true;
  document.getElementById('replay-list').replaceChildren();replayItems=[];
}
function saveEpisodePart(blob,episode,part){
  unsavedParts++;
  const box=document.createElement('div'),status=document.createElement('p'),retry=document.createElement('button'),backup=document.createElement('a');
  const objectUrl=URL.createObjectURL(blob);
  backup.href=objectUrl;backup.download=`podpai-${episode}-parte-${part}.${blob.type.includes('mp4')?'mp4':'webm'}`;backup.textContent='Baixar cópia';
  retry.type='button';retry.textContent='Tentar envio novamente';retry.hidden=true;
  box.append(status,retry,backup);document.getElementById('record-downloads').appendChild(box);
  let upload=null;
  async function sendPart(){
    retry.hidden=true;pendingUploads++;status.textContent=`Parte ${part}: preparando envio…`;
    try{
      if(!upload){
        const grant=await cloudRequest('upload',{episode,part,size:blob.size,mime:blob.type.split(';')[0]});
        upload=new tus.Upload(blob,{
          endpoint:grant.endpoint,headers:{'x-signature':grant.token},chunkSize:6*1024*1024,
          retryDelays:[0,3000,5000,10000,20000],uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,storeFingerprintForResuming:false,
          metadata:{bucketName:grant.bucket,objectName:grant.path,contentType:blob.type.split(';')[0],cacheControl:'3600'},
        });
      }
      await new Promise((resolve,reject)=>{
        upload.options.onProgress=(sent,total)=>{status.textContent=`Parte ${part}: enviando ${Math.round(sent/total*100)}%…`;};
        upload.options.onError=reject;upload.options.onSuccess=resolve;upload.start();
      });
      status.textContent=`Parte ${part} salva no Supabase ✓`;unsavedParts--;
      backup.remove();retry.remove();URL.revokeObjectURL(objectUrl);blob=null;upload=null;
      if(isAdmin)loadReplays();
    }catch(error){
      const code=error.originalResponse?.getStatus?.();
      const detail=code?`O armazenamento recusou o envio (HTTP ${code}). Tente novamente; se persistir, informe este código.`:error.message;
      status.textContent=`Parte ${part} ainda não foi salva. ${detail} Mantenha a aba aberta ou baixe a cópia.`;
      // Get a fresh signed token on manual retry; expired grants must not trap the recording.
      upload=null;retry.hidden=false;
    }finally{pendingUploads--;}
  }
  retry.onclick=sendPart;sendPart();
}
function importEpisodeFile(file){
  if(!file)return;
  const feedback=document.getElementById('record-feedback');
  if(!isAdmin||!connected()){feedback.textContent='Entre como administrador para enviar a gravação.';return;}
  if(unsavedParts>=4){feedback.textContent='Conclua os envios pendentes antes de selecionar outro arquivo.';return;}
  if(file.size<1||file.size>45*1024*1024){feedback.textContent='Selecione uma parte de até 45 MB, nos formatos WebM ou MP4.';return;}
  const extension=file.name.match(/\.(webm|mp4)$/i)?.[1].toLowerCase();
  if(!extension){feedback.textContent='Formato não aceito. Selecione a cópia WebM ou MP4 da gravação.';return;}
  const mime=file.type.split(';')[0];
  const blob=file.slice(0,file.size,['video/webm','audio/webm','video/mp4','audio/mp4'].includes(mime)?mime:'video/'+extension);
  const original=file.name.match(/^podpai-([0-9]{13}_[a-f0-9-]{36})-parte-([0-9]{1,4})\.(webm|mp4)$/i);
  const episode=original?original[1].toLowerCase():Date.now()+'_'+crypto.randomUUID();
  const part=original?Math.max(1,Number(original[2])):1;
  feedback.textContent='Enviando a gravação salva. Acompanhe a confirmação abaixo.';
  saveEpisodePart(blob,episode,part);
}
async function loadReplays(append=false){
  const status=document.getElementById('replay-feedback'),generation=++replayGeneration;
  status.textContent='Carregando episódios…';
  try{
    const result=await cloudRequest('list',{offset:append?(replayOffset||0):0});
    if(generation!==replayGeneration||!isAdmin)return;
    replayItems=append?[...replayItems,...result.items]:result.items;replayOffset=result.nextOffset;
    const list=document.getElementById('replay-list');list.replaceChildren();
    // Parts appear together and play in ascending order, regardless of upload completion order.
    replayItems.sort((a,b)=>b.name.slice(0,50).localeCompare(a.name.slice(0,50))||a.name.localeCompare(b.name));
    for(const item of replayItems){
      const button=document.createElement('button');button.type='button';
      const date=new Date(Number(item.name.slice(0,13))).toLocaleString('pt-BR');
      const part=Number(item.name.match(/_part(\d+)/)?.[1]);
      button.textContent=`▶ ${date} · Parte ${part} · ${(item.size/1024/1024).toFixed(1)} MB`;
      button.onclick=()=>playReplay(item);list.appendChild(button);
    }
    status.textContent=replayItems.length?'Replays privados. Ao terminar uma parte, a próxima parte carregada toca automaticamente.':'Nenhum episódio salvo ainda.';
    const more=document.getElementById('replay-more');more.hidden=replayOffset===null;more.onclick=()=>loadReplays(true);
  }catch(error){if(generation===replayGeneration)status.textContent=error.message;}
}
async function playReplay(item){
  const status=document.getElementById('replay-feedback');
  try{
    const result=await cloudRequest('play',{path:item.path});if(!isAdmin)return;
    const video=document.getElementById('replay-player');video.src=result.url;video.hidden=false;
    const part=Number(item.name.match(/_part(\d+)/)?.[1]),episode=item.name.split('_part')[0];
    video.onended=()=>{const next=replayItems.find(x=>x.name.startsWith(episode+'_part'+String(part+1).padStart(4,'0')+'_'));if(next)playReplay(next);};
    await video.play();
  }catch(error){status.textContent='Não foi possível reproduzir: '+error.message;}
}
