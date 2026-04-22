#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-}"
ADMIN_BEARER_TOKEN="${ADMIN_BEARER_TOKEN:-}"

if [[ -z "$API_BASE" ]]; then
  echo "API_BASE is required, e.g. https://abc123.execute-api.us-east-2.amazonaws.com"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

failures=0

pass() { echo "PASS: $1"; }
fail() {
  echo "FAIL: $1"
  failures=$((failures + 1))
}

health_code="$(curl -sS -o "$TMP_DIR/health.json" -w "%{http_code}" "$API_BASE/v1/health")"
if [[ "$health_code" == "200" ]]; then
  pass "Health endpoint returns 200"
else
  fail "Health endpoint expected 200, got $health_code"
fi

if [[ -z "$ADMIN_BEARER_TOKEN" ]]; then
  echo "WARN: ADMIN_BEARER_TOKEN not set; skipping authenticated flow checks."
else
  create_payload='{"input_date":"'"$(date +%F)"'","bullets":["Smoke bullet 1","Smoke bullet 2","Smoke bullet 3"],"tone":"practical","tags":["smoke"]}'

  create_code="$(curl -sS -o "$TMP_DIR/create.json" -w "%{http_code}" \
    -X POST "$API_BASE/v1/daily-inputs" \
    -H "content-type: application/json" \
    -H "authorization: Bearer $ADMIN_BEARER_TOKEN" \
    -d "$create_payload")"

  if [[ "$create_code" == "201" ]]; then
    pass "Create daily input returns 201"
  else
    fail "Create daily input expected 201, got $create_code"
  fi

  input_id=""
  if command -v jq >/dev/null 2>&1; then
    input_id="$(jq -r '.input_id // empty' "$TMP_DIR/create.json")"
  fi

  if [[ -n "$input_id" ]]; then
    gen_code="$(curl -sS -o "$TMP_DIR/generate.json" -w "%{http_code}" \
      -X POST "$API_BASE/v1/daily-inputs/$input_id/generate" \
      -H "content-type: application/json" \
      -H "authorization: Bearer $ADMIN_BEARER_TOKEN" \
      -d '{"style_preset":"build_log_v1","target_word_count":350}')"

    if [[ "$gen_code" == "202" ]]; then
      pass "Start generation returns 202"
    else
      fail "Start generation expected 202, got $gen_code"
    fi
  else
    echo "WARN: Could not parse input_id from create response; skipping generation start check."
  fi
fi

if ((failures > 0)); then
  echo "Briefly smoke test failed with $failures issue(s)."
  exit 1
fi

echo "Briefly smoke test passed."
