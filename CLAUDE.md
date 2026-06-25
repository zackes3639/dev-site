# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first: agent contract

`AGENTS.md` is the mandatory working contract for this repo. Before changing code, read it and the task-relevant sub-instruction docs:

- `TECHSTACK.md` — current architecture, deploy model, commands, integration boundaries.
- `OPEN_BUGS.md` — known bugs/risks/review findings that should influence implementation.
- `DESIGN.md`, `BRAND.md`, `VOICE.md` — UI/layout/accessibility, product identity, and writing style. Read these for any UI or content change.

Default rule: code changes → read `TECHSTACK.md` + `OPEN_BUGS.md`. UI/content changes → also read `DESIGN.md`, `BRAND.md`, `VOICE.md`.

Documentation discipline (from `AGENTS.md`): when a change touches design/brand/voice/tech-stack/deploy/known-risks, update the matching sub-doc in the same change; record found/fixed/deferred bugs in `OPEN_BUGS.md`; log meaningful behavior/doc/process changes in `CHANGELOG.md`. Use `PLANS.md` for active multi-step execution plans.

## Repository shape

This is a monorepo holding two things:

1. **The live site (`zacksimon.dev`)** — pure static HTML/CSS/JS at the repo root, deployed directly to S3/CloudFront. No build step. Its Python/Node Lambdas live in `lambda/`.
2. **Briefly** — an in-progress TypeScript app (admin UI + serverless backend) that generates and publishes Build Log posts. **Not yet deployed to AWS.** Lives in npm workspaces:

```text
apps/admin-briefly/   # Briefly admin frontend (Vite + TS)
apps/site/            # placeholder for a future migration of the root static site
services/api/         # Briefly HTTP API Lambda handlers (TS)
services/generation/  # Bedrock draft-generation Lambda (TS)
services/publishing/  # publish-draft Lambda (TS)
services/site-auth/   # site-access-gate Lambda (password gate, JS)
packages/contracts/   # shared API/data contracts + JSON Schema / OpenAPI
packages/shared/      # shared utils (ids, logger, http response)
infra/cdk/            # AWS CDK stack for Briefly v1 (BrieflyV1Stack)
edge/                 # site-access-gate.js (CloudFront edge gate)
scripts/              # smoke tests, deploy helpers, guest-password rotation
```

Default posture: **protect live-site stability while iterating on Briefly.** Keep Briefly changes isolated. Do not refactor the public site structure or change live-site deploy behavior unless explicitly told to.

## Commands

Workspace commands run from repo root and fan out across all workspaces:

```bash
npm install
npm run typecheck   # tsc --noEmit across workspaces
npm run build       # tsc / vite build across workspaces
npm test            # workspace tests, if present
```

Per-workspace work: `npm run <script> -w <name>` (e.g. `npm run dev -w @briefly/admin-briefly` to start the Vite admin UI, `npm run typecheck -w @briefly/api`). CDK: `npm run cdk:synth` / `npm run cdk:deploy` in `infra/cdk`.

Smoke tests:

```bash
npm run smoke:deploy    # checks live site + public/write APIs (scripts/smoke-test.sh)
npm run smoke:briefly   # Briefly API checks; needs API_BASE + ADMIN_BEARER_TOKEN
```

Run `npm run typecheck` and `npm run build` after meaningful TS changes. In handoff summaries, state file-by-file changes, validation results, and explicit AWS deployment status (`AWS deployment was run` / `... was NOT run`).

## Live site deployment

No build step — static files sync directly to S3.

```bash
aws s3 sync . s3://dev-site-647932856401-us-east-2-an \
  --exclude ".git/*" --exclude ".github/*" --exclude ".claude/*" \
  --exclude "lambda/*" --exclude "node_modules/*" --exclude ".DS_Store" --delete

aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

CI/CD: pushing to `main` triggers `.github/workflows/deploy.yml`, which syncs to S3 and invalidates CloudFront via GitHub OIDC (secrets: `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `AWS_ROLE_ARN`, `AWS_REGION`). **Lambda deploys are manual** — zip and upload via Console/CLI; source lives in `lambda/`.

## Live site backend (legacy)

Static site (S3 + CloudFront) with a serverless backend on API Gateway + Lambda + DynamoDB.

