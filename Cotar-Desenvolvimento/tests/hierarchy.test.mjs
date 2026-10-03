import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inScope,canManage,projection,unpack} from '../server/policy.js';
import {modules,roles,defaultScreens,normalizeRole} from '../public/config.js';
test('mesma hierarquia em leads, vendas, captações e estoque; colegas visíveis sem elevar gestão',()=>{
 const companyId='c',all=Object.fromEntries(Object.keys(modules).map(k=>[k,[]]));
 all.groups=[{id:'g1',companyId},{id:'g2',companyId}];all.regions=[{id:'r1',groupId:'g1',companyId},{id:'r2',groupId:'g1',companyId},{id:'r3',groupId:'g2',companyId}];all.stores=[{id:'s1',regionId:'r1',companyId},{id:'s2',regionId:'r1',companyId},{id:'s3',regionId:'r2',companyId},{id:'s4',regionId:'r3',companyId}];
 all.users=[{id:'u1',storeId:'s1',teamId:'t1'},{id:'u2',storeId:'s1',teamId:'t1'},{id:'u3',storeId:'s1',teamId:'t2'},{id:'u4',storeId:'s2',teamId:'t3'},{id:'u5',storeId:'s3',teamId:'t4'},{id:'u6',storeId:'s4',teamId:'t5'}].map(u=>({...u,companyId,role:'Vendedor'}));
 for(const kind of ['leads','sales','assessments','vehicles'])all[kind]=all.users.map(u=>({id:kind+'-'+u.id,companyId,storeId:u.storeId,userId:u.id,createdBy:u.id}));
 const counts=[6,5,4,3,3,2,1];for(const [i,role] of roles.entries()){const actor={id:'u1',role,companyId,groupId:'g1',regionId:'r1',storeId:'s1',teamId:'t1',screens:defaultScreens(role)};for(const kind of ['leads','sales','assessments','vehicles']){assert.equal(all[kind].filter(r=>inScope(actor,kind,r,all)).length,counts[i],role+' '+kind);assert.equal(inScope(actor,kind,{...all[kind][0],companyId:'foreign'},all),false);}}
 const director={id:'director',role:'Diretor',companyId,groupId:'g1',regionId:'r1',storeId:'s1',teamId:'t1',screens:defaultScreens('Diretor')};const peer={...director,id:'peer'},corporate={...director,id:'corporate',role:'Gerente Corporativo'};all.users.push(director,peer,corporate);assert(inScope(director,'users',peer,all));assert(!canManage(director,peer,all));assert(canManage(director,corporate,all));const result=projection(director,all);assert(result.records.users.some(u=>u.id==='peer'&&u.canManage===false));assert(!result.records.users.some(u=>u.id==='u6'));
});
test('cargos antigos são normalizados sem ampliar permissões e cargos desconhecidos são negados',()=>{
 assert.equal(normalizeRole('Gerente Corporativo'),'Gerente Regional');assert.equal(normalizeRole('Gerente comercial'),'Gerente de Loja');assert.equal(normalizeRole('GERENTE DE LOJA'),'Gerente de Loja');assert.deepEqual(defaultScreens('Gerente corporativo'),defaultScreens('Gerente Regional'));assert.deepEqual(defaultScreens('Intruso'),[]);assert.equal(unpack({id:'u',company_id:'c',data:JSON.stringify({role:'GERENTE CORPORATIVO'})}).role,'Gerente Regional');
});
