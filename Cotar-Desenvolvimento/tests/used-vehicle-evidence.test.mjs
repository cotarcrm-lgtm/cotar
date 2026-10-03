import {test} from 'node:test';
import assert from 'node:assert/strict';
import {usedEvidence,usedDelete} from '../server/used-evaluations.js';
import {usedExport} from '../server/used-export.js';
import {usedDecision} from '../server/used-evaluations.js';

test('fotos e documentos do veículo são privados e vinculados à avaliação',async()=>{
 const actor={id:'user',role:'Administrador',companyId:'company',storeId:'store'};
 const row={id:'evaluation',flowVersion:2,companyId:'company',storeId:'store',userId:'user',version:1,consultations:{},vehicleFiles:{}};
 let stored,updated;
 const env={PHOTOS:{async put(key,bytes){stored={key,bytes}},async get(key){return key===stored?.key?{body:new Blob([stored.bytes]).stream()}:null}}};
 const db={prepare(){return {bind(data){updated=JSON.parse(data);return {async run(){return {meta:{changes:1}}}}}}}};
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 const data='data:image/png;base64,'+Buffer.from(png).toString('base64');
 const attachment=await usedEvidence(new Request('https://example.test/api/used-evaluations/evaluation/evidence/front',{method:'POST'}),env,db,actor,{assessments:[row],stores:[],regions:[],users:[]},'evaluation','front',{name:'frente.png',data});
 assert.equal(updated.vehicleFiles.front.id,attachment.id);assert.equal(stored.key,`used/company/evaluation/front/${attachment.id}`);
 const response=await usedEvidence(new Request('https://example.test/api/used-evaluations/evaluation/evidence/front?preview=1'),env,db,actor,{assessments:[{...row,vehicleFiles:updated.vehicleFiles}],stores:[],regions:[],users:[]},'evaluation','front',{});
 assert.match(response.headers.get('content-disposition'),/^inline/);assert.equal(response.headers.get('cache-control'),'private, no-store');
 await assert.rejects(()=>usedEvidence(new Request('https://example.test/api/used-evaluations/evaluation/evidence/front'),env,db,{...actor,companyId:'other'},{assessments:[row],stores:[],regions:[],users:[]},'evaluation','front',{}));
});

test('cadastro comercial e geral mantém valores da avaliação e calcula custo',async()=>{
 const {usedEvaluations}=await import('../server/used-evaluations.js');
 const actor={id:'user',role:'Administrador',companyId:'company',storeId:'store'};
 const row={id:'evaluation',flowVersion:2,companyId:'company',storeId:'store',userId:'user',version:1,createdAt:'2026-09-29T00:00:00Z',consultations:{ipva:{state:'COM DEBITO',amount:60}},checklist:{frontShock:{state:'TROCAR',cost:250}}};
 let persisted;const db={prepare(query){const stmt={query,bind(...args){stmt.args=args;return stmt},async run(){if(query.startsWith('UPDATE assessments'))persisted=JSON.parse(stmt.args[0]);return {meta:{changes:1}}}};return stmt},async batch(statements){persisted=JSON.parse(statements[0].args[0]);return [{meta:{changes:1}}]}};
 const result=await usedEvaluations(new Request('https://example.test/api/used-evaluations/evaluation',{method:'PUT'}),db,actor,{assessments:[row],stores:[{id:'store',companyId:'company'}],regions:[],users:[]},{version:1,stage:'Veículo',plate:'ABC1234',consultations:row.consultations,checklist:row.checklist,vehicleDetails:{manufacturingYear:'2025',modelYear:'2026',color:'PRETA',engineNumber:'ABC123',mileage:1200},commercial:{negotiationType:'COMPRA',purchasePrice:15000,transfer:100,payoffDebt:300}},'evaluation');
 assert.equal(result.stage,'Veículo');assert.equal(result.preparationTotal,250);assert.equal(result.debts,60);assert.equal(result.vehicleDetails.engineNumber,'ABC123');assert.equal(persisted.commercial.purchasePrice,15000);
});

