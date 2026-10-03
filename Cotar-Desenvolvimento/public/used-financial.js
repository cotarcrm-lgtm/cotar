const round=value=>Math.round((Number(value)||0)*100)/100;
export function closingFinancial(row){
 const purchase=round(row.commercial?.purchasePrice),transfer=round(row.commercial?.transfer),payoff=round(row.commercial?.payoffDebt),debts=round(row.debts),preparation=round(row.preparationTotal),fipe=round(row.fipe);
 const customerReceives=round(purchase-debts),totalCost=round(purchase+preparation);
 const pct=value=>fipe?round(value/fipe*100):null;
 return {purchase,transfer,payoff,debts,preparation,fipe,customerReceives,totalCost,purchaseFipe:pct(purchase),preparationFipe:pct(preparation),debtsFipe:pct(debts)};
}
