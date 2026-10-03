import {hondaSalesDashboard} from './honda-sales-dashboard.js';
import {deny} from './policy.js';
import {walletEligible} from '../public/honda-wallet.js';
const stateKey=id=>'honda_wallet_'+id;
const readState=value=>{try{return JSON.parse(value||'{}');}catch{return {};}};
export async function hondaWallet(db,env,actor,method,id='',body={}){
 const data=await hondaSalesDashboard(db,actor,{includeClients:true}),rows=data.rows.filter(walletEligible);
 if(method==='GET'&&!id){const keys=rows.map(r=>stateKey(r.id));const saved=keys.length?(await db.prepare(`SELECT key,value FROM settings WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all()).results:[];const states=new Map(saved.map(r=>[r.key,readState(r.value)]));return {rows:rows.map(r=>({...r,followup:states.get(stateKey(r.id))||{}})),updatedAt:data.updatedAt,canWrite:actor.readOnlyCompany!==true};}
 const row=rows.find(r=>String(r.id)===String(id));if(!row)deny('Cliente fora da carteira ou do seu acesso.',404);
 const saved=await db.prepare('SELECT value FROM settings WHERE key=?').bind(stateKey(id)).first(),state=readState(saved?.value);
 if(method==='GET'){if(!state.boleto?.key||!env.PHOTOS)deny('Boleto indisponível.',404);const object=await env.PHOTOS.get(state.boleto.key);if(!object)deny('Boleto indisponível.',404);return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(state.boleto.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 if(method!=='PUT')deny('Método não permitido.',405);if(actor.readOnlyCompany)deny('Acesso somente para consulta.',403);
 if((body.version||'')!==(state.updatedAt||''))deny('Outro usuário atualizou esse acompanhamento. Atualize a carteira antes de salvar.',409);
 const next={...state,updatedAt:new Date().toISOString(),updatedBy:actor.id};
 if(body.stage!==undefined){if(!['pending','needs-boleto','boleto-sent','paid'].includes(body.stage))deny('Situação de acompanhamento inválida.',400);next.stage=body.stage;}
 if(body.cpf!==undefined){if(typeof body.cpf!=='string')deny('CPF inválido.',400);const cpf=body.cpf.replace(/\D/g,'');if(cpf){if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))deny('CPF inválido.',400);for(let length=9;length<=10;length++){let sum=0;for(let i=0;i<length;i++)sum+=Number(cpf[i])*(length+1-i);const digit=(sum*10)%11%10;if(digit!==Number(cpf[length]))deny('CPF inválido. Confira os números.',400);}}next.cpf=cpf;}
 if(body.notes!==undefined){if(typeof body.notes!=='string'||body.notes.length>2000)deny('Use até 2.000 caracteres nas observações.',400);next.notes=body.notes.trim();}
 if(body.deadline!==undefined){if(body.deadline!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(body.deadline)||!Number.isFinite(Date.parse(body.deadline+'T00:00:00Z'))||new Date(body.deadline+'T00:00:00Z').toISOString().slice(0,10)!==body.deadline))deny('Prazo inválido.',400);next.deadline=body.deadline;}
 if(body.boleto){const b=body.boleto;if(typeof b.name!=='string'||b.name.length>180||typeof b.data!=='string'||b.data.length>7000000)deny('Anexe um PDF de até 5 MB.',400);const match=b.data.match(/^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)deny('Use um arquivo PDF.',400);let bytes;try{bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));}catch{deny('PDF inválido.',400);}if(bytes.length>5*1024*1024||!String.fromCharCode(...bytes.slice(0,5)).startsWith('%PDF-'))deny('PDF inválido ou maior que 5 MB.',400);if(!env.PHOTOS)deny('Armazenamento indisponível.',503);const key=`honda-wallet/${id}/${crypto.randomUUID()}.pdf`;await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});next.boleto={key,name:b.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,180),size:bytes.length};}
 try{const result=saved?await db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?').bind(JSON.stringify(next),stateKey(id),saved.value).run():await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(stateKey(id),JSON.stringify(next)).run();if(!result.meta.changes)deny('O acompanhamento mudou durante o salvamento. Atualize a carteira.',409);}catch(error){if(next.boleto?.key!==state.boleto?.key&&env.PHOTOS?.delete)await env.PHOTOS.delete(next.boleto.key);throw error;}
 return {followup:next};
}
