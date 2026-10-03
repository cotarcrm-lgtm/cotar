const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function documentStatus(doc,slot,label,state={}){
 const ready=doc?`${doc.url?`<a href="${esc(doc.url)}" download="${esc(doc.name)}" class="document-download">Baixar ${esc(doc.name)}</a>`:`<span>${esc(doc.name)} · pronto para salvar</span>`}<button type="button" class="link" data-remove-sale-document="${esc(slot)}" aria-label="Remover ${esc(label)}">Remover</button>`:'<small>Nenhum arquivo anexado</small>';
 if(state.phase==='reading'||state.phase==='sending')return `<span class="sale-upload-indicator"><i aria-hidden="true"></i>${state.phase==='reading'?'Preparando':'Enviando'} ${esc(state.name||doc?.name||'documento')}…${Number.isFinite(state.percent)?' '+state.percent+'%':''}</span><progress max="100" ${Number.isFinite(state.percent)?`value="${state.percent}"`:''} aria-label="Progresso do arquivo"></progress>`;
 return ready+(state.error?`<small class="sale-upload-error" role="alert">${esc(state.error)}</small>`:'');
}
export function setSaleDocumentSending(root,documents,sending,error=''){
 for(const card of root.querySelectorAll('.sale-document')){const input=card.querySelector('[data-sale-document]'),doc=documents.find(d=>d.slot===input?.dataset.saleDocument);if(!doc?.data)continue;const status=card.querySelector('.sale-document-status');if(status)status.innerHTML=documentStatus(doc,input.dataset.saleDocument,input.getAttribute('aria-label'),sending?{phase:'sending',name:doc.name}:{error});card.setAttribute('aria-busy',String(sending));}
}
export function installSaleDocumentUploads({root=document,getEditor,isBusy=()=>false,onBusy=()=>{},toast=()=>{}}){let reading=false;
 async function change(e){const input=e.target,slot=input.dataset?.saleDocument,editor=getEditor();if(!slot||editor?.kind!=='sales')return;const file=input.files?.[0];if(!file)return;
 if(reading||isBusy()){toast('Aguarde a preparação ou o envio atual.');input.value='';return;}
 const card=input.closest('.sale-document'),status=card?.querySelector('.sale-document-status');if(!card||!status){toast('Não foi possível preparar o documento. Reabra a venda.');return;}
 const old=editor.row.documents?.find(d=>d.slot===slot),label=input.getAttribute('aria-label');
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024||!file.size){status.innerHTML=documentStatus(old,slot,label,{error:'Selecione PDF, JPG, PNG ou WebP de até 2 MB.'});input.value='';return;}
 reading=true;onBusy(true);card.setAttribute('aria-busy','true');const controls=[...input.closest('form').querySelectorAll('input[type=file],[data-remove-sale-document],button[type=submit],[data-action=save]')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);
 status.innerHTML=documentStatus(old,slot,label,{phase:'reading',name:file.name,percent:0});
 try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onprogress=ev=>{if(status.isConnected&&ev.lengthComputable)status.innerHTML=documentStatus(old,slot,label,{phase:'reading',name:file.name,percent:Math.round(ev.loaded/ev.total*100)});};reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo. Selecione-o novamente.'));reader.onabort=()=>reject(new Error('Leitura interrompida. Selecione o arquivo novamente.'));reader.readAsDataURL(file);});if(getEditor()!==editor)return;editor.row.documents=(editor.row.documents||[]).filter(d=>d.slot!==slot);const doc={slot,name:file.name.slice(0,180),data};editor.row.documents.push(doc);if(card.isConnected){status.innerHTML=documentStatus(doc,slot,label);card.classList.add('has-document');card.querySelector('.attachment-picker>span').textContent='Substituir arquivo';input.setAttribute('aria-label','Substituir '+label.replace(/^(Anexar|Substituir) /,''));}}
 catch(error){if(getEditor()===editor&&status.isConnected)status.innerHTML=documentStatus(old,slot,label,{error:error.message});}
 finally{reading=false;onBusy(false);card.setAttribute('aria-busy','false');controls.forEach(([el,disabled])=>el.disabled=disabled);input.value='';}
 }
 root.addEventListener('change',change);return ()=>root.removeEventListener('change',change);
}
