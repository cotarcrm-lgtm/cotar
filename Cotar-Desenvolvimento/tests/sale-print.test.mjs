import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saleCode,salePrintContent} from '../public/sale-print.js';
test('código permanente, sequencial, e resumo com dados específicos da modalidade',()=>{
 const a={saleCode:'C1',id:'00000000-0000-4000-8000-000000000001'},b={saleCode:'C2',id:'00000000-0000-4000-8000-000000000002'};
 assert.equal(saleCode(a),saleCode({...a,date:'2027-01-01'}));assert.notEqual(saleCode(a),saleCode(b));
 const html=salePrintContent({...a,modality:'Consórcio',status:'Concluída',amount:20000,consortium:{model:'CG 160',creditCents:2000000,months:80,installmentCents:30000,administratorId:'honda'},proposalNumber:'123',proposalDigit:'0',quotaType:'Nova',notes:'<script>unsafe</script>'},{lead:{name:'Cliente'},store:{name:'Loja'},seller:{nickname:'Carlos'}});
 assert(html.includes(saleCode(a)));assert(html.includes('COTAR CRM'));assert(html.includes('123-0'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(!html.includes('Custo'));assert(!html.includes('Frete'));
 const vehicle=salePrintContent({...a,modality:'Financiamento',model:'CG 160',amount:25000,freight:150,documents:[{slot:'identityFront',name:'RG.pdf'}]},{});assert(vehicle.includes('Frete'));assert(vehicle.includes('RG.pdf'));assert(!vehicle.includes('Tipo de cota'));
});
