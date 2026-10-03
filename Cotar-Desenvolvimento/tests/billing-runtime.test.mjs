import test from 'node:test';
import assert from 'node:assert/strict';
import {billingRuntime,setupSandboxWebhook} from '../supabase/functions/cotar-api/billing-runtime.js';
test('Supabase billing secrets override empty forwarded values without exposing other secrets',()=>{
  const secrets={ASAAS_API_KEY:'private',ASAAS_ENVIRONMENT:'sandbox'};
  assert.deepEqual(billingRuntime(k=>secrets[k],{ASAAS_API_KEY:undefined,ASAAS_WEBHOOK_TOKEN:'webhook'}),{...secrets,ASAAS_WEBHOOK_TOKEN:'webhook'});
});
test('sandbox setup authenticates provider, reuses own webhook, and returns no credentials',async()=>{
  const token='a'.repeat(64),key='provider-secret',calls=[];
  const url='https://cotar-crm.jcarlossf.chatgpt.site/api/billing/webhook';
  const response=await setupSandboxWebhook(new Request('https://private/setup',{method:'POST',body:JSON.stringify({token,email:'test@example.com'})}),k=>({ASAAS_API_KEY:key,ASAAS_ENVIRONMENT:'sandbox'})[k],async(u,o)=>{
    calls.push({u,o});
    return Response.json(calls.length===1?{data:[{id:'existing',url}]}:calls.length===2?{id:'existing',authToken:token}:{id:'existing',url,enabled:true,interrupted:false});
  });
  assert.equal(response.status,200);assert.equal(calls[1].o.method,'PUT');assert.equal(calls[0].o.headers.access_token,key);
  const result=await response.text();assert.ok(!result.includes(token));assert.ok(!result.includes(key));
});
test('setup rejects production and missing key before provider access',async()=>{
  for(const secrets of [{},{ASAAS_API_KEY:'key',ASAAS_ENVIRONMENT:'production'}]){
    const response=await setupSandboxWebhook(new Request('https://private/setup',{method:'POST'}),k=>secrets[k],()=>{throw Error('provider must not run')});
    assert.ok([400,503].includes(response.status));
  }
});
