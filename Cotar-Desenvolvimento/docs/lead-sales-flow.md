# Leads, vendas e seminovos — 28/09/2026

As modalidades À vista, Financiamento e Seminova usam categoria (Moto ou Automóvel) e modelo Honda em listas controladas, conferidas nos catálogos oficiais:
- https://www.honda.com.br/motos/modelos
- https://www.honda.com.br/automoveis/

O catálogo inclui modelos/famílias publicados, sem importar preços. O TRX não entra em Moto por ser quadriciclo; o Prelude, anunciado como futuro lançamento, não foi incluído como modelo já comercializado. A seleção de consórcio continua vindo das tabelas das administradoras. O campo livre Interesse/modelo deixou de ser exibido; dados legados permanecem para referência até o usuário definir a nova seleção.

Novas vendas são iniciadas na linha do lead, por Registrar venda. A API exige lead visível/autorizado e captura dados da negociação (incluindo consórcio), responsável e loja. Os dados de origem ficam preservados em leadSnapshot. Quando a venda é concluída, o lead é fechado na mesma transação, com controle de versão para evitar sobrescrever alterações simultâneas.

A tabela vehicles é exclusivamente de seminovos; gravação rejeita condição Novo. Novas vendas de seminovos exigem veículo disponível da loja e dentro do alcance do usuário. Consórcio e novos dispensam veículo físico. O custo de um seminovo é calculado no servidor na criação da venda. O índice único de veículo vendido permanece. O indicador de resultado bruto considera somente seminovos.

A migração D1 0002 torna sales.vehicle_id opcional, preservando registros e os vínculos anteriores. A migração inicial do Supabase, ainda não aplicada, foi alinhada com a mesma nulabilidade. Backend ativo permanece o atual.
