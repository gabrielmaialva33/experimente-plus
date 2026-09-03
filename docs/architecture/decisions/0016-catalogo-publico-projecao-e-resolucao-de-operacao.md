# ADR-0016 — Catálogo público, projeção de busca e resolução de operação

- **Status:** Aceito
- **Data:** 2026-08-24
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** ADR-0001, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0012, ADR-0015, EP-06

## Contexto

Depois da publicação atômica da ficha, o Experimente+ precisa expor descoberta pública por cidade e categoria sem exigir login ou membership. Consultar diretamente o agregado transacional em cada busca criaria joins extensos, regras duplicadas de visibilidade, risco de vazamento de drafts e um caminho ruim para ranking, cache e SEO.

O catálogo também precisa lidar corretamente com:

- múltiplas operações isoladas usando hostnames distintos;
- slugs humanos e estáveis;
- cidade e categoria como dimensões de descoberta, não como fronteiras de autorização;
- busca tolerante a acentos e pequenas variações de escrita;
- cálculo de `open_now` com timezone, intervalos noturnos e exceções;
- suspensão, fechamento permanente e desativação de fontes;
- invalidação de cache sem publicar conteúdo antigo ou pendente;
- páginas SSR indexáveis e APIs públicas com o mesmo contrato de leitura.

## Decisão

### 1. A operação pública é resolvida pelo hostname

Toda consulta pública começa em `PublicOperationResolver`.

A aplicação usa o hostname normalizado pelo framework. `X-Forwarded-Host` só participa da
resolução quando a conexão vem de um endereço aceito por `TRUST_PROXY`; caso contrário, o valor
vem do cabeçalho `Host` da própria requisição. No deploy Docker, apenas a faixa privada usada pelo
gateway do proxy é confiável.

O valor é normalizado para minúsculas, sem porta e sem aceitar que o cliente escolha `tenant_id` por query string ou payload. Hostname desconhecido retorna `404`, evitando revelar operações existentes.

### 2. O catálogo usa uma projeção PostgreSQL reconstruível

O read model público é persistido em tabelas próprias e contém somente campos aprovados para exposição. Ele deriva exclusivamente de:

- `establishments.published_revision_id`;
- revisão com status `approved`;
- organização, cidade e categorias ainda elegíveis;
- mídia aprovada;
- estado atual de lifecycle e disponibilidade.

A projeção não é fonte de verdade. Pode ser apagada e reconstruída a partir dos agregados transacionais.

### 3. Atualização e invalidação são dirigidas pelo banco

Triggers atualizam ou removem a projeção quando mudam fontes que afetam visibilidade ou conteúdo publicado. Cada tenant possui uma versão monotônica do catálogo. A versão participa das chaves de cache, tornando entradas anteriores inalcançáveis depois de qualquer mudança relevante.

As consultas públicas ainda revalidam estados críticos das fontes. Essa defesa adicional impede exposição indevida mesmo diante de uma projeção temporariamente atrasada ou de uma manutenção operacional incompleta.

### 4. Busca inicial permanece no PostgreSQL

O ranking combina, de forma determinística:

- igualdade e prefixo de nome;
- full-text search;
- similaridade por trigram;
- correspondência em categoria e atributos públicos;
- desempate estável por nome e identidade da projeção.

A normalização usa `unaccent` e texto em minúsculas. Paginação nunca depende de uma ordem não determinística.

Um motor externo só será introduzido quando métricas reais demonstrarem necessidade e deverá consumir a mesma projeção conceitual.

### 5. `open_now` é calculado no banco

A avaliação considera:

- timezone da cidade/operação;
- horário semanal;
- múltiplos intervalos no mesmo dia;
- intervalo que atravessa a meia-noite;
- dia especial fechado;
- horário especial;
- `always_open`;
- `appointment_only` como estado explicitamente não inferido como aberto.

O cliente nunca calcula sozinho se uma unidade está aberta.

### 6. API e páginas humanas compartilham o read model

Superfície JSON canônica:

```text
GET /api/v1/catalog/cities
GET /api/v1/catalog/cities/:citySlug/categories
GET /api/v1/catalog/cities/:citySlug/establishments
GET /api/v1/catalog/cities/:citySlug/establishments/:establishmentSlug
```

Superfície web SSR:

```text
GET /cidades
GET /cidades/:citySlug
GET /cidades/:citySlug/categorias
GET /cidades/:citySlug/categorias/:categorySlug
GET /cidades/:citySlug/estabelecimentos/:establishmentSlug
```

As URLs usam slugs. IDs internos, autorias, notas de revisão, checksums, eventos e estados não públicos nunca entram nos DTOs.

### 7. Estados de visibilidade

- `active` e publicado: elegível para descoberta normal;
- `temporarily_closed`: permanece visível com sinalização;
- `suspended`: sai imediatamente da descoberta e da ficha pública;
- `permanently_closed`: sai da descoberta normal e pode manter uma página histórica mínima, sem CTA;
- draft, `pending_review`, `changes_requested` ou `rejected`: nunca aparecem;
- revisão nova em análise não altera a versão pública atual.

### 8. SSR e dados estruturados

As páginas públicas recebem os dados no servidor e renderizam conteúdo útil sem depender de JavaScript no primeiro carregamento. A ficha inclui JSON-LD `LocalBusiness` apenas com dados publicados. O sitemap pode ser acrescentado sobre a mesma projeção quando a política de indexação e canonicalização estiver fechada.

## Integridade e segurança

- operação pública não é escolhida por parâmetros do usuário;
- consultas sempre carregam o escopo da operação resolvida;
- slugs são avaliados dentro de cidade e tenant;
- DTOs são allowlists explícitas;
- cache não armazena objetos Lucid nem payload administrativo;
- páginas históricas não expõem contatos acionáveis;
- respostas públicas não diferenciam tenant inexistente de recurso inexistente;
- logs não registram tokens nem dados administrativos da revisão.

## Consequências

### Positivas

- busca pública rápida e previsível;
- drafts e decisões internas ficam estruturalmente separados;
- cache pode ser agressivo sem invalidação manual frágil;
- API, SSR e futuros consumidores usam o mesmo contrato;
- migração futura para outro motor de busca fica explícita e mensurável.

### Custos

- triggers e funções precisam de regressões PostgreSQL;
- alterações em fontes publicáveis exigem atualização do refresh da projeção;
- a projeção aumenta o volume de schema e observabilidade necessários;
- páginas públicas precisam respeitar as mesmas regras de hostname da API.

## Cenários obrigatórios

- hostname desconhecido não revela tenant;
- operação A não lê catálogo da operação B;
- draft nunca aparece em API ou SSR;
- publicação troca a projeção atomicamente;
- revisão nova rejeitada não altera a ficha pública anterior;
- suspensão remove descoberta sem apagar histórico;
- restauração reexpõe a publicação válida;
- categoria/cidade desativada remove resultados;
- mídia pendente ou em quarentena não aparece;
- busca por texto com e sem acento mantém ranking determinístico;
- intervalos noturnos e dias especiais calculam `open_now` corretamente;
- página de encerrado permanentemente não contém CTA;
- rebuild completo produz a mesma projeção lógica;
- versão de cache muda após qualquer fonte relevante.
