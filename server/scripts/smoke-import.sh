#!/usr/bin/env bash
# Verifies the imported Kevin account: sign in, fetch cellar, check an image.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
EMAIL="kevin.vandever@mac.com"

SEND=$(curl -s -X POST "$BASE/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}")
VID=$(echo "$SEND" | jq -r .verificationId); CODE=$(echo "$SEND" | jq -r .devCode)
VERIFY=$(curl -s -X POST "$BASE/auth/verify" -H 'Content-Type: application/json' -d "{\"verificationId\":\"$VID\",\"code\":\"$CODE\"}")
TOKEN=$(echo "$VERIFY" | jq -r .token)
AUTH="Authorization: Bearer $TOKEN"

echo "== user id from login (should be 18ea79ab...) =="
echo "$VERIFY" | jq '.user | {id, email, displayName, tasteSummary: (.tasteSummary[0:40])}'

echo "== getMe =="
curl -s -X POST "$BASE/api/getMe" -H "$AUTH" | jq '{cellarCount, recent: [.recentEntries[0:3][].name]}'

echo "== listCellar count =="
curl -s -X POST "$BASE/api/listCellar" -H "$AUTH" -H 'Content-Type: application/json' -d '{}' | jq '.entries | length'

echo "== image fetch (HTTP code + type) =="
PHOTO=$(curl -s -X POST "$BASE/api/listCellar" -H "$AUTH" -H 'Content-Type: application/json' -d '{}' | jq -r '.entries[0].photoUrl')
echo "photo: $PHOTO"
curl -s -o /dev/null -w "status=%{http_code} type=%{content_type} size=%{size_download}\n" "$PHOTO"
