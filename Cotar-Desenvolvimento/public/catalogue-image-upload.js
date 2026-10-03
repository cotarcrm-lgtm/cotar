export async function prepareCatalogueImage(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Escolha uma imagem PNG, JPG ou WebP.');
 if(file.size>8_000_000)throw Error('A foto deve ter até 8 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,860/bitmap.width,550/bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  let imageData=canvas.toDataURL('image/webp',0.82);
  if(imageData.length>340000)imageData=canvas.toDataURL('image/webp',0.65);
  if(imageData.length>340000)throw Error('A foto ficou muito grande. Escolha outra imagem.');
  return imageData;
 }finally{bitmap.close()}
}
