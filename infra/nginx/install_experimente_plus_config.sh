#!/usr/bin/env bash
set -Eeuo pipefail

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
umask 077

SCRIPT_SOURCE=${BASH_SOURCE[0]}
MAP_SOURCE=${1:?Pass the staged header maps file}
SITE_SOURCE=${2:?Pass the staged virtual host file}
MAP_TARGET=/etc/nginx/conf.d/experimente-plus-header-maps.conf
SITE_TARGET=/etc/nginx/sites-available/experimente-plus
SITE_LINK=/etc/nginx/sites-enabled/experimente-plus
BACKUP_DIRECTORY=/var/lib/experimente-plus/nginx-config-backups
LOCK_FILE=/run/experimente-plus-nginx-config.lock

replacement_started=0
replacement_verified=0
map_existed=0
site_backup=
map_backup=
map_candidate=
site_candidate=
restore_candidate=

sha256() {
  local digest
  digest=$(sha256sum -- "$1")
  printf '%s' "${digest%% *}"
}

assert_regular_file() {
  [[ -f "$1" && ! -L "$1" ]]
}

restore_previous_config() {
  assert_regular_file "$site_backup" || return 1
  restore_candidate=$(mktemp /etc/nginx/sites-available/.experimente-plus.restore.XXXXXX) || return 1
  install -o root -g root -m 0644 "$site_backup" "$restore_candidate" || return 1
  mv -f -- "$restore_candidate" "$SITE_TARGET" || return 1
  restore_candidate=

  if ((map_existed == 1)); then
    assert_regular_file "$map_backup" || return 1
    restore_candidate=$(mktemp /etc/nginx/conf.d/.experimente-plus-header-maps.restore.XXXXXX) ||
      return 1
    install -o root -g root -m 0644 "$map_backup" "$restore_candidate" || return 1
    mv -f -- "$restore_candidate" "$MAP_TARGET" || return 1
    restore_candidate=
  else
    rm -f -- "$MAP_TARGET" || return 1
  fi

  sync -f -- "$SITE_TARGET" || return 1
  sync -f -- /etc/nginx/sites-available || return 1
  sync -f -- /etc/nginx/conf.d || return 1
  nginx -t || return 1
  systemctl reload nginx || return 1
  systemctl is-active --quiet nginx || return 1
}

cleanup() {
  local status=$?
  trap - EXIT
  trap '' HUP INT TERM
  set +e

  if ((status != 0 && replacement_started == 1 && replacement_verified == 0)); then
    if ! restore_previous_config; then
      echo 'FALHA CRÍTICA: não foi possível restaurar a configuração anterior do Nginx.' >&2
      status=2
    fi
  fi

  rm -f -- "${map_candidate:-}" "${site_candidate:-}" "${restore_candidate:-}"
  exit "$status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

[[ $(id -u) -eq 0 ]]
assert_regular_file "$SCRIPT_SOURCE"
[[ $(stat -c '%U:%G:%a' "$SCRIPT_SOURCE") == root:root:500 ]]
assert_regular_file "$MAP_SOURCE"
assert_regular_file "$SITE_SOURCE"
[[ $(stat -c '%U:%G:%a' "$MAP_SOURCE") == root:root:600 ]]
[[ $(stat -c '%U:%G:%a' "$SITE_SOURCE") == root:root:600 ]]
assert_regular_file "$SITE_TARGET"
[[ -L "$SITE_LINK" ]]
[[ $(readlink -f "$SITE_LINK") == "$SITE_TARGET" ]]
[[ -d /etc/nginx/conf.d && ! -L /etc/nginx/conf.d ]]
[[ -d /etc/nginx/sites-available && ! -L /etc/nginx/sites-available ]]

if [[ -e "$LOCK_FILE" || -L "$LOCK_FILE" ]]; then
  assert_regular_file "$LOCK_FILE"
  [[ $(stat -c '%U:%G' "$LOCK_FILE") == root:root ]]
else
  install -o root -g root -m 0600 /dev/null "$LOCK_FILE"
fi
chmod 0600 "$LOCK_FILE"
[[ $(stat -c '%U:%G:%a' "$LOCK_FILE") == root:root:600 ]]
exec 9<>"$LOCK_FILE"
flock -n 9
nginx -t

if [[ -e "$BACKUP_DIRECTORY" || -L "$BACKUP_DIRECTORY" ]]; then
  [[ -d "$BACKUP_DIRECTORY" && ! -L "$BACKUP_DIRECTORY" ]]
fi
install -d -o root -g root -m 0700 "$BACKUP_DIRECTORY"
[[ -d "$BACKUP_DIRECTORY" && ! -L "$BACKUP_DIRECTORY" ]]
[[ $(stat -c '%U:%G:%a' "$BACKUP_DIRECTORY") == root:root:700 ]]
site_sha=$(sha256 "$SITE_TARGET")
site_backup="$BACKUP_DIRECTORY/experimente-plus-site-$site_sha.conf"
if [[ -e "$site_backup" || -L "$site_backup" ]]; then
  assert_regular_file "$site_backup"
  [[ $(stat -c '%U:%G:%a' "$site_backup") == root:root:600 ]]
  [[ $(sha256 "$site_backup") == "$site_sha" ]]
else
  install -o root -g root -m 0600 "$SITE_TARGET" "$site_backup"
  sync -f -- "$site_backup"
  [[ $(sha256 "$site_backup") == "$site_sha" ]]
fi

if [[ -e "$MAP_TARGET" || -L "$MAP_TARGET" ]]; then
  map_existed=1
  assert_regular_file "$MAP_TARGET"
  map_sha=$(sha256 "$MAP_TARGET")
  map_backup="$BACKUP_DIRECTORY/experimente-plus-header-maps-$map_sha.conf"
  if [[ -e "$map_backup" || -L "$map_backup" ]]; then
    assert_regular_file "$map_backup"
    [[ $(stat -c '%U:%G:%a' "$map_backup") == root:root:600 ]]
    [[ $(sha256 "$map_backup") == "$map_sha" ]]
  else
    install -o root -g root -m 0600 "$MAP_TARGET" "$map_backup"
    sync -f -- "$map_backup"
    [[ $(sha256 "$map_backup") == "$map_sha" ]]
  fi
fi
sync -f -- "$BACKUP_DIRECTORY"

map_candidate=$(mktemp /etc/nginx/conf.d/.experimente-plus-header-maps.XXXXXX)
site_candidate=$(mktemp /etc/nginx/sites-available/.experimente-plus.XXXXXX)
install -o root -g root -m 0644 "$MAP_SOURCE" "$map_candidate"
install -o root -g root -m 0644 "$SITE_SOURCE" "$site_candidate"
sync -f -- "$map_candidate"
sync -f -- "$site_candidate"

replacement_started=1
mv -f -- "$map_candidate" "$MAP_TARGET"
map_candidate=
mv -f -- "$site_candidate" "$SITE_TARGET"
site_candidate=
sync -f -- /etc/nginx/conf.d
sync -f -- /etc/nginx/sites-available

nginx -t
systemctl reload nginx
systemctl is-active --quiet nginx
replacement_verified=1

printf 'Nginx configuration installed: site=%s maps=%s\n' \
  "$(sha256 "$SITE_TARGET")" "$(sha256 "$MAP_TARGET")"
