#!/usr/bin/env bash
set -euo pipefail

DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:?CLOUDFRONT_DISTRIBUTION_ID is required}"
TMP_DIR="$(mktemp -d)"

trap 'rm -rf "$TMP_DIR"' EXIT

etag="$(
  aws cloudfront get-distribution-config \
    --id "$DISTRIBUTION_ID" \
    --output json > "$TMP_DIR/distribution.json" \
  && jq -r '.ETag' "$TMP_DIR/distribution.json"
)"

jq '
  .DistributionConfig
  | .DefaultCacheBehavior.LambdaFunctionAssociations = {Quantity: 0}
  | .DefaultCacheBehavior.AllowedMethods = {
      Quantity: 2,
      Items: ["GET", "HEAD"],
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

echo "Removed site access gate from CloudFront distribution ${DISTRIBUTION_ID}."
