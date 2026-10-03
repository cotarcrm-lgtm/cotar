import {normalizeRole} from '../public/config.js';
import {deny,permittedScreens} from './policy.js';
const editors=new Set(['Administrador','Diretor','Gerente Regional','Gerente de Loja','Administrativo']);
export async function reservasRequest(req,env,actor,url){
 const screens=permittedScreens(actor),canEdit=editors.has(normalizeRole(actor.role))&&screens.includes('sales');
 if(!screens.includes('leads')&&!screens.includes('sales'))deny('Esta tela não está liberada para seu usuário.');
 if(!env.COTAR_RESERVAS_URL||!env.COTAR_RESERVAS_KEY)deny('Catálogo de cotas indisponível.',503);
 const id=url.pathname.match(/^\/api\/reservas\/(\d+)$/)?.[1],groups=url.pathname==='/api/reservas/grupos';
 if(!['GET','PUT'].includes(req.method)||req.method==='PUT'&&!id)deny('Método não permitido.',405);
 if(req.method==='PUT'&&!canEdit)deny('Seu cargo não pode editar cotas.');
 const query=url.searchParams,mode=groups?'grupos':id?'gestao':query.get('mode')||'catalogo';
 if(!['catalogo','gestao','grupos'].includes(mode))deny('Consulta inválida.',400);
 if(mode!=='catalogo'&&!canEdit)deny('Seu cargo não pode acessar a gestão de cotas.');
 const raw=req.method==='PUT'?await req.text():'';if(raw.length>15000)deny('Conteúdo muito grande.',413);
 let body;try{body=raw?JSON.parse(raw):undefined}catch{deny('Dados inválidos.',400)}
 const response=await fetch(env.COTAR_RESERVAS_URL,{method:'POST',headers:{'Content-Type':'application/json','x-cotar-reservas-key':env.COTAR_RESERVAS_KEY},body:JSON.stringify({method:req.method,mode,page:query.get('page')||1,q:query.get('q')||'',produto:query.get('produto')||'',parcelasRestantes:query.get('parcelasRestantes'),modelo:query.get('modelo')||'',minParcela:query.get('minParcela')||'',maxParcela:query.get('maxParcela')||'',linha:query.get('linha')||'',prazo:query.get('prazo')||'',ordenar:query.get('ordenar')||'recent',dataReserva:query.get('dataReserva')||'',loja:query.get('loja')||'',id,body})});
 const result=await response.text();return new Response(result,{status:response.status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}

export async function publicReservasRequest(env,{id,page=1,q='',modelo='',minParcela='',maxParcela='',linha='',prazo='',ordenar='recent'}){
 if(!env.COTAR_RESERVAS_URL||!env.COTAR_RESERVAS_KEY)deny('Catálogo de cotas indisponível.',503);
 const response=await fetch(env.COTAR_RESERVAS_URL,{method:'POST',headers:{'Content-Type':'application/json','x-cotar-reservas-key':env.COTAR_RESERVAS_KEY},body:JSON.stringify({method:'GET',mode:id?'item':'catalogo',id,page,q,modelo,minParcela,maxParcela,linha,prazo,ordenar})});
 const data=await response.json();if(!response.ok)deny(data.error||'Catálogo indisponível.',response.status);
 const publicKeys=['usuario_reserva','id','loja','cota','modelo','valor_parcela','valor_parcela_2','data_reserva','dia_vencimento','parcelas_restantes','prazo','produto','modelos_disponiveis','media_percentual','grupo','status_reposicao'];
 const project=row=>Object.fromEntries(publicKeys.map(key=>[key,row[key]]));
 return id?{row:project(data.row)}:{rows:data.rows.map(project),total:data.total,page:data.page,pageSize:data.pageSize,models:data.models,lines:data.lines,terms:data.terms};
}
