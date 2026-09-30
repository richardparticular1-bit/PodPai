(function(root){
  const chairs=[[.5,.36],[.31,.43],[.69,.43],[.33,.72],[.67,.72],[.5,.79],[.17,.60],[.83,.60]];
  const point=p=>p.moved?{x:p.wx,y:p.wy}:{x:chairs[p.seat]?.[0]||.5,y:chairs[p.seat]?.[1]||.5};
  function spawn(players){
    const candidates=[];
    for(const y of [.35,.47,.59,.71])for(const x of [.175,.28])candidates.push({x,y});
    const people=players.filter(p=>!p.listener).map(point);
    const clearance=p=>Math.min(Infinity,...people.map(q=>Math.hypot((p.x-q.x)/.085,(p.y-q.y)/.105)));
    return candidates.find(p=>clearance(p)>=1)||candidates.sort((a,b)=>clearance(b)-clearance(a))[0];
  }
  const table={x:.5,y:.57,rx:.245,ry:.135};
  function outside(p){
    const dx=(p.x-table.x)/table.rx,dy=(p.y-table.y)/table.ry,r=Math.hypot(dx,dy);
    if(r>=1.05)return p;
    const angle=r?Math.atan2(dy,dx):-Math.PI/2;
    return{x:table.x+Math.cos(angle)*table.rx*1.1,y:table.y+Math.sin(angle)*table.ry*1.1};
  }
  function clear(a,b){
    const ax=(a.x-table.x)/table.rx,ay=(a.y-table.y)/table.ry,dx=(b.x-a.x)/table.rx,dy=(b.y-a.y)/table.ry;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(ax+t*dx,ay+t*dy)>=1;
  }
  function route(from,to){
    to=outside({x:Math.max(.1,Math.min(.9,to.x)),y:Math.max(.32,Math.min(.84,to.y))});
    const start=outside(from),prefix=Math.hypot(start.x-from.x,start.y-from.y)>.001?[start]:[];
    if(clear(start,to))return [...prefix,to];
    const nodes=[start,to];for(let i=0;i<20;i++){const a=i*Math.PI/10;nodes.push({x:table.x+Math.cos(a)*table.rx*1.13,y:table.y+Math.sin(a)*table.ry*1.13});}
    const distance=nodes.map(()=>Infinity),previous=[],visited=new Set();distance[0]=0;
    while(visited.size<nodes.length){
      let u=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(u<0||distance[i]<distance[u]))u=i;
      if(u<0||!Number.isFinite(distance[u]))return [];
      if(u===1)break;visited.add(u);
      for(let v=0;v<nodes.length;v++)if(!visited.has(v)&&clear(nodes[u],nodes[v])){
        const d=distance[u]+Math.hypot((nodes[v].x-nodes[u].x)*900,(nodes[v].y-nodes[u].y)*620);
        if(d<distance[v]){distance[v]=d;previous[v]=u;}
      }
    }
    const path=[];for(let at=1;at!==0;at=previous[at]){if(at===undefined)return [];path.unshift(nodes[at]);}
    return [...prefix,...path];
  }
  function toward(from,to,seconds){
    const dx=(to.x-from.x)*900,dy=(to.y-from.y)*620,d=Math.hypot(dx,dy),step=145*Math.min(.05,Math.max(0,seconds));
    if(d<=step)return {...to,arrived:true};
    return{x:from.x+dx/d*step/900,y:from.y+dy/d*step/620,arrived:false};
  }
  function pose({time=0,phase=0,walking=false,talking=false,seated=false,hand=false,reaction=-1,reduced=false}={}){
    const stride=!reduced&&walking&&!seated?Math.sin(phase):0,t=time/1000;
    const clap=reaction===2,raised=hand||reaction===3;
    return {leftLeg:stride*.48,rightLeg:-stride*.48,
      leftArm:clap?-.95+(!reduced?Math.sin(t*15)*.35:0):stride*-.5,
      rightArm:raised?-2.65:clap?.95-(!reduced?Math.sin(t*15)*.35:0):stride*.5+(talking&&seated&&!reduced?Math.sin(t*4)*.14:0),
      bob:reduced?0:reaction===1?Math.sin(t*18)*1.8:walking?Math.abs(stride)*1.6:Math.sin(t*2)*.5,
      lean:!reduced&&reaction===1?Math.sin(t*9)*.045:0};
  }
  const api={chairs,point,spawn,route,toward,pose,clear};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioMotion=api;
})(typeof globalThis==='object'?globalThis:this);
