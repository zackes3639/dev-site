#!/usr/bin/env bash
set -euo pipefail

SITE_URL="${SITE_URL:-https://zacksimon.dev}"
PUBLIC_API_BASE="${PUBLIC_API_BASE:-https://33o1s2l689.execute-api.us-east-2.amazonaws.com}"
WRITE_API_BASE="${WRITE_API_BASE:-https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SITE_ACCESS_PASSWORD="${SITE_ACCESS_PASSWORD:-}"

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

http_status_with_cookie() {
  local url="$1"
  local cookie_jar="$2"
  curl -sS -b "$cookie_jar" -o /dev/null -w "%{http_code}" "$url"
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

check_authed_page_200() {
  local label="$1"
  local url="$2"
  local cookie_jar="$3"
  local code
  code="$(http_status_with_cookie "$url" "$cookie_jar")"
  if [[ "$code" == "200" ]]; then
    pass "$label returns 200 with site password session"
  else
    fail "$label expected 200 with site password session, got $code ($url)"
  fi
}

echo "Running deploy smoke test..."
echo "Site: $SITE_URL"
echo "Public API: $PUBLIC_API_BASE"
echo "Write API: $WRITE_API_BASE"

site_cookie_jar="$TMP_DIR/site.cookies"
protected_without_password=0

if [[ -n "$SITE_ACCESS_PASSWORD" ]]; then
  curl -sS "$SITE_URL/" > "$TMP_DIR/site_login.html"
  if grep -q 'action="/__site-login"' "$TMP_DIR/site_login.html"; then
    pass "Unauthenticated home page shows password login"
  else
    fail "Unauthenticated home page did not show password login"
  fi

  wrong_code="$(
    curl -sS -o "$TMP_DIR/wrong_login.html" -w "%{http_code}" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -X POST "$SITE_URL/__site-login" \
      --data-urlencode "password=wrong-password" \
      --data-urlencode "returnTo=/"
  )"
  if [[ "$wrong_code" == "200" ]] && grep -q "That password did not work" "$TMP_DIR/wrong_login.html"; then
    pass "Wrong site password fails"
  else
    fail "Wrong site password did not fail as expected"
  fi

  login_code="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      -c "$site_cookie_jar" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -X POST "$SITE_URL/__site-login" \
      --data-urlencode "password=$SITE_ACCESS_PASSWORD" \
      --data-urlencode "returnTo=/"
  )"
  if [[ "$login_code" == "303" ]]; then
    pass "Correct site password creates session"
  else
    fail "Correct site password expected 303, got $login_code"
  fi

  deep_link_code="$(http_status "$SITE_URL/blog/")"
  if [[ "$deep_link_code" == "302" ]]; then
    pass "Unauthenticated deep link is blocked"
  else
    fail "Unauthenticated deep link expected 302, got $deep_link_code"
  fi

  check_authed_page_200 "Home page" "$SITE_URL/" "$site_cookie_jar"
  check_authed_page_200 "Builds page" "$SITE_URL/work/" "$site_cookie_jar"
  check_authed_page_200 "Blog page" "$SITE_URL/blog/" "$site_cookie_jar"
  check_authed_page_200 "Admin page" "$SITE_URL/admin/" "$site_cookie_jar"
else
  curl -sS "$SITE_URL/" > "$TMP_DIR/site_home.html"
  if grep -q 'action="/__site-login"' "$TMP_DIR/site_home.html"; then
    protected_without_password=1
    pass "Unauthenticated home page shows password login"

    deep_link_code="$(http_status "$SITE_URL/blog/")"
    if [[ "$deep_link_code" == "302" ]]; then
      pass "Unauthenticated deep link is blocked"
    else
      fail "Unauthenticated deep link expected 302, got $deep_link_code"
    fi
  else
    check_page_200 "Home page" "$SITE_URL/"
    check_page_200 "Builds page" "$SITE_URL/work/"
    check_page_200 "Blog page" "$SITE_URL/blog/"
    check_page_200 "Admin page" "$SITE_URL/admin/"
  fi
fi

if [[ "$protected_without_password" == "1" ]]; then
  pass "/builds.html redirect check skipped without site password"
elif [[ -n "$SITE_ACCESS_PASSWORD" ]]; then
  curl -sS -b "$site_cookie_jar" "$SITE_URL/builds.html" > "$TMP_DIR/builds_redirect.html"
else
  curl -sS "$SITE_URL/builds.html" > "$TMP_DIR/builds_redirect.html"
fi
if [[ "$protected_without_password" != "1" ]]; then
  if grep -q "url=/work/" "$TMP_DIR/builds_redirect.html"; then
    pass "/builds.html points to /work/"
  else
    fail "/builds.html does not point to /work/"
  fi
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
  if [[ "$protected_without_password" == "1" ]]; then
    pass "Post detail page check skipped without site password"
  elif [[ -n "$SITE_ACCESS_PASSWORD" ]]; then
    check_authed_page_200 "Post detail page" "$SITE_URL/blog/post/?slug=$slug" "$site_cookie_jar"
  else
    check_page_200 "Post detail page" "$SITE_URL/blog/post/?slug=$slug"
  fi
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
