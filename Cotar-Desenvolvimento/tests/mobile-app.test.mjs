import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import gateway from '../server/gateway.js';

test('gateway serves install assets with correct MIME, scope and PNG bytes', async () => {
 for (const [path,type] of [['/manifest.webmanifest','application/manifest+json'],['/sw.js','text/javascript'],['/icon-192.png','image/png'],['/icon-512.png','image/png']]) {
  const response = await gateway.fetch(new Request('https://cotar.test'+path),{});
  assert.equal(response.status,200);
  assert.ok(response.headers.get('content-type').startsWith(type));
  if(path.endsWith('.png')) assert.deepEqual([...new Uint8Array(await response.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  else if(path.endsWith('webmanifest')) {const manifest=await response.json();assert.equal(manifest.start_url,'/login');assert.equal(manifest.scope,'/');}
 }
 const login=await gateway.fetch(new Request('https://cotar.test/login'),{});
 assert.match(await login.text(),/manifest.webmanifest/);
});

test('install help toggles accessibly, can be dismissed, and standalone has no banner', () => {
 for (const standalone of [false,true]) {
  const dom=new JSDOM('<body></body>',{url:'https://cotar.test/login',runScripts:'outside-only'});
  dom.window.matchMedia=()=>({matches:standalone});
  dom.window.eval(fs.readFileSync('public/mobile-app.js','utf8'));
  const panel=dom.window.document.querySelector('.cotar-install');
  if(standalone) assert.equal(panel,null);
  else {const button=panel.querySelector('button');button.click();assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(panel.querySelector('p').hidden,false);panel.querySelector('.cotar-install-dismiss').click();assert.equal(dom.window.document.querySelector('.cotar-install'),null);}
  dom.window.close();
 }
});

test('worker bypasses APIs and falls back offline without caching private navigation', async () => {
 const listeners={};let matched;let writes=0;
 const context={URL,self:{location:{origin:'https://cotar.test'},addEventListener:(name,handler)=>listeners[name]=handler},fetch:async()=>{throw Error('offline')},caches:{match:async path=>{matched=path;return 'offline-screen'},open:()=>{writes++;throw Error('not allowed')}}};
 vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
 for(const url of ['/api/customers','/api/documents']) {
  let handled=false;listeners.fetch({request:{url:'https://cotar.test'+url,method:'GET',mode:'navigate'},respondWith:()=>handled=true});assert.equal(handled,false);
 }
 let response;
 listeners.fetch({request:{url:'https://cotar.test/login',method:'GET',mode:'navigate'},respondWith:p=>response=p});
 assert.equal(await response,'offline-screen');assert.equal(matched,'/offline.html');assert.equal(writes,0);
});
