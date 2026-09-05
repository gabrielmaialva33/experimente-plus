#!/usr/bin/env bash
# Install this entrypoint outside the checkout so rollback cannot downgrade it.
# Shared by the SSH forced command and explicit manual SHA deployments.
set -euo pipefail

# Object identity must not be redirected by local refs/replace. Reject inherited
# Git controls (repository/index/object/config/transport overrides) rather than
# guessing which ones are safe. Never print their names or values.
export GIT_NO_REPLACE_OBJECTS=1
for git_environment_name in "${!GIT_@}"; do
  if [[ "$git_environment_name" != GIT_NO_REPLACE_OBJECTS ]]; then
    echo 'FALHA: ambiente Git herdado não permitido; deploy não iniciado.' >&2
    exit 1
  fi
done
unset git_environment_name
export GIT_TERMINAL_PROMPT=0
export GIT_ASKPASS=/bin/false
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
# Fetch is public HTTPS only. This allowlist overrides protocol.* configuration,
# including a local attempt to turn an insteadOf rewrite into an ext:: command.
export GIT_ALLOW_PROTOCOL=https
export GIT_PROTOCOL_FROM_USER=0
DEPLOY_EXPECTED_ORIGIN_URL='https://github.com/gabrielmaialva33/experimente-plus.git'
DEPLOY_FETCH_URL="$DEPLOY_EXPECTED_ORIGIN_URL"
# Disable fsmonitor hooks before the first repository query. These values are
# injected after inherited Git controls have been rejected, so local config
# cannot execute a hook while ls-files/diff are checking the checkout.
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=core.fsmonitor
export GIT_CONFIG_VALUE_0=false
export GIT_CONFIG_KEY_1=core.hooksPath
export GIT_CONFIG_VALUE_1=/dev/null

