(function(root){
 const seats=[[.26,.40],[.34,.41],[.76,.39],[.83,.43],[.22,.69],[.44,.77],[.71,.76],[.86,.68]];
 const kinds=['banco','banco','puff','puff','cadeira','balanço','banco','cadeira'];
 const lake={x:.60,y:.57,rx:.12,ry:.075};
 const point=p=>p.moved?{x:p.wx,y:p.wy}:{x:seats[p.seat]?.[0]||.175,y:seats[p.seat]?.[1]||.35};
 const distance=(a,b)=>Math.hypot((a.x-b.x)*1800,(a.y-b.y)*1240);
 function gain(a,b){const d=distance(a,b);return Math.max(0,Math.min(1,(420-d)/260));}
 function clear(a,b){const x=(a.x-lake.x)/lake.rx,y=(a.y-lake.y)/lake.ry,dx=(b.x-a.x)/lake.rx,dy=(b.y-a.y)/lake.ry,t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x+t*dx,y+t*dy)>=1.08;}
 function safe(a,b){b={x:Math.max(.10,Math.min(.90,b.x)),y:Math.max(.32,Math.min(.84,b.y))};return clear(a,b)?b:a;}
 function route(a,b){
  b=safe(b,b);if(!clear(b,b))return [];
  if(clear(a,b))return [b];
  const nodes=[a,b];for(let i=0;i<24;i++){const t=i*Math.PI/12;nodes.push({x:lake.x+Math.cos(t)*lake.rx*1.18,y:lake.y+Math.sin(t)*lake.ry*1.18});}
  const ds=nodes.map(()=>Infinity),prev=[],seen=new Set();ds[0]=0;
  while(seen.size<nodes.length){let u=-1;nodes.forEach((_,i)=>{if(!seen.has(i)&&(u<0||ds[i]<ds[u]))u=i;});if(!Number.isFinite(ds[u]))return [];if(u===1)break;seen.add(u);nodes.forEach((v,i)=>{if(!seen.has(i)&&clear(nodes[u],v)){const d=ds[u]+distance(nodes[u],v);if(d<ds[i]){ds[i]=d;prev[i]=u;}}});}
  const path=[];for(let i=1;i!==0;i=prev[i])path.unshift(nodes[i]);return path;
 }
 function createObjects(){return [{id:'ball',name:'Bola',x:.30,y:.52,required:1,holders:[]},{id:'toy',name:'Avião de brinquedo',x:.39,y:.70,required:1,holders:[]},{id:'cart',name:'Carrinho de jardinagem · 2 pessoas',x:.77,y:.60,required:2,holders:[]}];}
 function release(objects,id){for(const o of objects)o.holders=o.holders.filter(h=>h!==id);}
 function claim(objects,id,objectId,p){const o=objects.find(o=>o.id===objectId);if(!o||distance(point(p),o)>110)return false;if(objects.some(o=>o.holders.includes(id))||o.holders.length>=o.required)return false;o.holders.push(id);return true;}
 const api={seats,kinds,lake,point,distance,gain,clear,safe,route,createObjects,release,claim};if(typeof module==='object'&&module.exports)module.exports=api;else root.Garden=api;
})(typeof globalThis==='object'?globalThis:this);
