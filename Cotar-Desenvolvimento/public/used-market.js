// Taxa mensal definida para a simulação de financiamento de seminovos.
export const marketReference={monthlyPercent:3.3,date:'2026-09-30',source:'Taxa de simulação COTAR',retrievedAt:'2026-09-30'};
export function simulateUsedFinance(price,entryPercent,months,reference=marketReference){
 price=Number(price);entryPercent=Number(entryPercent);months=Number(months);const rate=Number(reference.monthlyPercent)/100;
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(entryPercent)||entryPercent<10||entryPercent>90||![12,24,36,48,60].includes(months)||!Number.isFinite(rate)||rate<=0)return null;
 const entry=price*entryPercent/100,financed=price-entry+790,installment=financed*rate/(1-Math.pow(1+rate,-months));
 return {price,entryPercent,months,entry,financed,installment,total:entry+installment*months,monthlyPercent:reference.monthlyPercent,referenceDate:reference.date};
}
