import {customerStaticRoute} from '../public/customer-routes.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
// Local development only: never bind this bootstrap-enabled server publicly.
const port=Number(process.env.PORT||3000),origin=`http://localhost:${port}`;
fs.mkdirSync('.dev-data/files',{recursive:true});
const sql=new DatabaseSync('.dev-data/cotar.sqlite');
sql.exec('CREATE TABLE IF NOT EXISTS dev_migrations(name TEXT PRIMARY KEY)');
for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()){
 if(sql.prepare('SELECT 1 FROM dev_migrations WHERE name=?').get(name))continue;
 sql.exec(fs.readFileSync('drizzle/'+name,'utf8'));
 sql.prepare('INSERT INTO dev_migrations(name) VALUES (?)').run(name);
}
for(const name of ['schema.sql','management-auth.sql','management-recovery.sql','support-contact.sql']){
 const file='supabase/platform/'+name;if(!fs.existsSync(file))continue;
 const query=fs.readFileSync(file,'utf8').replaceAll('cotar.','').split('\n').filter(line=>!line.startsWith('ALTER TABLE')&&!line.startsWith('REVOKE')).join('\n');
 sql.exec(query);
}
sql.exec('PRAGMA foreign_keys=ON');
const DB={prepare(query){const statement=sql.prepare(query);let args=[];const api={bind(...values){args=values;return api},async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){return {meta:{changes:Number(statement.run(...args).changes)}}}};return api},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(await statement.run());sql.exec('COMMIT');return result}catch(error){sql.exec('ROLLBACK');throw error}}};
function filePath(key){const base=path.resolve('.dev-data/files'),resolved=path.resolve(base,key);if(!resolved.startsWith(base+path.sep))throw Error('Arquivo inválido');return resolved}
const PHOTOS={async put(key,bytes){const file=filePath(key);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)},async get(key){const file=filePath(key);return fs.existsSync(file)?{body:new Uint8Array(fs.readFileSync(file))}:null},async delete(key){fs.rmSync(filePath(key),{force:true})}};
await build({entryPoints:['server/index.js'],bundle:true,format:'esm',platform:'node',target:'node24',outfile:'.dev-data/backend.mjs'});
const {default:app}=await import('../.dev-data/backend.mjs');
const env={...process.env,DB,PHOTOS,ASAAS_ENVIRONMENT:process.env.ASAAS_ENVIRONMENT||'sandbox'};
const routes=p=>/^\/c\/[a-f0-9]{64}$/.test(p)?'/catalogue.html':/^\/q\/[a-f0-9]{64}/.test(p)?'/cotas.html':/^\/s\/[a-f0-9]{64}/.test(p)?'/used-catalogue.html':p==='/'?'/site.html':p==='/login'?'/index.html':p;
const types={'.webmanifest':'application/manifest+json','.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);let response;
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>30000000)throw Error('Arquivo muito grande');chunks.push(chunk)}
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
  // First-run owner initialization is allowed only on this loopback dev server.
  headers.set('oai-authenticated-user-email','admin@example.test');
  response=await app.fetch(new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);
 }else{
  const customerRoute=customerStaticRoute(url.pathname);if(customerRoute?.manifest){res.writeHead(200,{'Content-Type':'application/manifest+json'});res.end(JSON.stringify(customerRoute.manifest));return;}const name=customerRoute?.asset||routes(url.pathname);const file=path.resolve('public','.'+name),base=path.resolve('public');
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())response=new Response('Not found',{status:404});
  else response=new Response(req.method==='HEAD'?null:fs.readFileSync(file),{headers:{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-cache'}});
 }
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error(error.message);res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Erro no ambiente local. Consulte o terminal.'}))}
}).listen(port,'127.0.0.1',()=>console.log(`Cotar local: ${origin}/login · banco novo, sem dados de produção`));
