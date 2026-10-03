import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluationCode,usedPhotoMarks} from '../server/used-evaluations.js';

test('código da avaliação usa loja, dia, mês e placa sem acentos',()=>{
 assert.equal(evaluationCode({createdAt:'2026-09-29T11:00:00Z',plate:'ABC1D23'},'Áres Motos'),'AARE2909ABC1D23');
});
test('marcações de fotos ficam na avaliação e exigem versão e foto válida',async()=>{
 const row={id:'one',flowVersion:2,companyId:'company',storeId:'store',version:3,vehicleFiles:{front:{type:'image/jpeg'}},photoMarks:{}};
 let saved;const db={prepare(){return {bind(data){saved=JSON.parse(data);return {run:async()=>({meta:{changes:1}})}}}}};
 const actor={id:'user',companyId:'company',role:'Gerente de Loja',screens:['leads']},all={assessments:[row],stores:[],regions:[],users:[]};
 const result=await usedPhotoMarks(db,actor,all,'one',{version:3,slot:'front',marks:[{x:48.45,y:12.34,note:'Risco no tanque'}]});
 assert.deepEqual(result.photoMarks.front,[{x:48.5,y:12.3,note:'Risco no tanque'}]);assert.equal(saved.photoMarks.front[0].note,'Risco no tanque');
 await assert.rejects(()=>usedPhotoMarks(db,actor,all,'one',{version:2,slot:'front',marks:[]}));
 await assert.rejects(()=>usedPhotoMarks(db,actor,all,'one',{version:3,slot:'rear',marks:[]}));
});

test('Captações abre análise, navega fotos e salva marcação',async()=>{
 const {JSDOM}=await import('jsdom');const {mountUsedModule}=await import('../public/used-module.js');
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 const row={id:'one',code:'AARE2909ABC1D23',version:3,plate:'ABC1D23',model:'CG 160',stage:'Cliente',status:'Aguardando decisão',clientName:'MARIA',storeName:'ARES',clientDetails:{name:'MARIA'},vehicleFiles:{front:{name:'frente.jpg',type:'image/jpeg'}},consultations:{licensing:{state:'REGULAR',attachment:{name:'licenciamento.pdf',type:'application/pdf'}}}};
 let marks,decision;
 const api=async(path,options={})=>path==='used-evaluations'?{items:[row]}:path==='used-evaluations/one'?row:path.endsWith('photo-marks')?(marks=JSON.parse(options.body).marks,{version:4,photoMarks:{front:marks}}):path.endsWith('decision')?(decision=JSON.parse(options.body).decision,{version:4,status:decision,decision}):{};
 const dispose=mountUsedModule(root,{page:'seminovos-captacoes',api,me:{role:'Gerente de Loja'}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(root.textContent,/AARE2909ABC1D23/);assert.ok(root.querySelector('[data-capture-menu]'));assert.equal(root.querySelector('[data-capture-decision]'),null);
 const status=root.querySelector('[data-capture-status]');status.value='NEGOCIAÇÃO';status.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(decision,'NEGOCIAÇÃO');root.querySelector('[data-capture-menu]').click();root.querySelector('[data-capture-open]').click();assert.equal(dom.window.location.hash,'#seminovos-captacoes/one');dispose();
 const close=mountUsedModule(root,{page:'seminovos-captacoes/one',api,me:{role:'Gerente de Loja'}});await new Promise(resolve=>setTimeout(resolve,0));
 assert.ok(root.querySelector('.capture-page'));assert.equal(root.querySelector('.capture-overlay'),null);assert.match(root.querySelector('.capture-head-facts').textContent,/STATUS.*PLACA.*CHASSI/);assert.equal(root.querySelector('.capture-summary'),null);assert.equal(root.querySelector('.capture-hero .capture-financial-card').tagName,'DIV');assert.match(root.querySelector('.capture-financial-card').textContent,/Custo estimado para revenda/);assert.equal(root.querySelectorAll('.capture-file').length,2);
 const note=root.querySelector('[data-mark-note]');note.value='Risco no tanque';const frame=root.querySelector('[data-photo-frame]');frame.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});frame.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,clientX:40,clientY:70}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(marks[0].note,'Risco no tanque');assert.match(root.textContent,/Risco no tanque/);root.querySelector('[data-capture-close]').click();assert.equal(dom.window.location.hash,'#seminovos-captacoes');close();
});

test('Captações filtra período, modelo, status, loja, vendedor e placa sem botão aplicar',async()=>{
 const {JSDOM}=await import('jsdom');const {mountUsedModule}=await import('../public/used-module.js');
 const dom=new JSDOM('<main id="root"></main>',{url:'https://example.test'}),root=dom.window.document.querySelector('#root');
 const base={stage:'Fechamento',status:'Aguardando decisão',storeId:'s1',storeName:'LOJA A',userId:'u1',sellerName:'ANA',date:'2026-09-29'};
 const rows=[{...base,id:'one',model:'CG 160',plate:'ABC1234'},{...base,id:'two',model:'BIZ 125',plate:'XYZ9876',status:'Captar',storeId:'s2',storeName:'LOJA B',userId:'u2',sellerName:'BIA',date:'2026-09-20'}];
 const dispose=mountUsedModule(root,{page:'seminovos-captacoes',api:async()=>({items:rows}),me:{role:'Gerente de Loja'}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(root.querySelectorAll('.used-capture-row').length,2);
 for(const [key,value] of [['from','2026-09-25'],['model','CG 160'],['status','Aguardando decisão'],['store','s1'],['seller','u1'],['plate','ABC']]){const field=root.querySelector(`[data-capture-filter="${key}"]`);field.value=value;field.dispatchEvent(new dom.window.Event(key==='plate'?'input':'change',{bubbles:true}));assert.equal(root.querySelectorAll('.used-capture-row').length,1)}
 const plate=root.querySelector('[data-capture-filter="plate"]');plate.value='ZZZ';plate.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(root.querySelectorAll('.used-capture-row').length,0);
 dispose();dom.window.close();
});
