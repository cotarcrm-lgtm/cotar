import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {calendarView,calendarState,shiftMonth,kanbanView} from '../public/lead-views.js';
import {dashboardViews} from '../public/dashboard-views.js';
import {sellerDashboard} from '../public/seller-dashboard.js';
const now=Date.parse('2026-09-28T15:00:00Z');
const leads=[{id:'past',name:'Atrasado',status:'Agendado',scheduledAt:'2026-09-28T14:00:00Z',temperature:'Quente',createdAt:'2026-09-28T10:00:00Z',storeId:'s'},{id:'today',name:'Hoje',status:'Agendado',scheduledAt:'2026-09-28T16:00:00Z',createdAt:'2026-09-28T10:00:00Z',storeId:'s'},{id:'future',name:'Futuro',status:'Reagendado',scheduledAt:'2026-09-29T14:00:00Z'},{id:'closed',name:'Encerrado',status:'Fechado',scheduledAt:'2026-09-28T12:00:00Z'},{id:'midnight',name:'Horário local',status:'Perdido',scheduledAt:'2026-09-29T01:00:00Z'}];
test('calendário usa Brasília e kanban exclui encerrados das situações automáticas',()=>{const ctx={now,owner:()=> 'Carlos',canSell:false},state=calendarState(now);let dom=new JSDOM(calendarView(leads,state,ctx));assert.equal(dom.window.document.querySelectorAll('.calendar-day').length,42);assert.equal(dom.window.document.querySelectorAll('.day-agenda .agenda-card').length,4);assert(dom.window.document.querySelector('.day-agenda').textContent.includes('Horário local'));dom.window.close();dom=new JSDOM(kanbanView(leads,ctx));for(const s of ['atrasado','hoje','futuro'])assert.equal(dom.window.document.querySelectorAll('.k-'+s+' .agenda-card').length,1);assert.equal(dom.window.document.querySelectorAll('.lead-extra .agenda-card').length,2);assert(!dom.window.document.querySelector('[data-action="convert-lead"]'));dom.window.close();state.month='2026-12';shiftMonth(state,1);assert.equal(state.month,'2027-01');shiftMonth(state,-1);assert.equal(state.day,'2026-12-01');});
test('dashboard aplica loja, período e telas permitidas sem inventar histórico de estoque',()=>{const data={leads,users:[],vehicles:[{id:'a',storeId:'s',status:'Disponível',purchase:10000,preparation:1000,price:15000,createdAt:'2026-06-01T00:00:00Z'},{id:'b',storeId:'s',isSold:true,purchase:20000,createdAt:'2026-06-01T00:00:00Z'},{id:'c',storeId:'other',purchase:90000}],sales:[{id:'sale',storeId:'s',date:'2026-09-28',status:'Concluída',amount:15000,cost:11000,modality:'Seminova'},{id:'old',storeId:'s',date:'2026-08-01',status:'Concluída',amount:90000}]};const args={data,screens:['sales','leads','vehicles'],view:'vehicles',dash:{store:'s',from:'2026-09-01',to:'2026-09-30'},now,owner:x=>x,storeName:x=>x,sold:r=>r.isSold};const stock=dashboardViews(args);assert.equal(stock.details.find(d=>d.title==='Seminovos em estoque').rows.length,1);assert.equal(stock.details.find(d=>d.title==='Entradas no período').rows.length,0);assert(stock.html.includes('11.000,00'));assert(!stock.html.includes('data-dashboard-view="users"'));const sales=dashboardViews({...args,view:'sales'});assert.equal(sales.details[0].rows.length,1);assert(sales.html.includes('4.000,00'));const leadResult=dashboardViews({...args,view:'leads'});assert.equal(leadResult.details[0].rows.length,2);assert.equal(leadResult.details[1].rows.length,1);});
test('análise de vendas respeita equipe, vendedor, modalidade, status e modelo no mesmo recorte',()=>{
 const data={leads:[],vehicles:[],teams:[{id:'t',name:'Equipe A'}],users:[{id:'u',teamId:'t'},{id:'v',teamId:'other'}],sales:[
  {id:'one',date:'2026-09-28',storeId:'s',userId:'u',modality:'Consórcio',model:'POP 110i',status:'Concluída',amount:20000},
  {id:'two',date:'2026-09-28',storeId:'s',userId:'u',modality:'Consórcio',model:'POP 110i',status:'Em negociação',amount:25000},
  {id:'three',date:'2026-09-28',storeId:'s',userId:'v',modality:'Financiamento',model:'BIZ 125',status:'Concluída',amount:30000}
 ]};
 const args={data,screens:['sales'],view:'sales',dash:{store:'s',from:'2026-09-01',to:'2026-09-30',team:'t',user:'u',modality:'Consórcio',model:'POP 110i'},now,owner:x=>x,storeName:x=>x,sold:()=>false};
 const result=dashboardViews(args);assert.equal(result.details.find(d=>d.title==='Vendas concluídas').rows.length,1);assert.equal(result.details.find(d=>d.title==='Em negociação').rows.length,1);assert.match(result.html,/Ranking por equipe/);assert.match(result.html,/Modelos mais vendidos · top 10/);assert.doesNotMatch(result.html,/BIZ 125/);
 const closed=dashboardViews({...args,dash:{...args.dash,status:'Concluída'}});assert.equal(closed.details.find(d=>d.title==='Em negociação').rows.length,0);assert.match(closed.html,/20\.000,00/);
});
test('dashboard de leads combina filtros e abre cada faixa do funil',()=>{
 const data={leads:[
  {id:'a',storeId:'s',userId:'u',modality:'Consórcio',model:'BIZ 125',status:'Agendado',scheduledAt:'2026-09-28T14:00:00Z',createdAt:'2026-09-28T10:00:00Z'},
  {id:'b',storeId:'s',userId:'u',modality:'Financiamento',model:'BIZ 125',status:'Agendado',scheduledAt:'2026-09-28T14:00:00Z',createdAt:'2026-09-28T10:00:00Z'},
  {id:'c',storeId:'s',userId:'v',modality:'Consórcio',model:'BIZ 125',status:'Agendado',scheduledAt:'2026-09-29T14:00:00Z',createdAt:'2026-09-28T10:00:00Z'}
 ],users:[{id:'u',teamId:'t'},{id:'v',teamId:'other'}],sales:[],vehicles:[]};
 const result=dashboardViews({data,screens:['leads'],view:'leads',dash:{store:'s',from:'2026-09-01',to:'2026-09-30',team:'t',user:'u',modality:'Consórcio',status:'Agendado',model:'BIZ 125',situation:'Atrasado'},now,owner:x=>x,storeName:x=>x,sold:()=>false});
 assert.deepEqual(result.details.find(d=>d.title==='Leads no período').rows.map(r=>r.id),['a']);
 const dom=new JSDOM(result.html);assert.equal(dom.window.document.querySelectorAll('.lead-status-funnel .funnel-stage').length,4);assert.equal(dom.window.document.querySelector('.lead-status-funnel .funnel-stage').textContent.trim(),'Agendado1');assert(dom.window.document.querySelector('.lead-metrics'));dom.window.close();
 const scheduled=dashboardViews({data,screens:['leads'],view:'leads',dash:{from:'2026-09-29',to:'2026-09-29',dateBasis:'scheduled'},now,owner:x=>x,storeName:x=>x,sold:()=>false});
 assert.deepEqual(scheduled.details.find(d=>d.title==='Leads no período').rows.map(r=>r.id),['c']);
 const byAppointment=dashboardViews({data,screens:['leads'],view:'leads',dash:{from:'2026-09-28',to:'2026-09-28',dateBasis:'scheduled'},now,owner:x=>x,storeName:x=>x,sold:()=>false});
 assert.equal(byAppointment.details.find(d=>d.title==='Leads no período').rows.length,2);
});
test('painel do vendedor separa pendências atuais dos resultados do período',()=>{
 const html=sellerDashboard({name:'Carlos',now,filters:'<div>Filtros</div>',dash:{store:'s',from:'2026-09-01',to:'2026-09-30'},leads:[...leads,{id:'older',status:'Agendado',scheduledAt:'2026-09-20T12:00:00Z',createdAt:'2026-08-01T12:00:00Z',storeId:'s'}],sales:[{saleCode:'C1',date:'2026-09-28',storeId:'s',status:'Concluída',amount:20000,leadId:'past'},{saleCode:'C2',date:'2026-09-28',storeId:'s',status:'Em negociação',amount:9000,customerName:'Ana'}]});
 const dom=new JSDOM(html);assert.match(dom.window.document.querySelector('.seller-metrics').textContent,/20\.000,00/);assert.match(dom.window.document.querySelector('.seller-alerts').textContent,/Contatos atrasados/);assert.match(dom.window.document.querySelector('.seller-pending').textContent,/Ana/);assert.equal(dom.window.document.querySelectorAll('[data-seller-situation]').length,3);assert(dom.window.document.querySelector('[data-seller-situation="hot"]'));dom.window.close();
});
