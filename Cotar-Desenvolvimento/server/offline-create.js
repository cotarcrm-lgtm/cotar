// Stable IDs make a retried offline create safe, including a lost success response.
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status})};
export async function offlineCreate(body,actor,rows){
 if(body.offlineMutationId===undefined)return null;
 const id=body.offlineMutationId;
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))fail('Identificação offline inválida.',400);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body)));
 const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const existing=rows.find(row=>row.id===id);
 if(existing){
  if(existing.companyId!==actor.companyId||existing.createdBy!==actor.id||existing.offlineMutationHash!==hash)fail('O envio offline mudou ou não pertence a este usuário. Revise o registro.');
  return {id,hash,existing};
 }
 return {id,hash};
}
