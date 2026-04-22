#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${SITE_URL:-https://zacksimon.dev}"
PUBLIC_API_BASE="${PUBLIC_API_BASE:-https://33o1s2l689.execute-api.us-east-2.amazonaws.com}"
WRITE_API_BASE="${WRITE_API_BASE:-https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

failures=0

pass() { echo "PASS: $1"; }
fail() {
  echo "FAIL: $1"
  failures=$((failures + 1))
}

http_status() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url"
}

url_encode() {
  local s="$1"
  local out=""
  local c hex
  local i
  for ((i=0; i<${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *)
        printf -v hex '%%%02X' "'$c"
        out+="$hex"
        ;;
    esac
  done
  printf "%s" "$out"
}

is_json_array() {
  local file="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -e 'type == "array"' "$file" >/dev/null 2>&1
  else
    grep -q '^\[' "$file"
  fi
}

extract_first_slug() {
  local file="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r '[.[] | select((.slug // "") != "")][0].slug // ""' "$file"
  else
    grep -o '"slug":[[:space:]]*"[^"]*"' "$file" | head -n 1 | sed -E 's/.*"slug":[[:space:]]*"([^"]*)".*/\1/'
  fi
}

check_page_200() {
  local label="$1"
  local url="$2"
  local code
  code="$(http_status "$url")"
  if [[ "$code" == "200" ]]; then
    pass "$label returns 200"
  else
    fail "$label expected 200, got $code ($url)"
  fi
}

echo "Running deploy smoke test..."
echo "Site: $SITE_URL"
echo "Public API: $PUBLIC_API_BASE"
echo "Write API: $WRITE_API_BASE"

check_page_200 "Home page" "$SITE_URL/"
check_page_200 "Builds page" "$SITE_URL/work/"
check_page_200 "Blog page" "$SITE_URL/blog/"
check_page_200 "Admin page" "$SITE_URL/admin/"

curl -sS "$SITE_URL/builds.html" > "$TMP_DIR/builds_redirect.html"
if grep -q "url=/work/" "$TMP_DIR/builds_redirect.html"; then
  pass "/builds.html points to /work/"
else
  fail "/builds.html does not point to /work/"
fi

curl -sS -D "$TMP_DIR/posts.headers" -o "$TMP_DIR/posts.json" \
  -H "Origin: $SITE_URL" \
  "$PUBLIC_API_BASE/posts"

if grep -qi '^access-control-allow-origin:[[:space:]]*\(https://zacksimon.dev\|\*\)' "$TMP_DIR/posts.headers"; then
  pass "Posts API CORS header present"
else
  fail "Posts API missing expected Access-Control-Allow-Origin header"
fi

if is_json_array "$TMP_DIR/posts.json"; then
  pass "Posts API returned JSON array"
else
  fail "Posts API did not return a JSON array"
fi

curl -sS -D "$TMP_DIR/builds.headers" -o "$TMP_DIR/builds.json" \
  -H "Origin: $SITE_URL" \
  "$PUBLIC_API_BASE/builds"

if grep -qi '^access-control-allow-origin:[[:space:]]*\(https://zacksimon.dev\|\*\)' "$TMP_DIR/builds.headers"; then
  pass "Builds API CORS header present"
else
  fail "Builds API missing expected Access-Control-Allow-Origin header"
fi

if is_json_array "$TMP_DIR/builds.json"; then
  pass "Builds API returned JSON array"
else
  fail "Builds API did not return a JSON array"
fi

slug="$(extract_first_slug "$TMP_DIR/posts.json")"
if [[ -n "$slug" ]]; then
  check_page_200 "Post detail page" "$SITE_URL/blog/post/?slug=$slug"
else
  echo "WARN: No post slug found, skipping detail page smoke check."
fi

drafts_code="$(http_status "$PUBLIC_API_BASE/posts?include_drafts=1")"
if [[ "$drafts_code" == "403" ]]; then
  pass "Draft list is protected without password"
else
  fail "Draft list should be 403 without password, got $drafts_code"
fi

if [[ -n "$ADMIN_PASSWORD" ]]; then
  encoded_password="$(url_encode "$ADMIN_PASSWORD")"
  drafts_authed_code="$(http_status "$PUBLIC_API_BASE/posts?include_drafts=1&password=$encoded_password")"
  if [[ "$drafts_authed_code" == "200" ]]; then
    pass "Draft list works with ADMIN_PASSWORD"
  else
    fail "Draft list with ADMIN_PASSWORD expected 200, got $drafts_authed_code"
  fi

  validate_code="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -X POST "$WRITE_API_BASE/posts" \
      -d "{\"password\":\"$ADMIN_PASSWORD\",\"_validate\":true}"
  )"
  if [[ "$validate_code" == "200" ]]; then
    pass "Write API password validate returns 200"
  else
    fail "Write API validate expected 200, got $validate_code"
  fi
fi

if ((failures > 0)); then
  echo "Smoke test failed with $failures issue(s)."
  exit 1
fi

echo "Smoke test passed."
