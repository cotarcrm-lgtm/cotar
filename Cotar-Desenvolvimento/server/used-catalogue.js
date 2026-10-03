import {centralScreenAllowed} from '../public/access-policy.js';
import {deny,companyData,unpack,inScope,permittedScreens} from './policy.js';
import {limit,validCPF} from './auth.js';
import {recordForStorage} from './text-standardization.js';
import {lookupCep} from './cep.js';
import {saveSaleDocuments} from './sale-documents.js';
import {activeReservation,reservable,canCancelUsedReservation,changeUsedReservation} from './used-reservations.js';
import {marketReference,simulateUsedFinance} from '../public/used-market.js';
import {catalogueFor,enabledAdministrators} from './consortium.js';
const kinds=['companies','stores','regions','users','vehicles','assessments','sales'];
const photos=['front','left','right','rear','panel'];
const mayUse=a=>a.status==='Ativo'&&permittedScreens(a).some(s=>['leads','sales'].includes(s));
const up=v=>String(v||'').trim().toUpperCase();
const scopedStores=(actor,all)=>all.stores.filter(s=>s.status!=='Inativo'&&inScope(actor,'stores',s,all));
const ready=(v,all)=>v.flowVersion===2&&v.assessmentId&&all.assessments.some(a=>a.id===v.assessmentId&&['ACEITO','Aceito','Aprovada para captação','DISPONÍVEL PARA REVENDA'].includes(a.status))&&reservable(v,all.sales);
export async function marketRate(){return {...marketReference};}
export function safeUsedVehicle(v,all,photoBase){
 const a=all.assessments.find(a=>a.id===v.assessmentId),store=all.stores.find(s=>s.id===v.storeId),reservation=activeReservation(v);
 return {id:v.id,model:v.model||v.name,brand:v.brand||'',family:v.family||a?.vehicleDetails?.family||'',year:v.year||'',modelYear:v.modelYear||'',color:v.color||'',mileage:Number(v.mileage)||0,price:Number(v.salePrice),storeId:v.storeId,storeName:store?.name||'',city:store?.city||'',state:store?.state||'',reserved:!!reservation,reservationExpiresAt:reservation?.expiresAt||null,photos:photos.filter(p=>a?.vehicleFiles?.[p]?.type?.startsWith('image/')).map(slot=>({slot,url:`${photoBase}/${v.id}/photos/${slot}`}))};
}
export async function usedConsortiumPlans(db,actor,all){
 if(!enabledAdministrators(all.companies[0],all.stores.find(s=>s.id===actor.storeId)).includes('honda'))return [];
 const catalogue=await catalogueFor(db,all.companies[0],actor,all);
 return catalogue.plans.filter(p=>p.administratorId==='honda'&&p.active!==false&&!p.reviewRequired&&Number(p.creditCents)>0&&Number(p.installmentWithInsuranceCents)>0&&!/motores|máquinas/i.test(p.family||'')).map(p=>({id:p.id,model:p.model,family:p.family,creditCents:p.creditCents,months:p.months,installmentWithInsuranceCents:p.installmentWithInsuranceCents,effectiveDate:p.effectiveDate,revision:p.revision,excludedStates:p.excludedStates||[]}));
}
export async function usedLink(db,actor,storeId){
 if(!mayUse(actor))deny();const all=await companyData(db,actor,['stores','regions','users']);
 const store=scopedStores(actor,all).find(s=>s.id===(storeId||actor.storeId));if(!store)deny('Selecione uma loja do seu alcance.',400);
 const key=`used-share-owner:${actor.companyId}:${actor.id}:${store.id}`,existing=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();if(existing)return JSON.parse(existing.value);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),link={token,userId:actor.id,companyId:actor.companyId,storeId:store.id},value=JSON.stringify(link);
 try{await db.batch([db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind(key,value),db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('used-share:'+token,value)])}catch(e){const winner=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();if(winner)return JSON.parse(winner.value);throw e}return link;
}
async function context(db,token,vehicleId){
 const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind('used-share:'+token).first();if(!row)deny('Este catálogo não está disponível.',404);
 const link=JSON.parse(row.value),user=await db.prepare('SELECT * FROM users WHERE id=? AND company_id=?').bind(link.userId,link.companyId).first();if(!user)deny('Este catálogo não está disponível.',404);
 const actor=unpack(user),all=await companyData(db,link.companyId,vehicleId?['companies','stores','regions','users']:kinds);if(vehicleId){const v=await db.prepare('SELECT * FROM vehicles WHERE id=? AND company_id=?').bind(vehicleId,link.companyId).first();all.vehicles=v?[unpack(v)]:[];const a=v?await db.prepare('SELECT * FROM assessments WHERE id=? AND company_id=?').bind(unpack(v).assessmentId||'',link.companyId).first():null;all.assessments=a?[unpack(a)]:[];all.sales=(await db.prepare('SELECT * FROM sales WHERE vehicle_id=? AND company_id=?').bind(vehicleId,link.companyId).all()).results.map(unpack);}const store=scopedStores(actor,all).find(s=>s.id===link.storeId);
 if(!centralScreenAllowed(actor,'seminovos-catalogo')||!mayUse(actor)||!store||all.companies[0]?.status==='Inativo')deny('Este catálogo não está disponível.',404);
 return {actor:{...actor,storeId:store.id},all,link,items:all.vehicles.filter(v=>v.storeId===store.id&&ready(v,all))};
}
async function vehiclePhoto(env,v,all,slot){
 if(!photos.includes(slot))deny('Foto indisponível.',404);const a=all.assessments.find(a=>a.id===v.assessmentId),photo=a?.vehicleFiles?.[slot];if(!photo?.type?.startsWith('image/')||!env.PHOTOS)deny('Foto indisponível.',404);
 const file=await env.PHOTOS.get(`used/${v.companyId}/${a.id}/${slot}/${photo.id}`);if(!file)deny('Foto indisponível.',404);
 return new Response(file.body,{headers:{'Content-Type':photo.type,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
}
const cleanText=(v,min,max,label)=>{const s=up(v);if(s.length<min||s.length>max)deny(`Revise ${label}.`,400);return s};
function proposalFields(b){
 const cpf=String(b.cpf||'').replace(/\D/g,'');if(!validCPF(cpf))deny('CPF inválido.',400);
 const postalCode=String(b.postalCode||'').replace(/\D/g,'');if(!/^\d{8}$/.test(postalCode)||!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(up(b.state)))deny('Revise o CEP e o estado.',400);
 const income=Number(b.income);if(!Number.isFinite(income)||income<=0||income>1e8)deny('Informe sua renda mensal.',400);
 const birthDate=String(b.birthDate||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!Number.isFinite(Date.parse(birthDate))||new Date(birthDate).toISOString().slice(0,10)!==birthDate||Date.parse(birthDate)>Date.now()-18*365.25*86400000||Date.parse(birthDate)<Date.parse('1900-01-01'))deny('Informe a data de nascimento de uma pessoa maior de idade.',400);
 const fields={cpf,birthDate,postalCode,income};for(const [key,min,max] of [['street',2,180],['number',1,20],['neighborhood',2,100],['city',2,100],['occupation',2,120]])fields[key]=cleanText(b[key],min,max,key);
 fields.state=up(b.state);fields.complement=up(b.complement).slice(0,100);fields.employer=up(b.employer).slice(0,120);
 if(!['À vista','Financiamento'].includes(b.payment))deny('Escolha a forma de pagamento.',400);fields.payment=b.payment;return fields;
}
export async function submitUsedInterest(db,env,req,token,b){
 const {actor,all,items}=await context(db,token,String(b.vehicleId||'invalid')),phone=String(b.phone||'').replace(/\D/g,'');await limit(db,req,phone,'catalogue');
 if(!/^[a-zA-Z0-9-]{20,80}$/.test(b.submissionId||''))deny('Reabra o formulário.',400);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`used:${token}:${b.submissionId}`)),id=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 const existing=await db.prepare('SELECT id FROM leads WHERE id=? AND company_id=?').bind(id,actor.companyId).first();if(existing)return {ok:true,protocol:'S'+id.slice(0,8).toUpperCase()};
 const v=items.find(v=>v.id===b.vehicleId);if(!v)deny('O veículo não está mais disponível.',409);
 if(Number(b.advertisedPrice)!==Number(v.salePrice))deny('O preço do veículo foi atualizado. Atualize o catálogo antes de enviar.',409);
 const name=cleanText(b.name,3,120,'nome');if(!/^\d{10,11}$/.test(phone)||b.consent!==true||b.website)deny('Revise o telefone e autorize o tratamento dos dados.',400);
 const email=String(b.email||'').trim().toLowerCase();if(email.length>254||email&&!/^\S+@\S+\.\S+$/.test(email))deny('E-mail inválido.',400);
 if(!['contact','proposal','visit'].includes(b.intent))deny('Solicitação inválida.',400);
 if(b.intent==='proposal'&&activeReservation(v))deny('Este veículo está reservado. Você ainda pode solicitar contato.',409);
 let consortium;
 if(b.modality==='Consórcio'){const plans=await usedConsortiumPlans(db,actor,all),p=plans.find(p=>p.id===b.planId&&p.revision===Number(b.planRevision));if(!p||p.creditCents<Math.round(v.salePrice*100)||p.excludedStates.includes(all.stores.find(s=>s.id===v.storeId)?.state))deny('O plano de consórcio mudou ou não cobre o valor do veículo.',409);consortium={...p,totalCents:p.months*p.installmentWithInsuranceCents};}
 let dossier,documents=[];const now=new Date().toISOString();
 if(b.intent==='proposal'){
  dossier=proposalFields(b);if(!email)deny('Informe o e-mail para a proposta.',400);
  if(!Array.isArray(b.documents)||!['identity','residence','income'].every(slot=>b.documents.some(d=>d.slot===slot))||b.documents.length!==3||b.documents.some(d=>d.id))deny('Anexe RG ou CNH, comprovante de endereço e comprovante de renda.',400);
  if(dossier.payment==='Financiamento'){
   const ref=await marketRate(),simulation=simulateUsedFinance(v.salePrice,b.entryPercent,Number(b.months),ref);if(!simulation)deny('Condições da simulação inválidas.',400);dossier.financing={...simulation,source:ref.source,estimated:true};
  }
  const docSlots={identity:'identityFront',residence:'addressProof',income:'incomeProof'};
  documents=await saveSaleDocuments(env,actor.companyId,'proposal-'+id,b.documents.map(d=>({...d,slot:docSlots[d.slot]})));
  dossier.documents=documents.map(d=>({...d,url:`/api/used-proposals/${id}/documents/${d.id}`}));
 }
 let visitAt='';if(b.intent==='visit'){visitAt=String(b.visitAt||'');const timestamp=Date.parse(visitAt);if(!Number.isFinite(timestamp)||timestamp<=Date.now()||timestamp>Date.now()+90*86400000)deny('Escolha um horário futuro, em até 90 dias.',400);visitAt=new Date(timestamp).toISOString();}
 const notes=cleanText(b.notes||' ',0,1000,'observações');
 const data={name,phone,email,source:'Catálogo',modality:consortium?'Consórcio':'Seminova',category:'Moto',model:v.model||v.name,interest:v.model||v.name,vehicleId:v.id,userId:actor.id,storeId:actor.storeId,status:'Agendado',temperature:'Morno',scheduledAt:visitAt||now,notes:`SEMINOVOS · ${b.intent==='proposal'?'PROPOSTA COMPLETA':b.intent==='visit'?'AGENDAMENTO DE VISITA':'SOLICITAÇÃO DE CONTATO'} · ${notes}`,usedInterest:{consortium,intent:b.intent,vehicleId:v.id,vehicleModel:v.model||v.name,advertisedPrice:Number(v.salePrice),status:'RECEBIDA',receivedAt:now,visitAt,protocol:'S'+id.slice(0,8).toUpperCase(),dossier,consentAt:now,consentText:'Autorizo o contato e o uso dos dados e documentos enviados para atendimento e análise desta proposta. A proposta não garante aprovação ou reserva.'}};
 try{await db.prepare('INSERT INTO leads (id,data,company_id,created_by,created_at,updated_at,store_id,user_id) VALUES (?,?,?,?,?,?,?,?)').bind(id,JSON.stringify(recordForStorage('leads',data)),actor.companyId,actor.id,now,now,actor.storeId,actor.id).run()}catch(e){if(!await db.prepare('SELECT id FROM leads WHERE id=? AND company_id=?').bind(id,actor.companyId).first())throw e}
 return {ok:true,protocol:data.usedInterest.protocol};
}
export async function publicUsedRequest(req,env,db,token,tail,b){
 if(req.method==='POST'&&tail==='/interest')return submitUsedInterest(db,env,req,token,b);
 if(req.method!=='GET')deny('Método não permitido.',405);
 const photo=tail.match(/^\/([a-z0-9-]+)\/photos\/(front|left|right|rear|panel)$/);
 const {actor,all,items}=await context(db,token,photo?.[1]|| (tail==='/cep'?'cep':undefined));
 if(tail==='/cep')return lookupCep(new URL(req.url).searchParams.get('cep'));
 if(photo){const v=items.find(v=>v.id===photo[1]);if(!v)deny('Foto indisponível.',404);return vehiclePhoto(env,v,all,photo[2]);}
 if(tail)deny('Rota indisponível.',404);
 return {items:items.map(v=>safeUsedVehicle(v,all,`/api/public/used/${token}`)),consultant:actor.nickname||actor.name?.split(' ')[0]||'Consultor',consultantPhone:actor.phone||'',company:all.companies[0]?.name||'COTAR',consortiumPlans:await usedConsortiumPlans(db,actor,all),reference:await marketRate(),serverTime:new Date().toISOString()};
}
export async function internalUsedRequest(req,env,db,actor,tail,b){
 if(!mayUse(actor))deny();const all=await companyData(db,actor,kinds),stores=scopedStores(actor,all),items=all.vehicles.filter(v=>stores.some(s=>s.id===v.storeId)&&ready(v,all));
 if(req.method==='GET'&&!tail)return {items:items.map(v=>({...safeUsedVehicle(v,all,'/api/used-catalogue'),version:v.version,reservedBy:activeReservation(v)?.userId||''})),stores:stores.map(s=>({id:s.id,name:s.name})),canCancel:canCancelUsedReservation(actor),consortiumPlans:await usedConsortiumPlans(db,actor,all),reference:await marketRate(),serverTime:new Date().toISOString()};
 if(req.method==='POST'&&tail==='/link'){const link=await usedLink(db,actor,b.storeId);return {url:new URL(req.url).origin+'/s/'+link.token};}
 const photo=tail.match(/^\/([a-z0-9-]+)\/photos\/(front|left|right|rear|panel)$/);if(req.method==='GET'&&photo){const v=items.find(v=>v.id===photo[1]);if(!v)deny('Foto indisponível.',404);return vehiclePhoto(env,v,all,photo[2]);}
 const reserve=tail.match(/^\/([a-z0-9-]+)\/reservation$/);if(req.method==='PUT'&&reserve){const v=items.find(v=>v.id===reserve[1]);if(!v)deny('Veículo indisponível.',404);return changeUsedReservation(db,actor,v,b,all.sales);}
 deny('Rota indisponível.',404);
}
export async function usedProposalsRequest(req,env,db,actor,tail,b){
 if(!mayUse(actor))deny();const all=await companyData(db,actor,['stores','regions','users','leads']),rows=all.leads.filter(l=>l.usedInterest&&inScope(actor,'leads',l,all));
 if(req.method==='GET'&&!tail)return {items:rows,canReserve:true};
 const doc=tail.match(/^\/([a-z0-9-]+)\/documents\/([a-z0-9-]+)$/);if(req.method==='GET'&&doc){const lead=rows.find(l=>l.id===doc[1]),file=lead?.usedInterest?.dossier?.documents?.find(d=>d.id===doc[2]);if(!file||!env.PHOTOS)deny('Documento indisponível.',404);const object=await env.PHOTOS.get(`sales/${actor.companyId}/proposal-${lead.id}/${file.id}`);if(!object)deny('Documento indisponível.',404);return new Response(object.body,{headers:{'Content-Type':file.type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 const m=tail.match(/^\/([a-z0-9-]+)$/);if(req.method==='PUT'&&m){const lead=rows.find(l=>l.id===m[1]);if(!lead)deny('Solicitação indisponível.',404);if(b.version!==lead.version)deny('A solicitação mudou. Atualize a lista.',409);if(!['RECEBIDA','EM ANÁLISE','CONTATO REALIZADO','APROVADA','RECUSADA'].includes(b.status))deny('Status inválido.',400);const {id,version,companyId,createdAt,createdBy,updatedAt,situation,...data}=lead;data.usedInterest={...data.usedInterest,status:b.status,reviewedBy:actor.id,reviewedAt:new Date().toISOString()};const result=await db.prepare('UPDATE leads SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify(data),new Date().toISOString(),id,version,actor.companyId).run();if(!result.meta.changes)deny('A solicitação mudou. Atualize a lista.',409);return {ok:true};}
 deny('Rota indisponível.',404);
}
