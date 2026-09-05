# Headers de segurança no reverse proxy

## Objetivo

O Nginx da VPS possui headers globais, enquanto o AdonisJS escolhe políticas mais restritivas para
respostas privadas e páginas de erro. Repassar ambos produz campos duplicados e pode enfraquecer
`Referrer-Policy: no-referrer`. A configuração versionada em `infra/nginx/` oculta a cópia do
upstream e a reemite uma única vez: preserva o valor específico da aplicação e usa um default seguro
quando o upstream não fornece o campo.

Os arquivos têm responsabilidades diferentes:

- `experimente-plus-header-maps.conf` deve ser carregado no contexto `http` por
  `/etc/nginx/conf.d/*.conf`;
- `experimente-plus.conf` é o virtual host completo em `/etc/nginx/sites-available/`;
- `install_experimente_plus_config.sh` só pode executar a partir de uma cópia temporária
  `root:root 0500`, nunca diretamente da working tree.

Esta baseline não cria uma `Content-Security-Policy`: ela também permanece desabilitada no Shield.
Uma CSP útil para Inertia/React deve nascer na aplicação, com nonces e uma validação dedicada dos
recursos realmente carregados. Não adicionar uma política estática no proxy sem essa validação.

## Instalação ou atualização

Executar como root na VPS. O instalador preserva as configurações atuais por hash antes da troca,
valida toda a configuração e só então faz reload. Uma falha capturada depois da primeira troca
restaura os arquivos anteriores, valida novamente e recarrega o Nginx. Os dois arquivos de
configuração devem estar staged como arquivos regulares `root:root 0600`. O instalador usa um
`PATH` conhecido e valida também a própria cópia root-only antes de alterar o Nginx. A VPS monta
`/run` com `noexec`, por isso a cópia é validada e executada explicitamente pelo `/usr/bin/bash`.

```bash
(
  set -Eeuo pipefail
  PATH=/usr/sbin:/usr/bin:/sbin:/bin
  export PATH
  umask 077

  stage_dir=$(mktemp -d /run/experimente-plus-nginx.XXXXXX)
  staged_maps=$stage_dir/header-maps.conf
  staged_site=$stage_dir/site.conf
  staged_installer=$stage_dir/install.sh

  # Invoked indirectly by the EXIT trap.
  # shellcheck disable=SC2329
  cleanup() {
    status=$?
    trap - EXIT
    set +e
    rm -f -- "$staged_maps" "$staged_site" "$staged_installer" || status=2
    rmdir -- "$stage_dir" || status=2
    exit "$status"
  }
  trap cleanup EXIT

  install -o root -g root -m 0600 infra/nginx/experimente-plus-header-maps.conf "$staged_maps"
  install -o root -g root -m 0600 infra/nginx/experimente-plus.conf "$staged_site"
  install -o root -g root -m 0500 infra/nginx/install_experimente_plus_config.sh \
    "$staged_installer"

  /usr/bin/bash -n "$staged_installer"
  /usr/bin/bash "$staged_installer" "$staged_maps" "$staged_site"
)
```

## Validação

Validar `/`, `/api/v1/health` e uma rota 404 por HTTPS. Cada resposta deve conter exatamente uma
ocorrência de `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`,
`Referrer-Policy` e `X-XSS-Protection`. O 404 deve manter `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Cache-Control: private, no-store` e `X-Robots-Tag: noindex,
nofollow`. Home e health usam `strict-origin-when-cross-origin` quando a aplicação não define uma
política mais específica. O health deve responder sem `Set-Cookie` e com `Cache-Control: no-store`.
O proxy não deve alterar status, body, cookies ou políticas de cache emitidas pela aplicação.

Em caso de falha depois do reload, restaurar o virtual host salvo. Se o arquivo de maps não existia
antes, removê-lo; caso existisse, restaurar sua cópia. Rodar `nginx -t` antes do novo reload.
