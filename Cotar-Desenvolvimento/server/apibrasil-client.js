// @ts-check
/** @typedef {import('./apibrasil-types').FipeChassiResponse} FipeChassiResponse */
/** @typedef {import('./apibrasil-types').FipeVehicle} FipeVehicle */
/** @typedef {import('./apibrasil-types').ApiBrasilErrorCode} ErrorCode */

export class ApiBrasilError extends Error {
  /** @param {string} message @param {number} status @param {ErrorCode} code */
  constructor(message, status, code) {
    super(message); this.name = 'ApiBrasilError'; this.status = status; this.code = code;
  }
}

/** Decimal separator only: accepts 154,380, 497,84, 0,000 and 0.19.
 * Mixed separators/thousands are unspecified and rejected, never guessed.
 * @param {string} value @returns {number}
 */
export function parseApiDecimal(value) {
  if (typeof value !== 'string' || !/^-?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    throw new ApiBrasilError('Valor decimal inválido na resposta da APIBrasil.', 200, 'INVALID_RESPONSE');
  }
  const result = Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(result)) throw new ApiBrasilError('Valor decimal fora do limite.', 200, 'INVALID_RESPONSE');
  return result;
}
/** @param {import('./apibrasil-types').ApiBrasilEnvironment} env */
export function homologFromEnvironment(env) {
  if (env.APIBRASIL_HOMOLOG === undefined || env.APIBRASIL_HOMOLOG === '') return true;
  if (env.APIBRASIL_HOMOLOG === 'true') return true;
  if (env.APIBRASIL_HOMOLOG === 'false') return false;
  throw new ApiBrasilError('APIBRASIL_HOMOLOG deve ser true ou false.', 503, 'CONFIG');
}
/** @param {string} field @returns {never} */
function invalid(field) { throw new ApiBrasilError(`Resposta inválida da APIBrasil: ${field}.`, 200, 'INVALID_RESPONSE'); }
/** @param {unknown} v @param {string} field @returns {Record<string, unknown>} */
function object(v, field) { if (!v || typeof v !== 'object' || Array.isArray(v)) invalid(field); return /** @type {Record<string, unknown>} */ (v); }
/** @param {unknown} v @param {string} field @returns {string} */
function string(v, field) { if (typeof v !== 'string') invalid(field); return v; }
/** @param {unknown} v @param {string} field @returns {number} */
function number(v, field) { if (typeof v !== 'number' || !Number.isFinite(v)) invalid(field); return v; }
/** @param {unknown} v @param {string} field @returns {boolean} */
function boolean(v, field) { if (typeof v !== 'boolean') invalid(field); return v; }
/** @param {unknown} v @param {string} field @returns {unknown[]} */
function array(v, field) { if (!Array.isArray(v)) invalid(field); return /** @type {unknown[]} */ (v); }
/** @param {unknown} v */
function description(v) { const r = object(v, 'extra'); return { descricao: string(r.descricao, 'descricao'), sintetico: string(r.sintetico, 'sintetico') }; }
/** @param {unknown} v @returns {FipeVehicle} */
function vehicle(v) {
  const r = object(v, 'resultado'), extra = object(r.extra, 'extra');
  return {
    anoFabricacao: number(r.anoFabricacao, 'anoFabricacao'), anoModelo: string(r.anoModelo, 'anoModelo'),
    categoria: string(r.categoria, 'categoria'), chassi: string(r.chassi, 'chassi'),
    codigoFipe: string(r.codigoFipe, 'codigoFipe'), combustivel: string(r.combustivel, 'combustivel'), cor: string(r.cor, 'cor'),
    extra: { categoria: description(extra.categoria), combustivel: description(extra.combustivel) },
    historico: array(r.historico, 'historico').map(v => { const h = object(v, 'historico'); return { mes: string(h.mes, 'mes'), valor: number(h.valor, 'valor') }; }),
    marca: string(r.marca, 'marca'), mesReferencia: string(r.mesReferencia, 'mesReferencia'), modelo: string(r.modelo, 'modelo'),
    principal: boolean(r.principal, 'principal'), url: string(r.url, 'url'), valor: number(r.valor, 'valor')
  };
}
/** Only invoked after HTTP success AND error === false.
 * @param {Record<string, unknown>} r @returns {FipeChassiResponse}
 */
function success(r) {
  const user = object(r.user, 'user'), data = object(r.data, 'data');
  const extra = r.extra_charges === undefined ? undefined : object(r.extra_charges, 'extra_charges');
  return {
    user: { first_name: string(user.first_name, 'first_name'), email: string(user.email, 'email'), cellphone: string(user.cellphone, 'cellphone'), notification: string(user.notification, 'notification') },
    balance: string(r.balance, 'balance'), balance_before: string(r.balance_before, 'balance_before'), tax: string(r.tax, 'tax'),
    status_code: number(r.status_code, 'status_code'), error: false, message: string(r.message, 'message'),
    valor_consulta: number(r.valor_consulta, 'valor_consulta'), api_limit_for: string(r.api_limit_for, 'api_limit_for'),
    homolog: boolean(r.homolog, 'homolog'), data: { resultados: array(data.resultados, 'resultados').map(vehicle) },
    ...(extra ? { extra_charges: { ...extra, total: string(extra.total, 'extra_charges.total') } } : {})
  };
}

