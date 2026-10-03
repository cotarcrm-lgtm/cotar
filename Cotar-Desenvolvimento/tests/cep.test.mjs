import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lookupCep} from '../server/cep.js';
test('ViaCEP valida CEP, trata não encontrado e retorna campos de endereço',async()=>{
 await assert.rejects(lookupCep('123',()=>{throw Error('Não deveria chamar')}),e=>e.status===400);
 await assert.rejects(lookupCep('99999999',async()=>Response.json({erro:true})),e=>e.status===404);
 let calls=0;const found=await lookupCep('01001-000',async(url,options)=>{calls++;assert.equal(url,'https://viacep.com.br/ws/01001000/json/');assert.equal(options.redirect,'manual');return Response.json({localidade:'São Paulo',uf:'SP',logradouro:'Praça da Sé',bairro:'Sé'})});assert.equal(found.city,'São Paulo');assert.equal(found.street,'Praça da Sé');assert.equal(found.postalCode,'01001-000');await lookupCep('01001000',()=>{calls++;});assert.equal(calls,1);
 await assert.rejects(lookupCep('11111111',async()=>new Response('bad',{status:500})),e=>e.status===502);
 await assert.rejects(lookupCep('22222222',async()=>Response.json({})),e=>e.status===502);
});
