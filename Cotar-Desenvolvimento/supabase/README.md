# COTAR — backend Supabase

Destino selecionado: `sniypzxgkmybtxqpcnpa`, já conectado à conta.
A tabela existente `public.reservas` não é alterada.

## Estado em 30/09/2026

Migração concluída para `sniypzxgkmybtxqpcnpa` (organização Bússola CRM, Pro). Produção utiliza PostgreSQL privado `cotar` e Storage privado `cotar-private`, por meio da Edge Function `cotar-api`. O Site continua servindo a interface e encaminha as APIs por transporte autenticado no servidor. Login e hashes existentes foram preservados; não foi realizada troca para Supabase Auth.

Foram transferidos e comparados por SHA-256/canonicalização: 111 registros em 18 tabelas, além de 95 arquivos com 37.931.719 bytes. Configurações e tabelas já existentes no Supabase, incluindo `public.reservas`, grupos Honda e chaves das integrações, foram preservadas. `sessions` e `auth_limits` não foram importados: usuários precisam entrar novamente.

As tabelas privadas têm RLS e privilégios públicos revogados. Os testes reais de administrador e supervisor verificaram carregamento autorizado, rejeição de outro company_id e sessão inválida. Download de foto privada verificado pela API. Advisors retornaram apenas avisos informativos de RLS sem política, esperados neste schema privado sem acesso direto do cliente.

D1 e R2 anteriores foram mantidos como cópias legadas. Não alternar novamente para D1 após novas gravações sem reconciliar os dados. Chaves temporárias de migração e a janela de importação foram removidas ao concluir; a importação não fica disponível ao público.

Durante a migração, foi corrigida a serialização do postgres.js: parâmetros da coluna JSONB `data` devem ser objetos, e não strings JSON, para evitar JSON duplamente codificado. A importação preserva códigos de vendas e não sobrescreve registros de destino divergentes. Arquivos foram transferidos em JSON/base64 e conferidos contra os bytes originais.

## Estrutura

- `migrations/20260927190839_cotar_backend.sql`: estrutura `cotar` isolada, incluindo chat e contadores de vendas, tabelas com RLS e sem acesso aos papéis públicos.
- `functions/cotar-api/`: backend completo, autorização por cargo, login e sessões existentes; PostgreSQL via conexão padrão das Edge Functions. Não usa Supabase Auth: preserva o login atual e seus hashes de senha.
- `server/postgres-adapter.js`: comandos parametrizados e transações; tabelas sempre qualificadas no schema `cotar`.
- `server/gateway.js`: transporte HTTP entre o Site e a Edge Function, com chave secreta somente no servidor.

## Procedimento histórico de migração (já executado)

1. Concluído: projeto ativo, schema aplicado, advisors consultados. O aviso informativo de RLS sem política é esperado no schema privado: nenhum acesso é concedido a `anon` ou `authenticated`.
2. Antes da ativação, testar o adaptador PostgreSQL com chat, captações e vendas e implementar o armazenamento privado de fotos, documentos e anexos de chat para a Edge Function, incluindo acesso aos arquivos antigos no R2. O adaptador de anexos da avaliação usa `cotar-private`, com fotos/documentos de até 2 MB e vídeo de até 10 MB; demais anexos ainda exigem migração própria.
3. Gerar uma chave aleatória de 32 bytes. Guardar apenas seu SHA-256 em `cotar.settings` com a chave `proxy_key_sha256`. Configurar a chave original como segredo `COTAR_PROXY_KEY` no Site. Nunca publicar a chave em código ou cliente.
4. Publicar a Edge Function `cotar-api` com verificação JWT desativada apenas porque o corpo valida a chave de transporte. Ela continua exigindo a sessão e autorização do COTAR para operações de negócio. Ajustar os limites do proxy para os uploads privados.
5. Definir `COTAR_MAINTENANCE=true` no Site e publicar antes de extrair o D1, bloqueando novas escritas durante a migração.
6. Extrair integralmente as tabelas do D1 pelo conector, verificando paginação e ausência de truncamento. Migrar em transação os cadastros, accounts e settings, preservando IDs, versões e hashes. Não migrar sessions/auth_limits: será necessário entrar novamente. Não copiar uma configuração antiga de `proxy_key_sha256` por cima da nova.
7. Normalizar os status antigos dos leads: Ganho → Fechado; Perdido → Perdido; demais → Agendado. Temperatura ausente → Morno. Não inventar agendamento para leads antigos sem data.
8. Comparar contagens e registros, testar acesso autorizado e negado e confirmar que dados privados não estão expostos pela Data API.
9. Definir `COTAR_BACKEND_URL=https://sniypzxgkmybtxqpcnpa.supabase.co/functions/v1/cotar-api`, `COTAR_BACKEND_ACTIVE=true`, `COTAR_MAINTENANCE=false` e publicar. Conferir sucesso terminal. Manter o D1 como cópia legada até confirmar o funcionamento; não alternar entre backends após novas escritas sem reconciliar os dados.

As credenciais e os dados exportados não devem ser adicionados ao Git.
