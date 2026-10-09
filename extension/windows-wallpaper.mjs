import {readFile,writeFile,unlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {connect,pageTarget,localSocket} from './cdp.mjs';
import {buildInjection} from './payload.mjs';
import {readMountedSurfaces} from './startup-readiness.mjs';
import {settleLocalPet} from './pet-settle.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const port=Number(process.argv[2]);
const state=process.argv[3];
const readyFile=process.argv[4];
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const source=await buildInjection(root);
const deferredSource=readyFile?await buildInjection(root,{deferStart:true}):source;
let gateReleased=false;
let mountStatus={main:false,pet:false,found:false},lastMountCheck=0,hostContext=null;
const startupBegan=Date.now();
let applied=false,missing=0,startupReady=false;
for(let cycle=0;cycle<43200;cycle++){
  try{
    const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1200),redirect:'error'});
    const targets=await response.json();missing=0;
    if(readyFile&&!startupReady&&Date.now()-lastMountCheck>750){
      lastMountCheck=Date.now();
      hostContext ||= await readFile(readyFile+'.host.json','utf8').then(text=>JSON.parse(text.replace(/^\uFEFF/,''))).catch(()=>null);
      if(hostContext)mountStatus=await readMountedSurfaces(hostContext.logRoot,hostContext.pid);
    }
    for(const target of targets.filter(pageTarget)){
      let client;
      try{
        client=await connect(localSocket(target.webSocketDebuggerUrl,port));
        const existing=await client.call('Runtime.evaluate',{expression:'Boolean(window.__aemeathExtension)',returnByValue:true});
        if(existing.result?.value===true){
          if(readyFile && !startupReady){
            const readiness=await client.call('Runtime.evaluate',{expression:'window.__aemeathExtension.status()',returnByValue:true});
            const petExpected=targets.some(t=>t.type==='page'&&t.url.startsWith('app:')&&/avatar-overlay/.test(t.url));
            const surfacesMounted=mountStatus.main&&(!petExpected||mountStatus.pet);
            const pageReadyFallback=readiness.result?.value?.settled&&Date.now()-startupBegan>15000;
            if(readiness.result?.value?.ready&&(surfacesMounted||pageReadyFallback)&&!gateReleased){
              const petWait=petExpected?await settleLocalPet(port,readyFile+'.pet-visible'):null;
              const begun=await client.call('Runtime.evaluate',{expression:'window.__aemeathExtension.start()',returnByValue:true});
              if(begun.result?.value===true){
                startupReady=true;gateReleased=true;
                await writeFile(readyFile,'ready');
                await writeFile(state,JSON.stringify({time:new Date().toISOString(),phase:'playing',startupWaitMs:Date.now()-startupBegan,petWait,mountStatus}));
                await delay(250);
                await unlink(readyFile+'.shown').catch(()=>{});await unlink(readyFile+'.host.json').catch(()=>{});await unlink(readyFile+'.pet-visible').catch(()=>{});
              }
            }
          }
          continue;
        }
        await client.call('Runtime.evaluate',{expression:'window.__codexLocalWallpaper?.dispose()',returnByValue:true});
        const result=await client.call('Runtime.evaluate',{expression:readyFile&&!startupReady?deferredSource:source,returnByValue:true});
        if(result.exceptionDetails)throw Error('Page rejected wallpaper');
        if(result.result?.value?.installed && !result.result.value.alreadyActive){
          applied=true;await writeFile(state,JSON.stringify({time:new Date().toISOString(),target:target.id,...result.result.value}));
        }
      }finally{client?.close();}
    }
  }catch(error){
    if(++missing> (applied?5:300)){await writeFile(state,JSON.stringify({applied,error:error.message}));process.exitCode=applied?0:1;break;}
  }
  await delay(readyFile && !startupReady ? 100 : 5000);
}
