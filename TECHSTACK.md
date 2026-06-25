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
- The deployed live create-post Lambda currently uses `lambda/create-post.js`; `lambda/create_post.py` is a Python variant kept in the repo.
- Live site deploy syncs root static files to S3 and invalidates CloudFront.

## CI/CD and AWS

- AWS CLI is available locally and has been verified with `aws sts get-caller-identity`.
- GitHub Actions workflow: `.github/workflows/deploy.yml`.
- Pushes to `main` trigger static-site deploy to S3 + CloudFront invalidation.
- Workflow uses GitHub OIDC via `aws-actions/configure-aws-credentials`.
- Lambda deploys are manual unless a task explicitly adds automation.

## Briefly stack

- Briefly is in progress and deployed to AWS as `BrieflyV1Stack` as of 2026-06-25.
- Briefly API URL: `https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com/`.
- Briefly Cognito user pool: `us-east-2_0hhgJcr4h`.
- Briefly Cognito app client: `436n9qucieqcg55k6ufv7nr9s6`.
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
  - `briefly_post_slugs`
  - `briefly_workflow_runs`
- Briefly publish writes approved posts to both `briefly_posts` and the legacy live blog table (`ZS_DEV_BLOG_POSTS`) so published drafts appear in the current Build Log.
- Briefly publish uses `briefly_post_slugs` as the transactional slug uniqueness lock.
- Legacy admin blog writes still use legacy-table scans and do not yet share the Briefly slug-lock table.

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

Briefly API smoke checks, once an admin JWT is available:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly
```

## Integration boundaries

- Current public blog reads from the legacy posts API in `assets/js/blog.js`.
- Briefly publish writes a legacy-compatible public post item with `content`, `created_at`, and `published` fields.
- Briefly publish returns the current public route shape: `/blog/post/?slug=...`.
- Do not change live-site deployment behavior without explicit user approval.
