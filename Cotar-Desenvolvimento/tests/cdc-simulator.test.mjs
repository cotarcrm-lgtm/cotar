import {test} from 'node:test';import assert from 'node:assert/strict';import {cdcTables,simulateCdc,financingTablesForModel,financingEntryPercents,financingEntryOptions,financingMonthsForModel,financingChoiceForModel} from '../public/cdc-data.js';
test('coeficientes SPF e cálculo de parcela preservam as três tabelas',()=>{
 assert.equal(cdcTables.length,25);assert.deepEqual(cdcTables.slice(0,3).map(t=>t.rows.length),[7,6,10]);assert.equal(cdcTables.reduce((n,t)=>n+t.rows.length*t.codes.length,0),598);
 assert.equal(cdcTables[0].rows.find(r=>r[0]===36)[1][0],.04982);
 assert.equal(cdcTables[1].rows.find(r=>r[0]===36)[3][0],.04555);
 assert.equal(cdcTables[2].rows.find(r=>r[0]===48)[3][0],.04173);
 const a=simulateCdc({tableId:'pop',code:'2CNNA003694',months:36,price:20000});assert.equal(a.entry,4000);assert.equal(a.principal,16790);assert.equal(a.installment,836.48);assert.equal(a.upfront,4000);assert.equal(a.total,34113.28);
 assert.equal(simulateCdc({tableId:'pop',code:'invalid',months:36,price:20000}),null);
 assert.equal(simulateCdc({tableId:'pop',code:'2CNNA003694',months:36,price:1000}).valid,false);
});
test('entrada personalizada projeta valor e mantém condições originais',()=>{const r=simulateCdc({tableId:'pop',code:'2CNNA003694',months:36,price:20000,entryPercent:10});assert.equal(r.entry,2000);assert.equal(r.principal,18790);assert.equal(r.upfront,2000);assert.equal(r.installment,936.12);assert.equal(r.entryPercent,10);});

test('novas tabelas SPF por modelo e entrada preservam os coeficientes dos PDFs',()=>{
 const forModel=(name)=>financingTablesForModel(name).map(t=>t.id);
 assert.deepEqual(forModel('CB 300F Twister'),['twister15','twister25']);
 assert.deepEqual(forModel('NXR 160 Bros'),['bros','bros15','bros25']);
 assert.deepEqual(forModel('Biz 125 ES'),['biz10','urban10','biz15','urban15','pcx','biz30']);
 assert.deepEqual(forModel('PCX'),['urban10','urban15','pcx20','pcx']);
 assert.deepEqual(forModel('CB 750 Hornet'),['large20','large30','large40']);
 assert.deepEqual(forModel('CRF 300F'),['atv50']);
 assert.deepEqual(forModel('CG 160 Titan'),['titan10','titan15','cg25']);
 assert.deepEqual(forModel('CG 160 Fan'),['fan10','fan15','fan15long','cg25']);
 assert.deepEqual(forModel('X-ADV'),['large20','large30','large40']);
 assert.equal(cdcTables.find(t=>t.id==='urban10').rows.find(r=>r[0]===55)[3][0],.04043);
 assert.equal(cdcTables.find(t=>t.id==='fan15long').rows.find(r=>r[0]===55)[1][0],.04029);
 assert.equal(cdcTables.find(t=>t.id==='pcx20').codes[0],'2CNNA003724');
 assert.equal(simulateCdc({tableId:'pcx20',code:'2CNNA003724',months:48,price:25000}).installment,766.94);
 for(const t of cdcTables){assert.equal(new Set(t.rows.map(r=>r[0])).size,t.rows.length,t.id);for(const row of t.rows)assert.equal(row.length,t.codes.length+1,t.id)}
});

test('percentuais e prazos unificados escolhem o maior coeficiente por prazo',()=>{
 assert.deepEqual(financingEntryPercents('Biz 125'),[10,15,25,30]);
 assert.deepEqual(financingMonthsForModel('CG 160 Fan',15),[3,6,9,12,15,24,30,36,42,48,50,55]);
 assert.deepEqual(financingChoiceForModel('Biz 125',10,36),{tableId:'urban10',code:'2CNNA023715',months:36,entryPercent:10,coefficient:.04735,monthlyRate:2.88});
 assert.deepEqual(financingChoiceForModel('CG 160 Fan',15,55),{tableId:'fan15long',code:'2CNNA003712',months:55,entryPercent:15,coefficient:.04029,monthlyRate:3.12});
 assert.equal(financingChoiceForModel('PCX',17,36),null);
 assert.equal(financingChoiceForModel('POP 110i',20,36).code,'2CNNA013694');
});
test('entrada maior usa a última tabela disponível e mantém o percentual real',()=>{
 assert.deepEqual(financingEntryOptions('POP 110i').slice(0,3),[20,25,30]);
 assert.equal(financingEntryOptions('POP 110i').at(-1),95);
 assert.deepEqual(financingMonthsForModel('POP 110i',35),financingMonthsForModel('POP 110i',20));
 const choice=financingChoiceForModel('POP 110i',35,36),result=simulateCdc({...choice,price:20000});
 assert.equal(choice.tableId,'pop');assert.equal(choice.entryPercent,35);assert.equal(result.entry,7000);assert.equal(result.principal,13790);assert.equal(result.upfront,7000);
 assert.equal(financingChoiceForModel('POP 110i',37,36),null);
});
