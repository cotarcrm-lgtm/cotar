import {modules,checkNames,normalizeRole} from '../public/config.js';
import {hondaModels} from '../public/honda-models.js';
import honda from './honda-catalogue.json' with {type:'json'};
import disal from './disal-catalogue.json' with {type:'json'};

const upper=value=>value.toLocaleUpperCase('pt-BR');
const models=[...Object.values(hondaModels).flat(),...honda.plans.map(plan=>plan.model),...disal.plans.map(plan=>plan.model)];
const optionsByKey=new Map();
for(const config of Object.values(modules))for(const field of config.fields){
 if(field.type!=='select')continue;
 const options=optionsByKey.get(field.key)||new Map();
 for(const value of field.options||[])options.set(upper(value),value);
 optionsByKey.set(field.key,options);
}

// Only human-readable fields are transformed. IDs, URLs, e-mail addresses,
// dates, phone numbers and attachment data must retain their original form.
export function recordForStorage(kind,record){
 const result={...record};
 for(const field of modules[kind]?.fields||[]){
  if(!['text','textarea','select','honda-model'].includes(field.type)||field.key.endsWith('Id'))continue;
  const value=result[field.key];
  if(typeof value==='string')result[field.key]=upper(value);
 }
 if(Array.isArray(result.checklist))result.checklist=result.checklist.map(item=>({...item,note:typeof item.note==='string'?upper(item.note):item.note,name:typeof item.name==='string'?upper(item.name):item.name,state:typeof item.state==='string'?upper(item.state):item.state}));
 return result;
}

export function recordFromStorage(record){
 const result={...record};
 if(result.role)result.role=normalizeRole(result.role);
 for(const [key,options] of optionsByKey){
  if(key==='role'||key==='status'&&result.flowVersion===2||typeof result[key]!=='string')continue;
  result[key]=options.get(upper(result[key]))||result[key];
 }
 if(result.status==='VENDIDO')result.status='Vendido';
 if(typeof result.model==='string')result.model=models.find(model=>upper(model)===upper(result.model))||result.model;
 if(Array.isArray(result.checklist))result.checklist=result.checklist.map(item=>({...item,name:checkNames.find(name=>upper(name)===upper(item.name||''))||item.name,state:({BOM:'Bom',RESTAURAR:'Restaurar',TROCAR:'Trocar'})[upper(item.state||'')]||item.state}));
 return result;
}
