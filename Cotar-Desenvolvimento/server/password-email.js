import {digest,limit} from './auth.js';
import {deny,unpack} from './policy.js';

export const recoveryMessage='Se houver uma conta ativa com esse e-mail, enviaremos um link para redefinir sua senha. Confira também o spam.';
export async function requestPasswordEmail(db,req,env,b,management=false){
  const email=String(b.email||'').trim().toLowerCase();
  if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))deny('Informe um e-mail válido.',400);
  await limit(db,req,email,management?'management-password-email':'password-email');
  if(!env.RESEND_API_KEY)deny('A recuperação por e-mail está temporariamente indisponível. Fale com o suporte.',503);
  const result={ok:true,message:recoveryMessage};
  const table=management?'platform_management_reset_tokens':'platform_reset_tokens',idColumn=management?'account_id':'user_id';
  const row=await db.prepare(management?'SELECT * FROM platform_accounts WHERE email=?':'SELECT * FROM users WHERE email=?').bind(email).first();
  if(!row||(management?row.status!=='ATIVO':unpack(row).status!=='Ativo'))return result;
  if(!management&&!await db.prepare('SELECT user_id FROM accounts WHERE user_id=?').bind(row.id).first())return result;
  const recent=await db.prepare(`SELECT token_hash FROM ${table} WHERE ${idColumn}=? AND created_at>?`).bind(row.id,new Date(Date.now()-60000).toISOString()).first();
  if(recent)return result;
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  const hash=await digest(token),at=new Date().toISOString();
  await db.prepare(`INSERT INTO ${table} (token_hash,${idColumn},created_by,expires_at,created_at) VALUES (?,?,?,?,?)`).bind(hash,row.id,row.id,Date.now()+1800000,at).run();
  const link='https://cotarcrm.com.br/recuperar.html'+(management?'?area=gestao':'')+'#'+token;
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'password-reset/'+hash},body:JSON.stringify({from:'COTAR <nao-responda@cotarcrm.com.br>',to:[email],subject:'Redefina sua senha do COTAR',text:`Recebemos uma solicitação para redefinir sua senha do COTAR.\n\nAcesse: ${link}\n\nO link funciona uma única vez e expira em 30 minutos. Se você não solicitou, ignore este e-mail. Sua senha permanece a mesma.`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#181818"><h1 style="font-size:28px">cotar<span style="color:#e9bd00">●</span></h1><h2>Redefina sua senha</h2><p>Recebemos uma solicitação para recuperar seu acesso ao COTAR.</p><p style="margin:28px 0"><a href="${link}" style="background:#ffd326;color:#181818;padding:14px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Definir nova senha</a></p><p>Este link funciona uma única vez e expira em <strong>30 minutos</strong>.</p><p>Se você não solicitou, ignore este e-mail. Sua senha permanece a mesma.</p></div>`}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){console.error('COTAR password email rejected',response.status);await db.prepare(`DELETE FROM ${table} WHERE token_hash=?`).bind(hash).run();}
  }catch{console.error('COTAR password email unavailable');await db.prepare(`DELETE FROM ${table} WHERE token_hash=?`).bind(hash).run();}
  return result;
}
