# TODO — Comunic@ Em Ação

## Catálogo e identidade preservados
- [x] Preservar a logo fornecida, a identidade original e os mockups aprovados dos dois produtos, sem copiar materiais da loja de referência.
- [x] Manter Enola Holmes em Literatura e Leitura e interpretação, e Mandala das figuras de linguagem em Gramática, ambas para 8º/9º ano.
- [x] Não incluir PDF completo ou gabarito nos arquivos públicos da vitrine.

## Reorganização da loja
- [x] Cabeçalho enxuto com busca disponível em desktop e celular e atalhos claros para catálogo, compra e contato; remover conta e carrinho sem função.
- [x] Apresentação compacta e catálogo em destaque antes de seções institucionais longas; cards padronizados com categoria, ano, formato, prévia e detalhes.
- [x] Separar filtros de etapa, ano e assunto; combinar filtros com busca, atualizar contagem de resultados, oferecer limpeza de filtros e ordenação por título.
- [x] Incluir Ensino Fundamental II (6º–9º), Ensino Médio (1º–3º), Leitura e interpretação, Gramática, Redação e Literatura; permitir o recorte Figuras de linguagem.
- [x] Usar coluna lateral de filtros no desktop e painel expansível no celular, sem ocultar busca ou assuntos.
- [x] Detalhes do produto organizados em público, conteúdo, formato e entrega, com fechamento e navegação de teclado acessíveis.
- [x] Agrupar instruções de compra, dúvidas frequentes, apresentação da marca e rodapé; não inventar preço, prazo, avaliações ou desconto.
- [x] Comunicar claramente que Pix e WhatsApp ainda aguardam configuração, sem simular pagamento ou entrega.

## Ativação posterior
- [ ] Configurar número oficial do WhatsApp e preços fornecidos pela proprietária.
- [ ] Configurar e validar checkout/Pix e eventual entrega automática, se solicitados.
- [ ] Completar informações legais da fornecedora e políticas definitivas antes de abrir vendas.

## Novos materiais recebidos
- [x] Incluir cinco novos produtos, sem duplicar Mergulho na sílaba tônica; confirmar categoria e público no conteúdo de cada arquivo.
- [x] Usar apenas prévias sobrepostas de páginas de estudante/estudo, sem gabarito nem PDF integral no build público.
- [x] Exibir Mergulho com ano a confirmar e Simulado ENEM como versão do aluno sem gabarito.
- [x] Incluir subtemas Preposições e Sílaba tônica e a categoria Avaliações e ENEM no catálogo.
- [ ] Solicitar conferência da origem/licença da arte do Jogo das 7 diferenças antes de iniciar vendas.

- [x] Analisar e incluir Eduardo e Mônica, recebido depois do lote, com ano a confirmar e prévia limitada às páginas de exercícios, sem expor a letra integral da música.

- [ ] Confirmar ano/etapa de Mergulho na sílaba tônica e Eduardo e Mônica com a autora.
- [ ] Revisar direitos de reprodução/comercialização da canção em Eduardo e Mônica antes de iniciar vendas.
- [ ] Confirmar se a folha apenas com moldura em Eduardo e Mônica deve ser mantida na versão final.
- [ ] Receber gabarito separado do Simulado ENEM se for anunciado como pacote com gabarito.

## Adjetivos e substantivos abstratos
- [x] Cadastrar CEA-009 com o título Quem qualifica e quem nomeia? — Adjetivos e substantivos abstratos, categoria Gramática e subtemas Adjetivos e Substantivos abstratos.
- [x] Informar PDF com 7 páginas, sendo 5 do estudante e 2 de gabarito/orientações; usar prévias somente das páginas 1–3.
- [x] Classificar CEA-009 como Ensino Fundamental II, 6º ano, conforme confirmação expressa da proprietária em 08/11/2026.
- [x] Preservar os oito cadastros anteriores e manter o PDF completo fora do build e dos links públicos.

- [x] Público confirmado pela autora: 6º ano; a hipótese do PDF não prevalece sobre essa confirmação.

