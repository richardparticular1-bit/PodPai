let gardenObjects=[],gardenClockOffset=0;
const gardenCamera={x:0,y:0};
function gardenSwing(){return !reducedMotion.matches&&Object.values(players).some(p=>!p.listener&&!p.moved&&p.seat===5)?Math.sin((Date.now()+gardenClockOffset)/800)*7:0;}
function updateGardenCamera(){const me=players[myId];const p=me?Garden.point(me):{x:.175,y:.35};gardenCamera.x=Math.max(0,Math.min(.5,p.x-.25));gardenCamera.y=Math.max(0,Math.min(.5,p.y-.25));}
function drawGardenSeats(){
 const s=studioAvatarScale()*.65;
 Garden.seats.forEach(([x,y],i)=>{
  ctx.save();ctx.translate(x*CW,y*CH);ctx.scale(s,s);oval(ctx,0,6,30,8,'#142a2744');
  const kind=Garden.kinds[i];
  if(kind==='puff'){oval(ctx,0,-8,24,20,i===2?'#ce9c7c':'#9e85b5');oval(ctx,0,-18,23,9,'#dcc6ae');}
  else{
   if(kind==='balanço'){const sway=gardenSwing();ctx.strokeStyle='#b99b70';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-34,5);ctx.lineTo(-30,-93);ctx.lineTo(30,-93);ctx.lineTo(34,5);ctx.stroke();ctx.strokeStyle='#d2c2a1';ctx.lineWidth=1.5;[-20,20].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-93);ctx.lineTo(x+sway,-8);ctx.stroke();});ctx.translate(sway,0);}
   else if(kind==='cadeira'){pill(ctx,-17,-42,34,28,4,'#87694f','#ceb18a');pill(ctx,-20,-12,40,10,3,'#aa8058');[-20,16].forEach(x=>pill(ctx,x,-27,4,19,2,'#745c47'));}
   else{pill(ctx,-26,-39,52,25,4,'#87694f','#ceb18a');for(let n=0;n<3;n++)pill(ctx,-24,-37+n*8,48,5,2,'#bc986c');}
   pill(ctx,-27,-12,54,10,3,'#aa8058');[-20,20].forEach(x=>pill(ctx,x,-2,4,13,1,'#433e34'));
  }
  ctx.font='9px Nunito,sans-serif';ctx.textAlign='center';ctx.fillStyle='#f6eed8';ctx.fillText(String(i+1).padStart(2,'0')+' · '+kind,0,25);ctx.restore();
 });
}
function drawGardenLife(){
 const t=(Date.now()+gardenClockOffset)/1000,s=studioAvatarScale()*.5;
 // Shared clock and deterministic routes: every visitor sees the same animals.
 for(let i=0;i<3;i++){
  const x=(.34+Math.sin(t*.12+i*2)*.08)*CW,y=(.47+Math.cos(t*.16+i*2)*.04)*CH;
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(ctx,0,0,7,4,'#d9bd87');oval(ctx,5,-4,3,3,'#f0d4a2');ctx.fillStyle='#d99051';ctx.fillRect(7,-4,4,2);ctx.strokeStyle='#795d4b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-2,0);ctx.lineTo(-8,-5-(reducedMotion.matches?0:Math.sin(t*8+i)*3));ctx.stroke();ctx.restore();
 }
 const cx=(.25+Math.sin(t*.055)*.06)*CW,cy=(.64+Math.cos(t*.075)*.035)*CH;
 ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);oval(ctx,0,5,19,5,'#14252555');oval(ctx,0,-4,14,8,'#c19a76');oval(ctx,12,-12,8,8,'#d3b18d');ctx.fillStyle='#d3b18d';ctx.beginPath();ctx.moveTo(7,-17);ctx.lineTo(6,-25);ctx.lineTo(13,-19);ctx.lineTo(17,-25);ctx.lineTo(19,-15);ctx.fill();ctx.fillStyle='#344b40';ctx.fillRect(10,-13,2,2);ctx.fillRect(16,-13,2,2);ctx.strokeStyle='#c19a76';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-10,-3);ctx.quadraticCurveTo(-26,-20,-15,-23);ctx.stroke();[-7,7].forEach(x=>pill(ctx,x,0,4,8,2,'#a48165'));ctx.restore();
 gardenObjects.forEach(o=>{
  const holder=o.required===1&&players[o.holders[0]],p=holder?Garden.point(holder):o;
  ctx.save();ctx.translate(p.x*CW,p.y*CH-(holder?24*s:0));ctx.scale(s,s);ctx.textAlign='center';
  if(o.id==='ball'){oval(ctx,0,-6,10,10,'#ecbd63');ctx.strokeStyle='#bc705c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-6);ctx.lineTo(9,-6);ctx.moveTo(0,-16);ctx.lineTo(0,4);ctx.stroke();}
  else if(o.id==='toy'){ctx.fillStyle='#9ec4ce';ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(14,-8);ctx.lineTo(4,7);ctx.lineTo(0,0);ctx.closePath();ctx.fill();}
  else{pill(ctx,-22,-18,44,19,4,'#698e76','#b8c697');[-15,15].forEach(x=>oval(ctx,x,4,5,5,'#293c38'));ctx.font='10px sans-serif';ctx.fillStyle='#fff1d7';ctx.fillText(o.holders.length+'/2',0,-24);}
  ctx.restore();
 });
}
const gardenTools=document.createElement('div');gardenTools.id='garden-tools';gardenTools.hidden=true;gardenTools.innerHTML='<button id="garden-pick" type="button">Pegar objeto</button><button id="garden-return" type="button">Caminhar à entrada</button><span id="garden-hearing" role="status"></span>';dock.append(gardenTools);
document.getElementById('garden-return').onclick=()=>{if(gardenObjects.some(o=>o.holders.includes(myId))){showToast('Solte o objeto antes de voltar à entrada.');return;}startWalk({x:.175,y:.35});};
document.getElementById('garden-pick').onclick=()=>{const held=gardenObjects.find(o=>o.holders.includes(myId));if(held){wsSend({type:'garden_object',action:'drop'});return;}const p=Garden.point(players[myId]);const o=gardenObjects.filter(o=>o.holders.length<o.required).sort((a,b)=>Garden.distance(p,a)-Garden.distance(p,b))[0];if(o)wsSend({type:'garden_object',action:'take',id:o.id});};
style.textContent+='#garden-tools:not([hidden]){display:flex;gap:6px;align-items:center;flex-wrap:wrap}#garden-hearing{font-size:11px;color:#b5d8c9}@media(max-width:760px){#garden-tools{grid-column:1/3;grid-row:5}}';
setInterval(()=>{
 const me=players[myId],active=currentRoom==='garden';gardenTools.hidden=!active;
 const nearby=[];
 for(const [id,audio] of Object.entries(spatialAudio)){
  const peer=players[id],el=document.getElementById('aud-'+id);if(!peer||!me)continue;
  const volume=active?Garden.gain(Garden.point(me),Garden.point(peer)):1;
  if(active&&volume>.02)nearby.push(peer.name);
  const target=active&&!peer.adminMuted?volume:0;audio.gain.gain.setTargetAtTime(target,getAC().currentTime,.15);
  if(el)el.muted=active||!!peer.adminMuted;
 }
 if(!active||!me)return;
 document.getElementById('garden-return').disabled=!!me.listener;
 document.getElementById('garden-hearing').textContent=nearby.length?'Ao alcance: '+nearby.join(', '):me.listener?'Ouvindo a área da entrada':'Aproxime-se de alguém para conversar';
 const held=gardenObjects.find(o=>o.holders.includes(myId)),button=document.getElementById('garden-pick');
 const close=!me.listener&&gardenObjects.filter(o=>o.holders.length<o.required&&Garden.distance(Garden.point(me),o)<=110)[0];
 button.disabled=me.listener||(!held&&!close);button.textContent=held?'Soltar '+held.name+(held.required>held.holders.length?' · aguardando ajuda':''):close?'Pegar '+close.name:'Aproxime-se de um brinquedo';
},200);
