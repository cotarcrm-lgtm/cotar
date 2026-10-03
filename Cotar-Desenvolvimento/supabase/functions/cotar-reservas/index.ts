import postgres from 'npm:postgres@3.4.7';
import {reservations} from './logic.js';
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:20,connect_timeout:10});
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const error=(message:string,status:number)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 try{
  const key=req.headers.get('x-cotar-reservas-key')||'';
  if(req.method!=='POST'||!/^[a-f0-9]{64}$/.test(key))return error('Acesso não autorizado.',401);
  const secret=await sql`SELECT value FROM cotar.settings WHERE key='reservas_proxy_sha256'`;
  if(!secret[0]?.value)return error('Integração não configurada.',503);
  const actual=await digest(key);let diff=0;for(let i=0;i<64;i++)diff|=actual.charCodeAt(i)^secret[0].value.charCodeAt(i);if(diff)return error('Acesso não autorizado.',401);
  const raw=await req.text();if(raw.length>15000)return error('Conteúdo muito grande.',413);
  const input=JSON.parse(raw);if(!['GET','PUT'].includes(input.method)||typeof input!=='object')return error('Requisição inválida.',400);
  return Response.json(await reservations(sql,input),{headers:{'Cache-Control':'no-store'}});
 }catch(e:any){const status=typeof e?.status==='number'?e.status:503;if(status===503)console.error('Reserva indisponível',e?.code||e?.name||'error');return error(status===503?'Não foi possível acessar as cotas. Tente novamente.':e.message,status)}
});
