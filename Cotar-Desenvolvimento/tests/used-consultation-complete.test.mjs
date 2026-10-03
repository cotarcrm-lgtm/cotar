import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consultationComplete} from '../public/used-module.js';
const attachment={id:'file'};
test('check verde exige resultado e comprovante; débito e restrição exigem detalhes',()=>{
 assert.equal(consultationComplete({state:'NÃO CONSULTADO',attachment}),false);
 assert.equal(consultationComplete({state:'REGULAR'}),false);
 assert.equal(consultationComplete({state:'REGULAR',attachment}),true);
 assert.equal(consultationComplete({state:'COM DEBITO',attachment,amount:0}),false);
 assert.equal(consultationComplete({state:'COM DEBITO',attachment,amount:15}),true);
 assert.equal(consultationComplete({state:'COM RESTRIÇÃO',attachment,note:''}),false);
 assert.equal(consultationComplete({state:'COM RESTRIÇÃO',attachment,note:'Restrição identificada'}),true);
 assert.equal(consultationComplete({state:'COM DEBITO',attachment},false),true);
});
