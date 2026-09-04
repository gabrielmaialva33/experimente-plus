# ADR 0017 — Analytics de descoberta com privacidade e agregação diária

**Status:** aceito  
**Data:** 24 de agosto de 2026  
**Marco:** EP-07 — Analytics de descoberta

## Contexto

O catálogo público já consegue resolver uma operação pelo hostname, pesquisar a projeção publicada e renderizar páginas SSR. O próximo passo é medir se a descoberta produz valor sem transformar o Experimente+ em uma plataforma de rastreamento invasivo.

O produto precisa responder perguntas operacionais simples:

- quantas vezes uma unidade apareceu em resultados;
- quantas pessoas abriram sua ficha;
- quantos cliques foram feitos em rota, WhatsApp, telefone e site;
- quais buscas públicas terminaram sem resultado;
- como esses sinais evoluem por dia;
- quais unidades pertencentes a uma organização geraram conversões.

Essas métricas possuem riscos próprios:

- eventos enviados pelo navegador podem ser repetidos ou forjados;
- IP, user-agent, termo de busca e identificadores persistentes podem se tornar dados pessoais;
- uma permission global não autoriza acesso a métricas de outra organização;
- a retenção indefinida de eventos brutos não é necessária para o propósito declarado;
- links externos controlados pelo parceiro não podem virar open redirect;
- agregados precisam permanecer idempotentes mesmo quando o mesmo evento é reenviado.

## Decisão

### Eventos aceitos

A primeira versão aceita somente:

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

Não existe endpoint público para inventar tipos arbitrários. Cada evento possui contrato, destino e dimensões allowlisted.

### Ingestão first-party

Eventos de impressão, abertura, compartilhamento e busca sem resultado são recebidos por uma rota pública first-party, sem autenticação, resolvida pelo hostname da operação e protegida por throttle dedicado.

A API aceita lote pequeno para reduzir requisições, mas cada item é validado separadamente e precisa conter `event_id` UUID. O servidor:

1. resolve a operação pelo hostname;
2. resolve cidade, unidade e revisão na projeção pública;
3. rejeita referências não publicadas, suspensas ou de outro tenant;
4. escolhe o tipo e as dimensões permitidas;
5. calcula chave de deduplicação;
6. persiste evento e agregados na mesma transação.

### Cliques externos

Rota, WhatsApp, telefone e site usam endpoints de saída controlados pelo servidor. O destino nunca vem da query string nem do payload do visitante. Ele é derivado da revisão publicada:

```text
/go/:citySlug/:establishmentSlug/route
/go/:citySlug/:establishmentSlug/whatsapp
/go/:citySlug/:establishmentSlug/phone
/go/:citySlug/:establishmentSlug/website
```

A resposta registra o evento e redireciona somente para um destino permitido. Site aceita apenas HTTP/HTTPS. Telefone e WhatsApp são normalizados. Rota usa coordenadas publicadas.

### Sessão anônima

A aplicação emite um cookie first-party criptografado, HttpOnly, SameSite=Lax e sem acesso por JavaScript. O UUID bruto da sessão nunca é salvo no banco.

O identificador persistido é:

```text
HMAC-SHA256(segredo dedicado, tenant_id + UUID da sessão)
```

O cookie existe somente para deduplicação e cálculo de sessões únicas. Não há fingerprint por canvas, fonte, dispositivo, IP ou user-agent.

### Deduplicação

Existem duas proteções complementares:

- `event_id` é único dentro do tenant, tornando retry idempotente;
- `dedupe_key` usa tenant, sessão anônima, tipo, dimensão e bucket temporal.

Buckets iniciais:

- impressão e abertura: 5 minutos;
- compartilhamento e cliques: 30 segundos;
- busca sem resultado: 5 minutos por termo, cidade e categoria.

Um evento deduplicado retorna sucesso, mas não aumenta métricas.

### Privacidade do termo de busca

Somente buscas sem resultado são armazenadas. Antes da persistência o termo é:

- normalizado em NFKC;
- convertido para minúsculas;
- limitado a 120 caracteres;
- limpo de caracteres de controle;
- redigido quando se parece com e-mail, URL, telefone ou sequência numérica longa;
- acompanhado por HMAC para agrupamento estável.

O termo redigido pode ser mostrado a Administradores para melhorar catálogo e taxonomia. O valor original não é salvo.

### Persistência

