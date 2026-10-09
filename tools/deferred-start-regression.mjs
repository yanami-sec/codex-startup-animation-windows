import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {buildInjection} from '../extension/payload.mjs';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
 const page=await browser.newPage();
 await page.setContent('<html><body><div id="root"><p>App ready</p></div></body></html>');
 await page.evaluate(await buildInjection(process.cwd(),{deferStart:true}));
 await page.waitForFunction(()=>window.__aemeathExtension?.status().ready);
 await page.waitForTimeout(1000);
 const initial=await page.evaluate(()=>({status:window.__aemeathExtension.status(),visibility:document.querySelector('#aemeath-extension-overlay').style.visibility,time:document.querySelector('#aemeath-extension-overlay').contentDocument.querySelector('.window').dataset.elapsed}));
 assert.equal(initial.status.phase,'prepared');assert.equal(initial.status.settled,true);assert.equal(initial.time,'0.00');
 assert.equal(initial.visibility,'hidden');
 const started=Date.now();assert.equal(await page.evaluate(()=>window.__aemeathExtension.start()),true);assert(Date.now()-started<500);
 assert.equal(await page.evaluate(()=>document.querySelector('#aemeath-extension-overlay').style.visibility),'visible');
 await page.waitForTimeout(1000);
 const elapsed=await page.evaluate(()=>Number(document.querySelector('#aemeath-extension-overlay').contentDocument.querySelector('.window').dataset.elapsed));
 assert(elapsed>.5&&elapsed<2);
 await page.evaluate(()=>window.__aemeathExtension.dispose());
 console.log('PASS: assets prewarmed; frame zero held during settling; playback begins only on explicit start');
}finally{await browser.close();}
