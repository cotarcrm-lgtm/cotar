export function profileIdentity(body,old){
 const nickname=body.nickname===undefined?(old.nickname||''):body.nickname;
 if(typeof nickname!=='string'||nickname.trim().length>40||/[\x00-\x1f\x7f]/.test(nickname))throw Error('O apelido deve ter até 40 caracteres, sem quebras de linha.');
 const photo=body.photo===undefined?(old.photo||''):body.photo;
 if(typeof photo!=='string'||photo.length>65000)throw Error('Foto muito grande ou inválida.');
 if(photo){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw Error('Formato da foto inválido. Anexe uma imagem pelo Meu perfil.');let bytes;try{bytes=atob(photo.slice(23))}catch{throw Error('Foto inválida.')}if(bytes.length<4||bytes.charCodeAt(0)!==255||bytes.charCodeAt(1)!==216||bytes.charCodeAt(2)!==255||bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)throw Error('Foto JPEG inválida.');}
 return {nickname:nickname.trim(),photo};
}
