import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {qualityClients,qualityRanking,hondaQualityContent,apurarQualidade} from '../public/honda-quality.js';
import {mountQualityInteractions} from '../public/honda-quality-details.js';
const rows=[{cliente:'Ana cliente',nome_vendedor:'Ana',loja:'WINNER',plano:'Honda',data_venda:'2026-02-01',status:'NORMAL',percentual_mensal:1,percentual_amortizado:5},{cliente:'Bia cliente',nome_vendedor:'Bia',loja:'WINNER',plano:'Honda+',data_venda:'2026-02-02',status:'NORMAL',percentual_mensal:1,percentual_amortizado:2},{cliente:'Cancelada',nome_vendedor:'Ana',loja:'WINNER',plano:'Honda',data_venda:'2026-03-01',status:'CANCELADO',honda_cancelamento_oficial:false},{cliente:'Confirmada',nome_vendedor:'Bia',loja:'WINNER',plano:'Honda+',data_venda:'2026-03-02',status:'NORMAL',honda_cancelamento_oficial:true},{cliente:'Atrasada',nome_vendedor:'Bia',loja:'WINNER',plano:'Honda+',data_venda:'2026-06-01',status:'NORMAL',honda_segunda_atraso:true},{cliente:'Paga',nome_vendedor:'Ana',loja:'WINNER',plano:'Honda',data_venda:'2026-06-01',status:'PRE-CANCELADO',honda_segunda_atraso:false},{cliente:'Desclassificada',nome_vendedor:'Ana',loja:'WINNER',plano:'Honda',data_venda:'2026-02-01',status:'Borderô formado',percentual_mensal:1,percentual_amortizado:5}];
test('client lists follow the same official flags and retention thresholds as the indicators',()=>{
 for(const [indicator,cohort] of [['cancelamento','2026-03'],['segunda-parcela','2026-06'],['retencao','2026-02']]){
 const selected=qualityClients(rows,{indicator,cohort});const result=apurarQualidade(rows,indicator,cohort);
 assert.equal(selected.length,result.numerator);assert.equal(qualityClients(rows,{indicator,cohort,mode:'all'}).length,result.total);
 }
 assert.equal(qualityClients(rows,{indicator:'cancelamento',cohort:'2026-03'})[0].cliente,'Confirmada');
 assert.equal(qualityClients(rows,{indicator:'segunda-parcela',cohort:'2026-06'})[0].cliente,'Paga');
 assert.equal(qualityClients(rows,{indicator:'retencao',cohort:'2026-02',field:'nome_vendedor',value:'Bia'}).length,0);
});
test('rankings preserve individual cohort denominators and sort cancellation ascending',()=>{
 const ranking=qualityRanking(rows,'nome_vendedor',{year:2026,month:10,rankBy:'cancelamento'});
 assert.equal(ranking[0].name,'Ana');assert.equal(ranking[0].metrics.cancelamento.rate,0);assert.equal(ranking[1].metrics.cancelamento.rate,100);
 assert.equal(ranking[0].metrics.retencao.rate,100);assert.equal(ranking[0].metrics['segunda-parcela'].rate,100);
 const plans=qualityRanking(rows,'plano',{year:2026,month:10});assert.equal(plans[0].name,'Honda');
});
test('charts are ordered and click opens exact cohort clients with negative and total tabs',async()=>{
 const d=new JSDOM('<main></main>'),root=d.window.document.querySelector('main');
 root.innerHTML=hondaQualityContent(rows,{year:2026,month:10});
 assert.deepEqual([...root.querySelectorAll('[data-quality-panel]')].map(el=>el.dataset.qualityPanel),['segunda-parcela','cancelamento','retencao']);
 mountQualityInteractions(root,{loadClients:async()=>rows,scopeRows:rows,quality:{officialReports:[]},onRank:()=>{}});
 root.querySelector('[data-quality-panel="retencao"] [data-quality-cohort="2026-02"]').dispatchEvent(new d.window.Event('click'));
 await new Promise(resolve=>setTimeout(resolve,0));const dialog=root.querySelector('dialog');
 assert.match(dialog.textContent,/Ana cliente/);assert.ok(!dialog.textContent.includes('Bia cliente'));assert.ok(!dialog.textContent.includes('Desclassificada'));
 dialog.querySelector('[data-quality-mode="negative"]').click();assert.match(dialog.textContent,/Bia cliente/);
 dialog.querySelector('[data-quality-mode="all"]').click();assert.equal(dialog.querySelectorAll('tbody tr').length,2);
 dialog.querySelector('[data-quality-close]').click();assert.equal(root.querySelector('dialog'),null);d.window.close();
});
test('official totals are preserved while incomplete contract lists are disclosed',async()=>{
 const d=new JSDOM('<main></main>'),root=d.window.document.querySelector('main');root.innerHTML=hondaQualityContent(rows,{year:2026,month:10});
 mountQualityInteractions(root,{loadClients:async()=>rows,scopeRows:rows,quality:{officialReports:[{store:'WINNER',cohort:'2026-03',total:10,cancelled:4}]},onRank:()=>{}});
 root.querySelector('.exec-kpis [data-quality-indicator="cancelamento"]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(root.querySelector('dialog').textContent,/4 de 10/);assert.ok(root.querySelector('.honda-quality-detail-warning'));d.window.close();
});
