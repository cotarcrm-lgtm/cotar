import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {usedDecision,usedStock,syncUsedStock} from '../server/used-evaluations.js';
import {mountUsedModule} from '../public/used-module.js';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgAdapter} from '../server/postgres-adapter.js';

test('ACEITO cria um único veículo com origem e data; situação pode ser alterada',async()=>{
 const actor={id:'manager',role:'Administrador',companyId:'company',storeId:'store'};
 const assessment={id:'assessment',version:1,flowVersion:2,companyId:'company',storeId:'store',userId:'seller',model:'HONDA BIZ',plate:'ABC1234',fipe:16000,preparationTotal:900,debts:150,commercial:{purchasePrice:12000},vehicleDetails:{color:'CINZA',mileage:2500},status:'Aguardando decisão',completedAt:'2026-09-29T12:00:00Z'};
 const all={assessments:[assessment],vehicles:[],stores:[{id:'store',regionId:'region',companyId:'company',name:'ARES'}],regions:[{id:'region',name:'BA',companyId:'company'}],users:[{id:'seller',name:'ANA',companyId:'company'}]};
 const statements=[];const db={prepare(query){const stmt={query,bind(...args){stmt.args=args;return stmt},async run(){statements.push(stmt);return {meta:{changes:1}}}};return stmt},async batch(batch){statements.push(...batch);return [{meta:{changes:1}}]}};
 const accepted=await usedDecision(db,actor,all,'assessment',{version:1,decision:'ACEITO'});
 assert.equal(accepted.vehicleId,'used-assessment');
 const insert=statements.find(stmt=>stmt.query.startsWith('INSERT INTO vehicles'));
 const vehicle=JSON.parse(insert.args[1]);assert.equal(vehicle.storeId,'store');assert.equal(vehicle.regionId,'region');assert.equal(vehicle.sellerId,'seller');assert.equal(vehicle.cost,12900);assert.equal(vehicle.stockStatus,'EM POSSE DO PROPRIETÁRIO');assert.match(vehicle.captureDate,/^\d{4}-\d{2}-\d{2}$/);
 all.assessments=[{...assessment,...accepted,version:2}];all.vehicles=[{...vehicle,id:accepted.vehicleId,version:1,companyId:'company'}];statements.length=0;
 await usedDecision(db,actor,all,'assessment',{version:2,decision:'ACEITO'});
 assert.equal(statements.some(stmt=>stmt.query.startsWith('INSERT INTO vehicles')),false);
 const result=await usedStock(new Request('https://example.test/api/used-stock'),db,actor,all,null,{});
 assert.equal(result.items[0].sellerName,'ANA');assert.equal(result.items[0].regionName,'BA');
 const changed=await usedStock(new Request('https://example.test/api/used-stock/used-assessment',{method:'PUT'}),db,actor,all,'used-assessment',{version:1,stockStatus:'DISPONÍVEL PARA REVENDA',salePrice:17900});
 assert.equal(changed.status,'Disponível');assert.equal(changed.stockStatus,'DISPONÍVEL PARA REVENDA');
});

test('captação já aceita é incorporada ao estoque sem mudar a data da decisão',async()=>{
 const actor={id:'manager',role:'Administrador',companyId:'company',storeId:'store'};
 const all={assessments:[{id:'old',flowVersion:2,companyId:'company',storeId:'store',userId:'seller',version:3,status:'ACEITO',completedAt:'2026-09-28T10:00:00Z',decisionAt:'2026-09-29T10:00:00Z',commercial:{purchasePrice:8000}}],vehicles:[],stores:[{id:'store',regionId:'region'}],regions:[],users:[]};
 let batch;const db={prepare(query){const stmt={query,bind(...args){stmt.args=args;return stmt}};return stmt},async batch(statements){batch=statements}};
 const result=await syncUsedStock(db,actor,all);assert.equal(result.created,1);
 const vehicle=JSON.parse(batch[0].args[1]);assert.equal(vehicle.captureDate,'2026-09-29');assert.equal(vehicle.purchase,8000);assert.equal(JSON.parse(batch[1].args[0]).decisionAt,'2026-09-29T10:00:00Z');
 all.vehicles=[{...vehicle,id:'used-old'}];assert.equal((await syncUsedStock(db,actor,all)).created,0);
});

