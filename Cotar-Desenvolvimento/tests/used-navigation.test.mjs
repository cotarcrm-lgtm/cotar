import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountUsedModule} from '../public/used-module.js';

test('FIPE preenche características e barra navega pelas cinco etapas com máscaras',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'});
 dom.window.confirm=()=>true;
 const root=dom.window.document.querySelector('#root');let saved,deleted=false;
 const api=async(path,options={})=>{
  if(path==='used-evaluations'&&!options.method)return {items:saved&&!deleted?[saved]:[]};
  if(path==='vehicle-lookup')return {homolog:false,candidates:[{brand:'HONDA',model:'BIZ 125',manufacturingYear:'2025',modelYear:'2026',category:'Moto',color:'VERMELHA',fuel:'Gasolina',chassis:'12345678901234567',value:18900,code:'811001-1',reference:'setembro de 2026',principal:true}]};
  if(options.method==='DELETE'){deleted=true;return {deleted:true}};
  if(options.method){saved={...JSON.parse(options.body),id:'evaluation',version:(saved?.version||0)+1,status:'Em andamento'};return saved}
  return saved;
 };
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(root.querySelectorAll('[data-go-stage]').length,5);
 assert.ok(root.querySelector('.used-reference-identity').compareDocumentPosition(root.querySelector('.used-toolbar'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(root.querySelector('.used-reference-identity .used-expand-hint .when-closed').textContent,'Expandir');
 assert.equal(root.querySelector('.used-reference-identity .used-expand-hint .when-open').textContent,'Recolher');
 const plate=root.querySelector('#used-plate');plate.value='ABC1234';plate.dispatchEvent(new dom.window.Event('input',{bubbles:true}));root.querySelector('#used-lookup').click();await new Promise(resolve=>setTimeout(resolve,0));
 const amount=root.querySelector('[data-query="ipva"] [data-field="amount"]');amount.value='1.234,56';amount.dispatchEvent(new dom.window.Event('input',{bubbles:true}));amount.dispatchEvent(new dom.window.Event('focusout',{bubbles:true}));assert.match(amount.value,/1\.234,56/);
 root.querySelector('[data-go-stage="Veículo"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.stage,'Veículo');assert.equal(saved.consultations.ipva.amount,1234.56);assert.equal(root.querySelector('[data-vehicle-field="category"]').value,'Moto');assert.equal(root.querySelector('[data-vehicle-field="color"]').value,'VERMELHA');assert.equal(root.querySelector('[data-vehicle-field="fuel"]').value,'Gasolina');assert.equal(root.querySelector('[data-vehicle-field="manufacturingYear"]').value,'2025');
 assert.ok(root.querySelector('#used-delete'));assert.equal(root.querySelector('[data-go-stage="Veículo"]').getAttribute('aria-current'),'step');
 root.querySelector('[data-go-stage="Cliente"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 for(const [key,raw,formatted] of [['cpf','52998224725','529.982.247-25'],['cep','01001000','01001-000'],['phone','11987654321','(11) 98765-4321']]){const input=root.querySelector(`[data-client-field="${key}"]`);input.value=raw;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(input.value,formatted)}
 root.querySelector('[data-go-stage="Checklist"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.stage,'Checklist');assert.equal(saved.clientDetails.cpf,'529.982.247-25');assert.ok(root.querySelector('#used-delete'));assert.equal(root.querySelector('[data-go-stage="Checklist"]').getAttribute('aria-current'),'step');
 root.querySelector('#used-delete').click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(deleted,true);assert.match(root.textContent,/Rascunho excluído/);
 dispose();dom.window.close();
});

test('Outros no checklist revela campo ao responder Sim e conserva a descrição',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 let saved;const api=async(path,options={})=>{if(path==='used-evaluations'&&!options.method)return {items:saved?[saved]:[]};if(options.method){saved={...JSON.parse(options.body),id:'draft',version:(saved?.version||0)+1,status:'Em andamento'};return saved}return saved};
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});
 await new Promise(resolve=>setTimeout(resolve,0));root.querySelector('[data-go-stage="Checklist"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 const question=root.querySelector('[data-question="vehicleOther"]'),detail=question.querySelector('.used-vehicle-other-detail');assert.equal(detail.hidden,true);
 const yes=question.querySelector('[value="SIM"]');yes.checked=true;yes.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(detail.hidden,false);
 const input=detail.querySelector('input');input.value='Pintura retocada';input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
 root.querySelector('#used-checklist-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(saved.vehicleOtherDetail,'Pintura retocada');assert.equal(root.querySelector('#used-vehicle-other-detail').value,'Pintura retocada');dispose();
});

test('itens do checklist mostram avaliação pendente e concluída com progresso',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 const api=async(path,options={})=>path==='used-evaluations'&&!options.method?{items:[]}:{id:'draft',version:1,stage:'Checklist',status:'Em andamento',...JSON.parse(options.body||'{}')};
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});await new Promise(resolve=>setTimeout(resolve,0));root.querySelector('[data-go-stage="Checklist"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 const item=root.querySelector('[data-checklist="frontShock"]');assert.equal(item.classList.contains('is-complete'),false);const before=Number(root.querySelector('#used-checklist-done').textContent);
 const state=item.querySelector('[data-check-field="state"]');state.value='BOM';state.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.equal(item.classList.contains('is-complete'),true);assert.equal(Number(root.querySelector('#used-checklist-done').textContent),before+1);assert.equal(item.querySelector('.used-item-indicator').getAttribute('aria-label'),'Item avaliado');dispose();
});

test('cliente não proprietário abre cadastro separado e salva dados',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');let saved;
 const api=async(path,options={})=>{if(path==='used-evaluations'&&!options.method)return {items:saved?[saved]:[]};if(options.method){saved={...JSON.parse(options.body),id:'draft',version:(saved?.version||0)+1,status:'Em andamento'};return saved}return saved};
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});await new Promise(resolve=>setTimeout(resolve,0));root.querySelector('[data-go-stage="Cliente"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 const no=root.querySelector('[name="used-owner"][value="NÃO"]');no.checked=true;no.dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert.ok(root.querySelector('.used-owner-dialog'));
 for(const [key,value] of Object.entries({cpf:'52998224725',name:'PROPRIETÁRIA',rg:'123456',phone:'75999999999'})){const input=root.querySelector(`[data-owner-field="${key}"]`);input.value=value;input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))}
 root.querySelector('#used-owner-save').click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(saved.ownerDetails.name,'PROPRIETÁRIA');assert.equal(saved.clientDetails.isOwner,false);assert.equal(root.querySelector('.used-owner-dialog'),null);dispose();
});

test('serviços usam estados de execução em vez de condição da peça',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 const api=async(path,options={})=>path==='used-evaluations'&&!options.method?{items:[]}:{id:'draft',version:1,status:'Em andamento',...JSON.parse(options.body||'{}')};
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});await new Promise(resolve=>setTimeout(resolve,0));root.querySelector('[data-go-stage="Checklist"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 const options=[...root.querySelector('[data-checklist="serviceRevision"] select').options].map(x=>x.textContent);assert(options.includes('REALIZAR'));assert(options.includes('REALIZADO'));assert(!options.includes('BOM'));dispose();
});
