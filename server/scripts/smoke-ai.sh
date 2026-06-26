#!/usr/bin/env bash
# Live AI smoke test. Exercises each AI method against real providers.
# Requires the server running on $BASE (default 8788) WITH real API keys set,
# plus AUTH_DEV_CODES=true. Requires curl + jq. Costs a few cents.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
EMAIL="ai-$(date +%s)@example.com"

# A small public test image (a bottle-ish object) for vision paths.
TEST_IMAGE="${TEST_IMAGE:-https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Wine_bottle_and_glass.jpg/320px-Wine_bottle_and_glass.jpg}"

echo "== auth =="
SEND=$(curl -s -X POST "$BASE/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}")
VID=$(echo "$SEND" | jq -r .verificationId); CODE=$(echo "$SEND" | jq -r .devCode)
TOKEN=$(curl -s -X POST "$BASE/auth/verify" -H 'Content-Type: application/json' -d "{\"verificationId\":\"$VID\",\"code\":\"$CODE\"}" | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

echo "== pocketSomm (text, SSE) =="
curl -s -N -X POST "$BASE/api/pocketSomm" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"text":"we are having grilled salmon and a lemon butter sauce","depth":"enthusiast"}'
echo

echo "== reverseScan (text, SSE) =="
curl -s -N -X POST "$BASE/api/reverseScan" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"text":"Domaine Tempier Bandol Rouge 2020","depth":"enthusiast"}'
echo

echo "== reverseScan (image, SSE) =="
curl -s -N -X POST "$BASE/api/reverseScan" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"imageUrl\":\"$TEST_IMAGE\",\"depth\":\"enthusiast\"}"
echo

echo "== DONE =="
