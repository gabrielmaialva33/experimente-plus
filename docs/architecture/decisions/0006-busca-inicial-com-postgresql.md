# ADR-0006 — Busca inicial com PostgreSQL

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** ADR-0003, ADR-0004; EP-06

## Contexto

O MVP precisa pesquisar por nome, descrição, cidade, bairro, categoria e atributos, além de aplicar filtros como “aberto agora”. Também deve tolerar acentos e pequenos erros de digitação em português.

Adicionar Meilisearch, Elasticsearch ou OpenSearch no primeiro ciclo aumentaria:

- infraestrutura;
- sincronização e consistência eventual;
- observabilidade;
- custo operacional;
- superfície de falha;
- complexidade de testes.

A densidade inicial prevista é pequena o suficiente para PostgreSQL 16 atender busca e filtros com índices adequados.

## Decisão

A primeira implementação de busca usará PostgreSQL, encapsulada por um contrato de repository que permita trocar o mecanismo futuramente.

```text
CatalogSearchService
        ↓
CatalogSearchRepository
        ↓
PostgreSQL catalog projection
```

Controllers e casos de uso não dependem de SQL específico ou de uma engine externa.

## Projeção de busca

EP-06 criará uma projeção persistida para a revisão atualmente publicada de cada unidade. Conceitualmente, cada entrada contém:

- `tenant_id`;
- `establishment_id`;
- `published_revision_id`;
- `city_id`;
- slug e nome;
- bairro e endereço resumido;
- categorias públicas;
- atributos pesquisáveis;
- `business_status`;
- coordenadas;
- texto normalizado;
- `tsvector` em português;
- timestamps de publicação e atualização;
- metadado de patrocínio separado do score orgânico.

A projeção não substitui a fonte de verdade. Ela é reconstruível a partir da revisão aprovada.

Publicação, suspensão, encerramento, mudança de cidade/categoria e aprovação de nova revisão atualizam ou removem a entrada de busca de forma transacional ou via outbox confiável.

## Extensões e índices

As migrations do catálogo habilitarão, quando ainda ausentes:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Índices esperados:

- GIN no `search_vector`;
- GIN/GiST trigram no nome e texto normalizado quando necessário;
- B-tree em `(tenant_id, city_id, business_status)`;
- índices de categoria na projeção relacional;
- índices para publicação/atividade;
- índice espacial somente quando a estratégia geográfica for definida; o MVP pode iniciar com latitude/longitude e cálculo limitado.

A implementação deve validar planos com `EXPLAIN (ANALYZE, BUFFERS)` usando volume sintético maior que o piloto.

## Normalização

O texto pesquisável será construído a partir de campos aprovados:

- nome da unidade;
- aliases editoriais permitidos;
- descrição curta;
- cidade e bairro;
- categorias e subcategorias;
- atributos públicos marcados como pesquisáveis.

Normalização:

- lowercase;
- remoção de acentos para comparação auxiliar;
- espaços e pontuação normalizados;
- sem inclusão de CNPJ, contatos privados ou texto interno;
- sinônimos controlados pela taxonomia, não inseridos livremente pelo parceiro.

## Estratégia de matching

A consulta combinará:

1. match exato de nome;
2. prefixo de nome;
3. full-text search em português;
4. similaridade trigram para tolerância a erro;
5. filtros estruturados.

Filtros por tenant, cidade, publicação e atividade são aplicados antes ou junto do ranking, nunca após retornar registros de outro escopo.

## Ranking orgânico inicial

O ranking deve ser simples, explicável e determinístico.

Ordem conceitual de sinais:

1. nome exato;
2. prefixo de nome;
3. relevância full-text;
4. similaridade trigram;
5. correspondência de categoria/intenção;
6. completude e atualidade como desempate;
7. ordem editorial explícita, quando existir;
8. `establishment_id` como último desempate estável.

No MVP, popularidade e cliques não aumentam automaticamente o ranking. Isso evita privilegiar eternamente quem já possui tráfego e reduz incentivo a fraude antes de existir antifraude.

Distância só participa quando o usuário fornece localização e a estratégia geográfica estiver implementada. Cidade escolhida continua sendo o filtro principal.

