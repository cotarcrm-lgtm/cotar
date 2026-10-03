import {openOfflineDB,vaultRepository,deriveVaultKey,encryptVault,decryptVault,prepareSnapshot,snapshotFresh,newPending,synchronizePending,MAX_PENDING} from './offline-store.js';
import {hondaModels} from './honda-models.js';
import {fromLocalDateTime,localDateTime} from './lead-utils.js';
const root=document.querySelector('#offline-root'),message=document.querySelector('#offline-message');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Bahia'});
let repository,db,record,key,payload,tab='catalogue',busy=false,syncing=false,editingId=null;
const tell=text=>{message.textContent=text};
const network=()=>{document.querySelector('#network-status').textContent=navigator.onLine?'Internet disponível':'Sem internet'};
network();
async function api(path,options={}) {
 const company=sessionStorage.getItem('cotar-company');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try {
  const response=await fetch('/api/'+path,{...options,signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json',...(company?{'X-Cotar-Company':company}:{})}});
  let body;try{body=await response.json()}catch{throw Error('Resposta indisponível. Os registros locais foram preservados.')}
  if(!response.ok)throw Object.assign(Error(body.error||'Não foi possível acessar o Cotar.'),{status:response.status});
  return body;
 } catch(error) {
  if(error.status)throw error;
  throw Error('Não foi possível concluir a conexão. Os registros locais foram preservados; tente novamente com internet.');
 } finally {clearTimeout(timer)}
}
async function persist(next) {
 const saved=await encryptVault(next,key,record.salt,record.revision+1);
 await repository.write(saved,record.revision);record=saved;payload=next;
}
const codeField=(name,label)=>`<label>${label}<input name="${name}" type="password" inputmode="numeric" pattern="[0-9]{8,12}" minlength="8" maxlength="12" autocomplete="off" required></label>`;
function locked() {
 key=null;payload=null;editingId=null;tab='catalogue';
 root.innerHTML=`<h1>Usar offline</h1><p>Consulte catálogo e estoque baixados, cadastre novos leads e salve rascunhos de avaliações. Reservas, vendas e pagamentos precisam de internet.</p>${record?`<form id="unlock-form"><h2>Desbloquear este aparelho</h2>${codeField('code','Código offline (8 a 12 números)')}<button>Desbloquear</button><p class="muted">${record.pendingCount} registro(s) aguardando envio. O código offline é separado da senha de login.</p></form><button class="secondary" id="clear-vault">Apagar dados deste aparelho</button>`:`<form id="prepare-form"><h2>Preparar antes de ficar sem internet</h2><p>Entre no Cotar antes de preparar. Os dados serão protegidos por um código neste aparelho. Guarde esse código: não há recuperação dos registros locais se ele for esquecido.</p>${codeField('code','Crie seu código offline')}${codeField('confirmation','Repita o código')}<button>Baixar dados para uso offline</button></form>`}<a class="offline-link secondary" href="/login">Voltar ao Cotar</a>`;
 root.querySelector('#unlock-form')?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;
  const form=event.target,button=form.querySelector('button');button.disabled=true;
  try {
   record=await repository.read();if(!record)throw Error('Os dados locais foram apagados. Prepare novamente com internet.');
   key=await deriveVaultKey(new FormData(form).get('code'),record.salt);payload=await decryptVault(record,key);
   form.reset();render();tell('Dados locais desbloqueados.');if(navigator.onLine)setTimeout(()=>void sync(),0);
  }catch(error){key=null;payload=null;tell(error.message)}finally{busy=false;button.disabled=false}
 });
 root.querySelector('#prepare-form')?.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const form=event.target,fields=new FormData(form);
  if(fields.get('code')!==fields.get('confirmation')){tell('Os códigos não conferem.');return;}
  busy=true;form.querySelector('button').disabled=true;
  try {
   const snapshot=await downloadSnapshot();
   const salt=crypto.getRandomValues(new Uint8Array(16));key=await deriveVaultKey(fields.get('code'),salt);
   const next={snapshot,pending:[]};record=await encryptVault(next,key,salt,1);
   await repository.write(record,0);payload=next;form.reset();render();tell('Dados baixados. Abra esta área e confira o acesso antes de ficar sem internet.');
   navigator.storage?.persist?.().catch(()=>{});
  }catch(error){key=null;record=await repository.read();payload=null;tell(error.message);locked()}finally{busy=false}
 });
 root.querySelector('#clear-vault')?.addEventListener('click',clear);
}
async function downloadSnapshot() {
 if(!navigator.onLine)throw Error('Conecte-se à internet e entre no Cotar para baixar os dados.');
 const result=await api('data');
 // Reuse only responses already restricted by the server. A denied stock read remains unavailable.
 let stock=null;
 try{stock=await api('used-stock')}catch(error){if(error.status!==403)throw error;}
 return prepareSnapshot(result,stock);
}
async function clear() {
 if(syncing||busy){tell('Aguarde a operação atual.');return;}
 if(!confirm(`Apagar os dados offline deste aparelho? ${record?.pendingCount||0} registro(s) ainda não enviado(s) serão perdidos. Os registros já enviados ao Cotar não serão apagados.`))return;
 await repository.clear();record=null;locked();tell('Dados locais apagados.');
}
function render() {
 if(!payload){locked();return;}
 const snapshot=payload.snapshot,fresh=snapshotFresh(snapshot);
 root.innerHTML=`<h1>Usar offline</h1><section class="summary"><p><strong>${esc(snapshot.user.nickname||snapshot.user.name)}</strong><br>Dados baixados em ${date(snapshot.downloadedAt)}<br><span class="status">${payload.pending.length} registro(s) pendente(s)</span></p><div><button id="sync" ${syncing?'disabled':''}>${syncing?'Enviando…':'Sincronizar agora'}</button><button class="secondary" id="refresh" ${syncing?'disabled':''}>Atualizar dados baixados</button><button class="secondary" id="lock" ${syncing?'disabled':''}>Bloquear</button></div></section>${!fresh?'<p class="warning">Os dados baixados venceram. Conecte-se e atualize para consultar ou cadastrar novamente. Seus registros pendentes continuam preservados.</p>':'<p class="muted">Consulta da última atualização, válida por 48 horas. Preços e disponibilidade precisam de confirmação online.</p>'}<nav aria-label="Áreas offline">${[['catalogue','Catálogo'],['stock','Estoque'],['lead','Novo lead'],['evaluation','Nova avaliação'],['pending','Pendências']].filter(([id])=>id!=='lead'||snapshot.screens.includes('leads')).map(([id,label])=>`<button data-tab="${id}" ${tab===id?'aria-current="page"':''}>${label}</button>`).join('')}</nav><div id="offline-content"></div><p class="muted">Registros locais podem ser perdidos se você limpar os dados do navegador ou se o iPhone remover o armazenamento. Sincronize assim que puder. Fotos, anexos e edição de registros da nuvem não estão disponíveis offline.</p><button class="secondary" id="clear-vault">Apagar dados deste aparelho</button>`;
 root.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{if(syncing){tell('Aguarde o envio terminar.');return;}editingId=null;tab=button.dataset.tab;render()});
 root.querySelector('#sync').onclick=()=>void sync();
 root.querySelector('#lock').onclick=()=>{if(!syncing){locked();tell('Área offline bloqueada.')}};
 root.querySelector('#clear-vault').onclick=()=>clear().catch(error=>tell(error.message));
 root.querySelector('#refresh').onclick=async()=>{
  if(syncing||busy)return;busy=true;
  try {
   const snapshot=await downloadSnapshot();
   if(snapshot.user.id!==payload.snapshot.user.id||snapshot.user.companyId!==payload.snapshot.user.companyId)throw Error('Entre com o mesmo usuário e empresa para atualizar estes dados.');
   await persist({...payload,snapshot});render();tell('Catálogo e estoque atualizados. Registros pendentes preservados.');
  }catch(error){tell(error.message)}finally{busy=false}
 };
 if(['lead','evaluation'].includes(tab)){if(fresh)renderForm(tab);else root.querySelector('#offline-content').textContent='Atualize os dados com internet antes de criar novos registros.';}
 else if(tab==='pending')renderPending();
 else renderList(tab,fresh);
}
function renderList(kind,fresh) {
 const content=root.querySelector('#offline-content');
 if(!fresh){content.textContent='Atualize os dados com internet para consultar.';return;}
 if(kind==='stock'&&!payload.snapshot.stockAvailable){content.textContent='Estoque não disponível para este acesso.';return;}
 content.innerHTML='<label>Buscar<input id="offline-search" type="search" placeholder="Modelo, família ou loja"></label><div class="cards" id="offline-results"></div>';
 const draw=query=>{
  const rows=(kind==='stock'?payload.snapshot.stock:payload.snapshot.plans).filter(row=>[row.model,row.name,row.family,row.storeName].join(' ').toLowerCase().includes(query.toLowerCase()));
  content.querySelector('#offline-results').innerHTML=rows.length?rows.map(row=>kind==='stock'?`<article><h2>${esc(row.model||row.name)}</h2><p>${esc(row.year||row.modelYear)} · ${esc(row.color)}<br>${esc(row.storeName)}<br>${esc(row.stockStatus||row.status)}</p><strong>${money(row.salePrice||row.price)}</strong><p class="muted">Disponibilidade da última atualização. Confirme com internet antes de negociar.</p></article>`:`<article><h2>${esc(row.model)}</h2><p>${esc(row.administratorId)} · ${esc(row.family)} · ${esc(row.months)} meses</p><p>Crédito: <strong>${money(row.creditCents/100)}</strong></p><p>${row.installmentWithoutInsuranceCents?'Sem seguro: '+money(row.installmentWithoutInsuranceCents/100):''}<br>${row.installmentWithInsuranceCents?'Com seguro: '+money(row.installmentWithInsuranceCents/100):''}</p><p class="muted">Tabela baixada; o plano será validado novamente ao enviar o lead.</p></article>`).join(''):'<p>Nenhum resultado nos dados baixados.</p>';
 };draw('');content.querySelector('#offline-search').oninput=event=>draw(event.target.value);
}
function renderForm(kind) {
 const item=payload.pending.find(row=>row.id===editingId),body=item?.body||{};
 const field=(name,label,type='text',attrs='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(body[name]||'')}" ${attrs}></label>`;
 const options=(values,value)=>values.map(entry=>{const [id,label]=Array.isArray(entry)?entry:[entry,entry];return `<option value="${esc(id)}" ${value===id?'selected':''}>${esc(label)}</option>`}).join('');
 let html;
 if(kind==='lead') {
  html=`<h2>${item?'Editar lead local':'Novo lead offline'}</h2>${field('name','Nome *','text','required maxlength="200"')}${field('phone','Telefone *','tel','required maxlength="30"')}${field('email','E-mail','email','maxlength="300"')}<label>Próximo contato (horário de Brasília) *<input name="scheduledAt" type="datetime-local" required value="${esc(body.scheduledAt?localDateTime(body.scheduledAt):'')}"></label><label>Loja *<select name="storeId" required>${options(payload.snapshot.stores.map(s=>[s.id,s.name]),body.storeId||payload.snapshot.user.storeId)}</select></label><label>Modalidade *<select name="modality" required>${options(['À vista','Financiamento','Consórcio','Seminova'],body.modality||'À vista')}</select></label><div id="lead-product"></div><label>Origem<select name="source">${options(['Loja','WhatsApp','Instagram','Indicação','Site','Catálogo','Outros'],body.source||'Loja')}</select></label><label>Temperatura<select name="temperature">${options(['Morno','Frio','Quente','Super quente'],body.temperature||'Morno')}</select></label>`;
 } else {
  html=`<h2>${item?'Editar rascunho local':'Novo rascunho de avaliação'}</h2><p>Salvo como avaliação em andamento. Consultas externas e fechamento exigem internet.</p>${field('plate','Placa','text','maxlength="7" pattern="[A-Za-z]{3}[0-9][A-Za-z0-9][0-9]{2}"')}${field('model','Marca e modelo','text','maxlength="150"')}${field('chassis','Chassi','text','maxlength="32"')}${field('year','Ano fabricação/modelo','text','maxlength="9"')}<label>Quilometragem<input name="mileage" type="number" min="0" max="2000000" step="1" value="${esc(body.vehicleDetails?.mileage||0)}"></label>${field('ownerName','Nome do cliente','text','maxlength="160"')}${field('ownerPhone','Telefone do cliente','tel','maxlength="30"')}<section><h3>Checklist inicial</h3>${[['engineCondition','Motor'],['frontShock','Suspensão dianteira'],['rearShock','Suspensão traseira'],['battery','Bateria']].map(([name,label])=>`<label>${label}<select name="check-${name}">${options(['','BOM','RESTAURAR','TROCAR'],body.checklist?.[name]?.state||'')}</select></label>`).join('')}</section>`;
 }
 root.querySelector('#offline-content').innerHTML=`<form id="local-form">${html}<label>Observações<textarea name="notes" maxlength="2000">${esc(body.notes||body.checklistNotes||'')}</textarea></label><button>Salvar neste aparelho</button><p class="muted">O registro só chegará à nuvem após a sincronização.</p></form>`;
 const form=root.querySelector('#local-form');
 function products() {
  const modality=form.elements.modality.value,container=form.querySelector('#lead-product');
  if(modality==='Consórcio') {
   container.innerHTML=`<label>Plano *<select name="planId" required>${options(payload.snapshot.plans.map(p=>[p.id,`${p.administratorId} · ${p.model} · ${money(p.creditCents/100)} · ${p.months} meses`]),body.planId)}</select></label><div id="plan-options"></div>`;
   const details=()=>{
    const plan=payload.snapshot.plans.find(p=>p.id===form.elements.planId.value);
    if(!plan){form.querySelector('#plan-options').textContent='Nenhum plano disponível.';return;}
    form.querySelector('#plan-options').innerHTML=`<label>Seguro *<select name="insurance" required>${options([...(plan.installmentWithoutInsuranceCents?['Sem seguro']:[]),...(plan.installmentWithInsuranceCents?['Com seguro']:[])],body.insurance)}</select></label>${plan.dueDays?.length?`<label>Vencimento *<select name="dueDay" required>${options(plan.dueDays.map(day=>[String(day),String(day)]),body.dueDay)}</select></label>`:''}`;
   };details();form.elements.planId.onchange=details;
  }else {
   container.innerHTML=`<label>Categoria *<select name="category" required>${options(['Moto','Automóvel'],body.category||'Moto')}</select></label><label>Modelo Honda *<select name="model" required></select></label>`;
   const models=()=>{form.elements.model.innerHTML=options(hondaModels[form.elements.category.value],body.model)};models();form.elements.category.onchange=models;
  }
 }
 if(kind==='lead'){products();form.elements.modality.onchange=products;}
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||syncing)return;busy=true;form.querySelector('button').disabled=true;
  try {
   if(!snapshotFresh(payload.snapshot))throw Error('Atualize os dados baixados antes de cadastrar.');
   if(!item&&payload.pending.length>=MAX_PENDING)throw Error('Sincronize os registros pendentes antes de cadastrar mais.');
   const fields=Object.fromEntries(new FormData(form));let value;
   if(kind==='lead') {
    const plan=payload.snapshot.plans.find(p=>p.id===fields.planId);
    value={...fields,status:'Agendado',scheduledAt:fromLocalDateTime(fields.scheduledAt),userId:payload.snapshot.user.id,administratorId:plan?.administratorId||'',dueDay:fields.dueDay||''};
   }else {
    value={plate:fields.plate.toUpperCase(),model:fields.model,chassis:fields.chassis,year:fields.year,stage:'Consultas',vehicleDetails:{mileage:Number(fields.mileage||0)},clientDetails:{name:fields.ownerName,phone:fields.ownerPhone},ownerName:fields.ownerName,ownerPhone:fields.ownerPhone,checklistNotes:fields.notes,checklist:Object.fromEntries(Object.entries(fields).filter(([name,state])=>name.startsWith('check-')&&state).map(([name,state])=>[name.slice(6),{state,cost:0,note:''}]))};
   }
   if(item&&item.attempted&&!item.canEdit)throw Error('Este envio precisa de confirmação na nuvem antes de editar. Os dados foram preservados.');
   const entry=newPending(kind,value,item?.id);
   await persist({...payload,pending:item?payload.pending.map(row=>row.id===item.id?entry:row):[...payload.pending,entry]});
   editingId=null;tab='pending';render();tell('Salvo neste aparelho. Pendente de sincronização.');
   if(navigator.onLine)setTimeout(()=>void sync(),0);
  }catch(error){tell(error.message);form.querySelector('button').disabled=false}finally{busy=false}
 };
}
function renderPending() {
 root.querySelector('#offline-content').innerHTML=payload.pending.length?payload.pending.map(item=>`<article><h2>${item.kind==='lead'?'Lead':'Rascunho de avaliação'}: ${esc(item.body.name||item.body.model||item.body.plate||'Sem identificação')}</h2><span class="status ${item.state==='blocked'?'blocked':''}">${item.state==='blocked'?'Precisa de revisão':'Pendente de sincronização'}</span><p>${date(item.createdAt)}</p>${item.error?`<p>${esc(item.error)}</p>`:''}${!item.attempted||item.canEdit?`<button data-edit="${item.id}">Editar registro local</button>`:'<p class="muted">Envio iniciado. A confirmação na nuvem é necessária antes de editar para evitar duplicatas.</p>'}${item.state==='blocked'?`<button class="secondary" data-retry="${item.id}">Tentar novamente</button>`:''}<button class="danger" data-delete="${item.id}">Excluir do aparelho</button></article>`).join(''):'<section><h2>Sem pendências</h2><p>Não há registros locais aguardando envio.</p></section>';
 root.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>{if(syncing||busy)return;const item=payload.pending.find(row=>row.id===button.dataset.edit);editingId=item.id;tab=item.kind;render()});
 root.querySelectorAll('[data-delete]').forEach(button=>button.onclick=async()=>{
  if(syncing||busy)return;
  if(!confirm('Excluir somente deste aparelho? Se o envio já começou, o registro pode existir na nuvem. Esta ação não apaga registros do Cotar.'))return;
  try{await persist({...payload,pending:payload.pending.filter(row=>row.id!==button.dataset.delete)});render();tell('Registro local excluído.')}catch(error){tell(error.message)}
 });
 root.querySelectorAll('[data-retry]').forEach(button=>button.onclick=async()=>{
  if(syncing||busy)return;
  try{await persist({...payload,pending:payload.pending.map(row=>row.id===button.dataset.retry?{...row,state:'pending',error:''}:row)});await sync()}catch(error){tell(error.message)}
 });
}
async function sync() {
 if(syncing||busy||!payload||!key)return;
 if(!navigator.onLine){tell('Sem internet. Registros continuam neste aparelho.');return;}
 syncing=true;render();
 try {
  const sent=await synchronizePending(payload,api,persist);
  tell(`${sent} registro(s) confirmado(s) na nuvem. ${payload.pending.length} pendente(s).`);
 }catch(error){tell(error.status===401?'Entre no Cotar com o mesmo usuário para sincronizar. Seus registros foram preservados.':error.message)}
 finally{syncing=false;render()}
}
let reconnectTimer;
window.addEventListener('online',()=>{network();clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>{if(payload)void sync()},1000)});
window.addEventListener('offline',network);
window.addEventListener('pagehide',()=>{key=null;payload=null});
window.addEventListener('pageshow',event=>{if(event.persisted)repository.read().then(value=>{record=value;locked()}).catch(error=>tell(error.message))});
let hiddenAt=0;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)hiddenAt=Date.now();
 else if(hiddenAt&&Date.now()-hiddenAt>5*60*1000&&!syncing){locked();tell('Área bloqueada após inatividade.');}
});
async function start() {
 try {
  if(!globalThis.indexedDB||!globalThis.crypto?.subtle)throw Error('Este navegador não permite armazenamento protegido. Abra o Cotar no Safari atualizado.');
  db=await openOfflineDB();repository=vaultRepository(db);record=await repository.read();locked();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>tell('Não foi possível preparar a abertura offline. Conecte-se e tente novamente.'));
 }catch(error){root.innerHTML='<h1>Uso offline indisponível</h1><p>Abra o Cotar no Safari atualizado e permita o armazenamento do site.</p>';tell(error.message)}
}
void start();
