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
      return {path,token:data.token,bucket,endpoint:endpoint.origin+'/storage/v1/upload/resumable'};
    }
    if(action==='list'){
      const offset=Number.isInteger(input.offset)&&input.offset>=0?Math.min(input.offset,100000):0;
      const {data,error}=await store.list('episodes',{limit:50,offset,sortBy:{column:'name',order:'desc'}});
      if(error)throw new Error('Não foi possível carregar os replays.');
      return {items:data.filter(f=>PATH.test('episodes/'+f.name)).map(f=>({path:'episodes/'+f.name,name:f.name,size:f.metadata?.size||0,createdAt:f.created_at})),nextOffset:data.length===50?offset+50:null};
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
