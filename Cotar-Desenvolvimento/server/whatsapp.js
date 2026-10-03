import {deny,inScope,permittedScreens,unpack} from './policy.js';
import {limit} from './auth.js';
const fail=(message,status=400)=>deny(message,status);
const many=async(db,q,...v)=>(await db.prepare(q).bind(...v).all()).results;
export function whatsappPhone(value){let n=String(value||'').replace(/^whatsapp:/,'').replace(/\D/g,'');if(!String(value||'').includes('+')&&(n.length===10||n.length===11))n='55'+n;if(!/^[1-9]\d{7,14}$/.test(n))fail('Telefone inválido. Use o código do país e DDD.');return 'whatsapp:+'+n;}
const base64=bytes=>btoa(String.fromCharCode(...bytes));
async function cipherKey(env){const secret=env.WHATSAPP_ENCRYPTION_KEY||env.COTAR_PROXY_KEY;if(!secret)fail('Proteção das credenciais indisponível.',503);return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function protectToken(token,company,env){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(company)},await cipherKey(env),new TextEncoder().encode(token));return base64(iv)+'.'+base64(new Uint8Array(bytes));}
async function revealToken(value,company,env){const [iv,data]=value.split('.'),decode=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(company)},await cipherKey(env),decode(data)));}
export async function twilioSignature(url,params,token){let value=url;for(const key of [...new Set(params.keys())].sort())for(const item of [...new Set(params.getAll(key))].sort())value+=key+item;const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);return base64(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value))));}
export function secureEqual(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
async function configFor(db,company){return db.prepare('SELECT * FROM whatsapp_accounts WHERE company_id=?').bind(company).first();}
const configPublic=(c,req)=>({configured:!!c,accountSid:c?.account_sid||'',from:c?.from_number||'',mode:c?.mode||'sandbox',enabled:!!c?.enabled,webhook:c?new URL('/api/whatsapp/webhook/'+c.webhook_key,new URL(req.url).origin).href:'',statusWebhook:c?new URL('/api/whatsapp/webhook/'+c.webhook_key+'?status=1',new URL(req.url).origin).href:''});
export async function whatsappRequest(db,env,actor,all,req,path,body={}){
 if(!permittedScreens(actor).includes('leads'))deny('Você não possui acesso aos leads.');
 const company=actor.companyId,c=await configFor(db,company),admin=actor.role==='Administrador'&&!actor.readOnlyCompany;
 if(path==='/api/whatsapp/config'){
  if(req.method==='GET')return admin?{...configPublic(c,req),canConfigure:true}:{configured:!!c,enabled:!!c?.enabled,mode:c?.mode||'sandbox',canConfigure:false};
  if(req.method!=='PUT')fail('Método não permitido.',405);if(!admin)deny('Somente o administrador pode configurar a Twilio.');
  const sid=String(body.accountSid||''),token=String(body.authToken||'');if(!/^AC[a-fA-F0-9]{32}$/.test(sid))fail('Account SID inválido.');if(token&&!/^[a-fA-F0-9]{32}$/.test(token))fail('Auth Token inválido.');if(!token&&(!c||c.account_sid!==sid))fail('Informe o Auth Token da conta.');
  const from=whatsappPhone(body.from);if(!['sandbox','production'].includes(body.mode))fail('Modo inválido.');
  const saved={company_id:company,account_sid:sid,token_cipher:token?await protectToken(token,company,env):c.token_cipher,from_number:from,mode:body.mode,enabled:body.enabled?1:0,webhook_key:c?.webhook_key||crypto.randomUUID()};
  await db.prepare('INSERT INTO whatsapp_accounts (company_id,account_sid,token_cipher,from_number,mode,enabled,webhook_key) VALUES (?,?,?,?,?,?,?) ON CONFLICT(company_id) DO UPDATE SET account_sid=excluded.account_sid,token_cipher=excluded.token_cipher,from_number=excluded.from_number,mode=excluded.mode,enabled=excluded.enabled').bind(...Object.values(saved)).run();return {...configPublic(saved,req),canConfigure:admin};
 }
 const id=new URL(req.url).searchParams.get('lead')||body.leadId,lead=all.leads.find(l=>l.id===id&&l.companyId===company&&inScope(actor,'leads',l,all));if(!lead)deny('Lead fora do seu acesso.',404);const phone=whatsappPhone(lead.phone);
 if(path==='/api/whatsapp/messages'&&req.method==='GET'){
  const messages=await many(db,'SELECT id,direction,body,status,created_at,error_code FROM whatsapp_messages WHERE company_id=? AND lead_id=? AND phone=? ORDER BY created_at DESC LIMIT 100',company,lead.id,phone);
  const last=await db.prepare("SELECT created_at FROM whatsapp_messages WHERE company_id=? AND phone=? AND direction='inbound' ORDER BY created_at DESC LIMIT 1").bind(company,phone).first();return {messages:messages.reverse(),windowOpen:!!last&&Date.now()-Date.parse(last.created_at)<86400000};
 }
 if(path!=='/api/whatsapp/send'||req.method!=='POST')fail('Rota não encontrada.',404);if(actor.readOnlyCompany)deny();if(!c?.enabled)fail('Configure e ative a Twilio antes de enviar.');
 if(!/^[a-f0-9-]{36}$/.test(body.clientId||''))fail('Identificador inválido.');
 const old=await db.prepare('SELECT id,status FROM whatsapp_messages WHERE company_id=? AND sender_id=? AND client_id=?').bind(company,actor.id,body.clientId).first();if(old)return {...old,alreadySubmitted:true};
 if(body.optIn!==true)fail('Confirme que o cliente autorizou o contato pelo WhatsApp.');await limit(db,req,actor.id,'whatsapp');
 const text=String(body.text||'').trim(),contentSid=String(body.contentSid||'');if(contentSid&&!/^HX[a-fA-F0-9]{32}$/.test(contentSid))fail('Content SID inválido.');if(!contentSid&&(!text||text.length>1600))fail('Escreva uma mensagem de até 1.600 caracteres.');
 if(!contentSid){const last=await db.prepare("SELECT created_at FROM whatsapp_messages WHERE company_id=? AND phone=? AND direction='inbound' ORDER BY created_at DESC LIMIT 1").bind(company,phone).first();if(!last||Date.now()-Date.parse(last.created_at)>=86400000)fail('Fora da janela de 24 horas. Use um modelo aprovado pela Meta.');}
 let variables;try{variables=JSON.parse(body.variables||'{}');if(!variables||Array.isArray(variables)||typeof variables!=='object'||Object.keys(variables).length>30||Object.entries(variables).some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='string'||v.length>1000))throw Error();}catch{fail('Variáveis inválidas. Use um objeto JSON como {"1":"Nome"}.');}
 const token=await revealToken(c.token_cipher,company,env),messageId=crypto.randomUUID(),now=new Date().toISOString();
 const claim=await db.prepare("INSERT OR IGNORE INTO whatsapp_messages (id,company_id,lead_id,phone,sender_id,client_id,direction,body,status,created_at,opt_in) VALUES (?,?,?,?,?,?,'outbound',?,'submitting',?,1)").bind(messageId,company,lead.id,phone,actor.id,body.clientId,contentSid?'Modelo '+contentSid+' '+JSON.stringify(variables):text,now).run();if(!claim.meta.changes)return {alreadySubmitted:true,status:'submitting'};
 const form=new URLSearchParams({From:c.from_number,To:phone,StatusCallback:configPublic(c,req).statusWebhook+'&message='+messageId});if(contentSid){form.set('ContentSid',contentSid);form.set('ContentVariables',JSON.stringify(variables));}else form.set('Body',text);
 let response,data;try{response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+c.account_sid+'/Messages.json',{method:'POST',headers:{Authorization:'Basic '+btoa(c.account_sid+':'+token),'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(20000)});data=await response.json();}catch{await db.prepare("UPDATE whatsapp_messages SET status='unknown' WHERE id=?").bind(messageId).run();fail('Não foi possível confirmar o envio. Consulte o histórico e a Twilio antes de repetir.',502);}
 if(!response.ok){await db.prepare("UPDATE whatsapp_messages SET status='failed',error_code=? WHERE id=?").bind(String(data.code||response.status),messageId).run();fail('A Twilio recusou o envio (código '+String(data.code||response.status)+'). Confira o número, saldo, modelo e adesão ao Sandbox.',502);}
 await db.prepare("UPDATE whatsapp_messages SET twilio_sid=?,status=? WHERE id=? AND status='submitting'").bind(data.sid,data.status||'queued',messageId).run();return {id:messageId,status:data.status||'queued'};
}
export async function whatsappWebhook(db,env,req,key){
 if(req.method!=='POST')fail('Método não permitido.',405);if(!req.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded'))fail('Formato inválido.',415);const text=await req.text();if(text.length>50000)fail('Conteúdo muito grande.',413);
 const c=await db.prepare('SELECT * FROM whatsapp_accounts WHERE webhook_key=?').bind(key).first();if(!c)deny('Webhook indisponível.',404);const params=new URLSearchParams(text),token=await revealToken(c.token_cipher,c.company_id,env);
 if(!secureEqual(await twilioSignature(req.url,params,token),req.headers.get('X-Twilio-Signature'))||params.get('AccountSid')!==c.account_sid)deny('Assinatura inválida.',403);
 const sid=params.get('MessageSid');if(!/^(SM|MM)[a-fA-F0-9]{32}$/.test(sid||''))fail('Mensagem inválida.');
 if(new URL(req.url).searchParams.get('status')==='1'){
  const next=params.get('MessageStatus');let r=await db.prepare('SELECT id,status FROM whatsapp_messages WHERE company_id=? AND twilio_sid=?').bind(c.company_id,sid).first();if(!r){const message=new URL(req.url).searchParams.get('message');r=await db.prepare("SELECT id,status FROM whatsapp_messages WHERE company_id=? AND id=? AND direction='outbound' AND twilio_sid IS NULL").bind(c.company_id,message||'').first();if(r)await db.prepare('UPDATE whatsapp_messages SET twilio_sid=? WHERE id=?').bind(sid,r.id).run();}const rank={submitting:0,queued:1,accepted:1,sending:2,sent:3,delivered:4,read:5,failed:6,undelivered:6};
  if(r&&rank[next]!==undefined&&rank[next]>= (rank[r.status]??0)&&r.status!=='read')await db.prepare('UPDATE whatsapp_messages SET status=?,error_code=? WHERE id=?').bind(next,params.get('ErrorCode')||'',r.id).run();
 }else{
  if(params.get('To')!==c.from_number)deny('Número de destino inválido.',403);const phone=whatsappPhone(params.get('From'));
  const recent=await db.prepare("SELECT lead_id FROM whatsapp_messages WHERE company_id=? AND phone=? AND direction='outbound' ORDER BY created_at DESC LIMIT 1").bind(c.company_id,phone).first();let leadId=recent?.lead_id||'';
  if(!leadId){const rows=await many(db,'SELECT * FROM leads WHERE company_id=? ORDER BY created_at DESC',c.company_id);for(const row of rows){const l=unpack(row);try{if(whatsappPhone(l.phone)===phone){leadId=l.id;break;}}catch{}}}
  await db.prepare("INSERT OR IGNORE INTO whatsapp_messages (id,company_id,lead_id,phone,sender_id,client_id,direction,body,status,created_at,twilio_sid,opt_in) VALUES (?,?,?,?,?,?,'inbound',?,'received',?,?,0)").bind(crypto.randomUUID(),c.company_id,leadId,phone,'twilio',sid,String(params.get('Body')||'').slice(0,5000)+(Number(params.get('NumMedia'))>0?'\n[Cliente enviou um anexo; consulte a Twilio nesta primeira versão.]':''),new Date().toISOString(),sid).run();
 }
 return new Response('<Response/>',{headers:{'Content-Type':'application/xml'}});
}