## Ampliação funcional do briefing
- [x] Página inicial com banner/frase/proposta, destaques editoriais, novidades, categorias correspondentes a produtos reais e mais vendidos derivados apenas de pagamentos confirmados, sem números inventados.
- [x] Páginas reais /catalogo, /produto/:id, /sobre e /contato; produto com imagem, título, descrição fiel, conteúdos, ano, objetivos pedagógicos derivados, prévia, páginas quando disponível, formato, preço editável e compra.
- [x] Pesquisa e filtros por categoria/ano combinados, navegação responsiva em computador, tablet e celular, cards de produtos reais e estrutura preparada para novos cadastros.
- [x] Carrinho funcional persistente com adicionar/remover, um exemplar por arquivo digital, total e preço recalculados pelo servidor; impedir pagamento de produto com preço indefinido.
- [x] Banco persistente com os nove produtos importados sem duplicar/sobrescrever alterações futuras; CEA-009 classificado como 6º ano, conforme confirmação da proprietária.
- [x] Login real, painel administrativo protegido para cadastrar/editar/desativar produtos e preços, sem promover automaticamente visitantes a administradores.
- [x] Área de compras autenticada com histórico e arquivos liberados somente ao comprador após pagamento confirmado; PDFs completos fora do frontend/Git, armazenados cifrados e enviados por rota autorizada.
- [x] Preparar integração Pix oficial com status, conferência de valor/referência, webhook validado e idempotência; não simular pagamento ou entrega nem apresentar integração não testada como ativa.
- [x] Implementar administração de dados de contato e atendimento WhatsApp; sinalizar claramente a dependência da Cloud API para envio automático pelo WhatsApp, mantendo o fluxo manual previsto.
- [x] Testar navegação, responsividade e funcionalidades disponíveis, conferir acesso negado a não autorizados e revisar a integração das partes de forma independente antes da entrega.

## Ativação e confirmação
- [ ] Vincular somente a conta autenticada e aprovada pela proprietária, informar preços e revisar informações legais da fornecedora.
- [ ] Criar/aprovar conta no provedor Pix recomendado ou escolhido, fornecer token/segredo por campo seguro, configurar webhook e executar teste antes de anunciar vendas ativas.
- [ ] Configurar canal WhatsApp e, se automática a entrega via WhatsApp, credenciais e template oficial aprovados.

## Evidências da versão funcional
36 testes unitários passaram; oito rotas reais e manifesto responderam corretamente; filtros por Adjetivos e 6º ano retornaram somente CEA-009. Os nove PDFs foram cifrados, transferidos e restaurados com hash SHA-256 idêntico aos originais. Acesso anônimo a pedidos, downloads e administração recusado, sem criar pedidos de teste. Responsividade inspecionada em 375, 768 e 1440 pixels; cabeçalho de tablet corrigido. Revisão independente executada; CSRF da desativação já estava presente e foi reconferido. A contagem de CEA-001 foi documentada no catálogo com base no PDF de seis páginas. Login iniciado no portal real e aguarda ação da proprietária; administração e Pix ainda não anunciados como ativos.

Teste no navegador: incluir CEA-009 duas vezes manteve um único ID; item preservado ao abrir /carrinho; checkout sem preço foi bloqueado antes de cobrança; remover retornou contador e lista a zero. Login no portal real aguarda a conta escolhida pela proprietária antes de designar administração. Nenhuma publicação solicitada/realizada.

## Troca da conta administrativa solicitada
- [x] Mostrar a conta realmente autenticada em Compras e Administração e oferecer o login da loja em outra aba; não inventar usuário nem conceder permissão pelo frontend.
- [x] Preservar login Manus OAuth real, JWT, CSRF e pedidos privados; a prévia automática não deve conferir privilégios por si só.
- [x] Respeitar a recusa do perfil atual: nenhuma promoção automática por identificador de ambiente; conceder papel administrativo somente a uma conta verificada e explicitamente aprovada, persistida no banco.
- [x] Preservar os nove produtos, arquivos protegidos, preços e estado de pagamentos desativado durante a troca.
- [x] Confirmar o login da conta indicada pela proprietária antes de liberar o painel; endereço desejado registrado somente no controle interno, fora do frontend e do Git.

Verificação da troca: 38 testes passaram; interface de conta presente em /compras e /admin com login real em outra aba; nenhum dado da conta escolhida é publicado no HTML. A conta anteriormente conectada permanece com papel user. Removidas as exceções antigas de permissão também nos pedidos e downloads, apontadas pela revisão independente. Nove produtos, arquivos e pagamentos desativados preservados. Login da conta escolhida confirmado e papel administrativo vinculado após conferência da identidade registrada. O perfil recusado permanece com papel user. A abertura do painel pela proprietária e a definição de preços ainda aguardam a próxima etapa.

Confirmação da vinculação: conta desejada autenticada e persistida como admin; identidade anterior mantida como user; nove produtos e nove arquivos protegidos preservados; pagamentos continuam desativados. Nenhum e-mail pessoal foi incluído no catálogo público ou no Git.

Conferência visual da proprietária em 08/11/2026 às 22:16: painel da conta correta mostrou Catálogo editorial, dados administrativos atualizados e ações Editar, Desativar e Adicionar produto. Próxima etapa: definir preços sem ativar pagamentos.

Atualização de escolha em 09/11/2026: a proprietária autorizou expressamente o perfil anteriormente recusado, que já estava autenticado. Papel administrativo confirmado no banco apenas para essa conta; outras autorizações foram preservadas. Nove materiais e nove arquivos protegidos permanecem cadastrados; pagamentos seguem desativados. A escolha mais recente prevalece sobre a recusa histórica, sem qualquer promoção automática por cadastro ou variável de ambiente.

