const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const chartDownloadButton=title=>`<button type="button" class="chart-download" data-chart-download title="Baixar imagem de ${esc(title)}" aria-label="Baixar imagem de ${esc(title)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg></button>`;
export async function downloadChart(panel,{context='',render,save,at=new Date()}={}){
 const title=panel.querySelector('h2')?.textContent||'Gráfico';
 await document.fonts?.ready;
 render||=(await import('./html2canvas.js')).default;
 const capturedAt=at.toLocaleString('pt-BR',{timeZone:'America/Bahia'});
 const canvas=await render(panel,{backgroundColor:'#ffffff',scale:2,useCORS:true,logging:false,ignoreElements:el=>el.hasAttribute('data-chart-download'),onclone:(doc,clone)=>{
  clone.style.height='auto';clone.style.maxHeight='none';clone.style.overflow='visible';
  const footer=doc.createElement('div');footer.textContent=`COTAR · ${context} · Capturado em ${capturedAt}`;footer.style.cssText='font:12px Arial,sans-serif;color:#647180;line-height:1.5;border-top:1px solid #e4e8ed;margin-top:16px;padding-top:12px;overflow-wrap:anywhere';clone.append(footer);
 }});
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Não foi possível gerar a imagem. Tente novamente.');
 const filename='cotar-'+title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+at.toISOString().replace(/[:.]/g,'-')+'.png';
 if(save){await save(blob,filename);return;}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
