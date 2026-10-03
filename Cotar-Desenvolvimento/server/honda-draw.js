import {hondaSalesDashboard} from './honda-sales-dashboard.js';
import {deny} from './policy.js';
let cached=null;
export function latestFederal(payload){const list=Array.isArray(payload)?payload:[payload];const result=list.filter(r=>r?.loteria==='federal'&&Number.isInteger(r.concurso)).sort((a,b)=>b.concurso-a.concurso)[0];const prizes=result?.dezenasOrdemSorteio||result?.dezenas;if(!result||!Array.isArray(prizes)||prizes.length!==5||prizes.some(p=>!/^\d{5,6}$/.test(String(p))))throw Error('Resultado da Federal inválido.');return {concurso:result.concurso,data:result.data,prizes:prizes.map(String)};}
export async function federalResult(fetcher=fetch){if(cached&&Date.now()-cached.at<600000)return cached.value;const response=await fetcher('https://loteriascaixa-api.herokuapp.com/api/federal/latest',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('A Federal está indisponível. Tente atualizar novamente.');const value=latestFederal(await response.json());cached={at:Date.now(),value};return value;}
export async function hondaDraw(db,actor,method='GET',body={}){
 const dashboard=await hondaSalesDashboard(db,actor,{includeClients:true});const rows=dashboard.rows.filter(r=>String(r.status).trim().toUpperCase()==='NORMAL');
 const canConfigure=['Administrador','Diretor','Gerente Corporativo','Gerente Comercial','Gerente de Loja'].includes(actor.role);
 if(method==='PUT'){if(!canConfigure)deny('Sem permissão para configurar participantes.',403);const group=Number(body.group),participants=Number(body.participants);if(!Number.isSafeInteger(group)||!rows.some(r=>Number(r.grupo)===group)||!Number.isSafeInteger(participants)||participants<1||participants>1000000)deny('Revise o grupo e a quantidade de participantes.',400);await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT (key) DO UPDATE SET value=excluded.value').bind('honda_draw_group_'+group,String(participants)).run();return {ok:true};}
 const configurations=(await db.prepare("SELECT key,value FROM settings WHERE key LIKE 'honda_draw_group_%'").all()).results;const groups=new Set(rows.map(r=>Number(r.grupo)));const participants=Object.fromEntries(configurations.filter(r=>groups.has(Number(r.key.slice(17)))).map(r=>[r.key.slice(17),Number(r.value)]));
 let federal=null,error=null;try{federal=await federalResult();}catch(e){error=e.message;}
 return {rows,participants,canConfigure,federal,error};
}
