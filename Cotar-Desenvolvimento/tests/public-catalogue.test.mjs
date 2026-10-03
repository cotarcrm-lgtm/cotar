import {testPassword} from './generated-test-password.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../supabase/functions/cotar-api/app.js';
import {modules,checkNames} from '../public/config.js';
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));const DB={prepare(sql){const stmt=db.prepare(sql);let args=[];const api={bind(...v){args=v;return api},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}}};return api},async batch(stmts){db.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};return {db,env:{DB}}}
async function call(env,path,method='GET',body,cookie='',headers={}){const response=await worker.fetch(new Request('https://example.test/api/'+path,{method,headers:{'Content-Type':'application/json',Origin:'https://example.test',Cookie:cookie,...headers},body:body?JSON.stringify(body):undefined}),env);return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]}}
function payload(kind,extra={}){const b={};for(const f of modules[kind].fields)b[f.key]=f.type==='number'?0:f.type==='date'?'2026-09-27':f.type==='datetime-local'?new Date(Date.now()+3600000).toISOString():f.type==='select'?f.options[0]:f.type==='screens'?[]:f.type==='checklist'?checkNames.map(name=>({name,state:'Bom',note:'',value:0})):'';return {...b,...extra}}


test('catálogo público protege o CRM e atribui contatos pelo link com valores canônicos',async()=>{
 const {db,env}=setup();const boot=await call(env,'auth/setup','POST',{company:'Empresa',name:'Admin',cpf:'52998224725',password:testPassword(15)},'',{'oai-authenticated-user-email':'admin@example.test'});assert.equal(boot.status,201);
 const cookie=boot.cookie,all=(await call(env,'data','GET',null,cookie)).body,me=all.me;
 assert.equal((await call(env,'data')).status,401);assert.equal((await call(env,'catalogue-link','POST',{})).status,401);
 const link=await call(env,'catalogue-link','POST',{},cookie);assert.equal(link.status,200,JSON.stringify(link.body));const token=link.body.url.split('/').at(-1),path='public/catalogue/'+token;
 assert.equal((await call(env,'catalogue-link','POST',{},cookie)).body.url,link.body.url);
 const publicData=await call(env,path);assert.equal(publicData.status,200);assert(publicData.body.plans.length>220);assert(publicData.body.plans.some(p=>p.administratorId==='disal'));assert.deepEqual(Object.keys(publicData.body).sort(),['company','consultant','consultantPhone','modelImages','plans','serverTime']);assert(!JSON.stringify(publicData.body).includes(me.email));assert(!JSON.stringify(publicData.body).includes(me.id));assert(publicData.body.plans[0].modelCode);
 const plan=publicData.body.plans.find(p=>p.id==='honda-20260824-p1-m1-80');
 const body={name:'Cliente do catálogo',phone:'75999998888',planId:plan.id,revision:plan.revision,insurance:'Sem seguro',dueDay:'10',scheduledAt:new Date(Date.now()+3600000).toISOString(),consent:true,submissionId:crypto.randomUUID(),userId:'outro-vendedor',companyId:'outra-empresa',storeId:'outra-loja',consortium:{creditCents:1},status:'Fechado'};
 assert.equal((await call(env,path+'/leads','POST',body,'',{Origin:'https://other.test'})).status,403);
 assert.equal((await call(env,path+'/leads','POST',{...body,scheduledAt:'2020-01-01T12:00:00Z',phone:'75911112222'})).status,400);
 assert.equal((await call(env,path+'/leads','POST',{...body,consent:false,phone:'75911113333'})).status,400);
 assert.equal((await call(env,path+'/leads','POST',{...body,revision:999,phone:'75911114444'})).status,409);
 assert.equal((await call(env,path+'/leads','POST',body)).status,201);
 const leads=(await call(env,'data','GET',null,cookie)).body.records.leads;assert.equal(leads.length,1);const lead=leads[0];assert.equal(lead.userId,me.id);assert.equal(lead.createdBy,me.id);assert.equal(lead.companyId,me.companyId);assert.equal(lead.storeId,me.storeId);assert.equal(lead.source,'Catálogo');assert.equal(lead.status,'Agendado');assert.equal(lead.consortium.creditCents,plan.creditCents);assert.equal(lead.consortium.installmentCents,plan.installmentWithoutInsuranceCents);
 assert.equal((await call(env,path+'/leads','POST',body)).status,201);assert.equal(db.prepare('SELECT count(*) AS n FROM leads').get().n,1);
 const financingPlan=publicData.body.plans.find(p=>/\bPOP\b/i.test(p.model));
 const financeBody={...body,submissionId:crypto.randomUUID(),modality:'Financiamento',planId:financingPlan.id,revision:financingPlan.revision,financing:{tableId:'pop',cashPriceCents:2000000,entryPercent:20,months:36,code:'2CNNA013694'}};
 assert.equal((await call(env,path+'/leads','POST',financeBody)).status,409);
 db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run(`catalogue-price:${me.companyId}:${financingPlan.modelCode}`,'2000000');
 const financeResult=await call(env,path+'/leads','POST',financeBody);assert.equal(financeResult.status,201,JSON.stringify(financeResult.body));
 const financeLeads=(await call(env,'data','GET',null,cookie)).body.records.leads;
 const financeLead=financeLeads.find(l=>l.modality==='Financiamento');assert.equal(financeLead.category,'Moto');assert.equal(financeLead.model,financingPlan.model);assert.equal(financeLead.financing.entryCents,400000);assert.equal(financeLead.financing.upfrontCents,400000);assert.equal(financeLead.financing.cashPriceCents,2000000);assert.equal(financeLead.consortium,undefined);
 const higherEntry={...financeBody,submissionId:crypto.randomUUID(),financing:{...financeBody.financing,entryPercent:35}};
 assert.equal((await call(env,path+'/leads','POST',higherEntry)).status,201);
 const higherLead=(await call(env,'data','GET',null,cookie)).body.records.leads.find(l=>l.financing?.entryPercent===35);
 assert.equal(higherLead.financing.entryCents,700000);assert.equal(higherLead.financing.upfrontCents,700000);
 assert.equal((await call(env,path+'/leads','POST',{...financeBody,submissionId:crypto.randomUUID(),financing:{...financeBody.financing,cashPriceCents:100}})).status,409);
 const secondStore='loja-b';const originalStore=db.prepare('SELECT data FROM stores WHERE id=?').get(me.storeId);db.prepare('INSERT INTO stores (id,company_id,data,created_at,updated_at) VALUES (?,?,?,?,?)').run(secondStore,me.companyId,JSON.stringify({...JSON.parse(originalStore.data),name:'Loja B'}),new Date().toISOString(),new Date().toISOString());
 assert.equal((await call(env,'catalogue-price','PUT',{storeId:secondStore,modelCode:financingPlan.modelCode,cashPriceCents:2300000},cookie)).status,200);
 const secondLink=await call(env,'catalogue-link','POST',{storeId:secondStore},cookie);assert.equal(secondLink.status,200);assert.notEqual(secondLink.body.url,link.body.url);
 const secondPath='public/catalogue/'+secondLink.body.url.split('/').at(-1),secondCatalogue=await call(env,secondPath);assert.equal(secondCatalogue.body.plans.find(p=>p.id===financingPlan.id).cashPriceCents,2300000);
 assert.equal((await call(env,path)).body.plans.find(p=>p.id===financingPlan.id).cashPriceCents,2000000);
 const secondLead=await call(env,secondPath+'/leads','POST',{...body,submissionId:crypto.randomUUID()});assert.equal(secondLead.status,201,JSON.stringify(secondLead.body));assert.equal(db.prepare('SELECT count(*) AS n FROM leads WHERE store_id=?').get(secondStore).n,1);
 assert.equal((await call(env,'public/catalogue/'+'0'.repeat(64))).status,404);
 const userRow=db.prepare('SELECT data FROM users WHERE id=?').get(me.id),fields=JSON.parse(userRow.data);db.prepare('UPDATE users SET data=? WHERE id=?').run(JSON.stringify({...fields,status:'Inativo'}),me.id);
 assert.equal((await call(env,path)).status,404);assert.equal((await call(env,path+'/leads','POST',{...body,submissionId:crypto.randomUUID()})).status,404);
 db.prepare('UPDATE users SET data=? WHERE id=?').run(userRow.data,me.id);const company=db.prepare('SELECT data FROM companies WHERE id=?').get(me.companyId);db.prepare('UPDATE companies SET data=? WHERE id=?').run(JSON.stringify({...JSON.parse(company.data),administratorIds:['disal']}),me.companyId);const disalOnly=await call(env,path);assert.equal(disalOnly.status,200);assert(disalOnly.body.plans.every(p=>p.administratorId==='disal'));assert.equal((await call(env,path+'/leads','POST',{...body,submissionId:crypto.randomUUID()})).status,409);db.close();
});
