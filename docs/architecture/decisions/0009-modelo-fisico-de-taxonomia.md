# ADR-0009 — Modelo físico de Taxonomia

- Status: Aceito
- Data: 23 de agosto de 2026
- Marco: EP-01 — Geografia e Taxonomia

## Contexto

O Experimente+ começa pela gastronomia, mas precisa atender cinema, tatuagem, lazer, cultura, beleza, bem-estar e outros serviços. Uma tabela de estabelecimentos com colunas específicas de restaurante criaria muitos campos nulos, regras condicionais e acoplamento entre categorias.

A taxonomia precisa oferecer:

- famílias editoriais;
- categorias e subcategorias;
- slugs públicos estáveis;
- atributos específicos e tipados;
- opções para filtros enumerados;
- desativação sem apagar histórico;
- isolamento entre operações.

## Decisão

O EP-01 criará:

```text
category_families
categories
category_attribute_definitions
category_attribute_options
```

Todas as tabelas são tenant-scoped.

## Famílias de categoria

`category_families` agrupa a navegação de alto nível, por exemplo:

```text
Comer & Beber
Lazer & Entretenimento
Cultura & Experiências
Estilo & Bem-estar
Serviços locais
```

Campos:

```text
id
tenant_id
name
slug
description
icon
sort_order
is_active
created_at
updated_at
```

Regras:

- `slug` é único por tenant;
- família inativa e seus descendentes não aparecem publicamente;
- `(id, tenant_id)` é unique para FKs compostas;
- ícone é um identificador semântico, não HTML arbitrário.

## Categorias e subcategorias

`categories` usa adjacency list com `parent_id` opcional.

Campos:

```text
id
tenant_id
family_id
parent_id
name
slug
description
icon
sort_order
is_active
created_at
updated_at
```

Regras:

- slug é único no tenant inteiro, simplificando URLs e busca;
- categoria pertence a família do mesmo tenant;
- subcategoria pertence à mesma família do pai;
- o EP-01 permite no máximo dois níveis abaixo da família: categoria e subcategoria;
- categoria pai precisa ser raiz;
- ciclos são impedidos pelo service;
- uma categoria com filhos não pode ser movida para outra família sem mover ou revalidar os descendentes;
- desativar categoria não apaga vínculos históricos;
- uma unidade pode possuir várias categorias, mas deverá ter uma categoria principal quando o domínio de unidades existir.

A integridade tenant/família do pai será reforçada por FK composta:

```text
(parent_id, tenant_id, family_id)
    → (category.id, category.tenant_id, category.family_id)
```

## Definições de atributo

Atributos descrevem dados específicos de uma categoria sem criar colunas globais.

Exemplos:

```text
Restaurante
  cuisine_type
  price_range
  vegetarian_options

Estúdio de tatuagem
  tattoo_styles
  quote_required

Cinema
  room_types
  accessibility
  showtimes_url
```

Campos:

```text
id
tenant_id
category_id
key
name
description
data_type
unit
is_required
is_filterable
is_public
applies_to_descendants
sort_order
is_active
validation_rules
created_at
updated_at
```

Tipos aceitos:

```text
text
long_text
boolean
integer
decimal
single_select
multi_select
url
```

Regras:

- `(tenant_id, category_id, key)` é unique;
- key usa formato slug/snake_case estável;
- atributo pertence a categoria do mesmo tenant;
- `validation_rules` é JSON validado pela aplicação, reservado a limites simples;
- dados essenciais de identidade, endereço, contato e horário não usam atributos flexíveis;
- `is_filterable` só é aceito para tipos com semântica de filtro definida;
- atributos podem aplicar-se a descendentes quando explicitamente marcados;
- alterar `data_type` após valores de unidade existirem exigirá migration de domínio ou nova definição; o EP-01 trata o tipo como imutável na API.

## Opções de atributo

`category_attribute_options` define valores de `single_select` e `multi_select`.

Campos:

```text
id
tenant_id
attribute_definition_id
label
value
sort_order
is_active
created_at
updated_at
```

Regras:

- `(tenant_id, attribute_definition_id, value)` é unique;
- opção pertence a definição do mesmo tenant;
- opções só podem ser criadas para tipos select;
- `value` é identificador estável e não muda quando o label editorial muda;
- opção inativa não é oferecida em novos formulários, mas referências históricas permanecem válidas.

## API administrativa

O primeiro corte terá rotas privadas para:

- listar, criar, consultar e atualizar famílias;
- listar, criar, consultar e atualizar categorias;
- listar, criar, consultar e atualizar definições;
- listar, criar e atualizar opções.

Não haverá hard delete administrativo no EP-01. Desativação usa `is_active`.

## API pública

O catálogo expõe uma árvore allowlisted de famílias e categorias ativas. Definições públicas podem integrar filtros e formulários, mas nunca retornam regras administrativas internas.

A árvore pública não depende de existir uma unidade publicada. Quando o catálogo de unidades estiver disponível, endpoints por cidade poderão retornar apenas categorias com oferta ativa.

## Árvore inicial de desenvolvimento

O seeder de desenvolvimento criará somente a vertical gastronômica mínima:

```text
Comer & Beber
├── Restaurantes
├── Bares
├── Cafés
├── Padarias
└── Docerias
```

Isso valida extensibilidade sem decidir antecipadamente todas as categorias do lançamento comercial.

## Alternativas rejeitadas

### Enum fixo no código

Rejeitada. Exigiria deploy e migration para cada nova categoria e dificultaria operação editorial.

### Uma tabela por categoria

Rejeitada para o núcleo. Extensões tipadas poderão existir quando uma vertical justificar regras próprias, mas identidade e descoberta continuam compartilhadas.

### Todos os atributos em JSON livre na unidade

Rejeitada. Perderia validação, filtros, governança e integridade referencial.

### Árvore ilimitada

Adiada. Dois níveis abaixo da família atendem o MVP e simplificam navegação, URLs e formulários.

### Slug único apenas dentro da família

Rejeitada. Slug global por tenant simplifica rotas públicas e evita ambiguidade ao mover categorias.

## Consequências

- novas categorias não exigem alterar `establishments`;
- filtros podem ser definidos editorialmente;
- atributos permanecem tipados e validados;
- famílias e categorias podem ser reordenadas e desativadas;
- o schema suporta operações white-label sem colisão;
- valores de atributos de unidades serão implementados no EP-03.

## Cenários obrigatórios de teste

- slugs de família e categoria são únicos por tenant;
- o mesmo slug pode existir em tenants diferentes;
- categoria não referencia família de outro tenant;
- subcategoria não referencia pai de outro tenant ou família;
- terceiro nível é rejeitado pelo service;
- ciclos são rejeitados;
- definição não referencia categoria de outro tenant;
- opção só é criada em atributo select;
- opção não cruza tenant;
- família/categoria inativa não aparece publicamente;
- listagens administrativas são tenant-scoped.
