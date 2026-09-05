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

Esses três testes Node só inspecionam código-fonte; o contrato operacional também envia o bloco
extraído ao `bash -n` para validar sintaxe, mas nunca o executa. Não executam SQL, build, Docker,
HTTP ou bootstrap Adonis. Não executar Japa agora: até `pnpm test` migra e popula o banco
automaticamente.

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

## Rotação operacional das credenciais bootstrap

O deploy da segunda release apenas disponibiliza `security:rotate-bootstrap`; ele **não executa** a
rotação. O JSON produzido contém a única cópia em texto puro das três senhas e não pode residir no
overlay efêmero do container nem ficar montado no servidor HTTP. Na VPS, provisionar uma vez o bind
e seu marker host-only:

```bash
install -d -o root -g root -m 0700 /var/lib/experimente-plus/bootstrap-credentials
printf '%s\n' 'experimente-plus-bootstrap-credentials-v1' \
  | install -o root -g root -m 0400 /dev/stdin \
      /var/lib/experimente-plus/bootstrap-credentials/.host-mounted-v1
```

`docker-compose.bootstrap.yml` é um stack one-shot independente: não possui `build`, exige por
variável o ID imutável (`sha256:...`) da imagem last-known-good e o caminho absoluto de uma cópia
congelada do ambiente de produção, e monta o diretório com `create_host_path: false`.
`docker-compose.vps.yml` não o expõe ao processo HTTP permanente. O procedimento copia `.env` uma
única vez para um arquivo `0600` em `/run`, usa essa cópia também como fonte explícita de
interpolação (`--env-file`) e compara, sem imprimir valores, o fingerprint canônico de todo o
ambiente efetivo com o ambiente do único container HTTP em execução. Os defaults vêm da mesma
imagem imutável; somente `HOST`, `PORT` e `TRUST_PROXY`, fixados pelo Compose HTTP e irrelevantes ao
comando, são excluídos da comparação. Assim, inclusive qualquer variável `PG*` divergente aborta
antes da rotação. Todos os arquivos temporários root-only são removidos pelo `trap`. O comando de
produção aceita apenas um arquivo novo, filho direto do caminho host-only, depois de validar
diretório `0700`, marker regular `0400`, proprietário, tamanho e conteúdo. O mesmo inode e hash do
marker são revalidados antes do commit do banco.

### Atualização obrigatória do entrypoint externo

A release que introduz o fence bilateral só habilita a rotação depois de atualizar também
`/usr/local/libexec/experimente-plus-deploy`. O forced command é deliberadamente externo à working
tree e não se autoatualiza. Portanto, depois de o deploy promover esta release a LKG e **antes da
primeira rotação**, executar o bloco abaixo como root. Ele adquire o mesmo lock, recusa qualquer
container de rotação, extrai `deploy.sh` diretamente do blob da LKG verificada, valida modo e
sintaxe, preserva a versão anterior pelo SHA256 e faz a troca por rename no mesmo filesystem. Não
usar `cp` diretamente da working tree:

