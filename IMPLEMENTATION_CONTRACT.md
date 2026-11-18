# Contrato de implementação — loja

## Responsabilidades
Backend: `server/db.js`, `server/migrations.js`, `server/auth.js`, `server/api.js`, `server/storage.js`, `scripts/migrate.js`. Frontend: `server/render.js`, `public/store.js`, `public/store.css`. Pix: `server/payments.js`. Pai: `server.js`, dependências, Docker, config, importação de PDFs, integração/revisão.

Node ESM + Express 5 + mysql2 + jose + zod. Importações relativas com .js. APIs JSON. Erros `{error:{code,message}}`, HTTP apropriado. CSRF obrigatório em mutações autenticadas: frontend envia `X-CSRF-Token` retornado por GET /api/session. Não usar tokens de login em localStorage.

## Produto público
`{id,title,description,topics:string[],stage,years:string[],level,image,priceCents:number|null,pages:number|null,format,hasAnswerKey:boolean,included:string[],contents:string[],objectives:string[],featured:boolean,active:boolean,sellable:boolean,createdAt}`. URLs `/produto/CEA-009`; image são prévias /manus-storage. `sellable` exige preço positivo, arquivo protegido existente, revisão comercial explícita e loja habilitada. Nunca expor storageKey/ciphertext/paths privados em resposta pública. Fonte inicial: catalog.js e new-products.js. CEA-009 já corrigido para 6º ano. Conteúdos/objetivos são derivados dos metadados disponíveis sem novas promessas.

## Configuração pública
`{brandName,whatsappNumber,contactEmail,legalName,taxId,address,privacyText,termsText,licenseText,publicOrigin,paymentPrepared,paymentEnabled,whatsappAutomatic:false,missingSetup:string[]}`. Não publicar credenciais. Seed sem contato/identificação inventados; políticas são minutas em revisão. PublicOrigin vazio até fornecer domínio; sem canonical/og:url absoluto inventado.

## Rotas de API
- GET `/api/session` → `{user:null|{id,openId,name,email,role},csrfToken:null|string,loginAvailable:boolean,adminConfigured:boolean}`. Identificador openId só ao próprio usuário; papel admin requer concessão explícita persistida à conta autenticada e aprovada, nunca primeiro visitante ou simples correspondência de uma variável pendente. Dados da conta são exibidos somente pela API autenticada; Compras e Administração oferecem login em outra aba para escolher outra identidade sem promover a conta automaticamente.
- GET `/api/auth/start?origin=<window.location.origin>` → redireciona ao Manus OAuth; cookie nonce, estado ligado ao navegador, callback fixo `/api/auth/callback`, retorno `/compras`. GET callback implementa troca/identidade conforme guia. POST `/api/auth/logout` limpa sessão.
- GET `/api/store` → `{config,products,bestSellers:string[]}`. BestSellers apenas pedidos com status pago, não fabricar dados.
- GET `/api/products` → `{products}`. GET `/api/products/:id` → `{product}` ou 404.
- POST `/api/checkout` → entrada `{productIds:string[],phone:string,optIn:boolean,email:string,origin:string,idempotencyKey:string}`; exige login, CSRF, opt-in transacional, produtos ativos/editados, preços definidos, arquivos presentes e pagamento habilitado. Recalcular total no banco. Saída `{order,pix:{code,qrBase64,ticketUrl,expiresAt}|null}`. Configuração pendente retorna 503 PAYMENT_NOT_CONFIGURED, nunca pagamento falso.
- GET `/api/orders` → `{orders}` do usuário. GET `/api/orders/:id` → `{order}` somente comprador/admin. `order:{id,status,createdAt,totalCents,items:[{productId,title,priceCents,downloadAvailable}]}`. Status público pending/paid/failed/cancelled/refunded.
- GET `/api/downloads/:productId` → PDF somente após compra paga do usuário ou admin autenticado. Cache private,no-store.
- POST `/api/webhooks/mercadopago` → segredo/signatura + reconsulta + correspondência de referência/valor/moeda; eventos idempotentes. Sem endpoint de marcar pago arbitrariamente.
- GET `/api/admin/products` → `{products}` com campos administrativos `commercialApproved` e `fileReady` adicionais, sem endereço do arquivo em claro.
- POST `/api/admin/products` → produto validado; id novo aleatório prefixo CEA-; resposta `{product}`. PUT `/api/admin/products/:id` → edição validada (incluindo priceCents e commercialApproved), `{product}`. DELETE → desativação `{ok:true}`. Somente admin com CSRF.
- POST `/api/admin/products/:id/file` → corpo raw application/pdf até 16 MiB; valida assinatura %PDF-, cifra e envia ao storage; resposta `{ok:true,fileReady:true}`. Não multipart, não URL arbitrária.
- GET `/api/admin/orders` → `{orders}` sem telefone em público; proprietário pode ver atendimento. Somente admin.
- GET `/api/admin/settings` → `{config}` com minutas e estado. PUT mesmo caminho → configura whitelist de contato, identificação, políticas, publicOrigin, paymentEnabled; sem tokens de serviços enviados por UI.

## Interfaces internas
`db.js`: export `pool` mysql2/promise e funções utilitárias; `migrations.js`: export async `migrate()` idempotente; `scripts/migrate.js` executa e encerra pool. Backend deve fornecer `listProducts({admin=false})`, `getProduct(id,{admin=false})`, `getStoreConfig()`, `bestSellerIds()` para renderer/API através de db.js ou store.js se necessário (avisar pai).

`auth.js`: export `authMiddleware`, `requireAuth`, `requireAdmin`, `requireCsrf`, `authRouter`.

`api.js`: export `apiRouter` com rotas de dados/checkout/admin/webhook. Pai monta authMiddleware antes e apiRouter em `/api`.

`storage.js`: export `storeProtectedPdf(buffer) -> storageKey`, `readProtectedPdf(storageKey) -> Buffer`; cifrar AES-256-GCM com HKDF do MANUS_JWT_SECRET, chave somente servidor. Paths do objeto são aleatórios ASCII e não expostos ao frontend. Pai usa estas funções para importar os PDFs existentes a partir de manifest externo.

`payments.js`: export `paymentPrepared() -> boolean` (credenciais necessárias presentes), `createPixPayment({orderId,totalCents,email,origin}) -> {providerId,code,qrBase64,ticketUrl,expiresAt}`, `verifyWebhook({headers,query,body}) -> {providerId}|throws`, `fetchPayment(providerId) -> {providerId,externalReference,status,amountCents,currency,pix:{code,qrBase64,ticketUrl,expiresAt}|null}`. Use documentação oficial atual e erros definidos; credenciais MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET. Pai/backend mantém transação/idempotência; módulo nunca altera banco.

`render.js`: export `renderPage({path,products,config,bestSellers,user}) -> {status,html}`. Rotas `/`, `/catalogo`, `/produto/:id`, `/sobre`, `/contato`, `/carrinho`, `/compras`, `/admin`. Dados privados não entram em HTML público; /compras/admin mostram shell de login sem dados pessoais. HTML com links reais, conteúdo SSR nas rotas públicas, css/js absolutos relativos ao website, metadados distintos, 404 real para ids/paths inexistentes. Frontend usa APIs reais; sem dados falsos ou fallback silencioso para seed caso API falhe.
