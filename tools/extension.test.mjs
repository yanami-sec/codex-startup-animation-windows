import test from 'node:test';
import assert from 'node:assert/strict';
import {connect,localSocket,pageTarget} from '../extension/cdp.mjs';
test('只选择官方主窗口，拒绝网站及辅助窗口',()=>{
  assert.equal(pageTarget({type:'page',url:'app://-/index.html'}),true);
  for(const url of ['https://example.com/index.html','app://other/index.html','about:blank','app://-/index.html?initialRoute=quick-chat','app://-/index.html?initialRoute=avatar'])assert.equal(pageTarget({type:'page',url}),false);
});
test('只连接指定回环端口的页面 websocket',()=>{
  assert.equal(localSocket('ws://127.0.0.1:9341/devtools/page/1',9341),'ws://127.0.0.1:9341/devtools/page/1');
  for(const value of ['ws://example.com:9341/devtools/page/1','ws://127.0.0.1:9222/devtools/page/1','ws://127.0.0.1:9341/devtools/browser/1','ws://user@127.0.0.1:9341/devtools/page/1'])assert.throws(()=>localSocket(value,9341));
});
class FakeSocket extends EventTarget{
  constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
  send(data){const {id,method}=JSON.parse(data);if(method==='timeout')return;queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(method==='error'?{id,error:{message:'denied'}}:{id,result:{ok:method}})})));}
  close(){this.dispatchEvent(new Event('close'));}
}
test('请求匹配、错误和超时后可正常关闭',async()=>{
  const client=await connect('ws://test',FakeSocket);
  assert.deepEqual(await Promise.all([client.call('first'),client.call('second')]),[{ok:'first'},{ok:'second'}]);
  await assert.rejects(client.call('error'),/denied/);await assert.rejects(client.call('timeout',{},10),/超时/);client.close();
});
