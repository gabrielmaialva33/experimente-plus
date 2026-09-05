# ADR-0007 — RBAC global combinado com policies de domínio

- **Status:** Aceito
- **Data:** 2026-08-22
- **Decisores:** produto e engenharia do Experimente+
- **Relacionados:** ADR-0001, ADR-0002; EP-00, EP-02, EP-05

## Contexto

A fundação possui roles e permissions globais, cache, herança e contexts `any`/`own`. Esse modelo é adequado para capacidades de plataforma, mas não representa sozinho perguntas como:

- este usuário pertence à organização dona da unidade;
- o papel interno permite editar ou apenas consultar métricas;
- a entidade pertence ao tenant ativo;
- o Moderador pode analisar, mas não gerenciar membros;
- um parceiro pode alterar a própria unidade, não a de outro parceiro.

Modelar Parceiro como role global e usar apenas `establishments.update` permitiria acesso excessivo. Modelar cada organização como permission criaria explosão de registros e cache.

## Decisão

A autorização privada será composta por camadas independentes:

```text
Autenticação
  AND tenant/operação ativa + membership
  AND capacidade global (RBAC)
  AND policy do domínio para o recurso concreto
```

Nenhuma camada substitui a outra.

## Responsabilidades

### RBAC global

Responde:

> Este tipo de usuário pode tentar executar esta classe de ação?

Exemplos:

- `cities.create`;
- `organizations.submit`;
- `establishment_revisions.review`;
- `analytics.read`.

Permissions continuam globais e cacheáveis. Elas não carregam `organization_id` ou `city_id`.

### Tenant middleware

Responde:

> Em qual operação privada a requisição está e o usuário possui membership ativa nela?

Admin e Root não ignoram silenciosamente membership. Acesso de suporte entre operações, se necessário, terá fluxo explícito e auditado.

### Policy de domínio

Responde:

> Este usuário pode agir sobre esta organização, unidade, revisão ou mídia específica?

Policies consultam tenant, memberships, papéis internos, estado e relação entre agregados.

Exemplos:

```text
OrganizationPolicy.update(user, organization)
OrganizationPolicy.manageMembers(user, organization)
EstablishmentPolicy.update(user, establishment)
EstablishmentRevisionPolicy.submit(user, revision)
AnalyticsPolicy.read(user, organizationOrEstablishment)
```

A checagem deve existir no service/caso de uso, não apenas no controller ou na UI.

## Perfis e roles globais

### `root`

- proprietário técnico da plataforma;
- todas as permissions;
- gestão de roles e permissions;
- ainda opera em tenant explicitamente resolvido para dados de produto.

### `admin`

- administração operacional;
- cidades, taxonomia, usuários permitidos, organizações, unidades e moderação;
- não recebe automaticamente capacidades reservadas de mutation do sistema de permissions quando a fundação as restringe.

### `moderator`

- nova role global do produto;
- lê filas e conteúdo necessário à análise;
- solicita correção, aprova, rejeita, suspende e restaura conforme permission;
- não gerencia roles globais, billing, membros de organização ou configurações críticas.

### `user`

- role padrão do usuário autenticado;
- representa o Explorador na base;
- pode solicitar/criar organização e, quando possui membership, executar capacidades de parceiro permitidas por sua policy;
- mantém capacidades pessoais futuras como favoritos e interesses.

### `guest`

- não concede acesso privado por padrão;
- catálogo público não depende dessa role.

### `editor` do template

A role genérica `editor` não integra a definição canônica pre-1.0 e foi substituída por `moderator` no produto. O termo `editor` continua válido somente como papel interno de organização.

## Parceiro não é role global

“Parceiro” é uma condição de domínio:

```text
user com membership ativa em organization
```

Um usuário pode ser Explorador e Parceiro ao mesmo tempo. Remover sua última membership revoga suas capacidades sobre organizações sem alterar sua conta pessoal.

