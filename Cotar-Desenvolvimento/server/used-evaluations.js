import {offlineCreate} from './offline-create.js';
import {activeReservation,changeUsedReservation} from './used-reservations.js';
import {deny,inScope,unpack,permittedScreens} from './policy.js';
import {validCPF} from './auth.js';
const kinds=['licensing','ipva','lien','activeDebt','stateCertificate','dnit','prf','senatran'];
const photoSlots=new Set(['front','panel','rear','left','right']);
const documentSlots=new Set(['crlv','crv','consignment','inspection']);
const vehicleSlots=new Set([...photoSlots,'video',...documentSlots]);
const clientSlots=new Set(['ownerId','residence','signature','proxy','purchaseContract']);
const mechanicsKeys=new Set(['frontShock','rearShock','battery','horn','ignition','mechanicsOther1','gearbox','cables','steeringBox','radiator','chassis','mechanicsOther2','electricControls','injectionSensors','carburetor','oilLeak','engineCondition','mechanicsOther3']);
const servicesKeys=new Set(['serviceRevision','serviceOther1','servicePaint','serviceOther2','serviceAlignment','serviceOther3']);
const plateValue=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const mayUse=actor=>permittedScreens(actor).some(s=>['leads','sales'].includes(s));
const accepted=row=>['ACEITO','Aceito','Aprovada para captação','DISPONÍVEL PARA REVENDA'].includes(row.status);
function stockVehicle(row,all,now){
 const store=all.stores.find(s=>s.id===row.storeId),details=row.vehicleDetails||{},purchase=Number(row.commercial?.purchasePrice)||0,preparation=Number(row.preparationTotal)||0;
 return {flowVersion:2,condition:'Seminovo',name:row.model||'Motocicleta',model:row.model||'',brand:row.brand||'',family:details.family||'',plate:row.plate||'',chassis:row.chassis||'',renavam:row.renavam||'',year:row.year||'',modelYear:details.modelYear||'',color:details.color||'',mileage:details.mileage||0,fipe:Number(row.fipe)||0,purchase,preparation,debts:Number(row.debts)||0,cost:purchase+preparation,salePrice:row.status==='DISPONÍVEL PARA REVENDA'?Number(row.commercial?.salePrice)||0:0,assessmentId:row.id,storeId:row.storeId,regionId:store?.regionId||'',sellerId:row.userId,userId:row.userId,capturedAt:now,captureDate:new Date(now).toLocaleDateString('en-CA',{timeZone:'America/Bahia'}),stockStatus:row.status==='DISPONÍVEL PARA REVENDA'?'DISPONÍVEL PARA REVENDA':'EM POSSE DO PROPRIETÁRIO',status:row.status==='DISPONÍVEL PARA REVENDA'?'Disponível':'Em preparação'};
}
export function evaluationCode(row,storeName=''){
 const store=String(storeName).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3).padEnd(3,'X');
 const date=String(row.createdAt||row.date||'').slice(0,10),day=date.slice(8,10)||'00',month=date.slice(5,7)||'00';
 return `A${store}${day}${month}${plateValue(row.plate)||'SEMPLACA'}`;
}
export async function usedEvaluations(req,db,actor,all,body,id){
 if(!mayUse(actor))deny('Acesso indisponível.',403);
 const visible=all.assessments.filter(r=>r.flowVersion===2&&inScope(actor,'assessments',r,all));
 if(req.method==='GET'&&!id)return {items:visible.map(r=>({id:r.id,version:r.version,plate:r.plate,chassis:r.chassis,model:r.model,fipe:r.fipe,purchasePrice:Number(r.commercial?.purchasePrice)||0,preparationTotal:r.preparationTotal,debts:r.debts,date:r.date||String(r.createdAt||'').slice(0,10),createdAt:r.createdAt,updatedAt:r.updatedAt,status:r.status,stage:r.stage,type:r.type,storeId:r.storeId,storeName:all.stores.find(s=>s.id===r.storeId)?.name||'',userId:r.userId,sellerName:all.users.find(u=>u.id===r.userId)?.name||'',clientName:r.clientDetails?.name||'',decision:r.decision||'',code:r.code||evaluationCode(r,all.stores.find(s=>s.id===r.storeId)?.name)}))};
 const old=id?visible.find(r=>r.id===id):null;
 if(id&&!old)deny('Avaliação indisponível.',404);
 if(req.method==='GET')return {...old,code:old.code||evaluationCode(old,all.stores.find(s=>s.id===old.storeId)?.name),storeName:all.stores.find(s=>s.id===old.storeId)?.name||''};
 if(req.method!=='POST'&&req.method!=='PUT')deny('Método não permitido.',405);
 if(req.method==='PUT'&&!id||req.method==='POST'&&id)deny('Método não permitido.',405);
 if(old&&body.version!==old.version)deny('Esta avaliação foi alterada. Recarregue para continuar.',409);
 if(body.offlineMutationId!==undefined&&(id||body.finalize))deny('Envio offline disponível somente para novos rascunhos.',400);
 const offlineIdentity=!id?await offlineCreate(body,actor,visible):null;
 if(offlineIdentity?.existing)return offlineIdentity.existing;
 const plate=plateValue(body.plate);if(plate&&!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))deny('Informe uma placa válida.',400);
 const chassis=String(body.chassis||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(chassis.length>32)deny('Chassi inválido.',400);
 const renavam=String(body.renavam||'').replace(/\D/g,'');if(renavam.length>11)deny('Renavam inválido.',400);
 const storeId=old?.storeId||actor.storeId;
 if(!storeId||!all.stores.some(s=>s.id===storeId&&inScope(actor,'stores',s,all)))deny('Loja indisponível.',403);
 const raw=body.consultations||{};const consultations={};for(const key of kinds){const c=raw[key]||{},state=({'Não consultado':'NÃO CONSULTADO','Sem pendência':'REGULAR','Com pendência':'COM DEBITO','Em análise':'NÃO CONSULTADO'})[c.state]||String(c.state||'NÃO CONSULTADO');if(!['REGULAR','COM DEBITO','COM RESTRIÇÃO','NÃO CONSULTADO'].includes(state))deny('Situação da consulta inválida.',400);const amount=Number(c.amount||0);if(!Number.isFinite(amount)||amount<0||amount>1e9)deny('Valor de débito inválido.',400);consultations[key]={state,amount:Math.round(amount*100)/100,note:String(c.note||'').trim().slice(0,500),attachment:old?.consultations?.[key]?.attachment||null};}
 const checklistStates=['BOM','RESTAURAR','TROCAR','NÃO SE APLICA','NÃO NECESSÁRIO','REALIZAR','REALIZADO'];const checklist={};const rawChecklist=body.checklist||old?.checklist||{};
 for(const [key,value] of Object.entries(rawChecklist)){if(!/^[a-z][a-zA-Z0-9]{1,39}$/.test(key)||Object.keys(checklist).length>=80)continue;const state=String(value?.state||'');if(state&&!checklistStates.includes(state))deny('Estado do checklist inválido.',400);const cost=Number(value?.cost||0);if(!Number.isFinite(cost)||cost<0||cost>1e7)deny('Custo de preparação inválido.',400);checklist[key]={state,note:String(value?.note||'').trim().slice(0,300),cost:Math.round(cost*100)/100};}
 const vehicleAnswers={};for(const [key,value] of Object.entries(body.vehicleAnswers||old?.vehicleAnswers||{})){if(!/^[a-z][a-zA-Z0-9]{1,39}$/.test(key)||Object.keys(vehicleAnswers).length>=40)continue;if(!['SIM','NÃO'].includes(value))deny('Resposta dos dados do veículo inválida.',400);vehicleAnswers[key]=value;}
 const vehicleOtherDetail=vehicleAnswers.vehicleOther==='SIM'?String(body.vehicleOtherDetail??old?.vehicleOtherDetail??'').trim().slice(0,300):'';
 const subtotals={mechanics:0,aesthetics:0,services:0};for(const [key,item] of Object.entries(checklist)){const group=mechanicsKeys.has(key)?'mechanics':servicesKeys.has(key)?'services':'aesthetics';subtotals[group]+=item.cost;}for(const group of Object.keys(subtotals))subtotals[group]=Math.round(subtotals[group]*100)/100;
 const stage=['Consultas','Checklist','Veículo','Cliente','Fechamento'].includes(body.stage)?body.stage:['Checklist','Veículo','Cliente','Fechamento'].includes(old?.stage)?old.stage:'Consultas';
 const rawVehicle=body.vehicleDetails||old?.vehicleDetails||{};const vehicleDetails={};for(const key of ['manufacturingYear','modelYear']){const year=String(rawVehicle[key]||'').trim();if(year&&!/^(19|20)\d{2}$/.test(year))deny('Ano do veículo inválido.',400);vehicleDetails[key]=year;}const mileage=Number(rawVehicle.mileage||0);if(!Number.isSafeInteger(mileage)||mileage<0||mileage>2000000)deny('Quilometragem inválida.',400);vehicleDetails.mileage=mileage;for(const [key,max] of [['category',50],['family',80],['color',60],['fuel',50],['trim',100],['engineNumber',32],['notes',2000]])vehicleDetails[key]=String(rawVehicle[key]||'').trim().slice(0,max);
 const rawCommercial=body.commercial||old?.commercial||{};const commercial={negotiationType:String(rawCommercial.negotiationType||'').slice(0,40)};if(commercial.negotiationType&&!['COMPRA','CONSIGNAÇÃO','TROCA'].includes(commercial.negotiationType))deny('Tipo de negociação inválido.',400);for(const key of ['purchasePrice','transfer','payoffDebt']){const value=Number(rawCommercial[key]||0);if(!Number.isFinite(value)||value<0||value>1e9)deny('Valor comercial inválido.',400);commercial[key]=Math.round(value*100)/100;}
 const rawClient=body.clientDetails||old?.clientDetails||{};const clientDetails={isOwner:rawClient.isOwner===true};for(const [key,max] of [['cpf',14],['name',160],['rg',30],['birthDate',10],['phone',30],['email',180],['cep',9],['street',180],['number',20],['district',100],['city',100],['state',2],['bank',100],['agency',30],['account',40],['pix',160]])clientDetails[key]=String(rawClient[key]||'').trim().slice(0,max);clientDetails.cpf=clientDetails.cpf.replace(/\D/g,'');clientDetails.cep=clientDetails.cep.replace(/\D/g,'');clientDetails.state=clientDetails.state.toUpperCase();clientDetails.email=clientDetails.email.toLowerCase();if(clientDetails.cpf&&!validCPF(clientDetails.cpf))deny('Informe um CPF válido.',400);if(clientDetails.cep&&clientDetails.cep.length!==8)deny('Informe um CEP válido.',400);if(clientDetails.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientDetails.email))deny('E-mail inválido.',400);if(clientDetails.birthDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(clientDetails.birthDate)||Number.isNaN(Date.parse(clientDetails.birthDate))))deny('Data de nascimento inválida.',400);
 const rawOwner=clientDetails.isOwner?{}:body.ownerDetails||old?.ownerDetails||{},ownerDetails={};for(const [key,max] of [['cpf',14],['name',160],['rg',30],['phone',30],['cep',9],['street',180],['number',20],['district',100],['city',100],['state',2]])ownerDetails[key]=String(rawOwner[key]||'').trim().slice(0,max);ownerDetails.cpf=ownerDetails.cpf.replace(/\D/g,'');ownerDetails.cep=ownerDetails.cep.replace(/\D/g,'');ownerDetails.state=ownerDetails.state.toUpperCase();if(ownerDetails.cpf&&!validCPF(ownerDetails.cpf))deny('Informe um CPF válido para o proprietário.',400);if(ownerDetails.cep&&ownerDetails.cep.length!==8)deny('Informe um CEP válido para o proprietário.',400);
 if(body.finalize){if(stage!=='Fechamento')deny('Revise a etapa Fechamento.',400);for(const key of ['cpf','name','rg','birthDate','phone','email','cep','street','number','district','city','state'])if(!clientDetails[key])deny('Preencha os dados pessoais e o endereço antes de finalizar.',400);if(!clientDetails.isOwner)for(const key of ['cpf','name','rg','phone'])if(!ownerDetails[key])deny('Cadastre CPF, nome, RG e telefone do proprietário antes de finalizar.',400);}
 const now=new Date().toISOString(),safe={flowVersion:2,type:'Completa',stage,status:body.finalize?'Aguardando decisão':old?.status||'Em andamento',completedAt:body.finalize?now:old?.completedAt||'',decision:old?.decision||'',decisionAt:old?.decisionAt||'',decisionBy:old?.decisionBy||'',plate,chassis,renavam,model:String(body.model||'').trim().slice(0,150),brand:String(body.brand||'').trim().slice(0,80),year:String(body.year||'').slice(0,9),fipeCode:String(body.fipeCode||'').slice(0,20),fipeReference:String(body.fipeReference||'').slice(0,60),fipe:Number(body.fipe)||0,candidates:Array.isArray(body.candidates)?body.candidates.slice(0,20):[],consultations,checklist,vehicleAnswers,vehicleOtherDetail,vehicleDetails,commercial,vehicleFiles:old?.vehicleFiles||{},photoMarks:old?.photoMarks||{},clientDetails,ownerDetails,clientFiles:old?.clientFiles||{},checklistNotes:String(body.checklistNotes??old?.checklistNotes??'').trim().slice(0,3000),condition:String(body.condition??old?.condition??'').slice(0,80),preparationTotal:Object.values(subtotals).reduce((s,c)=>s+c,0),checklistTotals:subtotals,debts:Object.values(consultations).reduce((s,c)=>s+c.amount,0),storeId,userId:old?.userId||actor.id,date:old?.date||new Date().toLocaleDateString('en-CA',{timeZone:'America/Bahia'})};
 safe.code=old?.code||body.finalize&&evaluationCode({createdAt:old?.createdAt||now,plate},all.stores.find(s=>s.id===storeId)?.name)||'';
 if(offlineIdentity||old?.offlineMutationHash)safe.offlineMutationHash=offlineIdentity?.hash||old.offlineMutationHash;
 const evaluationId=old?.id||offlineIdentity?.id||crypto.randomUUID();
 if(old){const result=await db.prepare('UPDATE assessments SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify(safe),now,evaluationId,old.version,actor.companyId).run();if(!result.meta.changes)deny('Esta avaliação foi alterada. Recarregue.',409)}
 else await db.prepare('INSERT INTO assessments (id,data,company_id,created_by,created_at,updated_at,store_id,user_id,vehicle_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(evaluationId,JSON.stringify(safe),actor.companyId,actor.id,now,now,storeId,actor.id,null).run();
 if(db.saveUsedStage){if(stage==='Checklist')await db.saveUsedStage(evaluationId,actor.companyId,'checklist',{vehicleAnswers,vehicleOtherDetail,checklist,checklistNotes:safe.checklistNotes,condition:safe.condition},subtotals,safe.preparationTotal);if(['Veículo','Cliente','Fechamento'].includes(stage)){await db.saveUsedStage(evaluationId,actor.companyId,'vehicle',{vehicleDetails,commercial,vehicleFiles:safe.vehicleFiles},{mechanics:0,aesthetics:0,services:0},0);if(['Cliente','Fechamento'].includes(stage))await db.saveUsedStage(evaluationId,actor.companyId,'client',{clientDetails,ownerDetails,clientFiles:safe.clientFiles},{mechanics:0,aesthetics:0,services:0},0);}}
 return {...safe,id:evaluationId,version:old?old.version+1:1,companyId:actor.companyId,createdBy:old?.createdBy||actor.id,createdAt:old?.createdAt||now,updatedAt:now};
}
export async function usedEvidence(req,env,db,actor,all,id,slot,body){
 if(!mayUse(actor))deny('Acesso indisponível.',403);
 const row=all.assessments.find(r=>r.id===id&&r.flowVersion===2&&inScope(actor,'assessments',r,all));
 if(!row||!kinds.includes(slot)&&!vehicleSlots.has(slot)&&!clientSlots.has(slot))deny('Documento indisponível.',404);
 const vehicleSlot=vehicleSlots.has(slot),clientSlot=clientSlots.has(slot),saved=vehicleSlot?row.vehicleFiles?.[slot]:clientSlot?row.clientFiles?.[slot]:row.consultations?.[slot]?.attachment;
 if(req.method==='GET'){
  if(!saved||!env.PHOTOS)deny('Documento indisponível.',404);
  const file=await env.PHOTOS.get(`used/${actor.companyId}/${id}/${slot}/${saved.id}`);if(!file)deny('Documento indisponível.',404);
  return new Response(file.body,{headers:{'Content-Type':saved.type,'Content-Disposition':`${new URL(req.url).searchParams.has('preview')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(saved.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(req.method!=='POST')deny('Método não permitido.',405);
 if(!env.PHOTOS)deny('Armazenamento de anexos indisponível.',503);
 const name=String(body.name||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,180),match=String(body.data||'').match(/^data:(application\/pdf|image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm);base64,([A-Za-z0-9+/]+={0,2})$/);
 const limit=slot==='video'?10*1024*1024:2*1024*1024;if(!name||!match||body.data.length>Math.ceil(limit*4/3)+100)deny(slot==='video'?'Use MP4 ou WebM com até 10 MB.':'Use PDF, JPG, PNG ou WebP com até 2 MB.',400);
 let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0))}catch{deny('Arquivo inválido.',400)}
 if(!bytes.length||bytes.length>limit)deny(`O anexo deve ter até ${slot==='video'?10:2} MB.`,400);
 const head=String.fromCharCode(...bytes.slice(0,12)),type=match[1];if(clientSlot&& !['application/pdf','image/jpeg','image/png','image/webp'].includes(type))deny('Tipo de documento inválido.',400);if(vehicleSlot){if(slot==='video'?!['video/mp4','video/webm'].includes(type):documentSlots.has(slot)?!['application/pdf','image/jpeg','image/png','image/webp'].includes(type):!['image/jpeg','image/png','image/webp'].includes(type))deny('Tipo de arquivo inválido para este campo.',400)}else if(type.startsWith('video/'))deny('Tipo de arquivo inválido para esta consulta.',400);
 if(!(type==='application/pdf'?head.startsWith('%PDF-'):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes[0]===137&&head.slice(1,8)==='PNG\r\n\x1a\n':type==='image/webp'?head.startsWith('RIFF')&&head.slice(8)==='WEBP':type==='video/mp4'?head.slice(4,8)==='ftyp':bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3))deny('Formato do arquivo inválido.',400);
 const attachment={id:crypto.randomUUID(),name,type,size:bytes.length};
 await env.PHOTOS.put(`used/${actor.companyId}/${id}/${slot}/${attachment.id}`,bytes,{httpMetadata:{contentType:type}});
 const updated=vehicleSlot?{...row,vehicleFiles:{...row.vehicleFiles,[slot]:attachment}}:clientSlot?{...row,clientFiles:{...row.clientFiles,[slot]:attachment}}:{...row,consultations:{...row.consultations,[slot]:{...row.consultations?.[slot],attachment}}};
 for(const key of ['id','version','companyId','createdAt','updatedAt','createdBy'])delete updated[key];
 const result=await db.prepare('UPDATE assessments SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify(updated),new Date().toISOString(),id,row.version,actor.companyId).run();
 if(!result.meta.changes)deny('A avaliação mudou. Atualize e tente novamente.',409);
 if(clientSlot&&db.saveUsedStage)await db.saveUsedStage(id,actor.companyId,'client',{clientDetails:row.clientDetails||{},clientFiles:updated.clientFiles},{mechanics:0,aesthetics:0,services:0},0);
 if(vehicleSlot&&db.saveUsedStage)await db.saveUsedStage(id,actor.companyId,'vehicle',{vehicleDetails:row.vehicleDetails||{},commercial:row.commercial||{},vehicleFiles:updated.vehicleFiles},{mechanics:0,aesthetics:0,services:0},0);
 return attachment;
}

export async function usedDecision(db,actor,all,id,body){
 if(actor.role==='Vendedor'||!mayUse(actor))deny('A decisão de captação exige acesso de gestão.',403);
 const row=all.assessments.find(r=>r.id===id&&r.flowVersion===2&&inScope(actor,'assessments',r,all));
 if(!row)deny('Avaliação indisponível.',404);
 if(row.status==='Em andamento'||!row.completedAt)deny('Finalize a avaliação antes da decisão.',400);
 if(body.version!==row.version)deny('A avaliação mudou. Recarregue para decidir.',409);
 const choice=({'Captar':'ACEITO','Não captar':'PERDIDO'})[body.decision]||body.decision;
 if(!['ACEITO','NEGOCIAÇÃO','PERDIDO'].includes(choice))deny('Status de captação inválido.',400);
 const {id:_,version:__,companyId:___,createdAt:____,updatedAt:_____,createdBy:______,...data}=row;
 const now=new Date().toISOString(),existing=all.vehicles?.find(v=>v.assessmentId===id||v.id===`used-${id}`),captured=choice==='ACEITO',vehicleId=captured?(row.vehicleId||existing?.id||`used-${id}`):row.vehicleId||'';
 const updated={...data,decision:choice,decisionAt:now,decisionBy:actor.id,status:choice,vehicleId};
 const update=db.prepare('UPDATE assessments SET data=?,vehicle_id=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify(updated),vehicleId||null,now,id,row.version,actor.companyId);
 const guard=()=>db.prepare("INSERT INTO settings (key,value) SELECT 'bootstrap','stale' WHERE changes()=0");
 if(captured&&!existing){
  const vehicle=stockVehicle({...row,...updated},all,now);
  await db.batch([db.prepare('INSERT INTO vehicles (id,data,company_id,created_by,created_at,updated_at,store_id,plate) VALUES (?,?,?,?,?,?,?,?)').bind(vehicleId,JSON.stringify(vehicle),actor.companyId,row.userId||actor.id,now,now,row.storeId,vehicle.plate),update,guard()]);
 }else{const result=await update.run();if(!result.meta.changes)deny('A avaliação mudou. Recarregue para decidir.',409)}
 return {...updated,id,version:row.version+1,updatedAt:now};
}

export async function syncUsedStock(db,actor,all){
 if(actor.role==='Vendedor'||!mayUse(actor))deny('A sincronização do estoque exige acesso de gestão.',403);
 let created=0;
 for(const row of all.assessments.filter(a=>a.flowVersion===2&&accepted(a)&&a.completedAt&&inScope(actor,'assessments',a,all))){
  if(all.vehicles.some(v=>v.assessmentId===row.id||v.id===`used-${row.id}`))continue;
  const id=`used-${row.id}`,now=row.decisionAt||row.completedAt,vehicle=stockVehicle(row,all,now);
  const {id:_,version:__,companyId:___,createdAt:____,updatedAt:_____,createdBy:______,...data}=row;
  const update=db.prepare('UPDATE assessments SET data=?,vehicle_id=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify({...data,vehicleId:id}),id,new Date().toISOString(),row.id,row.version,actor.companyId);
  await db.batch([db.prepare('INSERT INTO vehicles (id,data,company_id,created_by,created_at,updated_at,store_id,plate) VALUES (?,?,?,?,?,?,?,?)').bind(id,JSON.stringify(vehicle),actor.companyId,row.userId||actor.id,now,now,row.storeId,vehicle.plate),update,db.prepare("INSERT INTO settings (key,value) SELECT 'bootstrap','stale' WHERE changes()=0")]);
  created++;
 }
 return {created};
}

export async function usedStock(req,db,actor,all,id,body){
 if(!mayUse(actor))deny('Acesso indisponível.',403);
 const stock=all.vehicles.map(v=>({...v,reservation:activeReservation(v)})).filter(v=>v.flowVersion===2&&v.assessmentId&&all.assessments.some(a=>a.id===v.assessmentId&&accepted(a)&&inScope(actor,'assessments',a,all)));
 if(req.method==='GET'&&!id)return {items:stock.map(v=>({...v,family:v.family||all.assessments.find(a=>a.id===v.assessmentId)?.vehicleDetails?.family||'',modelYear:v.modelYear||all.assessments.find(a=>a.id===v.assessmentId)?.vehicleDetails?.modelYear||'',storeName:all.stores.find(s=>s.id===v.storeId)?.name||'',regionName:all.regions.find(r=>r.id===v.regionId)?.name||'',sellerName:all.users.find(u=>u.id===v.sellerId)?.name||'',reservationName:all.users.find(u=>u.id===v.reservation?.userId)?.name||'',reservationStoreName:all.stores.find(s=>s.id===v.reservation?.storeId)?.name||''})),stores:all.stores.filter(s=>inScope(actor,'stores',s,all)).map(s=>({id:s.id,name:s.name})),missingAccepted:actor.role==='Vendedor'?0:all.assessments.filter(a=>a.flowVersion===2&&accepted(a)&&a.completedAt&&inScope(actor,'assessments',a,all)&&!all.vehicles.some(v=>v.assessmentId===a.id||v.id===`used-${a.id}`)).length};
 const old=stock.find(v=>v.id===id);if(!old)deny('Veículo indisponível.',404);
 if(req.method!=='PUT')deny('Método não permitido.',405);
 if(body.version!==old.version)deny('O veículo mudou. Atualize a lista.',409);
 if(['reserve','cancel-reservation'].includes(body.action))return changeUsedReservation(db,actor,old,body,all.sales||[]);
 const statuses=['DISPONÍVEL PARA REVENDA','EM MANUTENÇÃO','PENDÊNCIAS DE DOCUMENTAÇÃO','EM POSSE DO PROPRIETÁRIO'];
 const {id:_,version:__,companyId:___,createdAt:____,updatedAt:_____,createdBy:______,...data}=old;
 const now=new Date().toISOString(),updated={...data};
 if(body.action==='edit'){
  if(actor.role==='Vendedor')deny('A edição do estoque exige acesso de gestão.',403);
  for(const [key,max] of [['model',150],['brand',80],['family',80],['color',60],['renavam',20]])if(key in body)updated[key]=String(body[key]||'').trim().toUpperCase().slice(0,max);
  if('plate' in body){const plate=plateValue(body.plate);if(plate&&!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))deny('Placa inválida.',400);updated.plate=plate;}
  if('chassis' in body)updated.chassis=String(body.chassis||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,17);
  for(const key of ['year','modelYear'])if(key in body){const year=String(body[key]||'').trim();if(year&&!/^(19|20)\d{2}$/.test(year))deny('Ano inválido.',400);updated[key]=year;}
  for(const key of ['mileage','fipe','purchase','preparation','salePrice'])if(key in body){const value=Number(body[key]);if(!Number.isFinite(value)||value<0||value>1e9||(key==='mileage'&&!Number.isSafeInteger(value)))deny('Valor do estoque inválido.',400);updated[key]=Math.round(value*100)/100;}
  updated.name=updated.model||'Motocicleta';updated.cost=Number(updated.purchase||0)+Number(updated.preparation||0);
 }else if(!body.action){
  if(actor.role==='Vendedor')deny('A gestão do estoque exige acesso de gestão.',403);
  if(!statuses.includes(body.stockStatus))deny('Situação do veículo inválida.',400);
  if(body.stockStatus==='DISPONÍVEL PARA REVENDA'){
   const price=Number(body.salePrice??old.salePrice);if(!Number.isFinite(price)||price<0.01||price>1e9)deny('Informe o preço de venda para publicar o veículo no catálogo.',400);
   if(old.status==='Vendido'||all.sales?.some(s=>s.vehicleId===id&&s.status==='Concluída'))deny('Este veículo já foi vendido.',409);
   updated.salePrice=Math.round(price*100)/100;
  }
  updated.stockStatus=body.stockStatus;updated.status=body.stockStatus==='DISPONÍVEL PARA REVENDA'?'Disponível':'Em preparação';
 }else deny('Ação de estoque inválida.',400);
 const result=await db.prepare('UPDATE vehicles SET data=?,plate=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify(updated),updated.plate||null,now,id,old.version,actor.companyId).run();
 if(!result.meta.changes)deny('O veículo mudou. Atualize a lista.',409);
 return {...updated,id,version:old.version+1,updatedAt:now};
}

export async function usedPhotoMarks(db,actor,all,id,body){
 if(!mayUse(actor))deny('Acesso indisponível.',403);
 const row=all.assessments.find(r=>r.id===id&&r.flowVersion===2&&inScope(actor,'assessments',r,all));
 if(!row)deny('Avaliação indisponível.',404);
 if(body.version!==row.version)deny('A avaliação mudou. Recarregue antes de marcar.',409);
 const slot=String(body.slot||'');
 if(!photoSlots.has(slot)||!row.vehicleFiles?.[slot]?.type?.startsWith('image/'))deny('Foto indisponível.',404);
 if(!Array.isArray(body.marks)||body.marks.length>30)deny('Limite de 30 marcações por foto.',400);
 const marks=body.marks.map(mark=>{
  const x=Number(mark.x),y=Number(mark.y),note=String(mark.note||'').trim().slice(0,200);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100||!note)deny('Marcação inválida.',400);
  return {x:Math.round(x*10)/10,y:Math.round(y*10)/10,note};
 });
 const {id:_,version:__,companyId:___,createdAt:____,updatedAt:_____,createdBy:______,...data}=row;
 const photoMarks={...row.photoMarks,[slot]:marks},now=new Date().toISOString();
 const result=await db.prepare('UPDATE assessments SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=?').bind(JSON.stringify({...data,photoMarks}),now,id,row.version,actor.companyId).run();
 if(!result.meta.changes)deny('A avaliação mudou. Recarregue antes de marcar.',409);
 return {version:row.version+1,photoMarks};
}

export async function usedDelete(db,env,actor,all,id,body){
 if(!mayUse(actor))deny('Acesso indisponível.',403);
 const row=all.assessments.find(r=>r.id===id&&r.flowVersion===2&&inScope(actor,'assessments',r,all));
 if(!row)deny('Avaliação indisponível.',404);
 if(row.completedAt||row.status!=='Em andamento')deny('Somente avaliações não concluídas podem ser excluídas.',409);
 if(body.version!==row.version)deny('A avaliação mudou. Recarregue antes de excluir.',409);
 const result=await db.prepare('DELETE FROM assessments WHERE id=? AND version=? AND company_id=?').bind(id,row.version,actor.companyId).run();
 if(!result.meta.changes)deny('A avaliação mudou. Recarregue antes de excluir.',409);
 const keys=[...Object.entries(row.vehicleFiles||{}),...Object.entries(row.clientFiles||{}),...Object.entries(row.consultations||{}).map(([slot,value])=>[slot,value?.attachment])].filter(([,file])=>file?.id).map(([slot,file])=>`used/${actor.companyId}/${id}/${slot}/${file.id}`);
 if(env.PHOTOS?.delete)await Promise.allSettled(keys.map(key=>env.PHOTOS.delete(key)));
 return {deleted:true,id};
}
