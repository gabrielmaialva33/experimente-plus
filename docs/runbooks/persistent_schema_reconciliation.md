# Reconciliação dos contratos persistidos e proteção do build

## Evidência e escopo

O gate read-only da VPS informado em 2026-09-04 encontrou drift além do catálogo:

| Contrato    | Estado informado                                                 | Migration forward                                   |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Recibos     | `receipt_code varchar(24)`, check de formato ausente, 0 resgates | `1788556800100_reconcile_benefit_receipt_codes.ts`  |
| Identidades | Checks de email/username ausentes, 4 usuários e 0 violações      | `1788556800200_reconcile_user_identity_checks.ts`   |
| RBAC global | `editor` presente, 0 atribuições e 0 permissões                  | `1788556800300_remove_unused_global_editor_role.ts` |
| Credenciais | Coluna/check de geração JWT ausentes; baseline canônica é `1`    | `1788556800400_add_credential_version_to_users.ts`  |

As migrations canônicas constam no batch 1 de `adonis_schema`. Este reparo adiciona arquivos
versionados independentes: não reescreve as migrations aplicadas, não altera seu registro e não
recria o banco persistente. O reparo do catálogo e o bootstrap do deploy estão no
[runbook do catálogo](catalog_schema_reconciliation.md).

## Contratos das migrations

Todas exigem a transação do Lucid, com `lock_timeout = 5s` e `statement_timeout = 60s` por statement.
Cada migration tem sua própria transação: uma falha posterior não desfaz reparos anteriores já
aplicados. O runner pode retomar as pendentes depois de resolver a causa. Não usar execução sem
transação. Os dados são verificados novamente sob lock; as contagens do gate não substituem essa
verificação no momento da aplicação.

