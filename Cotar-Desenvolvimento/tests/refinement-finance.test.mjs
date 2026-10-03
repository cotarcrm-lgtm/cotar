import test from 'node:test';
import assert from 'node:assert/strict';
import {marketReference,simulateUsedFinance} from '../public/used-market.js';
import {marketRate} from '../server/used-catalogue.js';
import {costOf} from '../public/config.js';
test('seminovos usa 3,3% a.m. sem consulta externa e financia a taxa de cadastro',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('A taxa definida não deve ser substituída')});
 assert.equal((await marketRate()).monthlyPercent,3.3);assert.equal(marketReference.monthlyPercent,3.3);
 for(const months of [12,24,36,48,60]){const simulation=simulateUsedFinance(20000,30,months);const expected=14790*.033/(1-Math.pow(1.033,-months));assert(Math.abs(simulation.installment-expected)<1e-9);assert.equal(simulation.entry,6000);assert.equal(simulation.financed,14790);assert.equal(simulation.total,6000+months*expected)}
});
test('custo atual soma compra e preparação sem descontar ou somar débitos novamente',()=>{
 assert.equal(costOf({flowVersion:2,purchase:10000,preparation:1200,debts:800,transfer:300,settlement:500}),11200);
});
