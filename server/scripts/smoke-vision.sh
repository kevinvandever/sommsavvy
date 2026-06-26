#!/usr/bin/env bash
# Confirms the vision (image) path of reverseScan works end-to-end against a
# reachable image (a locally-stored generated bottle portrait).
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
IMG="${IMG:?pass IMG=http://localhost:8788/files/<file>.png}"

SEND=$(curl -s -X POST "$BASE/auth/send-code" -H 'Content-Type: application/json' -d '{"email":"vision@example.com"}')
VID=$(echo "$SEND" | jq -r .verificationId); CODE=$(echo "$SEND" | jq -r .devCode)
TOKEN=$(curl -s -X POST "$BASE/auth/verify" -H 'Content-Type: application/json' -d "{\"verificationId\":\"$VID\",\"code\":\"$CODE\"}" | jq -r .token)

echo "== reverseScan (image path) =="
curl -s -N -X POST "$BASE/api/reverseScan" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"imageUrl\":\"$IMG\",\"depth\":\"enthusiast\"}"
echo
