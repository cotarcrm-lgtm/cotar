export interface FipeChassiRequest { tipo: 'fipe-chassi'; placa: string; homolog: boolean }
export interface FipeHistory { mes: string; valor: number }
export interface FipeDescription { descricao: string; sintetico: string }
export interface FipeVehicle {
  anoFabricacao: number; anoModelo: string; categoria: string; chassi: string;
  codigoFipe: string; combustivel: string; cor: string;
  extra: { categoria: FipeDescription; combustivel: FipeDescription };
  historico: FipeHistory[]; marca: string; mesReferencia: string; modelo: string;
  principal: boolean; url: string; valor: number;
}
// The specification defines total, but does not define the additional service keys.
export interface ExtraCharges { total: string; [service: string]: unknown }
export interface FipeChassiResponse {
  user: { first_name: string; email: string; cellphone: string; notification: string };
  balance: string; balance_before: string; tax: string; status_code: number;
  error: false; message: string; valor_consulta: number; api_limit_for: string;
  homolog: boolean; data: { resultados: FipeVehicle[] }; extra_charges?: ExtraCharges;
}
export interface FipeChassiResult {
  response: FipeChassiResponse; balance: number; tax: number;
  extraChargesTotal: number; totalCost: number; attempts: number;
}
export interface ApiBrasilEnvironment {
  APIBRASIL_TOKEN?: string; APIBRASIL_HOMOLOG?: string; NODE_ENV?: string;
}
export interface ApiBrasilDependencies {
  fetch?: typeof globalThis.fetch; sleep?: (milliseconds: number) => Promise<void>;
}
export interface ApiBrasilOptions { timeoutMs?: number; maxAttempts?: number; backoffMs?: number }
export type ApiBrasilErrorCode = 'CONFIG' | 'HTTP' | 'INSUFFICIENT_BALANCE' | 'BUSINESS' | 'TIMEOUT' | 'NETWORK' | 'INVALID_RESPONSE';
