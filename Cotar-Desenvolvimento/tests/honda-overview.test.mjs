import test from 'node:test';
import assert from 'node:assert/strict';
import {salesOverviewSummary,hondaSummaryCards} from '../public/honda-summary.js';
const sale=(extra={})=>({loja:'WINNER',status:'NORMAL',nome_vendedor:'Ana',credito:20000,modelo:'FAN',plano:'Vou de Honda',prazo:80,seguro_vida:true,...extra});
test('overview respects eligibility, sellers, credit and actual insurance values',()=>{
 const rows=[sale(),sale({nome_vendedor:'Bia',credito:40000,seguro_vida:false}),sale({nome_vendedor:'VENDEDOR VIRTUAL',seguro_vida:null}),sale({status:'Borderô formado'})];
 const s=salesOverviewSummary(rows,rows,{loja:'WINNER'});
 assert.equal(s.volume,3);assert.equal(s.credit,80000);assert.equal(s.ticket,80000/3);
 assert.equal(s.sellers,2);assert.equal(s.humanSales,2);assert.equal(s.productivity,1);
 assert.equal(s.insuredPercent,50);assert.equal(s.uninsuredPercent,50);assert.equal(s.insuranceMissing,1);
 assert.equal(s.model,'FAN');assert.equal(s.plan,'Vou de Honda');assert.equal(s.term,80);
});
test('contemplation days ignore missing, invalid and reversed dates and retain zero',()=>{
 const s=salesOverviewSummary([sale({data_venda:'2026-01-01',data_contemplacao:'2026-01-11'}),sale({data_venda:'2026-02-01',data_contemplacao:'2026-02-01'}),sale({data_venda:'2026-02-30',data_contemplacao:'2026-03-10'}),sale({data_venda:'2026-03-01',data_contemplacao:'2026-02-01'}),sale()]);
 assert.equal(s.averageDays,5);assert.equal(s.dated,2);
});
test('service population follows store/city selection and growth gap uses current volume',()=>{
 const rows=[sale()];const s=salesOverviewSummary(rows,rows,{loja:'WINNER'});
 assert.equal(s.population,499691);assert.equal(s.target,500);assert.equal(s.gap,499);assert.equal(s.opportunity,49900);
 const city=salesOverviewSummary(rows,rows,{loja:'WINNER',municipio:'Cosmopolis'});
 assert.equal(city.population,61167);assert.equal(city.cities,1);
 const empty=salesOverviewSummary([],rows,{loja:'WINNER'});assert.equal(empty.gap,500);assert.equal(empty.opportunity,null);
 const above=salesOverviewSummary(Array.from({length:501},()=>sale()),rows,{loja:'WINNER'});assert.equal(above.gap,0);assert.equal(above.opportunity,0);
 assert.equal(salesOverviewSummary(rows,rows,{loja:'Unknown'}).population,null);
});
test('six cards render safe model text and no superseded cards',()=>{
 const html=hondaSummaryCards([],[],[],[sale({modelo:'<script>'})],undefined,{loja:'WINNER'});
 assert.equal((html.match(/<article/g)||[]).length,6);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('CNH Premium'));
});
test('monthly sales, productivity and population use every month in the selected interval',()=>{
 const rows=[sale({data_venda:'2026-01-01'}),sale({data_venda:'2026-03-01'})];
 const s=salesOverviewSummary(rows,rows,{loja:'WINNER',from:'2026-01-01',to:'2026-03-31'});
 assert.equal(s.months,3);assert.equal(s.monthlyVolume,2/3);assert.equal(s.productivity,2/3);
 assert.equal(s.inhabitantsPerSale,499691/(2/3));assert.equal(s.gap,500);
 assert.equal(s.opportunity,(500-2/3)/(2/3)*100);
 const one=salesOverviewSummary([rows[1]],rows,{loja:'WINNER',from:'2026-03-01',to:'2026-03-31'});
 assert.equal(one.months,1);assert.equal(one.monthlyVolume,1);assert.equal(one.productivity,1);
});
test('best city uses monthly sales per inhabitant rather than highest raw volume',()=>{
 const rows=[sale({municipio:'Holambra'}),sale({municipio:'Limeira'}),sale({municipio:'Limeira'})];
 const s=salesOverviewSummary(rows,rows,{loja:'WINNER',from:'2026-01-01',to:'2026-02-28'});
 assert.equal(s.bestCity.name,'Holambra');assert.equal(s.bestCity.ratio,15718*2);
 const filtered=salesOverviewSummary(rows.filter(r=>r.municipio==='Limeira'),rows,{loja:'WINNER',municipio:'Limeira',from:'2026-01-01',to:'2026-02-28'});
 assert.equal(filtered.bestCity.name,'Limeira');assert.equal(filtered.bestCity.ratio,301292);
});
