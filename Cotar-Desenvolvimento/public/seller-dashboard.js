import {matchesDashboard} from './dashboard-filter-utils.js';
import {leadSituation,bahiaDate} from './lead-utils.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const day=value=>value?bahiaDate(value):'';

export function sellerDashboard({leads,sales,dash,now,name,filters='',data={},lookups={}}){
 const inPeriod=row=>{const date=row.date||day(row.createdAt);return date&&(!dash.from||date>=dash.from)&&(!dash.to||date<=dash.to)};
 const inStore=row=>matchesDashboard(row,dash,data,lookups);
 const periodLeads=leads.filter(inStore).filter(inPeriod);
 const periodSales=sales.filter(inStore).filter(inPeriod);
 const complete=periodSales.filter(row=>row.status==='Concluída');
 const pending=periodSales.filter(row=>row.status==='Em negociação');
 const overdue=leads.filter(inStore).filter(row=>leadSituation(row,now)==='Atrasado');
 const hot=leads.filter(inStore).filter(row=>['Quente','Super quente'].includes(row.temperature)&&!['Fechado','Perdido'].includes(row.status));
 const today=leads.filter(inStore).filter(row=>leadSituation(row,now)==='Hoje');
 const won=new Set(sales.filter(row=>row.status==='Concluída').map(row=>row.leadId));
 const converted=periodLeads.filter(row=>won.has(row.id)).length;
 const revenue=complete.reduce((sum,row)=>sum+Number(row.amount||0),0);
 const alerts=[['Contatos atrasados',overdue.length,'Retome estes clientes agora.','Atrasado'],['Leads quentes',hot.length,'Priorize oportunidades abertas.','hot'],['Atendimentos de hoje',today.length,'Confira os horários agendados.','Hoje']];
 const recent=periodSales.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
 return `<div class="seller-dashboard"><div class="heading"><div><div class="eyebrow">COTAR / MEU PAINEL</div><h1>Olá, ${esc(name)}.</h1><p class="sub">Seu desempenho e os próximos atendimentos em um só lugar.</p></div></div>${filters}<div class="metrics seller-metrics">${[
  ['Vendas concluídas',complete.length,'Pela data da venda'],['Valor vendido',money(revenue),'Vendas concluídas no período'],['Ticket médio',money(complete.length?revenue/complete.length:0),'Valor vendido ÷ vendas concluídas'],['Conversão dos leads',`${periodLeads.length?(converted/periodLeads.length*100).toFixed(1):'0'}%`,'Leads do período com venda concluída']
 ].map(([title,value,note])=>`<div class="metric"><label>${title}</label><strong>${value}</strong><small>${note}</small></div>`).join('')}</div><div class="seller-grid"><section class="panel"><div class="panel-head"><div><h2>Prioridades de atendimento</h2><span class="sub">Pendências atuais, independentemente do período.</span></div><a href="#leads">Abrir leads →</a></div><div class="seller-alerts">${alerts.map(([title,count,note,situation])=>`<a href="#leads" class="seller-alert ${count?'is-active':''}" data-seller-situation="${situation}"><span><strong>${esc(title)}</strong><small>${esc(note)}</small></span><b>${count}</b></a>`).join('')}</div></section><section class="panel"><div class="panel-head"><div><h2>Minhas vendas em andamento</h2><span class="sub">${pending.length} no período selecionado.</span></div></div>${pending.length?`<div class="seller-pending">${pending.slice(0,5).map(row=>`<div><strong>${esc(row.saleCode||'Venda')} · ${esc(row.model||row.modality||'Modelo não informado')}</strong><small>${esc(row.customerName||'Cliente')} · ${money(row.amount)}</small><span>Em negociação</span></div>`).join('')}</div>`:'<div class="empty">Nenhuma venda em negociação neste período.</div>'}</section></div><section class="panel"><div class="panel-head"><div><h2>Vendas recentes</h2><span class="sub">Acompanhe o status das suas vendas.</span></div></div>${recent.length?`<div class="seller-recent">${recent.map(row=>`<div><strong>${esc(row.saleCode||'Venda')}</strong><span>${esc(row.customerName||'Cliente')} · ${esc(row.model||row.modality||'Modelo não informado')}</span><b>${esc(row.status||'—')}</b><small>${money(row.amount)}</small></div>`).join('')}</div>`:'<div class="empty">Suas vendas aparecerão aqui quando forem registradas.</div>'}</section></div>`;
}
