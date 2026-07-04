# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

- 2026-07-02: SES production access blocks real Build Log subscriber sends. SES identities are verified and email v1 now has campaign detection, admin review/test-send, tokenized unsubscribe links, delivery logging, and a hard `NEWSLETTER_PUBLIC_SENDS_ENABLED=false` public-send gate. Public subscriber blasts must stay disabled until SES production access is approved and a no-blast/live-read smoke passes. SMS remains phase 2.
- 2026-07-02: Briefly publish status enforcement needs a product decision. The API/OpenAPI/docs describe publishing an approved draft, but `services/publishing/src/handlers/publishDraft.ts` currently accepts both `approved` and `pending_review` drafts as long as a human submits the publish request. Decide whether v1 intentionally allows one-step review+publish, or tighten the service/UI to require a saved `approved` status before publishing. AWS deployment was NOT run.

## Recently closed

- 2026-07-04: Fixed the oversized Apple/iOS link preview card after adding the
  root touch icon. Public pages now omit the large `og:image` hint so compact
  hyperlink pills can use `/apple-touch-icon.png` as the small logo slot instead
  of rendering the logo as a card-sized hero image. This is a static metadata
  fix covered by the normal GitHub Actions deploy/smoke workflow.
- 2026-07-04: Fixed the route rewrite regression discovered while removing the
  CloudFront site password gate. A detach-only deploy made pretty directory URLs
  such as `/work/`, `/blog/`, and `/admin/briefly/` return S3 `403`; the active
  deploy now replaces the former gate with a rewrite-only Lambda@Edge public
  router, and deploy smoke verifies those public routes directly.
- 2026-07-04: Fixed iOS-style hyperlink/icon surfaces missing the site logo by
  adding the conventional root `/apple-touch-icon.png` asset, pointing all
  public page `apple-touch-icon` tags at it with `sizes="180x180"`, and updating
  the manifest to use that path. GitHub Actions deployed this from `origin/main`
  on 2026-07-04 (deploy + smoke passed after the route-rewrite repair).
- 2026-07-04: Fixed Briefly admin's cryptic expired-session failure. The admin
  client now detects expired stored Cognito ID tokens, clears rejected session
  tokens after API `401` responses, and shows sign-in-again guidance instead of
  `Unauthorized [401/api_error]`. GitHub Actions deployed this from
  `origin/main` on 2026-07-04 (deploy + smoke passed).
- 2026-07-02: Fixed the Classic Amber header lockup descriptor being too small
  to read at desktop nav size. The lockup SVG descriptor is larger, the desktop
  header renders the full lockup at 56px high, and tight breakpoints still use
  the badge-only fallback. GitHub Actions deployed this from `origin/main` on
  2026-07-02 (deploy + smoke passed).
- 2026-07-02: Fixed homepage Build Log copy that implied newsletter digest delivery already exists. The public copy now reflects the current Lambda/DynamoDB subscriber-capture state while SMS/newsletter delivery remains a backlog item in `IDEAS.md`. GitHub Actions deployed this from `origin/main` on 2026-07-02 (deploy + smoke passed).
- 2026-07-01: Closed the missing-browser-metadata gap: no page had favicon, web
  manifest, theme-color, or social (OG/Twitter) meta tags. All live-site pages
  now share the Classic Amber icon/meta block; `site.webmanifest` gets an
  explicit content type in the deploy workflow. GitHub Actions deployed this
  from `origin/main` on 2026-07-02 (deploy + smoke passed; S3 serves
  `site.webmanifest` as `application/manifest+json`).

