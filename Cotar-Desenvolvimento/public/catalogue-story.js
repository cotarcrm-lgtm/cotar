import showroom from './story-showroom.js';
// Arte vertical gerada localmente, sem envio de foto ou contato a serviços externos.
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phoneLabel=value=>{const digits=String(value||'').replace(/\D/g,'');return digits.length===11?`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`:digits.length===10?`(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`:String(value||'').trim()};
const wrap=(ctx,value,maxWidth)=>{const words=String(value).trim().split(/\s+/),lines=[];let line='';for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);return lines};
const loadImage=src=>new Promise((resolve,reject)=>{if(!src){resolve(null);return}const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('A foto deste modelo não pôde ser carregada.'));image.src=src});
export async function makeCatalogueStory({model,photo,category,headline,detail,consultant,phone,company,quotaOffer}){
 const [img,background]=await Promise.all([loadImage(photo),quotaOffer?loadImage(showroom):Promise.resolve(null)]),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Seu navegador não conseguiu gerar a imagem.');
 ctx.fillStyle='#f5f5f2';ctx.fillRect(0,0,1080,1920);if(background)ctx.drawImage(background,0,0,1080,1920);
 ctx.fillStyle='#202124';ctx.fillRect(0,0,1080,248);ctx.fillStyle='#f2ca36';ctx.fillRect(72,70,88,8);
 ctx.fillStyle='#fff';ctx.font='700 56px Arial, sans-serif';ctx.fillText('COTAR',72,153);ctx.fillStyle='#c5c7ca';ctx.font='500 26px Arial, sans-serif';ctx.fillText('CONSÓRCIO HONDA  /  '+String(category||'CATÁLOGO').toUpperCase(),72,206);
 if(quotaOffer){
  // Faixa simples com espaço próprio para o título da moto.
  ctx.fillStyle='#202124';ctx.beginPath();ctx.roundRect(58,282,964,132,22);ctx.fill();
  ctx.font='700 58px Arial, sans-serif';ctx.textAlign='center';
  ctx.fillStyle='#fff';ctx.fillText('OFERTA EXCLUSIVA',540,367);ctx.textAlign='left';
  ctx.fillStyle='#60656b';ctx.font='700 24px Arial, sans-serif';ctx.fillText('COTA ELITE'+(quotaOffer.quota?'  ·  '+String(quotaOffer.quota).slice(0,25):''),72,463);
 }else{ctx.fillStyle='#202124';ctx.font='700 34px Arial, sans-serif';ctx.fillText('ENCONTRE SUA PRÓXIMA HONDA',72,339)}
 let titleSize=quotaOffer?62:76,lines;
 do{ctx.font=`800 ${titleSize}px Arial, sans-serif`;lines=wrap(ctx,model,936);if(lines.length<=2||titleSize<=48)break;titleSize-=4}while(true);
 ctx.fillStyle='#202124';lines.slice(0,3).forEach((line,i)=>ctx.fillText(line,72,(quotaOffer?548:435)+i*(quotaOffer?69:85)));
 const photoTop=quotaOffer?(lines.length>1?710:630):(lines.length>1?680:585),photoBottom=quotaOffer?1205:1300;if(!quotaOffer){ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(58,photoTop,964,photoBottom-photoTop,32);ctx.fill()}
 if(img){const maxWidth=860,maxHeight=photoBottom-photoTop-80,scale=Math.min(maxWidth/img.width,maxHeight/img.height);if(quotaOffer)ctx.globalCompositeOperation='multiply';ctx.drawImage(img,(1080-img.width*scale)/2,photoTop+(photoBottom-photoTop-img.height*scale)/2,img.width*scale,img.height*scale);if(quotaOffer)ctx.globalCompositeOperation='source-over'}else{ctx.fillStyle='#a3a6aa';ctx.font='600 34px Arial, sans-serif';ctx.textAlign='center';ctx.fillText('Imagem ilustrativa indisponível',540,(photoTop+photoBottom)/2);ctx.textAlign='left'}
 if(quotaOffer){
  ctx.fillStyle='rgba(245,245,242,0.93)';ctx.fillRect(0,1210,1080,450);
  const cash=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  ctx.fillStyle='#f2ca36';ctx.fillRect(58,1235,964,7);
  ctx.fillStyle='#60656b';ctx.font='700 25px Arial, sans-serif';ctx.fillText('MÉDIA DE LANCE',72,1291);
  ctx.fillStyle='#202124';ctx.font='800 48px Arial, sans-serif';ctx.fillText(cash(quotaOffer.averageBidCents),72,1350);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(58,1390,463,170,18);ctx.fill();
  ctx.fillStyle='#f2ca36';ctx.beginPath();ctx.roundRect(539,1390,483,170,18);ctx.fill();
  ctx.fillStyle='#60656b';ctx.font='700 22px Arial, sans-serif';ctx.fillText('PARCELA ATUAL',80,1440);
  ctx.fillStyle='#202124';ctx.fillText('APÓS O LANCE',560,1440);
  ctx.fillStyle='#50565b';ctx.font='800 46px Arial, sans-serif';ctx.fillText(cash(quotaOffer.currentInstallmentCents),80,1518);
  ctx.fillStyle='#202124';ctx.fillText(cash(quotaOffer.newInstallmentCents),560,1518);
  const reduction=Math.round(100*(1-quotaOffer.newInstallmentCents/quotaOffer.currentInstallmentCents));
  ctx.fillStyle='#6b7177';ctx.font='400 22px Arial, sans-serif';ctx.fillText('Parcela estimada com lance médio · redução de '+reduction+'% (máx. 30%).',72,1616);
 }else{ctx.fillStyle='#f2ca36';ctx.fillRect(58,1350,964,8);ctx.fillStyle='#202124';ctx.font='700 34px Arial, sans-serif';ctx.fillText(String(headline||'PLANO HONDA').toUpperCase(),72,1434);
 ctx.font='800 72px Arial, sans-serif';let detailLines=wrap(ctx,detail,936);if(detailLines.length>2){ctx.font='700 52px Arial, sans-serif';detailLines=wrap(ctx,detail,936)}detailLines.slice(0,2).forEach((line,i)=>ctx.fillText(line,72,1520+i*78));}
 ctx.fillStyle='#202124';ctx.fillRect(0,1660,1080,260);ctx.fillStyle='#f2ca36';ctx.fillRect(72,1722,6,120);ctx.fillStyle='#fff';ctx.font='700 40px Arial, sans-serif';ctx.fillText(String(consultant).slice(0,36),104,1754);ctx.font='600 35px Arial, sans-serif';ctx.fillText('WhatsApp  '+phoneLabel(phone),104,1814);ctx.fillStyle='#aeb3b8';ctx.font='400 22px Arial, sans-serif';ctx.fillText(String(company||'').slice(0,58),104,1862);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Não foi possível salvar a imagem.')),'image/png'));
}
export function openCatalogueStory({model,photo,category,headline,detail,quotaOffer=null,consultant='',phone='',company=''}){
 const dialog=document.createElement('dialog');dialog.className='story-dialog';dialog.innerHTML=`<form class="story-form"><button type="button" class="story-close" aria-label="Fechar">×</button><p class="story-eyebrow">COTAR / PUBLICAÇÃO</p><h2>Imagem para stories</h2><p>Formato 9:16 · 1080 × 1920 px</p><div class="story-fields"><label>Nome do vendedor<input name="consultant" maxlength="36" required value="${escapeHtml(consultant)}"></label><label>WhatsApp com DDD<input name="phone" type="tel" inputmode="tel" maxlength="20" required value="${escapeHtml(phone)}" placeholder="(00) 00000-0000"></label></div><button class="btn" type="submit">Gerar imagem</button><p class="story-status" role="status"></p><div class="story-preview" hidden><img alt="Prévia da imagem vertical para redes sociais"><div class="story-actions"><a class="btn" download="" href="">Baixar PNG</a><button type="button" class="btn secondary" data-story-share hidden>Compartilhar</button></div></div></form>`;document.body.append(dialog);let objectUrl;const status=dialog.querySelector('.story-status'),form=dialog.querySelector('form');dialog.querySelector('.story-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);dialog.remove()},{once:true});form.onsubmit=async event=>{event.preventDefault();const name=form.elements.consultant.value.trim(),contact=form.elements.phone.value.trim();if(contact.replace(/\D/g,'').length<10){status.textContent='Informe um WhatsApp com DDD.';return}const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Gerando imagem…';try{const blob=await makeCatalogueStory({model,photo,category,headline,detail,quotaOffer,consultant:name,phone:contact,company});if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);const preview=dialog.querySelector('.story-preview'),filename='cotar-'+String(model).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-story.png';preview.hidden=false;preview.querySelector('img').src=objectUrl;const download=preview.querySelector('a');download.href=objectUrl;download.download=filename;const share=preview.querySelector('[data-story-share]');const file=new File([blob],filename,{type:'image/png'});share.hidden=!navigator.canShare?.({files:[file]});share.onclick=async()=>{try{await navigator.share({files:[file],title:model})}catch(error){if(error.name!=='AbortError')status.textContent='Não foi possível compartilhar. Use Baixar PNG.'}};status.textContent='Imagem pronta para baixar.'}catch(error){status.textContent=error.message}finally{button.disabled=false}};dialog.showModal();
}
