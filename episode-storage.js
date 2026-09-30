const {createClient}=require('@supabase/supabase-js');
const {randomUUID}=require('crypto');
const MAX_PART_BYTES=45*1024*1024;
const PATH=/^episodes\/[0-9]{13}_[a-f0-9-]{36}_part[0-9]{4}_[a-f0-9-]{36}\.(webm|mp4)$/;

function createEpisodeStorage(env=process.env, clientFactory=createClient){
  const url=env.SUPABASE_URL;
  const key=env.SUPABASE_SECRET_KEY;
  const bucket=env.SUPABASE_EPISODES_BUCKET||'podpai-episodes';
  const client=url&&key?clientFactory(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
  const requireReady=()=>{if(!client)throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY no Render para salvar os episódios.');};
  async function request(action,input={}){
    requireReady();
    const store=client.storage.from(bucket);
    if(action==='status'){
      const {data,error}=await client.storage.getBucket(bucket);
      if(error)throw new Error('Não foi possível acessar o armazenamento dos episódios. Verifique a configuração no Render.');
      if(data.public)throw new Error('O bucket de episódios precisa ser privado.');
      if(Number(data.file_size_limit)<MAX_PART_BYTES)throw new Error('Configure o limite do bucket para 45 MB.');
      return {ready:true,maxPartBytes:MAX_PART_BYTES};
    }
    if(action==='upload'){
      if(!Number.isInteger(input.size)||input.size<1||input.size>MAX_PART_BYTES)throw new Error('Parte maior que 45 MB ou vazia.');
      if(!/^[0-9]{13}_[a-f0-9-]{36}$/.test(input.episode||'')||!Number.isInteger(input.part)||input.part<1||input.part>9999)throw new Error('Identificação de episódio inválida.');
      if(!['video/webm','video/mp4','audio/webm','audio/mp4'].includes(input.mime))throw new Error('Formato não permitido.');
      const path=`episodes/${input.episode}_part${String(input.part).padStart(4,'0')}_${randomUUID()}.${input.mime.endsWith('mp4')?'mp4':'webm'}`;
      const {data,error}=await store.createSignedUploadUrl(path);
      if(error)throw new Error('Não foi possível autorizar o envio ao Supabase.');
      const endpoint=new URL(url);endpoint.hostname=endpoint.hostname.replace(/\.supabase\.co$/,'.storage.supabase.co');
      // x-signature is accepted by the signed TUS route; the regular route
      // expects a user JWT and rejects this flow with "Invalid Compact JWS".
      return {path,token:data.token,bucket,endpoint:endpoint.origin+'/storage/v1/upload/resumable/sign'};
    }
    if(['rename','complete','episode'].includes(action)){
      const episode=action==='complete'?String(input.path||'').slice(9).split('_part')[0]:input.episode;
      if(!/^[0-9]{13}_[a-f0-9-]{36}$/.test(episode||''))throw new Error('Episódio inválido.');
      if(action==='episode'){
        let files=[],offset=0;
        while(true){const {data,error}=await store.list('episodes',{search:episode+'_part',limit:100,offset,sortBy:{column:'name',order:'asc'}});if(error)throw new Error('Não foi possível carregar o episódio.');files.push(...data);if(data.length<100)break;offset+=100;if(offset>20000)throw new Error('Episódio muito grande.');}
        const unique=new Map();for(const f of files)if(PATH.test('episodes/'+f.name)&&f.name.startsWith(episode+'_part')){const part=Number(f.name.match(/_part(\d+)/)[1]);unique.set(part,{name:f.name,path:'episodes/'+f.name,part});}
        return {items:[...unique.values()].sort((a,b)=>a.part-b.part)};
      }
      const title=String(input.title||'Episódio '+new Date(Number(episode.slice(0,13))).toLocaleString('pt-BR')).trim().slice(0,120);
      if(!title)throw new Error('Informe um título.');
      if(action==='complete'){
        if(!PATH.test(input.path||''))throw new Error('Parte inválida.');
        const {error}=await store.info(input.path);if(error)throw new Error('Arquivo ainda não encontrado no armazenamento.');
      }
      const {error}=await client.from('podpai_episodes').upsert({id:episode,title},{onConflict:'id',ignoreDuplicates:action==='complete'});
      if(error)throw new Error('Não foi possível salvar o título.');
      if(action==='complete'){
        const duration=Number.isFinite(input.duration)&&input.duration>=0&&input.duration<=86400?input.duration:null;
        const {error}=await client.from('podpai_episode_parts').upsert({path:input.path,episode_id:episode,duration_seconds:duration},{onConflict:'path'});
        if(error)throw new Error('Não foi possível salvar a duração.');
      }
      return {saved:true};
    }
    if(action==='list'){
      const offset=Number.isInteger(input.offset)&&input.offset>=0?Math.min(input.offset,100000):0;
      const {data,error}=await store.list('episodes',{limit:50,offset,sortBy:{column:'name',order:'desc'}});
      if(error)throw new Error('Não foi possível carregar os replays.');
      // Finish the final episode before the next page, so its displayed duration is complete.
      let nextOffset=data.length===50?offset+50:null;
      if(nextOffset!==null){
        const lastEpisode=data[data.length-1].name.split('_part')[0];
        while(true){
          const page=await store.list('episodes',{limit:100,offset:nextOffset,sortBy:{column:'name',order:'desc'}});
          if(page.error)throw new Error('Não foi possível carregar as partes.');
          const tail=page.data.filter(f=>f.name.split('_part')[0]===lastEpisode);data.push(...tail);nextOffset+=tail.length;
          if(tail.length!==page.data.length)break;
          if(page.data.length<100){nextOffset=null;break;}
          if(data.length>20000)throw new Error('Episódio muito grande.');
        }
      }
      const ids=[...new Set(data.map(f=>f.name.split('_part')[0]))];
      const titles=await client.from('podpai_episodes').select('id,title').in('id',ids);
      const durations=await client.from('podpai_episode_parts').select('path,duration_seconds').in('episode_id',ids);
      if(titles.error||durations.error)throw new Error('Não foi possível carregar os detalhes dos episódios.');
      return {items:data.filter(f=>PATH.test('episodes/'+f.name)).map(f=>({path:'episodes/'+f.name,name:f.name,title:titles.data.find(t=>t.id===f.name.split('_part')[0])?.title,duration:durations.data.find(t=>t.path==='episodes/'+f.name)?.duration_seconds,size:f.metadata?.size||0,createdAt:f.created_at})),nextOffset};
    }
    if(action==='play'){
      if(!PATH.test(input.path||''))throw new Error('Episódio inválido.');
      const {data,error}=await store.createSignedUrl(input.path,3600);
      if(error)throw new Error('Não foi possível abrir o replay.');
      return {url:data.signedUrl};
    }
    throw new Error('Operação inválida.');
  }
  return {request};
}
module.exports={createEpisodeStorage,MAX_PART_BYTES};
