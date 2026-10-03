import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {pgAdapter} from '../server/postgres-adapter.js';
import app from '../supabase/functions/cotar-api/app.js';
import {offlineCreate} from '../server/offline-create.js';
import {testPassword} from './generated-test-password.mjs';
import {deriveVaultKey,encryptVault,decryptVault,prepareSnapshot,snapshotFresh,newPending,synchronizePending} from '../public/offline-store.js';

function sqlite(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(sql){const statement=db.prepare(sql);let args=[];const bound={bind(...values){args=values;return bound},async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}};return bound},async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}}};
 return {env:{DB},close:()=>db.close()};
}
function client(db){return {async unsafe(sql,args){const result=await db.query(sql,args);const rows=result.rows;rows.count=result.affectedRows??rows.length;return rows},begin:fn=>db.transaction(tx=>fn(client(tx)))}}
async function postgres(){const db=new PGlite();await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await db.exec(fs.readFileSync('supabase/migrations/20260927190839_cotar_backend.sql','utf8'));await db.exec(fs.readFileSync('supabase/billing-schema.sql','utf8'));return {env:{DB:pgAdapter(client(db))},close:()=>db.close()}}
async function call(env,path,method='GET',body,cookie=''){
 const response=await app.fetch(new Request('https://example.test/api/'+path,{method,headers:{Origin:'https://example.test','Content-Type':'application/json',Cookie:cookie,'oai-authenticated-user-email':'admin@example.test'},body:body?JSON.stringify(body):undefined}),env);
 return {status:response.status,body:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]};
}
for(const [name,setup] of [['SQLite',sqlite],['PostgreSQL',postgres]])test(`${name}: offline retries create one record, changed payload conflicts, drafts stay unfinished`,async()=>{
 const {env,close}=await setup();
 try {
  const boot=await call(env,'auth/setup','POST',{company:'Teste offline',name:'Administrador',cpf:'52998224725',password:testPassword(45)});
  assert.equal(boot.status,201,JSON.stringify(boot.body));const cookie=boot.cookie;
  const data=(await call(env,'data','GET',null,cookie)).body;
  const body={offlineMutationId:crypto.randomUUID(),name:'Contato offline',phone:'75999999999',email:'',source:'Loja',modality:'À vista',category:'Moto',model:'CG 160 Fan',temperature:'Morno',status:'Agendado',scheduledAt:new Date(Date.now()+86400000).toISOString(),storeId:data.me.storeId,userId:data.me.id,notes:'Registrado sem conexão'};
  const first=await call(env,'leads','POST',body,cookie);assert.equal(first.status,201,JSON.stringify(first.body));assert.equal(first.body.id,body.offlineMutationId);
  const again=await call(env,'leads','POST',body,cookie);assert.equal(again.status,200,JSON.stringify(again.body));assert.equal(again.body.id,first.body.id);
  assert.equal((await call(env,'data','GET',null,cookie)).body.records.leads.length,1);
  assert.equal((await call(env,'leads','POST',{...body,name:'Outro conteúdo'},cookie)).status,409);
  const edited=await call(env,'leads/'+first.body.id,'PUT',{...first.body,notes:'Atualizado na nuvem'},cookie);assert.equal(edited.status,200,JSON.stringify(edited.body));
  const afterEdit=await call(env,'leads','POST',body,cookie);assert.equal(afterEdit.status,200);assert.match(afterEdit.body.notes,/ATUALIZADO/);assert.equal(afterEdit.body.version,2);
  const draft={offlineMutationId:crypto.randomUUID(),plate:'ABC1D23',model:'Honda CG',stage:'Consultas',vehicleDetails:{mileage:200},clientDetails:{name:'Cliente local',phone:'75000000000'},checklist:{engineCondition:{state:'BOM',cost:0,note:''}},checklistNotes:'Análise inicial'};
  const saved=await call(env,'used-evaluations','POST',draft,cookie);assert.equal(saved.status,201,JSON.stringify(saved.body));assert.equal(saved.body.id,draft.offlineMutationId);assert.equal(saved.body.status,'Em andamento');assert.equal(saved.body.completedAt,'');
  const repeated=await call(env,'used-evaluations','POST',draft,cookie);assert.equal(repeated.status,201);assert.equal(repeated.body.id,saved.body.id);
  assert.equal((await call(env,'used-evaluations','GET',null,cookie)).body.items.length,1);
  assert.equal((await call(env,'used-evaluations','POST',{...draft,finalize:true},cookie)).status,400);
  assert.equal((await call(env,'leads','POST',{...body,offlineMutationId:'invalid'},cookie)).status,400);
  assert.equal((await call(env,'leads','POST',body)).status,401);
  await call(env,'auth/logout','POST',{},cookie);
  assert.equal((await call(env,'leads','POST',body,cookie)).status,401);
 }finally{await close()}
});

