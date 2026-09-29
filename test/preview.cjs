// Local-only browser fixture. Never served by the production file map.
// Uses synthetic tones, a disposable password and an in-memory TUS endpoint.
const http=require('http'),fs=require('fs'),path=require('path'),{Readable}=require('stream');
const objects=new Map(),uploads=new Map();let seq=0;
const media=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://localhost:3003');
  res.setHeader('Access-Control-Allow-Methods','POST,PATCH,HEAD,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Tus-Resumable,Upload-Length,Upload-Metadata,Upload-Offset,Content-Type,X-Signature');
  res.setHeader('Access-Control-Expose-Headers','Location,Upload-Offset,Tus-Resumable');
  res.setHeader('Tus-Resumable','1.0.0');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  if(req.method==='GET'&&req.url==='/verify'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(`<h1>Verificação local de áudio sintetizado</h1><button id="check">Analisar gravação</button><pre id="result"></pre><script>
      const files=${JSON.stringify([...objects.keys()])};
      document.getElementById('check').onclick=async()=>{
        try{
          const bytes=await(await fetch('/'+files[0])).arrayBuffer();
          const buffer=await new AudioContext().decodeAudioData(bytes);
          const samples=buffer.getChannelData(0),start=Math.floor(buffer.sampleRate*.5),n=Math.min(buffer.sampleRate,samples.length-start);
          const amplitude=f=>{let re=0,im=0;for(let i=0;i<n;i++){const a=2*Math.PI*f*i/buffer.sampleRate;re+=samples[start+i]*Math.cos(a);im+=samples[start+i]*Math.sin(a);}return Math.sqrt(re*re+im*im)/n;};
          document.getElementById('result').textContent=JSON.stringify({parts:files.length,duration:buffer.duration,local440Hz:amplitude(440),remote880Hz:amplitude(880),noise650Hz:amplitude(650)},null,2);
        }catch(error){document.getElementById('result').textContent=error.message;}
      };
    </script>`);return;
  }
  if(req.method==='GET'){
    const item=objects.get(decodeURIComponent(req.url.slice(1)));
    if(!item){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',item.mime);res.setHeader('Content-Length',item.bytes.length);res.end(item.bytes);return;
  }
  let item;
  if(req.method==='POST'){
    const metadata=Object.fromEntries((req.headers['upload-metadata']||'').split(',').map(p=>{const [k,v]=p.split(' ');return[k,Buffer.from(v||'','base64').toString()];}));
    const id=String(++seq);item={name:metadata.objectName,mime:metadata.contentType,bytes:Buffer.alloc(0),length:Number(req.headers['upload-length'])};uploads.set('/upload/'+id,item);
    res.setHeader('Location','http://localhost:3004/upload/'+id);
  }else item=uploads.get(req.url);
  if(!item){res.writeHead(404);res.end();return;}
  if(req.method==='HEAD'){res.setHeader('Upload-Offset',item.bytes.length);res.writeHead(200);res.end();return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  item.bytes=Buffer.concat([item.bytes,...chunks]);
  if(item.bytes.length===item.length){objects.set(item.name,item);console.log('Fixture saved',item.name,item.bytes.length);}
  res.setHeader('Upload-Offset',item.bytes.length);res.writeHead(req.method==='POST'?201:204);res.end();
}).listen(3004,'127.0.0.1');
const storagePath=require.resolve('../episode-storage');
require.cache[storagePath]={id:storagePath,filename:storagePath,loaded:true,exports:{createEpisodeStorage:()=>({request:async(action,input)=>{
  if(action==='status')return{ready:true};
  if(action==='upload')return{endpoint:'http://localhost:3004/upload',token:'fixture-only',bucket:'fixture',path:`episodes/${input.episode}_part${String(input.part).padStart(4,'0')}_${require('crypto').randomUUID()}.webm`};
  if(action==='list')return{items:[...objects.values()].map(o=>({path:o.name,name:o.name.slice(9),size:o.bytes.length})),nextOffset:null};
  if(action==='play')return{url:'http://localhost:3004/'+input.path};
}})}};
const original=fs.createReadStream;
fs.createReadStream=function(file,...args){
  if(path.basename(file)==='client.html'){
    let html=fs.readFileSync(file,'utf8');
    html=html.replace('</body>',`<script>
      initMic=async function(){
        const ac=getAC(),dest=ac.createMediaStreamDestination(),tone=ac.createOscillator();tone.frequency.value=440;tone.connect(dest);tone.start();localStream=dest.stream;
        localStream.getAudioTracks().forEach(t=>t.enabled=false);isMuted=true;updMicUI();return true;
      };
      const testButton=document.createElement('button');testButton.textContent='TESTE: tom remoto';testButton.style.cssText='position:fixed;bottom:0;right:0;z-index:1000';testButton.onclick=()=>{
        const ac=getAC(),dest=ac.createMediaStreamDestination(),tone=ac.createOscillator();tone.frequency.value=880;tone.connect(dest);tone.start();playAudio('fixture-remote',dest.stream);testButton.remove();
      };document.body.append(testButton);
    </script></body>`);return Readable.from(html);
  }
  if(path.basename(file)==='admin.js')return Readable.from(fs.readFileSync(file,'utf8').replace('4*60*1000','8000'));
  return original.call(this,file,...args);
};
process.env.PORT='3003';process.env.ADMIN_PASSWORD='podpai-local-test';require('../server');
const WS=require('ws');
setTimeout(()=>{for(let i=0;i<3;i++){
  const w=new WS('ws://localhost:3003');w.on('open',()=>w.send(JSON.stringify({type:'join',id:'fixture-'+i,name:['Convidada','Participante','Amiga'][i],avatar:i,color:'#b896da'})));
}},300);
