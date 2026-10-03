import {mountUsedCatalogue} from './used-catalogue.js';
const match=location.pathname.match(/^\/s\/([a-f0-9]{64})(?:\/([a-z0-9-]+))?$/);
const root=document.querySelector('#used-public-root');
if(!match)root.textContent='Link de catálogo inválido.';
else{
 const [,token,vehicleId]=match;
 const api=async(path,options={})=>{const tail=path.slice('used-catalogue'.length);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.method==='POST'?60000:20000);try{const res=await fetch('/api/public/used/'+token+tail,{...options,headers:{'Content-Type':'application/json'},signal:controller.signal});const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível concluir a solicitação.');return data}catch(e){if(controller.signal.aborted)throw Error('A solicitação demorou. Tente novamente.');throw e}finally{clearTimeout(timer)}};
 mountUsedCatalogue(root,{api,token,vehicleId,publicMode:true});
}
