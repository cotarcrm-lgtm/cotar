export function reservaAmounts(row){
 const cents=n=>Math.round(Number(n||0)*100);
 const totalCents=cents(row.valor_parcela)*Number(row.prazo||0);
 const remainingCount=Number(row.parcelas_restantes||0);
 const installmentCents=cents(row.valor_parcela_2);
 const outstandingCents=installmentCents*remainingCount;
 const paidOnJoiningCents=remainingCount>0?installmentCents:0;
 const amortizationCount=Math.max(0,remainingCount-1);
 const amortizationBalanceCents=installmentCents*amortizationCount;
 const percent=Number(row.media_percentual);
 return {totalCents,remainingCount,outstandingCents,paidOnJoiningCents,amortizationCount,amortizationBalanceCents,averageBidCents:row.media_percentual==null?null:Math.round(totalCents*percent)};
}
export function simulateReservaBid(row,bidPercent){
 const base=reservaAmounts(row),percent=Number(bidPercent);
 if(!Number.isFinite(percent)||percent<0||percent>100||base.amortizationCount<1||base.totalCents<=0)return null;
 const bidCents=Math.round(base.totalCents*percent/100);
 const originalCents=Math.round(base.amortizationBalanceCents/base.amortizationCount);
 const appliedCents=Math.min(bidCents,base.amortizationBalanceCents);
 const cappedReductionCents=Math.min(Math.round(originalCents*0.3),Math.round(appliedCents/base.amortizationCount));
 const newInstallmentCents=originalCents-cappedReductionCents;
 const excessCents=appliedCents-cappedReductionCents*base.amortizationCount;
 const reverseAmortizationCents=percent>30?Math.max(0,excessCents):0;
 const reversePayments=Math.min(base.amortizationCount,Math.max(0,Math.floor(reverseAmortizationCents/newInstallmentCents)));
 const installmentMonths=base.amortizationCount-reversePayments;
 const installmentLastCents=installmentMonths?newInstallmentCents-(reverseAmortizationCents%newInstallmentCents):0;
 const termPayments=Math.min(base.amortizationCount,Math.floor(appliedCents/originalCents));
 const termMonths=base.amortizationCount-termPayments;
 const termLastCents=termMonths?originalCents-appliedCents%originalCents:0;
 return {...base,bidPercent:percent,bidCents,newInstallmentCents,installmentMonths,installmentLastCents,termInstallmentCents:originalCents,termMonths,termLastCents,reverseAmortizationCents,exceedsBalance:bidCents>base.amortizationBalanceCents};
}
