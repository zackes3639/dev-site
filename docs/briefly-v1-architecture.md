# Briefly v1 Architecture

This document captures the v1 Briefly stack on top of zacksimon.dev.

## Selected stack

- Monorepo + TypeScript
- API Gateway + Lambda
- DynamoDB
- Bedrock
- Human review before publish
- Vite admin hosted at `/admin/briefly/`

## Workflow

1. Admin submits daily 3-bullet input.
2. Generation workflow creates a draft.
3. Draft is reviewed/edited by human.
4. Human explicitly publishes to Build Log.
5. Posts become source corpus for future Briefly summarization features.

## Auth and hosting

- `/admin/briefly/` is directly reachable as a static shell.
- Cognito JWT protects Briefly API calls from the admin UI.
- The Cognito app client allows `USER_PASSWORD_AUTH` for hosted admin sign-in and CLI token minting for v1 smoke/fallback use.
- Hosted admin assets are built from `apps/admin-briefly` and uploaded to `s3://$S3_BUCKET_NAME/admin/briefly/`.
- The admin bundle includes the API base URL only. Normal use signs in with Cognito email/password at runtime and stores only the resulting ID token in sessionStorage; raw ID-token paste remains a fallback, and the client adds the `Bearer` prefix for API calls.

## Publish integration

- Briefly publish writes to `briefly_posts`.
- Briefly publish also writes a legacy-compatible item to `ZS_DEV_BLOG_POSTS`.
- Public URLs keep the current shape: `/blog/post/?slug=...`.
- Slug uniqueness for Briefly publishes and legacy blog writers is locked through `briefly_post_slugs`.
- Legacy update/delete only manage legacy-owned locks and refuse Briefly-owned public rows.
