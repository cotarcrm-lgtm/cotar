import {installCurrencyInputs} from './currency-input.js';
import {mountCatalogue} from './catalogue-screen.js';
installCurrencyInputs();
const root=document.querySelector('#public-catalogue'),token=location.pathname.split('/')[2];
async function api(suffix='',body){const response=await fetch('/api/public/catalogue/'+encodeURIComponent(token)+suffix,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});let result;try{result=await response.json()}catch{throw Error('Não foi possível acessar o catálogo. Tente novamente.')}if(!response.ok)throw Error(result.error||'Não foi possível concluir.');return result}
try{const data=await api();document.title='Catálogo · '+data.consultant;mountCatalogue(root,{...data,capture:body=>api('/leads',body)});}catch(e){root.innerHTML='<div class="panel empty"><h1>Catálogo indisponível</h1><p role="alert"></p><button class="btn">Tentar novamente</button></div>';root.querySelector('p').textContent=e.message;root.querySelector('button').onclick=()=>location.reload()}
