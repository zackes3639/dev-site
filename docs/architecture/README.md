# Architecture diagrams

Hand-maintained SVG diagrams of the current system. They are documentation, not deployed assets — `docs/*` is excluded from the S3 sync in `.github/workflows/deploy.yml`, so nothing here ships to the live site.

## Files and what each one owns

| Diagram | Owns | Update when you change... |
|---------|------|---------------------------|
| `site-serving-and-deploy.svg` | GitHub `origin/main` → GitHub Actions (`deploy.yml`, OIDC) → S3 sync + CloudFront invalidation; visitor → CloudFront (Lambda@Edge password gate) → S3 | the deploy workflow, CloudFront/S3 serving, or the site-access gate |
| `legacy-backend-data-flow.svg` | Public pages (`blog.js`, subscribe forms) → read API Gateway; `/admin/` → write API Gateway; Lambdas → `ZS_DEV_BLOG_POSTS`, subscribers table, `briefly_post_slugs` | legacy API routes, Lambdas, or the DynamoDB tables they touch |
| `briefly-publishing-pipeline.svg` | Briefly admin UI (Cognito) → Briefly HTTP API (JWT) → Step Functions + Lambda → Bedrock (Nova Pro) → human review → publish Lambda → dual write to `briefly_posts` + `ZS_DEV_BLOG_POSTS` | the Briefly stack (`infra/cdk`), generation/publishing services, or the publish integration with the legacy blog |
| `build-log-newsletter-delivery.svg` | Build Log post detector → campaigns table → admin review/test send → SES email → delivery logs, subscribers, unsubscribe suppression | newsletter delivery jobs, campaigns/delivery log tables, SES provider behavior, unsubscribe handling, or newsletter admin smoke expectations |

Facts in the diagrams must match `TECHSTACK.md` — that doc is the source of truth; these are its pictures.

## Update rule (agent contract)

When a change alters architecture or data flow shown above, update the affected diagram in the same change, and log it in `CHANGELOG.md` like any other doc update. If a change makes a diagram wrong and you can't fix it in the same change, say so explicitly in the handoff and record it in `OPEN_BUGS.md`.

## Editing conventions

The SVGs are plain hand-editable markup — no build step, no external fonts. Keep them that way:

- Canvas is 680px wide; height flexes to content plus a legend row at the bottom. Keep content inside x=40..640 with a white background rect sized to the viewBox.
- Boxes are 56px tall, `rx="8"`, `stroke-width="0.5"`, with a 14px/500 title and a 12px subtitle centered via `text-anchor="middle" dominant-baseline="central"` (title at rect y+18, subtitle at y+36). Size width to the longest label: roughly 8px per title character plus 24px padding.
- Colors encode role, defined in each file's `<style>` block: gray = people/external/browser, purple = AWS compute (API Gateway, Lambda, CloudFront, Step Functions), teal = storage (S3, DynamoDB), coral = AI model (Bedrock). Apply by wrapping box + labels in `<g class="c-gray|c-purple|c-teal|c-coral">`. Every diagram carries a one-line legend for the roles it uses.
- Arrows use `class="arr"` with `marker-end="url(#arrow)"`, stopping ~10px short of the target box. Route around boxes with L-shaped `<path>` segments (`fill="none"`) rather than crossing them. Leave 60px between rows so arrows have room.
- Keep `<title>`/`<desc>` accurate — they are the accessible summary and double as a plain-text description of the diagram.
- If a flow outgrows one diagram (roughly 8+ boxes), split it into a new file and add it to the table above rather than cramming.
