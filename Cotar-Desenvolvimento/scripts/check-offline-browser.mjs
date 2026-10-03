const {chromium}=await import(process.env.COTAR_PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.COTAR_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Bahia'});
const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('requestfailed',request=>console.log('FAILED REQUEST:',new URL(request.url()).pathname,request.failure()?.errorText));
const base=process.env.COTAR_TEST_BASE||'http://localhost:3003';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('This test must use an empty local test database, never production.');
try {
 const status=await (await context.request.get(base+'/api/auth/status')).json();
 const password='T!'+crypto.randomUUID();
 if(status.setupRequired){const boot=await context.request.post(base+'/api/auth/setup',{headers:{Origin:base},data:{company:'Teste mobile local',name:'Administrador de testes',cpf:'52998224725',password}});assert.equal(boot.status(),201,await boot.text());}
 else throw Error('Use a fresh local test database for browser verification.');
 await page.goto(base+'/offline.html');
 await page.getByLabel('Crie seu código offline').fill('84726195');
 await page.getByLabel('Repita o código').fill('84726195');
 await page.getByRole('button',{name:'Baixar dados para uso offline'}).click();
 await page.getByRole('button',{name:'Bloquear',exact:true}).waitFor();
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 assert.ok(await page.locator('.cards article').count()>0);
 const cacheKeys=await page.evaluate(async()=>{const names=await caches.keys();return (await Promise.all(names.map(async name=>(await (await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)))).flat()});
 assert.ok(!cacheKeys.some(path=>path.startsWith('/api/')));
 const revisionCheck=await page.evaluate(async()=>{
  const {openOfflineDB,vaultRepository}=await import('/offline-store.js');const db=await openOfflineDB();
  try{const repository=vaultRepository(db),record=await repository.read();let conflict=false;try{await repository.write({...record,revision:record.revision+1},record.revision-1)}catch{conflict=true}return conflict}finally{db.close()}
 });assert.equal(revisionCheck,true);
 console.log('PASS: snapshot preparation, catalogue consultation, public-only service worker cache and concurrent-write protection');
 await context.setOffline(true);
 await page.goto(base+'/login');
 await page.getByLabel('Código offline (8 a 12 números)').fill('84726195');
 await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await page.getByRole('button',{name:'Novo lead',exact:true}).click();
 await page.getByLabel('Nome *',{exact:true}).fill('Contato sem conexão');
 await page.getByLabel('Telefone *',{exact:true}).fill('75999999999');
 await page.getByLabel('Próximo contato (horário de Brasília) *').fill('2030-01-01T12:00');
 await page.getByRole('button',{name:'Salvar neste aparelho'}).click();
 await page.getByRole('heading',{name:'Lead: Contato sem conexão'}).waitFor();
 await page.getByRole('button',{name:'Nova avaliação',exact:true}).click();
 await page.getByLabel('Placa',{exact:true}).fill('ABC1D23');
 await page.getByLabel('Marca e modelo').fill('Honda CG teste');
 await page.getByLabel('Nome do cliente').fill('Cliente de teste');
 await page.getByRole('button',{name:'Salvar neste aparelho'}).click();
 await page.getByRole('heading',{name:'Rascunho de avaliação: Honda CG teste'}).waitFor();
 await page.reload();
 await page.getByLabel('Código offline (8 a 12 números)').fill('19384726');
 await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await page.getByText('Código incorreto ou dados locais indisponíveis.').waitFor();
 await page.getByLabel('Código offline (8 a 12 números)').fill('84726195');
 await page.getByRole('button',{name:'Desbloquear',exact:true}).click();
 await page.getByRole('button',{name:'Pendências',exact:true}).click();
 assert.equal(await page.locator('#offline-content article').count(),2);
 if(process.env.COTAR_OFFLINE_SCREENSHOT)await page.screenshot({path:process.env.COTAR_OFFLINE_SCREENSHOT,fullPage:true});
 console.log('PASS: offline launch, offline lead and evaluation creation, restart persistence and incorrect-code protection');
 await context.setOffline(false);
 // Chromium network emulation may not dispatch the OS online event after an offline reload.
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.getByRole('heading',{name:'Sem pendências'}).waitFor({timeout:30000});
 const data=await (await context.request.get(base+'/api/data')).json();assert.equal(data.records.leads.length,1);
 const evaluations=await (await context.request.get(base+'/api/used-evaluations')).json();assert.equal(evaluations.items.length,1);assert.equal(evaluations.items[0].status,'Em andamento');
 console.log('PASS: reconnection sync creates a lead and unfinished evaluation in the local API');
 let lost=false;
 await page.route('**/api/leads',async route=>{
  if(route.request().method()==='POST'&&!lost){lost=true;const response=await route.fetch();assert.equal(response.status(),201);await route.abort('connectionfailed');}
  else await route.continue();
 });
 await page.getByRole('button',{name:'Novo lead',exact:true}).click();
 await page.getByLabel('Nome *',{exact:true}).fill('Envio interrompido');
 await page.getByLabel('Telefone *',{exact:true}).fill('75999999998');
 await page.getByLabel('Próximo contato (horário de Brasília) *').fill('2030-01-01T12:00');
 await page.getByRole('button',{name:'Salvar neste aparelho'}).click();
 await page.getByText('Envio iniciado. A confirmação na nuvem é necessária antes de editar para evitar duplicatas.').waitFor({timeout:30000});
 await page.getByRole('button',{name:'Sincronizar agora',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('#sync').disabled);
 await page.getByRole('button',{name:'Sincronizar agora',exact:true}).click();
 await page.getByRole('heading',{name:'Sem pendências'}).waitFor({timeout:30000});
 const finalData=await (await context.request.get(base+'/api/data')).json();assert.equal(finalData.records.leads.length,2);
 console.log('PASS: lost success response is retried without duplicate creation');
 await page.goto(base+'/login');
 await page.locator('[data-action="logout"]').waitFor();
 await page.locator('[data-action="logout"]').click();
 await page.waitForFunction(()=>document.body.classList.contains('locked'));
 const vault=await page.evaluate(async()=>{const {openOfflineDB,vaultRepository}=await import('/offline-store.js');const db=await openOfflineDB();try{return await vaultRepository(db).read()}finally{db.close()}});
 assert.equal(vault,null);assert.deepEqual(errors,[]);
 console.log('PASS: logout clears local private data; no browser JavaScript errors');
}catch(error){console.log('LOCAL TEST PAGE:',await page.locator('body').innerText());console.log('BROWSER ERRORS:',errors);throw error}finally{await context.close();await browser.close()}
