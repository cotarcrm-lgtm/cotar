import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parseCurrency,currencyValue,installCurrencyInputs} from '../public/currency-input.js';
import {planEditor,planPayload} from '../public/consortium-ui.js';
import {catalogue} from '../server/consortium.js';
test('valor monetário aceita vírgula brasileira e preserva centavos',()=>{
 for(const source of ['R$ 1.234,56','1.234,56','1234,56','1234.56'])assert.equal(parseCurrency(source),1234.56);
 assert.equal(parseCurrency('1.234'),1234);assert.equal(currencyValue(1234.56).replace(/\s/g,' '),'R$ 1.234,56');
 assert(Number.isNaN(parseCurrency('R$ inválido')));
});
test('campo formatado salva plano em centavos sem alterar outros números',()=>{
 const plan=catalogue.plans.find(p=>p.administratorId==='honda');const dom=new JSDOM('<dialog></dialog>');const root=dom.window.document.querySelector('dialog');root.innerHTML=planEditor(plan);installCurrencyInputs(dom.window.document);
 const field=root.querySelector('[name=creditCents]');assert.match(field.value,/11\.893,00/);field.value='R$ 12.345,67';field.dispatchEvent(new dom.window.Event('focusout',{bubbles:true}));const payload=planPayload(root.querySelector('form'),plan);assert.equal(payload.creditCents,1234567);assert.equal(payload.months,plan.months);dom.window.close();
});
