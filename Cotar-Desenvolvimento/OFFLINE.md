# Cotar offline — primeira versão

Implementação local preparada sobre a exportação original do Cotar (versão 311). Nenhuma alteração foi publicada no Sites, enviada ao GitHub ou aplicada ao Supabase de produção. A versão atualmente publicada no projeto “Cotar 2.0” pode conter alterações posteriores; integre este pacote ao código atual antes de publicar, sem sobrescrevê-lo indiscriminadamente.

## Fluxo no celular

1. Entre no Cotar com internet e abra “Usar offline” no rodapé, ou `/offline.html`.
2. Crie um código de 8 a 12 números, diferente da senha de login. Baixe os dados enquanto está conectado e aguarde o preparo da área offline. Teste a abertura antes de sair da rede.
3. Sem internet, abra o app. Se `/login` não carregar, o service worker abre a área offline. Desbloqueie com o código.
4. Consulte catálogo e estoque baixados. Cadastre novos leads com próximo contato e novos rascunhos de avaliações, salvando explicitamente no aparelho. As pendências aparecem em uma lista própria.
5. Ao retornar à internet com a área desbloqueada e aberta, o app tenta enviar as pendências. Use “Sincronizar agora” se necessário. Uma sessão expirada exige novo login com o mesmo usuário e empresa; os registros locais continuam guardados.
6. Depois de enviar, o lead e o rascunho aparecem nas telas normais do Cotar. A avaliação permanece em andamento para completar com internet.

Catálogo e estoque são consultas da última atualização, válidas por 48 horas. Preço, disponibilidade e permissões podem mudar durante esse período; confirme online antes de negociar. Dados vencidos deixam de permitir novas consultas/cadastros, mas as pendências são preservadas. A atualização dos dados baixados preserva a fila local.

## Incluído e limites

- Consulta textual de planos de consórcio e estoque de seminovos autorizados da empresa selecionada. Não baixa fotos ou dados pessoais de clientes do servidor.
- Novos leads de modalidades existentes, com modelos Honda e seleção de plano/seguro/vencimento no consórcio. O servidor revalida tudo ao enviar. Um agendamento que ficou no passado ou um plano que mudou fica pendente de revisão.
- Novas avaliações: placa, modelo, chassi, ano, quilometragem, nome/telefone do cliente, observações e checklist inicial de motor, suspensões e bateria. Permanecem como rascunhos; não finalizam nem captam veículos automaticamente.
- Até 200 pendências por aparelho. Registros ainda não enviados podem ser editados. Após tentativa de envio com resultado incerto, só se repete o mesmo conteúdo e identificação. Erros de validação sem criação permitem revisar os campos.
- Reservas, vendas, pagamentos, consultas externas, fotos/anexos, edição de registros existentes da nuvem e notificações push não fazem parte do uso offline.
- O iPhone não garante execução em segundo plano nem retenção permanente dos dados do navegador. Abra o app para sincronizar; não dependa do envio com o app fechado. Limpeza do navegador ou remoção de armazenamento pode perder registros ainda não enviados.

## Armazenamento e sincronização

A área offline é separada das telas normais para limitar o que funciona sem conexão. O service worker v2 guarda somente HTML, CSS e módulos públicos dessa área. Não guarda respostas `/api/`, páginas autenticadas, cookies ou documentos.

Os dados comerciais e a fila ficam em um único cofre IndexedDB criptografado com AES-GCM. A chave é derivada do código por PBKDF2/SHA-256 (250.000 iterações, salt aleatório); fica apenas na memória. A chave não é exportável. A identificação do cofre usa seu salt e uma revisão para impedir substituição silenciosa entre abas. Somente salt, nonce, revisão e quantidade de pendências ficam fora da criptografia. Troca de página e retorno após 5 minutos em segundo plano bloqueiam o acesso local. Não há recuperação do código.

O servidor continua sendo a autoridade das permissões. A sincronização verifica a sessão, o usuário e a empresa antes de qualquer POST. Uma identificação UUID e o hash do conteúdo original são mantidos no JSON dos registros existentes, sem mudança de schema. Repetir uma criação confirmada retorna o registro existente e preserva mudanças posteriores; mudar o conteúdo de um envio já criado retorna conflito. A revogação de acesso é aplicada no envio online; sem rede, dados previamente baixados só podem ser limitados pela validade local.