## Patrocínio

Patrocinado não altera o score orgânico silenciosamente.

A API retorna blocos ou metadados separados, por exemplo:

```text
sponsored_results[]
organic_results[]
```

ou cada resultado patrocinado possui identificação inequívoca. A UI exibe “Patrocinado”. Elegibilidade e publicação continuam obrigatórias.

## “Aberto agora”

“Open now” é filtro estruturado, não termo textual.

O cálculo considera:

- timezone da cidade;
- modalidade de disponibilidade;
- intervalos semanais;
- intervalos atravessando meia-noite;
- exceções de data/feriado;
- `business_status`;
- `appointment_only`, que não deve ser apresentado como aberto agora sem regra específica.

O primeiro agrupamento usa `America/Sao_Paulo`, mas timezone deve ser dado da cidade para não virar constante global impossível de evoluir.

## Paginação

O MVP pode usar `page` e `per_page`, com:

- máximo configurado;
- valores inteiros positivos, rejeitando frações na borda HTTP;
- ordenação determinística;
- filtros repetíveis;
- `establishment_id` como desempate.

A busca normaliza uma página solicitada além do intervalo para a última página real dentro da
mesma consulta que calcula o total e lê os resultados. Quando o total é zero, usa-se a primeira
página. Metadados e URLs representam sempre essa página efetiva; a chave de cache pode conservar a
página originalmente solicitada sem alterar o envelope canônico.

Se ranking personalizado ou atualização muito frequente tornar offset instável, a API poderá evoluir para cursor sem alterar o service de busca.

## Observabilidade

Registrar, com privacidade:

- termo normalizado ou hash/forma agregada conforme política;
- cidade e categorias;
- quantidade de resultados;
- duração da consulta;
- filtros;
- pesquisa sem resultado;
- estratégia usada (exact, FTS, trigram);
- erro e timeout.

Não registrar conteúdo sensível ou identificador pessoal desnecessário.

## Critérios para adotar engine externa

Reavaliar PostgreSQL quando ao menos uma condição material ocorrer:

- p95 de busca exceder a meta definida mesmo após otimização;
- catálogo ou tráfego ultrapassar capacidade comprovada em teste;
- faceting e sinônimos ficarem difíceis de manter;
- relevância/typo tolerance não atingir qualidade aceitável;
- múltiplos idiomas e ranking avançado exigirem pipeline dedicado;
- indexação geoespacial complexa se tornar central;
- equipe possuir capacidade operacional para manter a nova dependência.

A migração deve implementar outro `CatalogSearchRepository`, fazer backfill e executar comparação shadow antes do corte.

## Alternativas consideradas

### Busca simples com `ILIKE '%termo%'`

Rejeitada como estratégia principal. Escala mal e possui relevância/tolerância limitadas.

### Engine externa desde o início

Rejeitada pelo custo operacional desproporcional ao volume inicial.

### Ranking baseado em cliques no MVP

Rejeitado por viés de popularidade e facilidade de manipulação.

### Patrocinado misturado ao ranking

Rejeitado por transparência e confiança.

## Consequências

### Positivas

- uma dependência operacional a menos;
- consistência próxima da publicação;
- testes e desenvolvimento locais simples;
- busca suficiente para o piloto;
- caminho de substituição preservado pelo repository.

### Custos

- SQL e índices precisam ser bem desenhados;
- sinônimos e typo tolerance exigem trabalho próprio;
- projeção precisa ser atualizada com confiabilidade;
- evolução para engine externa exigirá backfill futuro.

## Invariantes de teste

- busca nunca retorna registro de outro tenant;
- apenas revisão publicada e elegível entra na projeção;
- acentos não impedem match esperado;
- erro pequeno pode usar trigram sem retornar resultados irrelevantes acima do limite;
- cidade e categoria filtram corretamente;
- ordem é determinística;
- patrocinado é identificado e elegível;
- `temporarily_closed` não passa em “aberto agora”;
- pesquisa sem resultado é registrada sem dados pessoais indevidos;
- remover/suspender uma unidade a retira da busca após commit/invalidação.
