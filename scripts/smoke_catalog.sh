#!/usr/bin/env bash
# Read-only deploy smoke. Requires a real city in the operation resolved by Host.
# No application bootstrap, database client, credentials, or response bodies.
set -euo pipefail

SMOKE_BASE_URL="${CATALOG_SMOKE_BASE_URL:-http://127.0.0.1:3400}"
SMOKE_BASE_URL="${SMOKE_BASE_URL%/}"
SMOKE_HOST="${CATALOG_SMOKE_HOST:-experimente-plus.mahina.fun}"
SMOKE_CITY_SLUG="${CATALOG_SMOKE_CITY_SLUG:-londrina}"

if [[ ! "$SMOKE_CITY_SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo 'FALHA: CATALOG_SMOKE_CITY_SLUG deve ser um slug de cidade válido.' >&2
  exit 1
fi

check_endpoint() {
  local path="$1" accept="$2" expected_type="$3"
  shift 3
  local result code content_type

  if ! result=$(curl --disable --noproxy '*' --silent --connect-timeout 2 --max-time 5 \
      --output /dev/null --write-out '%{http_code} %{content_type}' \
      --header "Host: $SMOKE_HOST" --header "Accept: $accept" \
      --header 'Cache-Control: no-cache' "$@" "$SMOKE_BASE_URL$path"); then
    echo "FALHA smoke GET $path: conexão falhou ou excedeu 5s." >&2
    return 1
  fi

  code="${result%% *}"
  content_type="${result#* }"
  content_type="${content_type%%;*}"
  if [[ "$code" != '200' || "$content_type" != "$expected_type" ]]; then
    echo "FALHA smoke GET $path: HTTP $code; esperado 200 com $expected_type." >&2
    return 1
  fi
  echo "OK smoke GET $path ($expected_type)"
}

check_inertia_endpoint() {
  local path="$1" result code content_type version location
  local -a fields=()

  # Inertia v3 treats a GET without X-Inertia-Version as an asset-version
  # handshake and replies 409 with the current version. Learn that version from
  # response headers only, then require the actual page object to be a JSON 200.
  if ! result=$(curl --disable --noproxy '*' --silent --connect-timeout 2 --max-time 5 \
      --output /dev/null \
      --write-out $'%{http_code}\n%{content_type}\n%header{x-inertia-version}\n%header{x-inertia-location}' \
      --header "Host: $SMOKE_HOST" --header 'Accept: text/html' \
      --header 'Cache-Control: no-cache' --header 'X-Inertia: true' \
      --header 'X-Requested-With: XMLHttpRequest' "$SMOKE_BASE_URL$path"); then
    echo "FALHA smoke GET $path: handshake Inertia falhou ou excedeu 5s." >&2
    return 1
  fi

  mapfile -t fields <<< "$result"
  code="${fields[0]:-}"
  content_type="${fields[1]:-}"
  content_type="${content_type%%;*}"
  version="${fields[2]:-}"
  location="${fields[3]:-}"

  # Older compatible adapters may return the page object immediately.
  if [[ "$code" == '200' && "$content_type" == 'application/json' ]]; then
    echo "OK smoke GET $path (application/json)"
    return 0
  fi
  if [[ "$code" != '409' || "$content_type" != 'application/json' \
      || ! "$version" =~ ^[A-Za-z0-9._:-]{1,128}$ || "$location" != "$path" ]]; then
    echo "FALHA smoke GET $path: HTTP $code; handshake Inertia inválido." >&2
    return 1
  fi

  check_endpoint "$path" 'text/html' 'application/json' \
    --header 'X-Inertia: true' --header 'X-Requested-With: XMLHttpRequest' \
    --header "X-Inertia-Version: $version"
}

check_endpoint '/' 'text/html' 'text/html'
check_endpoint '/cidades' 'text/html' 'text/html'
check_endpoint "/cidades/$SMOKE_CITY_SLUG" 'text/html' 'text/html'
check_inertia_endpoint "/cidades/$SMOKE_CITY_SLUG"
check_endpoint "/api/v1/catalog/cities/$SMOKE_CITY_SLUG/establishments?per_page=1" \
  'application/json' 'application/json'
check_endpoint "/api/v1/catalog/cities/$SMOKE_CITY_SLUG/filters" \
  'application/json' 'application/json'