test('finalização registra cliente e decisão de captação requer gestor',async()=>{
 const {usedEvaluations}=await import('../server/used-evaluations.js');
 const actor={id:'gestor',role:'Administrador',companyId:'company',storeId:'store'};
 const row={id:'evaluation',flowVersion:2,companyId:'company',storeId:'store',userId:'gestor',version:1,stage:'Cliente',consultations:{}};
 let persisted;const db={prepare(query){const stmt={query,bind(...args){stmt.args=args;return stmt},async run(){if(query.startsWith('UPDATE assessments'))persisted=JSON.parse(stmt.args[0]);return {meta:{changes:1}}}};return stmt},async batch(statements){persisted=JSON.parse(statements[0].args[0]);return [{meta:{changes:1}}]}};
 const body={version:1,stage:'Fechamento',closingTaxPercent:5,finalize:true,clientDetails:{isOwner:true,cpf:'52998224725',name:'MARIA SILVA',rg:'12345',birthDate:'1990-01-02',phone:'11999999999',email:'maria@example.com',cep:'01001000',street:'PRAÇA DA SÉ',number:'1',district:'SÉ',city:'SÃO PAULO',state:'SP'}};
 const complete=await usedEvaluations(new Request('https://example.test/api/used-evaluations/evaluation',{method:'PUT'}),db,actor,{assessments:[row],stores:[{id:'store',companyId:'company'}],regions:[],users:[]},body,'evaluation');
 assert.equal(complete.status,'Aguardando decisão');assert.ok(complete.completedAt);assert.equal(persisted.clientDetails.name,'MARIA SILVA');
 const all={assessments:[complete],stores:[],regions:[],users:[]};
 await assert.rejects(()=>usedDecision(db,{...actor,role:'Vendedor'},all,'evaluation',{version:2,decision:'Captar'}));
 const decided=await usedDecision(db,actor,all,'evaluation',{version:2,decision:'Captar'});
 assert.equal(decided.status,'ACEITO');assert.equal(persisted.decision,'ACEITO');
});

test('arquivo completo inclui relatório, dados e anexos',async()=>{
 const actor={id:'gestor',role:'Administrador',companyId:'company',storeId:'store'};
 const bytes=new TextEncoder().encode('%PDF-documento');
 const row={id:'evaluation',flowVersion:2,companyId:'company',storeId:'store',userId:'gestor',version:2,completedAt:'2026-09-29T12:00:00Z',plate:'ABC1234',model:'HONDA',status:'Aguardando decisão',clientDetails:{name:'MARIA'},consultations:{},clientFiles:{ownerId:{id:'file',name:'rg.pdf',type:'application/pdf',size:bytes.length}}};
 const env={PHOTOS:{async get(key){return key==='used/company/evaluation/ownerId/file'?{body:new Blob([bytes]).stream()}:null}}};
 const response=await usedExport(new Request('https://example.test/api/used-evaluations/evaluation/export'),env,actor,{assessments:[row],stores:[],regions:[],users:[]},'evaluation');
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/zip');
 const zip=new Uint8Array(await response.arrayBuffer());const text=new TextDecoder().decode(zip);
 assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);assert.match(text,/avaliacao.html/);assert.match(text,/dados.json/);assert.match(text,/anexos\/ownerId-file.pdf/);assert.match(text,/MARIA/);
 await assert.rejects(()=>usedExport(new Request('https://example.test/api/used-evaluations/evaluation/export'),env,{...actor,companyId:'other'},{assessments:[row],stores:[],regions:[],users:[]},'evaluation'));
});

test('exclui somente rascunho da própria operação e remove seus anexos',async()=>{
 const actor={id:'user',role:'Administrador',companyId:'company',storeId:'store'};
 const row={id:'evaluation',flowVersion:2,companyId:'company',storeId:'store',userId:'user',version:3,status:'Em andamento',vehicleFiles:{front:{id:'photo'}},consultations:{licensing:{attachment:{id:'proof'}}}};
 let deleted=false;const keys=[];const db={prepare(sql){assert.match(sql,/DELETE FROM assessments/);return {bind(id,version,company){assert.deepEqual([id,version,company],['evaluation',3,'company']);return {async run(){deleted=true;return {meta:{changes:1}}}}}}}};
 const env={PHOTOS:{async delete(key){keys.push(key)}}};
 const all={assessments:[row],stores:[],regions:[],users:[]};
 await assert.rejects(()=>usedDelete(db,env,actor,{...all,assessments:[{...row,completedAt:'2026-09-29'}]},'evaluation',{version:3}));
 await assert.rejects(()=>usedDelete(db,env,actor,all,'evaluation',{version:2}));
 assert.equal(deleted,false);
 const result=await usedDelete(db,env,actor,all,'evaluation',{version:3});
 assert.deepEqual(result,{deleted:true,id:'evaluation'});assert.equal(deleted,true);
 assert.deepEqual(keys.sort(),['used/company/evaluation/front/photo','used/company/evaluation/licensing/proof']);
});
