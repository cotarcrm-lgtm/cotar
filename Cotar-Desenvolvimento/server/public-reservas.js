import {centralScreenAllowed} from '../public/access-policy.js';
import {deny,unpack,permittedScreens} from './policy.js';
import {publicReservasRequest} from './reservas.js';
import {catalogueFor} from './consortium.js';
import {quotaCashPriceCents} from '../public/quota-cash-price.js';
const unavailable=()=>deny('Este catálogo de cotas não está disponível. Peça um novo link ao consultor.',404);
export async function quotaShareLink(db,actor){
 if(actor.status!=='Ativo'||!centralScreenAllowed(actor,'catalogo-cotas')||!permittedScreens(actor).some(s=>['leads','sales'].includes(s)))unavailable();
 const key='quota-share-owner:'+actor.id,existing=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
 if(existing)return JSON.parse(existing.value);
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
 const value=JSON.stringify({token,userId:actor.id,companyId:actor.companyId});
 try{await db.batch([db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind(key,value),db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').bind('quota-share:'+token,value)])}catch(e){const winner=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();if(winner)return JSON.parse(winner.value);throw e}
 return JSON.parse(value);
}
export async function publicQuotaCatalogue(db,env,token,{id,page,q,modelo,minParcela,maxParcela,linha,prazo,ordenar}){
 const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind('quota-share:'+token).first();if(!row)unavailable();
 const link=JSON.parse(row.value),user=await db.prepare('SELECT * FROM users WHERE id=? AND company_id=?').bind(link.userId,link.companyId).first();if(!user)unavailable();
 const actor=unpack(user);if(actor.status!=='Ativo'||!centralScreenAllowed(actor,'catalogo-cotas')||!permittedScreens(actor).some(s=>['leads','sales'].includes(s)))unavailable();
 const company=await db.prepare('SELECT * FROM companies WHERE id=?').bind(link.companyId).first();if(!company)unavailable();
 const result=await publicReservasRequest(env,{id,page,q,modelo,minParcela,maxParcela,linha,prazo,ordenar});
 const catalogue=await catalogueFor(db,unpack(company),actor);
 const price=row=>({...row,cashPriceCents:quotaCashPriceCents(row.modelo,catalogue.plans)});
 return {consultant:actor.nickname||actor.name?.split(' ')[0]||'Consultor',consultantPhone:actor.phone||'',company:unpack(company).name,modelImages:catalogue.modelImages,...result,...(id?{row:price(result.row)}:{rows:result.rows.map(price)})};
}