```bash
(
  set -euo pipefail

  deploy_root=/opt/experimente-plus
  deploy_state="$deploy_root/.git/experimente-plus-deploy/last-known-good"
  deploy_lock="$deploy_root/.git/experimente-plus-deploy/deploy.lock"
  deploy_entrypoint=/usr/local/libexec/experimente-plus-deploy
  backup_directory=/var/lib/experimente-plus/deploy-entrypoint-backups
  entrypoint_candidate=
  entrypoint_previous=
  replacement_started=0
  replacement_verified=0

  cleanup_entrypoint_update() {
    local status=$?
    trap - EXIT
    trap '' HUP INT TERM
    set +e
    if (( status != 0 && replacement_started == 1 && replacement_verified == 0 )); then
      if [[ -n "${entrypoint_previous:-}" && -f "$entrypoint_previous" \
          && ! -L "$entrypoint_previous" ]] \
          && [[ "$(stat -c '%U:%G:%a' "$entrypoint_previous")" == root:root:755 ]] \
          && [[ "$(sha256sum "$entrypoint_previous")" == \
            "$current_sha  $entrypoint_previous" ]] \
          && mv -f -- "$entrypoint_previous" "$deploy_entrypoint" \
          && /usr/bin/sync -f -- "$deploy_entrypoint" \
          && /usr/bin/sync -f -- /usr/local/libexec \
          && [[ "$(stat -c '%U:%G:%a' "$deploy_entrypoint")" == root:root:755 ]] \
          && [[ "$(sha256sum "$deploy_entrypoint")" == \
            "$current_sha  $deploy_entrypoint" ]]; then
        :
      else
        echo 'FALHA CRÍTICA: não foi possível restaurar o entrypoint anterior.' >&2
        status=2
      fi
    fi
    rm -f -- "${entrypoint_candidate:-}" "${entrypoint_previous:-}"
    exit "$status"
  }
  trap cleanup_entrypoint_update EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  safe_git() {
    env -i PATH=/usr/bin:/bin LANG=C \
      GIT_DIR="$deploy_root/.git" GIT_WORK_TREE="$deploy_root" \
      GIT_NO_REPLACE_OBJECTS=1 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
      GIT_CONFIG_COUNT=2 \
      GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false \
      GIT_CONFIG_KEY_1=core.hooksPath GIT_CONFIG_VALUE_1=/dev/null \
      /usr/bin/git "$@"
  }

  safe_docker() {
    env -i PATH=/usr/bin:/bin LANG=C /usr/bin/docker "$@"
  }

  test -d "$deploy_root/.git"
  test ! -L "$deploy_root/.git"
  test -f "$deploy_lock"
  test ! -L "$deploy_lock"
  test -d /usr/local/libexec
  test ! -L /usr/local/libexec
  test -f "$deploy_entrypoint"
  test ! -L "$deploy_entrypoint"
  entrypoint_candidate=$(mktemp /usr/local/libexec/.experimente-plus-deploy.XXXXXX)
  exec 9>"$deploy_lock"
  flock -n 9

  rotation_containers=$(safe_docker ps --all --quiet --no-trunc \
    --filter label=com.experimente-plus.operation=bootstrap-rotation)
  test -z "$rotation_containers"

  test -f "$deploy_state"
  test ! -L "$deploy_state"
  mapfile -t good_release < "$deploy_state"
  test "${#good_release[@]}" -eq 3
  [[ "${good_release[0]}" =~ ^[0-9a-f]{40}$ ]]
  [[ "${good_release[1]}" =~ ^sha256:[0-9a-f]{64}$ ]]
  [[ "${good_release[2]}" =~ ^[0-9a-f]{64}$ ]]
  test "$(safe_git rev-parse HEAD)" = "${good_release[0]}"
  test "$(safe_git rev-parse "refs/deploy/verified/${good_release[0]}")" = \
    "${good_release[0]}"

  entrypoint_blob=$(safe_git rev-parse "${good_release[0]}:deploy.sh")
  [[ "$entrypoint_blob" =~ ^[0-9a-f]{40,64}$ ]]
  test "$(safe_git cat-file -t "$entrypoint_blob")" = blob
  test "$(safe_git ls-tree "${good_release[0]}" -- deploy.sh)" = \
    $'100755 blob '"$entrypoint_blob"$'\tdeploy.sh'
  safe_git cat-file blob "$entrypoint_blob" > "$entrypoint_candidate"
  chown root:root "$entrypoint_candidate"
  chmod 0755 "$entrypoint_candidate"
  /usr/bin/bash -n "$entrypoint_candidate"
  grep -Fq 'assert_no_bootstrap_rotation() {' "$entrypoint_candidate"
  grep -Fq "label=com.experimente-plus.operation=bootstrap-rotation" "$entrypoint_candidate"
  target_sha=$(sha256sum "$entrypoint_candidate")
  target_sha="${target_sha%% *}"
  [[ "$target_sha" =~ ^[0-9a-f]{64}$ ]]

  test "$(stat -c '%U:%G:%a' "$deploy_entrypoint")" = root:root:755
  current_sha=$(sha256sum "$deploy_entrypoint")
  current_sha="${current_sha%% *}"
  [[ "$current_sha" =~ ^[0-9a-f]{64}$ ]]
  if [[ "$current_sha" == "$target_sha" ]]; then
    exit 0
  fi

  install -d -o root -g root -m 0700 "$backup_directory"
  entrypoint_backup="$backup_directory/experimente-plus-deploy-$current_sha.sh"
  if [[ -e "$entrypoint_backup" || -L "$entrypoint_backup" ]]; then
    test -f "$entrypoint_backup"
    test ! -L "$entrypoint_backup"
    test "$(stat -c '%U:%G:%a' "$entrypoint_backup")" = root:root:500
    test "$(sha256sum "$entrypoint_backup")" = "$current_sha  $entrypoint_backup"
  else
    install -o root -g root -m 0500 "$deploy_entrypoint" "$entrypoint_backup"
    /usr/bin/sync -f -- "$entrypoint_backup"
    /usr/bin/sync -f -- "$backup_directory"
  fi

  /usr/bin/sync -f -- "$entrypoint_candidate"
  test "$(stat -c '%U:%G:%a' "$entrypoint_candidate")" = root:root:755
  test "$(sha256sum "$entrypoint_candidate")" = "$target_sha  $entrypoint_candidate"
  entrypoint_previous=$(mktemp /usr/local/libexec/.experimente-plus-deploy.previous.XXXXXX)
  install -o root -g root -m 0755 "$deploy_entrypoint" "$entrypoint_previous"
  /usr/bin/sync -f -- "$entrypoint_previous"
  test "$(sha256sum "$entrypoint_previous")" = "$current_sha  $entrypoint_previous"
  replacement_started=1
  mv -f -- "$entrypoint_candidate" "$deploy_entrypoint"
  /usr/bin/sync -f -- "$deploy_entrypoint"
  /usr/bin/sync -f -- /usr/local/libexec
  test "$(stat -c '%U:%G:%a' "$deploy_entrypoint")" = root:root:755
  test "$(sha256sum "$deploy_entrypoint")" = "$target_sha  $deploy_entrypoint"
  replacement_verified=1
)
```

