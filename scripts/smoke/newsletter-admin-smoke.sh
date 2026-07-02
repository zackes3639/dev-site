#!/usr/bin/env bash
set -euo pipefail

NEWSLETTER_API_BASE="${NEWSLETTER_API_BASE:-${API_BASE:-}}"
ADMIN_BEARER_TOKEN="${ADMIN_BEARER_TOKEN:-}"
NEWSLETTER_CAMPAIGNS_PATH="${NEWSLETTER_CAMPAIGNS_PATH:-/v1/newsletter/campaigns}"
NEWSLETTER_ALLOW_TEST_SEND="${NEWSLETTER_ALLOW_TEST_SEND:-0}"
NEWSLETTER_TEST_EMAIL="${NEWSLETTER_TEST_EMAIL:-}"
NEWSLETTER_CAMPAIGN_ID="${NEWSLETTER_CAMPAIGN_ID:-}"

usage() {
  cat <<'EOF'
Usage:
  NEWSLETTER_API_BASE=https://example.execute-api.us-east-2.amazonaws.com \
  ADMIN_BEARER_TOKEN=<jwt> \
  npm run smoke:newsletter-admin

Default checks:
  - GET newsletter campaign list route without a token and expect auth denial
  - GET newsletter campaign list when ADMIN_BEARER_TOKEN is set

Safety:
  This smoke script never calls a subscriber blast endpoint. Optional SES test
  send checks require NEWSLETTER_ALLOW_TEST_SEND=1, NEWSLETTER_TEST_EMAIL, and
  NEWSLETTER_CAMPAIGN_ID, and they send only to the explicit test recipient.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ -z "$NEWSLETTER_API_BASE" ]]; then
  usage
  echo
  echo "NEWSLETTER_API_BASE is required."
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

api_request() {
  local method="$1"
  local path="$2"
  local output="$3"
  local payload="${4:-}"
  local url="${NEWSLETTER_API_BASE%/}${path}"
  local curl_args=(-sS -o "$output" -w "%{http_code}" -X "$method" "$url")

  if [[ -n "$ADMIN_BEARER_TOKEN" ]]; then
    curl_args+=(-H "authorization: Bearer $ADMIN_BEARER_TOKEN")
  fi

  if [[ -n "$payload" ]]; then
    curl_args+=(-H "content-type: application/json" -d "$payload")
  fi

  curl "${curl_args[@]}"
}

expect_code_one_of() {
  local label="$1"
  local actual="$2"
  local body_file="$3"
  shift 3
  local expected

  for expected in "$@"; do
    if [[ "$actual" == "$expected" ]]; then
      pass "$label returns $actual"
      return
    fi
  done

  fail "$label expected one of [$*], got $actual: $(cat "$body_file")"
}

echo "Running Build Log newsletter admin smoke..."
echo "Newsletter API: $NEWSLETTER_API_BASE"

unauth_campaigns_code="$(api_request GET "$NEWSLETTER_CAMPAIGNS_PATH" "$TMP_DIR/campaigns-unauth.json")"
expect_code_one_of "Newsletter campaigns auth gate" "$unauth_campaigns_code" "$TMP_DIR/campaigns-unauth.json" 401 403

if [[ -z "$ADMIN_BEARER_TOKEN" ]]; then
  echo "WARN: ADMIN_BEARER_TOKEN not set; skipping authenticated newsletter admin checks."
else
  campaigns_code="$(api_request GET "$NEWSLETTER_CAMPAIGNS_PATH" "$TMP_DIR/campaigns.json")"
  expect_code_one_of "Newsletter campaigns list" "$campaigns_code" "$TMP_DIR/campaigns.json" 200

  if [[ "$NEWSLETTER_ALLOW_TEST_SEND" == "1" ]]; then
    if [[ -z "$NEWSLETTER_TEST_EMAIL" || -z "$NEWSLETTER_CAMPAIGN_ID" ]]; then
      fail "NEWSLETTER_TEST_EMAIL and NEWSLETTER_CAMPAIGN_ID are required when NEWSLETTER_ALLOW_TEST_SEND=1"
    else
      encoded_campaign_id="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$NEWSLETTER_CAMPAIGN_ID")"
      test_payload='{"recipient_email":"'"$NEWSLETTER_TEST_EMAIL"'"}'
      test_send_code="$(api_request POST "/v1/newsletter/campaigns/$encoded_campaign_id/test" "$TMP_DIR/test-send.json" "$test_payload")"
      expect_code_one_of "Newsletter explicit test send" "$test_send_code" "$TMP_DIR/test-send.json" 200
    fi
  else
    echo "WARN: NEWSLETTER_ALLOW_TEST_SEND is not 1; skipping SES test-send check."
  fi
fi

echo "Safety check: no subscriber blast endpoint was called."

if ((failures > 0)); then
  echo "Newsletter admin smoke failed with $failures issue(s)."
  exit 1
fi

echo "Newsletter admin smoke passed."
