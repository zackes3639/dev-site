#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-token}"
AWS_REGION="${AWS_REGION:-us-east-2}"
BRIEFLY_USER_POOL_ID="${BRIEFLY_USER_POOL_ID:-us-east-2_0hhgJcr4h}"
BRIEFLY_USER_POOL_CLIENT_ID="${BRIEFLY_USER_POOL_CLIENT_ID:-436n9qucieqcg55k6ufv7nr9s6}"
BRIEFLY_ADMIN_EMAIL="${BRIEFLY_ADMIN_EMAIL:?BRIEFLY_ADMIN_EMAIL is required}"
BRIEFLY_ADMIN_PASSWORD="${BRIEFLY_ADMIN_PASSWORD:?BRIEFLY_ADMIN_PASSWORD is required}"

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is required." >&2
    exit 1
  fi
}

ensure_user() {
  if ! aws cognito-idp admin-get-user \
    --user-pool-id "$BRIEFLY_USER_POOL_ID" \
    --username "$BRIEFLY_ADMIN_EMAIL" \
    --region "$AWS_REGION" >/dev/null 2>&1; then
    aws cognito-idp admin-create-user \
      --user-pool-id "$BRIEFLY_USER_POOL_ID" \
      --username "$BRIEFLY_ADMIN_EMAIL" \
      --user-attributes "Name=email,Value=${BRIEFLY_ADMIN_EMAIL}" "Name=email_verified,Value=true" \
      --message-action SUPPRESS \
      --region "$AWS_REGION" >/dev/null
  fi

  aws cognito-idp admin-set-user-password \
    --user-pool-id "$BRIEFLY_USER_POOL_ID" \
    --username "$BRIEFLY_ADMIN_EMAIL" \
    --password "$BRIEFLY_ADMIN_PASSWORD" \
    --permanent \
    --region "$AWS_REGION" >/dev/null

  echo "Cognito admin user is ready: ${BRIEFLY_ADMIN_EMAIL}"
}

mint_token() {
  require_jq
  local auth_parameters
  auth_parameters="$(
    jq -n \
      --arg username "$BRIEFLY_ADMIN_EMAIL" \
      --arg password "$BRIEFLY_ADMIN_PASSWORD" \
      '{USERNAME: $username, PASSWORD: $password}'
  )"

  aws cognito-idp initiate-auth \
    --client-id "$BRIEFLY_USER_POOL_CLIENT_ID" \
    --auth-flow USER_PASSWORD_AUTH \
    --auth-parameters "$auth_parameters" \
    --region "$AWS_REGION" \
    --query 'AuthenticationResult.IdToken' \
    --output text
}

case "$ACTION" in
  ensure-user)
    ensure_user
    ;;
  token)
    mint_token
    ;;
  *)
    echo "Usage: $0 [ensure-user|token]" >&2
    exit 1
    ;;
esac
