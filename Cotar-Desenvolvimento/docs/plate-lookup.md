# APIBrasil — Placa FIPE (Com Chassi)

Cliente JavaScript compatível com o Worker atual e o build esbuild. Tipos em `server/apibrasil-types.d.ts`; JSDoc verificado com TypeScript strict/checkJs (`npm run typecheck:apibrasil`). Sem dependências adicionais de runtime.

Fonte do contrato: especificação completa fornecida pelo usuário em 28/09/2026. Endpoint fixo POST https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits. Somente Content-Type e Authorization Bearer. Corpo: tipo fipe-chassi, placa, homolog. Não usa DeviceToken ou credenciais no corpo/URL.

## Ambiente

- APIBRASIL_TOKEN: segredo obrigatório do servidor.
- APIBRASIL_HOMOLOG: true/false. Ausente: true, inclusive em produção, para exigir ativação explícita de consultas tarifadas. Desenvolvimento sempre começa em homologação, salvo configuração explícita.
- Timeout padrão: 20 segundos por tentativa (configurável entre 10–30s).
- Até duas tentativas por padrão (máximo configurável: 3), backoff 500ms exponencial (teto 4s). Somente timeout de transporte e status HTTP 500–599 permitem retry. HTTP 408/429 continuam terminais porque são 4xx. Falhas de conexão, JSON inválido e erros de negócio com HTTP 200 não repetem.
- Uma repetição após timeout/5xx ainda pode ser tarifada pelo provedor; não existe garantia de idempotência no contrato. Configure maxAttempts: 1 se a operação exigir ausência total de repetição.

Status HTTP é verificado antes de analisar o JSON. HTTP 402 gera INSUFFICIENT_BALANCE. Somente error === false permite ler data. O erro próprio inclui message, status e code. Mensagens de transporte não incluem token; não registre o resultado bruto, pois contém dados da conta do provedor.

balance, tax e extra_charges.total aceitam vírgula ou ponto decimal e preservam três casas quando presentes. Formatos mistos/milhar não especificados são rejeitados. totalCost = tax + extraChargesTotal (não soma valor_consulta uma segunda vez). Os números normalizados são JavaScript number; para escrituração de precisão arbitrária, use representação decimal exata. A forma dos itens de extra_charges não foi fornecida: preservada como unknown, sem inventar seu esquema.

## Integração COTAR

POST /api/vehicle-lookup exige sessão, tela Captações, mesma origem, placa válida e limite por usuário/IP. O servidor utiliza seu ambiente; o navegador não pode selecionar o modo tarifado. O retorno público ao usuário autenticado contém somente dados do veículo, candidatos FIPE e indicação de homologação. Dados da conta, saldo e custos não são expostos.

Cada candidato mantém seus próprios anos, cor, chassi, modelo, marca e combustível. O usuário precisa selecionar a versão antes de aplicar. Em homologação, os dados fictícios nunca são aplicados ao formulário. A consulta real exige APIBRASIL_HOMOLOG=false no servidor e saldo do provedor. Nenhuma consulta de produção foi executada para os testes.

## Exemplo de uso no backend

```js
import { ApiBrasilClient, ApiBrasilError } from '../server/apibrasil-client.js';

// env são as variáveis injetadas no Worker, nunca valores fixos no código.
export async function exemplo(env) {
  const client = new ApiBrasilClient(env);
  try {
    const result = await client.consultarFipeChassi('ABC1234', true);
    return {
      homolog: result.response.homolog,
      veiculos: result.response.data.resultados,
      saldo: result.balance,
      custoTotal: result.totalCost,
    };
  } catch (error) {
    if (error instanceof ApiBrasilError) {
      if (error.code === 'INSUFFICIENT_BALANCE') {
        return { erro: 'Recarregue o saldo da APIBrasil.', status: 402 };
      }
      return { erro: error.message, status: error.status, codigo: error.code };
    }
    throw error;
  }
}
```

Testes offline com fetch e sleep injetados: decimais, campos exatos, modo, erros HTTP/corpo, 402, adicionais, timeout, retry/backoff/teto, ausência de retry em 4xx ou rede, permissões e isolamento da conta. A suíte não usa credenciais reais nem faz chamadas cobradas.

## Atualização de 28/09/2026

Consulta testada diretamente no provedor em homologação: HTTP 200, error=false e confirmação explícita de ausência de tarifa. Tela dedicada em Seminovos → Avaliação, com entrada da placa junto ao botão da FIPE, etapas de preparação/proposta e retorno à gestão de captações após salvar. Rascunho mantido em memória ao navegar entre telas na mesma sessão. A página utiliza as permissões existentes de Captações.

Runtime do COTAR configurado para produção (`APIBRASIL_HOMOLOG=false`) para consultas reais solicitadas pelo usuário. Testes continuam passando homolog=true explicitamente ou utilizam respostas simuladas; nenhuma placa real foi consultada durante esta correção. Timeout do adaptador COTAR ampliado para 30s por tentativa. Erros 401/403 do provedor são apresentados como falha de credencial da integração, sem confundir com sessão do CRM. Bloqueio de consultas duplicadas enquanto uma requisição está em andamento.
