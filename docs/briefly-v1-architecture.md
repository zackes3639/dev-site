# Briefly v1 Architecture

This document captures the v1 Briefly stack on top of zacksimon.dev.

## Selected stack

- Monorepo + TypeScript
- API Gateway + Lambda
- DynamoDB
- Bedrock
- Human review before publish
- Private Vite admin hosted at `/admin/briefly/`

## Workflow

1. Admin submits daily 3-bullet input.
2. Generation workflow creates a draft.
3. Draft is reviewed/edited by human.
4. Human explicitly publishes to Build Log.
5. Posts become source corpus for future Briefly summarization features.

## Auth and hosting

- Site password gate protects `/admin/briefly/`.
- Cognito JWT protects Briefly API calls from the admin UI.
- The Cognito app client allows password-based CLI token minting for v1.
- Hosted admin assets are built from `apps/admin-briefly` and uploaded to `s3://$S3_BUCKET_NAME/admin/briefly/`.
- The admin bundle includes the API base URL only; bearer tokens are pasted at runtime.

## Publish integration

- Briefly publish writes to `briefly_posts`.
- Briefly publish also writes a legacy-compatible item to `ZS_DEV_BLOG_POSTS`.
- Public URLs keep the current shape: `/blog/post/?slug=...`.
- Slug uniqueness for Briefly publishes is locked through `briefly_post_slugs`.
