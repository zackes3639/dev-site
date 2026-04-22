# zacksimon.dev

Personal site — static frontend on S3/CloudFront with a serverless backend on AWS.

## Stack

- **Frontend:** HTML, CSS, vanilla JS — no build step, deployed directly to S3
- **Backend:** AWS API Gateway (HTTP API) + Lambda (Python 3.12) + DynamoDB
- **CI/CD:** GitHub Actions → S3 sync + CloudFront invalidation on push to `main`
- **Lambda deploys:** Manual (zip + upload via CLI or Console)

## Pages

| Path | Description |
|------|-------------|
| `/` | About |
| `/work/` | Builds — Kanban board, rendered dynamically from DynamoDB |
| `/blog/` | The Build Log — blog index |
| `/blog/post/?slug=` | Individual post viewer |
| `/contact/` | Contact |
| `/admin/` | Admin panel — manage Builds board and blog posts |
| `/unsubscribe/` | Email/SMS unsubscribe |

## API

**Public API** (`33o1s2l689.execute-api.us-east-2.amazonaws.com`)

| Route | Lambda | Description |
|-------|--------|-------------|
| `GET /posts` | `get_posts.py` | All published posts, newest-first |
| `GET /builds` | `get_builds.py` | All build cards, sorted by `sort_order` |
| `POST /subscribe` | `subscribe.py` | Add subscriber (email and/or phone) |
| `POST /unsubscribe` | `unsubscribe.py` | Set subscriber status to inactive |

**Write API** (`tblw8hlwu0.execute-api.us-east-2.amazonaws.com`) — password-protected

| Route | Lambda | Description |
|-------|--------|-------------|
| `POST /posts` | `create_post.py` | Create post |
| `PUT /posts/update` | `update_post.py` | Update post |
| `DELETE /posts/delete` | `delete_post.py` | Delete post |
| `POST /builds` | `create_build.py` | Create build card |
| `PUT /builds/update` | `update_build.py` | Update build card |
| `DELETE /builds/delete` | `delete_build.py` | Delete build card |

## DynamoDB Tables

**`ZS_DEV_BLOG_POSTS`** — PK: `post_id` (String)
Fields: `title`, `slug`, `summary`, `content`, `published`, `created_at`, `tag`

**`ZS_DEV_BUILDS`** — PK: `build_id` (String)
Fields: `title`, `description`, `status` (`live`/`wip`/`idea`), `tags`, `link`, `link_label`, `progress`, `dim`, `sort_order`, `created_at`

## Deploy

**Site (automatic):** push to `main` — GitHub Actions handles S3 sync and CloudFront invalidation.

**Site (manual):**
```bash
aws s3 sync . s3://dev-site-647932856401-us-east-2-an \
  --exclude ".git/*" --exclude ".github/*" --exclude ".claude/*" \
  --exclude "lambda/*" --exclude "node_modules/*" --exclude ".DS_Store" --delete

aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

**Lambda:** zip the file in `lambda/` and upload via Console or CLI.
