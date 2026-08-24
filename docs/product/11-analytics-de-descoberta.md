# EP-07 — Analytics de descoberta

**Estado:** concluído em 24 de agosto de 2026  
**Contrato arquitetural:** ADR-0017

## Objetivo

Medir se o catálogo público ajuda visitantes a descobrir e contatar unidades sem transformar o Experimente+ em uma plataforma de rastreamento individual.

A primeira vertical responde:

- quantas vezes as unidades apareceram no catálogo;
- quantas fichas foram abertas;
- quais ações públicas foram usadas;
- quais pesquisas não retornaram resultados;
- qual foi o alcance diário aproximado;
- como cada unidade da organização performou no período.

Ela não tenta identificar pessoas, construir perfis comportamentais ou atribuir conversões entre dispositivos.

## Eventos aceitos

```text
catalog_impression
establishment_view
route_click
whatsapp_click
phone_click
website_click
share_click
search_without_results
```

Os eventos são validados conforme o tipo. Por exemplo:

- eventos de unidade exigem cidade e estabelecimento publicados na mesma operação;
- `search_without_results` exige termo de pesquisa e não aceita estabelecimento;
- categorias, quando informadas, devem existir no catálogo público do tenant;
- destinos externos não são recebidos no payload.

## Ingestão pública

```text
POST /api/v1/analytics/events
```

A API:

1. limita o lote a 20 eventos;
2. resolve a operação pelo hostname público;
3. valida cidade, categoria, unidade e revisão publicada;
4. aplica deduplicação por `event_id` e janela semântica;
5. persiste evento bruto pseudônimo;
6. atualiza agregados diários e sessões únicas;
7. retorna contagem de eventos gravados, deduplicados ou suprimidos.

A ingestão usa throttle público e nunca exige login.

## Sessão pseudônima

Quando não há sinal de opt-out, o servidor cria um cookie first-party:

- aleatório;
- criptografado;
- `HttpOnly`;
- `SameSite=Lax`;
- limitado ao domínio da operação;
- sem e-mail, telefone, nome, usuário ou tenant no valor legível.

O banco guarda apenas HMAC do identificador. O mesmo visitante pode continuar sendo contado como uma sessão aproximada no mesmo navegador, mas o identificador não é útil fora do segredo da aplicação.

## Sinais de privacidade

A UI e o servidor respeitam:

```text
Global Privacy Control: Sec-GPC: 1
Do Not Track: DNT: 1
```

Quando um desses sinais está ativo:

- a UI não envia eventos;
- o endpoint aceita o lote sem persistir dados;
- nenhum cookie analítico é criado;
- redirecionamentos seguros continuam funcionando, mas não geram evento.

Analytics nunca pode impedir navegação, abertura da ficha ou ação de contato.

## Minimização

O pipeline não persiste:

- IP bruto;
- user agent bruto;
- user id autenticado;
- e-mail do visitante;
- telefone do visitante;
- URL arbitrária de origem;
- fingerprint;
- coordenadas do visitante;
- conteúdo de formulários.

Termos sem resultado passam por normalização, remoção de e-mails e telefones e HMAC. O painel administrativo recebe somente o termo redigido e agregado.

## Deduplicação

Duas camadas são usadas:

### Event ID

O cliente gera UUID por evento. Reenvio do mesmo lote não incrementa métricas novamente.

### Janela semântica

Eventos repetidos da mesma sessão, alvo e tipo dentro de uma janela curta compartilham `dedupe_key`. Isso reduz:

- efeitos de re-renderização;
- múltiplos cliques acidentais;
- retries;
- automações simples;
- ruído de navegação.

A deduplicação não pretende ser antifraude completo.

## Ações externas seguras

As CTAs públicas usam:

```text
GET /go/:citySlug/:establishmentSlug/route
GET /go/:citySlug/:establishmentSlug/whatsapp
GET /go/:citySlug/:establishmentSlug/phone
GET /go/:citySlug/:establishmentSlug/website
```

O destino é derivado exclusivamente da projeção publicada:

- rota usa coordenadas aprovadas e Google Maps;
- WhatsApp e telefone usam número público normalizado;
- site aceita somente `http` e `https` publicados;
- nenhuma query string pode fornecer destino livre.

Assim, o tracking não cria um open redirect.

## Agregados

O banco mantém:

```text
analytics_events
analytics_daily_metrics
analytics_daily_metric_sessions
analytics_daily_search_terms
analytics_daily_search_sessions
```

Os agregados são atualizados idempotentemente na mesma transação do evento bruto. Eles preservam:

- tenant;
- organização por relacionamento com a unidade;
- unidade;
- data;
- tipo de evento;
- contagem;
- sessões pseudônimas únicas.

## Painel da organização

```text
GET /api/v1/organizations/:organizationId/analytics
GET /organizations/:organizationId/analytics
```

Capabilities:

```text
owner   → leitura
admin   → leitura
analyst → leitura
editor  → sem acesso
```

O painel mostra:

- impressões;
- aberturas de ficha;
- ações de contato;
- série diária;
- alcance diário aproximado;
- desempenho por unidade.

Um membro nunca consulta analytics de outra organização ou operação.

## Diagnóstico da plataforma

```text
GET /api/v1/admin/analytics/searches/no-results
```

Somente Administrador e Root podem consultar termos sem resultado. O endpoint é tenant-scoped, paginado e retorna apenas dados redigidos e agregados.

## Retenção

A retenção é explícita e configurável:

- eventos brutos: janela curta;
- hashes de sessão diária: janela intermediária;
- agregados: janela maior;
- termos redigidos: janela própria.

A limpeza é executada por:

```text
node ace analytics:prune
```

As tabelas brutas e de sessão são protegidas contra `UPDATE` e `DELETE` comuns. O comando abre uma transação com contexto de retenção específico antes de apagar apenas linhas expiradas.

## Limites deliberados

O EP-07 não inclui:

- atribuição entre dispositivos;
- pixels de terceiros;
- publicidade comportamental;
- fingerprint;
- ranking baseado em cliques;
- funil de checkout;
- exportação individual de visitantes;
- dados em tempo real por pessoa.

Popularidade não altera o ranking orgânico do EP-06.

## Relação com a especificação do Sobral

A fonte original separa Explorador, Parceiro, Administrador e Moderador, mas não define o contrato de privacidade ou isolamento de analytics. O EP-07 preserva esses limites:

- Explorador gera somente sinais públicos pseudônimos;
- Parceiro enxerga agregados da própria organização;
- Administrador enxerga lacunas agregadas do catálogo;
- Moderador não recebe acesso automático a métricas comerciais.

## Critérios cobertos

- lote idempotente;
- deduplicação sem contagem dupla;
- isolamento por hostname e tenant;
- rejeição de alvo não publicado;
- redaction de e-mail e telefone;
- GPC/DNT sem cookie ou persistência;
- owner/admin/analyst autorizados;
- editor e outsider bloqueados;
- relatório administrativo restrito;
- redirects allowlisted;
- histórico bruto append-only;
- retenção somente para expirados;
- UI pública instrumentada sem bloquear a experiência;
- painel SSR privado e não indexável.
