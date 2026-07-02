# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

- No known open issues after the 2026-07-02 bug-fix pass and AWS deployment verification.

## Recently closed

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
