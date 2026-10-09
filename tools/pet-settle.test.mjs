import test from 'node:test';
import assert from 'node:assert/strict';
import {settlePet} from '../extension/pet-settle.mjs';
test('pet visibility must remain ready for the entire buffer',async()=>{
 let clock=0;const result=await settlePet(async()=>clock>=1000,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(result.settled,true);assert.equal(result.waitedMs,4000);
});
test('another pet loading interval resets the buffer',async()=>{
 let clock=0;const result=await settlePet(async()=>clock<1000||clock>=2000,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(result.settled,true);assert.equal(result.waitedMs,5000);
});
test('disabled or unavailable pet cannot block launch indefinitely',async()=>{
 let clock=0;const result=await settlePet(async()=>false,{now:()=>clock,sleep:async ms=>{clock+=ms;}});
 assert.equal(result.settled,false);assert.equal(result.waitedMs,6000);
});
