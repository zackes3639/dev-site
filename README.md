# zacksimon.dev + Briefly

This repository contains the live `zacksimon.dev` static site plus the Briefly admin/backend work that publishes into The Build Log.

## Current state

- Production site is still static files at repository root and deploys to S3/CloudFront.
- Existing Python Lambdas in `lambda/` still power current blog/build endpoints.
- Briefly v1 backend is deployed as `BrieflyV1Stack`.
- Briefly admin is hosted privately at `/admin/briefly/` when the main deploy workflow runs.

## Monorepo layout

```text
apps/
  site/                 # target home for zacksimon.dev frontend (migration pending)
  admin-briefly/        # Briefly admin frontend (Vite + TS)
services/
  api/                  # API Gateway Lambda handlers (TS)
  generation/           # Bedrock generation Lambda (TS)
  publishing/           # publish service Lambda (TS)
packages/
  contracts/            # shared API/data contracts + schemas
  shared/               # shared utilities (ids, logger, http response)
infra/
  cdk/                  # AWS CDK stack for Briefly v1
scripts/
  smoke/briefly-smoke.sh
```

## Briefly v1 architecture choices

- TypeScript
- Monorepo workspaces
- API Gateway + Lambda
- DynamoDB tables:
  - `briefly_daily_inputs`
  - `briefly_drafts`
  - `briefly_posts`
  - `briefly_post_slugs`
  - `briefly_workflow_runs`
- Bedrock generation
- Human review before publish (no auto-publish)

## Workspace commands

From repo root:

```bash
npm install
npm run typecheck
npm run build
```

Run deploy smoke for existing site:

```bash
npm run smoke:deploy
```

Run Briefly API smoke checks:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly
```

Mint a Briefly Cognito ID token:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

## Existing production deploy

Site deploy still syncs root static files to S3 + CloudFront invalidation via `.github/workflows/deploy.yml`. The same workflow builds `@briefly/admin-briefly` and syncs its `dist` output to `admin/briefly/`.

## Branch and workflow model

- `main` = stable integration branch
- `briefly-dev` = active development branch for ongoing Briefly work

Workflow and guardrails docs:

- `AGENTS.md` (working contract for future Codex sessions)
- `PLANS.md` (execution-plan template)
- `docs/dev-workflow.md` (lightweight branch/commit/validation process)

## Notes

- `apps/site` is intentionally a placeholder while we complete phased migration from root static files.
- CDK stack provisions Cognito, API, Lambdas, Step Functions, and DynamoDB for Briefly v1.
- Detailed architecture notes: `docs/briefly-v1-architecture.md`.
