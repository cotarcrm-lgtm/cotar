export function billingRuntime(readSecret, forwarded = {}) {
  const result = Object.fromEntries(['ASAAS_API_KEY', 'ASAAS_ENVIRONMENT', 'ASAAS_WEBHOOK_TOKEN'].map(key => [key, readSecret(key) || forwarded[key]]));
  result.ASAAS_ENVIRONMENT = String(result.ASAAS_ENVIRONMENT || 'sandbox').trim().toLowerCase();
  return result;
}

// Only callable after transport authentication. The public gateway never forwards
// the setup header, and this helper never returns credentials or provider tokens.
export async function setupSandboxWebhook(req, readSecret, request = fetch) {
  const key = readSecret('ASAAS_API_KEY');
  if (!key) return Response.json({error:'ASAAS_API_KEY não encontrada nos segredos do Supabase.'}, {status:503});
  if (String(readSecret('ASAAS_ENVIRONMENT') || 'sandbox').trim().toLowerCase() !== 'sandbox') return Response.json({error:'ASAAS_ENVIRONMENT deve ser sandbox.'}, {status:400});
  const body = await req.json();
  if (!/^[a-f0-9]{64}$/.test(body.token || '') || !/^\S+@\S+\.\S+$/.test(body.email || '')) return Response.json({error:'Configuração inválida.'}, {status:400});
  const base = 'https://api-sandbox.asaas.com/v3';
  const headers = {access_token:key, 'User-Agent':'COTAR-CRM/1.0', 'Content-Type':'application/json'};
  const call = async (path, method = 'GET', payload) => {
    const response = await request(base + path, {method,headers,body:payload ? JSON.stringify(payload) : undefined,signal:AbortSignal.timeout(25000)});
    const data = await response.json();
    if (!response.ok) throw new Error('Asaas HTTP ' + response.status + ': ' + JSON.stringify(data.errors || data).replaceAll(key,'[redacted]').slice(0,1500));
    return data;
  };
  try {
    const url = 'https://cotar-crm.jcarlossf.chatgpt.site/api/billing/webhook';
    const list = await call('/webhooks?limit=100');
    const existing = list.data?.find(item => item.url === url);
    const config = {name:'COTAR CRM Sandbox',url,email:body.email,enabled:true,interrupted:false,apiVersion:3,authToken:body.token,sendType:'SEQUENTIALLY',events:['PAYMENT_CREATED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_OVERDUE','PAYMENT_DELETED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL']};
    const webhook = await call('/webhooks' + (existing ? '/' + encodeURIComponent(existing.id) : ''),existing ? 'PUT' : 'POST',config);
    const verified = await call('/webhooks/' + encodeURIComponent(webhook.id));
    if (verified.url !== url || !verified.enabled || verified.interrupted) throw new Error('Webhook salvo, mas a configuração não foi confirmada.');
    return Response.json({configured:true,environment:'sandbox',webhookId:webhook.id,enabled:true,url});
  } catch(error) { return Response.json({error:error.message}, {status:502}); }
}
