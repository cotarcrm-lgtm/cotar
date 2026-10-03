import {test} from 'node:test';
import assert from 'node:assert/strict';
import {consultationLinksForUF} from '../public/used-module.js';

test('consultas estaduais seguem a UF e nacionais continuam iguais',()=>{
 const ba=consultationLinksForUF('BA'),ce=consultationLinksForUF('ce'),other=consultationLinksForUF('PE');
 assert.match(ba.licensing,/ba\.gov\.br/);
 assert.match(ce.licensing,/detran\.ce\.gov\.br/);
 assert.match(ce.ipva,/sefaz\.ce\.gov\.br/);
 assert.match(ce.activeDebt,/pge\.ce\.gov\.br/);
 assert.notEqual(ba.lien,ce.lien);
 assert.equal(ba.dnit,ce.dnit);
 assert.equal(ba.prf,ce.prf);
 assert.equal(other.licensing,undefined);
});
