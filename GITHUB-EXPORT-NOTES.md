# Exportação para GitHub

Este pacote contém o código-fonte, testes, configurações, scripts, estilos, componentes do servidor, assets locais e o build gerado da loja Comunic@ Em Ação.

## O que não foi incluído

As pastas `.git` e `node_modules` foram excluídas porque o histórico Git e as dependências são recriados no repositório e com `pnpm install`. Arquivos `.env` reais, tokens, chaves e credenciais também não são incluídos. Use `.env.example` como referência e configure os valores somente no ambiente de hospedagem.

## Dependências externas

O catálogo referencia imagens públicas hospedadas em caminhos `/manus-storage/...` e o servidor usa banco de dados, autenticação, armazenamento protegido e, quando ativado, Mercado Pago. Para executar fora do Manus, será necessário migrar essas imagens e arquivos protegidos para um storage compatível, atualizar os caminhos e fornecer as variáveis de ambiente correspondentes.

As fontes tipográficas são carregadas pelo CSS a partir do Google Fonts quando há acesso à internet; elas podem ser substituídas por arquivos locais se a hospedagem exigir independência externa.

## Execução local

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm run build
pnpm start
```

Não habilite pagamentos sem configurar e testar as credenciais do provedor, os webhooks e a política de entrega dos arquivos.
