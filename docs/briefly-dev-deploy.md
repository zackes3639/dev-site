# Briefly v1 Dev Deployment (AWS)

This runbook provisions a **dev-only** AWS stack for Briefly.
It does not change the existing live-site deploy flow.

## Scope

The CDK stack provisions only Briefly dev resources:

- Cognito User Pool + App Client for admin auth
- API Gateway (HTTP API)
- API Lambdas (`services/api` handlers)
- Generation Lambda (`services/generation`)
- Publishing Lambda (`services/publishing`)
- Step Functions state machine for generation workflow
- DynamoDB tables:
  - `*_daily_inputs`
  - `*_drafts`
  - `*_posts`
  - `*_workflow_runs`
- CloudWatch log retention and basic alarms

## Prerequisites

- AWS credentials configured locally
- CDK bootstrap completed in target account/region
- Bedrock model access enabled in the target region for your configured model id

```bash
cd infra/cdk
npx cdk bootstrap aws://<account-id>/<region>
```

## Minimal dev config strategy

Defaults are defined in `infra/cdk/cdk.json`:

- `brieflyStage=dev`
- `brieflyResourcePrefix=briefly-dev`
- `brieflyBedrockModelId=anthropic.claude-3-5-sonnet-20240620-v1:0`
- `brieflyAdminAllowedOrigins=["http://localhost:5174"]`
- alarms enabled

You can override with env vars at deploy time:

- `BRIEFLY_STAGE` (must remain `dev`)
- `BRIEFLY_RESOURCE_PREFIX`
- `BRIEFLY_BEDROCK_MODEL_ID`
- `BRIEFLY_ADMIN_ALLOWED_ORIGINS` (comma-separated)
- `BRIEFLY_ENABLE_ALARMS` (`true`/`false`)
- `AWS_REGION` / `AWS_DEFAULT_REGION`

## Deploy commands (dev only)

From repo root:

```bash
npm run briefly:dev:typecheck
npm run briefly:dev:synth
npm run briefly:dev:diff
# run only when you explicitly want to deploy
npm run briefly:dev:deploy
```

Print deployed outputs:

```bash
npm run briefly:dev:outputs
```

## Post-deploy outputs to capture

CloudFormation outputs include:

- `BrieflyApiBaseUrl`
- `BrieflyJwtIssuer`
- `BrieflyUserPoolId`
- `BrieflyUserPoolClientId`
- `BrieflyDailyInputsTableName`
- `BrieflyDraftsTableName`
- `BrieflyPostsTableName`
- `BrieflyWorkflowRunsTableName`
- `BrieflyGenerationStateMachineArn`
- `BrieflyGenerationStateMachineName`

## Manual steps still required

1. Create an admin user in Cognito User Pool:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <BrieflyUserPoolId> \
  --username <admin-email> \
  --user-attributes Name=email,Value=<admin-email> Name=email_verified,Value=true \
  --message-action SUPPRESS
```

2. Set a permanent password:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <BrieflyUserPoolId> \
  --username <admin-email> \
  --password '<strong-password>' \
  --permanent
```

3. Get an ID token for admin API calls (example):

```bash
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id <BrieflyUserPoolClientId> \
  --auth-parameters USERNAME=<admin-email>,PASSWORD='<strong-password>'
```

Use `AuthenticationResult.IdToken` as `VITE_ADMIN_BEARER_TOKEN` in admin UI.

## Admin app wiring

```bash
VITE_BRIEFLY_API_BASE=<BrieflyApiBaseUrl-without-trailing-slash> \
VITE_ADMIN_BEARER_TOKEN=<id-token> \
npm run dev --workspace @briefly/admin-briefly
```

## Safety notes

- This path is intentionally **dev-only**.
- Do not introduce prod stack behavior yet.
- Live-site deployment (root static site + existing workflow) remains unchanged.
