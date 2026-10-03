import {deny} from './policy.js';
const cache=new Map();
export async function lookupCep(value,fetcher=globalThis.fetch.bind(globalThis)){
 const cep=String(value||'').replace(/\D/g,'');if(!/^\d{8}$/.test(cep))deny('Informe um CEP com 8 dígitos.',400);
 const cached=cache.get(cep);if(cached&&cached.until>Date.now())return cached.result;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetcher(`https://viacep.com.br/ws/${cep}/json/`,{signal:controller.signal,redirect:'manual'});
  if(!response.ok)deny('ViaCEP indisponível. Preencha o endereço manualmente ou tente novamente.',502);
  const body=await response.json();if(body?.erro===true||body?.erro==='true')deny('CEP não encontrado. Confira o número ou preencha o endereço manualmente.',404);
  if(!body||typeof body.localidade!=='string'||!body.localidade||typeof body.uf!=='string'||!/^[A-Z]{2}$/.test(body.uf))deny('O ViaCEP retornou um endereço inválido.',502);
  const result={postalCode:cep.slice(0,5)+'-'+cep.slice(5),street:typeof body.logradouro==='string'?body.logradouro.slice(0,200):'',neighborhood:typeof body.bairro==='string'?body.bairro.slice(0,100):'',city:body.localidade.slice(0,100),state:body.uf};
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(cep,{result,until:Date.now()+86400000});return result;
 }catch(error){if(error.status)throw error;deny(controller.signal.aborted?'O ViaCEP demorou para responder. Tente novamente ou preencha manualmente.':'Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.',502);}finally{clearTimeout(timer);}
}
