import test from 'node:test';
import assert from 'node:assert/strict';
import {closingFinancial} from '../public/used-financial.js';

test('débitos reduzem o líquido do cliente e preparação compõe o custo da revenda',()=>{
 const result=closingFinancial({commercial:{purchasePrice:13000,transfer:850,payoffDebt:350},debts:150,preparationTotal:1080,fipe:17061});
 assert.equal(result.customerReceives,12850);
 assert.equal(result.totalCost,14080);
 assert.equal(result.debts,150);
 assert.equal(result.preparation,1080);
 assert.equal('taxes' in result,false);
});
