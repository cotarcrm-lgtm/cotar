import {activeReservation} from './used-reservations.js';
import {validCPF} from './auth.js';
import {inScope,deny,permittedScreens} from './policy.js';
import {costOf} from '../public/config.js';
export function saleFromLead(actor,data,body,old,all){
 const fail=(m,s=400)=>deny(m,s);
 const lead=all.leads.find(l=>l.id===data.leadId);
 if(!lead||!inScope(actor,'leads',lead,all)||(!permittedScreens(actor).includes('leads')&&!(old&&permittedScreens(actor).includes('sales'))))fail('Lead indisponível para registrar esta venda.',403);
 if(old&&data.leadId!==old.leadId)fail('Não é possível trocar o lead de origem da venda.');
 if(!old&&!lead.modality)fail('Defina a modalidade e o modelo/plano no lead antes de registrar a venda.');
 if(!old&&lead.status==='Perdido')fail('Reabra o lead perdido antes de registrar uma venda.');
 const source=old?.leadSnapshot||{id:lead.id,version:lead.version,name:lead.name,modality:lead.modality||'Seminova',category:lead.category||'',model:lead.model||lead.interest||'',consortium:lead.consortium||null};
 if(source.modality!=='Consórcio'&&(body.dossierVersion===1||old?.dossierVersion===1)){
  if(data.customerCpf&&!validCPF(data.customerCpf))fail('Informe um CPF válido para o cliente.');
  if(data.customerPhone&&![10,11].includes(data.customerPhone.replace(/\D/g,'').length))fail('Informe um celular com DDD.');
  if(data.birthDate&&data.birthDate>new Date().toISOString().slice(0,10))fail('Nascimento não pode ser futuro.');
  for(const key of ['manufacturingYear','modelYear'])if(data[key]&&!/^(19|20)\d{2}$/.test(data[key]))fail('Informe um ano válido com quatro dígitos.');
  if(!Number.isInteger(data.installments)||data.installments>999)fail('Informe um número inteiro de parcelas, até 999.');
  if(data.downPayment>data.amount)fail('A entrada não pode superar o valor da venda.');
  if(data.status==='Concluída')for(const key of ['customerName','customerPhone','customerCpf','saleType','postalCode','street','streetNumber','neighborhood','state','city'])if(!data[key])fail('Complete os dados do cliente, tipo de venda e endereço antes de concluir.');
 }
 const out={...data,vehicleId:old?.vehicleId||lead.usedInterest?.vehicleId||data.vehicleId,storeId:old?.storeId||lead.storeId,userId:old?.userId||lead.userId,modality:source.modality,category:source.category,model:source.model,consortium:source.consortium,leadSnapshot:source,...(source.modality!=='Consórcio'&&(body.dossierVersion===1||old?.dossierVersion===1)?{dossierVersion:1}:{})};
 if(out.modality==='Seminova'){
  const v=all.vehicles.find(v=>v.id===out.vehicleId);
  if(!v||v.storeId!==out.storeId||!(inScope(actor,'vehicles',v,all)||lead.usedInterest?.vehicleId===v.id&&inScope(actor,'stores',all.stores.find(s=>s.id===v.storeId),all)))fail('Selecione um seminovo da loja e dentro do seu alcance.');
  const hold=activeReservation(v);if(hold&&hold.userId!==actor.id&&hold.userId!==lead.userId)fail('Este veículo está reservado para outra negociação.',409);
  if(v.condition&&v.condition!=='Seminovo')fail('O estoque permite somente seminovos.');
  if(!old&&v.status!=='Disponível')fail('O seminovo precisa estar disponível para venda.');
  if(v.category&&out.category&&v.category!==out.category)fail('A categoria do seminovo deve corresponder à do lead.');
  if(all.sales.some(s=>s.id!==old?.id&&s.vehicleId===v.id&&s.status==='Concluída'))fail('Este seminovo já foi vendido.',409);
  out.cost=old&&old.vehicleId===v.id?old.cost:costOf(v);out.model=old&&old.vehicleId===v.id?old.model:v.name;out.category=v.category||out.category;
 }else{
  if(data.vehicleId)fail('Vincule estoque somente a vendas de seminovos.');
  out.vehicleId='';
 }
 return out;
}

export function saleConsortiumRules(data,body,old,available){
 if(body.consortiumFormVersion!==1&&old?.consortiumFormVersion!==1)return data;
 const fail=message=>deny(message,400);
 const document=String(data.customerDocument||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
 if(document&&!(document.length===11&&validCPF(document)||/^[A-Z0-9]{12}[0-9]{2}$/.test(document)))fail('Informe um CPF válido ou um CNPJ completo.');
 if(data.status==='Concluída'&&(!document||!data.proposalNumber||!data.proposalDigit||!data.quotaType||!data.postalCode||!data.city))fail('Preencha CPF/CNPJ, proposta, dígito, tipo de cota, CEP e cidade.');
 if(!Number.isInteger(data.consortiumInstallments)||data.consortiumInstallments<1||data.consortiumInstallments>999||data.consortiumInstallment<=0)fail('Informe a quantidade e o valor das parcelas.');
 const id=data.salePlanId||data.consortium?.id;
 const previous=old?.consortium||data.consortium;
 let plan=previous?.id===id?previous:available.plans.find(p=>p.id===id);
 if(!plan||plan.administratorId!==data.consortium?.administratorId)fail('Selecione um plano da administradora do lead.');
 if(previous?.id!==id&&(plan.active===false||plan.reviewRequired||!available.enabledAdministratorIds.includes(plan.administratorId)))fail('Este plano não está liberado para negociação.');
 return {...data,consortiumFormVersion:1,salePlanId:id,customerDocument:document,model:plan.model,consortium:{...plan,insurance:previous?.insurance,dueDay:previous?.dueDay,months:data.consortiumInstallments,installmentCents:Math.round(data.consortiumInstallment*100)}};
}