- 2026-07-02: Fixed public post/build list scan truncation. `lambda/get_posts.py` and `lambda/get_builds.py` now paginate DynamoDB scans with `LastEvaluatedKey` before filtering/sorting. AWS deployment was run and live posts/builds API checks passed.
- 2026-07-02: Fixed newsletter subscribe API contract. `lambda/subscribe.py` now requires email, keeps phone optional, ignores/does not store `age`, and uses email-based subscriber IDs only. AWS deployment was run and live phone-only/invalid-JSON checks returned 400.
- 2026-07-02: Fixed raw public Lambda 500 leakage. `lambda/get_posts.py`, `lambda/get_builds.py`, and `lambda/subscribe.py` now log server-side details and return generic 500 bodies. AWS deployment was run.
- 2026-07-02: Fixed Briefly admin unsafe HTML rendering. Draft metadata and slug-conflict UI now use DOM nodes/text content instead of template-string `innerHTML`. GitHub Actions deployed the static/admin assets from `origin/main`.
- 2026-07-02: Fixed static-site deploy doc leakage risk. `.github/workflows/deploy.yml` now excludes root repo docs such as `AGENTS.md`, `OPEN_BUGS.md`, `TECHSTACK.md`, `CHANGELOG.md`, `HANDOFF.md`, `PLANS.md`, `README.md`, and `IDEAS.md`. GitHub Actions deployed the updated sync workflow from `origin/main`.
- 2026-06-28: Fixed public-site hanging/wrapped text issues found in browser QA. Home hero headings now balance without orphaning `to.`, newsletter phone placeholders no longer clip in the rail, consent policy links no longer stack word-by-word, and visible card/post/privacy/contact/unsubscribe copy was tightened to avoid one-word tails.
- 2026-06-28: Fixed public-site navbar active-link geometry shift. Nav links now reserve indicator space on every item, so selecting the longer "The Build Log" label does not visually change the nav footprint.
- 2026-06-28: Closed stale public Builds API CORS finding after `npm run smoke:deploy` and direct `curl -H 'Origin: https://zacksimon.dev' https://33o1s2l689.execute-api.us-east-2.amazonaws.com/builds` both confirmed `Access-Control-Allow-Origin: https://zacksimon.dev`.
- 2026-06-28: Fixed public-site navbar top-edge clipping. The sticky header now starts below the viewport edge/safe area, while the compact scroll pill keeps its existing floating offset.
- 2026-06-26: Fixed public Builds board stale-card flash. The old hardcoded cards were removed from the initial HTML; JS users now see loading until current API data renders, while no-JS/API-error states show neutral unavailable messages.
- 2026-06-25: Fixed cross-writer live-blog slug uniqueness. Legacy create/update/delete paths now participate in the shared `briefly_post_slugs` lock table, while only releasing locks marked `source=legacy_blog`.
- 2026-06-25: Fixed legacy-admin split-brain risk for Briefly-owned public posts. Legacy update/delete now refuse rows whose shared slug lock belongs to Briefly.
- 2026-06-25: Fixed Briefly generation failure from the retired Claude 3.5 Sonnet Bedrock model. Generation now uses Bedrock Converse with Amazon Nova Pro (`us.amazon.nova-pro-v1:0`), avoiding the Anthropic use-case form dependency that blocked Claude Sonnet 4.6 from the Lambda role.
- 2026-06-25: Fixed public-site mobile nav overflow. Below 760px the overflowing horizontally-scrolling pill nav (`.hotbar`) is hidden and replaced by a compact header + accessible menu drawer (built in `assets/js/script.js`, styled in `assets/css/style.css`). Drawer is keyboard-friendly (`aria-expanded`, focus trap, Escape) and falls back to the existing hotbar without JS.
- 2026-06-25: Fixed inverted public-site type hierarchy. `--h1-fluid` was smaller than `--h2-fluid` and headlines were forced `white-space: nowrap` with shrinking mobile font overrides. Redefined the type tokens so H1 leads, added a grotesk display face, and removed the nowrap hacks.
- 2026-06-25: Reduced newsletter signup friction. Removed the required age dropdown from all frontend forms (`index.html`, `blog/index.html`, `blog/post/index.html`, `post-template.html`, both static blog posts), made email required, marked phone optional, clarified email + optional SMS consent copy, and stopped sending `age` from `assets/js/subscribe.js`.
- 2026-06-25: Fixed Briefly publish visibility by writing published drafts to both `briefly_posts` and the legacy live blog table, returning the current `/blog/post/?slug=...` URL.
- 2026-06-25: Fixed legacy admin draft listing password leakage by moving the admin password from the query string to the `X-Admin-Password` request header.
- 2026-06-25: Fixed legacy blog slug duplicate checks by paginating slug scans in create and update Lambdas.
- 2026-06-25: Fixed Briefly publish slug races by adding a transactional `briefly_post_slugs` lock table.
- 2026-06-25: Fixed Briefly generation duplicate starts by making the daily-input transition to `running` conditional and atomic.
- 2026-06-25: Fixed build update phantom records by requiring `attribute_exists(build_id)` on update.
