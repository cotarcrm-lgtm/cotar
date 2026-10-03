import honda from './honda-catalogue.json' with {type:'json'};
import disal from './disal-catalogue.json' with {type:'json'};
import disalWorkbook from './disal-workbook-catalogue.json' with {type:'json'};
import {normalizeRole} from '../public/config.js';
import {inScope} from './policy.js';
export const administrators=[{id:'honda',name:'Honda',description:'Motos, Advance e Motores & Máquinas'},{id:'disal',name:'Disal',description:'Veículos, imóveis e planos integrais ou Light'}];
export const enabledAdministrators=(company,store)=>{const enabled=Array.isArray(company?.administratorIds)?company.administratorIds:['honda','disal'];return store?.status==='Inativa'?[]:Array.isArray(store?.administratorIds)?enabled.filter(id=>store.administratorIds.includes(id)):enabled;};
export const catalogue={plans:[...honda.plans.map(p=>({...p,administratorId:'honda',active:true,revision:1,catalogueId:honda.id,effectiveDate:honda.effectiveDate,sourceName:honda.sourceName,notes:'Seguro acrescido somente quando contratado.',geographyNote:p.excludedStates.length?'Válido exceto AC, AM, RO e RR.':'Válido em todos os estados.'})),...disal.plans.map(p=>({...p,revision:1,catalogueId:disal.id})),...disalWorkbook.plans.map(p=>({...p,revision:1,catalogueId:disalWorkbook.id}))]};
const keyFor=(companyId,id)=>`catalogue:${companyId}:${id}`;
const priceKey=(companyId,storeId,modelCode)=>`catalogue-price:${companyId}:${storeId}:${modelCode}`;
const imageKey=(companyId,modelCode)=>`catalogue-image:${companyId}:${modelCode}`;
const priceEditors=new Set(['Administrador','Diretor','Gerente Regional','Gerente de Loja','Administrativo']);
export async function catalogueFor(db,company,actor,all){
 const rows=(await db.prepare('SELECT key,value FROM settings WHERE key LIKE ?').bind(`catalogue%:${actor.companyId}:%`).all()).results||[];
 const prices=new Map(rows.filter(r=>r.key.startsWith(`catalogue-price:${actor.companyId}:`)).map(r=>[r.key,JSON.parse(r.value)]));
 const modelImages=Object.fromEntries(rows.filter(r=>r.key.startsWith(`catalogue-image:${actor.companyId}:`)).map(r=>[r.key.slice(`catalogue-image:${actor.companyId}:`.length),JSON.parse(r.value)]));
 const policyStore=all?.stores.find(s=>s.id===actor.storeId)||unpackStore(await db.prepare('SELECT * FROM stores WHERE id=? AND company_id=?').bind(actor.storeId,actor.companyId).first());
 const overrides=new Map(rows.filter(r=>r.key.startsWith(`catalogue:${actor.companyId}:`)).map(r=>[r.key,JSON.parse(r.value)])),enabled=enabledAdministrators(company,policyStore),canEdit=actor.role==='Administrador';
 const legacy=rows.filter(r=>catalogue.plans.some(p=>p.administratorId==='honda'&&r.key===`catalogue-price:${actor.companyId}:${p.modelCode}`));
 let legacyStoreId=all?.users.find(user=>user.role==='Administrador')?.storeId;
 if(legacy.length&&!legacyStoreId){const users=(await db.prepare('SELECT data FROM users WHERE company_id=?').bind(actor.companyId).all()).results||[];legacyStoreId=users.map(r=>JSON.parse(r.data)).find(user=>user.role==='Administrador')?.storeId}
 const cashPrice=(store,modelCode)=>prices.get(priceKey(actor.companyId,store,modelCode))??(store===legacyStoreId?prices.get(`catalogue-price:${actor.companyId}:${modelCode}`):null)??null;
 const stores=all?.stores.filter(store=>store.status!=='Inativo'&&inScope(actor,'stores',store,all))||[];
 const storeId=stores.some(store=>store.id===actor.storeId)?actor.storeId:stores[0]?.id||actor.storeId;
 const storePrices=Object.fromEntries(stores.map(store=>[store.id,Object.fromEntries(catalogue.plans.filter(p=>p.administratorId==='honda').map(p=>[p.modelCode,cashPrice(store.id,p.modelCode)]))]));
 return {administrators:administrators.filter(a=>canEdit||enabled.includes(a.id)).map(a=>({...a,enabled:enabled.includes(a.id)})),enabledAdministratorIds:enabled,canEdit,canEditPrices:priceEditors.has(normalizeRole(actor.role)),canEditImages:priceEditors.has(normalizeRole(actor.role)),modelImages,priceStores:stores.map(({id,name})=>({id,name})),priceStoreId:storeId,storePrices,plans:catalogue.plans.map(base=>{const p=overrides.get(keyFor(actor.companyId,base.id))||base;return {...p,cashPriceCents:cashPrice(storeId,p.modelCode)}}).filter(p=>(canEdit&&!Array.isArray(policyStore?.administratorIds))||enabled.includes(p.administratorId))};
}
export async function saveModelImage(db,actor,{modelCode,imageData}){
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 if(!priceEditors.has(normalizeRole(actor.role)))fail('Seu cargo não pode alterar fotos do catálogo.',403);
 if(typeof modelCode!=='string'||!catalogue.plans.some(p=>p.administratorId==='honda'&&p.modelCode===modelCode))fail('Modelo Honda não encontrado.',404);
 if(typeof imageData!=='string'||imageData.length>350000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageData))fail('Envie uma foto WebP válida de até 250 KB.');
 const bytes=Uint8Array.from(atob(imageData.split(',')[1]),c=>c.charCodeAt(0));
 if(bytes.length>250000||bytes.length<100||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')fail('Arquivo de imagem inválido.');
 await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value').bind(imageKey(actor.companyId,modelCode),JSON.stringify(imageData)).run();
 return {modelCode,imageData};
}
export function consortiumSelection(body,available=catalogue,old=null,enabled=['honda','disal']){
 if(body.modality!=='Consórcio')return {administratorId:'',planId:'',insurance:'',dueDay:'',consortium:null};
 const oldAdministrator=old?.administratorId||old?.consortium?.administratorId||(old?.consortium?'honda':'');
 const administratorId=body.administratorId||(old?.planId===body.planId?oldAdministrator:'');
 if(!administrators.some(a=>a.id===administratorId))throw Error('Selecione a administradora.');
 // Existing negotiations retain their original price table. Client-supplied snapshots are ignored.
 const historical=body.refreshPlan!==true&&old?.consortium&&old.planId===body.planId&&oldAdministrator===administratorId;
 const plan=historical?{...old.consortium,administratorId}:available.plans.find(p=>p.id===body.planId&&p.administratorId===administratorId);
 if(!plan)throw Error('Selecione um plano válido da administradora.');
 if(!historical&&(!enabled.includes(administratorId)||plan.active===false||plan.reviewRequired))throw Error('Administradora ou plano não liberado para novas negociações.');
 if(!['Com seguro','Sem seguro'].includes(body.insurance))throw Error('Escolha a opção de seguro.');
 const installmentCents=body.insurance==='Com seguro'?plan.installmentWithInsuranceCents:plan.installmentWithoutInsuranceCents;
 if(!Number.isSafeInteger(installmentCents)||installmentCents<=0)throw Error('A parcela desta opção de seguro não está cadastrada.');
 const days=plan.dueDays||[],dueDay=days.length?Number(body.dueDay):null;
 if(days.length&&!days.includes(dueDay))throw Error('Selecione um vencimento disponível para o plano.');
 return {administratorId,planId:plan.id,insurance:body.insurance,dueDay:dueDay===null?'':String(dueDay),interest:plan.model,consortium:{...plan,administratorId,insurance:body.insurance,dueDay,installmentCents}};
}
const moneyKeys=['creditCents','integralCreditCents','documentationCents','planWithoutInsuranceCents','installmentWithInsuranceCents','installmentWithoutInsuranceCents'];
const numericKeys=['months','contemplations','participants','adminPercent','reservePercent','insurancePercent','documentationPercent','dilutedBidPercent','creditPercent'];
export function validatePlan(body,old){
 const out={...old};
 for(const key of ['model','modelCode','family','contemplationRule','notes','geographyNote','sourceName','sourceUrl','effectiveDate']){
  const v=body[key]??'';if(typeof v!=='string'||v.length>(key==='notes'?4000:500))throw Error('Revise os textos do plano.');out[key]=v.trim();
 }
 if(!out.model||!out.family)throw Error('Informe o modelo/produto e a família do plano.');
 if(out.sourceUrl&&!/^https:\/\/[^\s]+$/.test(out.sourceUrl))throw Error('Informe um link de fonte HTTPS.');
 if(out.effectiveDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.effectiveDate)||!Number.isFinite(Date.parse(out.effectiveDate))||new Date(out.effectiveDate).toISOString().slice(0,10)!==out.effectiveDate))throw Error('Vigência inválida.');
 for(const key of [...moneyKeys,...numericKeys]){
  const v=body[key];out[key]=v===null||v===''||v===undefined?null:Number(v);
  if(out[key]!==null&&(!Number.isFinite(out[key])||out[key]<0||out[key]>1e11||(moneyKeys.includes(key)&&!Number.isSafeInteger(out[key]))))throw Error('Valor inválido: '+key);
 }
 if(!out.creditCents||!Number.isInteger(out.months)||out.months<1||out.months>360)throw Error('Crédito e prazo são obrigatórios.');
 for(const key of ['contemplations','participants'])if(out[key]!==null&&!Number.isInteger(out[key]))throw Error('Contemplações e participantes devem ser inteiros.');
 if(!out.installmentWithInsuranceCents&&!out.installmentWithoutInsuranceCents)throw Error('Informe pelo menos uma parcela.');
 if(!Array.isArray(body.dueDays)||body.dueDays.some(d=>!Number.isInteger(d)||d<1||d>31))throw Error('Use dias de vencimento entre 1 e 31.');out.dueDays=[...new Set(body.dueDays)].sort((a,b)=>a-b);
 if(typeof body.active!=='boolean'||typeof body.reviewRequired!=='boolean')throw Error('Situação inválida.');out.active=body.active;out.reviewRequired=body.reviewRequired;
 if(out.active&&out.reviewRequired)throw Error('Conclua a conferência antes de ativar o plano.');
 return out;
}
export async function savePlan(db,actor,id,body){
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 if(actor.role!=='Administrador')fail('Somente o administrador da empresa pode editar os planos.',403);
 const base=catalogue.plans.find(p=>p.id===id);if(!base)fail('Plano não encontrado.',404);
 const key=keyFor(actor.companyId,id),stored=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first(),old=stored?JSON.parse(stored.value):base;
 if(body.revision!==old.revision)fail('O plano foi alterado. Reabra para conferir a versão atual.',409);
 let next;try{next=validatePlan(body,old)}catch(e){fail(e.message)}next.revision=old.revision+1;next.updatedAt=new Date().toISOString();next.updatedBy=actor.id;
 const value=JSON.stringify(next);
 const result=stored?await db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(value,key,stored.value).run():await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO NOTHING').bind(key,value).run();
 if(!result.meta.changes)fail('O plano mudou durante a edição. Reabra e tente novamente.',409);
 return next;
}

export async function saveModelCashPrice(db,actor,{storeId,modelCode,cashPriceCents},all){
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 if(!priceEditors.has(normalizeRole(actor.role)))fail('Seu cargo não pode cadastrar o preço à vista.',403);
 const store=all?.stores.find(s=>s.id===storeId&&s.status!=='Inativo');
 if(!store||!inScope(actor,'stores',store,all))fail('Loja fora do seu alcance.',403);
 if(typeof modelCode!=='string'||!catalogue.plans.some(p=>p.administratorId==='honda'&&p.modelCode===modelCode))fail('Modelo Honda não encontrado.',404);
 if(cashPriceCents!==null&&(!Number.isSafeInteger(cashPriceCents)||cashPriceCents<=0||cashPriceCents>1000000000))fail('Informe um preço à vista válido.');
 const key=priceKey(actor.companyId,storeId,modelCode);
 await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(cashPriceCents)).run();
 return {storeId,modelCode,cashPriceCents};
}

function unpackStore(row){return row?{...JSON.parse(row.data),id:row.id}:null;}
