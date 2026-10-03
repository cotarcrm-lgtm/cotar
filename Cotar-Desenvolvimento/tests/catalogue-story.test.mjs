import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeCatalogueStory} from '../public/catalogue-story.js';
import {reservaAmounts,simulateReservaBid} from '../public/reserva-simulation.js';
test('arte de cota usa lance médio e parcela após amortização limitada a 30%',async()=>{
 const row={valor_parcela:500,valor_parcela_2:500,prazo:60,parcelas_restantes:40,media_percentual:.35,cota:'333-1-6'};
 const amounts=reservaAmounts(row),sim=simulateReservaBid(row,35),texts=[];
 const ctx={fillRect(){},beginPath(){},roundRect(){},fill(){},drawImage(){},strokeText(...args){texts.push(args[0])},fillText(...args){texts.push(args[0])},measureText(v){return {width:String(v).length*30}}};
 const previous=globalThis.document,previousImage=globalThis.Image;globalThis.Image=class{width=1080;height=1920;set src(value){queueMicrotask(()=>this.onload?.())}};globalThis.document={createElement:()=>({getContext:()=>ctx,toBlob:fn=>fn(new Blob(['png'],{type:'image/png'}))})};
 try{const blob=await makeCatalogueStory({model:'POP 110i',photo:null,category:'Cota disponível',consultant:'Carlos',phone:'75999998888',quotaOffer:{averageBidCents:amounts.averageBidCents,newInstallmentCents:sim.newInstallmentCents,currentInstallmentCents:50000,quota:row.cota}});assert.equal(blob.type,'image/png');assert(texts.includes('OFERTA EXCLUSIVA'));assert(texts.includes('COTA ELITE  ·  333-1-6'));assert(texts.includes('R$ 10.500,00'));assert(texts.includes('R$ 500,00'));assert(texts.includes('R$ 350,00'));assert(texts.some(t=>t.includes('redução de 30%')))}finally{globalThis.document=previous;globalThis.Image=previousImage}
});
