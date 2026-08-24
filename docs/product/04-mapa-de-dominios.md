# 04 — Mapa de domínios

Este documento define limites conceituais. Ele não é um schema e não autoriza automaticamente a criação de tabelas.

## Modelo operacional

### Tenant

Decisão aceita pelo [ADR-0001](../architecture/decisions/0001-tenant-representa-operacao.md):

> **Tenant representa uma operação isolada da plataforma, não uma cidade e não um parceiro.**

No início haverá uma única operação Experimente+. A separação permite, futuramente, white-label, franquia independente ou ambiente institucional sem fragmentar cidades e redes empresariais.

Consequências:

- cidade existe dentro de uma operação;
- organização pode atuar em várias cidades da mesma operação;
- unidade pertence a uma organização e a uma cidade;
- catálogo público resolve a operação por configuração, hostname ou slug;
- visitante público não precisa ser membro do tenant;
- backoffice continua usando membership de tenant para acesso à operação;
- membership da organização é uma camada adicional de autorização.

### Região e cidade

Cidade é uma dimensão de descoberta e localização.

Região agrupa cidades para navegação, campanhas e expansão comercial. Não é uma fronteira de segurança.

```text
Tenant / operação
└── Região
    └── Cidade
        └── Unidade pública
```

### Organização e unidade

Organização representa o responsável legal ou comercial.

Unidade representa o local público encontrado pelo usuário.

```text
Organização
├── membros
├── dados legais privados
└── unidades
    ├── cidade A
    ├── cidade B
    └── cidade C
```

Uma rede não deve ser duplicada porque possui unidades em cidades diferentes.

## Domínios do primeiro ciclo

## `identity`

Responsabilidade:

- contas;
- autenticação;
- sessões;
- verificação de e-mail;
- recuperação de senha;
- roles e permissions globais;
- exclusão e anonimização de conta.

Estado atual: já existe na fundação.

Não deve conhecer detalhes de estabelecimento, cidade ou categoria.

## `geography`

Responsabilidade:

- regiões;
- cidades;
- estado/UF;
- slugs e nomes públicos;
- coordenadas centrais e limites quando necessários;
- ativação da cidade no catálogo;
- bairros ou áreas futuras.

Entidades conceituais:

```text
regions
cities
neighborhoods (posterior)
```

Invariantes:

- cidade pertence a uma operação;
- slug é único dentro da operação;
- cidade inativa não aparece na descoberta;
- desativar cidade não apaga histórico.

## `taxonomy`

Responsabilidade:

- famílias de categoria;
- categorias e subcategorias;
- ordem e ícones;
- filtros aplicáveis;
- atributos específicos por categoria;
- ativação e desativação.

Exemplo:

```text
Comer & Beber
├── Restaurantes
├── Bares
├── Cafés
└── Docerias

Lazer & Entretenimento
├── Cinemas
├── Parques
└── Jogos

Estilo & Bem-estar
├── Tatuagem
├── Barbearias
└── Salões
```

Atributos não devem virar uma tabela gigante com colunas de todas as categorias.

Opções conceituais:

```text
category_attribute_definitions
category_attribute_options
establishment_attribute_values
```

Exemplos de atributos:

- restaurante: culinária, faixa de preço, vegetariano, delivery;
- tatuagem: estilos, atendimento por orçamento, artistas;
- cinema: acessibilidade, tipos de sala, link de sessões.

A decisão entre atributos flexíveis e extensões tipadas será feita por caso. Dados essenciais para busca e integridade não devem ficar escondidos em JSON sem validação.

## `organizations`

Responsabilidade:

- dados legais e comerciais;
- CNPJ e validação;
- status de aprovação;
- members e papéis internos;
- propriedade das unidades;
- claim e transferência futura.

Entidades conceituais:

```text
organizations
organization_members
organization_claims
organization_invitations
```

Papéis internos aceitos pelo [ADR-0002](../architecture/decisions/0002-organizacao-e-unidade-sao-agregados-distintos.md) e [ADR-0007](../architecture/decisions/0007-rbac-global-com-policies-de-dominio.md):

```text
owner
admin
editor
analyst
```

Invariantes:

- um usuário só administra organização onde possui membership adequada;
- dados legais privados não vazam no catálogo;
- suspensão da organização afeta publicação das unidades;
- CNPJ deve ser normalizado e validado;
- escopo de unicidade do CNPJ e exceções para pessoa física ainda precisam de decisão.

Workflow aceito pelo [ADR-0004](../architecture/decisions/0004-publicacao-versionada-e-maquinas-de-estado.md):

```text
draft
pending_review
changes_requested
active
rejected
suspended
archived
```

## `establishments`

Responsabilidade:

- identidade estável da unidade pública;
- organização proprietária;
- lifecycle administrativo;
- disponibilidade operacional;
- referência da revisão publicada;
- revisões versionadas do conteúdo público;
- completude, submissão e publicação.

Entidades conceituais:

```text
establishments
establishment_revisions
establishment_revision_addresses
establishment_revision_business_hours
establishment_revision_hour_exceptions
establishment_revision_categories
establishment_revision_attribute_values
```

O [ADR-0004](../architecture/decisions/0004-publicacao-versionada-e-maquinas-de-estado.md) separa três eixos:

```text
establishment.lifecycle_status
  active | suspended | archived

establishment.business_status
  open | temporarily_closed | permanently_closed

establishment_revision.status
  draft | pending_review | changes_requested | approved | rejected
```

