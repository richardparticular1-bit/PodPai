(function(root){
  function clamp(x,y){return{x:Math.max(.10,Math.min(.90,x)),y:Math.max(.32,Math.min(.84,y))};}
  const table={x:.5,y:.57,rx:.255,ry:.15};
  function step(x,y,dx,dy,seconds,climbed=false,collide=false){
    const length=Math.max(1,Math.hypot(dx,dy)),dt=Math.min(.05,Math.max(0,seconds));
    const next=clamp(x+dx/length*145/900*dt,y+dy/length*145/620*dt);
    if(climbed||!collide)return next;
    const tx=(next.x-table.x)/table.rx,ty=(next.y-table.y)/table.ry;
    if(tx*tx+ty*ty<1){
      const angle=Math.atan2(ty,tx);
      return clamp(table.x+Math.cos(angle)*table.rx*1.04,table.y+Math.sin(angle)*table.ry*1.04);
    }
    return next;
  }
  const api={clamp,step};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudioMovement=api;
})(typeof globalThis==='object'?globalThis:this);
