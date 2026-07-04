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
- `docs/architecture/` holds maintained SVG diagrams of the serving/deploy flow, legacy backend data flow, and Briefly publishing pipeline. They must stay consistent with this doc; update them alongside architecture changes (see `docs/architecture/README.md`).

## Live site stack

- Static HTML/CSS/JavaScript at repo root.
- Shared public CSS: `assets/css/style.css`.
- Existing public backend: API Gateway + Python/Node Lambda + DynamoDB.
- Blog/build Lambda source is under `lambda/`.
- The deployed live create-post Lambda currently uses `lambda/create-post.js`; `lambda/create_post.py` is a Python variant kept in the repo.
- Live site deploy syncs root static site files to S3, excludes repo docs/workspaces/metadata, and invalidates CloudFront.

## Build Log newsletter delivery

- Public Build Log subscriber capture is email-first. Public forms submit required email plus optional phone to the legacy subscribe Lambda; subscriber records are keyed by normalized email and new signups receive `unsubscribe_token`.
- Newsletter delivery v1 is email-first and separate from Briefly publishing. `@briefly/newsletter` owns detector/admin/send handlers. CDK creates `newsletter_campaigns`, `newsletter_deliveries`, a five-minute EventBridge detector schedule, and JWT-protected admin routes under `/v1/newsletter/campaigns`.
- Campaign detection scans `ZS_DEV_BLOG_POSTS` for `published=true` posts and creates exactly one draft campaign per post with `campaign_id=post#<post_id>`. Campaigns never auto-send.
- Admin sends require a saved test send before subscriber delivery. Subscriber sends scan only active records in `ZS_DEV_BLOG_SIGN_UP_DATA`, lazily backfill missing `unsubscribe_token` values, write per-campaign/per-subscriber delivery rows, and render `/unsubscribe/?email=<email>&token=<token>` links. The public unsubscribe Lambda validates the token before marking a subscriber inactive.
- Provider status as of 2026-07-02: SES sender/domain identities are verified, but public subscriber sends remain disabled with `NEWSLETTER_PUBLIC_SENDS_ENABLED=false` until SES production access is approved. Keep blast sends off by default; use explicit admin test-send smoke checks only.
- SES IAM is constrained by `ses:FromAddress=updates@zacksimon.dev` and `ses:FromDisplayName=The Build Log`; it also includes the verified `zacksimon13@gmail.com` identity and `my-first-configuration-set` SES configuration set so sandbox test sends can target Zack without widening the sender.
- SMS is deferred to phase 2. The optional phone field remains useful for later SMS consent, but it is not part of email v1 delivery.
- The maintained delivery diagram is `docs/architecture/build-log-newsletter-delivery.svg`.

## CI/CD and AWS

- AWS CLI is available locally and has been verified with `aws sts get-caller-identity`.
- Local development is for building and validation; GitHub `origin/main` is the stored source of truth.
- GitHub Actions workflow: `.github/workflows/deploy.yml`.
- Pushes/merges to `origin/main` trigger static-site deploy to S3 + CloudFront invalidation.
- The intended operating model is: if work is on `origin/main`, it should be reflected on live `zacksimon.dev`.
- When Zack says `push and merge`, agents should treat that as approval to push/merge to `origin/main` and let the AWS deploy workflow make the change live.
- Workflow uses GitHub OIDC via `aws-actions/configure-aws-credentials`.
- The workflow installs npm dependencies, builds `@briefly/admin-briefly`, syncs root static site files while excluding repo docs/workspaces/metadata, re-uploads `site.webmanifest` with an explicit `application/manifest+json` content type (the runner's mime tables may not know `.webmanifest`), then syncs `apps/admin-briefly/dist` to `s3://$S3_BUCKET_NAME/admin/briefly/`.
- The workflow deploys a rewrite-only Lambda@Edge public router in place of the former password gate, syncs the public static site/admin assets, invalidates CloudFront, and then runs public-access deploy smoke checks.
- The GitHub deploy role needs permission to update the existing edge Lambda and CloudFront distribution so the workflow can keep the password gate removed while preserving pretty-route rewrites.
- Lambda/CDK deploys are not currently automated by `.github/workflows/deploy.yml`; if a `push and merge` task changes those live AWS resources, the task must also run the required deploy/smoke steps or add deployment automation before reporting the change as live.

## Briefly stack

- Briefly v1 is operational as a hosted admin workflow and deployed to AWS as `BrieflyV1Stack` as of 2026-06-25.
- Briefly API URL: `https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com/`.
- Briefly admin URL: `https://zacksimon.dev/admin/briefly/`.
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
- The hosted admin build uses `VITE_BRIEFLY_API_BASE` for the API base only. The UI signs in to Cognito with `USER_PASSWORD_AUTH` at runtime and keeps only the resulting ID token in sessionStorage; no Cognito password, bearer token, or ID token is baked into the static build. API base and admin email may be remembered locally, and a raw token paste field remains as a fallback.
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

Build Log newsletter admin API smoke, once the newsletter admin API base is available:

```bash
NEWSLETTER_API_BASE=https://example.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:newsletter-admin
```

The newsletter smoke does not call real subscriber blast endpoints. Optional SES test-send checks require `NEWSLETTER_ALLOW_TEST_SEND=1`, `NEWSLETTER_TEST_EMAIL`, and `NEWSLETTER_CAMPAIGN_ID`; they send only to the explicit test recipient.

Create or reset the first Cognito admin user:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run briefly:admin:ensure-user
```

Mint an ID token for smoke tests or fallback hosted-admin access:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

For normal hosted-admin use, sign in with the admin email/password in the UI. If using the fallback token field, paste the raw token output into the hosted admin. Do not prefix it with `Bearer`; the client adds that prefix.

## Integration boundaries

- Current public blog reads from the legacy posts API in `assets/js/blog.js`.
- Briefly publish writes a legacy-compatible public post item with `content`, `created_at`, and `published` fields.
- Briefly publish returns the current public route shape: `/blog/post/?slug=...`.
- Do not bypass, disable, or weaken the `origin/main` to AWS deployment behavior without explicit user approval.
- `/admin/briefly/` is directly reachable as a static shell; Briefly API actions remain protected by Cognito JWT auth inside the admin UI.
