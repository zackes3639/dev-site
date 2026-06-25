# TECHSTACK.md

Current technical facts for future agents.

## Repository shape

- This is a monorepo containing the live static site and in-progress Briefly work.
- Production static site files currently live at repo root.
- `apps/site` is a placeholder for a later migration.
- `apps/admin-briefly` is a Vite + TypeScript admin UI for Briefly.
- `services/api`, `services/generation`, and `services/publishing` are TypeScript Lambda workspaces.
- `packages/contracts` and `packages/shared` hold shared contracts/utilities.
- `infra/cdk` contains the Briefly CDK stack.

## Live site stack

- Static HTML/CSS/JavaScript at repo root.
- Shared public CSS: `assets/css/style.css`.
- Existing public backend: API Gateway + Python/Node Lambda + DynamoDB.
- Blog/build Lambda source is under `lambda/`.
- Live site deploy syncs root static files to S3 and invalidates CloudFront.

## CI/CD and AWS

- AWS CLI is available locally and has been verified with `aws sts get-caller-identity`.
- GitHub Actions workflow: `.github/workflows/deploy.yml`.
- Pushes to `main` trigger static-site deploy to S3 + CloudFront invalidation.
- Workflow uses GitHub OIDC via `aws-actions/configure-aws-credentials`.
- Lambda deploys are manual unless a task explicitly adds automation.
- Do not deploy unless explicitly instructed.

## Briefly stack

- Briefly is in progress and not deployed to AWS as of this doc update.
- Planned/scaffolded services:
  - API Gateway HTTP API
  - Cognito JWT admin auth
  - Lambda
  - Step Functions
  - DynamoDB
  - Bedrock generation
- Briefly tables in CDK:
  - `briefly_daily_inputs`
  - `briefly_drafts`
  - `briefly_posts`
  - `briefly_workflow_runs`

## Commands

From repo root:

```bash
npm run typecheck
npm run build
npm test
```

Deploy smoke test for current live site:

```bash
npm run smoke:deploy
```

Briefly API smoke checks, once deployed/configured:

```bash
API_BASE=https://<briefly-api-id>.execute-api.<region>.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly
```

## Integration boundaries

- Current public blog reads from the legacy posts API in `assets/js/blog.js`.
- Briefly publish currently writes to the separate `briefly_posts` table, not the live blog API.
- Do not assume a Briefly-published draft appears on the public site until that integration is explicitly implemented.
- Do not change live-site deployment behavior without explicit user approval.
