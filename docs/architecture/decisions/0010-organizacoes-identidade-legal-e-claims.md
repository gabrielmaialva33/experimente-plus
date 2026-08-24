# ADR-0010 — Organizações, identidade legal e claims

- Status: Aceito
- Data: 23 de agosto de 2026
- Marco: EP-02 — Organizações e memberships

## Contexto

O Experimente+ precisa separar o responsável legal/comercial da unidade pública descoberta no catálogo. Uma mesma empresa pode operar várias unidades, inclusive em cidades diferentes. Também haverá fichas importadas ou cadastradas pela operação antes que um responsável as reivindique.

A especificação exige CNPJ válido, e-mail e telefone válidos no cadastro do parceiro. Esses dados pertencem à organização, enquanto endereço, categoria, horário e fotos pertencem às unidades.

## Decisão

O agregado `organization` será tenant-scoped e representará a identidade legal/comercial responsável por uma ou mais unidades.

### Tabela `organizations`

Campos canônicos:

```text
id
tenant_id
legal_name
trade_name
slug
tax_id
email
phone
website
status
created_by
submitted_at
reviewed_by
reviewed_at
review_notes
suspended_at
archived_at
created_at
updated_at
```

### Identidade fiscal

No primeiro ciclo:

- `tax_id` representa CNPJ;
- o valor é persistido com exatamente 14 dígitos;
- dígitos verificadores são validados pela aplicação;
- formato e tamanho são garantidos pelo banco;
- unicidade é `(tenant_id, tax_id)`;
- a mesma empresa pode existir em operações isoladas diferentes;
- CPF ou outro documento não será aceito silenciosamente como CNPJ.

Profissionais sem CNPJ exigirão decisão de produto e migration canônica revisada antes da versão 1.0. O schema não armazenará documentos ambíguos.

### Slug

- `slug` é único dentro do tenant;
- é gerado a partir do nome fantasia quando omitido;
- permanece estável mesmo que o nome seja alterado;
- pode ser alterado explicitamente por Administrador ou enquanto a organização ainda está em rascunho;
- colisões automáticas recebem sufixo determinístico.

### Workflow

```text
draft
pending_review
changes_requested
active
rejected
suspended
archived
```

Transições:

| De                             | Para                | Ator                       |
| ------------------------------ | ------------------- | -------------------------- |
| `draft`                        | `pending_review`    | owner/admin da organização |
| `changes_requested`            | `pending_review`    | owner/admin da organização |
| `pending_review`               | `active`            | Moderador/Admin            |
| `pending_review`               | `changes_requested` | Moderador/Admin            |
| `pending_review`               | `rejected`          | Moderador/Admin            |
| `active`                       | `suspended`         | Moderador/Admin            |
| `suspended`                    | `active`            | Moderador/Admin            |
| `draft` ou `changes_requested` | `archived`          | owner ou Admin             |
| `active` ou `suspended`        | `archived`          | Admin                      |

Regras:

- `pending_review` não pode ser editada pelo parceiro;
- `rejected` e `archived` são terminais no MVP;
- alterações em `legal_name` ou `tax_id` de uma organização ativa exigem fluxo administrativo futuro e são bloqueadas no EP-02;
- contato e nome fantasia podem ser atualizados por owner/admin quando ativa;
- toda decisão administrativa registra ator, data e motivo;
- suspensão da organização torna suas unidades inelegíveis para publicação e catálogo.

## Criação

### Criação pelo responsável

Uma organização criada por usuário autenticado:

1. pertence à operação ativa;
2. nasce como `draft`;
3. recebe o usuário como member `owner` na mesma transaction;
4. não cria role global de Parceiro;
5. não aparece no catálogo diretamente.

### Organização não reivindicada

A operação poderá importar uma organização sem owner. Ela será considerada reivindicável quando não existir membership ativa com papel `owner`.

## Claims

A tabela `organization_claims` registra pedidos de reivindicação:

```text
id
tenant_id
organization_id
claimant_id
status
message
evidence
reviewed_by
reviewed_at
review_notes
created_at
updated_at
```

Status:

```text
pending
approved
rejected
cancelled
```

Regras:

- usuário já membro não cria claim;
- organização com owner ativo não aceita claim comum;
- pode existir no máximo um claim pendente por usuário e organização;
- aprovação cria ou reativa membership `owner` na mesma transaction;
- aprovação garante membership do usuário no tenant da operação;
- outros claims pendentes da mesma organização são rejeitados automaticamente;
- evidências são metadata administrativa e nunca entram no catálogo;
- rejeição exige motivo;
- claim aprovado ou rejeitado é imutável.

## Dados públicos e privados

Organização não será serializada diretamente no catálogo. Dados legais permanecem privados:

```text
legal_name
tax_id
review_notes
created_by
reviewed_by
claims
memberships
invitations
```

Somente campos explicitamente projetados por uma unidade poderão aparecer publicamente.

## Integridade

- `(id, tenant_id)` é unique para FKs compostas;
- CNPJ é unique por tenant;
- slug é unique por tenant;
- status possui check constraint;
- timestamps de revisão, suspensão e arquivamento são coerentes com o estado por service e testes;
- claims usam FK composta para impedir referência cross-tenant;
- exclusão física da organização não é exposta pelo MVP.

## Alternativas rejeitadas

### Organização e unidade na mesma tabela

Rejeitada. Duplicaria CNPJ e equipe em cada endereço e limitaria redes multicidade.

### CNPJ globalmente único

Rejeitada. Operações white-label são isoladas e podem representar a mesma empresa legitimamente.

### Documento genérico sem tipo

Rejeitada. Aceitaria CPF ou valores inválidos como CNPJ e dificultaria integridade.

### Parceiro como role global

Rejeitada pelo ADR-0007. O vínculo relevante é membership na organização.

### Claim aprovando automaticamente por e-mail

Rejeitada. Posse de e-mail não prova representação legal da empresa.

## Consequências

- dados legais ficam centralizados;
- redes multicidade não duplicam organização;
- autorização é baseada em membership;
- importação e reivindicação futura ficam suportadas;
- o catálogo não vaza CNPJ ou dados administrativos;
- mudanças legais sensíveis permanecem controladas.

## Cenários obrigatórios de teste

- CNPJ válido é normalizado;
- CNPJ inválido é rejeitado;
- CNPJ duplicado no mesmo tenant é rejeitado;
- mesmo CNPJ é permitido em tenant diferente;
- criação gera owner atomicamente;
- falha ao criar membership reverte organização;
- parceiro não edita organização de outro tenant ou sem membership;
- parceiro não altera status por payload;
- organização pendente não pode ser editada;
- claim em organização com owner é rejeitado;
- aprovação de claim cria owner e rejeita claims concorrentes;
- dados legais não aparecem em DTO público.
