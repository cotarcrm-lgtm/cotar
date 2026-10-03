# Cotar — ambiente de desenvolvimento

Exportação do código da versão publicada 311, em 02/10/2026. Commit de origem: `b7c0c47e03506434df3681cbcb2ccb94a77b676b`.

Este pacote contém frontend, regras de negócio, backend, catálogos Honda/Disal, imagens, migrações, funções Supabase e testes. Não contém banco de produção, clientes, contas, senhas, tokens, arquivos `.env` preenchidos ou histórico Git. As senhas usadas pelos testes são geradas em memória durante a execução.

## Executar no computador

Instale **Node.js 24 LTS** e Git. No terminal, dentro desta pasta:

```bash
npm ci
cp .env.example .env
npm run build
npm run dev
```

Abra **http://localhost:3000/login**. A primeira abertura mostra o cadastro inicial: informe empresa, nome, CPF válido e crie sua própria senha. O e-mail do administrador local é `admin@example.test`. Não há senha padrão.

O servidor de desenvolvimento escuta apenas em `127.0.0.1`. Ele usa SQLite e arquivos locais em `.dev-data/`, cria a estrutura automaticamente e libera o cadastro inicial somente neste servidor local. **Não publique `scripts/dev.mjs` como servidor de produção.** Use `localhost` no navegador, pois as sessões usam cookies seguros. Para encerrar, pressione Ctrl+C. Para mudar a porta, ajuste `PORT` em `.env`.

Ao editar frontend, atualize o navegador. Ao editar backend, interrompa e execute `npm run dev` novamente. Execute `npm run build` depois de mudanças para regenerar os arquivos de distribuição e a função de API.

O banco local começa vazio. As telas de vendas, indicadores e carteiras precisam de dados cadastrados/importados; o catálogo já contém as tabelas comerciais incluídas no código. Planilhas, fotos de clientes e relatórios da operação não fazem parte do ZIP.

## Integrações

As integrações externas são opcionais no desenvolvimento inicial. Preencha somente as variáveis necessárias em `.env`: APIBrasil, Resend, Asaas, fonte de reservas e chave de criptografia do WhatsApp. Use ambientes de teste. Sem essas configurações, recursos que dependem dos serviços externos ficam indisponíveis; o código e as telas permanecem presentes.

A Loteria Federal depende da disponibilidade da API externa. Envio real de WhatsApp também requer configurar a conta e o número no módulo correspondente; não há conta conectada neste pacote.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `public/` | Interface, CSS, imagens e componentes |
| `server/` | API, autenticação, permissões, regras de negócio e adaptador PostgreSQL |
| `db/`, `drizzle/` | Modelo e migrações SQLite usadas no desenvolvimento local |
| `supabase/` | Migrações PostgreSQL, configurações SQL e Edge Functions |
| `scripts/` | Build e servidor local |
| `tests/` | Testes e dados sintéticos |

`server/assets.generated.js`, `dist/` e `supabase/functions/cotar-api/app.js` são gerados pelo build. Execute-o antes de rodar testes que importem esses arquivos.

## Validação

```bash
npm run build
node --test tests/catalogue-screen.test.mjs tests/consortium.test.mjs
npm test
```

Na preparação deste ZIP passaram os 9 testes de catálogo/consórcio, o build e a verificação local de página de login, módulo de imagens, cadastro inicial e leitura autenticada dos dados. A suíte completa é fornecida; esse resultado não representa validação de todas as integrações externas nem de todas as funções com dados reais.

## Conectar ao GitHub

Crie um repositório **privado e vazio** no GitHub, sem README inicial. Nesta pasta:

```bash
git init -b main
git add .
git status
git commit -m "Importar Cotar para desenvolvimento"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Substitua o endereço pelos dados do repositório. Autentique com o mecanismo do GitHub no seu computador; não coloque token na URL, no código ou nos arquivos do projeto. Antes do commit, confirme que `.env`, `.dev-data/` e `node_modules/` não aparecem em `git status`. O fluxo de CI incluído instala as dependências, compila e executa os testes de catálogo/consórcio; não faz implantação.

## Backend Supabase e produção

Produção usa `server/gateway.js` para encaminhar a API à Edge Function `cotar-api`, PostgreSQL privado no schema `cotar` e Storage privado. O login é próprio do Cotar, com hash scrypt, e **não** é Supabase Auth. SQLite local não substitui PostgreSQL na produção.

Para configurar outro ambiente, revise `supabase/README.md`, as migrações e os SQLs de plataforma/cobrança. Alguns scripts pressupõem tabelas/fontes existentes; não aplique tudo indiscriminadamente em um banco em uso. O código não é um backup desses dados. Crie um projeto separado de homologação, configure o bucket privado `cotar-private`, aplique o schema adequado e forneça as credenciais apenas como segredos do ambiente.

`SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY` e chaves das integrações ficam exclusivamente no backend. O gateway precisa de `COTAR_BACKEND_ACTIVE=true`, `COTAR_BACKEND_URL` e `COTAR_PROXY_KEY`; o SHA-256 da chave de proxy fica em `cotar.settings` sob `proxy_key_sha256`. A função valida o transporte e a sessão do Cotar. Preserve essa validação ao configurar JWT/implantação.

Ao mudar domínio/hosting, revise a lista de origens em `supabase/functions/cotar-api/index.ts`, os endereços de webhooks e os links de recuperação. O arquivo de identidade do Site original foi removido do pacote para evitar publicar acidentalmente sobre o ambiente existente. O código do gateway foi preservado; a configuração do novo provedor precisa ser feita no seu ambiente.

## Diferenças desta exportação

- Adicionado servidor local com banco vazio e armazenamento de anexos local.
- Adicionados `.env.example`, instruções, requisitos Node 24 e CI para GitHub.
- Removidos histórico Git, identidade de publicação, credenciais e dados de execução.
- Substituído o e-mail de inicialização por um endereço de desenvolvimento e as senhas literais dos testes por valores gerados em memória.
- Nenhuma alteração foi publicada no Cotar em produção durante a exportação.