Sair da conta limpa o cofre. Se houver pendências, o Cotar pede confirmação antes de apagá-las. A exclusão local não exclui registros do servidor. Atualizações do service worker preservam o IndexedDB.

## Integração e publicação no Sites/Supabase

Este pacote contém arquivos novos/modificados e um patch comparado ao ZIP original. Integre as alterações ao projeto atual de “Cotar 2.0”, preservando a PWA já publicada e demais mudanças.

1. Compile com Node 24: `npm ci` e `npm run build` na pasta `Cotar-Desenvolvimento`.
2. O backend atualizado precisa ser publicado na função `cotar-api` antes de habilitar a interface offline. Não aplique migrações SQL nem substitua os segredos atuais. O build gera `supabase/functions/cotar-api/app.js` com as alterações; preserve `index.ts`, autenticação, proxy e validações do ambiente existente.
3. Verifique que `/api/data`, para usuário autenticado, anuncia `offlineSyncVersion: 1`. Sem essa capacidade, a interface bloqueia o preparo/envio para evitar que um backend antigo crie duplicatas.
4. Integre/publice o gateway em `dist/server/index.js` pelo fluxo existente do Sites. Ele serve a área offline, os módulos, o manifesto e ícones com tipos corretos. Não publique `scripts/dev.mjs`, que habilita cadastro inicial local.
5. Confirme o link “Usar offline”, o funcionamento da sessão e o service worker `/sw.js` com escopo `/` e sem cache permanente. Feche e abra o app para permitir a ativação da nova versão do worker. Prepare os dados online antes de testar sem conexão.
6. Teste no iPhone real pelo ícone instalado: preparar, desconectar, fechar/abrir, consultar, salvar lead/avaliação, reconectar e sincronizar. Verifique uma única criação por registro e a permanência da avaliação em andamento. Não simule dados reais para esse teste: use registros identificados como teste e o procedimento de homologação da equipe.

## Validação feita

- Build com Node 24.
- 25 testes passaram: offline (SQLite e PostgreSQL), criptografia, isolamento entre usuário/empresa, backend antigo bloqueado, falhas de gravação, envios incertos, PWA, catálogo/consórcio, rascunhos e adaptação PostgreSQL.
- Chromium com tela de 390 × 844: consulta, abertura offline, código incorreto, persistência após recarregar, criação offline de lead e avaliação, retorno da rede, resposta de sucesso perdida sem duplicar e limpeza no logout. O evento de reconexão foi disparado explicitamente no teste, pois a emulação de rede do Chromium não reproduziu o evento do sistema após a navegação offline.
- `tests/crm.test.mjs`: um teste antigo falha na contagem de planos (940 em vez de 245). O mesmo erro foi reproduzido no ZIP original sem estas alterações. Os outros quatro testes desse arquivo passaram. Essa expectativa não foi alterada.
- Não houve teste em Safari/iPhone físico nem validação da publicação no Sites.

## Repetir os testes

```bash
npm run build
node --test tests/offline.test.mjs tests/mobile-app.test.mjs tests/catalogue-screen.test.mjs tests/consortium.test.mjs tests/used-draft-ui.test.mjs tests/postgres.test.mjs
```

O script opcional `scripts/check-offline-browser.mjs` exige Playwright e Chromium e recusa um banco local já inicializado. Execute-o somente contra uma cópia local com banco vazio, nunca contra produção. A validação usou Playwright 1.63.0 instalado em `/tmp/cotar-offline-browser` e Chromium em `/usr/bin/chromium`:

```bash
npm install --prefix /tmp/cotar-offline-browser playwright@1.63.0
# Inicie uma cópia local limpa do projeto com PORT=3003 npm run dev.
COTAR_PLAYWRIGHT_MODULE=/tmp/cotar-offline-browser/node_modules/playwright/index.mjs COTAR_TEST_BASE=http://localhost:3003 node scripts/check-offline-browser.mjs
```