A unidade aponta para uma revisão publicada. Ao editar conteúdo já publicado, o sistema cria uma nova revisão; a versão anterior continua pública até a aprovação da nova.

Os gates do [ADR-0005](../architecture/decisions/0005-completude-submissao-e-publicacao.md) exigem organização, cidade, endereço, categoria, disponibilidade, contato, mídia e autorização. Uma unidade sem revisão aprovada, suspensa ou arquivada nunca aparece em consultas públicas normais.

## `media`

Responsabilidade:

- associação de arquivos a entidades de negócio;
- tipo e finalidade da mídia;
- imagem de capa;
- ordem;
- texto alternativo e legenda;
- moderação;
- processamento futuro.

A infraestrutura `files` continua responsável pelo armazenamento físico. O domínio `media` adiciona semântica ao arquivo.

Entidades conceituais:

```text
media_assets
establishment_revision_media
media_moderation_events
```

Estados aceitos:

```text
pending
approved
rejected
quarantined
```

Mídia não aprovada não aparece publicamente.

## `moderation`

Responsabilidade:

- fila de análise;
- caso de moderação;
- decisão e motivo;
- solicitação de correção;
- suspensão;
- denúncias futuras;
- histórico imutável de ações.

Entidades conceituais:

```text
moderation_cases
moderation_actions
moderation_reasons
reports (posterior)
```

O domínio não deve alterar silenciosamente o conteúdo. Toda decisão relevante possui ator, data, motivo e estado anterior/posterior.

## `catalog`

Responsabilidade:

- consultas públicas;
- pesquisa;
- filtros;
- páginas de cidade e categoria;
- read models;
- ordenação orgânica;
- identificação de patrocinado;
- cache e indexação futura.

O catálogo não é dono dos dados de organização ou unidade. Ele projeta apenas a revisão atualmente aprovada, conforme [ADR-0003](../architecture/decisions/0003-catalogo-publico-sem-membership.md), e usa PostgreSQL como mecanismo inicial de busca conforme [ADR-0006](../architecture/decisions/0006-busca-inicial-com-postgresql.md).

Consultas públicas devem excluir, por padrão:

- operação inativa;
- cidade inativa;
- organização não ativa;
- unidade sem revisão publicada ou com lifecycle não elegível;
- categoria inativa;
- mídia não aprovada;
- dados legais e internos;
- conteúdo removido por moderação.

## `analytics`

Responsabilidade:

- eventos de descoberta;
- agregações por cidade, categoria e unidade;
- métricas do parceiro;
- pesquisas sem resultado;
- privacidade e retenção.

Entidades conceituais:

```text
discovery_events
daily_establishment_metrics
search_term_metrics
```

O evento deve registrar intenção sem afirmar venda ou presença física.

## Domínios posteriores

### `explorer_profiles`

- interesses;
- cidade preferida;
- preferências de descoberta.

### `favorites` e `collections`

- favoritos;
- listas;
- roteiros pessoais.

### `reviews`

- nota;
- texto;
- mídia;
- resposta do parceiro;
- edição e revisão;
- moderação e denúncias.

### `experiences` e `events`

- experiências criadas por parceiros;
- eventos;
- período e local;
- fluxo de aprovação.

### `benefits`

- ofertas;
- regras;
- elegibilidade;
- validação;
- antifraude;
- passes.

### `billing`

- planos B2B;
- assinatura Pro;
- entitlements;
- cobrança e faturas.

### `notifications`

- preferências;
- e-mail, push e mensagens internas;
- eventos de domínio.

### `recommendations`

- regras editoriais;
- sinais de interesse;
- ranking personalizado.

### `concierge`

- conversas;
- ferramentas de catálogo;
- roteiros;
- referências das entidades consultadas;
- avaliação de respostas.

## Relações conceituais

```text
Tenant 1 ── N Region
Region 1 ── N City
Tenant 1 ── N Organization
Organization N ── N User (organization_members)
Organization 1 ── N Establishment
City 1 ── N Establishment
Establishment 1 ── N EstablishmentRevision
Establishment 1 ── 0..1 PublishedRevision
EstablishmentRevision N ── N Category
EstablishmentRevision 1 ── N BusinessHour
EstablishmentRevision 1 ── N Media
Establishment 1 ── N DiscoveryEvent
ModerationCase N ── 1 Moderatable entity
```

## Limites importantes

- `users` não recebe colunas específicas de parceiro ou Explorador.
- `tenants` não recebe dados de cidade.
- `cities` não controla permissions.
- `organizations` não substitui unidades públicas.
- `establishments` não recebe campos exclusivos de restaurante como colunas globais.
- `files` não decide publicação ou moderação.
- `catalog` não escreve diretamente nas entidades de origem.
- `analytics` não controla ranking editorial.
- `concierge` não consulta tabelas sem ferramentas e políticas explícitas.

## Decisões adicionais ainda necessárias

Os ADRs do EP-00 resolveram tenant/operação, organização/unidade, catálogo público, publicação, gates, busca e autorização. Antes ou durante os próximos epics ainda precisam de decisão específica:

- escopo de unicidade do CNPJ;
- claim de organização existente;
- modelo físico de atributos por categoria;
- endereço, geocoding e validação de coordenadas;
- representação física de intervalos atravessando meia-noite e exceções;
- política de remoção física e retenção;
- armazenamento e retenção de eventos analíticos;
- contrato comercial e projeção de dados patrocinados.
