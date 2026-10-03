import {mountReservas} from './reservas-screen.js';
import {installCurrencyInputs} from './currency-input.js';
installCurrencyInputs();
const parts=location.pathname.split('/').filter(Boolean),token=parts[1],id=parts[2];
const root=document.querySelector('#public-cotas');
const api=async(path)=>{const url=new URL('/api/public/reservas/'+token+(id?'/'+id:''),location.origin);if(!id){const params=new URLSearchParams(path.split('?')[1]||'');url.search=params.toString()}const response=await fetch(url);const data=await response.json();if(!response.ok)throw Error(data.error||'Catálogo indisponível.');return id?{rows:[data.row],total:1,page:1,pageSize:24,models:[data.row.modelo],consultant:data.consultant,consultantPhone:data.consultantPhone,company:data.company,modelImages:data.modelImages}:data};
mountReservas(root,{api,mode:'catalogo',publicView:true,individualId:id,shareUrl:location.origin+'/q/'+token});
