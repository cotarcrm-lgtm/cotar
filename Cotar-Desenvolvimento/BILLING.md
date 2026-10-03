# Adesão e assinaturas COTAR

## Implementado
- Landing page → /cadastro.html → cadastro pendente → cobrança Asaas → confirmação financeira → empresa, estrutura inicial e primeiro administrador.
- Mensal: R$79,90; trimestral: R$219,90; anual: R$879,90. Cobrança por empresa, sem limite de usuários criado nesta alteração.
- CPF/CNPJ validados; senha com a mesma política do CRM (15–128 caracteres), armazenada como scrypt; sessão de adesão em cookie HttpOnly/Secure, sem senha no navegador.
- Confirmação consulta a API do Asaas e confere cliente, assinatura e valor. Eventos repetidos não criam outro administrador nem prorrogam o período novamente.
- /assinatura.html: consulta, atualização das cobranças e cancelamento de próximas renovações. Período já pago é preservado. Recontratação depois de cancelamento precisa de suporte nesta versão.
- Empresas preexistentes não recebem bloqueio de assinatura. Novas empresas usam company_id e os controles de alcance atuais.

## Configuração necessária antes de vender
No ambiente de execução do Site, configurar como segredos ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN (token aleatório com pelo menos 32 caracteres). Configurar ASAAS_ENVIRONMENT=production somente com a chave de produção. Qualquer outro valor usa sandbox; sandbox nunca provisiona administrador em produção.
No painel Asaas, cadastrar webhook POST para https://cotar-crm.jcarlossf.chatgpt.site/api/billing/webhook com o mesmo token de autenticação (header asaas-access-token), incluindo eventos PAYMENT_CREATED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_REFUNDED, PAYMENT_DELETED, PAYMENT_OVERDUE e eventos de chargeback. Não configurar envio sequencial se um evento inválido impedir os seguintes; acompanhar logs e fila do Asaas.
Publicar novamente para aplicar o ambiente. Testar cliente/assinatura e confirmação no sandbox com a chave correspondente; testar a confirmação de uma cobrança real controlada antes de anunciar contratação disponível.
Não colocar chaves no HTML, Git, arquivos de configuração públicos nem no chat.

## Infraestrutura
Produção desde 30/09/2026: PostgreSQL/Storage no Supabase, via Edge Function privada por transporte autenticado. O gateway do Site encaminha as configurações de integrações apenas entre servidores. O adaptador PostgreSQL tem billingSupported=true e usa `cotar.crm_subscriptions` e `cotar.crm_billing_payments` com RLS e privilégios públicos revogados. D1/R2 foram preservados como cópia legada, sem uso no backend ativo.

## Validação
Testes de adesão, checkout, documentos, autorização do webhook, valor do servidor, cookie de retomada, sandbox, criação única, isolamento, estorno, UI e compatibilidade PostgreSQL passaram. Suite anterior apresenta 7 falhas preexistentes (captações, dashboard, gestão de cargos, vendas e UI), reproduzidas a partir de HEAD em checkout separado. Não são declarações de aprovação global do CRM.

## Limites
Não implementa verificação por e-mail nem recuperação de senha por e-mail. Recuperação permanece via gestor/suporte conforme CRM atual. Nenhuma cobrança real foi executada sem as credenciais Asaas. Documento e e-mail usados em cadastro pendente ficam únicos; correção destes dados exige suporte nesta versão.

## Segredos do Supabase

A Edge Function lê ASAAS_API_KEY e ASAAS_ENVIRONMENT dos segredos do projeto, com prioridade sobre valores encaminhados pelo gateway. O ambiente padrão é sandbox; produção exige configuração explícita. ASAAS_WEBHOOK_TOKEN continua como segredo do servidor Sites e é encaminhado apenas no transporte autenticado. A configuração privada do webhook exige o segredo de transporte e o cabeçalho x-cotar-billing-setup, que nunca é encaminhado pelo gateway público. Nenhuma credencial é retornada pela operação.
