#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="${SITE_AUTH_FUNCTION_NAME:-zacksimon-site-auth}"
ROTATOR_FUNCTION_NAME="${SITE_GUEST_PASSWORD_ROTATOR_FUNCTION_NAME:-zacksimon-site-guest-password-rotator}"
ROLE_NAME="${SITE_AUTH_ROLE_NAME:-zacksimon-site-auth-role}"
AWS_REGION="${AWS_REGION:-us-east-2}"
OWNER_PASSWORD_PARAMETER="${OWNER_PASSWORD_PARAMETER:-/zacksimon/site/owner-password}"
GUEST_PASSWORD_PARAMETER="${GUEST_PASSWORD_PARAMETER:-/zacksimon/site/guest-password}"
GUEST_PASSWORD_DATE_PARAMETER="${GUEST_PASSWORD_DATE_PARAMETER:-/zacksimon/site/guest-password-date}"
GUEST_PASSWORD_ROTATION_SCHEDULE="${GUEST_PASSWORD_ROTATION_SCHEDULE:-cron(0 13 * * ? *)}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "${SITE_AUTH_SHARED_SECRET:-}" ]]; then
  echo "SITE_AUTH_SHARED_SECRET is required." >&2
  exit 1
fi

seed_owner_password_if_provided() {
  if [[ -z "${SITE_ACCESS_PASSWORD:-}" ]]; then
    return
  fi

  aws ssm put-parameter \
    --name "$OWNER_PASSWORD_PARAMETER" \
    --type SecureString \
    --value "$SITE_ACCESS_PASSWORD" \
    --overwrite \
    --region "$AWS_REGION" >/dev/null
}

create_role_if_needed() {
  if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": { "Service": "lambda.amazonaws.com" },
            "Action": "sts:AssumeRole"
          }
        ]
      }' >/dev/null

    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  fi

  aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name SiteAuthSsmRead \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": [
            \"ssm:GetParameter\",
            \"ssm:PutParameter\"
          ],
          \"Resource\": [
            \"arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter${OWNER_PASSWORD_PARAMETER}\",
            \"arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter${GUEST_PASSWORD_PARAMETER}\",
            \"arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter${GUEST_PASSWORD_DATE_PARAMETER}\"
          ]
        }
      ]
    }"

  aws iam wait role-exists --role-name "$ROLE_NAME"
  sleep 10
}

package_lambda() {
  cp "$ROOT_DIR/services/site-auth/src/handler.js" "$TMP_DIR/index.js"
  cp "$ROOT_DIR/services/site-auth/src/rotateGuestPassword.js" "$TMP_DIR/rotateGuestPassword.js"
  cp "$ROOT_DIR/services/site-auth/package.json" "$TMP_DIR/package.json"
  (cd "$TMP_DIR" && npm install --omit=dev --no-package-lock --silent >/dev/null && zip -qr auth-function.zip index.js node_modules)
  (cd "$TMP_DIR" && zip -qr rotator-function.zip rotateGuestPassword.js node_modules)
}

write_auth_environment() {
  jq -n \
    --arg secret "$SITE_AUTH_SHARED_SECRET" \
    --arg owner "$OWNER_PASSWORD_PARAMETER" \
    --arg guest "$GUEST_PASSWORD_PARAMETER" \
    --arg guestDate "$GUEST_PASSWORD_DATE_PARAMETER" \
    '{
      Variables: {
        SITE_AUTH_SHARED_SECRET: $secret,
        OWNER_PASSWORD_PARAMETER: $owner,
        GUEST_PASSWORD_PARAMETER: $guest,
        GUEST_PASSWORD_DATE_PARAMETER: $guestDate
      }
    }' > "$TMP_DIR/auth-env.json"
}

write_rotator_environment() {
  jq -n \
    --arg guest "$GUEST_PASSWORD_PARAMETER" \
    --arg guestDate "$GUEST_PASSWORD_DATE_PARAMETER" \
    '{
      Variables: {
        GUEST_PASSWORD_PARAMETER: $guest,
        GUEST_PASSWORD_DATE_PARAMETER: $guestDate
      }
    }' > "$TMP_DIR/rotator-env.json"
}

deploy_auth_lambda() {
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://${TMP_DIR}/auth-function.zip" \
      --region "$AWS_REGION" >/dev/null

    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$AWS_REGION"

    aws lambda update-function-configuration \
      --function-name "$FUNCTION_NAME" \
      --region "$AWS_REGION" \
      --environment "file://${TMP_DIR}/auth-env.json" >/dev/null

    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$AWS_REGION"
  else
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime nodejs20.x \
      --role "$ROLE_ARN" \
      --handler index.handler \
      --zip-file "fileb://${TMP_DIR}/auth-function.zip" \
      --timeout 5 \
      --memory-size 128 \
      --region "$AWS_REGION" \
      --environment "file://${TMP_DIR}/auth-env.json" >/dev/null

    aws lambda wait function-active \
      --function-name "$FUNCTION_NAME" \
      --region "$AWS_REGION"
  fi
}

