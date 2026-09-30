(function(root){
  function clamp(x,y){return{x:Math.max(.10,Math.min(.90,x)),y:Math.max(.32,Math.min(.84,y))};}
  function step(x,y,dx,dy,seconds){
    const length=Math.max(1,Math.hypot(dx,dy)),dt=Math.min(.05,Math.max(0,seconds));
    return clamp(x+dx/length*145/900*dt,y+dy/length*145/620*dt);
  }
  const api={clamp,step};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudioMovement=api;
})(typeof globalThis==='object'?globalThis:this);
