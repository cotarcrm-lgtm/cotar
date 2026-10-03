import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordForStorage,recordFromStorage} from '../server/text-standardization.js';

test('texto humano é salvo em caixa alta e códigos continuam íntegros ao carregar',()=>{
 const lead={name:'João da Silva',email:'joao@example.com',phone:'(75) 90000-0000',status:'Agendado',temperature:'Super quente',modality:'Financiamento',model:'CG 160 Fan',notes:'Voltar amanhã',userId:'u-123',scheduledAt:'2026-09-29T14:00:00Z'};
 const saved=recordForStorage('leads',lead);
 assert.equal(saved.name,'JOÃO DA SILVA');assert.equal(saved.notes,'VOLTAR AMANHÃ');assert.equal(saved.status,'AGENDADO');assert.equal(saved.temperature,'SUPER QUENTE');assert.equal(saved.modality,'FINANCIAMENTO');assert.equal(saved.model,'CG 160 FAN');
 assert.equal(saved.email,lead.email);assert.equal(saved.userId,lead.userId);assert.equal(saved.scheduledAt,lead.scheduledAt);
 const loaded=recordFromStorage(saved);assert.equal(loaded.status,'Agendado');assert.equal(loaded.temperature,'Super quente');assert.equal(loaded.model,'CG 160 Fan');
 const user=recordForStorage('users',{name:'Maria',role:'Gerente Regional',email:'maria@example.com'});
 assert.equal(user.role,'GERENTE REGIONAL');assert.equal(recordFromStorage({role:'GERENTE CORPORATIVO'}).role,'Gerente Regional');
});