test('PostgreSQL: aceitar grava a decisão e cria o veículo com chave estrangeira íntegra',async()=>{
 const pg=new PGlite();
 try{
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await pg.exec(fs.readFileSync('supabase/migrations/20260927190839_cotar_backend.sql','utf8'));
  const clientFor=db=>({async unsafe(sql,args){const result=await db.query(sql,args);const rows=result.rows;rows.count=result.affectedRows??rows.length;return rows},begin:fn=>db.transaction(tx=>fn(clientFor(tx)))});
  const db=pgAdapter(clientFor(pg)),actor={id:'manager',role:'Administrador',companyId:'company',storeId:'store'};
  const row={id:'assessment',version:1,flowVersion:2,companyId:'company',storeId:'store',userId:'seller',model:'HONDA BIZ',plate:'ABC1234',status:'Aguardando decisão',completedAt:'2026-09-29T12:00:00Z',commercial:{purchasePrice:12000}};
  const all={assessments:[row],vehicles:[],stores:[{id:'store',name:'ARES',regionId:'region'}],users:[{id:'seller'}],regions:[]};
  const now=new Date().toISOString();
  await pg.query('INSERT INTO cotar.stores (id,data,created_at,updated_at) VALUES ($1,$2,$3,$3)', ['store','{}',now]);
  await pg.query('INSERT INTO cotar.users (id,data,created_at,updated_at,store_id,email) VALUES ($1,$2,$3,$3,$4,$5)', ['seller','{}',now,'store','seller@example.test']);
  await pg.query('INSERT INTO cotar.assessments (id,data,company_id,created_by,created_at,updated_at,store_id,user_id) VALUES ($1,$2,$3,$4,$5,$5,$6,$7)', ['assessment',JSON.stringify(row),'company','seller',now,'store','seller']);
  const accepted=await usedDecision(db,actor,all,'assessment',{version:1,decision:'ACEITO'});
  assert.equal(accepted.status,'ACEITO');
  const saved=await pg.query('SELECT a.data AS assessment,a.vehicle_id,v.data AS vehicle FROM cotar.assessments a JOIN cotar.vehicles v ON v.id=a.vehicle_id WHERE a.id=$1',['assessment']);
  assert.equal(saved.rows.length,1);assert.equal(saved.rows[0].assessment.status,'ACEITO');assert.equal(saved.rows[0].vehicle.assessmentId,'assessment');
 }finally{await pg.close()}
});

test('Estoque mostra dias de captação e salva situação na lista',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 let status;const item={id:'used-assessment',version:1,assessmentId:'assessment',name:'HONDA BIZ',plate:'ABC1234',captureDate:'2026-09-29',storeName:'ARES',regionName:'BA',sellerName:'ANA',stockStatus:'EM POSSE DO PROPRIETÁRIO'};
 const api=async(path,options={})=>path==='used-stock'?{items:[item]}:(status=JSON.parse(options.body).stockStatus,{version:2,stockStatus:status,status:'Disponível'});
 const dispose=mountUsedModule(root,{page:'seminovos-estoque',api,me:{role:'Administrador'}});
 await new Promise(resolve=>setTimeout(resolve,0));assert.match(root.textContent,/HONDA BIZ/);assert.match(root.textContent,/ARES/);assert.match(root.textContent,/ANA/);assert.ok(root.querySelector('[data-stock-status]'));
 const select=root.querySelector('[data-stock-status]');select.value='EM MANUTENÇÃO';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(status,'EM MANUTENÇÃO');assert.equal(root.querySelector('[data-stock-status]').value,'EM MANUTENÇÃO');dispose();dom.window.close();
});

