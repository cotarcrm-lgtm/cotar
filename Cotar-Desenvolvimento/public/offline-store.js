const DATABASE = 'cotar-offline-private-v1';
const STORE = 'vault';
export const SNAPSHOT_LIFETIME = 48 * 60 * 60 * 1000;
export const MAX_PENDING = 200;
const text = new TextEncoder();
export function openOfflineDB(factory = indexedDB) {
 return new Promise((resolve,reject)=>{
  const request=factory.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(Error('Não foi possível abrir o armazenamento deste aparelho.'));
 });
}
export function vaultRepository(db) {
 const perform=(mode,action)=>new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);let result;
  action(store, value=>result=value, tx);
  tx.oncomplete=()=>resolve(result);
  tx.onerror=tx.onabort=()=>reject(Error('O armazenamento não foi atualizado. Reabra a área offline antes de continuar.'));
 });
 return {
  read:()=>perform('readonly',(store,done)=>{const req=store.get('current');req.onsuccess=()=>done(req.result||null)}),
  write:(record,expectedRevision)=>perform('readwrite',(store,done,tx)=>{
   const req=store.get('current');req.onsuccess=()=>{
    if((req.result?.revision||0)!==expectedRevision||(expectedRevision>0&&(!req.result?.salt||!req.result.salt.every((byte,i)=>byte===record.salt[i])))){tx.abort();return;}
    store.put(record,'current');done(record);
   };
  }),
  clear:()=>perform('readwrite',(store)=>store.delete('current'))
 };
}
export async function deriveVaultKey(code,salt,cryptography=crypto) {
 if(!/^\d{8,12}$/.test(code))throw Error('Use um código com 8 a 12 números.');
 const material=await cryptography.subtle.importKey('raw',text.encode(code),'PBKDF2',false,['deriveKey']);
 return cryptography.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptVault(payload,key,salt,revision,cryptography=crypto) {
 const iv=cryptography.getRandomValues(new Uint8Array(12));
 const ciphertext=await cryptography.subtle.encrypt({name:'AES-GCM',iv},key,text.encode(JSON.stringify(payload)));
 return {salt,iv,ciphertext,revision,pendingCount:payload.pending.length};
}
export async function decryptVault(record,key,cryptography=crypto) {
 try {const plain=await cryptography.subtle.decrypt({name:'AES-GCM',iv:record.iv},key,record.ciphertext);return JSON.parse(new TextDecoder().decode(plain));}
 catch {throw Error('Código incorreto ou dados locais indisponíveis.');}
}
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
export function prepareSnapshot(result,stock,now=Date.now()) {
 if(result.offlineSyncVersion!==1)throw Error('O uso offline ainda não está disponível nesta versão do Cotar.');
 if(!result.me?.id||!result.me.companyId||result.me.mustChange||!result.permissions?.screens?.some(s=>['leads','sales'].includes(s)))throw Error('Conclua o login com acesso a leads ou vendas para preparar o uso offline.');
 const catalogue=result.catalogue||{};
 return {
  user:pick(result.me,['id','companyId','name','nickname','role','storeId']),
  screens:result.permissions.screens.filter(s=>['leads','sales'].includes(s)),
  downloadedAt:now,expiresAt:now+SNAPSHOT_LIFETIME,
  stores:((result.records?.stores||[]).some(s=>s.companyId===result.me.companyId)?result.records.stores.filter(s=>s.companyId===result.me.companyId):(result.lookups?.stores||[]).filter(s=>s.id===result.me.storeId)).map(s=>pick(s,['id','name','state'])),
  plans:(catalogue.plans||[]).filter(p=>p.active!==false&&!p.reviewRequired&&catalogue.enabledAdministratorIds?.includes(p.administratorId)).map(p=>pick(p,['id','administratorId','model','family','months','creditCents','installmentWithInsuranceCents','installmentWithoutInsuranceCents','dueDays','effectiveDate'])),
  stock:(stock?.items||[]).filter(v=>v.companyId===result.me.companyId).map(v=>pick(v,['id','name','model','year','modelYear','color','mileage','salePrice','price','status','stockStatus','storeName'])),
  stockAvailable:!!stock
 };
}
export function snapshotFresh(snapshot,now=Date.now()) {return now>=snapshot.downloadedAt-60000&&now<snapshot.expiresAt;}
export function newPending(kind,body,id=crypto.randomUUID(),now=Date.now()) {
 if(!['lead','evaluation'].includes(kind))throw Error('Operação offline indisponível.');
 return {id,kind,body:{...body,offlineMutationId:id},createdAt:now,state:'pending',error:''};
}
export async function synchronizePending(payload,api,persist,onProgress=()=>{}) {
 const current=await api('data');
 if(current.offlineSyncVersion!==1)throw Error('Atualize o Cotar antes de sincronizar. Os registros locais foram preservados.');
 if(current.me?.id!==payload.snapshot.user.id||current.me?.companyId!==payload.snapshot.user.companyId||current.me.mustChange)throw Error('Entre com o mesmo usuário e empresa para sincronizar os registros deste aparelho.');
 let sent=0;
 for(const item of [...payload.pending]) {
  if(item.state==='blocked')continue;
  const allowed=item.kind==='lead'?current.permissions?.screens.includes('leads'):current.permissions?.screens.some(s=>['leads','sales'].includes(s));
  if(!allowed)throw Error('Seu acesso mudou. Os registros locais foram preservados; solicite a revisão das permissões.');
  try {
   const marked={...payload,pending:payload.pending.map(row=>row.id===item.id?{...row,attempted:true}:row)};
   await persist(marked);payload.pending=marked.pending;
   const result=await api(item.kind==='lead'?'leads':'used-evaluations',{method:'POST',body:JSON.stringify(item.body)});
   if(result.id!==item.id)throw Error('O servidor não confirmou a identificação offline. Atualize a versão do Cotar antes de reenviar.');
   const next={...payload,pending:payload.pending.filter(row=>row.id!==item.id)};
   await persist(next);payload.pending=next.pending;sent++;onProgress();
  } catch(error) {
   if(error.status===401||error.status===403)throw error;
   const blocked=!!error.status&&error.status>=400&&error.status<500;
   const next={...payload,pending:payload.pending.map(row=>row.id===item.id?{...row,state:blocked?'blocked':'pending',canEdit:error.status===400||error.status===422,error:error.message||'Envio interrompido. Tente novamente com internet.'}:row)};
   await persist(next);payload.pending=next.pending;onProgress();
   if(!blocked)throw error;
  }
 }
 return sent;
}
export async function clearOfflineAfterLogout() {
 if(!('indexedDB' in globalThis))return;
 const db=await openOfflineDB();try{await vaultRepository(db).clear()}finally{db.close()}
}
export async function allowOfflineLogout() {
 if(!('indexedDB' in globalThis))return true;
 const db=await openOfflineDB();try{
  const record=await vaultRepository(db).read();
  return !record?.pendingCount||window.confirm('Existem registros offline ainda não enviados. Sair apagará esses registros deste aparelho. Deseja sair mesmo assim?');
 }finally{db.close()}
}