export class ApiBrasilClient {
  #token;
  /** @param {import('./apibrasil-types').ApiBrasilEnvironment} env
   * @param {import('./apibrasil-types').ApiBrasilDependencies} [dependencies]
   * @param {import('./apibrasil-types').ApiBrasilOptions} [options]
   */
  constructor(env, dependencies = {}, options = {}) {
    if (!env.APIBRASIL_TOKEN?.trim()) throw new ApiBrasilError('Configure o token da APIBrasil no servidor.', 503, 'CONFIG');
    this.#token = env.APIBRASIL_TOKEN.trim();
    this.homolog = homologFromEnvironment(env);
    this.fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = dependencies.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.timeoutMs = options.timeoutMs ?? 20000;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.backoffMs = options.backoffMs ?? 500;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 10000 || this.timeoutMs > 30000 ||
        !Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 3 ||
        !Number.isFinite(this.backoffMs) || this.backoffMs < 100 || this.backoffMs > 2000) {
      throw new ApiBrasilError('Configuração inválida de timeout ou tentativas.', 503, 'CONFIG');
    }
  }
  /** @param {string} placa @param {boolean} [homolog]
   * @returns {Promise<import('./apibrasil-types').FipeChassiResult>}
   */
  async consultarFipeChassi(placa, homolog = this.homolog) {
    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa) || typeof homolog !== 'boolean') {
      throw new ApiBrasilError('Placa ou modo de homologação inválido.', 400, 'HTTP');
    }
    /** @type {import('./apibrasil-types').FipeChassiRequest} */
    const body = { tipo: 'fipe-chassi', placa, homolog };
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await this.#request(body);
        const balance = parseApiDecimal(response.balance), tax = parseApiDecimal(response.tax);
        const extraChargesTotal = response.extra_charges ? parseApiDecimal(response.extra_charges.total) : 0;
        // tax is the charged base price; valor_consulta is preserved in response,
        // not added again. Additional services are added exactly once.
        return { response, balance, tax, extraChargesTotal, totalCost: tax + extraChargesTotal, attempts: attempt };
      } catch (error) {
        if (!(error instanceof ApiBrasilError)) throw error;
        const retryable = error.code === 'TIMEOUT' || (error.code === 'HTTP' && error.status >= 500 && error.status <= 599);
        if (!retryable || attempt === this.maxAttempts) throw error;
        await this.sleep(Math.min(this.backoffMs * 2 ** (attempt - 1), 4000));
      }
    }
    throw new ApiBrasilError('Consulta não concluída.', 502, 'NETWORK');
  }
  /** @param {import('./apibrasil-types').FipeChassiRequest} body @returns {Promise<FipeChassiResponse>} */
  async #request(body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch('https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.#token}` },
        body: JSON.stringify(body), signal: controller.signal, redirect: 'manual'
      });
      // Do not follow redirects or forward the Bearer token to another destination.
      if (response.status >= 300 && response.status < 400) throw new ApiBrasilError('A APIBrasil retornou um redirecionamento inesperado.', 502, 'INVALID_RESPONSE');
      // Stage 1: status. Never retry a 4xx, including 402/408/429.
      if (response.status === 402) throw new ApiBrasilError('Saldo insuficiente na APIBrasil. Recarregue para continuar.', 402, 'INSUFFICIENT_BALANCE');
      if (!response.ok) throw new ApiBrasilError(`APIBrasil retornou HTTP ${response.status}.`, response.status, 'HTTP');
      /** @type {unknown} */
      let raw;
      try { raw = await response.json(); } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) throw new ApiBrasilError('Tempo limite da APIBrasil excedido.', 504, 'TIMEOUT');
        throw new ApiBrasilError('Resposta JSON inválida da APIBrasil.', response.status, 'INVALID_RESPONSE');
      }
      const result = object(raw, 'resposta');
      // Stage 2: missing/nonboolean error is not success either.
      if (result.error !== false) {
        const message = typeof result.message === 'string' ? result.message.split(this.#token).join('[redigido]').slice(0,500) : 'A APIBrasil não confirmou o sucesso da consulta.';
        throw new ApiBrasilError(message, response.status, result.error === true ? 'BUSINESS' : 'INVALID_RESPONSE');
      }
      return success(result);
    } catch (error) {
      if (error instanceof ApiBrasilError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) throw new ApiBrasilError('Tempo limite da APIBrasil excedido.', 504, 'TIMEOUT');
      throw new ApiBrasilError('Falha de conexão com a APIBrasil. A consulta não foi repetida.', 502, 'NETWORK');
    } finally { clearTimeout(timeout); }
  }
}
