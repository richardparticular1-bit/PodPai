const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEpisodeStorage,MAX_PART_BYTES}=require('../episode-storage');
test('private storage, bounded uploads and playback path validation',async()=>{
  const calls=[];
  const storage=createEpisodeStorage({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'server-test-key'},()=>({storage:{
    getBucket:async()=>({data:{public:false,file_size_limit:MAX_PART_BYTES}}),
    from:bucket=>({createSignedUploadUrl:async path=>{calls.push([bucket,path]);return {data:{token:'test-token'}};},createSignedUrl:async(path,ttl)=>({data:{signedUrl:`https://test.invalid/${path}?ttl=${ttl}`}})})
  }}));
  assert.equal((await storage.request('status')).ready,true);
  await assert.rejects(storage.request('upload',{size:MAX_PART_BYTES+1}));
  await assert.rejects(storage.request('play',{path:'../private'}));
  const upload=await storage.request('upload',{size:42,mime:'video/webm',episode:'1790000000000_12345678-1234-1234-1234-123456789012',part:1});
  assert.equal(upload.endpoint,'https://example.storage.supabase.co/storage/v1/upload/resumable/sign');
  assert.equal(upload.token,'test-token');
  assert.equal(JSON.stringify(upload).includes('server-test-key'),false);
  assert.equal(calls[0][0],'podpai-episodes');
  assert.match((await storage.request('play',{path:upload.path})).url,/ttl=3600/);
  await assert.rejects(createEpisodeStorage({}).request('list'),/Configure/);
});