test('vault encryption rejects wrong code and stores no readable business data',async()=>{
 const salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveVaultKey('84726195',salt);
 const value={snapshot:{user:{name:'CLIENTE CONFIDENCIAL'}},pending:[{body:{phone:'75912345678'}}]};
 const record=await encryptVault(value,key,salt,1);
 assert.equal(record.pendingCount,1);assert.equal(key.extractable,false);
 assert.ok(!new TextDecoder().decode(record.ciphertext).includes('CLIENTE'));
 assert.deepEqual(await decryptVault(record,key),value);
 const wrong=await deriveVaultKey('19384726',salt);await assert.rejects(()=>decryptVault(record,wrong),/Código incorreto/);
 await assert.rejects(()=>deriveVaultKey('1234',salt),/8 a 12/);
});

test('snapshot excludes customers, sessions, documents, costs and identity numbers, and expires',()=>{
 const result={offlineSyncVersion:1,me:{id:'u',companyId:'c',storeId:'s',name:'Pessoa',cpf:'secret',email:'private'},permissions:{screens:['leads','sales','users']},lookups:{stores:[{id:'s',name:'Loja'}]},catalogue:{enabledAdministratorIds:['honda'],plans:[{id:'p',model:'CG',administratorId:'honda',active:true},{id:'disabled',administratorId:'honda',active:false}]},records:{leads:[{name:'Cliente confidencial'}]}};
 const snapshot=prepareSnapshot(result,{items:[{id:'v',companyId:'c',name:'CG',purchase:1000,plate:'ABC1234',clientDetails:{cpf:'private'}}]},1000);
 assert.equal(snapshot.plans.length,1);assert.equal(snapshot.stock.length,1);assert.equal(snapshot.user.cpf,undefined);assert.equal(snapshot.stock[0].purchase,undefined);assert.equal(snapshot.stock[0].plate,undefined);assert.ok(!JSON.stringify(snapshot).includes('Cliente confidencial'));assert.equal(snapshotFresh(snapshot,1001),true);assert.equal(snapshotFresh(snapshot,snapshot.expiresAt),false);assert.equal(snapshotFresh(snapshot,-90000),false);
});

test('sync preserves ambiguous sends, blocks validation failures and never sends as another user',async()=>{
 const snapshot={user:{id:'u',companyId:'c'}};
 let payload={snapshot,pending:[newPending('lead',{name:'local'})]},writes=0,calls=0;
 const data={offlineSyncVersion:1,me:{id:'u',companyId:'c'},permissions:{screens:['leads']}};
 const persist=async next=>{writes++;payload.pending=next.pending};
 await assert.rejects(()=>synchronizePending(payload,async path=>path==='data'?{...data,me:{id:'other',companyId:'c'}}:(calls++,{}),persist),/mesmo usuário/);assert.equal(calls,0);assert.equal(writes,0);
 await assert.rejects(()=>synchronizePending(payload,async path=>{if(path==='data')return data;throw Error('Conexão caiu')},persist),/caiu/);assert.equal(payload.pending.length,1);assert.equal(payload.pending[0].attempted,true);assert.equal(payload.pending[0].state,'pending');
 await synchronizePending(payload,async(path,options)=>{if(path==='data')return data;return {id:JSON.parse(options.body).offlineMutationId}},persist);assert.equal(payload.pending.length,0);
 payload.pending=[newPending('lead',{name:'invalid'})];
 await synchronizePending(payload,async path=>{if(path==='data')return data;throw Object.assign(Error('Plano mudou'),{status:400})},persist);assert.equal(payload.pending[0].state,'blocked');assert.equal(payload.pending[0].canEdit,true);
});

test('a failed durable write prevents POST; an unsupported server response stays pending',async()=>{
 const payload={snapshot:{user:{id:'u',companyId:'c'}},pending:[newPending('evaluation',{})]},data={offlineSyncVersion:1,me:{id:'u',companyId:'c'},permissions:{screens:['sales']}};let calls=0;
 await assert.rejects(()=>synchronizePending(payload,async path=>path==='data'?data:(calls++,{}),async()=>{throw Error('Quota exceeded')}),/Quota/);assert.equal(calls,0);
 await assert.rejects(()=>synchronizePending(payload,async path=>path==='data'?data:{id:'unrelated'},async next=>{payload.pending=next.pending}),/não confirmou/);assert.equal(payload.pending.length,1);
});

test('offline receipt is scoped to its creator and company, including a changed company',async()=>{
 const body={offlineMutationId:crypto.randomUUID(),name:'Local'},actor={id:'u',companyId:'c'};
 const identity=await offlineCreate(body,actor,[]);
 const existing={id:identity.id,offlineMutationHash:identity.hash,companyId:'c',createdBy:'u'};
 assert.equal((await offlineCreate(body,actor,[existing])).existing,existing);
 await assert.rejects(()=>offlineCreate(body,{id:'other',companyId:'c'},[existing]),error=>error.status===409);
 await assert.rejects(()=>offlineCreate(body,{id:'u',companyId:'other'},[existing]),error=>error.status===409);
});

test('an older backend never receives queued offline writes',async()=>{
 const payload={snapshot:{user:{id:'u',companyId:'c'}},pending:[newPending('lead',{})]};let calls=0;
 await assert.rejects(()=>synchronizePending(payload,async path=>{if(path==='data')return {me:{id:'u',companyId:'c'},permissions:{screens:['leads']}};calls++;},async()=>{}),/Atualize o Cotar/);
 assert.equal(calls,0);assert.equal(payload.pending.length,1);
});