**Recibos:** adquire `ACCESS EXCLUSIVE` em `benefit_redemptions` e exige coluna `varchar`, valores
não nulos com exatamente 20 caracteres e formato `^EXP-[0-9A-F]{16}$` antes de reduzir para
`varchar(20) NOT NULL`. Reinstala `benefit_redemptions_receipt_code_format_check` validado, inclusive
quando já existe um check homônimo fraco ou `NOT VALID`. Não executa `UPDATE`, cast explícito,
truncamento, trim ou regeneração. Um recibo válido seguido de espaços também aborta: o PostgreSQL
pode descartar espaços excedentes ao restringir `varchar`, por isso a validação de comprimento
precede o DDL. Consulte a [documentação de tipos de caracteres do PostgreSQL](https://www.postgresql.org/docs/16/datatype-character.html).

**Identidades:** adquire `ACCESS EXCLUSIVE` em `users`, verifica todos os registros e instala
`users_email_lowercase_check` e `users_username_canonical_check` com os predicados canônicos.
Username nulo continua permitido. Os checks homônimos são substituídos e validados; emails e
usernames não são normalizados, renomeados nem deduplicados. Violações abortam sem imprimir
identidades ou conteúdo das linhas. Um nome de constraint ocupado por outro tipo de objeto
também impede o reparo, tanto aqui quanto em recibos.

**Papel global:** bloqueia escrita concorrente em `roles`, `user_roles` e `role_permissions` com
`SHARE ROW EXCLUSIVE`. Se `editor` já está ausente, termina com sucesso. Se existe, qualquer
atribuição ou permissão impede a remoção, preservando papel e vínculos. Uma FK de outra tabela
para `roles`, ou em outra coluna das tabelas conhecidas, também exige revisão e impede a remoção,
mesmo que ainda não tenha linhas. Só remove o papel global comprovadamente sem uso; não transfere
permissões nem atribuições para `moderator`.
O papel `editor` em memberships e convites de organizações permanece válido, conforme ADR-0007.

**Versão de credenciais:** adquire `ACCESS EXCLUSIVE` em `users`. Se a coluna ainda não existe,
adiciona `credential_version integer NOT NULL DEFAULT 1`; se existe por hotfix, exige `int4` regular,
sem geração/identity, e recusa nulos ou valores não positivos. Reinstala o check
`users_credential_version_positive_check`, inclusive quando um check homônimo é fraco ou não
validado. Nunca reduz, reinicia nem normaliza uma geração existente. O `down` preserva coluna,
default e check para impedir que rollback de migration torne um JWT antigo válido novamente.

Aplicações repetidas e instalações limpas convergem ao mesmo contrato. A recriação dos checks
pode alterar seus OIDs; a idempotência é de schema lógico e dados. Todos os `down` preservam o
contrato reparado e não recriam o papel descontinuado. Rollback de código não afrouxa checks nem
reverte migrations já confirmadas. Timeout, dado inválido ou uso inesperado deve interromper o
rollout e levar à revisão da causa; não contornar a proteção apagando ou normalizando registros.

## Verificação antes e durante a janela

Até a janela coordenada, executar somente checks estáticos. Com Node 24:

```bash
pnpm typecheck
pnpm lint
node --test tests/deploy/catalog_migration_snapshot.test.mjs tests/deploy/docker_context_contract.test.mjs tests/deploy/deploy_revision_contract.test.mjs
git diff --check
```

Esses três testes Node só leem código-fonte. Não executam SQL, build, Docker, HTTP ou bootstrap
Adonis. Não executar Japa agora: até `pnpm test` migra e popula o banco automaticamente.

Os seguintes arquivos ficam preparados para execução em PostgreSQL descartável na janela:

- `tests/functional/database/benefit_receipt_reconciliation.spec.ts`: tabela legada vazia ou com
  recibos válidos, reaplicação, retenção no `down`, check fraco/não validado, rejeição sem alteração
  de valores longos, espaços excedentes, formato inválido e nulos.
- `tests/functional/database/user_identity_reconciliation.spec.ts`: identidades preservadas,
  username nulo, reaplicação/`down`, checks fracos e recusa de uppercase, username inválido ou vazio.
- `tests/functional/database/global_editor_role_reconciliation.spec.ts`: ausência e remoção sem
  uso, reaplicação/`down`, preservação do editor de organização, atribuições/permissões inesperadas
  e referências adicionais com `ON DELETE CASCADE`, inclusive em outra coluna de uma tabela conhecida.
- `tests/functional/database/credential_version_reconciliation.spec.ts`: instalação sobre schema
  legado e hotfix válido, baseline `1`, reaplicação/`down`, preservação de gerações maiores e recusa
  sem alteração de tipo inesperado, geração/identity, nulos, valores não positivos ou check homônimo
  ligado a outra coluna.

DDL histórico e fixtures desses testes são revertidos ao final de cada teste. Antes do ambiente
persistente, validar os cenários em banco descartável e um backup restaurável do ambiente alvo.
Reconfirmar o conjunto de migrations pendentes e prever os locks. Depois da aplicação, verificar
tipo/comprimento/nulabilidade do recibo, definições e validação dos quatro checks, ausência do papel
global legado, `credential_version` `int4 NOT NULL DEFAULT 1`, preservação das gerações e dos demais
registros e os novos registros em `adonis_schema`. Executar o smoke
de catálogo e a validação funcional da janela. A revisão estática não comprova aplicação no banco.

## Rollout da revogação JWT em duas releases

Não ativar o incremento de `credential_version` enquanto a LKG ainda usa um guard que ignora essa
claim: um rollback de código poderia voltar a aceitar um JWT revogado. O rollout é deliberadamente
bifásico:

1. publicar a migration, a claim na emissão e o guard que compara a claim com a linha ativa, mas
   manter temporariamente a invalidação com o comportamento anterior;
2. aguardar CI, migrations, smoke e promoção dessa release como LKG;
3. só então publicar o incremento transacional e o comando de rotação bootstrap.

Não agrupar as duas releases no mesmo deploy. Se a primeira falhar, seu rollback não perde uma
revogação nova; depois que ela vira LKG, todo rollback da segunda já entende a geração persistida.

## Contexto Docker e arquivos operacionais

O gate também informou `.bootstrap-credentials` e `build.log` não rastreados em `/opt/experimente-plus`.
Posteriormente a coordenação informou sua quarentena root-only fora da worktree, sem leitura.
Uma auditoria local também identificou 2580 uploads enviados ao cache de build.
`COPY . .` recebe o contexto de build: estar fora do Git não exclui um arquivo desse contexto.
As regras explícitas de `.dockerignore` passam a excluir:

```text
.bootstrap-credentials
**/.bootstrap-credentials*
build.log
**/*.log
.env.local
.env.*.local
**/.env.*.local
storage/uploads/**
storage/seed-media/**
```

Isso cobre o arquivo de credenciais e suas variantes em subdiretórios, além de logs na raiz e
em subdiretórios, overrides locais de ambiente e mídia persistente. Uploads e seed-media pertencem
aos volumes de runtime. As exclusões devem estar na revisão usada **antes do próximo build**. O gate
estático confere os padrões e recusa regras de reinclusão; se for criado `Dockerfile.dockerignore`,
confere também esse arquivo, que tem precedência sobre o ignore da raiz. A documentação do
[contexto Docker](https://docs.docker.com/build/concepts/context/#dockerignore-files) descreve
essa exclusão antes do envio ao builder e a precedência dos arquivos de ignore.

O deploy também recusa untracked fora da allowlist, mesmo quando ignorados pelo Git, e faz o build
a partir de um snapshot do SHA aprovado. Isso impede uma migration stale ou uma escrita tardia na
worktree de entrar no build. As exclusões Docker continuam obrigatórias também para builds manuais.
O [runbook do catálogo](catalog_schema_reconciliation.md#deploy-e-recuperação) detalha a allowlist,
o SHA enviado pelo forced command e o contrato de smoke preservado para rollback.

Validar essa proteção pela configuração e pelo teste estático, sem abrir, copiar, mover, remover
ou imprimir `.bootstrap-credentials` da VPS. Não gerar um contexto de build ou tar da árvore
operacional para inspecioná-lo. A correção afeta os próximos builds; ela não apaga imagens/caches
anteriores nem comprova qual conteúdo eles receberam. A eventual avaliação de exposição histórica
e remediação de credenciais precisa de escopo próprio, preservando a confidencialidade e os
artefatos de recuperação do deploy. Este lote não executa build ou manipulação desses arquivos.
