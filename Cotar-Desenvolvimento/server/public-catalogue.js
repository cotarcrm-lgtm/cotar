import {centralScreenAllowed} from '../public/access-policy.js';
import {recordForStorage} from './text-standardization.js';
import {catalogueFor,enabledAdministrators,consortiumSelection} from './consortium.js';
import {deny,unpack,permittedScreens} from './policy.js';
import {limit} from './auth.js';
import {validateAppointment} from '../public/lead-utils.js';
import {financingChoiceForModel,simulateCdc,cdcTableDate} from '../public/cdc-data.js';
const unavailable=()=>deny('Este catálogo não está disponível. Peça um novo link ao seu consultor.',404);
const publicKeys=['administratorId','category','group','groupMonths','integralCreditCents','reducedInstallmentPercent','id','model','modelCode','family','creditCents','cashPriceCents','documentationCents','documentationPercent','months','installmentWithInsuranceCents','installmentWithoutInsuranceCents','dueDays','contemplations','participants','contemplationRule','adminPercent','reservePercent','insurancePercent','dilutedBidPercent','geographyNote','excludedStates','notes','effectiveDate','revision'];
export async function ownerCatalogue(db,actor,requestedStoreId){
 if(actor.status!=='Ativo'||!centralScreenAllowed(actor,'catalogo')||!permittedScreens(actor).includes('leads'))unavailable();
 const storeId=requestedStoreId||actor.storeId;
 if(storeId!==actor.storeId&&actor.role!=='Administrador')unavailable();
 const companyRow=await db.prepare('SELECT * FROM companies WHERE id=?').bind(actor.companyId).first();
 const storeRow=await db.prepare('SELECT * FROM stores WHERE id=? AND company_id=?').bind(storeId||'',actor.companyId).first();
 if(!companyRow||!storeRow||['Inativo','Inativa'].includes(unpack(storeRow).status))unavailable();
 const company=unpack(companyRow);if(!enabledAdministrators(company,unpack(storeRow)).length)deny('A empresa não tem administradoras habilitadas.',404);
 const selectedActor={...actor,storeId},catalogue=await catalogueFor(db,company,selectedActor);
 const plans=catalogue.plans.filter(p=>catalogue.enabledAdministratorIds.includes(p.administratorId)&&p.active!==false&&!p.reviewRequired);
 return {actor:selectedActor,company,plans,modelImages:catalogue.modelImages};
}
export async function shareLink(db,actor,storeId){
 const selected=storeId||actor.storeId;await ownerCatalogue(db,actor,selected);
 const key='catalogue-share-owner:'+actor.id+(selected===actor.storeId?'':':'+selected);
 const existing=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
 if(existing)return JSON.parse(existing.value);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const value=JSON.stringify({token,userId:actor.id,companyId:actor.companyId,storeId:selected});
 try{await db.batch([db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind(key,value),db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('catalogue-share:'+token,value)])}catch(e){const winner=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();if(winner)return JSON.parse(winner.value);throw e}
 return JSON.parse(value);
}
export async function resolveCatalogue(db,token){
 const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind('catalogue-share:'+token).first();if(!row)unavailable();
 const link=JSON.parse(row.value),user=await db.prepare('SELECT * FROM users WHERE id=? AND company_id=?').bind(link.userId,link.companyId).first();if(!user)unavailable();
 return ownerCatalogue(db,unpack(user),link.storeId);
}
export function publicCatalogue(context){const {actor,company,plans,modelImages}=context;return {consultant:actor.nickname||actor.name?.split(' ')[0]||'Consultor',consultantPhone:actor.phone||'',company:company.name,serverTime:new Date().toISOString(),modelImages,plans:plans.map(p=>Object.fromEntries(publicKeys.map(k=>[k,p[k]])))};}
export async function captureLead(db,req,token,b){
 const {actor,plans}=await resolveCatalogue(db,token);
 const phone=String(b.phone||'').replace(/\D/g,'');
 await limit(db,req,phone,'catalogue');
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(b.submissionId||''))deny('Recarregue o formulário e tente novamente.',400);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token+':'+b.submissionId));
 const id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 if(await db.prepare('SELECT id FROM leads WHERE id=? AND company_id=?').bind(id,actor.companyId).first())return {ok:true};
 const name=String(b.name||'').trim(),notes=String(b.notes||'').trim();
 if(name.length<2||name.length>120||!/^\d{10,11}$/.test(phone)||notes.length>1000||b.consent!==true||b.website)deny('Revise seu nome, telefone e autorização de contato.',400);
 const plan=plans.find(p=>p.id===b.planId);if(!plan)deny('Este plano não está mais disponível. Atualize o catálogo.',409);
 if(Number(b.revision)!==plan.revision)deny('O plano foi atualizado. Atualize o catálogo para conferir os valores.',409);
 const modality=b.modality||'Consórcio';if(!['Consórcio','Financiamento'].includes(modality))deny('Escolha consórcio ou financiamento.',400);
 let selected={},financing;
 try{
  validateAppointment({scheduledAt:b.scheduledAt,status:'Agendado'});
  if(modality==='Consórcio')selected=consortiumSelection({...b,modality,administratorId:plan.administratorId},{plans},null,[plan.administratorId]);
  else{
   if(plan.administratorId!=='honda')deny('Financiamento indisponível para este plano.',400);
   const choice=b.financing||{},percent=Number(choice.entryPercent),cashPriceCents=Number(choice.cashPriceCents),canonical=financingChoiceForModel(plan.model,percent,choice.months);
   if(!canonical||!Number.isSafeInteger(cashPriceCents)||cashPriceCents<100||cashPriceCents>1e9||cashPriceCents!==plan.cashPriceCents||canonical.tableId!==choice.tableId||canonical.code!==choice.code)deny('Condições do financiamento desatualizadas. Atualize o catálogo.',409);
   const result=simulateCdc({...canonical,price:cashPriceCents/100});
   if(!result?.valid)deny('Esta condição não atende aos limites da tabela de financiamento.',400);
   financing={tableId:canonical.tableId,tableDate:cdcTableDate,code:result.code,months:result.months,entryPercent:percent,cashPriceCents,entryCents:Math.round(result.entry*100),installmentCents:Math.round(result.installment*100),upfrontCents:Math.round(result.upfront*100),totalCents:Math.round(result.total*100),monthlyRate:result.monthlyRate,projected:false};
  }
 }catch(e){if(e.status)throw e;deny(e.message,400)}
 const now=new Date().toISOString();const d={...selected,name,phone,email:'',source:'Catálogo',modality,category:modality==='Consórcio'?'':'Moto',model:plan.model,status:'Agendado',temperature:'Morno',scheduledAt:new Date(b.scheduledAt).toISOString(),userId:actor.id,storeId:actor.storeId,notes:'Contato solicitado pelo comparativo Honda: '+modality+'. '+notes,...(financing?{financing}:{}),catalogueCapture:{sharedBy:actor.id,consentAt:now,consentText:'Autorizo o contato do consultor sobre a modalidade escolhida.'}};
 try{await db.prepare('INSERT INTO leads (id,data,company_id,created_by,created_at,updated_at,store_id,user_id) VALUES (?,?,?,?,?,?,?,?)').bind(id,JSON.stringify(recordForStorage('leads',d)),actor.companyId,actor.id,now,now,actor.storeId,actor.id).run()}catch(e){if(!await db.prepare('SELECT id FROM leads WHERE id=? AND company_id=?').bind(id,actor.companyId).first())throw e}
 return {ok:true};
}
