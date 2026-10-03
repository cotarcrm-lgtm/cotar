import {eligibleHondaSale} from '../public/honda-eligibility.js';
import {deny,companyData,inScope,permittedScreens} from './policy.js';
import {centralScreenAllowed} from '../public/access-policy.js';
export async function hondaSalesDashboard(db,actor,{includeClients=false}={}){
 if(!permittedScreens(actor).some(s=>['leads','sales'].includes(s))||!centralScreenAllowed(actor,'vendas-honda'))deny('Sem acesso aos indicadores Honda.',403);
 const companies=(await companyData(db,actor,['companies'])).companies;
 const importedStores=[...new Set(companies.flatMap(c=>Array.isArray(c.hondaImportStores)?c.hondaImportStores:[]).filter(n=>typeof n==='string'&&n))];
 if(!importedStores.length)deny('Este relatório não está disponível para sua empresa.',403);
 let clause=` WHERE loja IN (${importedStores.map(()=>'?').join(',')})`,args=[...importedStores];
 if(actor.role!=='Administrador'){
  const all=await companyData(db,actor,['users','stores','regions','teams','groups']);
  const ids=all.users.filter(u=>inScope(actor,'users',u,all)).map(u=>u.id);
  if(!ids.length)return {rows:[],updatedAt:null};
  const accounts=(await db.prepare(`SELECT cpf FROM accounts WHERE user_id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results;
  const cpfs=accounts.map(a=>String(a.cpf||'').replace(/\D/g,'').padStart(11,'0')).filter(c=>/^\d{11}$/.test(c));
  if(!cpfs.length)return {rows:[],updatedAt:null};
  clause+=` AND cpf_vendedor IN (${cpfs.map(()=>'?').join(',')})`;args.push(...cpfs);
 }
 const rows=(await db.prepare(`SELECT ${includeClients?'cliente,celular,telefone_1,telefone_2,telefone_3,':''}v.id,v.grupo,v.cota,v.r,v.d,EXISTS(SELECT 1 FROM public.reservas reservation WHERE reservation.grupo ~ '^\\s*[0-9]+\\s*$' AND reservation.cota ~ '^\\s*[0-9]+-[0-9]+-[0-9]+\\s*$' AND ltrim(trim(reservation.grupo),'0')=ltrim(v.grupo::text,'0') AND ltrim(split_part(trim(reservation.cota),'-',1),'0')=ltrim(v.cota::text,'0') AND ltrim(split_part(trim(reservation.cota),'-',2),'0')=ltrim(v.r::text,'0') AND ltrim(split_part(trim(reservation.cota),'-',3),'0')=ltrim(v.d::text,'0') AND upper(trim(reservation.loja))=upper(trim(v.loja))) AS reserva_correspondente,proposta,digito_proposta,cpf_vendedor,nome_vendedor,municipio,tipo_contrato,data_venda,data_vencimento,prazo,modelo,status,credito,parcela,data_contemplacao,tipo_contemplacao,plano,seguro_vida,loja,data_relatorio,percentual_amortizado,percentual_mensal FROM public.vendascnhhonda v${clause} ORDER BY data_venda,id`).bind(...args).all()).results;
 const cancellationReports=companies.flatMap(c=>Array.isArray(c.hondaCancellationOfficial)?c.hondaCancellationOfficial:[]).filter(r=>importedStores.includes(r.store));
 const secondParcelReports=companies.flatMap(c=>Array.isArray(c.hondaSecondParcelOfficial)?c.hondaSecondParcelOfficial:[]).filter(r=>importedStores.includes(r.store));
 const secondMap=new Map(secondParcelReports.map(r=>[r.store+':'+r.cohort,new Set((r.contracts||[]).map(c=>c.proposal+':'+c.digit))]));
 const reportMap=new Map(cancellationReports.filter(r=>Array.isArray(r.contracts)).map(r=>[r.store+':'+r.cohort,new Set(r.contracts.map(c=>c.proposal+':'+c.digit))]));
 const structure=await companyData(db,actor,['users','teams','stores']);const userIds=structure.users.map(u=>u.id);const links=userIds.length?(await db.prepare(`SELECT user_id,cpf FROM accounts WHERE user_id IN (${userIds.map(()=>'?').join(',')})`).bind(...userIds).all()).results:[];const teamByStoreCpf=hondaTeamLookup(companies,structure,links);
 return {secondParcelReports:actor.role==='Administrador'||['Diretor','Gerente Corporativo','Gerente Comercial','Gerente de Loja','Administrativo'].includes(actor.role)?secondParcelReports.map(({contracts,...summary})=>summary):[],cancellationReports:actor.role==='Administrador'||['Diretor','Gerente Corporativo','Gerente Comercial','Gerente de Loja','Administrativo'].includes(actor.role)?cancellationReports.map(({contracts,...summary})=>summary):[],rows:rows.filter(eligibleHondaSale).map(r=>{const {cpf_vendedor,...safe}=r;const official=reportMap.get(r.loja+':'+String(r.data_venda).slice(0,7));const second=secondMap.get(r.loja+':'+String(r.data_venda).slice(0,7));return {...safe,honda_segunda_atraso:second?second.has(r.proposta+':'+r.digito_proposta):null,honda_cancelamento_oficial:official?official.has(r.proposta+':'+r.digito_proposta):null,equipe:teamByStoreCpf.get(r.loja+':'+String(cpf_vendedor||'').replace(/\D/g,'').padStart(11,'0'))||'Sem equipe vinculada',credito:Number(r.credito||0),parcela:Number(r.parcela||0)};}),updatedAt:rows.reduce((last,r)=>r.data_relatorio>last?r.data_relatorio:last,'')||null};
}

const normalizedStore=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
export function hondaTeamLookup(companies,structure,links){const result=new Map();for(const account of links){const user=structure.users.find(u=>u.id===account.user_id),team=structure.teams.find(t=>t.id===user?.teamId),store=structure.stores.find(s=>s.id===user?.storeId);if(!user||!team||!store||team.companyId!==user.companyId||store.companyId!==user.companyId||team.storeId!==store.id)continue;const company=companies.find(c=>c.id===user.companyId);for(const importedStore of company?.hondaImportStores||[]){if(normalizedStore(importedStore)!==normalizedStore(store.name))continue;result.set(importedStore+':'+String(account.cpf||'').replace(/\D/g,'').padStart(11,'0'),team.name);}}return result;}