deploy_rotator_lambda() {
  if aws lambda get-function --function-name "$ROTATOR_FUNCTION_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --zip-file "fileb://${TMP_DIR}/rotator-function.zip" \
      --region "$AWS_REGION" >/dev/null

    aws lambda wait function-updated \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --region "$AWS_REGION"

    aws lambda update-function-configuration \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --region "$AWS_REGION" \
      --environment "file://${TMP_DIR}/rotator-env.json" >/dev/null

    aws lambda wait function-updated \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --region "$AWS_REGION"
  else
    aws lambda create-function \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --runtime nodejs20.x \
      --role "$ROLE_ARN" \
      --handler rotateGuestPassword.handler \
      --zip-file "fileb://${TMP_DIR}/rotator-function.zip" \
      --timeout 10 \
      --memory-size 128 \
      --region "$AWS_REGION" \
      --environment "file://${TMP_DIR}/rotator-env.json" >/dev/null

    aws lambda wait function-active \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --region "$AWS_REGION"
  fi
}

seed_guest_password_if_missing() {
  if aws ssm get-parameter --name "$GUEST_PASSWORD_PARAMETER" --with-decryption --region "$AWS_REGION" >/dev/null 2>&1; then
    return
  fi

  aws lambda invoke \
    --function-name "$ROTATOR_FUNCTION_NAME" \
    --region "$AWS_REGION" \
    "$TMP_DIR/rotator-response.json" >/dev/null
}

ensure_rotation_schedule() {
  local rule_arn
  rule_arn="$(
    aws events put-rule \
      --name "$ROTATOR_FUNCTION_NAME" \
      --schedule-expression "$GUEST_PASSWORD_ROTATION_SCHEDULE" \
      --region "$AWS_REGION" \
      --query RuleArn \
      --output text
  )"

  aws events put-targets \
    --rule "$ROTATOR_FUNCTION_NAME" \
    --targets "Id=GuestPasswordRotator,Arn=arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:${ROTATOR_FUNCTION_NAME}" \
    --region "$AWS_REGION" >/dev/null

  if ! aws lambda get-policy --function-name "$ROTATOR_FUNCTION_NAME" --region "$AWS_REGION" 2>/dev/null | grep -q "AllowEventBridgeGuestPasswordRotation"; then
    aws lambda add-permission \
      --function-name "$ROTATOR_FUNCTION_NAME" \
      --statement-id AllowEventBridgeGuestPasswordRotation \
      --action lambda:InvokeFunction \
      --principal events.amazonaws.com \
      --source-arn "$rule_arn" \
      --region "$AWS_REGION" >/dev/null
  fi
}

ensure_function_url() {
  if ! aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws lambda create-function-url-config \
      --function-name "$FUNCTION_NAME" \
      --auth-type NONE \
      --region "$AWS_REGION" >/dev/null
  fi

  if ! aws lambda get-policy --function-name "$FUNCTION_NAME" --region "$AWS_REGION" 2>/dev/null | grep -q "FunctionUrlInvoke"; then
    aws lambda add-permission \
      --function-name "$FUNCTION_NAME" \
      --statement-id FunctionUrlInvoke \
      --action lambda:InvokeFunctionUrl \
      --principal "*" \
      --function-url-auth-type NONE \
      --region "$AWS_REGION" >/dev/null
  fi

  if ! aws lambda get-policy --function-name "$FUNCTION_NAME" --region "$AWS_REGION" 2>/dev/null | grep -q "PublicInvokeFunctionForUrl"; then
    aws lambda add-permission \
      --function-name "$FUNCTION_NAME" \
      --statement-id PublicInvokeFunctionForUrl \
      --action lambda:InvokeFunction \
      --principal "*" \
      --region "$AWS_REGION" >/dev/null
  fi

  aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region "$AWS_REGION" \
    --query FunctionUrl \
    --output text
}

seed_owner_password_if_provided
create_role_if_needed
package_lambda
write_auth_environment
write_rotator_environment
deploy_auth_lambda
deploy_rotator_lambda
ensure_rotation_schedule
seed_guest_password_if_missing
endpoint="$(ensure_function_url)"

echo "SITE_AUTH_ENDPOINT=${endpoint}"
echo "GUEST_PASSWORD_ROTATION_SCHEDULE=${GUEST_PASSWORD_ROTATION_SCHEDULE}"