`analytics_events` guarda eventos brutos por prazo curto e é append-only. Atualizações são proibidas. Exclusões comuns são proibidas; apenas retenção explícita ou cascata de tenant podem removê-los.

`analytics_daily_metrics` guarda contagem e sessões únicas por:

```text
tenant
local_date
event_type
establishment
source
```

`analytics_daily_metric_sessions` mantém a cardinalidade exata de sessões únicas sem armazenar o UUID bruto.

`analytics_daily_search_terms` e `analytics_daily_search_sessions` fazem o equivalente para buscas sem resultado, por cidade, termo redigido e categoria.

A agregação é atualizada na mesma transação do evento. Isso oferece dashboard atual sem depender de job para consistência. Um comando de retenção remove eventos e dimensões expiradas de forma idempotente.

### Retenção

Valores iniciais configuráveis:

```text
eventos brutos: 90 dias
cookie anônimo: 30 dias
agregados e conjuntos de sessão: 25 meses
```

A retenção pode diminuir por política. Aumentá-la exige nova decisão de produto e privacidade.

### Autorização

A rota pública somente escreve eventos validados e nunca lê métricas.

Métricas de organização exigem:

- autenticação;
- tenant ativo;
- permission `analytics.read`;
- membership ativa na organização com papel `owner`, `admin` ou `analyst`; ou
- papel global Root ou Administrador da plataforma na operação ativa.

`editor` não recebe métricas por padrão. Administradores e Root podem consultar buscas sem resultado da operação. Moderador não recebe analytics global automaticamente.

### DTOs

Dashboards retornam agregados, nunca:

- hash de sessão;
- dedupe key;
- event_id;
- IP;
- user-agent;
- metadata bruta;
- IDs de usuário visitante;
- eventos de outra organização.

### Falhas e disponibilidade

Analytics não pode derrubar catálogo ou impedir navegação externa. No navegador, falha de beacon é silenciosa. Em endpoints de saída, a aplicação tenta registrar o evento e registra erro estruturado caso a persistência falhe, mas ainda redireciona para destino público validado.

A consistência de autorização e destino continua obrigatória mesmo quando o evento não é persistido.

## Consequências

### Positivas

- métricas úteis sem armazenar IP ou fingerprint;
- retries e cliques repetidos não inflacionam facilmente o painel;
- organização enxerga somente suas unidades;
- busca sem resultado produz backlog editorial acionável;
- redirecionamentos não aceitam URL arbitrária;
- agregados são atualizados imediatamente e podem ser retidos por mais tempo que eventos brutos;
- uma futura pipeline assíncrona pode reutilizar o mesmo contrato.

### Custos

- ingestão escreve em mais de uma tabela;
- sessões únicas exigem tabelas de cardinalidade;
- métricas são sinais operacionais, não auditoria financeira;
- bloqueio sofisticado de bots continua sendo evolução futura;
- impressão significa item efetivamente observado pelo rastreador do frontend, não mera presença na resposta HTTP.

## Cenários obrigatórios de teste

- registrar lote válido sem autenticação;
- rejeitar tipo desconhecido e payload incompatível;
- hostname de outro tenant nunca resolve unidade estrangeira;
- draft, unidade suspensa e mídia não publicada não geram evento de estabelecimento;
- mesmo `event_id` não duplica contagem;
- mesma sessão no bucket não duplica evento nem sessão única;
- sessão diferente aumenta `unique_sessions`;
- termo de busca redige e-mail, telefone e URL;
- rota externa deriva destino da projeção e não aceita open redirect;
- parceiro só lê analytics da própria organização;
- analyst lê, editor não lê;
- Administrador lê buscas sem resultado; Moderador comum não;
- retenção remove somente registros expirados;
- evento bruto não pode ser atualizado ou apagado fora da retenção;
- dados de sessão e metadata interna não aparecem nos DTOs;
- frontend envia abertura e impressão sem bloquear navegação.

## Relações

- aplica ADR 0001 na resolução pública da operação;
- respeita ADR 0003 ao manter catálogo sem autenticação;
- usa somente revisão publicada definida nos ADRs 0004, 0012 e 0015;
- depende da projeção PostgreSQL e das regras de busca dos ADRs 0006 e 0016;
- segue ADR 0007 combinando permission global e policy de organização;
- não altera ranking orgânico nem cria popularidade automática no MVP.
