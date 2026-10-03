import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogue as fullCatalogue,consortiumSelection} from '../server/consortium.js';
const catalogue={plans:fullCatalogue.plans.filter(p=>p.administratorId==='honda')};
test('catálogo completo do PDF, valores em centavos e prazos publicados',()=>{
 assert.equal(catalogue.plans.length,220);assert.equal(new Set(catalogue.plans.map(p=>p.id)).size,220);assert.equal(new Set(catalogue.plans.map(p=>p.model)).size,32);
 assert.deepEqual([1,2,3,4].map(page=>catalogue.plans.filter(p=>p.page===page).length),[113,94,9,4]);
 for(const p of catalogue.plans){for(const key of ['creditCents','planWithoutInsuranceCents','installmentWithInsuranceCents','installmentWithoutInsuranceCents'])assert(Number.isSafeInteger(p[key])&&p[key]>0);assert(p.installmentWithInsuranceCents>p.installmentWithoutInsuranceCents);assert(Math.abs(p.installmentWithoutInsuranceCents*p.months-p.planWithoutInsuranceCents)<=p.months);assert(p.participants===p.contemplations*p.months);}
 const p=catalogue.plans.find(p=>p.model==='CB1000 HORNET 70%');assert.equal(p.creditCents,5680700);assert.equal(p.installmentWithInsuranceCents,96842);assert.equal(p.months,72);
 const m=catalogue.plans.find(p=>p.model==='M&M AVANÇADO+');assert.equal(m.planWithoutInsuranceCents,457866);assert.equal(m.installmentWithoutInsuranceCents,25437);assert.equal(m.dueDays[0],1);assert.equal(m.dilutedBidPercent,20);
});
test('servidor resolve preços canônicos e rejeita seleção inválida',()=>{
 const b={modality:'Consórcio',administratorId:'honda',planId:'honda-20260824-p1-m1-80',insurance:'Com seguro',dueDay:'15',consortium:{creditCents:1}};
 assert.equal(consortiumSelection(b).consortium.creditCents,1189300);assert.equal(consortiumSelection(b).consortium.installmentCents,19773);
 for(const patch of [{planId:'inventado'},{insurance:'talvez'},{dueDay:'1'}])assert.throws(()=>consortiumSelection({...b,...patch}));
 for(const modality of ['À vista','Financiamento','Seminova'])assert.equal(consortiumSelection({...b,modality}).consortium,null);
});
test('Disal diferencia crédito reduzido e integral, ausências e oferta em conferência',()=>{
 const plans=fullCatalogue.plans.filter(p=>p.administratorId==='disal'&&p.catalogueId==='disal-site-2026-09-28');assert.equal(plans.length,25);assert.equal(plans.filter(p=>p.active).length,24);
 const p=plans[0],body={modality:'Consórcio',administratorId:'disal',planId:p.id,insurance:'Com seguro',dueDay:''};
 const selected=consortiumSelection(body);assert.equal(selected.consortium.creditCents,3750000);assert.equal(selected.consortium.integralCreditCents,5000000);assert.equal(selected.consortium.installmentCents,72343);assert.equal(selected.consortium.dueDay,null);assert.equal(selected.consortium.planWithoutInsuranceCents,null);
 assert.throws(()=>consortiumSelection({...body,insurance:'Sem seguro'}));assert.throws(()=>consortiumSelection(body,fullCatalogue,null,['honda']));assert.throws(()=>consortiumSelection({...body,planId:plans.find(p=>p.reviewRequired).id}));assert.throws(()=>consortiumSelection({...body,administratorId:'honda'}));
});