Uma falha normal antes do rename preserva o entrypoint atual; uma falha capturada depois dele tenta
restaurar atomicamente a cópia anterior validada e sincroniza o diretório, elevando uma falha de
restauração como crítica. O `trap` remove candidatos temporários, e a cópia anterior também permanece
no diretório root-only pelo hash do seu conteúdo. Uma interrupção não capturável, como `SIGKILL` ou
perda do host, exige executar novamente o bloco e comprovar o hash instalado antes de prosseguir. O
procedimento é idempotente quando a versão instalada já corresponde à LKG. A rotação continua
proibida enquanto a comparação não passar.

Depois de conferir os três IDs ativos — incluindo ao menos um Root — executar todo o preflight e a
rotação no mesmo subshell. Substituir somente `bootstrap_user_ids` e o timestamp de
`bootstrap_output`. Qualquer verificação falsa encerra o bloco antes de montar o diretório sensível.
O Compose é extraído como blob diretamente do commit LKG, portanto uma cópia alterada na worktree
não é consumida. A imagem também é passada pelo ID imutável, nunca pelo tag mutável do Compose.
`docker compose run` só constrói com a opção explícita `--build`; ela é proibida neste procedimento,
e `--pull never` impede resolução externa:

```bash
(
  set -euo pipefail

  deploy_root=/opt/experimente-plus
  deploy_state="$deploy_root/.git/experimente-plus-deploy/last-known-good"
  deploy_lock="$deploy_root/.git/experimente-plus-deploy/deploy.lock"
  bootstrap_user_ids='<id-root>,<id-2>,<id-3>'
  rotation_id='<YYYYMMDDTHHMMSSZ>'
  bootstrap_output="/var/lib/experimente-plus/bootstrap-credentials/bootstrap-$rotation_id.json"
  rotation_container="experimente-plus-bootstrap-$rotation_id"
  compose_snapshot=$(mktemp /run/experimente-plus-bootstrap.XXXXXX.yml)
  environment_snapshot=$(mktemp /run/experimente-plus-bootstrap-env.XXXXXX)
  image_environment_snapshot=$(mktemp /run/experimente-plus-image-env.XXXXXX.json)
  compose_environment_snapshot=$(mktemp /run/experimente-plus-compose-env.XXXXXX.json)
  running_environment_snapshot=$(mktemp /run/experimente-plus-running-env.XXXXXX.json)
  trap 'rm -f -- "$compose_snapshot" "$environment_snapshot" "$image_environment_snapshot" "$compose_environment_snapshot" "$running_environment_snapshot"' EXIT

  safe_git() {
    env -i PATH=/usr/bin:/bin LANG=C \
      GIT_DIR="$deploy_root/.git" GIT_WORK_TREE="$deploy_root" \
      GIT_NO_REPLACE_OBJECTS=1 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
      GIT_CONFIG_COUNT=2 \
      GIT_CONFIG_KEY_0=core.fsmonitor GIT_CONFIG_VALUE_0=false \
      GIT_CONFIG_KEY_1=core.hooksPath GIT_CONFIG_VALUE_1=/dev/null \
      /usr/bin/git "$@"
  }

  safe_docker() {
    env -i PATH=/usr/bin:/bin LANG=C /usr/bin/docker "$@"
  }

  safe_compose() {
    env -i PATH=/usr/bin:/bin LANG=C \
      EXPERIMENTE_BOOTSTRAP_IMAGE="${good_release[1]}" \
      EXPERIMENTE_BOOTSTRAP_ENV_FILE="$environment_snapshot" \
      /usr/bin/docker compose --env-file "$environment_snapshot" \
        --project-name experimente-plus-bootstrap \
        --project-directory "$deploy_root" -f "$compose_snapshot" "$@"
  }

  [[ "$rotation_id" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]
  test -d "$deploy_root/.git"
  test ! -L "$deploy_root/.git"
  test -f "$deploy_lock"
  test ! -L "$deploy_lock"
  exec 9>"$deploy_lock"
  flock -n 9

  test -f "$deploy_state"
  test ! -L "$deploy_state"
  mapfile -t good_release < "$deploy_state"
  test "${#good_release[@]}" -eq 3
  [[ "${good_release[0]}" =~ ^[0-9a-f]{40}$ ]]
  [[ "${good_release[1]}" =~ ^sha256:[0-9a-f]{64}$ ]]
  [[ "${good_release[2]}" =~ ^[0-9a-f]{64}$ ]]
  test "$(safe_git rev-parse HEAD)" = "${good_release[0]}"
  test "$(safe_git rev-parse "refs/deploy/verified/${good_release[0]}")" = \
    "${good_release[0]}"

  compose_blob=$(safe_git rev-parse "${good_release[0]}:docker-compose.bootstrap.yml")
  [[ "$compose_blob" =~ ^[0-9a-f]{40,64}$ ]]
  test "$(safe_git cat-file -t "$compose_blob")" = blob
  test "$(safe_git ls-tree "${good_release[0]}" -- docker-compose.bootstrap.yml)" = \
    $'100644 blob '"$compose_blob"$'\tdocker-compose.bootstrap.yml'
  safe_git cat-file blob "$compose_blob" > "$compose_snapshot"
  chmod 0400 "$compose_snapshot"

  environment_source="$deploy_root/.env"
  test -f "$environment_source"
  test ! -L "$environment_source"
  environment_before=$(stat -c '%d:%i:%s:%Y:%Z' "$environment_source")
  cp -- "$environment_source" "$environment_snapshot"
  chmod 0600 "$environment_snapshot"
  environment_after=$(stat -c '%d:%i:%s:%Y:%Z' "$environment_source")
  test "$environment_before" = "$environment_after"
  cmp -s -- "$environment_source" "$environment_snapshot"

  app_container_list=$(safe_docker ps --no-trunc --format '{{.ID}}' \
      --filter label=com.docker.compose.project=experimente-plus \
      --filter label=com.docker.compose.service=app)
  test -n "$app_container_list"
  mapfile -t app_containers <<< "$app_container_list"
  test "${#app_containers[@]}" -eq 1
  [[ "${app_containers[0]}" =~ ^[0-9a-f]{64}$ ]]
  test "$(safe_docker inspect --format '{{.State.Running}}' "${app_containers[0]}")" = true
  test "$(safe_docker inspect --format '{{.Image}}' "${app_containers[0]}")" = \
    "${good_release[1]}"
  safe_docker image inspect "${good_release[1]}" >/dev/null
  rotation_containers=$(safe_docker ps --all --quiet \
    --filter label=com.experimente-plus.operation=bootstrap-rotation)
  test -z "$rotation_containers"

  safe_docker image inspect "${good_release[1]}" \
    | jq -ce '.[0].Config.Env
      | map(split("=") | {key: .[0], value: (.[1:] | join("="))})
      | from_entries' > "$image_environment_snapshot"
  safe_compose config --format json \
    | jq -ce '.services.app.environment
      | if (
          type == "object" and
          .DB_CONNECTION == "postgres" and
          ([.DB_HOST, .DB_PORT, .DB_USER, .DB_PASSWORD, .DB_DATABASE]
            | all(.[]; type == "string" and length > 0))
        )
        then .
        else error("invalid canonical production database environment")
        end' \
      > "$compose_environment_snapshot"
  safe_docker inspect "${app_containers[0]}" \
    | jq -ce '.[0].Config.Env
      | map(split("=") | {key: .[0], value: (.[1:] | join("="))})
      | from_entries' > "$running_environment_snapshot"
  chmod 0600 "$image_environment_snapshot" "$compose_environment_snapshot" \
    "$running_environment_snapshot"

  expected_environment_fingerprint=$( \
    jq -cnS \
      --slurpfile image "$image_environment_snapshot" \
      --slurpfile configured "$compose_environment_snapshot" \
      '($image[0] * $configured[0]) | del(.HOST, .PORT, .TRUST_PROXY)' \
    | sha256sum | cut -d' ' -f1
  )
  running_environment_fingerprint=$( \
    jq -cS 'del(.HOST, .PORT, .TRUST_PROXY)' "$running_environment_snapshot" \
    | sha256sum | cut -d' ' -f1
  )
  [[ "$expected_environment_fingerprint" =~ ^[0-9a-f]{64}$ ]]
  test "$expected_environment_fingerprint" = "$running_environment_fingerprint"
  unset expected_environment_fingerprint running_environment_fingerprint

  test "$(safe_compose config --images)" = \
    "${good_release[1]}"
  safe_compose run --rm --no-deps --pull never --name "$rotation_container" \
    --label com.experimente-plus.operation=bootstrap-rotation \
    app node ace.js security:rotate-bootstrap \
      --user-ids "$bootstrap_user_ids" --output "$bootstrap_output"
)
```

