#!/usr/bin/env bash
# Confirms OpenAI transcription works against a locally-served audio clip.
set -euo pipefail
BASE="${BASE:-http://localhost:8788}"
AUDIO="${AUDIO:?pass AUDIO=http://localhost:8788/files/<clip>.m4a}"

SEND=$(curl -s -X POST "$BASE/auth/send-code" -H 'Content-Type: application/json' -d '{"email":"tx@example.com"}')
VID=$(echo "$SEND" | jq -r .verificationId); CODE=$(echo "$SEND" | jq -r .devCode)
TOKEN=$(curl -s -X POST "$BASE/auth/verify" -H 'Content-Type: application/json' -d "{\"verificationId\":\"$VID\",\"code\":\"$CODE\"}" | jq -r .token)

echo "== transcribeVoice =="
curl -s -X POST "$BASE/api/transcribeVoice" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"audioUrl\":\"$AUDIO\"}" | jq .
