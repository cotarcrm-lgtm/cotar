const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const fields={loja:120,cota:80,modelo:200,status_reposicao:100,usuario_reserva:120,produto:120,modelos_disponiveis:4000,grupo:120};
const numberFields={valor_parcela:[0,10000000],valor_parcela_2:[0,10000000],dia_vencimento:[1,31],parcelas_restantes:[0,500],prazo:[1,500],media_percentual:[0,1]};
export function validateReserva(body){
 const values={};for(const [key,max] of Object.entries(fields)){const v=String(body[key]??'').trim();if((key!=='grupo'&&!v)||v.length>max)fail('Revise o campo '+key.replaceAll('_',' ')+'.');values[key]=v||null;}
 for(const [key,[min,max]] of Object.entries(numberFields)){const raw=body[key];if(key==='media_percentual'&&(raw===null||raw===''||raw===undefined)){values[key]=null;continue}const v=Number(raw);if(raw===''||raw===null||raw===undefined||!Number.isFinite(v)||v<min||v>max||(['dia_vencimento','parcelas_restantes','prazo'].includes(key)&&!Number.isInteger(v)))fail('Revise o campo '+key.replaceAll('_',' ')+'.');values[key]=v;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body.data_reserva||'')||Number.isNaN(Date.parse(body.data_reserva+'T12:00:00Z')))fail('Data da reserva inválida.');values.data_reserva=body.data_reserva;
 if(!['Reservado','Reservado Digitado'].includes(values.status_reposicao))fail('Selecione um status válido.');
 if(!Number.isInteger(body.revisao)||body.revisao<1)fail('Atualize a página antes de salvar.',409);
 return values;
}
const planKey=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9+]/g,'');
const columns=['id','loja','cota','modelo','valor_parcela','dia_vencimento','data_reserva','status_reposicao','usuario_reserva','parcelas_restantes','valor_parcela_2','prazo','produto','modelos_disponiveis','data_de_inclusao','media_percentual','grupo','revisao','editado_em'];
export async function reservations(sql,{method='GET',mode='catalogo',page=1,q='',id,body,produto,parcelasRestantes,modelo='',minParcela='',maxParcela='',dataReserva='',loja='',linha='',prazo='',ordenar='recent'}){
 if(method==='PUT'){
  const n=Number(id);if(!Number.isSafeInteger(n)||n<=0)fail('Reserva inválida.');const values=validateReserva(body||{}),keys=Object.keys(values);
  if(values.grupo){if(!/^\d{1,10}$/.test(values.grupo))fail('Selecione um grupo apto da planilha.');const group=await sql.unsafe("SELECT grupo,nome_plano,parcelas_restantes FROM cotar.grupos_consorcio_honda WHERE grupo=$1 AND situacao='Aptos'",[Number(values.grupo)]);if(!group.length||planKey(group[0].nome_plano)!==planKey(values.produto)||Number(group[0].parcelas_restantes)!==values.parcelas_restantes)fail('Escolha um grupo apto do mesmo plano e com a mesma quantidade de parcelas restantes.');}
  const update=await sql.unsafe(`UPDATE public.reservas r SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},revisao=revisao+1,editado_em=now() WHERE r.id=$${keys.length+1} AND r.revisao=$${keys.length+2} AND NOT EXISTS (SELECT 1 FROM public.reservas newer WHERE newer.loja=r.loja AND newer.cota=r.cota AND (newer.data_de_inclusao,newer.id)>(r.data_de_inclusao,r.id)) RETURNING ${columns.join(',')}`,[...Object.values(values),n,body.revisao]);
  if(!update.length)fail('Esta cota mudou ou existe uma coleta mais recente. Atualize a lista.',409);return {row:update[0]};
 }
 if(method!=='GET')fail('Método não permitido.',405);
 if(mode==='grupos'){
  const plan=planKey(produto),remaining=Number(parcelasRestantes);
  if(!plan||plan.length>80||!Number.isInteger(remaining)||remaining<0||remaining>500)fail('Informe o plano e as parcelas restantes da cota.');
  const term=String(q||'').trim().slice(0,60),pattern='%'+term.replace(/[\\%_]/g,'\\$&')+'%';
  const groups=await sql.unsafe("SELECT grupo,situacao,nome_plano,prazo,parcelas_restantes,media_julho,media_agosto FROM cotar.grupos_consorcio_honda WHERE situacao='Aptos' AND lower(regexp_replace(nome_plano,'[^a-zA-Z0-9+]','','g'))=$1 AND parcelas_restantes=$2 AND ($3='' OR grupo::text ILIKE $4 ESCAPE '\\') ORDER BY grupo DESC LIMIT 40",[plan,remaining,term,pattern]);return {groups:Array.from(groups)};
 }
 if(id){const n=Number(id);if(!Number.isSafeInteger(n)||n<=0||!['gestao','item'].includes(mode))fail('Reserva inválida.');const rows=await sql.unsafe(`SELECT ${columns.map(c=>'r.'+c).join(',')} FROM public.reservas r WHERE r.id=$1 ${mode==='item'?"AND r.status_reposicao='Reservado' AND r.media_percentual IS NOT NULL":''} AND NOT EXISTS (SELECT 1 FROM public.reservas newer WHERE newer.loja=r.loja AND newer.cota=r.cota AND (newer.data_de_inclusao,newer.id)>(r.data_de_inclusao,r.id))`,[n]);if(!rows.length)fail('Coleta mais recente não encontrada.',404);return {row:rows[0]};}
 if(!['catalogo','gestao'].includes(mode))fail('Consulta inválida.');
 const pageNo=Math.max(1,Math.min(1000,Number(page)||1)),term=String(q||'').trim().slice(0,80),model=String(modelo||'').trim().slice(0,200);
 const min=minParcela===''||minParcela==null?null:Number(minParcela),max=maxParcela===''||maxParcela==null?null:Number(maxParcela);
 const remaining=prazo===''||prazo==null?null:Number(prazo),line=String(linha||'').trim(),store=String(loja||'').trim();if(line.length>120||store.length>200)fail('Confira os filtros.');
 if(mode==='catalogo'&&((remaining!=null&&(!Number.isInteger(remaining)||remaining<0||remaining>500))||line.length>120||!['recent','price','price_desc','model','bid'].includes(ordenar)))fail('Confira os filtros do catálogo.');
 if(dataReserva){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dataReserva);if(!match||new Date(Date.UTC(+match[1],+match[2]-1,+match[3])).toISOString().slice(0,10)!==dataReserva)fail('Data da reserva inválida.');}
 if((min!=null&&(!Number.isFinite(min)||min<0||min>10000000))||(max!=null&&(!Number.isFinite(max)||max<0||max>10000000))||(min!=null&&max!=null&&min>max))fail('Confira o intervalo de parcelas.');
 const latest=`FROM (SELECT DISTINCT ON (loja,cota) ${columns.join(',')} FROM public.reservas ORDER BY loja,cota,data_de_inclusao DESC,id DESC) r`;
 const availability="r.status_reposicao='Reservado' AND r.media_percentual IS NOT NULL";
 const bind=[],conditions=[];
 conditions.push(mode==='catalogo'?availability:"r.status_reposicao='Reservado'");
 if(mode==='gestao'&&dataReserva){bind.push(dataReserva);conditions.push(`r.data_reserva=$${bind.length}`)}
 if(mode==='gestao'&&store){bind.push(store);conditions.push(`r.loja=$${bind.length}`)}
 if(term){bind.push('%'+term.replace(/[\\%_]/g,'\\$&')+'%');const n=bind.length;conditions.push(`(r.modelo ILIKE $${n} ESCAPE '\\' OR r.cota ILIKE $${n} ESCAPE '\\' OR r.loja ILIKE $${n} ESCAPE '\\' OR r.produto ILIKE $${n} ESCAPE '\\')`)}
 if(mode==='catalogo'&&model){bind.push(model);conditions.push(`r.modelo=$${bind.length}`)}
 if(line){bind.push(line);conditions.push(`r.produto=$${bind.length}`)}
 if(mode==='catalogo'&&remaining!=null){bind.push(remaining);conditions.push(`r.parcelas_restantes=$${bind.length}`)}
 if(mode==='catalogo'&&min!=null){bind.push(min);conditions.push(`r.valor_parcela_2 >= $${bind.length}`)}
 if(mode==='catalogo'&&max!=null){bind.push(max);conditions.push(`r.valor_parcela_2 <= $${bind.length}`)}
 const base=`${latest} WHERE ${conditions.length?conditions.join(' AND '):'1=1'}`;
 const count=await sql.unsafe(`SELECT count(*)::int AS total ${base}`,bind);
 const order=mode==='gestao'?'r.data_de_inclusao ASC NULLS LAST,r.id ASC':{recent:'r.data_de_inclusao DESC NULLS LAST,r.id DESC',price:'r.valor_parcela_2 ASC,r.id DESC',price_desc:'r.valor_parcela_2 DESC,r.id DESC',model:'r.modelo ASC,r.valor_parcela_2 ASC,r.id DESC',bid:'(r.valor_parcela*r.prazo*r.media_percentual) ASC,r.id DESC'}[ordenar];
 const rows=await sql.unsafe(`SELECT ${columns.map(c=>'r.'+c).join(',')} ${base} ORDER BY ${order} LIMIT 24 OFFSET $${bind.length+1}`,[...bind,(pageNo-1)*24]);
 const facet=async(column,own)=>{const clauses=conditions.filter(c=>!c.startsWith(own));const used=[...new Set(clauses.flatMap(c=>[...c.matchAll(/\$(\d+)/g)].map(m=>Number(m[1]))))];const query=clauses.join(' AND ').replace(/\$(\d+)/g,(_,n)=>'$'+(used.indexOf(Number(n))+1));return sql.unsafe(`SELECT DISTINCT r.${column} ${latest} WHERE ${query||'1=1'} ORDER BY r.${column}`,used.map(n=>bind[n-1]));};
 const models=mode==='catalogo'?await facet('modelo','r.modelo='):[];
 const lines=await facet('produto','r.produto=');
 const stores=mode==='gestao'?await facet('loja','r.loja='):[];
 const terms=mode==='catalogo'?await facet('parcelas_restantes','r.parcelas_restantes='):[];
 return {rows:Array.from(rows),total:count[0]?.total||0,page:pageNo,pageSize:24,stores:stores.map(row=>row.loja).filter(Boolean),models:models.map(row=>row.modelo),lines:lines.map(row=>row.produto),terms:terms.map(row=>row.parcelas_restantes)};
}
