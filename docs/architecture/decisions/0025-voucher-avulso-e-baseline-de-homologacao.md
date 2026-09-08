# ADR 0025 — Voucher avulso, acesso com escopo e baseline de homologação

**Status:** proposto

**Data:** 8 de setembro de 2026

**Marco:** EP-14 — extensão de compra para oferta avulsa

**Relacionados:** ADR-0003, ADR-0014, ADR-0019, ADR-0020, ADR-0021 e ADR-0024

**Sucessão:** parcial do ADR-0024 quanto ao produto vendido e à justificativa de restituição por oferta; extensão dos ADRs 0019–0021 quanto ao escopo do acesso.

**Dono da decisão:** dono do produto. Proposta redigida antes do código; a execução do desenho escolhido foi expressamente autorizada na tarefa de 08/09/2026. Este documento não se declara aceito por inferência nem altera silenciosamente ADRs aceitos.

## Contexto e costuras

Requisito do dono: “como consumidor eu devo poder comprar voucher avulso direto de uma loja, ou comprar o pacote da cidade inteira”.

Hoje compra e acesso só identificam edição. Compra congela cotação/termos e somente evidência autenticada de pagamento permite concessão. Carteira agrupa por edição; apresentação/resgate conferem pertencimento da oferta à edição, mas não existe escopo menor. Cotas já são contadas por acesso e oferta.

Fontes anteriores à implementação: app/modules/purchases/services/purchase_service.ts:48 (vitrine), :161 (compra) e :356 (reembolso); app/modules/purchases/services/purchase_processing_service.ts:360 (concessão); app/modules/benefits/services/benefit_access_service.ts:156 (carteira); app/modules/benefits/services/benefit_redemption_service.ts:335 (contexto); database/migrations/1782134030000_create_benefit_accesses_table.ts:99 (unicidade). O relatório da implementação cita as linhas finais.

## Alternativas avaliadas

| Desenho                         | Vantagem                                                                                                                           | Custo e risco                                                                                            | Posição                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Edição sintética com uma oferta | Reaproveita acesso atual                                                                                                           | Faz edição significar SKU de loja, duplica calendários/moderação e distorce pacote/cidade                | Não recomendado                            |
| Acesso com offer_id opcional    | Reutiliza carteira, bloqueio, apresentação, mutex e resgate. NULL significa pacote; ID significa uma oferta da mesma edição/tenant | Toda leitura e unicidade precisa incluir escopo; omissão poderia entregar pacote por preço avulso        | Recomendado, com defesa em serviço e banco |
| Voucher paralelo ao acesso      | Autonomia para outro ciclo de vida                                                                                                 | Duplica entitlement, limites, carteira, bloqueios, QR e conciliação ou exige abstração polimórfica ampla | Não recomendado                            |

A sugestão do dono é a mais coerente, mas exige escopo imutável, integridade referencial e regressão de tentativa de usar outra oferta. Edição continua campanha da cidade, inclusive quando seu preço é zero; não se fabrica edição para representar cada loja.

## Desenho escolhido

### Produtos e cotação

- benefit_offers.standalone_price_cents: NULL desabilita venda avulsa; inteiro positivo habilita preço. Moeda herdada da edição, BRL neste corte. Não confundir com discount_amount_cents, valor do benefício.
- purchases.offer_id e benefit_accesses.offer_id: NULL compra/acessa pacote; ID compra/acessa exclusivamente uma oferta. O ID pertence à mesma edição e tenant, garantido por FK composta. Escopo não é mutável.
- Avulso exige edição publicada, venda aberta, uso não encerrado, oferta ativa e unidade publicada/ativa. Uso efetivo é a interseção com a janela própria da oferta; venda não ultrapassa o fim desse uso. Pré-venda permitida.
- Snapshot congela tipo de produto, oferta selecionada, valor/moeda, termos e condições. Snapshot avulso contém uma oferta; hash de intenção inclui escopo; preço/termos são calculados pelo servidor.
- A vitrine pública existente retorna editions (pacotes) e offers (avulsos), com product_type, edition_id, offer_id, preço, loja, cidade, janelas e meios anunciados pelo servidor. Sem titulares/pedidos. Descoberta e contatos permanecem públicos por D-003.
- Criação usa a mesma rota com offer_id opcional; omitido/NULL mantém pacote. Não há carrinho misto, recorrência, quantidade ou upgrade automático.

### Acesso, coexistência e cotas

Unicidade do acesso ativo e da intenção comercial viva passa a ser tenant + edição + titular + escopo. Pacote e ofertas diferentes podem coexistir como produtos independentes, identificados na carteira. Comprar pacote após avulso não dá desconto implícito nem transfere consumo: são novos direitos. Recomprar o MESMO escopo após acesso anterior, inclusive revogado, exige suporte, impedindo renovação disfarçada de cotas.

Carteira agrupa por escopo; acesso avulso projeta somente sua oferta, mantém sua identidade quando pausada/arquivada e expõe o período efetivo de utilização em access.usage_starts_at/usage_ends_at. Limite continua max_redemptions_per_access, contado por (access_id, offer_id). Não existe cota compartilhada entre pacote e avulso, nem restauração de resgates antigos. Concessão administrativa aceita escopo opcional com as mesmas validações; cortesia não vira pagamento silenciosamente.

