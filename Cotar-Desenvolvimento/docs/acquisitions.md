# Captações e estoque

Captação é um registro em assessments sem vínculo obrigatório com estoque. A migração D1 0003 preserva todas as avaliações anteriores e torna vehicle_id opcional. Estados: Pendente, Avaliado, Aceito e Recusado. Estados históricos Viável/Inviável são apresentados como Avaliado/Recusado. Avaliado e Aceito exigem proposta positiva.

Cada usuário ativo com acesso a Captações pode obter seu link /avaliar/:token. O token opaco é vinculado no servidor ao usuário e à empresa; a loja é obtida do cadastro atual desse usuário. Envio público só aceita dados do proprietário, veículo, valor desejado, observações e fotos; não aceita status, proposta ou responsável. Consentimento e origem são registrados. Reenvios usam identificador determinístico para evitar duplicação. Há validação de origem e limite por IP/telefone.

Fotos são convertidas no cliente para JPEG, limitadas a seis e a 250 KB de representação base64 por imagem. O servidor valida tipo, assinatura, quantidade e referências. Bytes ficam no R2 PHOTOS; D1 mantém IDs e metadados. A rota de leitura exige sessão e alcance sobre a captação ou seu seminovo vinculado. URLs não concedem acesso público às fotos. Uploads que precedem falha de gravação podem deixar objetos sem referência, inacessíveis por essa API; não há rotina de retenção automática nesta versão.

Confirmar compra exige Aceito, versão atual e acesso ao estoque. A transação cria um seminovo e vincula a captação uma única vez. Compra, débitos, preparação, transferência e quitação compõem o custo inicial. Após compra, o orçamento original não pode ser alterado; ajustes de custos devem ocorrer no estoque. Fotos e origem permanecem vinculadas. Uma captação comprada não pode ser excluída.

Venda de seminovo continua originada num lead e exige estoque Disponível. Valor de venda positivo é obrigatório. Custo é congelado na venda pelo servidor, inclusive em edições posteriores. Margem exibida é bruta (venda menos custo), não lucro líquido. O estoque derivado usa as vendas concluídas e conserva a visibilidade de vendido mesmo quando o usuário não tem a tela Vendas, sem revelar seus valores.

Backend ativo permanece D1/R2. A integração Supabase anterior continua inativa; antes da futura ativação é necessário tornar assessments.vehicle_id nullable no PostgreSQL e prover o adaptador de armazenamento privado de fotos, além de adequar os limites de tamanho do proxy. Não ativar o proxy sem esse trabalho.
