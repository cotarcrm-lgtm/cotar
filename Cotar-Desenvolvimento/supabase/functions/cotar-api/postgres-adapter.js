export function pgAdapter(client) {
  async function execute(sql, query, args) {
    let index = 0;
    const ignoredInsert = /^INSERT OR IGNORE INTO\b/i.test(query);
    const text = query
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      .replace(/\b(FROM|INTO|UPDATE|JOIN)\s+(companies|groups|regions|stores|teams|users|leads|vehicles|assessments|sales|accounts|sessions|auth_limits|settings|whatsapp_accounts|whatsapp_messages|chat_lists|chat_messages|chat_recipients|sale_counters|crm_subscriptions|crm_billing_payments|support_tickets|support_messages|platform_activity|platform_audit|platform_management_reset_tokens|platform_reset_tokens|platform_accounts|platform_sessions|platform_settings)\b/gi, (_, verb, table) => `${verb} cotar.${table}`)
      .replace(/json_each\(m\.audience,'\$\.recipientIds'\) j/g, "jsonb_array_elements_text((m.audience::jsonb)->'recipientIds') AS j(value)")
      .replace(/\?/g, () => '$' + (++index))+(ignoredInsert?' ON CONFLICT DO NOTHING':'');
    const values=[...args];
    const insert=text.match(/INSERT INTO cotar\.\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    let dataParameter;
    if(insert){const columns=insert[1].split(',').map(v=>v.trim().replaceAll('"',''));const i=columns.indexOf('data');if(i>=0)dataParameter=insert[2].split(',')[i].trim().match(/^\$(\d+)$/)?.[1];}
    const update=text.match(/UPDATE cotar\.\w+ SET\s+data\s*=\s*\$(\d+)/i);if(update)dataParameter=update[1];
    if(dataParameter&&typeof values[Number(dataParameter)-1]==='string')values[Number(dataParameter)-1]=JSON.parse(values[Number(dataParameter)-1]);
    const rows = await sql.unsafe(text, values);
    return { rows: Array.from(rows,r=>{const o={...r};if(o.data&&typeof o.data==='object')o.data=JSON.stringify(o.data);return o}), count: rows.count ?? rows.length };
  }
  function prepare(query) {
    let args = [];
    const stmt = {
      query,
      bind(...values) { args = values; return stmt; },
      get args() { return args; },
      async first() { return (await execute(client, query, args)).rows[0] || null; },
      async all() { return { results: (await execute(client, query, args)).rows }; },
      async run() { return { meta: { changes: (await execute(client, query, args)).count } }; }
    };
    return stmt;
  }
  return {
    billingSupported:true,
    async readCompanyTables(companyId,kinds){
      const allowed=['companies','groups','regions','stores','teams','users','leads','vehicles','assessments','sales'];
      if(kinds.some(kind=>!allowed.includes(kind)))throw Error('Tabela inválida.');
      const result=Object.fromEntries(kinds.map(kind=>[kind,[]]));if(!kinds.length)return result;
      const query=kinds.map(kind=>`SELECT '${kind}' AS kind,to_jsonb(t) AS row,t.created_at FROM cotar.${kind} t WHERE t.company_id=$1`).join(' UNION ALL ');
      const rows=await client.unsafe(`SELECT kind,row FROM (${query}) source ORDER BY kind,created_at DESC`,[companyId]);
      for(const item of rows)result[item.kind].push(item.row);return result;
    },
    async readCrmSession(tokenHash,expiresAfter){
      const rows=await client.unsafe(`SELECT to_jsonb(u) AS user_row,to_jsonb(a) AS account_row FROM cotar.sessions s JOIN cotar.users u ON u.id=s.user_id JOIN cotar.accounts a ON a.user_id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2`,[tokenHash,expiresAfter]);
      return rows[0]?{row:rows[0].user_row,account:rows[0].account_row}:null;
    },
    async saveUsedStage(assessmentId,companyId,stage,data,subtotals,total){
      await client.unsafe(`INSERT INTO cotar.used_evaluation_steps (assessment_id,company_id,stage,data,mechanics_total,aesthetics_total,services_total,preparation_total)
        VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
        ON CONFLICT (assessment_id,stage) DO UPDATE SET data=EXCLUDED.data,mechanics_total=EXCLUDED.mechanics_total,
        aesthetics_total=EXCLUDED.aesthetics_total,services_total=EXCLUDED.services_total,
        preparation_total=EXCLUDED.preparation_total,version=cotar.used_evaluation_steps.version+1,updated_at=now()`,
        [assessmentId,companyId,stage,data,subtotals.mechanics,subtotals.aesthetics,subtotals.services,total]);
    },
    prepare,
    async batch(statements) {
      return client.begin(async tx => {
        const results = [];
        for (const stmt of statements) {
          if (stmt.query.includes('WHERE changes()=0')) {
            if (!results.at(-1)?.meta.changes) throw Object.assign(new Error('O registro mudou. Recarregue antes de salvar.'), { status: 409 });
            results.push({ meta: { changes: 0 } });
            continue;
          }
          const result = await execute(tx, stmt.query, stmt.args);
          results.push({ meta: { changes: result.count } });
        }
        return results;
      });
    }
  };
}