Apresentação, preview e confirmação validam access.offer_id IS NULL OR access.offer_id = requested_offer_id, além dos controles anteriores. Token já inclui acesso/oferta; não precisa mudar formato. Banco recusa escopo cruzado e mutação do escopo, incluindo inserção direta de resgate fora dele.

Confirmação conserva revalidação de titular, tenant, validade e duplicidade do MESMO escopo. Oferta arquivada ou uso encerrado antes da entrega implica compensação, não acesso impossível. Pausa operacional bloqueia uso sem apagar direito.

### Reembolso: o que muda e o que não pode ser inferido

A justificativa “não existe preço canônico por oferta” do ADR-0024 deixa de valer para uma COMPRA AVULSA: o preço pago está congelado e admite restituição integral ou parcial por decisão comercial explícita, sem estimar valor pelo pacote. Restituição avulsa afeta só seu acesso; pacote e outros avulsos permanecem independentes.

Isso não transforma preço avulso em preço pago por cada componente de pacote. Duas ofertas de 3000 centavos podem compor pacote de 4990; restituir 3000 por cada uma excederia o pago. Rateio automático exige alocação do preço do pacote congelada antes da compra, arredondamento e retirada dos direitos restituídos. Este corte não inventa esse contrato.

Política implementada: sem uso, restituição integral do SKU pelo pago, automática apenas quando a configuração comercial já permitir. Com uso, análise humana total/parcial, valor em centavos e motivo; não negar automaticamente por haver uso. Parcial é ajuste comercial e preserva acesso/cotas restantes; total confirmado revoga só o acesso comprado. Não há saldo estimado, restituição automática por número de usos ou reset de consumo.

Permanecem bloqueio financeiro separado/reversível, releitura de resgates sob mutex compartilhado com confirmação, rede fora de locks, comandos duráveis, idempotências e consulta autenticada pelo worker. Webhook não concede acesso. Reembolso nunca apaga comprovantes/resgates nem restaura cotas.

### Baseline canônica — exceção autorizada

O dono autorizou consolidar migrations aplicadas em HOMOLOGAÇÃO, sobrepondo nesta tarefa a regra de histórico publicado do AGENTS. É mudança incompatível de histórico, não upgrade forward. **O banco do piloto terá de ser recriado do zero pelo dono.** Não executar histórico consolidado sobre banco existente, marcar migrations manualmente ou restaurar dump do schema antigo sobre o novo.

Consolidar ledger EP-14, correção de trigger e cursor no arquivo de criação; incluir credential_version na criação de users. Reconciliações redundantes de instalações antigas ficam arquivadas somente como fixtures de regressão histórica, fora do diretório do migrator. Preservar timestamps e ordem de dependências. Testar bootstrap vazio, constraints, índices, triggers e dados base. Relatório lista nomes/contagem efetivos.

Operação do dono: indisponibilidade planejada, parar HTTP/worker/scheduler, backup recuperável isolado, preparar banco vazio, aplicar migrations e onboarding seguro. Não executar development_seeder em homologação. Preservar histórico financeiro antigo separado e resolver pendências de PSP antes da troca: banco vazio não pode inferir seus titulares. Rollback exige restaurar banco E código anteriores juntos. Nenhuma operação na VPS é autorizada nesta tarefa.

### Seed e imagens

Gerar ilustrações originais determinísticas de 1200×800, sem fotografia de terceiros, identificadas como ilustrações de lojas fictícias. Versionar gerador, checksum na chave de storage e dimensões reais nos assets. Usar Drive configurado: R2 fornece URL pública canônica; filesystem mantém rota pública. Não sobrescrever objetos anteriores.

Manter gratuitas/cortesias, pacote comprável da cidade e preço avulso em oferta. Seed restrito a DEPLOYMENT_ENV=development e filtro Lucid, identidade estável e termos comerciais create-only. Imagem nova exige composição/revisão própria antes de trocar ponteiro publicado; reexecução inalterada não cria revisão ou asset adicional. Seed público ilustrativo não é conteúdo confidencial; moderação editorial não fecha URLs de bucket público.

## Cenários de teste

- Bootstrap vazio produz schema canônico, contagem de migrations, constraints/índices/triggers.
- Pacote/avulso com preços distintos, vitrine anônima sem privados; recusa de oferta inativa/expirada, outro tenant/edição, sem preço ou meio.
- Pagamento concede somente escopo comprado; replay, conflito de escopo com mesma chave e confirmação tardia compensada.
- Carteira mantém pacote/avulsos; apresentação/preview/confirmação recusam outra oferta; cotas independentes e concorrência preservadas.
- Concessão e banco recusam escopo inválido/duplicata; mutação de escopo e resgate direto cruzado falham.
- Reembolso usa preço pago e só bloqueia/revoga acesso correspondente; parcial preserva consumo; corrida com resgate preserva invariantes.
- Seed duas vezes conserva identidades/termos; PNGs válidos ≥320×180, checksum determinístico, disco configurado e composição publicada completa/moderada.
- Typecheck, lint, Japa completo, Vitest e regressões de deploy sem piloto ou PSP real.

## Consequências e limites

App deve consumir campos novos do OpenAPI; checkout irmão não é alterado. Pacote permanece compatível quando offer_id é omitido, mas novo produto requer consumidor que entenda escopo. Consolidação exige recriação controlada, não deploy automático sobre dados persistentes. Vendas reais e rateio de pacote não são inferidos da capacidade técnica avulsa.
