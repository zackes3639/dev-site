#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${BRIEFLY_DEV_STACK_NAME:-BrieflyV1DevStack}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-2}}"

aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
  --output table
