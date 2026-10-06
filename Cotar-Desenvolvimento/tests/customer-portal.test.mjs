import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {pgAdapter} from '../server/postgres-adapter.js';
import {modules} from '../public/config.js';
import app from '../supabase/functions/cotar-api/app.js';
import gateway from '../server/gateway.js';
import {testPassword} from './generated-test-password.mjs';
function sqlite(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+file,'utf8'));const DB={prepare(sql){const statement=db.prepare(sql);let args=[];const query={bind(...values){args=values;return query},async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}};return query},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}};return {env:{DB},close:()=>db.close()}}
function pgClient(db){return {async unsafe(sql,args){const result=await db.query(sql,args),rows=result.rows;rows.count=result.affectedRows??rows.length;return rows},begin:fn=>db.transaction(tx=>fn(pgClient(tx)))}}
async function postgres(){const db=new PGlite();await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await db.exec(fs.readFileSync('supabase/migrations/20260927190839_cotar_backend.sql','utf8'));await db.exec(fs.readFileSync('supabase/billing-schema.sql','utf8'));return {env:{DB:pgAdapter(pgClient(db))},close:()=>db.close()}}
function payload(kind,extra){return {...Object.fromEntries(modules[kind].fields.filter(f=>f.type!=='computed').map(f=>[f.key,f.type==='number'?0:f.type==='date'?new Date().toISOString().slice(0,10):f.type==='select'?f.options[0]:f.type==='screens'?[]:''])),...extra}}
async function call(env,path,method='GET',body,cookie='',headers={}){const response=await app.fetch(new Request('https://cotar.test/api/'+path,{method,headers:{Origin:'https://cotar.test','Content-Type':'application/json',Cookie:cookie,'oai-authenticated-user-email':'admin@example.test',...headers},body:body?JSON.stringify(body):undefined}),env);return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]}}
for(const [name,setup] of [['SQLite',sqlite],['PostgreSQL',postgres]])test(`${name}: client invitation, scoped purchases, billing timeline, revision scheduling, private photos and valuation`,async()=>{
 const {env,close}=await setup(),objects=new Map();env.PHOTOS={async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null}};
 try {
  const boot=await call(env,'auth/setup','POST',{name:'Equipe Winner',company:'Winner',cpf:'52998224725',password:testPassword(50)});assert.equal(boot.status,201,JSON.stringify(boot.body));const staff=boot.cookie,data=(await call(env,'data','GET',null,staff)).body,store=data.me.storeId;
  const admin=(tail='')=>`customer-admin/${store}${tail}`,client=(tail)=>`customer/${store}/${tail}`;
  assert.equal((await call(env,client('info'))).status,404);
  let r=await call(env,admin('/config'),'PUT',{version:0,enabled:true,canEvaluate:true,displayName:'Winner',whatsapp:'75999999999'},staff);assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal((await call(env,client('info'))).body.store.name,'Winner');
  assert.equal((await call(env,client('dashboard'))).status,401);
  const createSale=async name=>{
   const lead=await call(env,'leads','POST',{name,phone:'75999999999',email:'',source:'Loja',modality:'À vista',category:'Moto',model:'CG 160 Fan',temperature:'Morno',status:'Agendado',scheduledAt:new Date(Date.now()+86400000).toISOString(),storeId:store,userId:data.me.id,notes:''},staff);assert.equal(lead.status,201,JSON.stringify(lead.body));
   const sale=await call(env,'sales','POST',payload('sales',{leadId:lead.body.id,storeId:store,userId:data.me.id,status:'Em negociação',amount:21000,cost:17000}),staff);assert.equal(sale.status,201,JSON.stringify(sale.body));return sale.body;
  };
  const saleA=await createSale('Cliente Ana'),saleB=await createSale('Cliente Bruno');
  const invite=async(sale,email)=>{const result=await call(env,admin(`/orders/${sale.id}/invite`),'POST',{email,name:email.startsWith('ana')?'Ana':'Bruno',identityConfirmed:true},staff);assert.equal(result.status,201,JSON.stringify(result.body));return new URL(result.body.url).hash.split('=')[1]};
  const tokenA=await invite(saleA,'ana@example.test'),tokenB=await invite(saleB,'bruno@example.test');
  const activateA=await call(env,client('auth/activate'),'POST',{token:tokenA,email:'ana@example.test',password:testPassword(51)});assert.equal(activateA.status,201,JSON.stringify(activateA.body));const ana=activateA.cookie;
  const activateB=await call(env,client('auth/activate'),'POST',{token:tokenB,email:'bruno@example.test',password:testPassword(52)});assert.equal(activateB.status,201,JSON.stringify(activateB.body));const bruno=activateB.cookie;
  assert.equal((await call(env,client('auth/activate'),'POST',{token:tokenA,email:'ana@example.test',password:testPassword(51)})).status,400);
  let dashboard=(await call(env,client('dashboard'),'GET',null,ana)).body;assert.equal(dashboard.orders.length,1);assert.equal(dashboard.orders[0].id,saleA.id);assert.equal(dashboard.orders[0].amount,undefined);assert.equal(dashboard.orders[0].cost,undefined);assert.equal(dashboard.orders[0].customerCpf,undefined);assert.ok(!JSON.stringify(dashboard).includes('bruno@example.test'));
  r=await call(env,admin(`/orders/${saleA.id}/progress`),'PUT',{version:0,stage:'Moto faturada',publicNote:'Nota emitida; estamos preparando sua moto.',invoiceNumber:'NF-TESTE'},staff);assert.equal(r.status,200,JSON.stringify(r.body));
  dashboard=(await call(env,client('dashboard'),'GET',null,ana)).body;assert.equal(dashboard.orders[0].stage,'Moto faturada');assert.equal(dashboard.orders[0].invoiceNumber,'NF-TESTE');assert.equal(dashboard.orders[0].history.length,1);
  assert.equal((await call(env,admin(`/orders/${saleA.id}/progress`),'PUT',{version:0,stage:'Entregue'},staff)).status,409);
  assert.equal((await call(env,admin(`/orders/${saleB.id}/invite`),'POST',{email:'ana@example.test',name:'Ana',identityConfirmed:true},staff)).status,409);
  const preferredAt=new Date(Date.now()+3*86400000).toISOString(),service={submissionId:crypto.randomUUID(),saleId:saleA.id,preferredAt,mileage:1000,phone:'75999999999',notes:'Primeira revisão'};
  assert.equal((await call(env,client('services'),'POST',{...service,saleId:saleB.id},ana)).status,404);
  r=await call(env,client('services'),'POST',service,ana);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal((await call(env,client('services'),'POST',service,ana)).status,200);
  assert.equal((await call(env,client('services'),'POST',{...service,mileage:500},ana)).status,409);
  assert.equal((await call(env,client('dashboard'),'GET',null,bruno)).body.services.length,0);
  r=await call(env,admin(`/services/${service.submissionId}`),'PUT',{version:1,status:'Confirmada',confirmedAt:preferredAt,response:'Esperamos você na oficina.'},staff);assert.equal(r.status,200,JSON.stringify(r.body));
  const another={...service,submissionId:crypto.randomUUID(),saleId:saleB.id};assert.equal((await call(env,client('services'),'POST',another,bruno)).status,201);
  assert.equal((await call(env,admin(`/services/${another.submissionId}`),'PUT',{version:1,status:'Confirmada',confirmedAt:preferredAt},staff)).status,409);
  assert.equal((await call(env,client(`services/${service.submissionId}/cancel`),'POST',{version:2},bruno)).status,404);
  assert.equal((await call(env,client(`services/${service.submissionId}/cancel`),'POST',{version:1},ana)).status,409);
  assert.equal((await call(env,client(`services/${service.submissionId}/cancel`),'POST',{version:2},ana)).status,200);
  assert.equal((await call(env,admin(`/services/${another.submissionId}`),'PUT',{version:1,status:'Confirmada',confirmedAt:preferredAt},staff)).status,200);
  const bytes=fs.readFileSync('tests/fixtures/avatar.jpg'),valuation={submissionId:crypto.randomUUID(),consent:true,model:'Honda Biz',plate:'ABC1D23',year:'2023/2024',mileage:5000,expectedValue:14000,notes:'Moto revisada',photos:[{data:'data:image/jpeg;base64,'+bytes.toString('base64')}]};
  assert.equal((await call(env,client('valuations'),'POST',{...valuation,consent:false},ana)).status,400);
  r=await call(env,client('valuations'),'POST',valuation,ana);assert.equal(r.status,201,JSON.stringify(r.body));assert.equal((await call(env,client('valuations'),'POST',valuation,ana)).status,200);
  const anaState=(await call(env,client('dashboard'),'GET',null,ana)).body;assert.equal(anaState.valuations.length,1);assert.equal((await call(env,client('dashboard'),'GET',null,bruno)).body.valuations.length,0);
  const photoURL=anaState.valuations[0].photos[0].url;
  for(const [cookie,status] of [[ana,200],[bruno,404],['',401]]){const photo=await app.fetch(new Request('https://cotar.test'+photoURL,{headers:{Cookie:cookie}}),env);assert.equal(photo.status,status);if(status===200){assert.equal(photo.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),bytes)}}
  r=await call(env,admin(`/valuations/${valuation.submissionId}`),'PUT',{version:1,status:'Avaliação preliminar',estimatedValue:13500,response:'Valor sujeito à vistoria presencial.'},staff);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal((await call(env,client('dashboard'),'GET',null,ana)).body.valuations[0].estimatedValue,13500);
  assert.equal((await call(env,admin(),'GET',null,ana)).status,401);
  assert.equal((await call(env,'data','GET',null,ana)).status,401);
  assert.equal((await call(env,client('services'),'POST',{...service,submissionId:crypto.randomUUID()},ana,{Origin:'https://evil.test'})).status,403);
  const secondStore=await call(env,'stores','POST',payload('stores',{name:'Outra concessionária',regionId:data.me.regionId,city:'Cidade',state:'BA',status:'Ativa'}),staff);assert.equal(secondStore.status,201,JSON.stringify(secondStore.body));
  r=await call(env,`customer-admin/${secondStore.body.id}/config`,'PUT',{version:0,enabled:true,canEvaluate:true,displayName:'Outra loja',whatsapp:''},staff);assert.equal(r.status,200);
  assert.equal((await call(env,`customer/${secondStore.body.id}/dashboard`,'GET',null,ana)).status,401);
  const management=(await call(env,admin(),'GET',null,staff)).body,link=management.orders.find(o=>o.id===saleA.id);
  assert.equal((await call(env,admin(`/orders/${saleA.id}/revoke`),'POST',{version:link.linkVersion},staff)).status,200);
  assert.equal((await call(env,client('dashboard'),'GET',null,ana)).body.orders.length,0);
  assert.equal((await call(env,client('services'),'POST',{...service,submissionId:crypto.randomUUID()},ana)).status,404);
  const renewed=await invite(saleA,'ana@example.test');assert.equal((await call(env,client('auth/activate'),'POST',{token:renewed,email:'ana@example.test',password:testPassword(53)})).status,401);
  assert.equal((await call(env,client('auth/activate'),'POST',{token:renewed,email:'ana@example.test',password:testPassword(51)})).status,201);
  assert.equal((await call(env,client('auth/logout'),'POST',{},ana)).status,200);assert.equal((await call(env,client('dashboard'),'GET',null,ana)).status,401);
  assert.equal((await call(env,client('auth/login'),'POST',{email:'ana@example.test',password:testPassword(51)})).status,200);
 }finally{await close()}
});
test('customer PWA has its own entry and manifest, without internal CRM start URL',async()=>{
 const store=crypto.randomUUID();const page=await gateway.fetch(new Request('https://cotar.test/cliente/'+store),{});assert.equal(page.status,200);assert.match(await page.text(),/customer.js/);
 const manifest=await gateway.fetch(new Request(`https://cotar.test/cliente/${store}/manifest.webmanifest`),{});assert.equal(manifest.headers.get('content-type'),'application/manifest+json');const data=await manifest.json();assert.equal(data.start_url,'/cliente/'+store);assert.equal(data.scope,'/cliente/');assert.notEqual(data.start_url,'/login');
 const icon=await gateway.fetch(new Request('https://cotar.test/winner-icon-192.png'),{});assert.equal(icon.headers.get('content-type'),'image/png');assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
});
