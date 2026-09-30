const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEpisodeStorage}=require('../episode-storage');
test('episode metadata preserves renamed titles and playlists include all pages in numerical order',async()=>{
 const id='1790000000000_12345678-1234-1234-1234-123456789012',rows=new Map(),parts=new Map();
 const files=Array.from({length:105},(_,i)=>({name:id+'_part'+String(i+1).padStart(4,'0')+'_12345678-1234-1234-1234-123456789012.webm'}));
 const client={storage:{from:()=>({info:async path=>({error:path.endsWith('mp4')?{}:null}),list:async(_,q)=>({data:files.slice(q.offset,q.offset+q.limit)})})},from:table=>({upsert:async(row,options)=>{const map=table==='podpai_episodes'?rows:parts,key=row.id||row.path;if(!options.ignoreDuplicates||!map.has(key))map.set(key,row);return{};}})};
 const storage=createEpisodeStorage({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'test'},()=>client);
 const path='episodes/'+files[0].name;
 await storage.request('complete',{path,title:'Original',duration:8});
 await storage.request('rename',{episode:id,title:'Revisado'});
 await storage.request('complete',{path,title:'Original',duration:9});
 assert.equal(rows.get(id).title,'Revisado');assert.equal(parts.get(path).duration_seconds,9);
 const playlist=await storage.request('episode',{episode:id});assert.equal(playlist.items.length,105);assert.equal(playlist.items[104].part,105);
 await assert.rejects(storage.request('complete',{path:path.replace('.webm','.mp4')}),/encontrado/);
 await assert.rejects(storage.request('rename',{episode:'../private',title:'bad'}),/inválido/);
});
