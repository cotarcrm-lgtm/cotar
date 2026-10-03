import test from 'node:test';import assert from 'node:assert/strict';import {saveSaleDocuments} from '../server/sale-documents.js';
const png='data:image/png;base64,'+Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64');
test('upload paralelo mantém a ordem e limpa arquivos de uma tentativa incompleta',async()=>{
 const slots=['quotaPrint','quotaReceipt','addressProof','identityFront'],files=slots.map(slot=>({slot,name:slot+'.png',data:png}));let active=0,max=0;const waiting=[];
 const env={PHOTOS:{put:()=>{active++;max=Math.max(max,active);return new Promise(resolve=>waiting.push(()=>{active--;resolve()}))}}};const upload=saveSaleDocuments(env,'c','s',files);assert.equal(waiting.length,3);waiting.splice(0).forEach(done=>done());await new Promise(r=>setImmediate(r));waiting.splice(0).forEach(done=>done());const result=await upload;assert.equal(max,3);assert.deepEqual(result.map(d=>d.slot),slots);
 const saved=[],deleted=[],failed={PHOTOS:{async put(key){if(key.endsWith('impossible'))throw Error('unused');if(saved.length===1)throw Error('offline');saved.push(key)},async delete(key){deleted.push(key)}}};await assert.rejects(()=>saveSaleDocuments(failed,'c','s',files),/offline/);assert.deepEqual(deleted.sort(),saved.sort());
});
