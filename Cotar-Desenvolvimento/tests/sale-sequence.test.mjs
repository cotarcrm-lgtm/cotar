import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
test('migração encurta códigos; sequência por empresa não reutiliza exclusões',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=OFF');
 const migrations=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();for(const f of migrations.filter(f=>!f.startsWith('0005')))db.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const insert=(id,company,date)=>db.prepare("INSERT INTO sales(id,company_id,store_id,user_id,lead_id,status,data,created_at,updated_at) VALUES(?,?,'s','u','l','Pendente',?, ?,?)").run(id,company,JSON.stringify({saleCode:'VD-LONGO',notes:'preservado'}),date,date);
 insert('old2','a','2026-02');insert('old1','a','2026-01');insert('other','b','2026-01');
 db.exec(fs.readFileSync('drizzle/'+migrations.find(f=>f.startsWith('0005')),'utf8'));
 const data=id=>JSON.parse(db.prepare('SELECT data FROM sales WHERE id=?').get(id).data);
 assert.equal(data('old1').saleCode,'C1');assert.equal(data('old2').saleCode,'C2');assert.equal(data('other').saleCode,'C1');assert.equal(data('old1').notes,'preservado');
 insert('new','a','2026-03');assert.equal(data('new').saleCode,'C3');db.exec("DELETE FROM sales WHERE id='new'");insert('next','a','2026-04');assert.equal(data('next').saleCode,'C4');db.close();
});
