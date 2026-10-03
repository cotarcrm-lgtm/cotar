# Catálogo Honda — 24/08/2026

Fonte: `10- Planos NACIONAL 24 AGOSTO 2026.pdf`, quatro páginas. O SHA-256 da fonte está no catálogo. Extração revisada contra as quatro páginas renderizadas.

Catálogo de referência versionado em `server/honda-catalogue.json`, entregue por `/api/data` somente a usuários com acesso a leads. São 32 modelos/produtos e 220 combinações de modelo, família e prazo: 113 Vou de Honda, 94 Vou de Honda+ com documentação, 9 Advance e 4 Motores & Máquinas. Cada combinação tem as duas parcelas publicadas, com e sem seguro. Não foram criados veículos de estoque a partir desta tabela de créditos.

Todos os valores monetários são centavos inteiros transcritos da fonte; não recalcular valores publicados a partir das taxas. Crédito significa bem base. Documentação fica separada do crédito; o total publicado é o plano sem seguro. Vencimentos são dias do mês, não datas de assembleia. Preservadas as restrições estaduais, códigos, taxa administrativa, reserva, seguro, regras de contemplação e lance diluído, quando informado.

O servidor resolve a seleção a partir do ID canônico, seguro e vencimento e grava uma cópia completa no JSON do lead no banco ativo. Valores enviados pelo navegador não substituem a tabela. O modelo escolhido também alimenta o interesse do lead. Mudar para outra modalidade remove os campos de consórcio. Leads anteriores não recebem modalidade ou negociação inventada.

Atualizações futuras devem acrescentar uma nova versão de catálogo e manter IDs e preços anteriores imutáveis para preservar negociações. O catálogo de referência faz parte da aplicação; negociações selecionadas ficam no banco.

O backend Supabase continua preparado, mas não ativado: projeto suspenso por faturas pendentes conforme consulta anterior. A publicação usa o backend existente. O teste PostgreSQL verifica a persistência do plano/documentação no formato JSONB preparado para a migração.

## Atualização de administradoras — 28/09/2026

O catálogo passa a agregar Honda e Disal. As edições de planos feitas pelo administrador da empresa são gravadas em `settings`, em chaves prefixadas por empresa e ID canônico do plano, com revisão e controle de concorrência. O catálogo original permanece como referência inicial. Essas configurações devem ser incluídas na migração futura ao Supabase.

A empresa controla `administratorIds`. Na ausência do campo legado, Honda e Disal ficam habilitadas; uma lista vazia bloqueia todas. A API rejeita novas negociações de administradoras não habilitadas e planos inativos/em conferência. As negociações existentes conservam a cópia da tabela, inclusive durante a edição de dados de contato.

Disal: 25 ofertas consultadas em 28/09/2026 nas páginas oficiais https://disalconsorcio.com.br/ e https://www.disalconsorcio.com.br/. Valores anunciados para crédito reduzido de 75%, com seguro, até a contemplação; opção pelo crédito integral muda a parcela, com correção anual pelo IPCA. Totais, taxas, vencimentos e contemplações ausentes não foram calculados nem inventados. A referência 990076 (crédito integral de R$ 65 mil) mostrou R$ 1.647,05 sem www e R$ 1.435,94 com www, em 60 meses. Foi cadastrada em conferência/inativa para novas negociações, com ambas as leituras nas observações. As outras 24 estão disponíveis.
