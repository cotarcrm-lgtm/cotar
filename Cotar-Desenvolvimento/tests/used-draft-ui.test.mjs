import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountUsedModule} from '../public/used-module.js';

test('rascunho pode ser selecionado e excluído; anexo aparece em um único chip',async()=>{
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'});dom.window.confirm=()=>true;
 const root=dom.window.document.querySelector('#root');const file={id:'file',name:'licenciamento.pdf',type:'application/pdf'};let deleted=false;
 const row={id:'draft-id',version:2,status:'Em andamento',stage:'Consultas',plate:'ABC1234',model:'HONDA',consultations:{licensing:{state:'REGULAR',amount:0,attachment:file}},vehicleFiles:{}};
 const api=async(path,options={})=>{if(path==='used-evaluations')return {items:deleted?[]:[row]};if(path==='used-evaluations/draft-id'&&options.method==='DELETE'){deleted=true;return {deleted:true}}return row};
 const dispose=mountUsedModule(root,{page:'seminovos-avaliacoes',api,me:{id:'user',name:'CARLOS',storeId:'store'},stores:[{id:'store',name:'Loja'}]});
 await new Promise(resolve=>setTimeout(resolve,0));const select=root.querySelector('#used-existing');assert.equal(select.options.length,2);select.value='draft-id';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(root.querySelector('.used-attached-file').textContent,/licenciamento.pdf/);assert.match(root.querySelector('.used-attached-file').textContent,/Trocar/);
 root.querySelector('#used-delete').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(deleted,true);assert.equal(root.querySelector('#used-existing').options.length,1);assert.match(root.textContent,/Rascunho excluído/);
 dispose();dom.window.close();
});
