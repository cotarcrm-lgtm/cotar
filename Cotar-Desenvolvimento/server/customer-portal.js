import {deny,unpack,inScope,companyData,permittedScreens,canSubmitSale} from './policy.js';
import {digest,hashPassword,verifyPassword,limit} from './auth.js';
import {centralScreenAllowed} from '../public/access-policy.js';
import {savePhotos} from './acquisitions.js';
import {subscriptionAccess} from './subscriptions.js';
import {saleCode} from '../public/sale-print.js';

export const deliveryStages=['Pedido recebido','Aguardando faturamento','Moto faturada','Pronta para entrega','Entregue'];
const cookieName='__Host-cotar_customer',now=()=>new Date().toISOString();
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
const clean=(value,max=200)=>String(value||'').trim().slice(0,max);
const email=value=>clean(value,254).toLowerCase();
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value||'');
const keyForStore=id=>'customer:store:'+id;
const orderKey=(company,id)=>`customer:order:${company}:${id}`;
const stateKey=(company,id)=>`customer:progress:${company}:${id}`;
const json=(data,status=200,cookie)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(value,clear=false)=>`${cookieName}=${clear?'':value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${clear?0:28800}`;
async function read(db,key){const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();return row?{raw:row.value,data:JSON.parse(row.value),key}:null;}
const create=(db,key,data)=>db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind(key,JSON.stringify(data));
const change=(db,record,data)=>db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(data),record.key,record.raw);
const guard=db=>db.prepare("INSERT INTO settings (key,value) SELECT 'bootstrap','stale' WHERE changes()=0");
async function write(db,key,data,old){if(old){const result=await change(db,old,data).run();if(!result.meta.changes)deny('Os dados mudaram. Atualize antes de continuar.',409)}else await create(db,key,data).run();}
async function list(db,prefix){return (await db.prepare('SELECT key,value FROM settings WHERE key LIKE ?').bind(prefix+'%').all()).results.map(row=>({key:row.key,raw:row.value,data:JSON.parse(row.value)}));}
async function storeFor(db,id){if(!uuid(id))deny('Concessionária indisponível.',404);const row=await db.prepare('SELECT * FROM stores WHERE id=?').bind(id).first();const config=await read(db,keyForStore(id));if(!row||!config?.data.enabled||unpack(row).status!=='Ativa'||config.data.companyId!==row.company_id)deny('Concessionária indisponível.',404);const company=await db.prepare('SELECT * FROM companies WHERE id=?').bind(row.company_id).first();if(!company||unpack(company).status!=='Ativa')deny('Concessionária indisponível.',404);try{await subscriptionAccess(db,row.company_id)}catch(error){if(error.status)deny('Atendimento temporariamente indisponível. Fale com a concessionária.',503);throw error}return {store:unpack(row),config:config.data};}
const branding=({store,config})=>({id:store.id,name:config.displayName,phone:config.whatsapp,city:store.city||'',state:store.state||'',address:store.address||'',canEvaluate:config.canEvaluate===true});
async function accountKey(storeId,value){return `customer:account:${storeId}:${await digest(email(value))}`;}
async function getSession(db,req,storeId){const raw=(req.headers.get('Cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!/^[a-f0-9]{64}$/.test(raw||''))return null;const receipt=await read(db,'customer:session:'+await digest(raw));if(!receipt||receipt.data.storeId!==storeId||receipt.data.expiresAt<Date.now())return null;const account=await read(db,receipt.data.accountKey);if(!account?.data.active||account.data.storeId!==storeId||receipt.data.authVersion!==account.data.authVersion)return null;return {account,receipt};}
async function newSessionRecord(db,accountKey,account){const raw=token(),key='customer:session:'+await digest(raw);return {raw,statement:create(db,key,{accountKey,storeId:account.storeId,expiresAt:Date.now()+28800000,authVersion:account.authVersion})};}
function requestTime(value){const time=Date.parse(value);if(!Number.isFinite(time)||time<Date.now()+15*60000||time>Date.now()+366*86400000)deny('Escolha um horário futuro, com pelo menos 15 minutos de antecedência.',400);return new Date(time).toISOString();}
async function ownOrder(db,account,saleId){const link=await read(db,orderKey(account.data.companyId,saleId));if(!link||link.data.accountKey!==account.key||link.data.revoked||link.data.storeId!==account.data.storeId)deny('Compra indisponível.',404);const sale=await db.prepare('SELECT * FROM sales WHERE id=? AND company_id=?').bind(saleId,account.data.companyId).first();if(!sale||sale.store_id!==account.data.storeId)deny('Compra indisponível.',404);return unpack(sale);}
async function customerOrders(db,account){const links=await list(db,`customer:order:${account.data.companyId}:`),orders=[];for(const link of links){if(link.data.accountKey!==account.key||link.data.revoked||link.data.storeId!==account.data.storeId)continue;try{const sale=await ownOrder(db,account,link.data.saleId),progress=await read(db,stateKey(account.data.companyId,sale.id));orders.push({id:sale.id,code:saleCode(sale),model:sale.model||'',category:sale.category||'',color:sale.color||'',year:sale.modelYear||'',date:sale.date||'',cancelled:sale.status==='Cancelada',stage:progress?.data.stage||deliveryStages[0],note:progress?.data.publicNote||'',history:progress?.data.history||[],invoiceNumber:progress?.data.invoiceNumber||''})}catch(error){if(error.status!==404)throw error;}}
 return orders;
}
const ownRequests=async(db,account,type)=>(await list(db,`customer:${type}:${account.data.storeId}:`)).filter(row=>row.data.accountKey===account.key);

export async function customerRequest(db,env,req,storeId,tail,body={}){
 const place=await storeFor(db,storeId);
 if(tail==='/info'&&req.method==='GET')return json({store:branding(place)});
 if(tail==='/auth/login'&&req.method==='POST'){
  const key=await accountKey(storeId,body.email);await limit(db,req,key,'customer-login');const account=await read(db,key);
  const valid=await verifyPassword(body.password,account?.data.passwordHash);
  if(!valid||!account?.data.active)deny('E-mail ou senha inválidos.',401);
  const session=await newSessionRecord(db,key,account.data);await session.statement.run();return json({ok:true},200,cookie(session.raw));
 }
 if(tail==='/auth/activate'&&req.method==='POST'){
  await limit(db,req,await digest(clean(body.token,100)),'customer-activation');
  if(!/^[a-f0-9]{64}$/.test(body.token||''))deny('Convite indisponível ou expirado.',400);
  const invitation=await read(db,'customer:invite:'+await digest(body.token));
  if(!invitation||invitation.data.storeId!==storeId||invitation.data.used||invitation.data.expiresAt<Date.now()||email(body.email)!==invitation.data.email)deny('Convite indisponível ou expirado.',400);
  const sale=await db.prepare('SELECT * FROM sales WHERE id=? AND company_id=?').bind(invitation.data.saleId,place.store.companyId).first();
  if(!sale||sale.store_id!==storeId||unpack(sale).status==='Cancelada')deny('Convite indisponível.',400);
  const key=await accountKey(storeId,body.email),oldAccount=await read(db,key),link=await read(db,orderKey(place.store.companyId,sale.id));
  if(!link||link.data.inviteHash!==await digest(body.token)||link.data.revoked)deny('Este convite foi substituído. Peça um novo à concessionária.',400);
  if(oldAccount&&!await verifyPassword(body.password,oldAccount.data.passwordHash))deny('Já existe um acesso com este e-mail. Use sua senha atual para vincular esta compra.',401);
  if(oldAccount&&!oldAccount.data.active)deny('Acesso indisponível. Fale com a concessionária.',403);
  const profile=oldAccount?.data||{id:crypto.randomUUID(),storeId,companyId:place.store.companyId,email:invitation.data.email,name:invitation.data.name,passwordHash:await hashPassword(body.password),active:true,authVersion:1,createdAt:now()};
  const session=await newSessionRecord(db,key,profile);
  const commands=[];if(!oldAccount)commands.push(create(db,key,profile));
  commands.push(change(db,invitation,{...invitation.data,used:true,usedAt:now()}),guard(db),change(db,link,{...link.data,accountKey:key,activatedAt:now(),version:link.data.version+1}),guard(db),session.statement);
  await db.batch(commands);return json({ok:true},201,cookie(session.raw));
 }
 const auth=await getSession(db,req,storeId);if(!auth)deny('Entre com o acesso de cliente desta concessionária.',401);
 const {account,receipt}=auth;
 if(account.data.companyId!==place.store.companyId)deny('Acesso indisponível.',401);
 if(tail==='/auth/logout'&&req.method==='POST'){await db.prepare('DELETE FROM settings WHERE key=?').bind(receipt.key).run();return json({ok:true},200,cookie('',true))}
 if(tail==='/dashboard'&&req.method==='GET'){
  const [orders,services,valuations]=await Promise.all([customerOrders(db,account),ownRequests(db,account,'service'),ownRequests(db,account,'valuation')]);
  return json({store:branding(place),customer:{name:account.data.name,email:account.data.email},stages:deliveryStages,orders,services:services.map(row=>({...row.data,accountKey:undefined,submissionHash:undefined})),valuations:valuations.map(row=>({...row.data,accountKey:undefined,submissionHash:undefined,photos:row.data.photos.map(photo=>({id:photo.id,url:`/api/customer/${storeId}/valuations/${row.data.id}/photos/${photo.id}`}))}))});
 }
 if(tail==='/services'&&req.method==='POST'){
  await limit(db,req,account.key,'customer-service');if(!uuid(body.submissionId))deny('Solicitação inválida.',400);
  const key=`customer:service:${storeId}:${body.submissionId}`,old=await read(db,key);
  if(old){if(old.data.accountKey!==account.key)deny('Solicitação indisponível.',404);if(old.data.submissionHash!==await digest(JSON.stringify(body)))deny('Este envio já foi recebido com outros dados. Atualize a tela antes de continuar.',409);return json({id:old.data.id,status:old.data.status},200)}
  const sale=await ownOrder(db,account,body.saleId);if(sale.status==='Cancelada')deny('Compra cancelada. Fale com a concessionária.',400);
  const mileage=Number(body.mileage);if(!Number.isSafeInteger(mileage)||mileage<0||mileage>2000000)deny('Informe a quilometragem válida.',400);
  const data={id:body.submissionId,submissionHash:await digest(JSON.stringify(body)),accountKey:account.key,storeId,companyId:account.data.companyId,saleId:sale.id,model:sale.model,customerName:account.data.name,customerEmail:account.data.email,phone:clean(body.phone,30),preferredAt:requestTime(body.preferredAt),mileage,notes:clean(body.notes,1000),status:'Solicitada',confirmedAt:'',response:'',version:1,createdAt:now()};
  if(data.phone.replace(/\D/g,'').length<10)deny('Informe um telefone com DDD.',400);
  await create(db,key,data).run();return json({id:data.id,status:data.status},201);
 }
 const cancel=tail.match(/^\/services\/([a-f0-9-]+)\/cancel$/);
 if(cancel&&req.method==='POST'){
  const old=await read(db,`customer:service:${storeId}:${cancel[1]}`);if(!old||old.data.accountKey!==account.key)deny('Solicitação indisponível.',404);
  if(old.data.version!==body.version)deny('O agendamento mudou. Atualize antes de cancelar.',409);
  if(!['Solicitada','Confirmada'].includes(old.data.status))deny('Este agendamento não pode ser cancelado.',409);
  const commands=[change(db,old,{...old.data,status:'Cancelada pelo cliente',version:old.data.version+1,updatedAt:now()}),guard(db)];
  if(old.data.confirmedAt)commands.push(db.prepare('DELETE FROM settings WHERE key=?').bind(`customer:slot:${storeId}:${old.data.confirmedAt}`));
  await db.batch(commands);return json({ok:true});
 }
 if(tail==='/valuations'&&req.method==='POST'){
  if(!place.config.canEvaluate)deny('Avaliações não estão disponíveis nesta concessionária.',403);
  await limit(db,req,account.key,'customer-valuation');if(!uuid(body.submissionId)||body.consent!==true)deny('Confirme a autorização e revise a solicitação.',400);
  const key=`customer:valuation:${storeId}:${body.submissionId}`,old=await read(db,key);
  if(old){if(old.data.accountKey!==account.key)deny('Avaliação indisponível.',404);if(old.data.submissionHash!==await digest(JSON.stringify(body)))deny('Esta avaliação já foi recebida com outros dados. Atualize a tela antes de continuar.',409);return json({id:old.data.id,status:old.data.status},200)}
  const plate=clean(body.plate,7).toUpperCase(),model=clean(body.model,150),year=clean(body.year,9),mileage=Number(body.mileage),expectedValue=Number(body.expectedValue||0);
  if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)||!model||!/^\d{4}(\/\d{4})?$/.test(year)||!Number.isSafeInteger(mileage)||mileage<0||mileage>2000000||!Number.isFinite(expectedValue)||expectedValue<0||expectedValue>1e9)deny('Revise placa, modelo, ano, quilometragem e valor desejado.',400);
  if(!Array.isArray(body.photos)||!body.photos.length||body.photos.length>6)deny('Envie de 1 a 6 fotos da moto.',400);
  const photos=await savePhotos(env,account.data.companyId,body.submissionId,body.photos);
  const data={id:body.submissionId,submissionHash:await digest(JSON.stringify(body)),accountKey:account.key,storeId,companyId:account.data.companyId,customerName:account.data.name,customerEmail:account.data.email,plate,model,year,mileage,expectedValue,notes:clean(body.notes,2000),photos,status:'Recebida',estimatedValue:null,response:'',version:1,consentAt:now(),createdAt:now()};
  await create(db,key,data).run();return json({id:data.id,status:data.status},201);
 }
 const photo=tail.match(/^\/valuations\/([a-f0-9-]+)\/photos\/([a-f0-9-]+)$/);
 if(photo&&req.method==='GET'){
  const row=await read(db,`customer:valuation:${storeId}:${photo[1]}`);
  if(!row||row.data.accountKey!==account.key||!row.data.photos.some(p=>p.id===photo[2]))deny('Foto indisponível.',404);
  return customerPhoto(env,account.data.companyId,photo[1],photo[2]);
 }
 deny('Operação indisponível.',404);
}
async function customerPhoto(env,company,id,photo){const object=await env.PHOTOS?.get(`assessments/${company}/${id}/${photo}.jpg`);if(!object)deny('Foto indisponível.',404);return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
function staffAllowed(actor){if(!(permittedScreens(actor).includes('sales')||canSubmitSale(actor))||!(centralScreenAllowed(actor,'sales')||centralScreenAllowed(actor,'leads')))deny('A área de clientes não está liberada para este acesso.');}
async function staffContext(db,actor,storeId){staffAllowed(actor);const all=await companyData(db,actor,['sales','stores','regions','users','leads']);const store=all.stores.find(row=>row.id===storeId);if(!store||!inScope(actor,'stores',store,all))deny('Loja indisponível.',404);const local={...actor,companyId:store.companyId};return {all,store,actor:local};}
function isManager(actor){return ['Administrador','Diretor','Gerente Regional','Gerente de Loja','Administrativo'].includes(actor.role)}
async function staffSale(db,context,id){const sale=context.all.sales.find(row=>row.id===id&&row.storeId===context.store.id);if(!sale||!inScope(context.actor,'sales',sale,context.all))deny('Venda indisponível.',404);return sale;}
export async function customerAdminRequest(db,env,req,actor,storeId,tail,body={}){
 const context=await staffContext(db,actor,storeId),{store,all}=context;actor=context.actor;
 if(tail===''&&req.method==='GET'){
  const config=await read(db,keyForStore(storeId));
  const orders=[];for(const sale of all.sales.filter(row=>row.storeId===storeId&&inScope(actor,'sales',row,all))){const link=await read(db,orderKey(store.companyId,sale.id)),progress=await read(db,stateKey(store.companyId,sale.id));orders.push({id:sale.id,code:saleCode(sale),model:sale.model,customerName:sale.customerName||all.leads.find(l=>l.id===sale.leadId)?.name||'',status:sale.status,linked:!!link?.data.accountKey&&!link.data.revoked,email:link?.data.email||'',linkVersion:link?.data.version||0,stage:progress?.data.stage||deliveryStages[0],publicNote:progress?.data.publicNote||'',invoiceNumber:progress?.data.invoiceNumber||'',progressVersion:progress?.data.version||0})}
  const services=await list(db,`customer:service:${storeId}:`),valuations=await list(db,`customer:valuation:${storeId}:`);
  return json({store:{id:store.id,name:store.name},config:config?.data||{enabled:false,displayName:'Winner',whatsapp:'',canEvaluate:true,version:0},canConfigure:isManager(actor),stages:deliveryStages,orders,services:isManager(actor)?services.map(row=>({...row.data,accountKey:undefined,submissionHash:undefined})):[],valuations:isManager(actor)?valuations.map(row=>({...row.data,accountKey:undefined,submissionHash:undefined,photos:row.data.photos.map(photo=>({id:photo.id,url:`/api/customer-admin/${storeId}/valuations/${row.data.id}/photos/${photo.id}`}))})):[]});
 }
 if(tail==='/config'&&req.method==='PUT'){
  if(!isManager(actor))deny();const old=await read(db,keyForStore(storeId));if((old?.data.version||0)!==body.version)deny('A configuração mudou. Atualize.',409);
  let phone=clean(body.whatsapp,30).replace(/\D/g,'');if(phone&&phone.length<=11)phone='55'+phone;
  if(phone&&!/^55\d{10,11}$/.test(phone))deny('Informe o WhatsApp com DDD.',400);
  const displayName=clean(body.displayName,80);if(displayName.length<2||typeof body.enabled!=='boolean'||typeof body.canEvaluate!=='boolean')deny('Revise a configuração do portal.',400);
  const data={companyId:store.companyId,enabled:body.enabled,canEvaluate:body.canEvaluate,displayName,whatsapp:phone,version:(old?.data.version||0)+1};await write(db,keyForStore(storeId),data,old);return json(data);
 }
 const invite=tail.match(/^\/orders\/([a-f0-9-]+)\/invite$/);
 if(invite&&req.method==='POST'){
  await storeFor(db,storeId);const sale=await staffSale(db,context,invite[1]);if(sale.status==='Cancelada')deny('Não é possível convidar cliente de venda cancelada.',400);
  const address=email(body.email),name=clean(body.name,160);if(!validEmail(address)||!name||body.identityConfirmed!==true)deny('Confira o nome e e-mail do comprador antes de convidar.',400);
  const key=orderKey(store.companyId,sale.id),old=await read(db,key);
  if(old&&!old.data.revoked&&old.data.email!==address)deny('Esta venda já está vinculada a outro e-mail. Revogue o acesso anterior antes de trocar.',409);
  const raw=token(),hash=await digest(raw),data={saleId:sale.id,storeId,companyId:store.companyId,email:address,name,inviteHash:hash,expiresAt:Date.now()+7*86400000,used:false};
  const link={saleId:sale.id,storeId,email:address,accountKey:old&&!old.data.revoked?old.data.accountKey||null:null,inviteHash:hash,revoked:false,version:(old?.data.version||0)+1};
  const commands=[create(db,'customer:invite:'+hash,data),old?change(db,old,link):create(db,key,link)];if(old)commands.push(guard(db));await db.batch(commands);
  return json({url:new URL(req.url).origin+`/cliente/${storeId}#convite=${raw}`,expiresAt:data.expiresAt},201);
 }
 const revoke=tail.match(/^\/orders\/([a-f0-9-]+)\/revoke$/);
 if(revoke&&req.method==='POST'){
  await staffSale(db,context,revoke[1]);const old=await read(db,orderKey(store.companyId,revoke[1]));if(!old)deny('Vínculo indisponível.',404);if(old.data.version!==body.version)deny('O vínculo mudou. Atualize.',409);await write(db,old.key,{...old.data,revoked:true,version:old.data.version+1},old);return json({ok:true});
 }
 const progress=tail.match(/^\/orders\/([a-f0-9-]+)\/progress$/);
 if(progress&&req.method==='PUT'){
  const sale=await staffSale(db,context,progress[1]);if(sale.status==='Cancelada')deny('A venda está cancelada.',409);
  if(!deliveryStages.includes(body.stage))deny('Etapa inválida.',400);
  const key=stateKey(store.companyId,sale.id),old=await read(db,key);if((old?.data.version||0)!==body.version)deny('O andamento mudou. Atualize.',409);
  const history=[...(old?.data.history||[]),{stage:body.stage,at:now()}].slice(-30);
  const data={stage:body.stage,publicNote:clean(body.publicNote,700),invoiceNumber:clean(body.invoiceNumber,60),history,version:(old?.data.version||0)+1,updatedBy:actor.id};await write(db,key,data,old);return json(data);
 }
 const service=tail.match(/^\/services\/([a-f0-9-]+)$/);
 if(service&&req.method==='PUT'){
  if(!isManager(actor))deny();const old=await read(db,`customer:service:${storeId}:${service[1]}`);if(!old||old.data.companyId!==store.companyId)deny('Solicitação indisponível.',404);
  if(old.data.version!==body.version)deny('O agendamento mudou. Atualize.',409);
  const transitions={Solicitada:['Confirmada','Recusada'],Confirmada:['Confirmada','Concluída','Cancelada pela loja']};if(!transitions[old.data.status]?.includes(body.status))deny('Alteração de agendamento indisponível.',409);
  const confirmedAt=body.status==='Confirmada'?requestTime(body.confirmedAt):old.data.confirmedAt;
  const commands=[];
  if(body.status==='Confirmada'&&old.data.confirmedAt!==confirmedAt&&await read(db,`customer:slot:${storeId}:${confirmedAt}`))deny('Este horário já foi confirmado para outra revisão. Escolha outro horário.',409);
  if(old.data.confirmedAt&&old.data.confirmedAt!==confirmedAt||['Concluída','Cancelada pela loja'].includes(body.status))commands.push(db.prepare('DELETE FROM settings WHERE key=?').bind(`customer:slot:${storeId}:${old.data.confirmedAt}`));
  if(body.status==='Confirmada'&&old.data.confirmedAt!==confirmedAt)commands.push(create(db,`customer:slot:${storeId}:${confirmedAt}`,{id:old.data.id}));
  const data={...old.data,status:body.status,confirmedAt,response:clean(body.response,700),version:old.data.version+1,updatedAt:now()};commands.push(change(db,old,data),guard(db));await db.batch(commands);return json({ok:true});
 }
 const valuation=tail.match(/^\/valuations\/([a-f0-9-]+)$/);
 if(valuation&&req.method==='PUT'){
  if(!isManager(actor))deny();const old=await read(db,`customer:valuation:${storeId}:${valuation[1]}`);if(!old||old.data.companyId!==store.companyId)deny('Avaliação indisponível.',404);
  if(old.data.version!==body.version)deny('A avaliação mudou. Atualize.',409);
  if(!['Em análise','Avaliação preliminar','Encerrada'].includes(body.status))deny('Status inválido.',400);
  const value=body.estimatedValue===''||body.estimatedValue===null?null:Number(body.estimatedValue);if(value!==null&&(!Number.isFinite(value)||value<0||value>1e9)||body.status==='Avaliação preliminar'&&!(value>0))deny('Informe uma estimativa válida para a avaliação preliminar.',400);
  await write(db,old.key,{...old.data,status:body.status,estimatedValue:value,response:clean(body.response,1000),version:old.data.version+1,updatedAt:now()},old);return json({ok:true});
 }
 const photo=tail.match(/^\/valuations\/([a-f0-9-]+)\/photos\/([a-f0-9-]+)$/);
 if(photo&&req.method==='GET'){
  if(!isManager(actor))deny();const row=await read(db,`customer:valuation:${storeId}:${photo[1]}`);if(!row||row.data.companyId!==store.companyId||!row.data.photos.some(p=>p.id===photo[2]))deny('Foto indisponível.',404);return customerPhoto(env,store.companyId,photo[1],photo[2]);
 }
 deny('Operação indisponível.',404);
}
