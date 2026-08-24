# ADR-0012 — Estabelecimentos estáveis e conteúdo público versionado

- **Status:** aceito
- **Data:** 23 de agosto de 2026
- **Marco:** EP-03 — Unidades, endereço, horários e atributos

## Contexto

Uma organização pode operar várias unidades em cidades diferentes. A unidade precisa conservar uma identidade estável para ownership, analytics, links e histórico, enquanto seu conteúdo público deve passar por revisão sem retirar imediatamente do ar uma versão já aprovada.

Misturar identidade, operação e conteúdo editável na mesma linha criaria dois problemas:

- qualquer edição substituiria silenciosamente a ficha publicada;
- seria impossível manter histórico confiável de submissões, recusas e publicações.

Os ADRs 0002, 0004 e 0005 já definem organização e unidade como agregados distintos, publicação por revisão e gates explícitos de completude.

## Decisão

### Identidade estável

`establishments` representa a unidade ao longo do tempo. A tabela mantém apenas dados que não pertencem a uma versão editorial:

- operação (`tenant_id`);
- organização proprietária;
- identidade técnica;
- estado de ciclo de vida;
- estado operacional do negócio;
- ponteiro para a revisão publicada;
- autoria e timestamps administrativos.

O estabelecimento não é descobrível apenas por existir ou estar ativo. Uma ficha pública exige `published_revision_id` apontando para uma revisão aprovada da mesma unidade e operação.

### Conteúdo versionado

`establishment_revisions` concentra todo conteúdo que pode ser editado e moderado:

- nome público, slug e descrições;
- cidade, endereço e coordenadas;
- contatos e ações públicas;
- disponibilidade;
- categorias e atributos;
- horários semanais e exceções;
- futuramente, mídia, acessibilidade e conteúdo editorial.

A relação do ponteiro publicado é protegida por FK composta:

```text
(establishments.published_revision_id,
 establishments.tenant_id,
 establishments.id)
→
(establishment_revisions.id,
 establishment_revisions.tenant_id,
 establishment_revisions.establishment_id)
```

Assim, uma unidade não pode publicar uma revisão de outro estabelecimento ou tenant.

### Máquina de estados da revisão

```text
draft
→ pending_review
→ approved

pending_review
→ changes_requested
→ pending_review

pending_review
→ rejected
```

Regras:

- somente `draft` e `changes_requested` são editáveis;
- somente uma revisão aberta pode existir por estabelecimento entre `draft`, `pending_review` e `changes_requested`;
- `pending_review` fica congelada;
- `approved` e `rejected` são terminais;
- a publicação troca o ponteiro de forma transacional;
- editar uma unidade publicada cria uma nova revisão baseada na publicada, sem alterar o conteúdo atualmente visível.

O EP-03 implementa `draft` e a estrutura necessária para completude. Submissão, moderação e troca do ponteiro ficam no EP-05, sem exigir alteração estrutural do schema.

### Estados do estabelecimento

`lifecycle_status`:

```text
active
suspended
archived
```

`business_status`:

```text
open
temporarily_closed
permanently_closed
```

Os dois eixos são independentes. Ciclo de vida controla a existência administrativa; estado operacional comunica disponibilidade real do negócio.

- owner/admin da organização ou equipe da plataforma pode arquivar conforme policy;
- suspensão e restauração são ações administrativas;
- fechamento temporário pode continuar visível com aviso;
- fechamento permanente remove a unidade da descoberta normal;
- reabertura após fechamento permanente exige revalidação posterior.

Todas as transições usam transaction, row lock, policy de domínio e auditoria.

### Slug

O slug é versionado porque pode mudar durante revisão. Sua unicidade pública é avaliada no gate de submissão/publicação no escopo `(tenant, city, slug)`.

Não haverá índice único simples sobre todas as revisões: revisões históricas aprovadas ou rejeitadas podem compartilhar o mesmo slug sem representar duas fichas simultaneamente publicadas.

## Integridade e isolamento

- todas as entidades carregam `tenant_id`;
- referências a organização, cidade, revisão, categoria e atributos usam FKs compostas com tenant;
- controllers nunca aceitam `tenant_id`, status ou ponteiro publicado por mass assignment;
- consultas administrativas passam pela policy da organização;
- dados de draft não entram em rotas públicas;
- mudanças de estado e publicação são auditadas.

## Consequências

### Positivas

- identidade e histórico permanecem estáveis;
- uma edição não derruba a ficha publicada;
- moderação futura pode ser adicionada sem refazer o banco;
- IDOR e referências cross-tenant são bloqueados também no banco;
- analytics futuros podem apontar para a unidade estável.

### Custos

- leitura e escrita exigem distinguir estabelecimento de revisão;
- criação e clonagem precisam ser transacionais;
- projeções públicas devem seguir exclusivamente o ponteiro publicado;
- formulários precisam trabalhar com a revisão editável atual.

## Cenários obrigatórios de teste

- criar unidade e primeira revisão na mesma transação;
- impedir organização ou cidade de outro tenant;
- impedir leitura e edição sem membership autorizada;
- impedir duas revisões abertas da mesma unidade;
- impedir ponteiro publicado para outra unidade;
- impedir alteração de revisão em `pending_review`, `approved` ou `rejected`;
- preservar conteúdo publicado ao criar nova revisão editável;
- impedir payload de controlar status, autoria ou revisão publicada.

## Relações

- complementa ADR-0002 — organização e unidade são agregados distintos;
- concretiza ADR-0004 — publicação versionada e máquinas de estado;
- concretiza ADR-0005 — completude, submissão e publicação;
- segue ADR-0007 — RBAC global com policies de domínio;
- depende de ADR-0008 e ADR-0009 para cidade e taxonomia.
