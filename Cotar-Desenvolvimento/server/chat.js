import {deny,inScope,permittedScreens} from './policy.js';
import {roles,normalizeRole,roleRank} from '../public/config.js';
const fail=(m,s=400)=>deny(m,s);
const many=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
const active=u=>u.status==='Ativo';
const isManager=actor=>roles.includes(normalizeRole(actor.role))&&normalizeRole(actor.role)!=='Vendedor';
const identity=u=>({id:u.id,name:u.nickname||u.name?.split(' ')[0]||'Usuário',role:normalizeRole(u.role),teamId:u.teamId,active:active(u)});
export function chatAudience(actor,all,teamIds){
 if(!isManager(actor))deny('Vendedores podem enviar somente mensagens individuais.');
 if(!Array.isArray(teamIds)||!teamIds.length||teamIds.length>100||teamIds.some(id=>typeof id!=='string'))fail('Selecione ao menos uma equipe.');
 const teams=[...new Set(teamIds)].map(id=>all.teams.find(t=>t.id===id));
 if(teams.some(t=>!t||!inScope(actor,'teams',t,all)||!/^Ativ/.test(t.status)))deny('Uma das equipes está fora do seu alcance ou inativa.');
 const recipients=all.users.filter(u=>u.id!==actor.id&&active(u)&&teamIds.includes(u.teamId)&&inScope(actor,'users',u,all)&&(normalizeRole(actor.role)==='Administrador'||roleRank(u.role)>roleRank(actor.role)));
 return {teams,recipients};
}
const fileKey=(company,message,id)=>`chat/${company}/${message}/${id}`;
async function prepareFiles(env,company,message,files){
 if(files===undefined)return [];
 if(!Array.isArray(files)||files.length>3)fail('Anexe até 3 arquivos por mensagem.');
 let total=0;
 const prepared=files.map(f=>{
  if(!f||typeof f.name!=='string'||!f.name||f.name.length>180||typeof f.data!=='string'||f.data.length>7100000)fail('Arquivo inválido.');
  const m=f.data.match(/^data:(application\/pdf|image\/jpeg|image\/png|image\/webp|text\/plain|application\/vnd.openxmlformats-officedocument.wordprocessingml.document|application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m)fail('Use PDF, JPG, PNG, WebP, TXT, DOCX ou XLSX.');
  let bytes;try{bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));}catch{fail('Arquivo inválido.');}
  total+=bytes.length;if(!bytes.length||bytes.length>5*1024*1024||total>10*1024*1024)fail('Limite de 5 MB por arquivo e 10 MB por mensagem.');
  const type=m[1],head=String.fromCharCode(...bytes.slice(0,12));
  const valid=type==='application/pdf'?head.startsWith('%PDF-'):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?head.slice(0,8)==='\x89PNG\r\n\x1a\n':type==='image/webp'?head.startsWith('RIFF')&&head.slice(8)==='WEBP':type==='text/plain'?!bytes.includes(0):head.startsWith('PK\x03\x04');
  if(!valid)fail('O conteúdo não corresponde ao formato do arquivo.');
  return {bytes,type,name:f.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180),id:crypto.randomUUID()};
 });
 if(prepared.length&&!env.PHOTOS)fail('Armazenamento de anexos indisponível.',503);
 const output=[];for(const f of prepared){await env.PHOTOS.put(fileKey(company,message,f.id),f.bytes,{httpMetadata:{contentType:f.type}});output.push({id:f.id,name:f.name,type:f.type,size:f.bytes.length,url:`/api/chat/files/${message}/${f.id}`});}return output;
}
function pack(row,peer){return {id:row.id,senderId:row.sender_id,recipientId:row.recipient_id,kind:row.kind,body:row.body,attachments:JSON.parse(row.attachments),sale:JSON.parse(row.audience||'{}').sale||null,createdAt:row.created_at,readAt:row.read_at,peer};}
export async function chatRequest(db,env,actor,all,req,path,body){
 const url=new URL(req.url),company=actor.companyId;
 const visibleSales=()=>permittedScreens(actor).includes('sales')?(all.sales||[]).filter(s=>inScope(actor,'sales',s,all)):[];
 if(path==='/api/chat/sales'&&req.method==='GET'){const query=(url.searchParams.get('q')||'').trim().toUpperCase().slice(0,30),digits=query.replace(/\D/g,'');if(!/^C[0-9]+$/.test(query)&&digits.length<3)return {sales:[]};const matches=visibleSales().filter(s=>/^C[0-9]+$/.test(query)?s.saleCode?.toUpperCase()===query:String(s.customerCpf||s.customerDocument||'').replace(/\D/g,'').includes(digits));return {sales:matches.slice(0,10).map(s=>({id:s.id,code:s.saleCode,customer:s.customerName||s.leadSnapshot?.name||'',model:s.model||''})),more:matches.length>10};}
 if(path.startsWith('/api/chat/sales/')&&req.method==='GET'){const sale=visibleSales().find(s=>s.id===path.slice('/api/chat/sales/'.length));if(!sale)deny('Venda indisponível ou fora do seu acesso.',404);return {sale};}
 if(path==='/api/chat/unread'&&req.method==='GET')return {count:(await db.prepare('SELECT count(*) AS count FROM chat_recipients r JOIN chat_messages m ON m.id=r.message_id WHERE m.company_id=? AND r.recipient_id=? AND r.read_at IS NULL').bind(company,actor.id).first()).count};
 if(path==='/api/chat/bootstrap'&&req.method==='GET'){
  const allowedTeams=isManager(actor)?all.teams.filter(t=>inScope(actor,'teams',t,all)&&/^Ativ/.test(t.status)):[];
  const lists=isManager(actor)?await many(db,'SELECT id,name,team_ids FROM chat_lists WHERE company_id=? AND owner_id=? ORDER BY created_at DESC',company,actor.id):[];
  return {me:identity(actor),canBroadcast:isManager(actor),directory:all.users.filter(u=>u.id!==actor.id&&active(u)).map(identity),teams:allowedTeams.map(t=>({id:t.id,name:t.name,store:all.stores.find(s=>s.id===t.storeId)?.name||'',count:chatAudience(actor,all,[t.id]).recipients.length})),lists:lists.map(l=>({id:l.id,name:l.name,teamIds:JSON.parse(l.team_ids)}))};
 }
 if(path==='/api/chat/threads'&&req.method==='GET'){
  const rows=await many(db,`WITH scoped AS (SELECT m.*,r.recipient_id,r.read_at,CASE WHEN m.sender_id=? THEN r.recipient_id ELSE m.sender_id END AS peer FROM chat_messages m JOIN chat_recipients r ON r.message_id=m.id WHERE m.company_id=? AND (m.sender_id=? OR r.recipient_id=?)), ranked AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY peer ORDER BY created_at DESC,id DESC) AS position,SUM(CASE WHEN recipient_id=? AND read_at IS NULL THEN 1 ELSE 0 END) OVER (PARTITION BY peer) AS unread FROM scoped) SELECT * FROM ranked WHERE position=1 ORDER BY created_at DESC LIMIT 200`,actor.id,company,actor.id,actor.id,actor.id);
  return {threads:rows.map(r=>({...pack(r,identity(all.users.find(u=>u.id===r.peer)||{id:r.peer,name:'Usuário indisponível'})),unread:r.unread}))};
 }
 if(path==='/api/chat/messages'&&req.method==='GET'){
  const peer=url.searchParams.get('peer');if(!all.users.some(u=>u.id===peer))deny('Conversa indisponível.',404);
  const before=url.searchParams.get('before'),cursor=before?.split('|');if(before&&(!/^\d{4}-\d{2}-\d{2}T/.test(cursor[0])||!/^([a-z0-9-]{1,80})$/.test(cursor[1]||'')||before.length>130))fail('Cursor inválido.');
  const rows=await many(db,`SELECT m.*,r.recipient_id,r.read_at FROM chat_messages m JOIN chat_recipients r ON r.message_id=m.id WHERE m.company_id=? AND ((m.sender_id=? AND r.recipient_id=?) OR (m.sender_id=? AND r.recipient_id=?)) ${before?'AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 60`,company,actor.id,peer,peer,actor.id,...(before?[cursor[0],cursor[0],cursor[1]]:[]));
  return {messages:rows.reverse().map(r=>pack(r)),hasMore:rows.length===60};
 }
 if(path==='/api/chat/read'&&req.method==='POST'){
  if(!Array.isArray(body.ids)||body.ids.length>60||body.ids.some(id=>typeof id!=='string'||id.length>80))fail('Mensagens inválidas.');
  if(body.ids.length)await db.prepare(`UPDATE chat_recipients SET read_at=? WHERE recipient_id=? AND read_at IS NULL AND message_id IN (${body.ids.map(()=>'?').join(',')}) AND message_id IN (SELECT id FROM chat_messages WHERE company_id=?)`).bind(new Date().toISOString(),actor.id,...body.ids,company).run();return {ok:true};
 }
 if(path==='/api/chat/lists'&&req.method==='POST'){
  const audience=chatAudience(actor,all,body.teamIds),name=String(body.name||'').trim().toLocaleUpperCase('pt-BR');if(!name||name.length>100)fail('Informe um nome de até 100 caracteres para a lista.');
  const id=crypto.randomUUID();await db.prepare('INSERT INTO chat_lists (id,company_id,owner_id,name,team_ids,created_at) VALUES (?,?,?,?,?,?)').bind(id,company,actor.id,name,JSON.stringify(audience.teams.map(t=>t.id)),new Date().toISOString()).run();return {id,name,teamIds:body.teamIds};
 }
 const list=path.match(/^\/api\/chat\/lists\/([a-z0-9-]+)$/);if(list&&req.method==='DELETE'){
  if(!isManager(actor))deny();await db.prepare('DELETE FROM chat_lists WHERE id=? AND company_id=? AND owner_id=?').bind(list[1],company,actor.id).run();return {ok:true};
 }
 if(path==='/api/chat/broadcasts'&&req.method==='GET'){
  if(!isManager(actor))deny();return {broadcasts:await many(db,`SELECT m.id,m.body,m.audience,m.created_at,count(r.recipient_id) AS total,sum(CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END) AS seen FROM chat_messages m JOIN chat_recipients r ON r.message_id=m.id WHERE m.company_id=? AND m.sender_id=? AND m.kind='broadcast' GROUP BY m.id ORDER BY m.created_at DESC LIMIT 50`,company,actor.id)};
 }
 if(path==='/api/chat/send'&&req.method==='POST'){
  if(!/^[a-zA-Z0-9-]{20,80}$/.test(body.clientId||''))fail('Identificador de envio inválido.');
  if(!['direct','broadcast'].includes(body.kind))fail('Tipo de mensagem inválido.');
  if(body.kind==='broadcast'&&!isManager(actor))deny('Vendedores podem enviar somente mensagens individuais.');
  const old=await db.prepare('SELECT id FROM chat_messages WHERE company_id=? AND sender_id=? AND client_id=?').bind(company,actor.id,body.clientId).first();if(old)return {id:old.id,alreadySent:true};
  const text=typeof body.text==='string'?body.text.trim().toLocaleUpperCase('pt-BR'):'';if(text.length>5000||(!text&&!body.files?.length&&!body.saleId))fail('Escreva uma mensagem ou anexe um arquivo. Máximo de 5.000 caracteres.');
  let sale=null;if(body.saleId){const selected=visibleSales().find(s=>s.id===body.saleId);if(!selected)deny('Venda indisponível ou fora do seu acesso.',404);sale={id:selected.id,code:selected.saleCode};}
  let recipients,audience='';
  if(body.kind==='direct'){const user=all.users.find(u=>u.id===body.recipientId&&u.id!==actor.id&&active(u));if(!user)deny('Destinatário indisponível.',404);recipients=[user];}
  else{let teamIds=body.teamIds;if(body.listId){const saved=await db.prepare('SELECT team_ids FROM chat_lists WHERE id=? AND company_id=? AND owner_id=?').bind(body.listId,company,actor.id).first();if(!saved)deny('Lista indisponível.',404);teamIds=JSON.parse(saved.team_ids);}const selected=chatAudience(actor,all,teamIds);recipients=selected.recipients;audience=selected.teams.map(t=>t.name).join(', ').slice(0,500);if(!recipients.length)fail('Não há destinatários ativos nessas equipes.');if(recipients.length>500)fail('Selecione menos equipes. O limite é de 500 destinatários por comunicado.');}
  const rate=await db.prepare('SELECT count(*) AS count FROM chat_messages WHERE company_id=? AND sender_id=? AND created_at>?').bind(company,actor.id,new Date(Date.now()-60000).toISOString()).first();if(rate.count>=30)fail('Aguarde um minuto antes de enviar mais mensagens.',429);
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(company+':'+actor.id+':'+body.clientId));const id=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
  const audienceData=JSON.stringify({label:audience,sale,recipientIds:recipients.map(u=>u.id)});
  const attachments=await prepareFiles(env,company,id,body.files||[]),now=new Date().toISOString();
  const commands=[db.prepare('INSERT OR IGNORE INTO chat_messages (id,company_id,sender_id,client_id,kind,body,attachments,audience,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,company,actor.id,body.clientId,body.kind,text,JSON.stringify(attachments),audienceData,now),...recipients.map(u=>db.prepare("INSERT OR IGNORE INTO chat_recipients (message_id,recipient_id) SELECT ?,? WHERE EXISTS (SELECT 1 FROM chat_messages m,json_each(m.audience,'$.recipientIds') j WHERE m.id=? AND j.value=?)").bind(id,u.id,id,u.id))];
  await db.batch(commands);return {id,total:recipients.length};
 }
 const file=path.match(/^\/api\/chat\/files\/([a-z0-9-]+)\/([a-z0-9-]+)$/);if(file&&req.method==='GET'){
  const m=await db.prepare('SELECT * FROM chat_messages WHERE id=? AND company_id=?').bind(file[1],company).first();if(!m)deny('Arquivo indisponível.',404);
  if(m.sender_id!==actor.id&&!await db.prepare('SELECT message_id FROM chat_recipients WHERE message_id=? AND recipient_id=?').bind(m.id,actor.id).first())deny('Arquivo indisponível.',404);
  const attachment=JSON.parse(m.attachments).find(f=>f.id===file[2]);if(!attachment)deny('Arquivo indisponível.',404);if(!env.PHOTOS)fail('Anexos indisponíveis.',503);const object=await env.PHOTOS.get(fileKey(company,m.id,attachment.id));if(!object)deny('Arquivo indisponível.',404);
  const inline=url.searchParams.get('view')==='1'&&attachment.type.startsWith('image/');return new Response(object.body,{headers:{'Content-Type':attachment.type,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 fail('Rota de chat não encontrada.',404);
}
