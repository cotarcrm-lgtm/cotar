# Cotar mobile — instalação pelo site

Esta versão é uma PWA para Android e iPhone, com início em `/login`, ícone próprio e janela independente. Não requer lojas. Reservas, vendas e pagamentos precisam de internet; consultas e novos registros offline seguem `OFFLINE.md`. Nenhuma resposta de API, documento, sessão ou página autenticada é armazenada pelo service worker; somente a tela pública de falta de conexão e seu CSS são guardados.

## Desenvolvimento

Use Node 24. Na pasta `Cotar-Desenvolvimento`: `npm ci`, `npm run build`, `npm run dev`. O servidor local usa banco SQLite vazio, sem conexão com produção. Testes: `node --test tests/mobile-app.test.mjs tests/catalogue-screen.test.mjs tests/consortium.test.mjs`.

## Publicação pendente

O código foi preparado localmente; ele ainda não está no site publicado. A integração de publicação do Sites precisa ser identificada e autorizada antes de implantar. O build em `dist/server/index.js` mantém o gateway Supabase existente. Não execute migrações nem altere segredos de produção para instalar a PWA.

O host HTTPS deve servir `/manifest.webmanifest` como `application/manifest+json`, `/sw.js` como JavaScript, `/icon-192.png` e `/icon-512.png` como PNG e os arquivos `/mobile-app.js`, `/mobile-app.css` e `/offline.html`. O gateway e o servidor local deste pacote incluem essas rotas. O service worker não deve ser redirecionado para login e deve manter seu escopo `/`. Não configure cache permanente para `/sw.js`.

## Verificação em celulares após publicação

- Android/Chrome: entrar no site, tocar em “Instalar Cotar no celular” e confirmar (ou usar a instalação pelo menu do Chrome). Abrir pelo ícone e verificar login e navegação.
- iPhone/Safari: abrir o site, Compartilhar → Adicionar à Tela de Início. Abrir pelo ícone e verificar login e navegação.
- Confirmar abertura em janela independente e ícone correto.
- Após a primeira abertura conectada, desligar a conexão e navegar: a tela de falta de conexão deve aparecer. Reconectar e tocar em “Tentar novamente”.
- Confirmar que nenhuma resposta `/api/` foi guardada em Cache Storage.

Não houve validação em aparelho físico nem publicação em produção. Instalação e comportamento podem variar conforme versão do navegador. Notificações push não estão incluídas. A atualização de uso offline está descrita em `OFFLINE.md`.

## Atualização offline

A área offline está implementada localmente em `/offline.html`. Ela exige preparar dados e definir um código com internet. As instruções anteriores de ausência total de dados comerciais locais descrevem apenas a primeira PWA; esta atualização guarda um cofre criptografado separado, sem cache de API. Consulte `OFFLINE.md` para o escopo, testes e integração pendente ao Sites/Supabase.
