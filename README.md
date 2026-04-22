# zacksimon.dev + Briefly (Monorepo Scaffold)

This repository now includes a TypeScript monorepo scaffold for **Briefly** while keeping the current production site live.

## Current state

- Production site is still static files at repository root and deploys to S3/CloudFront.
- Existing Python Lambdas in `lambda/` still power current blog/build endpoints.
- New Briefly v1 architecture is scaffolded in workspace packages and is ready for implementation.

## Monorepo layout

```text
apps/
  site/                 # target home for zacksimon.dev frontend (migration pending)
  admin-briefly/        # Briefly admin frontend (Vite + TS scaffold)
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
  - `*_daily_inputs`
  - `*_drafts`
  - `*_posts`
  - `*_workflow_runs`
- Bedrock generation
- Human review before publish (no auto-publish)

## Workspace commands

From repo root:

```bash
npm install
npm run typecheck
npm run build
```

Briefly dev infra checks/deploy:

```bash
npm run briefly:dev:typecheck
npm run briefly:dev:synth
# deploy only when explicitly requested
npm run briefly:dev:deploy
npm run briefly:dev:outputs
```

Run deploy smoke for existing site:

```bash
npm run smoke:deploy
```

Run Briefly API smoke checks:

```bash
API_BASE=https://<briefly-api-id>.execute-api.<region>.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly
```

## Existing production deploy (unchanged)

Site deploy still syncs root static files to S3 + CloudFront invalidation via `.github/workflows/deploy.yml`.

## Branch and workflow model

- `main` = stable integration branch
- `briefly-dev` = active development branch for ongoing Briefly work

Workflow and guardrails docs:

- `AGENTS.md` (working contract for future Codex sessions)
- `PLANS.md` (execution-plan template)
- `docs/dev-workflow.md` (lightweight branch/commit/validation process)

## Notes

- `apps/site` is intentionally a placeholder while we complete phased migration from root static files.
- CDK stack is scaffolded to provision Cognito, API, Lambdas, Step Functions, and DynamoDB for Briefly v1.
- Briefly AWS provisioning is dev-only right now and isolated from live-site deploy behavior.
- Detailed architecture notes: `docs/briefly-v1-architecture.md`.
- Dev deploy runbook: `docs/briefly-dev-deploy.md`.
