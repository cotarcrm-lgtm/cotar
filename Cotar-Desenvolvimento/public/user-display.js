const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const displayName=u=>u?.nickname?.trim()||u?.name?.trim().split(/\s+/)[0]||'Usuário';
export function avatarContent(u){return typeof u?.photo==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(u.photo)?`<img src="${u.photo}" alt="Foto de ${esc(displayName(u))}">`:esc(displayName(u).slice(0,2).toUpperCase());}
export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
 if(file.size>10*1024*1024)throw Error('A foto deve ter no máximo 10 MB.');
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);const size=Math.min(img.naturalWidth,img.naturalHeight);if(!size)throw Error();ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,256,256);const photo=canvas.toDataURL('image/jpeg',0.82);if(photo.length>65000)throw Error('Não foi possível reduzir a foto. Escolha uma imagem menor.');return photo;}catch(e){throw Error(e.message?.includes('reduzir')?e.message:'Não foi possível abrir essa foto. Escolha outra imagem.');}finally{URL.revokeObjectURL(url);}
}
