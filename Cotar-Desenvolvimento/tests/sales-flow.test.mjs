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

test('vendas partem do lead; consórcio e novos dispensam estoque; seminovos exigem estoque',async()=>{
 const {db,env}=setup();const boot=await call(env,'auth/setup','POST',{company:'Empresa',name:'Admin',cpf:'52998224725',password:testPassword(13)},'',{'oai-authenticated-user-email':'admin@example.test'});assert.equal(boot.status,201);const cookie=boot.cookie,all=(await call(env,'data','GET',null,cookie)).body,me=all.me,store=all.records.stores[0];
 const createLead=async(modality,extra={})=>{const r=await call(env,'leads','POST',payload('leads',{name:'Cliente '+modality,phone:'75999999999',storeId:store.id,userId:me.id,modality,category:'Moto',model:'CG 160 Fan',...extra}),cookie);assert.equal(r.status,201,JSON.stringify(r.body));return r.body};
 const createSale=lead=>payload('sales',{leadId:lead.id,storeId:store.id,userId:me.id,amount:20000,status:'Concluída'});
 for(const modality of ['À vista','Financiamento','Consórcio']){const lead=await createLead(modality,modality==='Consórcio'?{administratorId:'honda',planId:'honda-20260824-p1-m1-80',insurance:'Sem seguro',dueDay:'10'}:{});const sale=await call(env,'sales','POST',{...createSale(lead),...(modality==='Consórcio'?{dossierVersion:1}:{})},cookie);assert.equal(sale.status,201,JSON.stringify(sale.body));assert.equal(sale.body.vehicleId,'');assert.equal(sale.body.modality,modality);assert.equal(sale.body.leadSnapshot.id,lead.id);const now=(await call(env,'data','GET',null,cookie)).body;assert.equal(now.records.leads.find(l=>l.id===lead.id).status,'Fechado');}
 const used=await createLead('Seminova');assert.equal((await call(env,'sales','POST',createSale(used),cookie)).status,400);
 assert.equal((await call(env,'vehicles','POST',payload('vehicles',{name:'Moto',category:'Moto',condition:'Novo',plate:'AAA0001',year:'2026',storeId:store.id}),cookie)).status,400);
 const vehicle=await call(env,'vehicles','POST',payload('vehicles',{name:'Honda CG 160 Fan',category:'Moto',plate:'AAA0001',year:'2025',status:'Disponível',storeId:store.id,purchase:12000,price:18000}),cookie);assert.equal(vehicle.status,201,JSON.stringify(vehicle.body));assert.equal(vehicle.body.condition,'Seminovo');
 const sale=await call(env,'sales','POST',{...createSale(used),vehicleId:vehicle.body.id,cost:1},cookie);assert.equal(sale.status,201,JSON.stringify(sale.body));assert.equal(sale.body.cost,12000);
 assert.equal((await call(env,'sales','POST',{...createSale(used),vehicleId:vehicle.body.id},cookie)).status,409);
 assert.equal((await call(env,'sales','POST',{...createSale(used),leadId:'inexistente'},cookie)).status,403);
 assert.equal((await call(env,'leads','POST',payload('leads',{name:'Inválido',phone:'123',storeId:store.id,userId:me.id,modality:'À vista',category:'Automóvel',model:'CG 160 Fan'}),cookie)).status,400);db.close();
});
test('migração preserva vendas anteriores e permite vínculo nulo com estoque',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of ['0000_normal_white_tiger.sql','0001_aromatic_madripoor.sql'])db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const now='2026-09-28T12:00:00Z';const insert=(table,extra)=>{const o={id:table+'1',data:'{}',created_at:now,updated_at:now,...extra};db.prepare(`INSERT INTO ${table} (${Object.keys(o).join(',')}) VALUES (${Object.keys(o).map(()=>'?').join(',')})`).run(...Object.values(o));};
 insert('stores',{});insert('users',{store_id:'stores1',email:'test@example.test'});insert('leads',{store_id:'stores1',user_id:'users1'});insert('vehicles',{store_id:'stores1',plate:'ABC1234'});insert('sales',{store_id:'stores1',user_id:'users1',lead_id:'leads1',vehicle_id:'vehicles1',status:'Concluída',data:'{"amount":12345}'});
 db.exec('BEGIN');db.exec(fs.readFileSync('drizzle/0002_thick_clint_barton.sql','utf8'));db.exec('COMMIT');assert.equal(db.prepare('SELECT data FROM sales').get().data,'{"amount":12345}');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 insert('sales',{id:'sale2',store_id:'stores1',user_id:'users1',lead_id:'leads1',vehicle_id:null,status:'Concluída'});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sales').get().n,2);db.close();
});

