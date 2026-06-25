#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-}"
ADMIN_BEARER_TOKEN="${ADMIN_BEARER_TOKEN:-}"
PUBLIC_API_BASE="${PUBLIC_API_BASE:-https://33o1s2l689.execute-api.us-east-2.amazonaws.com}"
SITE_URL="${SITE_URL:-https://zacksimon.dev}"
SITE_ACCESS_PASSWORD="${SITE_ACCESS_PASSWORD:-}"
AWS_REGION="${AWS_REGION:-us-east-2}"
BRIEFLY_POSTS_TABLE="${BRIEFLY_POSTS_TABLE:-briefly_posts}"
BRIEFLY_POST_SLUGS_TABLE="${BRIEFLY_POST_SLUGS_TABLE:-briefly_post_slugs}"
LEGACY_BLOG_POSTS_TABLE="${LEGACY_BLOG_POSTS_TABLE:-ZS_DEV_BLOG_POSTS}"
SMOKE_PUBLISH_CLEANUP="${SMOKE_PUBLISH_CLEANUP:-1}"
SMOKE_MAX_WAIT_SECONDS="${SMOKE_MAX_WAIT_SECONDS:-300}"

if [[ -z "$API_BASE" ]]; then
  echo "API_BASE is required, e.g. https://abc123.execute-api.us-east-2.amazonaws.com"
  exit 1
fi

if [[ -z "$ADMIN_BEARER_TOKEN" ]]; then
  echo "ADMIN_BEARER_TOKEN is required for publish e2e smoke."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for publish e2e smoke."
  exit 1
fi

TMP_DIR="$(mktemp -d)"
published_post_id=""
published_slug=""

cleanup() {
  local exit_code=$?

  if [[ "$SMOKE_PUBLISH_CLEANUP" == "1" && -n "$published_post_id" && -n "$published_slug" ]]; then
    if command -v aws >/dev/null 2>&1; then
      aws dynamodb delete-item \
        --table-name "$LEGACY_BLOG_POSTS_TABLE" \
        --key "{\"post_id\":{\"S\":\"$published_post_id\"}}" \
        --region "$AWS_REGION" >/dev/null 2>&1 || true

      aws dynamodb delete-item \
        --table-name "$BRIEFLY_POSTS_TABLE" \
        --key "{\"post_id\":{\"S\":\"$published_post_id\"}}" \
        --region "$AWS_REGION" >/dev/null 2>&1 || true

      aws dynamodb delete-item \
        --table-name "$BRIEFLY_POST_SLUGS_TABLE" \
        --key "{\"slug\":{\"S\":\"$published_slug\"}}" \
        --region "$AWS_REGION" >/dev/null 2>&1 || true

      echo "Cleaned up published smoke post: $published_slug"
    else
      echo "WARN: aws CLI unavailable; published smoke post was not cleaned up: $published_slug" >&2
    fi
  fi

  rm -rf "$TMP_DIR"
  exit "$exit_code"
}
trap cleanup EXIT

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
  local url="${API_BASE%/}${path}"

  if [[ -n "$payload" ]]; then
    curl -sS -o "$output" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "content-type: application/json" \
      -H "authorization: Bearer $ADMIN_BEARER_TOKEN" \
      -d "$payload"
  else
    curl -sS -o "$output" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "authorization: Bearer $ADMIN_BEARER_TOKEN"
  fi
}

expect_code() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local body_file="$4"

  if [[ "$actual" == "$expected" ]]; then
    pass "$label returns $expected"
  else
    fail "$label expected $expected, got $actual: $(cat "$body_file")"
  fi
}

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
slug_timestamp="$(printf '%s' "$timestamp" | tr '[:upper:]' '[:lower:]')"
published_slug="briefly-e2e-smoke-${slug_timestamp}"
title="Briefly E2E Smoke $timestamp"
summary="Automated Briefly publish smoke for $timestamp."
content="# $title

This is an automated Briefly publish smoke post.

- It verifies generation.
- It verifies draft update.
- It verifies publish integration with the live Build Log.

The smoke script deletes this post after verification."

create_payload="$(
  jq -n \
    --arg input_date "$(date +%F)" \
    --arg slug "$published_slug" \
    '{
      input_date: $input_date,
      bullets: [
        "Automated Briefly e2e smoke is exercising the hosted publish path.",
        "The draft will be edited and approved before publish.",
        ("The smoke slug is " + $slug + ".")
      ],
      tone: "practical",
      tags: ["smoke", "briefly"]
    }'
)"

create_code="$(api_request POST "/v1/daily-inputs" "$TMP_DIR/create.json" "$create_payload")"
expect_code "Create daily input" "201" "$create_code" "$TMP_DIR/create.json"
input_id="$(jq -r '.input_id // empty' "$TMP_DIR/create.json")"

if [[ -z "$input_id" ]]; then
  fail "Create daily input response did not include input_id"
fi

if ((failures == 0)); then
  generate_code="$(api_request POST "/v1/daily-inputs/$input_id/generate" "$TMP_DIR/generate.json" '{"style_preset":"build_log_v1","target_word_count":250}')"
  expect_code "Start generation" "202" "$generate_code" "$TMP_DIR/generate.json"
  run_id="$(jq -r '.run_id // empty' "$TMP_DIR/generate.json")"

  if [[ -z "$run_id" ]]; then
    fail "Start generation response did not include run_id"
  fi
fi

