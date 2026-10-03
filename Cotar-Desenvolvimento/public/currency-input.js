const formatter=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export function parseCurrency(value){
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 let raw=String(value??'').trim();if(!raw)return null;
 raw=raw.replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!/^-?[\d.,]+$/.test(raw))return NaN;
 if(raw.includes(','))raw=raw.replace(/\./g,'').replace(',','.');
 else if(/^-?\d{1,3}(?:\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'');
 const n=Number(raw);return Number.isFinite(n)?n:NaN;
}
export function currencyValue(value){const n=parseCurrency(value);return n===null||!Number.isFinite(n)?'':formatter.format(n)}
export function installCurrencyInputs(root=document){
 if(root.__currencyInputsInstalled)return;root.__currencyInputsInstalled=true;
 root.addEventListener('input',e=>{const el=e.target;if(!el.matches?.('[data-money]'))return;const n=parseCurrency(el.value);el.setCustomValidity?.(n===null||Number.isFinite(n)&&n>=0?'':'Informe um valor válido em R$.')});
 root.addEventListener('focusout',e=>{const el=e.target;if(!el.matches?.('[data-money]'))return;const n=parseCurrency(el.value);if(n!==null&&Number.isFinite(n)&&n>=0)el.value=currencyValue(n)});
}
