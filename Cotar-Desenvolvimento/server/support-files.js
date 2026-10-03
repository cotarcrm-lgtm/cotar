import {deny} from './policy.js';
const key=(ticket,message,file)=>`support/${ticket}/${message}/${file}`;
export async function saveSupportFiles(env,ticket,message,files=[]){
 if(!Array.isArray(files)||files.length>3)deny('Anexe até 3 arquivos.',400);
 let total=0;
 const prepared=files.map(f=>{
  if(!f||typeof f.name!=='string'||!f.name.trim()||f.name.length>180||typeof f.data!=='string'||f.data.length>7100000)deny('Arquivo inválido.',400);
  const m=f.data.match(/^data:(image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm|video\/quicktime);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!m)deny('Use fotos JPG, PNG, WebP ou vídeos MP4, WebM e MOV.',400);
  let bytes;try{bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));}catch{deny('Arquivo inválido.',400)}
  total+=bytes.length;if(!bytes.length||bytes.length>5*1024*1024||total>10*1024*1024)deny('Limite de 5 MB por arquivo e 10 MB por envio.',400);
  const type=m[1],head=String.fromCharCode(...bytes.slice(0,12));
  const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?head.slice(0,8)==='\x89PNG\r\n\x1a\n':type==='image/webp'?head.startsWith('RIFF')&&head.slice(8)==='WEBP':type==='video/webm'?bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3:head.slice(4,8)==='ftyp';
  if(!valid)deny('O conteúdo não corresponde ao formato do arquivo.',400);
  return {bytes,type,name:f.name.replace(/[\x00-\x1f\x7f]/g,'').trim(),id:crypto.randomUUID()};
 });
 if(prepared.length&&!env?.PHOTOS)deny('Armazenamento de anexos indisponível.',503);
 const saved=[];try{for(const f of prepared){await env.PHOTOS.put(key(ticket,message,f.id),f.bytes,{httpMetadata:{contentType:f.type}});saved.push({id:f.id,name:f.name,type:f.type,size:f.bytes.length,url:`/api/support/${ticket}/files/${message}/${f.id}`});}return saved;}catch(e){await discardSupportFiles(env,ticket,message,saved);throw e;}
}
export async function discardSupportFiles(env,ticket,message,files){if(env?.PHOTOS?.delete)await Promise.allSettled(files.map(f=>env.PHOTOS.delete(key(ticket,message,f.id))));}
export async function supportFileResponse(db,env,req,ticket,message,id,staff){
 if(!['GET','HEAD'].includes(req.method))deny('Método não permitido.',405);
 const row=await db.prepare('SELECT attachments FROM support_messages WHERE id=? AND ticket_id=?').bind(message,ticket).first();
 const file=row&&JSON.parse(row.attachments||'[]').find(f=>f.id===id);if(!file)deny('Arquivo não encontrado.',404);
 const object=await env.PHOTOS?.get(key(ticket,message,id));if(!object)deny('Arquivo indisponível.',404);
 const inline=new URL(req.url).searchParams.has('view');return new Response(req.method==='HEAD'?null:object.body,{headers:{'Content-Type':file.type,'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
