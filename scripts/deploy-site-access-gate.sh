#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="${SITE_ACCESS_FUNCTION_NAME:-zacksimon-site-access-gate}"
ROLE_NAME="${SITE_ACCESS_ROLE_NAME:-zacksimon-site-access-gate-role}"
DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:?CLOUDFRONT_DISTRIBUTION_ID is required}"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
LAMBDA_REGION="us-east-1"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

if [[ -z "${SITE_ACCESS_PASSWORD:-}" && -z "${SITE_AUTH_ENDPOINT:-}" ]]; then
  echo "SITE_ACCESS_PASSWORD or SITE_AUTH_ENDPOINT is required." >&2
  exit 1
fi

if [[ -n "${SITE_AUTH_ENDPOINT:-}" && -z "${SITE_AUTH_SHARED_SECRET:-}" ]]; then
  echo "SITE_AUTH_SHARED_SECRET is required when SITE_AUTH_ENDPOINT is set." >&2
  exit 1
fi

create_role_if_needed() {
  if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    return
  fi

  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Service": [
              "lambda.amazonaws.com",
              "edgelambda.amazonaws.com"
            ]
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }' >/dev/null

  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  aws iam wait role-exists --role-name "$ROLE_NAME"
  sleep 10
}

render_lambda() {
  node "$ROOT_DIR/scripts/render-site-access-gate.mjs" \
    "$ROOT_DIR/edge/site-access-gate.js" \
    "$TMP_DIR/index.js"

  (cd "$TMP_DIR" && zip -q function.zip index.js)
}

deploy_lambda() {
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$LAMBDA_REGION" >/dev/null 2>&1; then
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb://${TMP_DIR}/function.zip" \
      --region "$LAMBDA_REGION" >/dev/null

    aws lambda wait function-updated \
      --function-name "$FUNCTION_NAME" \
      --region "$LAMBDA_REGION"
  else
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime nodejs20.x \
      --role "$ROLE_ARN" \
      --handler index.handler \
      --zip-file "fileb://${TMP_DIR}/function.zip" \
      --timeout 5 \
      --memory-size 128 \
      --region "$LAMBDA_REGION" >/dev/null

    aws lambda wait function-active \
      --function-name "$FUNCTION_NAME" \
      --region "$LAMBDA_REGION"
  fi

  aws lambda publish-version \
    --function-name "$FUNCTION_NAME" \
    --region "$LAMBDA_REGION" \
    --query FunctionArn \
    --output text
}

associate_lambda() {
  local version_arn="$1"
  local etag
  etag="$(
    aws cloudfront get-distribution-config \
      --id "$DISTRIBUTION_ID" \
      --output json > "$TMP_DIR/distribution.json" \
    && jq -r '.ETag' "$TMP_DIR/distribution.json"
  )"

  jq --arg arn "$version_arn" '
    .DistributionConfig
    | .DefaultCacheBehavior.FunctionAssociations = {Quantity: 0}
    | .DefaultCacheBehavior.LambdaFunctionAssociations = {
        Quantity: 1,
        Items: [
          {
            LambdaFunctionARN: $arn,
            EventType: "viewer-request",
            IncludeBody: true
          }
        ]
      }
    | .DefaultCacheBehavior.AllowedMethods = {
        Quantity: 7,
        Items: ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
        CachedMethods: {
          Quantity: 2,
          Items: ["GET", "HEAD"]
        }
      }
  ' "$TMP_DIR/distribution.json" > "$TMP_DIR/distribution-config.json"

  aws cloudfront update-distribution \
    --id "$DISTRIBUTION_ID" \
    --if-match "$etag" \
    --distribution-config "file://${TMP_DIR}/distribution-config.json" >/dev/null

  aws cloudfront wait distribution-deployed --id "$DISTRIBUTION_ID"
}

create_role_if_needed
render_lambda
version_arn="$(deploy_lambda)"
associate_lambda "$version_arn"

echo "Deployed ${FUNCTION_NAME} ${version_arn} to CloudFront distribution ${DISTRIBUTION_ID}."