A UI mostra áreas de parceiro quando o usuário possui ao menos uma membership adequada; não depende de uma role global `partner`.

## Papéis internos da organização

| Ação                           | owner |            admin |              editor | analyst |
| ------------------------------ | ----: | ---------------: | ------------------: | ------: |
| ler organização e unidades     |   sim |              sim |                 sim |     sim |
| editar dados públicos          |   sim |              sim |                 sim |     não |
| editar dados legais permitidos |   sim |              sim |                 não |     não |
| criar unidade/revisão          |   sim |              sim |                 sim |     não |
| submeter revisão               |   sim |              sim |                 sim |     não |
| administrar mídia              |   sim |              sim |                 sim |     não |
| ver analytics                  |   sim |              sim | opcional por policy |     sim |
| convidar/alterar membros       |   sim | sim, com limites |                 não |     não |
| transferir ownership           |   sim |              não |                 não |     não |
| arquivar organização           |   sim |              não |                 não |     não |

O último owner não pode ser removido ou rebaixado sem transferência atômica.

## Catálogo de permissions do primeiro corte

A nomenclatura permanece `resource.action`. Contexto de organização não será codificado como `.own`; a policy executa o escopo.

`Permission.name` não é uma segunda identidade editável: ele é derivado de
`resource`, `action` e `context`. O contexto padrão `any` continua implícito
(`resource.action`); contextos não padrão usam `resource.action.context`. O campo
`name` legado da criação administrativa permanece aceito para compatibilidade de
transporte, mas seu valor é descartado. Uma colisão com um registro legado cujo
nome canônico pertence a outra tupla falha como validação `422`, sem converter
outros erros de banco.

### Geografia e taxonomia

```text
regions.list
regions.read
regions.create
regions.update
regions.archive
cities.list
cities.read
cities.create
cities.update
cities.archive
categories.list
categories.read
categories.create
categories.update
categories.archive
```

### Organizações

```text
organizations.create
organizations.list
organizations.read
organizations.update
organizations.submit
organizations.archive
organization_members.list
organization_members.invite
organization_members.update
organization_members.revoke
organizations.review
organizations.approve
organizations.reject
organizations.suspend
organizations.restore
```

### Unidades e revisões

```text
establishments.create
establishments.list
establishments.read
establishments.update
establishments.archive
establishments.suspend
establishments.restore
establishment_revisions.create
establishment_revisions.read
establishment_revisions.update
establishment_revisions.submit
establishment_revisions.preview
establishment_revisions.review
establishment_revisions.approve
establishment_revisions.reject
```

### Mídia, catálogo e métricas

```text
media.create
media.read
media.update
media.delete
media.review
media.approve
media.reject
media.quarantine
catalog.preview
analytics.read
analytics.export
```

As actions `archive`, `submit`, `review`, `approve`, `reject`, `suspend`, `restore`, `invite`, `preview` e `quarantine` serão adicionadas ao enum canônico quando o primeiro domínio que as usa for implementado.

## Distribuição inicial por role

### `user`

Recebe capacidades para iniciar e operar recursos próprios, sempre limitadas por policy:

```text
organizations.create/list/read/update/submit/archive
organization_members.list/invite/update/revoke
establishments.create/list/read/update/archive
establishment_revisions.create/read/update/submit/preview
media.create/read/update/delete
analytics.read
```

A presença dessas permissions não permite agir sobre organização alheia.

### `moderator`

Herda capacidades pessoais de `user` e recebe:

```text
regions.list/read
cities.list/read
categories.list/read
organizations.review/approve/reject/suspend/restore
establishment_revisions.review/approve/reject/preview
establishments.suspend/restore
media.review/approve/reject/quarantine
catalog.preview
audit.read/list
```

### `admin`

Recebe todas as permissions de produto, exceto reservas explícitas de segurança da fundação. Pode administrar geografia, taxonomia e conteúdo transversalmente dentro dos tenants aos quais possui acesso.

### `root`

Recebe todas as permissions, incluindo administração do RBAC.

