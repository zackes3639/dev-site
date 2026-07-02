# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

- Public post/build list Lambdas only read the first DynamoDB scan page. `lambda/get_posts.py` calls `table.scan()` once before filtering/sorting posts, and `lambda/get_builds.py` does the same for builds. Once either table scan exceeds 1 MB, older posts/builds can silently disappear from `/blog/`, `/blog/post/`, `/admin/`, and `/work/`. Paginate with `LastEvaluatedKey` before filtering/sorting.
- Newsletter subscribe API still accepts phone-only records and optional `age`, even though current public forms and docs make email required, phone optional, and age uncollected. `lambda/subscribe.py` allows `email or phone`, validates/stores `age`, and writes it. Align the API with the current consent/data-minimization contract and consider cleanup for any prior phone-only/age records.
- Public Lambda 500 responses expose raw exception strings. `lambda/get_posts.py`, `lambda/get_builds.py`, and `lambda/subscribe.py` include `str(e)` in public response bodies. Return generic client errors and log details server-side instead.
- Briefly admin renders API/DynamoDB values with `innerHTML`. `apps/admin-briefly/src/main.ts` builds draft metadata and slug-conflict messages with template strings. Replace these paths with DOM text nodes or explicit escaping before expanding admin use or rendering less-trusted fields.
- Static-site deploy sync can upload root project docs to the site bucket. `.github/workflows/deploy.yml` excludes `docs/` and `CLAUDE.md`, but not root docs such as `AGENTS.md`, `BRAND.md`, `DESIGN.md`, `OPEN_BUGS.md`, `TECHSTACK.md`, `VOICE.md`, `CHANGELOG.md`, `HANDOFF.md`, `PLANS.md`, or `README.md`. Prefer an allowlisted deploy artifact or explicitly exclude non-site root docs before the site is intended to be broadly public.

## Recently closed

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
