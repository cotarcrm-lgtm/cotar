import {serviceCities,populationSource,populationYear} from './honda-population.js';
import {eligibleHondaSale} from './honda-eligibility.js';
import {apurarQualidade,qualityCohort} from './honda-quality.js';
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const number=v=>v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const percent=v=>v===null?'—':v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const premiumEligible=row=>eligibleHondaSale(row)&&normalize(row.nome_vendedor)!=='VENDEDOR VIRTUAL'&&!/(E[- ]?COMMERCE|VENDA ONLINE)/.test(normalize(row.tipo_contrato));
const index=key=>Number(key.slice(0,4))*12+Number(key.slice(5,7))-1;
export function portfolioSummary(rows){
 rows=rows.filter(eligibleHondaSale);
 const pending=rows.filter(r=>['NORMAL','PRE-CANCELADO'].includes(normalize(r.status)));
 const finished=rows.filter(r=>['CONTEMPLADO','JURIDICO'].includes(normalize(r.status)));
 const dated=rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(String(r.data_contemplacao||'').slice(0,10))&&Number.isFinite(Date.parse(r.data_contemplacao)));
 const months=dated.map(r=>r.data_contemplacao.slice(0,7)).sort(),first=months[0]||null,last=months.at(-1)||null;
 const span=first?index(last)-index(first)+1:0,average=span?dated.length/span:null;
 return {pending:pending.length,finished:finished.length,credit:finished.reduce((s,r)=>s+Number(r.credito||0),0),first,last,average,lifetime:average?pending.length/average:null};
}
function bonusModel(model){const n=normalize(model);if(/FAN|TITAN/.test(n))return 2;if(/\bPOP\b|\bSTART\b/.test(n))return 0;return n?1:null;}
const currentMonth=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'}).slice(0,7);
export function premiumSummary(scope,allRows,officialReports=[],month=currentMonth()){
 const [year,m]=month.split('-').map(Number),cancelCohort=qualityCohort(year,m,7),retentionCohort=qualityCohort(year,m,8);
 // October 2026 policy: eligibility is assessed per store, even when filtering sellers.
 const eligible=allRows.filter(premiumEligible),filtered=scope.filter(premiumEligible);
 const stores=[...new Set(filtered.map(r=>r.loja))];let gain=0,lost=0,unclassified=0,qualifying=0,missing=0;const details=[];
 for(const store of stores){const base=eligible.filter(r=>r.loja===store),cancel=apurarQualidade(base,'cancelamento',cancelCohort,officialReports),retention=apurarQualidade(base,'retencao',retentionCohort),volume=base.filter(r=>String(r.data_venda||'').slice(0,7)===month).length,ready=cancel.rate!==null&&retention.rate!==null,ok=ready&&volume>=50&&cancel.rate<=25&&retention.rate>=54;
 const rates=retention.rate>=64&&volume>=100?[50,70,80]:retention.rate>=58?[30,60,70]:[20,50,60];
 // No index below 54% earns a bonus; the lowest eligible band is the potential in that case.
 const sales=filtered.filter(r=>r.loja===store&&String(r.data_venda||'').slice(0,7)===month);let amount=0;
 for(const row of sales){const category=bonusModel(row.modelo);if(category===null){unclassified++;continue;}amount+=rates[category];}
 if(!ready)missing++;else if(ok){gain+=amount;qualifying++;}else lost+=amount;
 details.push({store,volume,cancel,retention,ok,ready,amount});
 }
 const cancel=apurarQualidade(scope,'cancelamento',cancelCohort,officialReports),retention=apurarQualidade(scope,'retencao',retentionCohort);
 return {gain,lost,missing,qualifying,unclassified,cancel:cancel.rate,retention:retention.rate,details};
}
export function minimumPremiumPotential(rows){
 const eligible=rows.filter(premiumEligible);const amount=eligible.reduce((sum,row)=>{const category=bonusModel(row.modelo);return sum+(category===null?0:[20,50,60][category]);},0);
 return {amount,simulated:true};
}
export function replacementShareSummary(rows){const base=rows.filter(eligibleHondaSale),replacement=base.filter(r=>normalize(r.tipo_contrato)==='R').length;return {total:base.length,replacement,rate:base.length?replacement/base.length*100:null};}
export function replacementContemplationSummary(rows){
 const base=rows.filter(eligibleHondaSale).filter(r=>normalize(r.tipo_contrato)==='R');
 const contemplated=base.filter(r=>['CONTEMPLADO','PRE-CONTEMPLADO','JURIDICO'].includes(normalize(r.status))||(/^\d{4}-\d{2}-\d{2}$/.test(r.data_contemplacao||'')&&Number.isFinite(Date.parse(r.data_contemplacao)))).length;
 return {total:base.length,contemplated,rate:base.length?contemplated/base.length*100:null};
}
export function matchedContemplatedQuotas(rows){return new Set(rows.filter(eligibleHondaSale).filter(r=>r.reserva_correspondente===true&&(/^\d{4}-\d{2}-\d{2}$/.test(r.data_contemplacao||'')||['CONTEMPLADO','JURIDICO'].includes(normalize(r.status)))).map(r=>[r.loja,r.grupo,r.cota,r.r,r.d].join(':'))).size;}
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cityKey=v=>normalize(v).replace(/[^A-Z0-9]/g,'');
function day(value){const text=String(value||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return null;const n=Date.parse(text+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===text?n/86400000:null;}
function mostCommon(rows,value){const values=new Map();for(const row of rows){const key=value(row);if(!key)continue;values.set(key,(values.get(key)||0)+1);}return [...values].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'))[0]||null;}
export function salesOverviewSummary(rows,allRows=rows,filters={}){
 const base=rows.filter(eligibleHondaSale),credit=base.reduce((s,r)=>s+(Number(r.credito)||0),0);
 const human=base.filter(r=>normalize(r.nome_vendedor)&&normalize(r.nome_vendedor)!=='VENDEDOR VIRTUAL');
 const sellers=new Set(human.map(r=>normalize(r.loja)+':'+normalize(r.nome_vendedor))).size;
 const stores=filters.loja?[filters.loja]:[...new Set(allRows.map(r=>r.loja).filter(Boolean))];
 const cities=serviceCities.filter(c=>stores.some(s=>normalize(s)===normalize(c.store))&&(!filters.municipio||cityKey(c.name)===cityKey(filters.municipio)));
 const unsupported=stores.some(s=>!serviceCities.some(c=>normalize(c.store)===normalize(s)));
 const population=cities.length&&!unsupported?cities.reduce((s,c)=>s+c.population,0):null;
 // Compare the selected sales volume with the selected store service-area population.
 const territory=base;
 const saleMonths=base.map(r=>String(r.data_venda||'').slice(0,7)).filter(m=>/^\d{4}-\d{2}$/.test(m)).sort();
 const first=String(filters.from||saleMonths[0]||'').slice(0,7),last=String(filters.to||saleMonths.at(-1)||first).slice(0,7);
 const months=/^\d{4}-\d{2}$/.test(first)&&/^\d{4}-\d{2}$/.test(last)?Math.max(1,index(last)-index(first)+1):1;
 const monthlyVolume=base.length/months,monthlyHumanSales=human.length/months;
 const cityPerformance=cities.map(city=>{const sales=base.filter(r=>normalize(r.loja)===normalize(city.store)&&cityKey(r.municipio)===cityKey(city.name)).length;return {...city,sales,ratio:sales?city.population/(sales/months):null};}).filter(c=>c.ratio!==null).sort((a,b)=>a.ratio-b.ratio||a.name.localeCompare(b.name,'pt-BR'));
 const bestCity=cityPerformance[0]||null;
 const target=population===null?null:Math.ceil(population/1000),gap=target===null?null:Math.ceil(Math.max(0,target-monthlyVolume));
 const elapsed=base.map(r=>{const sold=day(r.data_venda),drawn=day(r.data_contemplacao);return sold!==null&&drawn!==null&&drawn>=sold?drawn-sold:null;}).filter(n=>n!==null);
 const insured=base.filter(r=>r.seguro_vida===true).length,uninsured=base.filter(r=>r.seguro_vida===false).length,known=insured+uninsured;
 const model=mostCommon(base,r=>String(r.modelo||'').trim());
 const combination=model?mostCommon(base.filter(r=>String(r.modelo||'').trim()===model[0]),r=>r.plano&&Number(r.prazo)>0?JSON.stringify([r.plano,Number(r.prazo)]):null):null;
 return {bestCity,months,monthlyVolume,monthlyHumanSales,volume:base.length,credit,ticket:base.length?credit/base.length:null,sellers,humanSales:human.length,productivity:sellers?monthlyHumanSales/sellers:null,population,cities:cities.length,territorySales:territory.length,inhabitantsPerSale:population!==null&&monthlyVolume?population/monthlyVolume:null,target,gap,opportunity:target!==null&&monthlyVolume?Math.max(0,target-monthlyVolume)/monthlyVolume*100:null,averageDays:elapsed.length?elapsed.reduce((a,b)=>a+b,0)/elapsed.length:null,dated:elapsed.length,insured,uninsured,insuranceMissing:base.length-known,insuredPercent:known?insured/known*100:null,uninsuredPercent:known?uninsured/known*100:null,model:model?.[0]||null,modelSales:model?.[1]||0,plan:combination?JSON.parse(combination[0])[0]:null,term:combination?JSON.parse(combination[0])[1]:null};
}
export function hondaSummaryCards(scope,allRows=scope,officialReports=[],periodRows=scope,month=currentMonth(),filters={}){
 const s=salesOverviewSummary(periodRows,allRows,filters),count=v=>v.toLocaleString('pt-BR'),value=v=>v===null?'—':number(v);
 const detail=(label,v)=>`<div class="honda-overview-detail"><span>${label}</span><b>${v}</b></div>`;
 const share=s.insuredPercent===null?0:s.insuredPercent;
 return `<div class="exec-kpis honda-summary-cards honda-overview-cards">
 <article class="exec-kpi"><span>Volume de vendas</span><strong>${count(s.volume)} <em>cotas</em></strong>${detail('Crédito',money(s.credit))}${detail('Ticket médio',s.ticket===null?'—':money(s.ticket))}${detail('Média mensal',value(s.monthlyVolume)+' cotas/mês')}</article>
 <article class="exec-kpi"><span>Produtividade mensal</span><strong>${value(s.productivity)} <em>cotas/vendedor/mês</em></strong>${detail('Vendedores ativos',count(s.sellers))}${detail('Cotas por mês',value(s.monthlyHumanSales))}</article>
 <article class="exec-kpi"><span>Cota por habitante · mensal</span><strong>${s.inhabitantsPerSale===null?'—':'1 : '+count(Math.round(s.inhabitantsPerSale))}</strong>${detail('Gap para 1 : 1.000',s.gap===null?'—':count(s.gap)+' cotas/mês')}${detail('Potencial de crescimento',percent(s.opportunity))}${detail('Melhor cidade',s.bestCity?escapeHtml(s.bestCity.name)+' · 1 : '+count(Math.round(s.bestCity.ratio)):'—')}<a class="honda-population-source" href="${populationSource}" target="_blank" rel="noopener noreferrer">IBGE ${populationYear} · meta ${s.target===null?'—':count(s.target)} cotas/mês</a></article>
 <article class="exec-kpi"><span>Tempo até contemplação</span><strong>${value(s.averageDays)} <em>dias</em></strong><small>Média entre venda e contemplação</small></article>
 <article class="exec-kpi honda-insurance-card"><span>Seguro de vida</span><div class="honda-insurance-content"><div class="honda-insurance-donut" role="img" aria-label="Com seguro ${percent(s.insuredPercent)}; sem seguro ${percent(s.uninsuredPercent)}" style="--insurance-share:${share}%"><span>${s.insuredPercent===null?'—':Math.round(share)+'%'}</span></div><div>${detail('Com seguro',percent(s.insuredPercent))}${detail('Sem seguro',percent(s.uninsuredPercent))}</div></div>${s.insuranceMissing?'<small>'+count(s.insuranceMissing)+' cotas sem informação de seguro</small>':''}</article>
 <article class="exec-kpi"><span>Moto mais vendida</span><strong class="honda-top-model">${escapeHtml(s.model||'—')}</strong>${detail('Vendas do modelo',count(s.modelSales))}${detail('Plano mais vendido',escapeHtml(s.plan||'—'))}${detail('Prazo',s.term?s.term+' meses':'—')}</article>
 </div>`;
}

export function premiumQualityCard(scope,allRows,officialReports,year,month){
 const reference=`${year}-${String(month).padStart(2,'0')}`,result=premiumSummary(scope,allRows,officialReports,reference),stores=result.details.length;
 const status=!stores?'Sem vendas elegíveis':result.qualifying===stores?'Apto':result.qualifying?`${result.qualifying} de ${stores} lojas aptas`:result.missing?'Apuração incompleta':'Não apto';
 const reasons=result.details.filter(d=>!d.ok).map(d=>d.store+': '+(!d.ready?'faltam dados de qualidade':[d.volume<50?'menos de 50 cotas no mês':'',d.cancel.rate>25?'cancelamento acima de 25%':'',d.retention.rate<54?'retenção abaixo de 54%':''].filter(Boolean).join(', '))).join(' · ');
 return `<article class="exec-kpi honda-quality-premium" data-quality-premium><span>CNH Premium · ${String(month).padStart(2,'0')}/${year}</span><strong>${money(result.gain)}</strong><small class="honda-premium-eligibility" title="${escapeHtml(reasons||'Critérios atendidos nas lojas aptas.')}" data-premium-eligible="${result.qualifying>0}">${escapeHtml(status)}</small><small>Bônus estimado do mês</small></article>`;
}
