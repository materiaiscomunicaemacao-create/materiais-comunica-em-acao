# Comunic@ Em Ação — loja funcional

## Escopo aprovado
Ampliar a loja existente conforme /home/ubuntu/upload/pasted_content.txt: site profissional com páginas reais, catálogo de materiais próprios, filtros, carrinho, pagamentos, compras protegidas e administração. Preservar os nove materiais e a logo enviada. Adjetivos e substantivos abstratos (CEA-009) é para o 6º ano, confirmado pela proprietária; não usar a hipótese de 8º/9º contida no PDF. Mergulho e Eduardo e Mônica continuam com ano a confirmar.

## Experiência e identidade
Preservar a estética editorial acolhedora: creme, azul-marinho, verde-petróleo e amarelo; Libre Baskerville e DM Sans. Cabeçalho com busca, catálogo, sobre, contato, compras e carrinho. Menu com etapas e assuntos presentes nos produtos. Página inicial com apresentação, destaques editoriais, novidades, categorias e mais vendidos calculados somente a partir de pedidos efetivamente pagos; não fabricar popularidade.

Página /catalogo com filtros combinados e contagem real. Cada /produto/:id tem imagem de prévia sobreposta, título, descrição, conteúdos, público, objetivos derivados do material, quantidade de páginas quando disponível, formato, preço definido no painel e compra. /sobre e /contato são páginas próprias. Carrinho /carrinho contém um exemplar por produto digital, permite remover e persiste localmente; preços e total são recalculados pelo servidor ao criar pedido. /compras requer login e mostra apenas pedidos do usuário, com downloads somente quando o pagamento está confirmado.

Categorias novas somente com produtos correspondentes. Atividades lúdicas pode derivar dos jogos já identificados; não criar sequências/projetos vazios. Não inventar avaliações, desconto, duração, gabarito ou série. Preço nulo significa a definir e impede checkout. Fotografias/mockups existentes são reutilizados; não há necessidade de assets decorativos novos.

## Servidor, persistência e segurança
Node 22 + Express, MySQL gerenciado, autenticação Manus OAuth e sessão webdev_app_session validada por JWT HS256, expiração e appId. Papel administrativo somente para conta autenticada e explicitamente aprovada pela proprietária, persistido no cadastro de usuários; nunca promover o primeiro visitante nem conceder acesso apenas por um e-mail digitado. A proprietária recusou a conta atual da prévia e indicou outra conta, registrada no controle interno fora do frontend e do Git. A configuração anterior por identificador não foi aplicada; não usar uma variável pendente para promover o perfil recusado. Manter o painel protegido enquanto o login da conta escolhida não for confirmado.

Mostrar a conta atual em /compras e /admin e oferecer login em outra aba para escolher outra identidade, sem forçar saída da conta que mantém o projeto no Manus. A prévia pode usar automaticamente a conta do Manus; um login separado e legítimo é necessário para verificar a conta escolhida. O login não concede administração automaticamente. Permitir encerrar apenas a sessão da aplicação fora da prévia incorporada.

Banco armazena produtos, usuário, pedidos/itens, eventos processados e configurações públicas. Importação inicial dos nove produtos é idempotente e não sobrescreve edições posteriores. Remoção de produto é desativação, preservando pedidos. Não guardar dados bancários/cartões, tokens de provedores ou payloads brutos de webhook no banco. Contatos estritamente necessários para entrega pelo WhatsApp, com aceite transacional e políticas explícitas; sem marketing automático.

PDFs originais permanecem fora do Git e da pasta pública. Para entrega protegida, armazenar ciphertext AES-256-GCM no storage, com chave derivada do segredo do projeto, e nunca publicar o endereço do PDF em claro. Downloads passam por autorização no servidor e conferência de pedido pago; preços, papéis e status enviados pelo cliente não são confiáveis. Uploads administrativos limitados e validados. Sessões HTTPS usam SameSite=None; Secure; CSRF por token ligado à sessão nas mutações.

## Pagamento e entrega
Mercado Pago é a recomendação inicial para Pix; Asaas é alternativa. Preparar adaptador oficial sem conta/credenciais inventadas. Checkout bloqueado enquanto faltarem credenciais, preços, PDF protegido e confirmação editorial de cada produto. Estados de pedido pendente, pago, falhou, cancelado/reembolsado; parâmetros de retorno e comprovantes não concedem acesso. Webhook autenticado e reconsulta ao provedor verificam referência, moeda/valor e status; processamento idempotente concede acesso apenas a transação válida. A integração só será declarada ativa depois do teste real no ambiente correto.

Entrega imediata protegida na área de compras após confirmação. WhatsApp manual com pedido registrado permanece disponível depois de configurar o número; a automação WhatsApp exige Cloud API, permissões/opt-in e template, e deve ser indicada como pendente enquanto não configurada. Não conectar automação por robôs não oficiais.

## Estrutura do projeto
- `server.js`: entrada do servidor, assets públicos em whitelist e renderização de páginas.
- `server/db.js`, `server/migrations.js`, `scripts/migrate.js`: esquema e conexão persistente.
- `server/auth.js`, `server/api.js`: sessões, autorização, rotas e validação.
- `server/storage.js`: cifrar PDFs, transferir e entregar após autorização.
- `server/payments.js`: adaptador Pix e verificação de notificações.
- `server/render.js`: HTML inicial significativo e metadados de cada página pública.
- `public/store.js`, `public/store.css`: navegação, carrinho, filtros, compras e painel.
- `catalog.js`, `new-products.js`: fonte inicial dos nove produtos; o banco passa a preservar edições.
- `scripts/import-private-files.js`: ingestão dos PDFs de paths externos, sem registrá-los no Git.
- `tests/`: filtros, segurança, contratos e cálculos com evidências existentes.
- `Dockerfile`: execução de produção; porta 3000 e /health.
- `manus-routes.json`: conjunto completo de páginas reais.

Frontend e APIs serão servidos pelo mesmo container, não por build estático como substituto das rotas dinâmicas. Origem pública é configuração explícita ou window.location.origin no fluxo OAuth; não derivar do Host interno. Canonical e links absolutos de SEO só após domínio real configurado. Dados de compras/admin são noindex e privados.

## Dependências de ativação
Conta aprovada no provedor Pix, Access Token e segredo de webhook por entrada segura; preços; identidade administrativa; número WhatsApp; identificação da fornecedora e políticas finais. Conferência de direitos de canção/ilustrações antes de ativar produtos afetados. Publicação somente se solicitada explicitamente.

## Escolha atual de administração — 09/11/2026
A proprietária autorizou explicitamente o perfil antes recusado, já autenticado e identificado na tela. A nova escolha prevalece sobre a recusa anterior. A permissão foi vinculada somente ao cadastro dessa conta confirmada, sem promover visitantes nem alterar outras contas, preços, arquivos ou pagamentos. A conta atual já pode usar o painel após atualizar a página; não exigir novo cadastro ou novo login para uma identidade que já está autenticada. O registro nominal e o histórico permanecem apenas no controle interno privado.
