export function pageTarget(target){
  try{
    const url=new URL(target.url),route=url.searchParams.get('initialRoute')||'/';
    return target.type==='page'&&url.protocol==='app:'&&url.hostname==='-'&&url.pathname==='/index.html'&&!/avatar|quick.chat|detached|mini|popover|notification/i.test(route);
  }catch{return false;}
}
export function localSocket(value,port){
  const url=new URL(value);
  if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||Number(url.port)!==port||!url.pathname.startsWith('/devtools/page/')||url.username||url.password)throw new Error('拒绝非本机页面调试地址');
  return url.href;
}
export async function connect(url,Socket=WebSocket){
  const socket=new Socket(url),pending=new Map();let serial=0;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.close();reject(new Error('调试连接超时'));},5000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('调试连接失败'));},{once:true});
  });
  socket.addEventListener('message',event=>{
    let data;try{data=JSON.parse(event.data);}catch{return;}
    const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);
    data.error?request.reject(new Error(data.error.message)):request.resolve(data.result);
  });
  socket.addEventListener('close',()=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('调试连接已关闭'));}pending.clear();});
  return {
    call(method,params={},timeout=10000){return new Promise((resolve,reject)=>{
      const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' 超时'));},timeout);
      pending.set(id,{resolve,reject,timer});
      try{socket.send(JSON.stringify({id,method,params}));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
    });},
    close(){socket.close();}
  };
}
