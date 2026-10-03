import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {walletPaymentStatus,walletEligible,nextMonthlyDue,bidPaymentDeadline,walletContent,walletRows,mountWallet} from '../public/honda-wallet.js';
import {mountHondaDashboard} from '../public/honda-sales-dashboard.js';
const normal={id:1,cliente:'Cliente normal',nome_vendedor:'Ana',loja:'WINNER',status:'NORMAL',grupo:123,cota:204,r:2,d:1,data_venda:'2025-01-01',data_vencimento:'2026-10-10',celular:'19995192311',followup:{}};
const pre={...normal,id:2,cliente:'Pré-contemplado',status:'PRE-CONTEMPLADO',data_contemplacao:'2026-10-02'};
test('wallet accepts only the requested statuses and projects monthly dates safely',()=>{
 for(const status of ['NORMAL','PRE-CANCELADO','PRÉ-CONTEMPLADO'])assert.ok(walletEligible({status}));
 for(const status of ['CANCELADO','CONTEMPLADO','JURIDICO','BORDERÔ FORMADO'])assert.ok(!walletEligible({status}));
 assert.equal(nextMonthlyDue('2026-01-31'),'2026-02-28');assert.equal(nextMonthlyDue('2024-01-31'),'2024-02-29');assert.equal(nextMonthlyDue('2026-12-15'),'2027-01-15');assert.equal(nextMonthlyDue('2026-02-30'),null);
});
test('bid deadline counts five business days after contemplation, skipping banking holidays',()=>{
 assert.equal(bidPaymentDeadline('2026-10-02'),'2026-10-09');assert.equal(bidPaymentDeadline('2026-10-08'),'2026-10-16');assert.equal(bidPaymentDeadline('2026-11-18'),'2026-11-26');assert.equal(bidPaymentDeadline('2026-02-13'),'2026-02-24');assert.equal(bidPaymentDeadline(null),null);
 assert.equal(bidPaymentDeadline('2026-10-02',['2026-10-05']),'2026-10-13');
});
test('wallet displays correct due fields, whatsapp and bid deadline and supports search',()=>{
 const rows=[normal,pre,{...normal,id:3,status:'CANCELADO'}];const state={search:'',stage:'',limit:100};const html=walletContent({canWrite:true},rows,state);
 assert.match(html,/10\/10\/2026/);assert.match(html,/10\/11\/2026/);assert.match(html,/09\/10\/2026/);assert.match(html,/wa.me\/5519995192311/);assert.equal((html.match(/data-wallet-client=/g)||[]).length,2);
 assert.equal(walletRows(rows,{search:'204-2-1'}).length,2);assert.equal(walletRows(rows,{stage:'needs-boleto'}).length,0);
});
test('Carteira loads lazily, keeps old active clients and persists follow-up from the popup',async()=>{
 const d=new JSDOM('<main></main>'),root=d.window.document.querySelector('main');let saved;
 const api=async(path,options)=>{if(path==='honda-wallet/2'){saved=JSON.parse(options.body);return {followup:{stage:saved.stage,notes:saved.notes,updatedAt:'now'}};}return path==='honda-wallet'?{rows:[normal,pre],canWrite:true}:{rows:[normal,pre]};};
 const stop=mountHondaDashboard(root,{api,toast:()=>{}});await new Promise(r=>setTimeout(r,0));root.querySelector('[data-honda-tab="carteira"]').click();await new Promise(r=>setTimeout(r,0));
 assert.equal(root.querySelectorAll('[data-wallet-client]').length,2);root.querySelector('[data-wallet-client="2"]').click();const form=root.querySelector('[data-wallet-form]');form.elements.stage.value='paid';form.elements.notes.value='Cliente informou o pagamento do lance';form.dispatchEvent(new d.window.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,0));
 assert.equal(saved.stage,'paid');assert.equal(saved.notes,'Cliente informou o pagamento do lance');assert.equal(pre.followup.stage,'paid');stop();d.window.close();
});

test('boleto status respects deadline boundaries, custom dates and reported payments',()=>{
 assert.equal(walletPaymentStatus({...pre,followup:{}},'2026-10-08').kind,'current');assert.equal(walletPaymentStatus({...pre,followup:{}},'2026-10-09').kind,'today');assert.equal(walletPaymentStatus({...pre,followup:{}},'2026-10-10').kind,'overdue');
 assert.equal(walletPaymentStatus({...pre,followup:{deadline:'2026-10-15'}},'2026-10-10').kind,'current');assert.equal(walletPaymentStatus({...pre,followup:{stage:'paid'}},'2026-10-10').label,'Pagamento informado');assert.equal(walletPaymentStatus({...normal,data_vencimento:null}).kind,'unknown');
 const html=walletContent({},[pre],{limit:100});assert.match(html,/Boleto até 09\/10\/2026/);assert.match(html,/wallet-stage-dot/);
});
