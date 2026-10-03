import {deny} from './policy.js';
export const reservationDuration=24*60*60*1000;
export function activeReservation(vehicle,now=Date.now()){
 const r=vehicle?.reservation;if(!r)return null;
 const start=Date.parse(r.at),expires=start+reservationDuration;
 return Number.isFinite(start)&&expires>now?{...r,expiresAt:new Date(expires).toISOString()}:null;
}
export const canCancelUsedReservation=actor=>['Administrador','Diretor','Gerente Regional','Gerente de Loja','Supervisor'].includes(actor.role);
export function reservable(v,sales=[]){return v?.stockStatus==='DISPONÍVEL PARA REVENDA'&&v.status==='Disponível'&&Number(v.salePrice)>0&&!sales.some(s=>s.vehicleId===v.id&&s.status==='Concluída');}
export async function changeUsedReservation(db,actor,v,body,sales=[]){
 if(body.version!==v.version)deny('O veículo mudou. Atualize o catálogo.',409);
 const current=activeReservation(v),now=new Date().toISOString();
 const {id,version,companyId,createdBy,createdAt,updatedAt,...data}=v;
 if(body.action==='reserve'){
  if(!reservable(v,sales))deny('Este veículo não está disponível para reserva.',409);
  if(current)deny('Este veículo já está reservado por 24 horas.',409);
  data.reservation={userId:actor.id,storeId:v.storeId,at:now,expiresAt:new Date(Date.parse(now)+reservationDuration).toISOString()};
 }else if(body.action==='cancel-reservation'){
  if(!canCancelUsedReservation(actor))deny('Seu cargo não pode cancelar reservas.',403);
  if(!current)deny('Esta reserva já expirou ou foi cancelada.',409);
  delete data.reservation;
 }else deny('Ação inválida.',400);
 const result=await db.prepare('UPDATE vehicles SET data=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND company_id=? AND NOT EXISTS (SELECT 1 FROM sales WHERE vehicle_id=? AND status=?)').bind(JSON.stringify(data),now,id,version,actor.companyId,id,'Concluída').run();
 if(!result.meta.changes)deny('Outra pessoa atualizou este veículo. Atualize o catálogo.',409);
 return {ok:true,reservation:data.reservation||null,version:version+1};
}
