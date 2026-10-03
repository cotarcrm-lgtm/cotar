import {test} from 'node:test';
import assert from 'node:assert/strict';
import gateway from '../server/gateway.js';
test('gateway preserva assets e não perde os dados quando Supabase está bloqueado',async()=>{assert.equal((await gateway.fetch(new Request('https://example.test/lead-utils.js'),{})).status,200);const paused=await gateway.fetch(new Request('https://example.test/api/data'),{COTAR_MAINTENANCE:'true'});assert.equal(paused.status,503);const noConfig=await gateway.fetch(new Request('https://example.test/api/data'),{COTAR_BACKEND_ACTIVE:'true'});assert.equal(noConfig.status,503);const legacy=await gateway.fetch(new Request('https://example.test/api/auth/status'),{DB:{prepare(){return {first:async()=>({value:'configured'})}}}});assert.equal(legacy.status,200);assert.equal((await legacy.json()).setupRequired,false)});
test('módulos importados pela tela inicial são publicados com o aplicativo',async()=>{
 const app=await (await gateway.fetch(new Request('https://example.test/app.js'),{})).text();
 for(const [,path] of app.matchAll(/(?:import|export)\s*(?:[^'";]*?\sfrom\s*)?['"]\.\/([^'"]+)['"]/g)){
  const response=await gateway.fetch(new Request('https://example.test/'+path),{});
  assert.equal(response.status,200,path);
  assert.match(response.headers.get('Content-Type')||'',/javascript/,path);
 }
});
test('política permite fotos locais temporárias sem ampliar permissões de scripts',async()=>{for(const path of ['/','/index.html']){const response=await gateway.fetch(new Request('https://example.test'+path),{});const csp=response.headers.get('Content-Security-Policy');assert.match(csp, /img-src 'self' data: blob:;/);assert.match(csp, /script-src 'self';/);assert(!csp.includes("script-src 'self' blob:"));}});
test('seleção de empresa chega ao backend em consultas e salvamentos',async t=>{const sent=[];t.mock.method(globalThis,'fetch',async(_url,options)=>{sent.push(JSON.parse(options.body));return Response.json({ok:true})});const env={COTAR_BACKEND_ACTIVE:'true',COTAR_BACKEND_URL:'https://backend.test',COTAR_PROXY_KEY:'secret'};for(const method of ['GET','POST'])await gateway.fetch(new Request('https://example.test/api/data',{method,headers:{'X-Cotar-Company':'winner',Origin:'https://example.test','Content-Type':'application/json'},body:method==='POST'?'{}':undefined}),env);assert.equal(sent.length,2);for(const envelope of sent)assert.equal(envelope.headers['x-cotar-company'],'winner');});
