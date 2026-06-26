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
  smoke/briefly-publish-smoke.sh
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

Run the full Briefly publish e2e smoke:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly:e2e
```

The e2e smoke publishes a test-prefixed post, verifies the public integration, and removes the test post from the Briefly/legacy post tables and slug-lock table.
Cleanup is guarded by the returned `post_id`, expected slug, and test title prefix; Briefly daily-input, draft, and workflow-run audit artifacts are intentionally retained.

Mint a Briefly Cognito ID token:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

Paste the raw token output into `/admin/briefly/`; the admin client adds the `Bearer` prefix for API calls.

## Existing production deploy

Site deploy syncs root static files to S3 + CloudFront invalidation via `.github/workflows/deploy.yml`. The same workflow builds `@briefly/admin-briefly` and syncs its `dist` output to `admin/briefly/`.

Local work is for building and validation. GitHub `origin/main` is the stored source of truth, and anything pushed or merged there is expected to be reflected on live `zacksimon.dev`. In agent instructions, `push and merge` means commit the intended local work, push/merge it to `origin/main`, and let the AWS deploy workflow make it live. If the change touches AWS resources outside the current workflow, such as Lambda or CDK, the deploy/smoke step or automation update must be part of the same task.

## Branch and workflow model

- `main` = only active branch
- `origin/main` = GitHub source of truth and live-site deployment boundary

Workflow and guardrails docs:

- `AGENTS.md` (working contract for future Codex sessions)
- `PLANS.md` (execution-plan template)
- `docs/dev-workflow.md` (lightweight branch/commit/validation process)

## Notes

- `apps/site` is intentionally a placeholder while we complete phased migration from root static files.
- CDK stack provisions Cognito, API, Lambdas, Step Functions, and DynamoDB for Briefly v1.
- Detailed architecture notes: `docs/briefly-v1-architecture.md`.
