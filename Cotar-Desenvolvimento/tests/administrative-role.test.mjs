import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaultScreens,roleRank} from '../public/config.js';import {permittedScreens,inScope,canManage,authorize,canSubmitSale,projection} from '../server/policy.js';
import {saleFromLead} from '../server/sales.js';
test('Administrativo possui alcance da loja e telas limitadas; vendedor só cria vendas pelo lead',()=>{
 const base={companyId:'c',storeId:'s',teamId:'t',status:'Ativo'},admin={...base,id:'a',role:'Administrativo',screens:defaultScreens('Gerente de Loja')},vendor={...base,id:'v',role:'Vendedor',screens:defaultScreens('Gerente de Loja')};
 const all={stores:[{...base,id:'s'}],regions:[],users:[admin,vendor],leads:[{...base,id:'l',userId:'v',name:'Cliente',modality:'À vista'}],sales:[],groups:[],teams:[],companies:[],vehicles:[],assessments:[]};
 assert.equal(roleRank('Administrativo'),roleRank('Gerente de Loja'));assert(!permittedScreens(admin).includes('leads'));assert(!permittedScreens(admin).includes('painel'));assert(permittedScreens(admin).includes('sales'));assert(!permittedScreens(vendor).includes('sales'));assert(canSubmitSale(vendor));
 assert(inScope(admin,'users',vendor,all));assert(!inScope(admin,'users',{...vendor,storeId:'other'},all));assert(canManage(admin,vendor,all));assert(!canManage(admin,{...vendor,role:'Gerente de Loja'},all));
 const sale={...base,id:'sale',leadId:'l',userId:'v',modality:'À vista'};all.sales=[sale];assert.doesNotThrow(()=>authorize(vendor,'sales',sale,all,'create'));assert.throws(()=>authorize(vendor,'sales',sale,all,'update'),{status:403});assert.throws(()=>authorize(vendor,'sales',sale,all,'delete'),{status:403});
 sale.documents=[{name:'privado'}];sale.cost=100;assert.equal(projection(vendor,all).dashboardSales.length,1);assert.equal(projection(vendor,all).dashboardSales[0].documents,undefined);assert.equal(projection(vendor,all).dashboardSales[0].cost,undefined);assert.equal(projection(vendor,all).records.sales.length,0);assert.equal(projection(vendor,all).lookups.sales.length,0);assert.equal(projection(admin,all).records.leads.length,0);
 assert.doesNotThrow(()=>saleFromLead(admin,{...sale},{},sale,all));assert.throws(()=>saleFromLead(admin,{...sale},{},null,all),{status:403});
});
