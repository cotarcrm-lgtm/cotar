export const migrationTables=['companies','groups','regions','stores','teams','users','accounts','leads','vehicles','assessments','sale_counters','sales','chat_lists','chat_messages','chat_recipients','settings','crm_subscriptions','crm_billing_payments'];
export const migrationPk={accounts:['user_id'],sale_counters:['company_id'],chat_recipients:['message_id','recipient_id'],settings:['key']};
export const reservedSetting=k=>['proxy_key_sha256','migration_expires'].includes(k);
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export function normalizeRow(row){const out={...row};if(out.data&&typeof out.data==='string')out.data=JSON.parse(out.data);return out}
