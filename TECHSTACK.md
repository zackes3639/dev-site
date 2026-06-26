# TECHSTACK.md

Current technical facts for future agents.

## Repository shape

- This is a monorepo containing the live static site and in-progress Briefly work.
- Production static site files currently live at repo root.
- `apps/site` is a placeholder for a later migration.
- `apps/admin-briefly` is a Vite + TypeScript admin UI for Briefly, hosted privately at `/admin/briefly/`.
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
- Local development is for building and validation; GitHub `origin/main` is the stored source of truth.
- GitHub Actions workflow: `.github/workflows/deploy.yml`.
- Pushes/merges to `origin/main` trigger static-site deploy to S3 + CloudFront invalidation.
- The intended operating model is: if work is on `origin/main`, it should be reflected on live `zacksimon.dev`.
- When Zack says `push and merge`, agents should treat that as approval to push/merge to `origin/main` and let the AWS deploy workflow make the change live.
- Workflow uses GitHub OIDC via `aws-actions/configure-aws-credentials`.
- The workflow installs npm dependencies, builds `@briefly/admin-briefly`, syncs root static files, then syncs `apps/admin-briefly/dist` to `s3://$S3_BUCKET_NAME/admin/briefly/`.
- The workflow reads the site owner password from SSM (`/zacksimon/site/owner-password`) after OIDC auth and uses the same value for both site-gate deployment and authenticated deploy smoke.
- The GitHub deploy role needs SSM read/decrypt permissions for that parameter plus narrow permissions to update the existing Lambda@Edge site gate, publish versions, enable replication, and update the CloudFront association.
- Lambda/CDK deploys are not currently automated by `.github/workflows/deploy.yml`; if a `push and merge` task changes those live AWS resources, the task must also run the required deploy/smoke steps or add deployment automation before reporting the change as live.

## Briefly stack

- Briefly v1 is operational as a private hosted admin workflow and deployed to AWS as `BrieflyV1Stack` as of 2026-06-25.
- Briefly API URL: `https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com/`.
- Briefly private admin URL: `https://zacksimon.dev/admin/briefly/`.
- Briefly Cognito user pool: `us-east-2_0hhgJcr4h`.
- Briefly Cognito app client: `436n9qucieqcg55k6ufv7nr9s6`.
- Provisioned services:
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
- Briefly publish and legacy blog writers use `briefly_post_slugs` as the shared slug uniqueness lock.
- Legacy-created slug locks are marked with `source=legacy_blog`; legacy delete/update paths only release legacy-owned locks and refuse to mutate rows whose lock is Briefly-owned.
- Briefly generation uses Bedrock Converse with Amazon Nova Pro via `BEDROCK_MODEL_ID=us.amazon.nova-pro-v1:0`.
- The hosted admin build uses `VITE_BRIEFLY_API_BASE` for the API base only. Raw Cognito ID tokens are pasted into the UI and stored in localStorage; they are not baked into the static build.
- Briefly API CORS allows `https://zacksimon.dev`, `http://localhost:5173`, and `http://localhost:4173`.

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

Full Briefly publish e2e smoke:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly:e2e
```

The e2e smoke publishes a test-prefixed post, verifies public integration, then conditionally deletes the test post and slug lock when AWS CLI access is available. It intentionally leaves Briefly daily-input, draft, and workflow-run audit artifacts for traceability.

Create or reset the first Cognito admin user:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run briefly:admin:ensure-user
```

Mint an ID token for the hosted admin UI or smoke tests:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

Paste the raw token output into the hosted admin. Do not prefix it with `Bearer`; the client adds that prefix.

## Integration boundaries

- Current public blog reads from the legacy posts API in `assets/js/blog.js`.
- Briefly publish writes a legacy-compatible public post item with `content`, `created_at`, and `published` fields.
- Briefly publish returns the current public route shape: `/blog/post/?slug=...`.
- Do not bypass, disable, or weaken the `origin/main` to AWS deployment behavior without explicit user approval.
- The site password gate protects `/admin/briefly/` before the admin UI asks for a Cognito token.
