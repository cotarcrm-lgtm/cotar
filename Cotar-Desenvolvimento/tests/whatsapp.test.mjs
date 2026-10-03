import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {whatsappPhone,whatsappRequest,whatsappWebhook,twilioSignature,secureEqual} from '../server/whatsapp.js';
function setup(){const raw=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())raw.exec(fs.readFileSync('drizzle/'+f,'utf8'));return {raw,db:{prepare(q){const s=raw.prepare(q);let values=[];const r={bind(...v){values=v;return r},async first(){return s.get(...values)||null},async all(){return {results:s.all(...values)}},async run(){return {meta:{changes:Number(s.run(...values).changes)}}}};return r;}}};}
test('WhatsApp: credentials, permissions, signatures, window and idempotent sends',async()=>{
 const {raw,db}=setup(),env={WHATSAPP_ENCRYPTION_KEY:'test-only-key'},actor={id:'u',role:'Administrador',companyId:'c',screens:['leads']},lead={id:'l',companyId:'c',userId:'u',storeId:'s',phone:'75999999999'},all={leads:[lead],stores:[{id:'s',companyId:'c'}],users:[actor],teams:[],regions:[],groups:[]};
 const call=(path,body,method=body?'POST':'GET',user=actor)=>whatsappRequest(db,env,user,all,new Request('https://example.test/api/whatsapp/'+path,{method,headers:{'cf-connecting-ip':'127.0.0.1'}}),'/api/whatsapp/'+path.split('?')[0],body||{});
 const sid='AC'+'a'.repeat(32),token='b'.repeat(32),from='whatsapp:+14155238886';
 const c=await call('config',{accountSid:sid,authToken:token,from,mode:'sandbox',enabled:true},'PUT');assert.equal(c.enabled,true);assert.ok(!JSON.stringify(c).includes(token));assert.ok(!raw.prepare('SELECT token_cipher FROM whatsapp_accounts').get().token_cipher.includes(token));
 await assert.rejects(call('config',{accountSid:sid,authToken:token,from,mode:'sandbox'},'PUT',{...actor,role:'Vendedor'}),{status:403});
 await assert.rejects(call('messages?lead=foreign'),{status:404});
 const payload={leadId:'l',clientId:crypto.randomUUID(),optIn:true,text:'Olá'};
 await assert.rejects(call('send',payload),/janela de 24 horas/);await assert.rejects(call('send',{...payload,optIn:false}),/autorizou/);
 const inbound=new URLSearchParams({AccountSid:sid,MessageSid:'SM'+'c'.repeat(32),From:whatsappPhone(lead.phone),To:from,Body:'Olá',NumMedia:'0'});
 const hook=async(params,signature)=>whatsappWebhook(db,env,new Request(c.webhook,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':signature||await twilioSignature(c.webhook,params,token)},body:params}),c.webhook.split('/').at(-1));
 await assert.rejects(hook(inbound,'invalid'),{status:403});
 // Prior outgoing associates inbound with its CRM lead.
 raw.prepare("INSERT INTO whatsapp_messages(id,company_id,lead_id,phone,sender_id,client_id,direction,body,status,created_at) VALUES('prior','c','l',?,'u','prior','outbound','x','sent',?)").run(whatsappPhone(lead.phone),new Date().toISOString());
 await hook(inbound);await hook(inbound);assert.equal(raw.prepare("SELECT count(*) n FROM whatsapp_messages WHERE direction='inbound'").get().n,1);assert.equal((await call('messages?lead=l')).windowOpen,true);
 const original=globalThis.fetch;let count=0;globalThis.fetch=async(url,options)=>{count++;assert.ok(String(url).startsWith('https://api.twilio.com/'));assert.equal(new URLSearchParams(options.body).get('Body'),'Olá');return Response.json({sid:'SM'+'d'.repeat(32),status:'queued'},{status:201});};
 try{const r=await call('send',payload);assert.equal(r.status,'queued');assert.equal((await call('send',payload)).alreadySubmitted,true);assert.equal(count,1);}finally{globalThis.fetch=original;raw.close();}
});
test('Twilio signature matches independent HMAC-SHA1 implementation and phone normalization',async()=>{
 const params=new URLSearchParams({CallSid:'CA1234567890ABCDE',Caller:'+12349013030',Digits:'1234',From:'+12349013030',To:'+18005551212'});
 assert.equal(await twilioSignature('https://mycompany.com/myapp.php?foo=1&bar=2',params,'12345'),createHmac('sha1','12345').update('https://mycompany.com/myapp.php?foo=1&bar=2'+[...params.keys()].sort().map(k=>k+params.get(k)).join('')).digest('base64'));
 assert.equal(whatsappPhone('(75) 99999-9999'),'whatsapp:+5575999999999');assert.equal(secureEqual('abc','abc'),true);assert.equal(secureEqual('abc','abd'),false);
});
