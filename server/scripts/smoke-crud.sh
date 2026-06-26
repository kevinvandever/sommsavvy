#!/usr/bin/env bash
# Local CRUD smoke test. Assumes the server is running on $BASE (default 8788)
# with AUTH_DEV_CODES=true. Requires curl + jq.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
EMAIL="crud-$(date +%s)@example.com"

echo "== send-code =="
SEND=$(curl -s -X POST "$BASE/auth/send-code" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}")
echo "$SEND"
VID=$(echo "$SEND" | jq -r .verificationId)
CODE=$(echo "$SEND" | jq -r .devCode)

echo "== verify =="
VERIFY=$(curl -s -X POST "$BASE/auth/verify" -H 'Content-Type: application/json' -d "{\"verificationId\":\"$VID\",\"code\":\"$CODE\"}")
TOKEN=$(echo "$VERIFY" | jq -r .token)
echo "token: ${TOKEN:0:24}..."
AUTH="Authorization: Bearer $TOKEN"

echo "== getMe (empty) =="
curl -s -X POST "$BASE/api/getMe" -H "$AUTH" | jq '{cellarCount, user: .user.email}'

echo "== save entry =="
SAVE=$(curl -s -X POST "$BASE/api/saveCellarEntry" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"kind":"wine","name":"Sancerre","producer":"Pascal Jolivet","region":"Loire","vintage":2022,"source":"manual","notes":"the steak wine"}')
echo "$SAVE" | jq '.entry | {id, name, tasted, owned, savedAt}'
ID=$(echo "$SAVE" | jq -r .entry.id)

echo "== save second entry (beer) =="
curl -s -X POST "$BASE/api/saveCellarEntry" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"kind":"beer","name":"Saison Dupont","source":"manual"}' | jq '.entry | {id, name, kind}'

echo "== listCellar (all) =="
curl -s -X POST "$BASE/api/listCellar" -H "$AUTH" -H 'Content-Type: application/json' -d '{}' | jq '.entries | length'

echo "== listCellar (kind=wine) =="
curl -s -X POST "$BASE/api/listCellar" -H "$AUTH" -H 'Content-Type: application/json' -d '{"kind":"wine"}' | jq '[.entries[].name]'

echo "== listCellar (search=steak) =="
curl -s -X POST "$BASE/api/listCellar" -H "$AUTH" -H 'Content-Type: application/json' -d '{"search":"steak"}' | jq '[.entries[].name]'

echo "== getEntry =="
curl -s -X POST "$BASE/api/getEntry" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"id\":\"$ID\"}" | jq '.entry.name'

echo "== updateCellarEntry (notes + owned) =="
curl -s -X POST "$BASE/api/updateCellarEntry" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"id\":\"$ID\",\"patch\":{\"notes\":\"updated note\",\"owned\":true}}" | jq '.entry | {notes, owned}'

echo "== updateProfile (displayName + depth) =="
curl -s -X POST "$BASE/api/updateProfile" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"displayName":"Tester","depthPreference":"expert"}' | jq '.user | {displayName, depthPreference}'

echo "== getMe (after saves) =="
curl -s -X POST "$BASE/api/getMe" -H "$AUTH" | jq '{cellarCount, recent: [.recentEntries[].name]}'

echo "== removeCellarEntry =="
curl -s -X POST "$BASE/api/removeCellarEntry" -H "$AUTH" -H 'Content-Type: application/json' -d "{\"id\":\"$ID\"}" | jq '.'

echo "== anonymous save (should 401) =="
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/saveCellarEntry" -H 'Content-Type: application/json' -d '{"kind":"wine","name":"x","source":"manual"}'

echo "== DONE =="
