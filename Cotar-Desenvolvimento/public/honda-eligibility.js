export function eligibleHondaSale(row){const status=String(row.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();return status!=='BORDERO FORMADO';}