test('dossiê completo persiste campos e documentos com acesso protegido',async()=>{
 const {env}=setup();const objects=new Map();env.PHOTOS={put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{body:objects.get(k)}:null};
 const boot=await call(env,'auth/setup','POST',{company:'Empresa',name:'Admin',cpf:'52998224725',password:testPassword(13)},'',{'oai-authenticated-user-email':'admin@example.test'});const cookie=boot.cookie;
 const all=(await call(env,'data','GET',null,cookie)).body,store=all.records.stores[0],me=all.me;
 const lead=(await call(env,'leads','POST',payload('leads',{name:'Cliente',phone:'75999999999',storeId:store.id,userId:me.id,modality:'Financiamento',category:'Moto',model:'CG 160 Fan'}),cookie)).body;
 const body=payload('sales',{leadId:lead.id,storeId:store.id,userId:me.id,amount:20000,status:'Concluída',dossierVersion:1,customerName:'Cliente Completo',customerPhone:'(75) 99999-9999',customerCpf:'529.982.247-25',customerRg:'123456',customerEmail:'cliente@example.test',birthDate:'1993-11-20',saleType:'Venda direta',postalCode:'44380-000',street:'Rua A',streetNumber:'10',neighborhood:'Centro',state:'BA',city:'Cruz das Almas',manufacturingYear:'2026',modelYear:'2026',downPayment:2000,installments:48,installmentType:'Mensal',bank:'Banco',color:'Preta',freight:150,accessories:100,registration:'Sim',registrationAmount:500,vehicleInStore:'Sim',documents:[{slot:'identityFront',name:'documento.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4\n%%EOF').toString('base64')}]});
 assert.equal((await call(env,'sales','POST',{...body,customerCpf:'11111111111'},cookie)).status,400);
 const saved=await call(env,'sales','POST',body,cookie);assert.equal(saved.status,201,JSON.stringify(saved.body));assert.equal(saved.body.customerCpf,body.customerCpf);assert.equal(saved.body.bank,'BANCO');assert.match(saved.body.saleCode,/^C[1-9][0-9]*$/);assert.equal(saved.body.documents.length,1);assert(!JSON.stringify(saved.body.documents).includes('base64'));
 const path=saved.body.documents[0].url;const request=c=>new Request('https://example.test'+path,{headers:{Cookie:c}});
 assert.equal((await worker.fetch(request(''),env)).status,401);assert.equal((await worker.fetch(request(cookie),env)).status,200);
 const update=await call(env,'sales/'+saved.body.id,'PUT',{...saved.body,notes:'Conferido',saleCode:'FORGED'},cookie);assert.equal(update.status,200,JSON.stringify(update.body));assert.equal(update.body.documents[0].id,saved.body.documents[0].id);assert.equal(update.body.saleCode,saved.body.saleCode);
 const forged=await call(env,'sales/'+saved.body.id,'PUT',{...update.body,documents:[{slot:'identityFront',id:'another-file'}]},cookie);assert.equal(forged.status,400);
 const loaded=(await call(env,'data','GET',null,cookie)).body.records.sales.find(s=>s.id===saved.body.id);assert.equal(loaded.city,'CRUZ DAS ALMAS');assert.equal(loaded.documents[0].name,'documento.pdf');
});

test('consórcio exige apenas os campos específicos e preserva o plano da venda',async()=>{
 const {saleConsortiumRules}=await import('../server/sales.js');
 const plan={id:'p',administratorId:'honda',model:'CG',months:80,installmentCents:30000};
 const data={modality:'Consórcio',status:'Concluída',salePlanId:'p',consortium:plan,customerDocument:'529.982.247-25',proposalNumber:'12345',proposalDigit:'0',quotaType:'Nova',postalCode:'44380-000',city:'Cruz das Almas',consortiumInstallments:80,consortiumInstallment:300};
 const available={plans:[plan],enabledAdministratorIds:['honda']};
 const saved=saleConsortiumRules(data,{consortiumFormVersion:1},null,available);
 assert.equal(saved.customerDocument,'52998224725');assert.equal(saved.consortium.installmentCents,30000);assert.equal(saved.consortiumFormVersion,1);
 assert.throws(()=>saleConsortiumRules({...data,proposalDigit:''},{consortiumFormVersion:1},null,available),/proposta/);
 assert.throws(()=>saleConsortiumRules({...data,salePlanId:'missing'},{consortiumFormVersion:1},null,available),/plano/);
 const updated=saleConsortiumRules(saved,{},saved,{plans:[],enabledAdministratorIds:[]});assert.equal(updated.consortium.id,'p');
});
