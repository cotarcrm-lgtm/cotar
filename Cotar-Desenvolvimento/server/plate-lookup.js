import {deny,permittedScreens} from './policy.js';
import {limit} from './auth.js';
import {ApiBrasilClient,ApiBrasilError} from './apibrasil-client.js';
export const normalizePlate=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const cut=(value,length=150)=>String(value).slice(0,length);
const category=value=>/moto|motocic|motoneta|ciclomotor/i.test(value)?'Moto':/carro|suv|autom[oó]vel|utilit[aá]rio|sedan|hatch|pickup|picape/i.test(value)?'Automóvel':'';
export function parsePlateResponse(result,plate){
 const response=result.response;
 const candidates=response.data.resultados.map(v=>({model:cut(v.modelo),brand:cut(v.marca,80),modelYear:cut(v.anoModelo,4),manufacturingYear:String(v.anoFabricacao),chassis:cut(v.chassi,32),category:category(v.categoria),color:cut(v.cor,50),code:cut(v.codigoFipe,20),reference:cut(v.mesReferencia,60),fuel:cut(v.combustivel,60),value:v.valor,principal:v.principal}));
 if(!candidates.length)deny('Nenhum veículo encontrado para esta placa.',404);
 // Each candidate has its own year, chassis and colour. Do not mix candidates.
 return {plate,vehicle:{plate},candidates,provider:'APIBrasil',homolog:response.homolog||response.api_limit_for==='homolog',consultedAt:new Date().toISOString()};
}
export async function lookupPlate(db,env,req,actor,input,dependencies={}){
 if(!permittedScreens(actor).some(s=>['leads','sales','assessments'].includes(s)))deny();
 const plate=normalizePlate(input);
 if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))deny('Informe uma placa válida, como ABC1D23 ou ABC1234.',400);
 try{
  const client=new ApiBrasilClient(env,dependencies,{timeoutMs:30000});
  await limit(db,req,actor.id,'plate-lookup');
  const result=await client.consultarFipeChassi(plate);
  return {...parsePlateResponse(result,plate),homolog:client.homolog||result.response.homolog||result.response.api_limit_for==='homolog'};
 }catch(error){if(error instanceof ApiBrasilError){if([401,403].includes(error.status))deny('A APIBrasil recusou a credencial de consulta. O administrador precisa revisar o token no servidor.',502);deny(error.message,error.status>=400?error.status:422);}throw error;}
}
