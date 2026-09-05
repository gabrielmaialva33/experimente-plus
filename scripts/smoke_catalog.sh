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

check_endpoint '/' 'text/html' 'text/html'
check_endpoint '/cidades' 'text/html' 'text/html'
check_endpoint "/cidades/$SMOKE_CITY_SLUG" 'text/html' 'text/html'
check_endpoint "/cidades/$SMOKE_CITY_SLUG" 'text/html' 'application/json' \
  --header 'X-Inertia: true' --header 'X-Requested-With: XMLHttpRequest'
check_endpoint "/api/v1/catalog/cities/$SMOKE_CITY_SLUG/establishments?per_page=1" \
  'application/json' 'application/json'
check_endpoint "/api/v1/catalog/cities/$SMOKE_CITY_SLUG/filters" \
  'application/json' 'application/json'
