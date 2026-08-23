# ADR-0008 — Modelo físico de Geografia

- Status: Aceito
- Data: 23 de agosto de 2026
- Marco: EP-01 — Geografia e Taxonomia

## Contexto

O Experimente+ precisa organizar descoberta em várias cidades próximas sem transformar cidade em tenant. Regiões devem apoiar navegação, expansão comercial e campanhas, mas não autorização. Cidades precisam carregar informações suficientes para URLs públicas, timezone e evolução geoespacial, sem antecipar bairros, polígonos ou PostGIS.

## Decisão

O domínio `geography` possuirá duas entidades no EP-01:

```text
regions
cities
```

Ambas são tenant-scoped e possuem `tenant_id` obrigatório.

### `regions`

Campos canônicos:

```text
id
tenant_id
name
slug
description
sort_order
is_active
created_at
updated_at
```

Regras:

- `slug` é único dentro do tenant;
- região inativa não aparece em consultas públicas;
- região é agrupamento editorial e operacional, não fronteira de segurança;
- exclusão física não será exposta pela API administrativa do MVP;
- `(id, tenant_id)` será unique para permitir FKs compostas que garantam o escopo.

### `cities`

Campos canônicos:

```text
id
tenant_id
region_id
name
slug
state_code
country_code
ibge_code
timezone
latitude
longitude
sort_order
is_active
created_at
updated_at
```

Regras:

- toda cidade pertence a uma região do mesmo tenant;
- `slug` é único dentro do tenant;
- `ibge_code`, quando informado, é único dentro do tenant;
- `country_code` usa ISO 3166-1 alpha-2;
- `state_code` usa o código administrativo de duas letras no Brasil;
- timezone é obrigatório e usa identificador IANA, por exemplo `America/Sao_Paulo`;
- latitude e longitude devem ser ambas nulas ou ambas preenchidas;
- coordenadas representam o centro inicial da cidade, não o endereço de estabelecimentos;
- cidade inativa não aparece no catálogo e invalida publicação futura;
- desativação preserva referências históricas.

## Escopo geográfico inicial

O código não fixa o agrupamento comercial de lançamento. O seeder de desenvolvimento poderá criar uma região demonstrativa com Cornélio Procópio e Londrina, mas isso não representa decisão de go-to-market.

## URLs e busca

- URLs públicas usarão `city.slug`;
- IDs internos não integram URLs canônicas;
- nomes e slugs são independentes do tenant slug;
- bairros e áreas entram somente após necessidade validada;
- PostGIS não será adicionado no EP-01;
- busca por proximidade avançada permanece posterior ao catálogo textual inicial.

## Autorização

### Administração

Rotas privadas exigem:

```text
auth
→ tenant({ required: true })
→ permission global de regions/cities
→ query tenant-scoped
```

### Catálogo

Consultas públicas:

- resolvem a operação pelo `PublicOperationResolver`;
- não usam membership;
- retornam somente cidades e regiões ativas;
- nunca aceitam `tenant_id` do cliente como autoridade.

## Integridade

As migrations usarão FKs compostas para impedir que uma cidade de um tenant referencie região de outro tenant:

```text
(city.region_id, city.tenant_id)
    → (region.id, region.tenant_id)
```

Slugs são gerados e normalizados na aplicação, mas a unicidade permanece garantida pelo banco.

## Alternativas rejeitadas

### Cidade como tenant

Rejeitada pelo ADR-0001. Fragmentaria organizações multicidade e impediria catálogo público simples.

### Região global sem tenant

Rejeitada. Uma operação white-label precisa administrar sua própria geografia e ativação.

### Endereço completo na tabela de cidade

Rejeitada. Cidade não é unidade pública e não precisa de CEP ou logradouro.

### PostGIS desde o primeiro corte

Adiado. Latitude/longitude são suficientes para o EP-01; PostGIS será avaliado quando busca por distância e polígonos entrarem no roadmap.

## Consequências

- o schema fica preparado para múltiplas operações e cidades;
- URLs públicas permanecem humanas;
- timezone de “aberto agora” tem fonte explícita;
- isolamento entre operações é verificável no banco;
- bairros, geocoding e PostGIS continuam evoluções compatíveis.

## Cenários obrigatórios de teste

- slug de região único por tenant e reutilizável em tenant diferente;
- slug de cidade único por tenant;
- cidade não referencia região de outro tenant;
- IBGE duplicado no mesmo tenant é rejeitado;
- coordenadas parciais são rejeitadas;
- cidade inativa não aparece publicamente;
- listagem administrativa não vaza outro tenant;
- catálogo público funciona sem autenticação ou membership.