test('filtros do estoque, reserva e edição comercial persistem com controle de versão',async()=>{
 const actor={id:'manager',name:'GERENTE',role:'Administrador',companyId:'company',storeId:'store'};
 const assessment={id:'assessment',flowVersion:2,status:'ACEITO',completedAt:'2026-09-29T12:00:00Z',companyId:'company',storeId:'store'};
 const item={id:'used-assessment',version:1,flowVersion:2,assessmentId:'assessment',companyId:'company',storeId:'store',name:'HONDA BIZ',model:'HONDA BIZ',plate:'ABC1234',chassis:'9C2AAA',captureDate:'2026-09-29',stockStatus:'DISPONÍVEL PARA REVENDA',status:'Disponível',salePrice:18900,purchase:12000,preparation:900,cost:12900};
 const all={assessments:[assessment],vehicles:[item],stores:[{id:'store',companyId:'company',name:'ARES'}],regions:[],users:[{id:'manager',name:'GERENTE'}]};
 const changes=[];const db={prepare(query){const stmt={bind(...args){stmt.args=args;return stmt},async run(){changes.push(JSON.parse(stmt.args[0]));return {meta:{changes:1}}}};return stmt}};
 const reserve=await usedStock(new Request('https://example.test/api/used-stock/used-assessment',{method:'PUT'}),db,actor,all,item.id,{version:1,action:'reserve',storeId:'store'});
 assert.equal(reserve.reservation.userId,'manager');assert.equal(changes[0].reservation.storeId,'store');
 all.vehicles=[{...item,...reserve}];
 const edit=await usedStock(new Request('https://example.test/api/used-stock/used-assessment',{method:'PUT'}),db,actor,all,item.id,{version:2,action:'edit',salePrice:18900,color:'PRATA'});
 assert.equal(edit.salePrice,18900);assert.equal(edit.cost,12900);assert.equal(edit.reservation.userId,'manager');
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 const dispose=mountUsedModule(root,{page:'seminovos-estoque',api:async()=>({items:[{...item,...edit,storeName:'ARES',sellerName:'GERENTE'}],stores:[{id:'store',name:'ARES'}]}),me:actor});
 await new Promise(resolve=>setTimeout(resolve,0));
 root.querySelector('[data-stock-filter="plate"]').value='ZZZ';root.querySelector('[data-stock-filter="plate"]').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 assert.match(root.textContent,/Nenhum veículo encontrado/);
 root.querySelector('[data-stock-clear]').click();assert.match(root.textContent,/HONDA BIZ/);
 root.querySelector('[data-stock-action="reserve"]').click();assert.match(root.textContent,/Reservado por/);
 dispose();dom.window.close();
});

test('publicação acontece no estoque e exige preço sem criar outro veículo',async()=>{
 const actor={id:'manager',role:'Administrador',companyId:'company',storeId:'store'};
 const row={id:'assessment',version:1,companyId:'company',flowVersion:2,completedAt:'2026-09-30T10:00:00Z',status:'ACEITO',storeId:'store'};
 const vehicle={id:'used-assessment',version:1,companyId:'company',flowVersion:2,assessmentId:row.id,storeId:'store',captureDate:'2026-09-30',stockStatus:'EM MANUTENÇÃO',status:'Em preparação',salePrice:0};
 const all={assessments:[row],vehicles:[vehicle],sales:[],stores:[],regions:[],users:[]};
 const db={prepare(query){const s={bind(){return s},async run(){return {meta:{changes:1}}}};return s}};
 await assert.rejects(usedDecision(db,actor,all,row.id,{version:1,decision:'DISPONÍVEL PARA REVENDA',salePrice:17900}),e=>e.status===400);
 const req=new Request('https://example.test/api/used-stock/used-assessment',{method:'PUT'});
 await assert.rejects(usedStock(req,db,actor,all,vehicle.id,{version:1,stockStatus:'DISPONÍVEL PARA REVENDA'}),e=>e.status===400);
 const updated=await usedStock(req,db,actor,all,vehicle.id,{version:1,stockStatus:'DISPONÍVEL PARA REVENDA',salePrice:17900});
 assert.equal(updated.status,'Disponível');assert.equal(updated.salePrice,17900);assert.equal(updated.captureDate,vehicle.captureDate);assert.equal(all.vehicles.length,1);
 all.sales=[{vehicleId:vehicle.id,status:'Concluída'}];await assert.rejects(usedStock(req,db,actor,all,vehicle.id,{version:1,stockStatus:'DISPONÍVEL PARA REVENDA',salePrice:19000}),e=>e.status===409);
});
