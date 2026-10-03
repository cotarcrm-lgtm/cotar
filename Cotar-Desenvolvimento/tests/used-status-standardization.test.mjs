import test from 'node:test';
import assert from 'node:assert/strict';
import {recordFromStorage} from '../server/text-standardization.js';

test('status da captação mantém os valores persistidos ao recarregar',()=>{
 for(const status of ['ACEITO','NEGOCIAÇÃO','PERDIDO']){
  assert.equal(recordFromStorage({flowVersion:2,status}).status,status);
 }
});
