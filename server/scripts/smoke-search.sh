#!/usr/bin/env bash
# Smoke-tests the You.com web search endpoint used by scan enrichment.
# Hits the provider DIRECTLY (not our server), so it isolates whether the API
# key works and whether the response shape matches what our parser expects
# (a results/hits array with snippets[] / snippet / description per item).
#
# Usage:
#   WEB_SEARCH_API_KEY=you_... ./scripts/smoke-search.sh
#   ./scripts/smoke-search.sh "Ridge Monte Bello 2019 wine tasting notes"
#
# The key/endpoint are read from the environment, falling back to server/.env
# if present. Requires curl + jq. Costs one search call.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Fall back to server/.env for the key/endpoint if not already exported.
if [[ -z "${WEB_SEARCH_API_KEY:-}" && -f "$ENV_FILE" ]]; then
  WEB_SEARCH_API_KEY=$(grep -E '^WEB_SEARCH_API_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d \"\' || true)
fi
if [[ -z "${WEB_SEARCH_ENDPOINT:-}" && -f "$ENV_FILE" ]]; then
  WEB_SEARCH_ENDPOINT=$(grep -E '^WEB_SEARCH_ENDPOINT=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d \"\' || true)
fi

ENDPOINT="${WEB_SEARCH_ENDPOINT:-https://ydc-index.io/v1/search}"
QUERY="${1:-Domaine Tempier Bandol Rouge 2020 wine tasting notes review price}"

if [[ -z "${WEB_SEARCH_API_KEY:-}" ]]; then
  echo "WEB_SEARCH_API_KEY not set (and not found in server/.env)." >&2
  echo "Run: WEB_SEARCH_API_KEY=you_... $0" >&2
  exit 1
fi

echo "== You.com search smoke =="
echo "endpoint: $ENDPOINT"
echo "query:    $QUERY"
echo

# Capture body + trailing HTTP status. --data-urlencode handles encoding.
RESP=$(curl -s -w $'\n%{http_code}' -G "$ENDPOINT" \
  --data-urlencode "query=$QUERY" \
  -H "X-API-Key: $WEB_SEARCH_API_KEY" \
  -H 'Accept: application/json')
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP $STATUS"
echo

if [[ "$STATUS" != "200" ]]; then
  echo "Non-200 response. This usually means a bad key, wrong endpoint, or a"
  echo "plan/quota issue. Body:"
  echo "$BODY" | head -c 800
  echo
  exit 1
fi

if ! echo "$BODY" | jq -e . >/dev/null 2>&1; then
  echo "Response was not JSON. First 500 chars:"
  echo "$BODY" | head -c 500
  exit 1
fi

echo "-- top-level keys --"
echo "$BODY" | jq -r 'keys[]'
echo

echo "-- result container + count --"
echo "$BODY" | jq -r '
  if (.results | type == "array") then "results: \(.results | length)"
  elif (.hits | type == "array") then "hits: \(.hits | length)"
  else "no results/hits array found at top level" end'
echo

echo "-- first result keys (what fields the provider returns) --"
echo "$BODY" | jq -r '(.results // .hits // [])[0] // {} | keys[]'
echo

echo "-- what our parser would extract (title / url / snippet), first 3 --"
echo "$BODY" | jq '
  [ (.results // .hits // [])[0:3][] | {
      title: (.title // ""),
      url: (.url // ""),
      snippet: (
        if (.snippets | type == "array") then (.snippets | join(" "))
        elif (.snippet | type == "string") then .snippet
        elif (.description | type == "string") then .description
        else "" end
      )
    } ]'
echo

echo "== DONE =="
echo "If the container is not results/hits, or snippets are empty above, tell"
echo "me and I will adjust parseWebSearchResults to match the real shape."
