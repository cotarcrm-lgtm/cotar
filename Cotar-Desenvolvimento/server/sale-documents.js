import {saleDocuments,consortiumDocuments} from '../public/sale-form.js';
import {deny,inScope,permittedScreens} from './policy.js';
const key=(company,sale,id)=>`sales/${company}/${sale}/${id}`;
export async function saveSaleDocuments(env,company,sale,incoming,old=[]){
 if(incoming===undefined)return old;
 if(!Array.isArray(incoming)||incoming.length>10)deny('Anexe até 10 documentos.',400);
 const slots=new Set();
 const prepared=incoming.map(p=>{
  if(!p||!Object.hasOwn({...saleDocuments,...consortiumDocuments},p.slot)||slots.has(p.slot))deny('Documento inválido ou duplicado.',400);slots.add(p.slot);
  if(p.id){const keep=old.find(d=>d.id===p.id&&d.slot===p.slot);if(!keep)deny('Documento indisponível.',400);return {keep};}
  if(typeof p.data!=='string'||p.data.length>2800000||typeof p.name!=='string'||p.name.length>180)deny('Documento inválido ou maior que 2 MB.',400);
  const match=p.data.match(/^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)deny('Use PDF, JPG, PNG ou WebP.',400);
  let bytes;try{bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));}catch{deny('Arquivo inválido.',400);}
  if(!bytes.length||bytes.length>2*1024*1024)deny('O arquivo deve ter até 2 MB.',400);
  const type=match[1],head=String.fromCharCode(...bytes.slice(0,12));
  const valid=type==='application/pdf'?head.startsWith('%PDF-'):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes[0]===137&&head.slice(1,8)==='PNG\r\n\x1a\n':head.startsWith('RIFF')&&head.slice(8)==='WEBP';
  if(!valid)deny('O conteúdo do arquivo não corresponde ao formato.',400);
  return {bytes,type,id:crypto.randomUUID(),slot:p.slot,name:p.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180)};
 });
 if(prepared.some(p=>p.bytes)&&!env.PHOTOS)deny('Armazenamento de documentos indisponível.',503);
 const docs=new Array(prepared.length),uploaded=[];let next=0,error;
 await Promise.all(Array.from({length:Math.min(3,prepared.length)},async()=>{while(next<prepared.length&&!error){const index=next++,p=prepared[index];if(p.keep){docs[index]=p.keep;continue;}try{await env.PHOTOS.put(key(company,sale,p.id),p.bytes,{httpMetadata:{contentType:p.type}});uploaded.push(p.id);docs[index]={id:p.id,slot:p.slot,name:p.name,type:p.type,size:p.bytes.length,url:`/api/sale-documents/${sale}/${p.id}`};}catch(e){error=e;}}}));
 if(error){if(env.PHOTOS?.delete)await Promise.allSettled(uploaded.map(id=>env.PHOTOS.delete(key(company,sale,id))));throw error;}return docs;
}
export async function saleDocumentResponse(env,actor,all,id,docId){
 const sale=all.sales.find(s=>s.id===id);if(!sale||!permittedScreens(actor).includes('sales')||!inScope(actor,'sales',sale,all))deny('Documento indisponível.',404);
 const doc=sale.documents?.find(d=>d.id===docId);if(!doc)deny('Documento indisponível.',404);
 if(!env.PHOTOS)deny('Documentos indisponíveis.',503);const object=await env.PHOTOS.get(key(actor.companyId,id,docId));if(!object)deny('Documento indisponível.',404);
 return new Response(object.body,{headers:{'Content-Type':doc.type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