draft_id=""
if ((failures == 0)); then
  deadline=$((SECONDS + SMOKE_MAX_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    run_code="$(api_request GET "/v1/workflow-runs/$run_id" "$TMP_DIR/run.json")"
    if [[ "$run_code" != "200" ]]; then
      fail "Get workflow run expected 200, got $run_code: $(cat "$TMP_DIR/run.json")"
      break
    fi

    lifecycle_status="$(jq -r '.workflow_run.lifecycle_status // empty' "$TMP_DIR/run.json")"
    if [[ "$lifecycle_status" == "failed" ]]; then
      fail "Generation failed: $(jq -r '.workflow_run.error_message // "unknown error"' "$TMP_DIR/run.json")"
      break
    fi

    if [[ "$lifecycle_status" == "completed" ]]; then
      draft_id="$(jq -r '.workflow_run.draft_id // empty' "$TMP_DIR/run.json")"
      break
    fi

    sleep 5
  done

  if [[ -z "$draft_id" ]]; then
    draft_code="$(api_request GET "/v1/daily-inputs/$input_id/draft" "$TMP_DIR/input-draft.json")"
    if [[ "$draft_code" == "200" ]]; then
      draft_id="$(jq -r '.draft.draft_id // empty' "$TMP_DIR/input-draft.json")"
    fi
  fi

  if [[ -n "$draft_id" ]]; then
    pass "Generation completed with draft $draft_id"
  else
    fail "Generation did not produce a draft within ${SMOKE_MAX_WAIT_SECONDS}s"
  fi
fi

if ((failures == 0)); then
  draft_code="$(api_request GET "/v1/drafts/$draft_id" "$TMP_DIR/draft.json")"
  expect_code "Load draft" "200" "$draft_code" "$TMP_DIR/draft.json"
  draft_version="$(jq -r '.draft.version // empty' "$TMP_DIR/draft.json")"

  update_payload="$(
    jq -n \
      --argjson expected_version "$draft_version" \
      --arg title "$title" \
      --arg summary "$summary" \
      --arg content_md "$content" \
      '{
        expected_version: $expected_version,
        title: $title,
        summary: $summary,
        content_md: $content_md,
        editor_notes: "Automated publish e2e smoke.",
        status: "approved"
      }'
  )"

  update_code="$(api_request PUT "/v1/drafts/$draft_id" "$TMP_DIR/update.json" "$update_payload")"
  expect_code "Update and approve draft" "200" "$update_code" "$TMP_DIR/update.json"
  updated_version="$(jq -r '.draft.version // empty' "$TMP_DIR/update.json")"
fi

if ((failures == 0)); then
  publish_payload="$(
    jq -n \
      --argjson expected_version "$updated_version" \
      --arg title "$title" \
      --arg summary "$summary" \
      --arg content_md "$content" \
      --arg slug "$published_slug" \
      '{
        expected_version: $expected_version,
        edited_title: $title,
        edited_summary: $summary,
        edited_content_md: $content_md,
        slug: $slug,
        publish_at: "now"
      }'
  )"

  publish_code="$(api_request POST "/v1/drafts/$draft_id/publish" "$TMP_DIR/publish.json" "$publish_payload")"
  expect_code "Publish draft" "200" "$publish_code" "$TMP_DIR/publish.json"
  published_post_id="$(jq -r '.post_id // empty' "$TMP_DIR/publish.json")"
  published_url="$(jq -r '.url // empty' "$TMP_DIR/publish.json")"

  if [[ -n "$published_post_id" && "$published_url" == "/blog/post/?slug=$published_slug" ]]; then
    pass "Publish returned expected post id and URL"
  else
    fail "Publish response missing expected post id or URL: $(cat "$TMP_DIR/publish.json")"
  fi
fi

if ((failures == 0)); then
  for _ in {1..12}; do
    curl -sS -o "$TMP_DIR/public-posts.json" "$PUBLIC_API_BASE/posts"
    if jq -e --arg slug "$published_slug" '.[] | select(.slug == $slug)' "$TMP_DIR/public-posts.json" >/dev/null; then
      pass "Published post appears in public posts API"
      break
    fi
    sleep 5
  done

  if ! jq -e --arg slug "$published_slug" '.[] | select(.slug == $slug)' "$TMP_DIR/public-posts.json" >/dev/null; then
    fail "Published post did not appear in public posts API"
  fi
fi

if [[ "$failures" -eq 0 && -n "$SITE_ACCESS_PASSWORD" ]]; then
  cookie_jar="$TMP_DIR/site.cookies"
  login_code="$(
    curl -sS -o /dev/null -w "%{http_code}" \
      -c "$cookie_jar" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -X POST "${SITE_URL%/}/__site-login" \
      --data-urlencode "password=$SITE_ACCESS_PASSWORD" \
      --data-urlencode "returnTo=/"
  )"

  if [[ "$login_code" == "303" ]]; then
    detail_code="$(curl -sS -b "$cookie_jar" -o /dev/null -w "%{http_code}" "${SITE_URL%/}/blog/post/?slug=$published_slug")"
    if [[ "$detail_code" == "200" ]]; then
      pass "Published post detail route returns 200 with site session"
    else
      fail "Published post detail route expected 200, got $detail_code"
    fi
  else
    fail "Site password login expected 303, got $login_code"
  fi
else
  echo "WARN: SITE_ACCESS_PASSWORD not set; skipping protected detail-page check."
fi

if ((failures > 0)); then
  echo "Briefly publish e2e smoke failed with $failures issue(s)."
  exit 1
fi

echo "Briefly publish e2e smoke passed."