## Composição de middleware e policy

Uma rota privada típica segue:

```text
auth
→ tenant({ required: true })
→ permission('establishment_revisions.submit')
→ service carrega recurso já tenant-scoped
→ EstablishmentRevisionPolicy.submit(...)
→ transação de domínio
```

A ordem evita consultar recurso de outro tenant antes de validar o escopo.

Listagens privadas devem filtrar no SQL por memberships permitidas. Não é aceitável carregar todas as organizações e remover as não autorizadas em memória.

## Contexts `any` e `own`

O context `own` existente continua útil para recursos com ownership direto, como arquivos pessoais.

Organizações e unidades não usarão o `OwnershipService` genérico por configuração simples. A relação N:N e os papéis internos exigem policies dedicadas.

Não será criado context dinâmico por organização na tabela de permissions.

## UI e API de capacidades

A UI não deve decidir autorização apenas com a lista plana de permissions globais.

Ela pode receber:

- permissions globais efetivas;
- memberships resumidas;
- capabilities calculadas por organização/unidade quando necessário.

Esconder botão melhora UX, mas o backend sempre repete a policy.

## Auditoria

Registrar:

- tentativas negadas relevantes;
- mudança de membership;
- transferência de owner;
- submissão e decisão de revisão;
- suspensão/restauração;
- ações de Admin/Moderador em recurso de parceiro.

Leituras públicas não geram audit log individual de autorização.

## Alternativas consideradas

### Role global `partner`

Rejeitada como fonte de autorização. Não informa qual organização pertence ao usuário. Poderia existir apenas como etiqueta derivada, mas não é necessária.

### Permission por organização

Rejeitada. Produziria alto volume, cache complexo e manutenção inviável.

### Apenas policy, sem RBAC

Rejeitada. Cidades, taxonomia, moderação e funções administrativas precisam de capacidades globais claras.

### Apenas RBAC com context `own`

Rejeitada. Ownership por membership não é uma coluna direta e possui quatro papéis diferentes.

### Bypass automático para Admin/Root

Rejeitado para scoping de tenant. Acesso transversal deve ser explícito e auditável.

## Consequências

### Positivas

- princípio de menor privilégio;
- parceiros limitados às organizações corretas;
- roles globais permanecem pequenas;
- membership representa equipe e rede naturalmente;
- policies podem considerar estado e transição.

### Custos

- cada domínio protegido precisa de policy;
- UI precisa combinar permission e membership;
- seed/migrations de roles e permissions serão alterados;
- testes de matriz de acesso aumentam.

## Invariantes de teste

- usuário com permission global, mas sem membership, recebe acesso negado;
- membro de outro tenant não acessa recurso pelo ID;
- `analyst` não modifica conteúdo;
- `editor` interno não gerencia membros;
- Moderator não gerencia roles globais;
- Admin sem membership de tenant não acessa dados privados da operação;
- parceiro não publica revisão diretamente;
- listagem privada retorna somente organizações autorizadas;
- último owner não é removido;
- UI oculta ação, mas chamada manual também é negada pelo backend.

## Impacto nas migrations canônicas

Migrations que chegaram a qualquer ambiente persistente, inclusive o piloto pre-1.0, são publicadas e seguem a regra append-only. Alterações nesses contratos exigem novas migrations forward; editar um arquivo já aplicado não atualiza o banco. Somente migrations que nunca chegaram a um ambiente persistente podem ser consolidadas nos arquivos originais.

Na evolução desses contratos:

- manter `moderator` como substituto da antiga role global `editor`; reconciliar a remoção do `editor` global em ambientes já implantados por migration forward, preservando `editor` como papel interno de organização;
- estender enums de resources/actions;
- incorporar novas permissions do produto por migrations forward quando os defaults originais já tiverem sido implantados;
- manter role `user` como default;
- criar `organization_members` com role e estado validados por constraint;
- adicionar testes que comparem migration e catálogo runtime de permissions.