**Public API base:** `https://33o1s2l689.execute-api.us-east-2.amazonaws.com`

| Route | Lambda | Purpose |
|-------|--------|---------|
| `GET /posts` | `get_posts.py` | All published posts, newest-first. Admin listing via `?include_drafts=1` + `X-Admin-Password` header |
| `POST /posts` | `create-post.js` | Creates a post; requires `password` matching `ADMIN_PASSWORD` |
| `POST /subscribe` | `subscribe.py` | Adds subscriber (email and/or phone) |
| `POST /unsubscribe` | `unsubscribe.py` | Sets subscriber `status` to `inactive` |

There are also build endpoints (`create_build.py`, `update_build.py`, `get_builds.py`, `delete_build.py`) and `update_post.py` / `delete_post.py`.

**Create/write API is a separate API Gateway instance:** `https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts`

The **deployed** create-post Lambda is `lambda/create-post.js` (Node); `lambda/create_post.py` is a Python variant kept in the repo. Public blog reads go through `assets/js/blog.js` against the legacy posts API.

### DynamoDB (live site)

- **`ZS_DEV_BLOG_POSTS`** — PK `post_id` (UUID). Fields: `post_id`, `title`, `slug`, `summary`, `content`, `published` (bool), `created_at` (ISO-8601), `tag`/`tags`.
- **Subscribers** (name from `TABLE_NAME` env) — PK `subscriber_id`, formatted `email#<email>` or `phone#<e164>`. Fields: `email`, `phone`, `age`, `status` (`active`/`inactive`), `source`, `created_at`, `unsubscribed_at`.

### Admin auth & gate

- **Admin write auth:** password-only. The `password` body field (writes) or `X-Admin-Password` header (admin draft listing) is checked against the `ADMIN_PASSWORD` Lambda env var. No sessions/tokens. Admin page: `/admin/`.
- **Site-access gate:** `services/site-auth` + `edge/site-access-gate.js` password-protect the site. Owner/guest passwords live in SSM (`/zacksimon/site/owner-password`, `/zacksimon/site/guest-password`). Rotate the guest password with `npm run guest-password:rotate` (show: `guest-password:show`).

## Briefly backend (in progress, not deployed)

Defined in `infra/cdk/lib/briefly-stack.ts`: API Gateway HTTP API + Cognito JWT admin auth + Lambda + Step Functions + DynamoDB + Bedrock generation. Human review required before publish (no auto-publish).

Briefly tables: `briefly_daily_inputs`, `briefly_drafts`, `briefly_posts`, `briefly_post_slugs`, `briefly_workflow_runs`.

Key integration behaviors:

- **Publish writes to two tables:** `services/publishing` writes approved posts to both `briefly_posts` and the legacy `ZS_DEV_BLOG_POSTS` (with legacy-compatible `content`/`created_at`/`published`) so published drafts appear in the live Build Log. It returns the current public route shape `/blog/post/?slug=...`.
- **Slug uniqueness:** Briefly publish uses `briefly_post_slugs` as a transactional slug lock. Legacy admin write Lambdas do **not** yet share that lock (see `OPEN_BUGS.md` — rare cross-writer duplicate-slug race remains).

## Page structure (live site)

Each page is its own folder as `index.html` (`blog/index.html`, `admin/index.html`, etc.). Page-specific styles use inline `<style>` blocks; shared styles live in `assets/css/style.css`. `blog/post/index.html` is the single post viewer — it reads `?slug=` from the URL, fetches all posts, and matches client-side.

## Conventions

- Phone numbers normalized to E.164 (`+1XXXXXXXXXX`) before storage.
- Slugs are optional at creation but required for the post detail page; auto-generate from title when absent. Slug-uniqueness checks must paginate full table scans (legacy bug — see `OPEN_BUGS.md`).
- `get_posts.py` returns published posts by default; admin listing via `?include_drafts=1` + `X-Admin-Password`.
- CORS: subscribe/unsubscribe/get_posts restricted to `https://zacksimon.dev`; write Lambdas allow `*`. Briefly HTTP API has `corsPreflight` for admin origins.

## Branches

- `main` — stable integration branch.
- `briefly-dev` — active branch for ongoing Briefly work. Merge stable, validated milestones back into `main`. Commit small, scoped milestones; don't bundle unrelated changes.