resolve_target() {
  if [[ ${SSH_ORIGINAL_COMMAND+x} ]]; then
    # Treat the original SSH command as data, never as shell code.
    if (( $# != 0 )) || [[ ! "$SSH_ORIGINAL_COMMAND" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
      echo 'FALHA: SSH exige exatamente deploy seguido de um SHA completo minúsculo.' >&2
      return 1
    fi
    NEW_REVISION="${BASH_REMATCH[1]}"
    DEPLOY_VIA_FORCED_SSH=1
  else
    if (( $# != 1 )) || [[ ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
      echo 'FALHA: informe exatamente um SHA completo minúsculo aprovado pela CI.' >&2
      return 1
    fi
    NEW_REVISION="$1"
    DEPLOY_VIA_FORCED_SSH=0
  fi
}

is_operational_path() {
  case "$1" in
    .env|.env.local)
      return 0 ;;
    .env.*.local)
      [[ "$1" != */* ]] ;;
    node_modules/*|build/*|dist/*|coverage/*|tmp/*|storage/uploads/*|storage/seed-media/*)
      return 0 ;;
    *) return 1 ;;
  esac
}

preflight_tracked() {
  local setting value option entry head_tree index_tree metadata path mode object
  local file actual_mode actual_hash target
  for setting in core.sparseCheckout index.sparse; do
    if ! value=$(git config --type=bool --default=false --get "$setting" 2>/dev/null) \
        || [[ "$value" != false ]]; then
      echo 'FALHA: sparse checkout incompatível ou configuração impossível de verificar.' >&2
      return 1
    fi
  done
  # -v exposes assume-unchanged; -f exposes fsmonitor-valid. Both expose
  # skip-worktree. Only ordinary cached entries (H) are compatible with
  # deterministic index/ref materialization.
  for option in -v -f; do
    if ! git ls-files "$option" -z > "$RUN_DIR/index-state" 2>/dev/null; then
      echo 'FALHA: estado do index impossível de verificar.' >&2
      return 1
    fi
    while IFS= read -r -d '' entry; do
      if [[ "${entry:0:2}" != 'H ' ]]; then
        echo 'FALHA: flags especiais no index são incompatíveis com deploy.' >&2
        return 1
      fi
    done < "$RUN_DIR/index-state"
  done
  if ! git ls-files --stage -z > "$RUN_DIR/index-stage" 2>/dev/null; then
    echo 'FALHA: estado do index impossível de verificar.' >&2
    return 1
  fi
  while IFS= read -r -d '' entry; do
    metadata="${entry%%$'\t'*}"
    if [[ ! "$metadata" =~ ^(100644|100755|120000)\ ([0-9a-f]{40})\ 0$ \
        || "${BASH_REMATCH[2]}" == 0000000000000000000000000000000000000000 ]]; then
      echo 'FALHA: entrada incompleta ou não suportada no index; nenhuma sobrescrita autorizada.' >&2
      return 1
    fi
  done < "$RUN_DIR/index-stage"
  # intent-to-add entries use the empty-blob object id and are intentionally
  # omitted by git write-tree, so object-graph equality alone cannot see them.
  # Compare the complete path manifests as well, without invoking diff/filter
  # machinery or relying on human-readable status output.
  if ! git ls-files -z > "$RUN_DIR/index-paths" 2>/dev/null \
      || ! git ls-tree -r --full-tree --name-only -z HEAD > "$RUN_DIR/head-paths" 2>/dev/null \
      || ! cmp -s -- "$RUN_DIR/index-paths" "$RUN_DIR/head-paths"; then
    echo 'FALHA: paths do index divergem da árvore aprovada; nenhuma sobrescrita autorizada.' >&2
    return 1
  fi
  # Compare the index object graph without invoking diff machinery. Worktree
  # diffs run configured clean filters even with --no-textconv, so every tracked
  # byte below is hashed explicitly with --no-filters instead.
  head_tree=$(git rev-parse --verify 'HEAD^{tree}' 2>/dev/null) || head_tree=''
  index_tree=$(git write-tree 2>/dev/null) || index_tree=''
  if [[ ! "$head_tree" =~ ^[0-9a-f]{40}$ || "$index_tree" != "$head_tree" ]]; then
    echo 'FALHA: estado rastreado local alterado ou impossível de verificar (index); nenhuma sobrescrita autorizada.' >&2
    return 1
  fi

  if ! git ls-tree -r -z --full-tree HEAD > "$RUN_DIR/worktree-expected" 2>/dev/null; then
    echo 'FALHA: estado rastreado local alterado ou impossível de verificar (árvore); nenhuma sobrescrita autorizada.' >&2
    return 1
  fi
  while IFS= read -r -d '' entry; do
    metadata="${entry%%$'\t'*}"
    path="${entry#*$'\t'}"
    mode="${metadata%% *}"
    object="${metadata##* }"
    if [[ -z "$path" || "$path" == /* || "$path" == . || "$path" == ./* \
        || "$path" == .. || "$path" == ../* || "$path" == */.. || "$path" == */../* ]]; then
      echo 'FALHA: estado rastreado local alterado ou impossível de verificar; nenhuma sobrescrita autorizada.' >&2
      return 1
    fi
    file="$DEPLOY_ROOT/$path"
    case "$mode" in
      100644|100755)
        [[ "$metadata" =~ ^$mode\ blob\ [0-9a-f]{40}$ ]] || {
          echo 'FALHA: estado rastreado local alterado ou impossível de verificar (metadado); nenhuma sobrescrita autorizada.' >&2
          return 1
        }
        [[ -f "$file" && ! -L "$file" ]] || {
          echo 'FALHA: estado rastreado local alterado ou impossível de verificar (tipo); nenhuma sobrescrita autorizada.' >&2
          return 1
        }
        actual_mode=$(stat -c '%a' -- "$file" 2>/dev/null) || actual_mode=''
        actual_hash=$(git hash-object --no-filters -- "$file" 2>/dev/null) || actual_hash=''
        [[ "100$actual_mode" == "$mode" && "$actual_hash" == "$object" ]] || {
          echo 'FALHA: estado rastreado local alterado ou impossível de verificar (conteúdo/modo); nenhuma sobrescrita autorizada.' >&2
          return 1
        }
        ;;
      120000)
        [[ "$metadata" =~ ^120000\ blob\ [0-9a-f]{40}$ && -L "$file" ]] || {
          echo 'FALHA: estado rastreado local alterado ou impossível de verificar (symlink); nenhuma sobrescrita autorizada.' >&2
          return 1
        }
        if ! readlink -z -- "$file" > "$RUN_DIR/worktree-link" 2>/dev/null; then return 1; fi
        IFS= read -r -d '' target < "$RUN_DIR/worktree-link" || return 1
        actual_hash=$(printf '%s' "$target" | git hash-object --stdin 2>/dev/null) || actual_hash=''
        [[ "$actual_hash" == "$object" ]] || {
          echo 'FALHA: estado rastreado local alterado ou impossível de verificar (symlink); nenhuma sobrescrita autorizada.' >&2
          return 1
        }
        ;;
      *)
        echo 'FALHA: estado rastreado local alterado ou impossível de verificar; nenhuma sobrescrita autorizada.' >&2
        return 1
        ;;
    esac
  done < "$RUN_DIR/worktree-expected"
}

preflight_filters() {
  local filters rc
  if filters=$(git config --get-regexp '^filter\..+\.(clean|smudge|process)$' 2>/dev/null); then
    :
  else
    rc=$?
    if (( rc != 1 )); then
      echo 'FALHA: filtros Git impossíveis de verificar.' >&2
      return 1
    fi
    filters=''
  fi
  if [[ -n "$filters" ]]; then
    echo 'FALHA: filtros Git locais ou globais não são permitidos no deploy.' >&2
    return 1
  fi
}

preflight_transport() {
  local key rc
  local origin_urls=()
  if ! git config --null --get-all remote.origin.url > "$RUN_DIR/origin-urls" 2>/dev/null; then
    echo 'FALHA: origem Git ausente ou impossível de verificar.' >&2
    return 1
  fi
  mapfile -d '' -t origin_urls < "$RUN_DIR/origin-urls"
  if (( ${#origin_urls[@]} != 1 )) || [[ "${origin_urls[0]}" != "$DEPLOY_EXPECTED_ORIGIN_URL" ]]; then
    echo 'FALHA: origem Git diverge do repositório aprovado.' >&2
    return 1
  fi

  # Only origin.url and its passive refspec are accepted. Alternate remotes,
  # upload-pack commands, URL rewrites, protocol overrides, credential helpers,
  # proxies and askpass/SSH commands can all change or execute during transport.
  if git config --null --name-only --get-regexp \
      '^(remote\.|url\.|protocol\.|credential(\.|$)|http(\.|$)|core\.(sshcommand|askpass|gitproxy|worktree|alternaterefscommand)$)' \
      > "$RUN_DIR/transport-config" 2>/dev/null; then
    while IFS= read -r -d '' key; do
      case "$key" in
        remote.origin.url|remote.origin.fetch) ;;
        *)
          echo 'FALHA: configuração Git de transporte não permitida.' >&2
          return 1
          ;;
      esac
    done < "$RUN_DIR/transport-config"
  else
    rc=$?
    if (( rc != 1 )); then
      echo 'FALHA: configuração Git de transporte impossível de verificar.' >&2
      return 1
    fi
  fi
}

validate_repository_layout() {
  local top git_dir common_dir
  DEPLOY_ROOT=$(pwd -P) || return 1
  if [[ ! -d "$DEPLOY_ROOT/.git" || -L "$DEPLOY_ROOT/.git" ]]; then
    echo 'FALHA: layout Git operacional não suportado.' >&2
    return 1
  fi
  top=$(git rev-parse --path-format=absolute --show-toplevel 2>/dev/null) || return 1
  git_dir=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null) || return 1
  common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  if [[ "$(realpath -e -- "$top")" != "$DEPLOY_ROOT" \
      || "$(realpath -e -- "$git_dir")" != "$DEPLOY_ROOT/.git" \
      || "$(realpath -e -- "$common_dir")" != "$DEPLOY_ROOT/.git" ]]; then
    echo 'FALHA: worktree ou diretório Git diverge da raiz operacional.' >&2
    return 1
  fi

  # Pin every subsequent repository operation independently of a late
  # core.worktree/config change.
  export GIT_DIR="$DEPLOY_ROOT/.git"
  export GIT_WORK_TREE="$DEPLOY_ROOT"
}

capture_runtime_env() {
  local before after
  if [[ ! -f .env || -L .env ]]; then
    echo 'FALHA: ambiente de produção deve ser um arquivo regular.' >&2
    return 1
  fi
  before=$(stat -c '%d:%i:%s:%Y:%Z' -- .env) || return 1
  cp -- .env "$RUN_DIR/runtime.env" || return 1
  chmod 600 -- "$RUN_DIR/runtime.env" || return 1
  after=$(stat -c '%d:%i:%s:%Y:%Z' -- .env) || return 1
  if [[ "$before" != "$after" ]] || ! cmp -s -- .env "$RUN_DIR/runtime.env"; then
    echo 'FALHA: ambiente de produção mudou durante a captura.' >&2
    return 1
  fi
  RUNTIME_ENV="$RUN_DIR/runtime.env"
}

stage_runtime_env() {
  local source="$1"
  cp -- "$RUNTIME_ENV" "$source/.env"
  chmod 600 -- "$source/.env"
}

fetch_approved_revision() {
  local fetched_revision approved_master_revision
  FETCH_REPOSITORY="$RUN_DIR/fetch.git"

  # The network fetch runs in a new bare repository whose config is created by
  # this process. The operational checkout's local config is therefore never
  # consulted by the HTTPS transport.
  env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" git init --quiet --bare --template=
  if (( DEPLOY_VIA_FORCED_SSH )); then
    env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" timeout --kill-after=10s 120 \
      git fetch --quiet --no-tags "$DEPLOY_FETCH_URL" \
      '+refs/heads/master:refs/heads/deploy-approved-master' "$NEW_REVISION"
  else
    env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" timeout --kill-after=10s 120 \
      git fetch --quiet --no-tags "$DEPLOY_FETCH_URL" "$NEW_REVISION"
  fi
  fetched_revision=$(env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" \
    git rev-parse --verify "$NEW_REVISION^{commit}")
  if [[ "$fetched_revision" != "$NEW_REVISION" ]]; then
    echo 'FALHA: fetch não corresponde exatamente ao SHA aprovado.' >&2
    return 1
  fi
  if (( DEPLOY_VIA_FORCED_SSH )); then
    approved_master_revision=$(env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" \
      git rev-parse --verify 'refs/heads/deploy-approved-master^{commit}') || return 1
    if [[ ! "$approved_master_revision" =~ ^[0-9a-f]{40}$ ]] \
        || ! env -u GIT_WORK_TREE GIT_DIR="$FETCH_REPOSITORY" \
          git merge-base --is-ancestor "$NEW_REVISION" "$approved_master_revision"; then
      echo 'FALHA: SHA solicitado não pertence ao histórico aprovado da master remota.' >&2
      return 1
    fi
  fi

  # Import only from the isolated local object store. GIT_ALLOW_PROTOCOL is an
  # overriding allowlist, so a late config rewrite cannot turn this into a
  # command or a second network transport.
  env GIT_ALLOW_PROTOCOL=file GIT_CONFIG_COUNT=3 \
    GIT_CONFIG_KEY_2=core.alternateRefsCommand GIT_CONFIG_VALUE_2=false \
    timeout --kill-after=10s 120 \
    git fetch --quiet --no-tags "$FETCH_REPOSITORY" "$NEW_REVISION"
  fetched_revision=$(git rev-parse --verify 'FETCH_HEAD^{commit}')
  if [[ "$fetched_revision" != "$NEW_REVISION" ]]; then
    echo 'FALHA: importação local não corresponde exatamente ao SHA aprovado.' >&2
    return 1
  fi
}

preflight_reserved_tree() {
  local revision="$1" path
  # Inspect the Git object, not the current index or archive (export-ignore could
  # hide a tracked path from the archive). A failed listing is never a clean tree.
  if ! git ls-tree -r --full-tree --name-only -z "$revision" > "$RUN_DIR/reserved-tree"; then
    echo 'FALHA: não foi possível verificar caminhos reservados na revisão.' >&2
    return 1
  fi
  while IFS= read -r -d '' path; do
    if ! is_operational_path "$path"; then
      case "$path" in
        .env/*|.env.local/*|.env.*.local/*|node_modules|build|dist|coverage|tmp|storage|storage/uploads|storage/seed-media)
          # ls-tree -r omits directory entries. These leaves would replace an
          # operational directory (or turn an environment file into a directory).
          ;;
        *) continue ;;
      esac
    fi
    printf 'FALHA: revisão %s rastreia caminho operacional reservado: %q\n' "$revision" "$path" >&2
    return 1
  done < "$RUN_DIR/reserved-tree"
}

preflight_untracked() {
  local path
  # Do not activate .gitignore: ignored stale code is also outside the release.
  # Save first so a failed git command cannot be hidden by process substitution.
  git ls-files --others -z > "$RUN_DIR/untracked" || return 1
  while IFS= read -r -d '' path; do
    # The same reserved paths may exist operationally, but never in a release.
    if ! is_operational_path "$path"; then
      echo 'FALHA: arquivo não rastreado fora da allowlist; inspecione o host localmente.' >&2
      return 1
    fi
  done < "$RUN_DIR/untracked"

  # Git does not report empty untracked directories, but rsync --delete would
  # remove them. Refuse those too unless the whole subtree is operational.
  if ! find -P "$DEPLOY_ROOT" -mindepth 1 \
      \( -path "$DEPLOY_ROOT/.git" \
        -o -path "$DEPLOY_ROOT/node_modules" \
        -o -path "$DEPLOY_ROOT/build" \
        -o -path "$DEPLOY_ROOT/dist" \
        -o -path "$DEPLOY_ROOT/coverage" \
        -o -path "$DEPLOY_ROOT/tmp" \
        -o -path "$DEPLOY_ROOT/storage/uploads" \
        -o -path "$DEPLOY_ROOT/storage/seed-media" \) -prune \
      -o -type d -empty -print0 > "$RUN_DIR/empty-untracked-directories"; then
    echo 'FALHA: diretórios locais impossíveis de verificar; nenhuma remoção autorizada.' >&2
    return 1
  fi
  if [[ -s "$RUN_DIR/empty-untracked-directories" ]]; then
    echo 'FALHA: diretório vazio não rastreado fora da allowlist; inspecione o host localmente.' >&2
    return 1
  fi
}

validate_context_ignores() {
  local source="$1" rule
  for rule in '.env' '.env.local' '.env.*.local' '**/.env.*.local' 'node_modules' 'build' 'dist' 'coverage' 'tmp' \
      'storage/uploads/**' 'storage/seed-media/**' '.bootstrap-credentials' \
      '**/.bootstrap-credentials*' 'build.log' '**/*.log'; do
    if ! grep -Fxq -- "$rule" "$source"; then
      echo 'FALHA: revisão sem todas as exclusões obrigatórias do contexto Docker.' >&2
      return 1
    fi
  done
  if grep -Eq '^[[:space:]]*!' "$source"; then
    echo 'FALHA: reinclusão no contexto Docker exige revisão do contrato.' >&2
    return 1
  fi
}

regular_git_blob() {
  local revision="$1" path="$2" entry metadata
  local entries=()
  if ! git ls-tree -z "$revision" -- "$path" > "$RUN_DIR/entry" 2>/dev/null; then
    echo 'FALHA: entrada Git obrigatória impossível de verificar.' >&2
    return 1
  fi
  mapfile -d '' -t entries < "$RUN_DIR/entry"
  if (( ${#entries[@]} != 1 )); then
    echo 'FALHA: entrada Git obrigatória ausente ou ambígua.' >&2
    return 1
  fi
  entry="${entries[0]}"
  metadata="${entry%%$'\t'*}"
  if [[ "${entry#*$'\t'}" != "$path" || ! "$metadata" =~ ^100(644|755)\ blob\ ([0-9a-f]{40})$ ]]; then
    echo 'FALHA: entrada Git obrigatória deve ser blob regular (100644/100755).' >&2
    return 1
  fi
  printf '%s\n' "${BASH_REMATCH[2]}"
}

verify_snapshot_tree() {
  local revision="$1" source="$2" with_runtime_env="${3:-false}"
  local entry metadata path mode object actual_mode actual_hash target
  : > "$RUN_DIR/tree-expected"
  : > "$RUN_DIR/tree-actual"
  if ! git ls-tree -r -t -z --full-tree "$revision" > "$RUN_DIR/tree-git" 2>/dev/null; then
    echo 'FALHA: snapshot Git impossível de enumerar.' >&2
    return 1
  fi
  while IFS= read -r -d '' entry; do
    metadata="${entry%%$'\t'*}"
    path="${entry#*$'\t'}"
    mode="${metadata%% *}"
    object="${metadata##* }"
    case "$mode" in
      040000)
        [[ "$path" != . ]] && printf 'D\t%s\0' "$path" >> "$RUN_DIR/tree-expected"
        continue
        ;;
      100644|100755)
        [[ "$metadata" =~ ^$mode\ blob\ [0-9a-f]{40}$ ]] || {
          echo 'FALHA: tipo de entrada Git desconhecido no snapshot.' >&2; return 1;
        }
        ;;
      120000)
        [[ "$metadata" =~ ^120000\ blob\ [0-9a-f]{40}$ ]] || {
          echo 'FALHA: tipo de entrada Git desconhecido no snapshot.' >&2; return 1;
        }
        ;;
      160000|*)
        echo 'FALHA: snapshot contém tipo Git não suportado.' >&2
        return 1
        ;;
    esac
    [[ -e "$source/$path" || -L "$source/$path" ]] || {
      echo 'FALHA: snapshot extraído diverge da árvore Git.' >&2; return 1;
    }
    if [[ "$mode" == 120000 ]]; then
      [[ -L "$source/$path" ]] || { echo 'FALHA: snapshot extraído diverge da árvore Git.' >&2; return 1; }
      if ! readlink -z -- "$source/$path" > "$RUN_DIR/link-target"; then return 1; fi
      IFS= read -r -d '' target < "$RUN_DIR/link-target" || return 1
      actual_hash=$(printf '%s' "$target" | git hash-object --stdin) || return 1
      actual_mode=120000
    else
      [[ -f "$source/$path" && ! -L "$source/$path" ]] || { echo 'FALHA: snapshot extraído diverge da árvore Git.' >&2; return 1; }
      # umask 077 makes tar create 0600 for non-root users. Normalize the
      # extracted checkout to the Git mode before hashing and comparison.
      if [[ "$mode" == 100755 ]]; then chmod 755 -- "$source/$path"; else chmod 644 -- "$source/$path"; fi
      actual_mode=$(stat -c '%a' -- "$source/$path")
      case "$actual_mode" in 644|755) ;;
        *) echo 'FALHA: snapshot contém modo de arquivo não suportado.' >&2; return 1;;
      esac
      actual_mode="100$actual_mode"
      actual_hash=$(git hash-object --no-filters -- "$source/$path") || return 1
    fi
    [[ "$actual_mode" == "$mode" && "$actual_hash" == "$object" ]] || {
      echo 'FALHA: conteúdo do snapshot diverge da árvore Git.' >&2
      return 1
    }
    printf '%s\t%s\t%s\0' "$mode" "$object" "$path" >> "$RUN_DIR/tree-expected"
  done < "$RUN_DIR/tree-git"
  if ! find -P "$source" -mindepth 1 -print0 > "$RUN_DIR/snapshot-paths"; then
    echo 'FALHA: não foi possível enumerar o snapshot extraído.' >&2
    return 1
  fi
  while IFS= read -r -d '' path; do
    if [[ "$with_runtime_env" == true && "$path" == "$source/.env" ]]; then
      if [[ ! -f "$path" || -L "$path" || "$(stat -c '%a' -- "$path")" != 600 ]] \
          || ! cmp -s -- "$path" "$RUNTIME_ENV"; then
        echo 'FALHA: ambiente staged diverge da captura de produção.' >&2
        return 1
      fi
      continue
    fi
    if [[ -L "$path" ]]; then
      actual_mode=120000
      if ! readlink -z -- "$path" > "$RUN_DIR/link-target"; then return 1; fi
      IFS= read -r -d '' target < "$RUN_DIR/link-target" || return 1
      actual_hash=$(printf '%s' "$target" | git hash-object --stdin) || return 1
    elif [[ -d "$path" ]]; then
      chmod 755 -- "$path" || return 1
      path="${path#"$source"/}"
      printf 'D\t%s\0' "$path" >> "$RUN_DIR/tree-actual"
      continue
    elif [[ -f "$path" ]]; then
      actual_mode=$(stat -c '%a' -- "$path")
      case "$actual_mode" in 644|755) ;;
        *) echo 'FALHA: snapshot contém modo de arquivo não suportado.' >&2; return 1;;
      esac
      actual_mode="100$actual_mode"
      actual_hash=$(git hash-object --no-filters -- "$path") || return 1
    else
      echo 'FALHA: snapshot contém entrada não suportada.' >&2
      return 1
    fi
    path="${path#"$source"/}"
    printf '%s\t%s\t%s\0' "$actual_mode" "$actual_hash" "$path" >> "$RUN_DIR/tree-actual"
  done < "$RUN_DIR/snapshot-paths"
  sort -z "$RUN_DIR/tree-expected" > "$RUN_DIR/tree-expected.sorted"
  sort -z "$RUN_DIR/tree-actual" > "$RUN_DIR/tree-actual.sorted"
  if ! cmp -s "$RUN_DIR/tree-expected.sorted" "$RUN_DIR/tree-actual.sorted"; then
    echo 'FALHA: snapshot contém paths, modos ou conteúdo divergentes.' >&2
    return 1
  fi
}

verify_release_source() {
  local source="$1" revision
  if [[ "$source" == "$NEW_SOURCE" ]]; then
    revision="$NEW_REVISION"
  elif [[ "$source" == "$GOOD_SOURCE" ]]; then
    revision="$GOOD_REVISION"
  else
    echo 'FALHA: origem de release desconhecida.' >&2
    return 1
  fi
  verify_snapshot_tree "$revision" "$source" true
}

prepare_snapshot() {
  local revision="$1" source="$2" with_smoke="$3" path blob
  local paths=(docker-compose.vps.yml .dockerignore)
  local blobs=()
  if [[ "$with_smoke" == true ]]; then paths+=(scripts/smoke_catalog.sh); fi
  for path in "${paths[@]}"; do
    blob=$(regular_git_blob "$revision" "$path") || return 1
    blobs+=("$blob")
  done
  mkdir "$source"
  # COPY can only see this immutable commit snapshot, even if an out-of-band
  # writer changes the checkout after preflight. Never archive the live directory.
  timeout --kill-after=10s 120 git archive --format=tar "$revision" | tar -x -C "$source"
  # Read critical files from their verified blobs, independent of export-ignore
  # or export-subst attributes. Their tree modes were checked before extraction.
  local index
  for index in "${!paths[@]}"; do
    path="${paths[$index]}"
    mkdir -p -- "$(dirname "$source/$path")"
    git cat-file blob "${blobs[$index]}" > "$source/$path"
  done
  verify_snapshot_tree "$revision" "$source"
}

prepare_build_context() {
  prepare_snapshot "$NEW_REVISION" "$NEW_SOURCE" true
  validate_context_ignores "$NEW_SOURCE/.dockerignore"
  if [[ -e "$NEW_SOURCE/Dockerfile.dockerignore" || -L "$NEW_SOURCE/Dockerfile.dockerignore" ]]; then
    local blob
    blob=$(regular_git_blob "$NEW_REVISION" Dockerfile.dockerignore)
    git cat-file blob "$blob" > "$NEW_SOURCE/Dockerfile.dockerignore"
    validate_context_ignores "$NEW_SOURCE/Dockerfile.dockerignore"
  fi
  cat > "$RUN_DIR/build-context.yml" <<'YAML'
services:
  app:
    build:
      context: "${EXPERIMENTE_BUILD_CONTEXT}"
YAML
  BUILD_OVERRIDE_HASH=$(sha256sum "$RUN_DIR/build-context.yml")
  BUILD_OVERRIDE_HASH="${BUILD_OVERRIDE_HASH%% *}"
  cat > "$RUN_DIR/migration.yml" <<'YAML'
services:
  app:
    restart: "no"
YAML
  MIGRATION_OVERRIDE_HASH=$(sha256sum "$RUN_DIR/migration.yml")
  MIGRATION_OVERRIDE_HASH="${MIGRATION_OVERRIDE_HASH%% *}"
}

validate_build_contract() {
  local source="$1"
  verify_release_source "$source" || return 1
  [[ "$(sha256sum "$RUN_DIR/build-context.yml")" == "$BUILD_OVERRIDE_HASH  $RUN_DIR/build-context.yml" ]] \
    || return 1

  # Inspect the effective merged Compose model. Dockerfile-specific ignore
  # files take precedence over the root .dockerignore, and additional contexts
  # can expose bytes outside the verified snapshot. Neither is extensible
  # without an explicit deploy-contract change and matching regression tests.
  if ! EXPERIMENTE_BUILD_CONTEXT="$source" timeout --kill-after=5s 30 docker compose \
      --project-directory "$source" --project-name experimente-plus \
      -f "$source/docker-compose.vps.yml" -f "$RUN_DIR/build-context.yml" \
      config --format json > "$RUN_DIR/compose-build.json"; then
    echo 'FALHA: contrato efetivo de build do Compose impossível de verificar.' >&2
    return 1
  fi
  if ! /usr/bin/jq --exit-status --arg expected_context "$source" '
      (.services.app.build | type == "object") and
      ((.services.app.build | keys | sort) == ["context", "dockerfile", "target"]) and
      (.services.app.build.context == $expected_context) and
      (.services.app.build.dockerfile == "Dockerfile") and
      (.services.app.build.target == "production")
    ' "$RUN_DIR/compose-build.json" > /dev/null; then
    echo 'FALHA: build deve usar somente o snapshot, Dockerfile raiz e target production.' >&2
    return 1
  fi
}

materialize_snapshot() {
  local revision="$1" source="$2" previous_revision
  local excludes=(
    '--exclude=/.git/'
    '--exclude=/.env'
    '--exclude=/.env.local'
    '--exclude=/.env.*.local'
    '--exclude=/node_modules/'
    '--exclude=/build/'
    '--exclude=/dist/'
    '--exclude=/coverage/'
    '--exclude=/tmp/'
    '--exclude=/storage/uploads/'
    '--exclude=/storage/seed-media/'
  )

  preflight_filters || return 1
  preflight_untracked || return 1
  preflight_tracked || return 1
  [[ -x /usr/bin/rsync ]] || {
    echo 'FALHA: rsync do sistema é obrigatório para materializar a release.' >&2
    return 1
  }

  previous_revision=$(git rev-parse --verify HEAD 2>/dev/null) || return 1
  [[ "$previous_revision" =~ ^[0-9a-f]{40}$ ]] || return 1

  # Files come exclusively from the already verified snapshot. Do not use any
  # reset/checkout command here: even a mixed reset can execute a clean filter
  # injected after the preflight. Plain read-tree (without --reset or -u)
  # changes only the already-clean index and does not inspect worktree bytes;
  # update-ref advances HEAD with an expected-old-value concurrency guard.
  git read-tree "$revision" || return 1
  if ! git update-ref HEAD "$revision" "$previous_revision"; then
    # Best effort only: do not claim success if another writer raced the ref.
    git read-tree "$previous_revision" >/dev/null 2>&1 || true
    return 1
  fi
  timeout --kill-after=10s 120 /usr/bin/rsync --archive --checksum --no-owner --no-group \
    --omit-dir-times --chmod=D755 --delete --delete-delay --delay-updates \
    "${excludes[@]}" -- "$source/" "$DEPLOY_ROOT/" || return 1

  [[ "$(git rev-parse --verify HEAD)" == "$revision" ]] || return 1
  preflight_filters || return 1
  preflight_untracked || return 1
  preflight_tracked || return 1
}

# Bound host-side operations too, leaving time for rollback before the SSH job expires.
compose() {
  local source="$1"
  shift
  local limit=120
  local files=(--project-directory "$source" --project-name experimente-plus -f "$source/docker-compose.vps.yml")
  # Revalidate every staged byte immediately before Compose consumes it. This
  # catches an out-of-band mutation after extraction or during an earlier call.
  verify_release_source "$source" || return 1
  case "${1:-}" in
    build)
      limit=600
      [[ "$(sha256sum "$RUN_DIR/build-context.yml")" == "$BUILD_OVERRIDE_HASH  $RUN_DIR/build-context.yml" ]] || return 1
      files+=(-f "$RUN_DIR/build-context.yml")
      ;;
    run)
      [[ "$(sha256sum "$RUN_DIR/migration.yml")" == "$MIGRATION_OVERRIDE_HASH  $RUN_DIR/migration.yml" ]] || return 1
      files+=(-f "$RUN_DIR/migration.yml")
      ;;
    stop) limit=60 ;;
    config|ps) limit=30 ;;
  esac
  EXPERIMENTE_BUILD_CONTEXT="$source" \
    timeout --kill-after=10s "$limit" docker compose "${files[@]}" "$@"
}

docker_command() {
  timeout --kill-after=5s 30 docker "$@"
}

assert_no_bootstrap_rotation() {
  local rotation_containers
  if ! rotation_containers=$(docker_command ps --all --quiet --no-trunc \
      --filter 'label=com.experimente-plus.operation=bootstrap-rotation'); then
    echo 'FALHA: não foi possível verificar rotações de credenciais bootstrap.' >&2
    return 1
  fi
  if [[ -n "$rotation_containers" ]]; then
    echo 'FALHA: rotação de credenciais bootstrap exige reconciliação antes do deploy.' >&2
    return 1
  fi
}

cleanup_migration_containers() {
  local container_id metadata
  if ! docker_command ps --all --quiet --no-trunc \
      --filter 'name=^/experimente-plus-migration-[0-9a-f]{40}$' \
      --filter 'label=com.experimente-plus.deploy.role=migration' \
      --filter 'label=com.docker.compose.project=experimente-plus' \
      --filter 'label=com.docker.compose.service=app' \
      > "$RUN_DIR/migration-containers"; then
    echo 'FALHA: não foi possível enumerar containers de migration.' >&2
    return 1
  fi
  while IFS= read -r container_id; do
    [[ -z "$container_id" ]] && continue
    if [[ ! "$container_id" =~ ^[0-9a-f]{64}$ ]]; then
      echo 'FALHA: identidade inesperada de container de migration.' >&2
      return 1
    fi
    metadata=$(docker_command inspect --format \
      '{{.Name}}|{{index .Config.Labels "com.experimente-plus.deploy.role"}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' \
      "$container_id") || return 1
    if [[ ! "$metadata" =~ ^/experimente-plus-migration-[0-9a-f]{40}\|migration\|experimente-plus\|app$ ]]; then
      echo 'FALHA: container de migration não corresponde ao namespace do deploy.' >&2
      return 1
    fi
    docker_command rm --force "$container_id" > /dev/null || return 1
  done < "$RUN_DIR/migration-containers"

  if ! docker_command ps --all --quiet --no-trunc \
      --filter 'name=^/experimente-plus-migration-[0-9a-f]{40}$' \
      --filter 'label=com.experimente-plus.deploy.role=migration' \
      --filter 'label=com.docker.compose.project=experimente-plus' \
      --filter 'label=com.docker.compose.service=app' \
      > "$RUN_DIR/migration-containers-after" \
      || [[ -s "$RUN_DIR/migration-containers-after" ]]; then
    echo 'FALHA: container de migration permaneceu após cleanup.' >&2
    return 1
  fi
}

run_migrations() {
  local migration_name="experimente-plus-migration-$NEW_REVISION"
  local migration_metadata migration_container_id migration_exit wait_succeeded=0
  local expected_migration_metadata

  cleanup_migration_containers || return 1
  if ! compose "$NEW_SOURCE" run --detach --no-TTY --no-deps --name "$migration_name" \
      --label 'com.experimente-plus.deploy.role=migration' \
      --label "com.experimente-plus.deploy.revision=$NEW_REVISION" \
      app node ace.js migration:run --force > /dev/null; then
    cleanup_migration_containers || true
    echo 'FALHA: não foi possível iniciar o container de migration.' >&2
    return 1
  fi
  migration_metadata=$(docker_command inspect --format \
    '{{.Id}}|{{.Image}}|{{.HostConfig.RestartPolicy.Name}}|{{.Name}}|{{index .Config.Labels "com.experimente-plus.deploy.role"}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{index .Config.Labels "com.experimente-plus.deploy.revision"}}' \
    "$migration_name") || {
    cleanup_migration_containers || true
    return 1
  }
  migration_container_id="${migration_metadata%%|*}"
  expected_migration_metadata="$migration_container_id|$NEW_IMAGE|no|/$migration_name|migration|experimente-plus|app|$NEW_REVISION"
  if [[ ! "$migration_container_id" =~ ^[0-9a-f]{64}$ || "$migration_metadata" != "$expected_migration_metadata" ]]; then
    cleanup_migration_containers || true
    echo 'FALHA: identidade inválida do container de migration.' >&2
    return 1
  fi

  # `timeout docker compose run` can leave its one-shot container alive. Wait
  # on the concrete ID and always remove every deployment-owned writer before
  # returning, including timeout, signal and non-zero migration exits.
  if migration_exit=$(timeout --kill-after=10s 600 docker wait "$migration_container_id"); then
    wait_succeeded=1
  fi
  cleanup_migration_containers || return 1
  if (( ! wait_succeeded )) || [[ "$migration_exit" != 0 ]]; then
    echo 'FALHA: migration falhou ou excedeu o limite de 600s.' >&2
    return 1
  fi
}

compose_image() {
  local name
  name=$(compose "$1" config --images) || return 1
  [[ -n "$name" && "$name" != *$'\n'* ]] || return 1
  printf '%s\n' "$name"
}

running_image() {
  local container
  container=$(compose "$1" ps -q app) || return 1
  [[ -n "$container" && "$container" != *$'\n'* ]] || return 1
  docker_command inspect --format '{{.Image}}' "$container"
}

quiesce_service() {
  local running
  compose "$GOOD_SOURCE" stop -t 30 app || return 1
  running=$(compose "$GOOD_SOURCE" ps --status running -q app) || return 1
  [[ -z "$running" ]] || {
    echo 'FALHA: container app ainda está em execução após quiescência.' >&2
    return 1
  }
}

validate_release() {
  local expected_image="$1" smoke="$2" source="$3" actual_image code remaining deadline
  actual_image=$(running_image "$source") || return 1
  if [[ "$actual_image" != "$expected_image" ]]; then
    echo 'FALHA: o container não usa a imagem esperada.' >&2
    return 1
  fi

  deadline=$((SECONDS + READY_TIMEOUT))
  while (( SECONDS < deadline )); do
    code=$(curl --disable --noproxy '*' --silent --connect-timeout 2 --max-time 3 \
      --output /dev/null --write-out '%{http_code}' --header "Host: $SMOKE_HOST" \
      "${SMOKE_BASE_URL%/}/" 2>/dev/null || true)
    if [[ "$code" == 200 ]]; then
      # One API pass per release avoids masking failures with anonymous throttling.
      verify_release_source "$source" || return 1
      timeout --kill-after=5s 45 bash "$smoke"
      return "$?"
    fi
    remaining=$((deadline - SECONDS))
    if (( remaining > 0 )); then
      if (( remaining > 3 )); then remaining=3; fi
      sleep "$remaining"
    fi
  done
  echo "FALHA: readiness não respondeu em ${READY_TIMEOUT}s." >&2
  return 1
}

record_good_release() {
  local revision="$1" image_id="$2" smoke="$3" marks_verified="${4:-false}" smoke_hash
  smoke_hash=$(sha256sum "$smoke")
  smoke_hash="${smoke_hash%% *}"
  # Pin both artifacts before atomically advancing the state file. Older verified
  # commits/images remain available even after a failed reset, retry or rebuild.
  docker_command image tag "$image_id" "experimente-plus:deploy-good-$revision"
  git update-ref "refs/deploy/verified/$revision" "$revision"
  mkdir -p "$STATE_DIR/smokes"
  cp -- "$smoke" "$RUN_DIR/verified-smoke"
  /usr/bin/sync -f -- "$RUN_DIR/verified-smoke"
  mv -f -- "$RUN_DIR/verified-smoke" "$STATE_DIR/smokes/$smoke_hash.sh"
  /usr/bin/sync -f -- "$STATE_DIR/smokes"
  printf '%s\n%s\n%s\n' "$revision" "$image_id" "$smoke_hash" > "$RUN_DIR/last-known-good"
  /usr/bin/sync -f -- "$RUN_DIR/last-known-good"
  mv -f -- "$RUN_DIR/last-known-good" "$STATE_DIR/last-known-good"
  # The rename is the release commit point. A subsequent directory-fsync error
  # must report failure but must never roll the healthy NEW service back while
  # the visible LKG record already names it.
  if [[ "$marks_verified" == true ]]; then DEPLOY_VERIFIED=1; fi
  /usr/bin/sync -f -- "$STATE_DIR"
}

rollback() {
  local image_name
  echo "Restaurando revisão validada $GOOD_REVISION." >&2
  # Never start the retained HTTP writer beside a timed-out migration writer.
  cleanup_migration_containers || return 1
  image_name=$(compose_image "$GOOD_SOURCE") || return 1
  # Restore the retained image rather than depending on another build succeeding.
  # Service recovery must remain possible even if the live checkout is now dirty.
  docker_command image tag "$GOOD_IMAGE" "$image_name" || return 1
  compose "$GOOD_SOURCE" up -d --no-build --pull never --force-recreate app || return 1
  validate_release "$GOOD_IMAGE" "$GOOD_SMOKE" "$GOOD_SOURCE" || return 1
  echo "Serviço GOOD restaurado e validado: $GOOD_REVISION (readiness e catálogo)." >&2
  if ! materialize_snapshot "$GOOD_REVISION" "$GOOD_SOURCE"; then
    echo 'FALHA CRÍTICA: serviço restaurado; checkout não reconciliado, estado local preservado.' >&2
    return 1
  fi
  echo "Rollback validado: $GOOD_REVISION (readiness e catálogo)." >&2
}

install_signal_traps() {
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

finish() {
  local status="$1"
  trap - EXIT
  # A disconnect must not interrupt recovery halfway through; SIGKILL remains external.
  trap '' HUP INT TERM
  set +e
  if (( DEPLOY_STARTED && ! DEPLOY_VERIFIED )); then
    echo "FALHA durante $DEPLOY_PHASE; iniciando rollback." >&2
    if rollback; then
      status=1
    else
      echo 'FALHA CRÍTICA: recuperação incompleta; last-known-good foi preservado.' >&2
      status=2
    fi
  fi
  rm -rf -- "$RUN_DIR"
  exit "$status"
}

main() {
  resolve_target "$@"
  cd "${EXPERIMENTE_DEPLOY_ROOT:-/opt/experimente-plus}"
  umask 077
  validate_repository_layout
  STATE_DIR="$DEPLOY_ROOT/.git/experimente-plus-deploy"
  mkdir -p "$STATE_DIR"
  # The lock lives outside the working tree and is held through rollback/validation.
  exec 9>"$STATE_DIR/deploy.lock"
  if ! flock -n 9; then
    echo 'FALHA: outro deploy está em andamento neste host.' >&2
    exit 75
  fi
  if ! assert_no_bootstrap_rotation; then
    exit 75
  fi

  RUN_DIR=$(mktemp -d "$STATE_DIR/run.XXXXXX")
  NEW_SOURCE="$RUN_DIR/source"
  GOOD_SOURCE="$RUN_DIR/good-source"
  DEPLOY_STARTED=0
  DEPLOY_VERIFIED=0
  DEPLOY_PHASE=preparation
  trap 'finish "$?"' EXIT
  install_signal_traps

  [[ -x /usr/bin/rsync && -x /usr/bin/sync && -x /usr/bin/jq ]] || {
    echo 'FALHA: rsync, sync e jq do sistema são obrigatórios para o deploy.' >&2
    return 1
  }
  SMOKE_BASE_URL="${CATALOG_SMOKE_BASE_URL:-http://127.0.0.1:3400}"
  SMOKE_HOST="${CATALOG_SMOKE_HOST:-experimente-plus.mahina.fun}"
  READY_TIMEOUT="${DEPLOY_READY_TIMEOUT_SECONDS:-120}"
  if [[ ! "$READY_TIMEOUT" =~ ^[1-9][0-9]{0,2}$ ]] || (( READY_TIMEOUT > 120 )); then
    echo 'FALHA: readiness deve estar entre 1 e 120 segundos.' >&2
    return 1
  fi

  preflight_filters
  preflight_transport
  preflight_tracked
  preflight_untracked
  # Do this before fetch/snapshot work: a process killed with SIGKILL may have
  # left a detached migration writer from the previous attempt.
  cleanup_migration_containers
  capture_runtime_env
  fetch_approved_revision
  preflight_reserved_tree "$NEW_REVISION"
  prepare_build_context
  stage_runtime_env "$NEW_SOURCE"
  validate_build_contract "$NEW_SOURCE"
  NEW_SMOKE="$NEW_SOURCE/scripts/smoke_catalog.sh"
  [[ -s "$NEW_SMOKE" ]] || return 1

  if [[ -f "$STATE_DIR/last-known-good" ]]; then
    local saved_release good_smoke_hash actual_smoke_hash
    mapfile -t saved_release < "$STATE_DIR/last-known-good"
    if [[ "${#saved_release[@]}" != 3 ]]; then
      echo 'FALHA: registro last-known-good inválido.' >&2
      return 1
    fi
    GOOD_REVISION="${saved_release[0]}"
    GOOD_IMAGE="${saved_release[1]}"
    good_smoke_hash="${saved_release[2]}"
    if [[ ! "$GOOD_REVISION" =~ ^[0-9a-f]{40}$ || ! "$GOOD_IMAGE" =~ ^sha256:[0-9a-f]{64}$ \
        || ! "$good_smoke_hash" =~ ^[0-9a-f]{64}$ ]]; then
      echo 'FALHA: revisão/imagem/smoke last-known-good inválido.' >&2
      return 1
    fi
    git cat-file -e "$GOOD_REVISION^{commit}"
    preflight_reserved_tree "$GOOD_REVISION"
    # A legacy GOOD revision may have no smoke; its separately validated,
    # hash-pinned compatibility contract is retained in deploy state.
    prepare_snapshot "$GOOD_REVISION" "$GOOD_SOURCE" false
    stage_runtime_env "$GOOD_SOURCE"
    docker_command image inspect "$GOOD_IMAGE" > /dev/null
    GOOD_SMOKE="$RUN_DIR/good-smoke.sh"
    [[ -f "$STATE_DIR/smokes/$good_smoke_hash.sh" && ! -L "$STATE_DIR/smokes/$good_smoke_hash.sh" ]] || return 1
    cp -- "$STATE_DIR/smokes/$good_smoke_hash.sh" "$GOOD_SMOKE"
    actual_smoke_hash=$(sha256sum "$GOOD_SMOKE")
    if [[ "${actual_smoke_hash%% *}" != "$good_smoke_hash" ]]; then
      echo 'FALHA: integridade do smoke last-known-good inválida.' >&2
      return 1
    fi
  else
    # HEAD may already point at a failed deploy. Bootstrap requires the operator's
    # identified running revision, never an unverified PREV=HEAD assumption.
    if [[ ! "${DEPLOY_INITIAL_GOOD_REVISION:-}" =~ ^[0-9a-f]{40}$ ]]; then
      echo 'FALHA: DEPLOY_INITIAL_GOOD_REVISION exige o SHA completo da versão atualmente servida.' >&2
      return 1
    fi
    GOOD_REVISION=$(git rev-parse --verify "$DEPLOY_INITIAL_GOOD_REVISION^{commit}")
    preflight_reserved_tree "$GOOD_REVISION"
    prepare_snapshot "$GOOD_REVISION" "$GOOD_SOURCE" false
    stage_runtime_env "$GOOD_SOURCE"
    GOOD_SMOKE="$RUN_DIR/good-smoke.sh"
    local initial_smoke_revision="${DEPLOY_INITIAL_GOOD_SMOKE_REVISION:-$GOOD_REVISION}"
    if [[ ! "$initial_smoke_revision" =~ ^[0-9a-f]{40}$ ]]; then return 1; fi
    local initial_smoke_blob
    if ! initial_smoke_blob=$(regular_git_blob "$initial_smoke_revision" scripts/smoke_catalog.sh); then
      echo 'FALHA: baseline sem smoke; indique DEPLOY_INITIAL_GOOD_SMOKE_REVISION de um contrato compatível revisado.' >&2
      return 1
    fi
    git cat-file blob "$initial_smoke_blob" > "$GOOD_SMOKE"
    GOOD_IMAGE=$(running_image "$GOOD_SOURCE")
    validate_release "$GOOD_IMAGE" "$GOOD_SMOKE" "$GOOD_SOURCE"
    record_good_release "$GOOD_REVISION" "$GOOD_IMAGE" "$GOOD_SMOKE"
  fi

  # A previous process may have been SIGKILLed after launching its detached
  # one-shot writer. Clear deployment-owned leftovers before any recovery/deploy.
  cleanup_migration_containers

  if ! git merge-base --is-ancestor "$GOOD_REVISION" "$NEW_REVISION"; then
    echo 'FALHA: revisão solicitada não sucede a versão validada em produção.' >&2
    return 1
  fi

  # Recheck immediately before the first release mutation. The shared flock
  # prevents a conforming rotation from starting after this point; an orphaned
  # or out-of-protocol container remains a hard stop and is never removed here.
  if ! assert_no_bootstrap_rotation; then
    return 75
  fi
  if [[ "$GOOD_REVISION" == "$NEW_REVISION" ]]; then
    DEPLOY_STARTED=1
    DEPLOY_PHASE=reconciliation
    materialize_snapshot "$GOOD_REVISION" "$GOOD_SOURCE"
    if validate_release "$GOOD_IMAGE" "$GOOD_SMOKE" "$GOOD_SOURCE"; then
      DEPLOY_VERIFIED=1
      echo "Revisão já validada e em execução: $GOOD_REVISION."
      return 0
    fi

    DEPLOY_PHASE=recovery
    local recovered_image_name
    recovered_image_name=$(compose_image "$GOOD_SOURCE")
    docker_command image tag "$GOOD_IMAGE" "$recovered_image_name"
    compose "$GOOD_SOURCE" up -d --no-build --pull never --force-recreate app
    validate_release "$GOOD_IMAGE" "$GOOD_SMOKE" "$GOOD_SOURCE"
    DEPLOY_VERIFIED=1
    echo "Revisão validada recuperada e em execução: $GOOD_REVISION."
    return 0
  fi

  echo "deploy $GOOD_REVISION -> $NEW_REVISION"
  DEPLOY_STARTED=1
  DEPLOY_PHASE=materialization
  materialize_snapshot "$NEW_REVISION" "$NEW_SOURCE"
  DEPLOY_PHASE=preflight
  DEPLOY_PHASE=build
  compose "$NEW_SOURCE" build app
  local image_name
  image_name=$(compose_image "$NEW_SOURCE")
  NEW_IMAGE=$(docker_command image inspect --format '{{.Id}}' "$image_name")
  DEPLOY_PHASE=quiescence
  quiesce_service
  DEPLOY_PHASE=migration
  # Run pending migrations exactly once while the HTTP writer is stopped.
  run_migrations
  DEPLOY_PHASE=compose-up
  # Rollback never reverts a forward schema migration that already committed.
  compose "$NEW_SOURCE" up -d --no-build --pull never app
  DEPLOY_PHASE=validation
  validate_release "$NEW_IMAGE" "$NEW_SMOKE" "$NEW_SOURCE"
  DEPLOY_PHASE=recording
  # Keep the atomic state publication and in-memory success flag in one short
  # signal-critical section. EXIT remains armed if any recording command fails.
  trap '' HUP INT TERM
  record_good_release "$NEW_REVISION" "$NEW_IMAGE" "$NEW_SMOKE" true
  install_signal_traps
  echo "Deploy validado: $NEW_REVISION (readiness e catálogo)."
}

# Parse the complete function before materialization can replace this script on disk.
main "$@"
