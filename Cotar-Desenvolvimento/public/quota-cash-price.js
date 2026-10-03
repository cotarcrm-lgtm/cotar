const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');

// A cota pode trazer o código de modelo da tabela Honda ou o nome exibido.
// Somente correspondências exatas são aceitas para não usar o preço de outra versão.
export function quotaCashPriceCents(model,plans){
 const key=normalize(model);
 if(!key)return null;
 const matches=(plans||[]).filter(plan=>plan.administratorId==='honda'&&(normalize(plan.modelCode)===key||normalize(plan.model)===key));
 const prices=[...new Set(matches.map(plan=>Number(plan.cashPriceCents)).filter(value=>Number.isSafeInteger(value)&&value>0))];
 return prices.length===1?prices[0]:null;
}
