# Portal do cliente Winner no Cotar

Primeira versão implementada na branch local `winner-clientes`, baseada em `cotar-offline`. Nenhuma alteração foi publicada em cotarcrm.com.br nem enviada ao Supabase de produção.

## Uso após a integração

1. No Cotar, abrir Comercial → Clientes. Selecionar a loja.
2. Um gestor habilita o portal em Configuração e informa o nome e o WhatsApp da concessionária.
3. Em Compras, conferir a identidade e o e-mail do comprador e gerar um convite para uma venda existente. Entregar o link somente ao comprador. O convite expira em sete dias e é usado uma vez.
4. O cliente cria uma senha própria. Para vincular outra compra ao mesmo e-mail, precisa informar sua senha existente.
5. A equipe atualiza manualmente Pedido recebido → Aguardando faturamento → Moto faturada → Pronta para entrega → Entregue, com número da nota opcional e mensagem pública. O status financeiro da venda não determina a entrega.
6. O cliente solicita revisão; um gestor confirma o horário ou responde pelo Cotar. A solicitação não representa horário confirmado. A proteção impede duas confirmações no mesmo instante para a loja, mas não modela duração, mecânicos ou capacidade da oficina.
7. O cliente envia dados e até seis fotos da seminova. Um gestor responde com uma estimativa preliminar, sujeita a vistoria. Isso não cria compra, captação ou estoque automaticamente.
8. O contato abre o WhatsApp configurado. Não há chat interno entre cliente e concessionária nesta versão.

O cliente acessa `/cliente/ID-DA-LOJA`, que também permite instalar o portal pelo site. No iPhone, usar Safari → Compartilhar → Adicionar à Tela de Início. A instalação real no iPhone ainda precisa ser conferida após a integração.

## Integração no projeto publicado

O pacote contém o código completo atualizado, documentação e testes, sem banco local, senhas ou dependências instaladas. Usar como referência no projeto Cotar 2.0 e integrar os arquivos de `public`, `server` e `scripts`, preservando as configurações de hospedagem e Supabase existentes. Não substituir dados de produção. Gerar os assets com `npm ci` e `npm run build`.

O projeto exportado usa uma camada de servidor que protege os endpoints e os arquivos privados. A publicação precisa preservar essa camada; hospedar apenas o HTML não entrega os recursos. Confirmar encaminhamento de `/api/customer/*`, `/api/customer-admin/*` e `/cliente/*` ao servidor, armazenamento privado de fotos PHOTOS, cookies seguros em HTTPS e execução das verificações antes de ativar uma loja.

As informações ficam na tabela privada de configurações já existente; não foi adicionada migração. O volume deve ser monitorado: a primeira versão consulta registros por prefixo nessa tabela. Para maior escala, planejar tabelas e índices específicos.

## Acesso e limites

Sessão do cliente separada do funcionário, expira após oito horas. Cada cliente só recebe os campos públicos das compras vinculadas à sua conta e loja. Fotos exigem autenticação e acesso à solicitação correspondente. Convites não usam CPF para deduzir titularidade. Revogar um vínculo retira o acesso à compra; solicitações de atendimento já criadas permanecem na conta para histórico.

Ainda não existe recuperação de senha por e-mail. Antes de uma abertura ampla, implementar recuperação com verificação de identidade; gerar novo convite não troca a senha existente. O portal não armazena compras nem fotos para uso offline: sem internet, mostra uma tela genérica de reconexão. O recurso offline do Cotar para funcionários continua separado.

## Verificação realizada

- Build completo concluído.
- 18 testes passaram: portal em SQLite e PostgreSQL, isolamento de clientes e lojas, convites, sessões, CSRF, atualizações concorrentes, revisões, horários, reenvios, fotos privadas, PWA e regressões de offline/PostgreSQL.
- Chromium com tela de 390 × 844: configuração, convite, ativação, faturamento, revisão, envio de foto, estimativa, WhatsApp e tela offline. Nenhum erro JavaScript nesse fluxo.
- Duas falhas dos testes existentes de UI/vendas também foram reproduzidas na versão anterior, sem o portal: resolução de html2canvas no teste de UI e expectativa 400 versus resposta 403 no teste de vendas. Não foram alteradas nesta entrega.
