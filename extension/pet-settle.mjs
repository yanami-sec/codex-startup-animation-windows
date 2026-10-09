import {setTimeout as delay} from 'node:timers/promises';
import {connect,localSocket} from './cdp.mjs';
import {readFile} from 'node:fs/promises';
export async function settlePet(probe,{now=Date.now,sleep=delay,maxWait=6000,settleTime=3000}={}){
 const began=now();let visibleSince=null;
 while(now()-began<maxWait){
  const ready=await probe();
  if(ready){visibleSince ??= now();if(now()-visibleSince>=settleTime)return {settled:true,waitedMs:now()-began};}
  else visibleSince=null;
  await sleep(250);
 }
 return {settled:false,waitedMs:now()-began};
}
export async function settleLocalPet(port,nativeMarker){
 return settlePet(async()=>{
  try{
   if(nativeMarker){
     const shownAt=Number(await readFile(nativeMarker,'utf8').catch(()=>''));
     if(!shownAt)return false;
   }
   const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();
   const pet=targets.find(t=>t.type==='page'&&t.url.startsWith('app:')&&/avatar-overlay/.test(t.url));
   if(!pet)return false;
   const client=await connect(localSocket(pet.webSocketDebuggerUrl,port));
   try{
    const result=await client.call('Runtime.evaluate',{expression:'document.visibilityState==="visible" && document.readyState==="complete" && Boolean(document.getElementById("root")?.childElementCount) && Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0)',returnByValue:true},1500);
    return result.result?.value===true;
   }finally{client.close();}
  }catch{return false;}
 });
}
