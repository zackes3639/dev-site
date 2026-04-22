# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

There is no build step. The site is pure HTML/CSS/JS deployed directly to S3.

**Deploy to S3 (manual):**
```bash
aws s3 sync . s3://dev-site-647932856401-us-east-2-an \
  --exclude ".git/*" --exclude ".github/*" --exclude ".claude/*" \
  --exclude "lambda/*" --exclude "node_modules/*" --exclude ".DS_Store" --delete
```

**Invalidate CloudFront cache:**
```bash
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

CI/CD: pushing to `main` triggers `.github/workflows/deploy.yml`, which syncs to S3 and invalidates CloudFront using GitHub OIDC (secrets: `S3_BUCKET_NAME`, `CLOUDFRONT_DISTRIBUTION_ID`, `AWS_ROLE_ARN`, `AWS_REGION`).

**Lambda deploys** are manual — zip and upload via AWS Console or CLI. Lambda source lives in `lambda/`.

## Architecture

Static site (S3 + CloudFront) with a serverless backend on AWS API Gateway + Lambda + DynamoDB.

**API base URL:** `https://33o1s2l689.execute-api.us-east-2.amazonaws.com`

| Route | Lambda | Purpose |
|-------|--------|---------|
| `GET /posts` | `get_posts.py` | Returns all published posts, sorted newest-first |
| `POST /posts` | `create_post.py` | Creates a post; requires `password` field matching `ADMIN_PASSWORD` env var |
| `POST /subscribe` | `subscribe.py` | Adds subscriber to DynamoDB; accepts email and/or phone |
| `POST /unsubscribe` | `unsubscribe.py` | Sets subscriber `status` to `inactive` |

**Create-post has a separate API Gateway instance:** `https://tblw8hlwu0.execute-api.us-east-2.amazonaws.com/posts`

## DynamoDB Tables

**`ZS_DEV_BLOG_POSTS`** — partition key: `post_id` (UUID string)
Fields: `post_id`, `title`, `slug`, `summary`, `content`, `published` (bool), `created_at` (ISO-8601), `tag`/`tags` (optional)

**Subscribers table** (name from `TABLE_NAME` env var) — partition key: `subscriber_id`
Format: `email#<email>` or `phone#<e164>`. Fields: `email`, `phone`, `age`, `status` (`active`/`inactive`), `source`, `created_at`, `unsubscribed_at`

## Page Structure

Each page lives in its own folder as `index.html` (e.g. `blog/index.html`, `admin/index.html`). Inline `<style>` blocks are used for page-specific styles; `assets/css/style.css` holds shared styles.

`blog/post/index.html` is the single post viewer — it reads `?slug=` from the URL, fetches all posts, and finds the match client-side.

## Admin Auth

Password auth only — the `password` field in the POST body is checked against the `ADMIN_PASSWORD` Lambda environment variable. No sessions or tokens. The admin page is at `/admin/`.

## Key Conventions

- Phone numbers are normalized to E.164 (`+1XXXXXXXXXX`) before storage.
- Slugs are optional at creation but required for the post detail page to work. Auto-generate from title if not provided.
- `get_posts.py` filters to `published == True` only; unpublished posts are never returned to the public.
- CORS on subscribe/unsubscribe is restricted to `https://zacksimon.dev`; create_post/get_posts use `*`.