## Correção das prévias no cadastro — 09/11/2026
- [ ] Preparar e vincular imagens reais de apresentação aos três novos materiais com imagem vazia: Criptograma Romantismo, Criptograma Parnasianismo e Conclusão da Redação ENEM. Usar apenas páginas de estudante/estudo selecionadas após inspeção, nunca gabaritos ou PDFs completos públicos.
- [ ] Permitir enviar JPG, PNG ou WebP pelo painel sem digitar caminhos técnicos; validar imagem e limite de tamanho no servidor, exigir administração e CSRF, persistir endereço durável e mostrar a prévia atual.
- [ ] Distinguir explicitamente PDF completo protegido de imagem pública no formulário e nas mensagens de sucesso; envio de PDF não cria automaticamente uma imagem nem sobrescreve a imagem existente.
- [ ] Preservar preços, classificações, permissões, arquivos protegidos e estado de pagamentos; verificar testes e salvamento da versão sem publicar a loja.

## Novo lote — Mandala das orações coordenadas — 09/11/2026
- [x] Cadastrar CEA-E95A9C2648 como “Mandala das orações coordenadas”, Gramática, Ensino Fundamental II, 8º/9º ano.
- [x] Definir preço padrão de 1000 centavos, equivalente a R$ 10,00; o checkout permanece desativado até a configuração do provedor Pix.
- [x] Armazenar o PDF completo de 7 páginas protegido, mantendo as páginas 6 e 7 — material do professor/gabarito — fora da vitrine pública.
- [x] Criar e vincular prévia pública com as páginas do estudante 1–3, sem expor gabarito ou orientações do professor.

## Novo lote — materiais de Redação ENEM e Língua Portuguesa — 09/11/2026
- [x] Cadastrar “Aulão ENEM — Redação e Língua Portuguesa”, 41 páginas, Ensino Médio/ENEM, por R$ 10,00.
- [x] Cadastrar “Dominando a Competência 4 da Redação ENEM”, 10 páginas, Ensino Médio/ENEM, por R$ 10,00.
- [x] Cadastrar “Operação Poema Secreto — Vozes que não podem ser silenciadas”, 3 páginas, ano a confirmar, por R$ 10,00.
- [x] Converter os dois PowerPoints e o DOCX para PDFs de entrega, mantendo os arquivos originais fora da vitrine.
- [x] Criar prévias públicas separadas; no material “Operação Poema Secreto”, exibir somente a página do estudante e manter as páginas de revisão/gabarito protegidas.
- [x] Manter os três produtos sem aprovação comercial automática; a loja e o checkout continuam dependendo da configuração do provedor Pix e da revisão de direitos aplicável.

## Retirada de produto — 09/11/2026
- [x] Retirar “Aulão ENEM — Redação e Língua Portuguesa” (CEA-CCF9E008EF) da vitrine e do checkout por desativação reversível; preservar o arquivo protegido e os demais produtos.

## Proteção visual das prévias — 12/11/2026
- [x] Atualizar as 15 imagens públicas ativas com marca d’água repetida da logo Comunic@ Em Ação.
- [x] Reorganizar cada mockup com duas folhas de fundo e uma folha frontal sobreposta, criando o efeito de páginas empilhadas.
- [x] Manter os arquivos originais e PDFs protegidos intactos; somente as imagens públicas foram substituídas.
- [x] Manter resolução pública limitada e avisar que a proteção reduz cópias, mas não impede capturas de tela ou ferramentas de IA de forma absoluta.

## Proteção contra extração por OCR/IA — 12/11/2026
- [x] Substituir as prévias públicas ativas por versões reduzidas, pixeladas e fortemente desfocadas.
- [x] Aplicar faixas largas e marca d’água repetida para impedir que o visualizador exiba atividades legíveis.
- [x] Manter o efeito de folhas empilhadas na composição, sem disponibilizar páginas legíveis na vitrine.
- [x] Confirmar que os 15 produtos ativos usam a nova proteção; PDFs completos continuam protegidos e não são expostos na prévia.

## Visualizador protegido com prévia legível — 15/11/2026
- [x] Restaurar prévias visíveis com folhas sobrepostas e marca d’água, sem expor os PDFs completos.
- [x] Desativar seleção de texto, arrastar, menu de contexto, copiar e recortar dentro da área da prévia.
- [x] Desativar atalhos comuns de copiar, imprimir, salvar e visualizar código durante a página do produto.
- [x] Adicionar aviso de uso permitido somente como amostra e manter a mensagem de que nenhuma proteção impede captura de tela de forma absoluta.
