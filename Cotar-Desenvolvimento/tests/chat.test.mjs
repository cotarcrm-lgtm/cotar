import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {chatRequest,chatAudience} from '../server/chat.js';
import {modules,checkNames} from '../public/config.js';
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+f,'utf8'));const DB={prepare(sql){const stmt=db.prepare(sql);let args=[];const api={bind(...v){args=v;return api},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}}}};return api},async batch(stmts){db.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}};return {db,env:{DB}}}

test('chat: alcance, envio individual, anexos privados, leituras e listas',async()=>{
 const {db,env}=setup(),companyId='c';
 const row=(id,more={})=>({id,companyId,status:'Ativo',name:id,storeId:'s',teamId:'t',...more});
 const admin=row('admin',{role:'Administrador'}),sup=row('sup',{role:'Supervisor'}),v=row('v',{role:'Vendedor'}),other=row('other',{role:'Vendedor',teamId:'t2'});
 const all={users:[admin,sup,v,other],teams:[row('t'),row('t2')],stores:[row('s')],regions:[]};
 db.prepare("INSERT INTO stores(id,company_id,data,created_at,updated_at) VALUES('s','c','{}','2026','2026')").run();
 for(const u of all.users)db.prepare('INSERT INTO users(id,company_id,store_id,email,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(u.id,companyId,'s',u.id+'@test.local',JSON.stringify(u),'2026','2026');
 const blobs=new Map();env.PHOTOS={put:async(k,b)=>blobs.set(k,b),get:async k=>blobs.has(k)?{body:blobs.get(k)}:null};
 const call=(actor,path,body,method=body?'POST':'GET')=>chatRequest(env.DB,env,actor,all,new Request('https://test/api/chat/'+path,{method}),'/api/chat/'+path.split('?')[0],body||{});
 assert.deepEqual(chatAudience(sup,all,['t']).recipients.map(u=>u.id),['v']);
 assert.throws(()=>chatAudience(sup,all,['t2']),{status:403});assert.throws(()=>chatAudience(v,all,['t']),{status:403});
 const payload={clientId:crypto.randomUUID(),kind:'direct',recipientId:'other',text:'Olá',files:[{name:'teste.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-1.4').toString('base64')}]};
 const sent=await call(v,'send',payload);assert.equal(sent.total,1);assert.equal((await call(v,'send',payload)).alreadySent,true);
 assert.equal((await call(other,'unread')).count,1);assert.equal((await call(admin,'threads')).threads.length,0);
 const messages=(await call(other,'messages?peer=v')).messages;assert.equal(messages.length,1);assert.equal(messages[0].body,'OLÁ');
 const file=messages[0].attachments[0].url.replace('/api/chat/','');assert.equal((await call(other,file)).status,200);await assert.rejects(call(admin,file),{status:404});
 await call(other,'read',{ids:[sent.id]});assert.equal((await call(other,'unread')).count,0);
 await assert.rejects(call(v,'send',{...payload,clientId:crypto.randomUUID(),kind:'broadcast',teamIds:['t']}),{status:403});
 const list=await call(sup,'lists',{name:'Minha equipe',teamIds:['t']});const broadcast={clientId:crypto.randomUUID(),kind:'broadcast',text:'Comunicado',listId:list.id};
 assert.equal((await call(sup,'send',broadcast)).total,1);assert.equal((await call(v,'unread')).count,1);assert.equal((await call(other,'unread')).count,0);
 sup.teamId='t2';await assert.rejects(call(sup,'send',{...broadcast,clientId:crypto.randomUUID()}),{status:403});
 assert.equal((await call(v,'bootstrap')).canBroadcast,false);
 all.sales=[row('sale1',{saleCode:'C12',userId:'v',customerName:'Cliente'})];v.screens=['sales'];other.screens=['sales'];
 assert.equal((await call(v,'sales')).sales.length,0);assert.equal((await call(admin,'sales?q=C12')).sales[0].code,'C12');assert.equal((await call(other,'sales')).sales.length,0);
 const ref=await call(admin,'send',{clientId:crypto.randomUUID(),kind:'direct',recipientId:'v',saleId:'sale1'});
 const linked=(await call(v,'messages?peer=admin')).messages.find(m=>m.id===ref.id);assert.deepEqual(linked.sale,{id:'sale1',code:'C12'});
 assert.equal((await call(admin,'sales/sale1')).sale.customerName,'Cliente');await assert.rejects(call(other,'sales/sale1'),{status:404});
 await assert.rejects(call(other,'send',{clientId:crypto.randomUUID(),kind:'direct',recipientId:'admin',saleId:'sale1'}),{status:404});db.close();
});