O serviço usa dois advisory locks fail-fast: o coordenador serializa geração, escrita, commit e
eventual confirmação pós-commit; um segundo lock, preso à própria transação de mutação, atua como
fence se a conexão coordenadora cair. A perda do coordenador é revalidada antes do arquivo e do
commit e causa rollback; enquanto isso, o fence impede outra rotação de escrever. `rotation_in_progress`
significa que a primeira execução precisa ser reconciliada; não iniciar outra rotação nem escolher
outro output. O deploy consulta o label da rotação logo após adquirir o mesmo lock e novamente antes
de materializar uma release; qualquer container existente, inclusive parado, bloqueia o rollout e
é preservado para reconciliação. Após o `--rm`, comprovar persistência pelo host sem imprimir o
conteúdo:

```bash
bootstrap_output='/var/lib/experimente-plus/bootstrap-credentials/bootstrap-<mesmo-UTC>.json'
test -f "$bootstrap_output"
stat -c '%U:%G %a %n' "$bootstrap_output"
```

Mover a credencial para o cofre aprovado por canal confidencial e aplicar a política de retenção.
Nunca usar `cat`, anexar o JSON a logs/tickets, copiá-lo para a worktree ou incluí-lo em contexto de
build. Se o comando reportar commit ambíguo ou arquivo retido, preservar o artefato e verificar o
estado das três contas antes de qualquer retry.

Se a sessão SSH cair, não repetir o comando. Primeiro localizar a execução pelo label, sem exibir
ambiente ou credenciais, e conferir o caminho de output no host:

```bash
bootstrap_output='/var/lib/experimente-plus/bootstrap-credentials/bootstrap-<mesmo-UTC>.json'
docker ps --all --filter label=com.experimente-plus.operation=bootstrap-rotation \
  --format '{{.Names}} {{.State}}'
test -e "$bootstrap_output" && stat -c '%U:%G %a %n' "$bootstrap_output"
```

Container ainda ativo, output existente, commit ambíguo ou qualquer estado não conclusivo exige
reconciliação das três contas; não remover o container/arquivo nem iniciar outra rotação até definir
qual conjunto de hashes está persistido.

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
