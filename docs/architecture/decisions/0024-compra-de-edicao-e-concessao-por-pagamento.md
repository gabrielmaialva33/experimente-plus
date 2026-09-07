# ADR 0024 — Compra de edição e concessão por pagamento

**Status:** aceito

**Data:** 7 de setembro de 2026

**Marco:** EP-14 — Compra de edição e operação financeira mínima

**Relacionados:** ADR-0003, ADR-0019, ADR-0020, ADR-0021, ADR-0022 e ADR-0023

**Sucessão:** parcial do ADR-0022; extensões delimitadas dos ADRs 0019–0021, descritas abaixo

**Dono da decisão:** dono do produto; domínio de compras/pagamentos em conjunto com benefícios

## Contexto

Requisito textual do dono do produto: “como usuario eu preciso conseguir comprar um voucher e depois conseguir usar ele”. O dono informa que acesso, carteira derivada, apresentação temporária e resgate idempotente foram validados ponta a ponta no piloto em 7 de setembro. Esse teste operacional é contexto fornecido, não uma nova validação executada para este ADR.

O código já representa a metade de utilização. Falta transformar uma compra confirmada em acesso. O termo comercial “voucher” precisa ser esclarecido: a recomendação é vender **o acesso à edição inteira**, por pagamento único, e utilizar os benefícios de suas ofertas segundo as regras existentes. Não se compra uma oferta isolada no modelo atual. A referência de mercado registra pagamento único, edição e benefícios, mas recusa adotar voucher como unidade principal e bloquear descoberta por compra: [referência de mercado, linhas 11–35](../../product/06-referencias-de-mercado.md#L11) e [linha 139](../../product/06-referencias-de-mercado.md#L139).

### Registro de aceitação — 7 de setembro de 2026

O dono do produto aceitou este ADR e autorizou a implementação do backend EP-14: edição inteira, compra avulsa, acesso somente após confirmação, bloqueio financeiro reversível separado, idempotência e resgate preservado. A sucessão parcial do ADR-0022 passa a valer neste corte; os demais adiamentos permanecem.

**A escolha comercial do provedor permanece deferida por decisão explícita do dono. Por isso a arquitetura é agnóstica de provedor.** A porta `PaymentPort` admite o adaptador Mercado Pago e o falso determinístico de desenvolvimento/teste, selecionados por configuração. Implementar o adaptador recomendado não contrata nem escolhe definitivamente o fornecedor. Habilitação comercial, entidade vendedora, política/SLA de reembolso, retenção e autorização de vendas reais ainda dependem do dono. O provedor fica desabilitado por padrão; restituição comercial automática sem uso também fica desabilitada por padrão. Compensação por impossibilidade de entregar um pagamento confirmado é obrigatória.

O adaptador técnico inicial usa **Payments API** do Mercado Pago, pois o recurso fornece `date_approved`, `collector_id`, `live_mode`, moeda, captura e valor devolvido para a validação exigida neste ADR. A comparação original abaixo avaliou Orders; esse detalhe de integração é agora explicitado, sem alterar a porta de domínio. Referências oficiais: [pagamento](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/get-payment/get), [criação](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-payment/post) e [reembolso](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-refund/post). Homologação na conta comercial continua necessária antes de ativar vendas reais.

As costuras e linhas da seção seguinte documentam o estado **anterior ao EP-14**. O comportamento entregue e os comandos operacionais estão no [runbook de compras](../../runbooks/purchases.md); o contrato atual está no [OpenAPI](../../openapi.yaml).

### Costuras verificadas no repositório

As linhas referem-se ao checkout inspecionado nesta data. Migrations foram lidas como evidência do contrato, sem execução ou alteração.

| Costura existente                                                                | Evidência de arquivo e linha                                                                                                                                                                                                                                    | Implicação e limite                                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edição tem `price_cents`, `currency`, `status`                                   | [migration de edições, linhas 14–20](../../../database/migrations/1782134020000_create_benefit_editions_table.ts#L14); [model, linhas 34–53](../../../app/modules/benefits/models/benefit_edition.ts#L34)                                                       | Preço hoje é referência, não histórico de cobrança. A compra precisa congelar valor/moeda.                                                                       |
| `sales_starts_at`/`sales_ends_at` separados de `usage_starts_at`/`usage_ends_at` | [migration, linhas 16–19](../../../database/migrations/1782134020000_create_benefit_editions_table.ts#L16); [model, linhas 40–50](../../../app/modules/benefits/models/benefit_edition.ts#L40)                                                                  | Venda pode anteceder uso; pagamento não antecipa utilização.                                                                                                     |
| Checks de preço, moeda, estados e janelas                                        | [migration, linhas 51–68](../../../database/migrations/1782134020000_create_benefit_editions_table.ts#L51); [validação do serviço, linhas 374–383](../../../app/modules/benefits/services/benefit_edition_service.ts#L374)                                      | Janela de venda é nula em ambos os extremos ou completa e ordenada. Hoje não há nessa validação relação obrigatória entre venda e uso.                           |
| Origem `payment` já aceita                                                       | [migration de acessos, linhas 58–63](../../../database/migrations/1782134030000_create_benefit_accesses_table.ts#L58); [validator, linhas 5–11](../../../app/modules/benefits/validators/benefit_access_validator.ts#L5)                                        | Não significa que exista checkout. Estados do acesso são apenas `active`/`revoked`.                                                                              |
| Pagamento exige referência externa                                               | [constraint `benefit_accesses_payment_reference_check`, linhas 77–80](../../../database/migrations/1782134030000_create_benefit_accesses_table.ts#L77); [serviço, linhas 40–45 e 344–346](../../../app/modules/benefits/services/benefit_access_service.ts#L40) | Banco exige não nulo; serviço também normaliza texto vazio e recusa ausência.                                                                                    |
| Unicidade por titular e referência                                               | [índices, linhas 84–94](../../../database/migrations/1782134030000_create_benefit_accesses_table.ts#L84)                                                                                                                                                        | No máximo um acesso ativo por tenant/edição/usuário; referência única por tenant/origem. Não é ainda replay bem-sucedido de compra.                              |
| Titular precisa pertencer à operação                                             | [FK composta, linhas 36–40](../../../database/migrations/1782134030000_create_benefit_accesses_table.ts#L36); [busca por e-mail e tenant, linhas 252–266](../../../app/modules/benefits/services/benefit_access_service.ts#L252)                                | Pagamento não pode escolher titular/tenant a partir de dados arbitrários do webhook.                                                                             |
| Auditoria e transação são reutilizáveis, com adaptação                           | [auditoria de benefícios, linhas 6–30](../../../app/modules/benefits/services/benefit_audit_service.ts#L6); [auditoria base, linhas 7–20 e 59–61](../../../app/modules/audits/services/audit_service.ts#L7)                                                     | Wrapper atual exige ator humano numérico e recursos fixos; serviço base aceita ator ausente e cliente transacional. Automação precisa de proveniência explícita. |

### Como a concessão funciona hoje

`BenefitAccessService.grant` exige administrador global, normaliza e-mail/origem/referência e abre transação. Trava a edição, exige `published` ou `paused` e uso ainda não expirado, encontra titular com membership no tenant, recusa acesso ativo e cria `BenefitAccess` ativo com origem, referência, autor e data. Evidências: [serviço, linhas 32–76](../../../app/modules/benefits/services/benefit_access_service.ts#L32) e [228–266](../../../app/modules/benefits/services/benefit_access_service.ts#L228). **Não aplica a janela de venda**, coerente com concessões administrativas/cortesias.

Duplicatas dos índices são convertidas em erro de domínio, inclusive referência externa já processada; a auditoria de concessão ocorre depois da transação. Portanto, chamar `grant` diretamente não fornece nem replay de sucesso nem commit conjunto de compra/acesso/auditoria: [linhas 78–107](../../../app/modules/benefits/services/benefit_access_service.ts#L78).

A carteira consulta acessos do próprio titular e deriva os benefícios da edição, com chave `access_id:offer_id`, sem criar vouchers por oferta: [linhas 150–167](../../../app/modules/benefits/services/benefit_access_service.ts#L150), [269–294](../../../app/modules/benefits/services/benefit_access_service.ts#L269). O resgate trava acesso e oferta, revalida autorização e devolve o comprovante existente para o mesmo nonce antes de tentar novo uso: [resgate, linhas 183–220](../../../app/modules/benefits/services/benefit_redemption_service.ts#L183), [locks, linhas 340–351](../../../app/modules/benefits/services/benefit_redemption_service.ts#L340). Seu registro e auditoria compartilham transação: [linhas 222–262](../../../app/modules/benefits/services/benefit_redemption_service.ts#L222).

## Decisão aceita

### 1. Sucessão explícita e limites preservados

Este ADR sucede **somente** o adiamento de checkout, cobrança avulsa, reembolso e conciliação necessários à compra de edição, no [ADR-0022, seção Fora de escopo, linha 221](0022-contrato-api-movel-consumer-first.md#L219). A exclusão deixa de valer para esse corte, não para todo produto financeiro. **Assinatura e recorrência permanecem fora de escopo.**

Permanecem no ADR-0022: API única e cliente fino; tenant distinto de cidade; catálogo resolvido por host confiável; membership e policies no servidor; capabilities; sessão e rotação; apresentação temporária, preview sem uso e confirmação idempotente; ownership de histórico; proteção/cache privado; OpenAPI verificável. Referências: [seções 1–3](0022-contrato-api-movel-consumer-first.md#L22), [seção 5](0022-contrato-api-movel-consumer-first.md#L140) e [seções 6–7](0022-contrato-api-movel-consumer-first.md#L165). Favoritos, avaliações, push, offline, login social, biometria do servidor, cancelamento/edição de resgate e os demais adiamentos listados nas linhas 222–227 não são aprovados por esta proposta.

Extensões também precisam ser explícitas:

- **ADR-0019:** pagamento passa a ser uma camada sobre edição/oferta. Para pré-venda, permitir apresentação comercial de ofertas ativas de unidades publicadas antes da janela de uso, claramente como futuras; isso sucede apenas a restrição de exposição temporal dessa vitrine, não a elegibilidade de uso. Não publicar rascunhos nem conteúdo não moderado. A carteira continua derivada. [ADR-0019, oferta e próximos agregados](0019-edicoes-e-ofertas-de-beneficio.md#L41).
- **ADR-0020:** preservar `active → revoked`, unicidades, membership, carteira e concessão administrativa. Acrescentar uma **autoridade interna de confirmação financeira**, limitada ao pagamento verificado, como exceção à exclusividade de administrador para concessão/revogação financeira. Não dar RBAC de administrador ao webhook. [Regras atuais, linhas 49–57](0020-acesso-a-edicao-e-carteira-derivada.md#L49).
- **ADRs 0020/0021:** acrescentar impedimento financeiro temporário de novos usos para reembolso/disputa em processamento, revalidado pelo servidor. Isso é comportamento novo aprovado nesta aceitação; os estados persistidos do acesso e a imutabilidade do resgate permanecem. O comprovante de resgate não vira comprovante de pagamento. O resgate existente nunca é cancelado ou editado por um estorno financeiro. [ADR-0021, histórico e fora de escopo](0021-resgate-transacional-com-apresentacao-temporaria.md).

Esta aceitação é registrada em produto, índice de ADRs e contrato EP-14, referenciando essa sucessão. O texto histórico dos ADRs aceitos não será silenciosamente substituído.

### 2. O que vender e quando vender

**Recomendação:** uma compra concede ao usuário autenticado um acesso à edição, quantidade um, pagamento único em BRL por Pix ou cartão de crédito à vista. Uma oferta individual não é SKU; seu limite de uso continua vinculado ao acesso. “Comprar edição”/“Adquirir Pass” deve comunicar claramente essa unidade comercial, mesmo quando a comunicação geral usar “voucher”. A aceitação do dono confirma essa unidade comercial para o EP-14.

O vendedor/recebedor recomendado é a pessoa jurídica responsável pela operação, a definir pelo dono; não cada estabelecimento. Não incluir split, repasse automático, marketplace financeiro, parcelamento, presentes, transferência, renovação ou recompra para restaurar limites neste corte. Preço, condições, identidade do vendedor e responsabilidade comercial precisam ser aprovados antes da abertura de vendas. Não há preço/taxa sugerido neste ADR.

Elegibilidade **nova para compra**, mais restrita que concessão administrativa:

- tenant ativo, comprador autenticado e com vínculo válido na operação; compra para o próprio `user_id`, não para e-mail informado pelo pagador;
- edição `published`, `price_cents > 0`, moeda BRL e janela de venda explícita e válida; janela nula continua válida no domínio antigo, mas não habilita cobrança automaticamente;
- `sales_starts_at <= agora < sales_ends_at` e uso ainda não encerrado; recomendar `sales_ends_at <= usage_ends_at`; permitir venda antes de `usage_starts_at`;
- edição pausada não abre novas compras; edição gratuita segue cortesias, sem pagamento fictício;
- acesso ativo já existente bloqueia nova cobrança e conduz à carteira; uma compra pendente é retomada; acesso anterior revogado exige análise, sem recompra automática que renove cotas já consumidas.

Gerar pedido e cotação imutáveis no servidor: tenant, comprador, edição, preço/moeda, termos comerciais e sua versão/hash, janelas, ofertas/condições apresentadas e validade da cotação. Valor vindo do cliente não é autoridade. Mudança de preço depois não altera o pedido. Hoje edições pausadas podem ter preço/janelas editados: [serviço, linhas 130 e 155–183](../../../app/modules/benefits/services/benefit_edition_service.ts#L130). A implementação deve proteger o compromisso comprado: impedir redução silenciosa de validade/benefícios contratados, exigir tratamento explícito de compensação/reembolso quando a operação não puder honrá-los, preservando pausas operacionais e moderação. Snapshot serve como prova; não torna oferta suspensa utilizável.

Expiração da cobrança/cotação será limitada pela janela de venda e pelo prazo suportado pelo provedor; a duração operacional será aprovada pelo dono. Pagamento efetuado dentro da validade pode ser comunicado depois dela: avaliar o instante de pagamento confirmado pelo provedor, não apenas a chegada do webhook. Se a confirmação chegar quando o uso já expirou, a edição foi arquivada ou o titular perdeu o vínculo, registrar dinheiro recebido e impedimento de concessão, iniciar restituição/análise; nunca perder o pagamento nem criar direito impossível de usar.

**Alternativas:** vender oferta avulsa exigiria outro agregado comercial, preço e regras de propriedade/limites por oferta; assinatura exigiria renovação, inadimplência e cancelamento recorrente. Ambas ampliam o domínio e não são recomendadas para fechar esta jornada.

### 3. Comparação de provedores e escolha pendente

Documentação oficial consultada em **7 de setembro de 2026**. Suporte documentado não comprova habilitação da conta comercial do piloto. Não foram contratadas contas, executadas cobranças ou instalados SDKs. Maturidade abaixo é avaliação de engenharia baseada nas superfícies documentadas, não benchmark de disponibilidade. Preços, taxas e condições negociadas **não foram verificados e não são estimados**.

| Critério                 | Pagar.me                                                                                                                                                                                                                                                                                                       | Mercado Pago                                                                                                                                                                                                                                                                                                                  | Stripe com Pix na própria Stripe                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pix e cartão no Brasil   | APIs de Pix e cartão; Pix requer configuração de conta/gateway compatível. [Pix](https://docs.pagar.me/reference/pix-2), [cartão](https://docs.pagar.me/reference/cart%C3%A3o-de-cr%C3%A9dito-1).                                                                                                              | Pix e cartão no Checkout API via Orders; formulário de cartão pode usar componente/tokenização do provedor. [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix), [cartões](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/cards). | Cartões e Pix documentados; a página de Pix informa pagamento avulso em BRL para contas brasileiras **por convite**. Habilitação precisa ser confirmada. [Cartões](https://docs.stripe.com/payments/cards), [Pix](https://docs.stripe.com/payments/pix). |
| Confirmação por webhook  | Eventos `order.paid`, `charge.paid`, reembolso e disputa. Validar a forma de autenticação da versão contratada na homologação. [Eventos](https://docs.pagar.me/reference/eventos-de-webhook-1).                                                                                                                | Tópico de orders e validação HMAC de `x-signature`; consulta da order confirma estado. [Notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications).                                                                                                                                   | Webhooks com assinatura, retries e duplicatas/ordem não garantida documentados. [Webhooks](https://docs.stripe.com/webhooks).                                                                                                                            |
| Idempotência externa     | `Idempotency-key` para criação de pedidos: 24 h, sandbox 5 min; mesmo identificador com corpo diferente pode devolver o mesmo pedido. Não estender essa garantia a todo endpoint sem verificar. [Idempotência](https://docs.pagar.me/docs/o-que-%C3%A9).                                                       | `X-Idempotency-Key` obrigatório na criação via Orders; SDK expõe `idempotencyKey`. [Pix/Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix), [SDK](https://github.com/mercadopago/sdk-nodejs).                                                                             | POSTs aceitam chave; preserva primeiro resultado, inclusive erro 500; parâmetros divergentes são recusados e chaves podem ser removidas após pelo menos 24 h. [Idempotência](https://docs.stripe.com/api/idempotent_requests).                           |
| Estorno/reembolso        | Pix usa cancelamento da cobrança; endpoint aceita valor ou total, cartão possui estados de estorno. [Pix](https://docs.pagar.me/reference/pix-2), [cancelar cobrança](https://docs.pagar.me/reference/cancelar-cobran%C3%A7a).                                                                                 | Orders permite restituição total/parcial após captura e cancelamento antes da aprovação; depende de saldo e processamento do provedor. [Reembolsos](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/refunds-cancellations).                                                          | Refunds totais/parciais; Pix documenta janela de até 90 dias. Reembolso tem ciclo próprio, não equivale a cancelar acesso. [Pix](https://docs.stripe.com/payments/pix), [refunds](https://docs.stripe.com/refunds).                                      |
| SDK e integração Node/TS | SDK oficial atual em TypeScript, cliente gerado, módulos Orders/Charges e configuração de HTTP/retries. O antigo core-node está arquivado; homologar o pacote atual e sua cobertura. [SDK atual](https://github.com/pagarme/pagarme-nodejs-sdk), [legado](https://github.com/pagarme/pagarme-core-api-nodejs). | SDK oficial Node 18+, exemplo atual de `Order` e opções de idempotência; boa base documentada para este backend, sujeita a teste em Node 24/ESM. [SDK](https://github.com/mercadopago/sdk-nodejs).                                                                                                                            | SDK oficial com tipos, versionamento de API, retries e verificação de webhook; documentação de integração particularmente abrangente, sem garantir habilitação de Pix. [SDK](https://github.com/stripe/stripe-node).                                     |

**Recomendação submetida ao dono:** Mercado Pago como primeiro candidato, com Pix e cartão no mesmo provedor, por atender o corte brasileiro em uma integração e oferecer Orders, SDK e autenticação de webhook documentados. Se escolhido, homologar Orders API e tokenização/componente oficial de cartão, sem misturar exemplos de Payments legada, Orders e Checkout Pro como se fossem o mesmo contrato. Um checkout hospedado é alternativa para reduzir trabalho de interface, mas seu contrato de sessão/expiração/webhook precisa ser validado separadamente.

Pagar.me é alternativa forte se conta, suporte e condições comerciais atenderem melhor à operação; merece homologação equivalente e atenção à família correta do SDK. Stripe é alternativa tecnicamente bem documentada se o dono obtiver Pix na conta brasileira. **Stripe para cartão mais Pix em um segundo PSP** também é possível: cada tentativa fixa provedor/meio, mas duplica onboarding, webhooks, chaves e conciliação. Essa complexidade é uma inferência arquitetural e torna a combinação não recomendada no primeiro corte. Não há preferência baseada em taxas não verificadas.

Antes da decisão: comparar propostas comerciais reais, vendedor/recebedor elegível, Pix habilitado, cartão/captura e antifraude, política de disputa, prazo/saldo de restituição, relatórios de liquidação, suporte e homologação Node 24. Testar a idempotência também em estornos; suporte a idempotência de criação não autoriza presumir a mesma garantia em qualquer operação.

**Escolha do provedor: pendente, exclusivamente do dono do produto.** Aceitar a arquitetura pode preceder a escolha, mas implementação do adaptador e abertura de vendas dependem dela.

### 4. Pedido pendente, confirmação e ponto de integração

**Recomendação:** criar pedido/tentativa pendentes; **não criar `BenefitAccess` pendente**. Acesso só nasce ativo após confirmação financeira validada. `active` é direito concedido, não necessariamente disponível agora: antes da janela de uso, a carteira continua `upcoming`.

Separar fatos propostos:

| Registro lógico novo                    | Responsabilidade                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Compra                                  | Titular, edição, cotação imutável, chave local de idempotência e resultado original da operação.            |
| Tentativa de pagamento                  | Provedor/conta/ambiente, identificador externo, chave de saída, valor, meio, expiração e estado financeiro. |
| Recepção/processamento de eventos       | Identificador único de evento, evidência sanitizada, tentativas de processamento e resultado.               |
| Reembolso/disputa e bloqueio financeiro | Histórico financeiro, decisão humana quando necessária e impedimento reversível de novos usos.              |
| Conciliação e comandos duráveis         | Divergências, reprocessamento e envio recuperável de operações externas.                                    |

São responsabilidades a modelar, **não tabelas já existentes nem DDL aprovado**. Benefícios continuam dono do acesso/carteira/resgate; o domínio de compras/pagamentos, proposto, coordena pedido, adaptador e conciliação. Não colocar regra financeira no React ou no controller do webhook.

Fluxo recomendado:

1. Autenticar comprador, validar tenant e cotação; persistir compra/tentativa e comando durável de criação. Chamadas externas ocorrem fora de transações que seguram locks. Estado incerto após timeout é “processando”, não falha definitiva que permita cobrar de novo.
2. Exibir instrução Pix ou formulário tokenizado e estado pendente. Retorno do navegador, deep link, sucesso do SDK cliente ou captura de tela do Pix **não concedem acesso**. QR de pagamento é distinto do QR temporário de utilização.
3. Receber webhook conforme autenticação do provedor, validar conta/ambiente, persistir recepção durável e só então reconhecer entrega. Evento duplicado recebe reconhecimento sem nova operação. Se persistência falhar, permitir retry. Se assinatura não puder ser homologada, não usar corpo recebido como prova de pagamento; bloquear liberação dessa integração até definir autenticação/consulta segura.
4. Worker consulta o recurso canônico no provedor e confere identificador vinculado à tentativa, conta recebedora, ambiente, moeda, valor integral e confirmação/captura efetiva. Autorização de cartão sem captura, valor parcial ou status intermediário não bastam. Tenant/usuário/edição vêm da compra local; metadado externo serve apenas à correlação. Eventos fora de ordem são reconciliados com o recurso e os fatos persistidos, sem regredir de reembolsado para pago.
5. **Aqui se encaixa o pagamento confirmado:** um caso de uso interno proposto, por exemplo `confirmPaidPurchase`, executa em transação a vinculação da compra ao acesso, a criação do acesso `source = payment`, a atualização de concessão e a auditoria. Deve reutilizar/extrair as invariantes hoje nas linhas 51–74 de `BenefitAccessService.grant`, aceitando o cliente transacional e o `user_id` confiável, sem chamar a API administrativa nem fingir um usuário root. `granted_by` pode ser nulo como já permite o schema; a autoria de sistema e a evidência financeira ficam explícitas no registro/auditoria da compra.
6. Usar referência externa canônica e estável da **transação confirmada**, com namespace de provedor/conta/ambiente para evitar colisões, dentro dos 255 caracteres existentes. Não usar ID de entrega do webhook: eventos distintos podem se referir ao mesmo pagamento. Persistir também vínculo único compra/acesso e unicidade da transação por conta/provedor. Reprocessamento local devolve o acesso previamente vinculado, inclusive se posteriormente revogado; nunca cria nova concessão com a mesma compra.
7. Falha após confirmação remota deixa pagamento conhecido e concessão pendente de reconciliação, sem segunda cobrança. Concessão, vínculo e auditoria local confirmam ou revertem juntos. Pausa posterior da edição pode conceder o acesso devido a pedido válido, porém ele fica indisponível até publicação; expiração/arquivamento ou conflito não recuperável gera restituição/análise. Nova compra não é aberta nessas condições.

Concessão administrativa permanece admin-only, inclusive origem `payment` já admitida. Para compras gerenciadas pelo novo domínio, o backoffice deverá reconciliar a compra em vez de conceder isoladamente com referência arbitrária. Uma corrida com cortesia/manual que já criou acesso não deve transformar silenciosamente esse acesso em pago: registrar conflito e reembolsar a cobrança excedente ou encaminhar decisão auditada. Não derrubar a unicidade existente.

### 5. Idempotência da compra

O padrão é o do resgate: repetir a operação não cria um segundo fato e permite recuperar o resultado original. No resgate isso já ocorre na busca por nonce dentro da transação; no `grant` administrativo ainda ocorre erro em duplicidade, como levantado acima.

Contrato recomendado, a especificar em OpenAPI apenas na futura implementação:

- chave opaca de intenção estável entre retry, timeout, refresh e dispositivos que retomem a mesma compra; unicidade local por `tenant + buyer + operation + key`;
- persistir hash do pedido canônico: edição, cotação, quantidade e escolha de pagamento; mesma chave com conteúdo diferente gera conflito e nenhuma nova cobrança;
- a operação inicial cria um recurso de compra e devolve um resultado estável com sua identidade. Replay devolve o mesmo resultado persistido. Consulta separada retorna estado atual e instruções ainda válidas; não guardar URL temporária como resultado eterno;
- para uma tentativa em processamento, retry retoma a mesma tentativa; quando houver confirmação, o mesmo comprovante de compra e `access_id` são recuperáveis. Depois de reembolso, o comprovante original permanece histórico, e a consulta informa a devolução; ele não promete acesso ativo;
- chave externa derivada da tentativa, não de cada chamada HTTP. Dentro da janela garantida pelo PSP, reenviar a mesma requisição/chave. Depois de timeout ou expiração dessa garantia, consultar/reconciliar antes de qualquer nova tentativa. Nunca cobrar novamente só porque passaram 24 horas;
- retenção local acompanha o histórico financeiro, com prazo aprovado, e impede reutilização da chave enquanto seus fatos estiverem retidos; não depender de cache Redis nem do TTL do PSP;
- serializar abertura de compra por tenant/edição/titular, além da chave: dois dispositivos com chaves diferentes não devem criar duas tentativas cobrantes simultâneas. Sem linha de acesso ainda, é necessário mutex/constraint de compra próprio, não apenas o índice de acesso ativo;
- autorizar toda leitura/replay pelo titular/tenant. Chave não é credencial e não revela compra alheia. Falha definitiva permite uma nova intenção explícita, nunca retry cego; antes disso confirmar que a tentativa anterior não pode mais liquidar. Pagamento tardio duplicado é registrado e restituído, não convertido em segundo acesso.

A alternativa de apenas deduplicar webhooks evita acessos repetidos, mas não cobranças duplicadas na origem; a alternativa de depender só do PSP perde proteção depois do TTL e entre provedores. Ambas são insuficientes.

### 6. Reembolso, benefício utilizado e disputa

**Recomendação:** reembolso pertence à compra/fluxo financeiro. Não apagar resgates nem diminuir contadores para simular que o consumo nunca aconteceu. Como o produto vendido é a edição, não há preço canônico por oferta para calcular automaticamente “saldo de vouchers”. A política comercial, os prazos e o tratamento de direitos aplicáveis precisam ser aprovados pelo dono com suporte responsável; esta proposta não estabelece uma conclusão jurídica nem uma recusa automática por uso.

| Caso                                       | Tratamento recomendado                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compra não paga                            | Cancelar/expirar tentativa no provedor quando suportado; não há acesso para revogar. Continuar detectando confirmação tardia.                                                                                                                                                  |
| Compra paga sem resgate                    | Pedido de restituição elegível segundo política aprovada: bloquear novos usos sob lock do acesso, iniciar estorno idempotente e acompanhar resultado. Só após confirmação financeira revogar o acesso definitivamente.                                                         |
| Um ou mais resgates concluídos             | Análise humana obrigatória para restituição comercial: mostrar comprovantes e termos da compra, decidir total/parcial/indeferimento com motivo. Não presumir que um uso custa fração do preço da edição. Aplicar bloqueio temporário durante análise, com responsável e prazo. |
| Reembolso total confirmado, com ou sem uso | Revogar acesso e invalidar a possibilidade de novos usos; preservar compra, acesso, resgates e comprovantes. Efeito financeiro passado e custo de benefício consumido ficam auditados para decisão comercial/contábil.                                                         |
| Reembolso parcial                          | Tratar como ajuste comercial explícito do preço da edição; recomendação inicial é preservar acesso e limites restantes, sem restaurar usos. Confirmar essa política com o dono.                                                                                                |
| Estorno falhou ou pedido foi indeferido    | Remover bloqueio quando o resultado for conclusivo e não houver disputa/outro impedimento. Manter o **mesmo acesso**, com seus usos; não revogar e conceder outro para desfazer a tentativa.                                                                                   |
| Chargeback/disputa externa                 | Registrar mesmo sem solicitação do consumidor; bloquear novos usos, reconciliar restituição/perda definitiva e encaminhar operação. Se revertida a disputa sem devolução, remover bloqueio no mesmo acesso. Não tratar cartão capturado como dinheiro irreversível.            |

O bloqueio financeiro aceito é um registro separado e reversível ligado à compra/acesso; não um novo estado `pending` de `BenefitAccess`. Carteira, apresentação, preview e confirmação devem consultá-lo, com projeção explícita para o cliente. Essa projeção estende o contrato com `financially_blocked` na carteira e compra; a carteira usa `paused` enquanto bloqueada para preservar clientes existentes. Clientes antigos devem falhar de modo recuperável e não emitir novo uso a partir de cache.

Reembolso e confirmação de resgate precisam compartilhar o mutex do acesso. Antes de gravar o bloqueio e decidir restituição automática sem uso, reler os resgates sob esse lock. Se o resgate venceu a corrida, o caso muda para análise de uso; se o bloqueio venceu, novo resgate falha. O replay de um resgate já concluído continua retornando o comprovante original após autorização, mesmo com bloqueio ou revogação. A ordem atual de consulta do replay antes de `assertRedeemable` é preservada: [serviço, linhas 208–220](../../../app/modules/benefits/services/benefit_redemption_service.ts#L208).

A chamada de estorno fica fora do lock; comando durável e consulta posterior fecham falhas entre provedor e banco. Falha ou estado desconhecido não autoriza remover bloqueio nem repetir devolução sem reconciliação. Reembolso só altera o acesso vinculado à compra, não uma concessão posterior independente. Revogação manual, bloqueio financeiro e disputa são motivos distintos: retirar um motivo não cancela os outros.

**Alternativas:** negar todo reembolso após primeiro uso é simples, mas não é adotado como política automática; estorno proporcional por oferta inventa valores inexistentes; revogar logo na solicitação e recriar acesso se falhar pode renovar limites indevidamente. Um bloqueio reversível tem custo adicional de domínio/contrato, mas evita esse problema.

### 7. Conciliação, auditoria e segurança

Webhook é um sinal de atualização, não a única garantia de entrega. Recomenda-se reconciliação periódica de pendências e rotina diária de fechamento, com frequência e responsável aprovados na operação. Usar consulta por ID e relatórios do provedor; registrar cursor/período, tentativas e conclusão. Reprocessar pela mesma função idempotente da confirmação, sem SQL manual de concessão e sem novos pagamentos.

Confrontar três conjuntos: compras/tentativas locais, pagamentos/estornos/disputas do PSP e liquidação/extrato financeiro. Pagamento confirmado, acesso concedido e dinheiro liquidado são fatos diferentes. Detectar pelo menos: pago sem acesso, acesso pago sem comprovação vinculada, dinheiro recebido sem compra conhecida, duplicidade, diferença de moeda/valor, reembolso remoto não aplicado localmente, chargeback e divergência entre valor bruto, taxas efetivamente informadas e líquido liquidado. Não conceder a usuário inferido por e-mail para “corrigir” recebimento órfão.

Precisam ser auditáveis:

- tenant, comprador, edição, preço/moeda e condições congeladas; aceite dos termos e horários de cada fato;
- compra, tentativa, conta/provedor/ambiente, identificador externo, correlação e hash da chave/intenção;
- confirmação observada, origem webhook/consulta/operador, ID de evento, resultado de autenticação e de processamento, retries e divergências;
- vínculo com acesso, concessão/revogação, bloqueios e motivos; autor humano ou identidade de automação explícita;
- resgates já realizados, valor solicitado/devolvido/acumulado, identificador do estorno, decisões e justificativas;
- conciliação de bruto/taxas/líquido por dados reais, referência de liquidação e tratamento de exceções.

Fatos financeiros exigem registro durável e alterações rastreáveis; logs de aplicação e analytics de descoberta não são livro financeiro. A auditoria financeira e a concessão devem participar do mesmo commit local. O wrapper de auditoria atual não representa compras nem ator de sistema: adaptar essa costura, não usar comprador como falso administrador e não depender da auditoria pós-commit atual de `grant`.

Consumidor lê apenas sua compra; parceiro não recebe dados financeiros da edição por possuir membership da unidade. Operadores financeiros exigem autorização explícita por operação, separada da capacidade de validar resgate. Webhook/worker usam vínculo interno conta/provedor/tenant e credenciais de servidor, sem membership administrativa artificial.

Não armazenar PAN/CVV, segredos, bearer, corpo integral de webhook ou QR de pagamento/apresentação em logs. Tokenizar cartão com superfície oficial do provedor; persistir somente evidência permitida e mínima, sanitizada, com controle de acesso e retenção aprovada. O serviço de auditoria base pode capturar request data quando recebe contexto HTTP ([linhas 47–56](../../../app/modules/audits/services/audit_service.ts#L47)); a implementação deverá impedir captura indiscriminada de dados financeiros. Proteger replay, origem de retorno, CSRF no canal web, rate limit e cache privado das compras. Credenciais reais e valores de `.env` não pertencem ao ADR.

### 8. Catálogo público e experiência de compra

**D-003 permanece integral:** busca, cidade, categorias e ficha pública funcionam sem login, membership ou aquisição. Evidência: [D-003, linhas 24–28](../../product/05-decisoes-e-pendencias.md#L24), [ADR-0003](0003-catalogo-publico-sem-membership.md) e [recusa expressa no documento de mercado, linha 139](../../product/06-referencias-de-mercado.md#L139).

A compra é camada opcional: visitante descobre estabelecimentos e consulta condições comerciais publicadas; autenticação só ao adquirir, acompanhar compra e usar carteira. Não filtrar busca/mapa por posse da edição, esconder contatos ou converter acesso pago em membership de organização. A vitrine de edição mostra preço, venda e uso como janelas distintas; pré-venda não exibe “usar agora”. Conteúdo comercial público deve ser allowlist independente dos estados pessoais de compra, mantendo projeção pública/cache e moderação. Falha do PSP não derruba catálogo.

Web e futuro app consomem o mesmo caso de uso. Não criar backend móvel paralelo nem presumir que retorno do checkout autoriza resgate. A navegação EP-13 permanece do ADR-0023; não criar automaticamente uma aba de compra. A integração móvel e os DTOs de compra/bloqueio terão atualização explícita de OpenAPI e consumidores em trabalho futuro. Esta proposta não altera nenhum dos dois clientes.

## Alternativas consideradas

Além das alternativas por seção:

- **Concessão manual após comprovante:** útil apenas como operação assistida controlada; não satisfaz confirmação verificável nem conciliação automática e não encerra a jornada proposta.
- **Acesso pendente na tabela atual:** exigiria mudar estados e contaminar carteira/resgate com tentativa que pode nunca pagar; preferível pedido pendente e acesso após confirmação.
- **Transação distribuída banco/PSP:** não pressupor atomicidade entre sistemas. Persistência durável, idempotência e compensações/reconciliação são necessárias.
- **Vários PSPs desde o início:** aumenta caminhos de falha e fechamento financeiro; uma interface de adaptação pequena permite evolução sem implementar roteamento multiprovedor agora.

## Consequências

### Positivas

- completa a jornada comprar edição → acesso → carteira → apresentação → uso sem reinventar vouchers;
- usa janela comercial distinta da validade de consumo;
- preserva descoberta gratuita, autorização e resgates históricos;
- recuperação de retries e falhas torna-se parte do contrato, não ajuste manual;
- fornecedor permanece substituível no limite de pagamentos, sujeito à migração de referências e histórico.

### Custos

- novos registros financeiros e processamento durável, conciliação e suporte operacional;
- bloqueio financeiro acrescenta predicado de elegibilidade e projeção privada, exigindo compatibilidade de clientes;
- a concessão atual precisa ser separada entre autorização humana e invariantes transacionais reutilizáveis;
- condições comerciais compradas precisam de snapshot e proteção contra alterações prejudiciais silenciosas;
- responsabilidade de vendedor, reembolso, disputa e liquidação precisa de dono antes de vender.

## Fora de escopo

- deploy e abertura comercial sem homologação e autorização operacional;
- venda de oferta isolada, materialização de vouchers e QR permanentes;
- assinatura/renovação, parcelamento, carrinho multiedição, presentes e transferência;
- split, repasse automático a parceiros e conciliação contábil/fiscal completa; definir responsabilidade fiscal e procedimento operacional continua pré-condição comercial, sem construir um ERP;
- cancelamento/edição de resgate, uso offline e antifraude próprio genérico;
- escolher fornecedor sem decisão do dono, ou estimar taxas não verificadas.

## Cenários obrigatórios de teste

A implementação deve acrescentar testes aos módulos/suítes existentes, sem executar banco persistente. Base de regressão: [acessos, linha 197](../../../tests/functional/benefits/accesses.spec.ts#L197), [referências e escopo, linha 242](../../../tests/functional/benefits/accesses.spec.ts#L242), [resgate idempotente, linha 410](../../../tests/functional/benefits/redemptions.spec.ts#L410), [rollback da auditoria, linha 472](../../../tests/functional/benefits/redemptions.spec.ts#L472) e [concorrência, linha 854](../../../tests/functional/benefits/redemptions.spec.ts#L854).

1. Venda de edição inteira, sem SKU de oferta; valor/moeda definidos pelo servidor; cotação imutável; edição sem janela comercial explícita, pausada, gratuita, expirada ou de outro tenant recusada.
2. Limites de início/fim da venda, pré-venda antes de uso, timezone e pagamento dentro do prazo comunicado depois; uso continua obedecendo janela original. Mudança de preço não muda cobrança iniciada.
3. Titular autenticado e membership válidos; corpo, webhook ou ID alheio não trocam tenant/usuário/edição. Compras/comprovantes pessoais e dados financeiros do operador não vazam a parceiro/moderador sem autorização.
4. Mesma chave/corpo retorna a mesma compra; corpo divergente conflita; dois cliques/dispositivos, mesma ou diferentes chaves, não duplicam cobrança. Retomada após reinício e após TTL do PSP consulta antes de reenviar.
5. Pix pendente, cartão recusado, autorização sem captura, desafio adicional, expiração, timeout e status desconhecido não criam acesso. Retorno forjado de cliente também não.
6. Assinatura/origem inválida, conta/ambiente errado, valor parcial ou divergente, referência desconhecida, webhook duplicado e eventos fora de ordem; sandbox não concede acesso produtivo.
7. Confirmação válida cria exatamente um acesso `payment` com referência; vínculo/auditoria atômicos; falha antes/depois do commit e antes/depois da resposta do PSP recuperável sem cobrança dupla.
8. Webhook perdido recuperado por consulta; evento pago depois de reembolso não reconcede; acesso manual/cortesia concorrente e pagamento tardio duplicado viram exceção/restituição, sem violar unicidades.
9. Estorno sem uso, após uso, parcial, total, negado, em processamento, saldo insuficiente e timeout. Limite acumulado de devolução não excede pagamento; replay não devolve duas vezes.
10. Corrida reembolso/resgate com lock comum; bloqueio impede novo uso e replay preserva comprovante; indeferimento remove só seu bloqueio no mesmo acesso, sem restaurar cotas ou revogar concessão independente.
11. Disputa recebida, perdida, ganha e devolução externa sem pedido local; histórico imutável e conciliação de acesso/financeiro. Nenhum estorno edita/apaga resgate.
12. Conciliação identifica pagos órfãos, acessos sem evidência, diferenças monetárias e liquidação; reprocessamento é idempotente e falha de auditoria aborta efeitos locais correspondentes.
13. Regressões dos ADRs 0020/0021/0022: manual/cortesia continuam, carteira derivada, apresentação temporária, preview sem uso, limites, ownership e mesmo comprovante no retry.
14. Catálogo sem login e sem compra continua igual, inclusive busca/mapa/ficha/cache; pré-venda comercial nunca libera uso nem vaza rascunho; indisponibilidade do PSP não afeta descoberta.
15. DTOs fechados, privacidade/no-store, limitação de requisições, sanitização e ausência de dados de cartão/segredos/QR em logs; paridade OpenAPI/router e compatibilidade web/app para novos estados, somente na implementação.
16. Futuras migrations exclusivamente forward, exercitadas em instalação limpa e schema persistente anterior com dados preservados; retomada de workers e rollback de código não repetem efeitos financeiros. Banco/Redis de teste isolados.

## Marco e decisões pendentes

**EP-14 — Compra de edição e operação financeira mínima** é um marco aceito para implementação do backend. A conclusão comercial exige homologação e autorização de vendas reais, além das regressões locais. A numeração seguinte respeita EP-13 do [ADR-0023, linha 5](0023-stack-e-navegacao-do-cliente-movel.md#L5); o roadmap coloca benefícios na [Fase 7, linhas 244–254](../../product/03-mvp-e-roadmap.md#L244). A [regra de produto, linhas 82–91](../../product/README.md#L82), exige aceitação, domínio/dono, marco e testes antes de implementação estrutural.

Sequência do EP-14:

1. Aprovar unidade vendida, sucessões, política comercial/financeira, dono operacional e provedor; registrar planejamento e critérios de sucesso.
2. Homologar adaptador em sandbox: Pix, cartão capturado, assinatura, retries, estorno, disputa e dados de conciliação; decidir contrato exato do checkout antes de schema/rotas.
3. Implementar compra, persistência durável, confirmação, concessão, reembolso/bloqueio e conciliação mínima com regressões; documentar API e operar primeiro em ambiente isolado.
4. Piloto pago controlado, autorizado separadamente, somente com jornada completa e responsável por exceções. Critério: compra confirmada gera um acesso; uso idempotente funciona; falhas são recuperáveis; reembolso e fechamento têm evidência. Checkout sem restituição/conciliação não encerra o marco.

Registro das escolhas do dono (o registro de aceitação acima prevalece sobre as recomendações originais):

| Decisão                          | Posição e pendência comercial                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Significado de “comprar voucher” | Comprar acesso à edição inteira, pessoal, pagamento único.                                                                                                                |
| Provedor e conta contratada      | Mercado Pago como primeiro candidato; comparar homologação e condições reais com Pagar.me e Stripe. Escolha não realizada por este ADR.                                   |
| Vendedor/recebedor e preço       | Operação como vendedora; definir entidade responsável, valor, condições, suporte e responsabilidade fiscal.                                                               |
| Corte comercial                  | Pix e cartão de crédito à vista em BRL; sem recorrência, split, presente ou recompra para renovar usos.                                                                   |
| Venda versus uso                 | Pré-venda permitida, janela explícita, cotação com prazo aprovado e regras para confirmação tardia/indisponibilidade posterior.                                           |
| Reembolso e uso consumido        | Sem uso: fluxo segundo política aprovada; com uso: análise humana; parcial como ajuste mantendo limites; total revoga sem apagar histórico. Aprovar prazos e responsável. |
| Bloqueio/disputa e exceções      | Impedimento financeiro reversível com prazo de análise; preservar o mesmo acesso ao desbloquear.                                                                          |
| Marco e operação                 | EP-14 aceito; definir responsável financeiro, frequência/SLA de conciliação, retenção e autorização futura do piloto pago.                                                |

O ADR está **aceito**; pendências comerciais não o tornam proposto novamente. A unidade vendida, o corte técnico, venda versus uso e o bloqueio estão aprovados. Provedor/conta, vendedor, preços efetivos, prazos de política comercial e operação continuam pendentes; nenhuma escolha comercial é inferida do schema ou da existência do adaptador.
