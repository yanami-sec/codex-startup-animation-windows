import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
export function mountedSurfaces(log){
 return {main:/app routes mounted[^\r\n]*rendererWindowAppearance=primary/.test(log),pet:/app routes mounted[^\r\n]*rendererWindowAppearance=avatarOverlay/.test(log)};
}
export async function readMountedSurfaces(logRoot,pid){
 const dates=new Set();const now=new Date();
 for(const date of [new Date(now),new Date(now.getTime()-86400000)]){
  dates.add([date.getUTCFullYear(),String(date.getUTCMonth()+1).padStart(2,'0'),String(date.getUTCDate()).padStart(2,'0')].join('/'));
  dates.add([date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('/'));
 }
 let main=false,pet=false,found=false;
 for(const date of dates){
  const folder=join(logRoot,...date.split('/'));
  for(const file of await readdir(folder).catch(()=>[])){
   if(!file.includes(`-${pid}-t0-`)||!file.endsWith('.log'))continue;
   const text=await readFile(join(folder,file),'utf8').catch(()=>'');
   found=true;const result=mountedSurfaces(text);main ||= result.main;pet ||= result.pet;
  }
 }
 return {main,pet,found};
}
