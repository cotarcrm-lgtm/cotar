const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function organizationFields(filters,lookups,attribute='data-filter',keys=['region','store','team','user']){
 const kinds={region:'regions',store:'stores',team:'teams',user:'users'},labels={region:'Regional',store:'Loja',team:'Equipe',user:'Vendedor'};
 const stores=lookups.stores||[],users=lookups.users||[],teams=lookups.teams||[],regions=lookups.regions||[];
 const records=[...users.map(u=>({region:stores.find(s=>s.id===u.storeId)?.regionId||u.regionId,store:u.storeId,team:teams.find(t=>t.id===u.teamId&&t.storeId===u.storeId)?.id,user:u.id})),...teams.filter(t=>!users.some(u=>u.teamId===t.id)).map(t=>({region:stores.find(s=>s.id===t.storeId)?.regionId,store:t.storeId,team:t.id})),...stores.filter(s=>!users.some(u=>u.storeId===s.id)&&!teams.some(t=>t.storeId===s.id)).map(s=>({region:s.regionId,store:s.id})),...regions.filter(r=>!stores.some(s=>s.regionId===r.id)).map(r=>({region:r.id}))];
 return keys.map(key=>{const available=new Set(records.filter(r=>['region','store','team','user'].every(k=>k===key||!filters[k]||r[k]===filters[k])).map(r=>r[key]));const rows=(lookups[kinds[key]]||[]).filter(r=>available.has(r.id));return `<label>${labels[key]}<select ${attribute}="${key}"><option value="">Todos</option>${rows.map(r=>`<option value="${escape(r.id)}" ${filters[key]===r.id?'selected':''}>${escape(r.nickname||r.name)}</option>`).join('')}</select></label>`}).join('');
}
export function installInternalFilters(root){
 const states=new Map();let serial=0;
 function scan(){for(const panel of root.querySelectorAll('.filters,.catalogue-filters,.reserva-toolbar,.capture-filters,.stock-filters,.stock-more-filters,.uc-filters,.uc-proposal-filters,.structure-filters,.structure-toolbar')){
 if(!panel.isConnected)continue;if(panel.matches('.stock-filters')){const extra=panel.nextElementSibling;if(extra?.matches('.stock-more-filters')){while(extra.firstChild)panel.append(extra.firstChild);extra.remove()}panel.querySelector('[data-stock-more]')?.remove()}
 if(panel.dataset.standardFilters||panel.closest('dialog,.stock-modal,.capture-review'))continue;
 panel.dataset.standardFilters='true';const key=location.hash+':'+panel.className,open=states.get(key)??false,id='internal-filter-'+(++serial);panel.id=panel.id||id;panel.classList.add('internal-filter-fields');panel.hidden=!open;
 const button=document.createElement('button');button.type='button';button.className='internal-filter-toggle';button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded',String(open));button.innerHTML='<span>Filtros</span><span class="internal-filter-indicator" aria-hidden="true">'+(open?'−':'+')+'</span>';panel.before(button);
 button.onclick=()=>{const expanded=button.getAttribute('aria-expanded')!=='true';states.set(key,expanded);button.setAttribute('aria-expanded',String(expanded));button.lastElementChild.textContent=expanded?'−':'+';panel.hidden=!expanded};
 const update=()=>{const active=[...panel.querySelectorAll('input,select')].filter(el=>el.value&&el.type!=='checkbox').length;button.firstElementChild.textContent='Filtros'+(active?' ('+active+')':'')};panel.addEventListener('change',update);panel.addEventListener('input',update);update();
 }}
 new MutationObserver(scan).observe(root,{childList:true,subtree:true});scan();
}
