# CHANGELOG.md

All notable repo-contract, documentation, deployment-process, and project-behavior changes should be recorded here.

## Unreleased

### Added

- Implemented the "Classic Amber" logo system across the public site: new
  graphite badge + amber-sliced `Z` mark (`assets/brand/*.svg`, generated
  vector-path lockups with no webfont dependency), `favicon.ico`,
  `zs-icon-180.png`/`zs-icon-512.png`, and `site.webmanifest`. Every live-site
  page now carries an identical favicon/manifest/theme-color block plus basic
  per-page Open Graph/Twitter meta. The header logo is the full lockup (linked
  to `/`) with a badge-only fallback in the compact pill, the 761–900px band,
  and ≤480px viewports; the old `assets/images/logo.svg` chip and
  `.logo-wordmark` span were retired. Added `--zs-*` brand tokens and pointed
  `--gold` at the logo amber `#F59E0B` (was `#f4a93b`) so site amber matches
  the mark. The deploy workflow re-uploads `site.webmanifest` with an explicit
  `application/manifest+json` content type. Briefly admin (`apps/admin-briefly`)
  intentionally untouched.

### Changed

- Reconciled repo documentation with the current Briefly/admin/deploy state after the 2026-07-02 production bug-fix deploy.
- Cleared stale active-plan language from `PLANS.md` so future agents start from an accurate no-active-plan state.
- Updated Briefly auth, subscriber-contract, architecture, and handoff docs so Cognito email/password sign-in is the normal admin path and raw ID-token paste is fallback/smoke-only.
- Documented Zack's approval rule: approved local changes should be committed, pushed to `origin/main`, and deploy-verified unless explicitly held locally.

## 2026-07-02

### Added

- Added `IDEAS.md` as a parking lot for later product, engineering, marketing, sales, and business-producing ideas.
- Added hosted Briefly admin Cognito email/password sign-in so normal admin use no longer requires manually minting and pasting an ID token.
- Redesigned the public-site navbar across all pages: replaced the boxed
  equal-width button group with a clean brand wordmark (`Zack Simon`) + a new
  static terminal-caret logo mark (navy chip, lowercase `zs`, amber cursor) +
  right-aligned text links (amber active dot) + an amber `Subscribe` CTA pill.
  Preserved the sticky scroll-compact pill and the accessible mobile drawer
  (drawer now also surfaces the Subscribe CTA); hardened the drawer's Admin-link
  lookup to a `.nav-admin` selector.
- Added an amber/gold secondary accent (`--gold`/`--gold-strong`/`--gold-ink`/
  `--gold-wash`/`--surface-gold`) paired with the existing purple action color.
  Purple stays the single primary-action color; amber is energy/highlight only
  (secondary CTAs, eyebrow ticks, headline marker, tinted surfaces, Build Log
  tag chips, the "In Progress" board column). Applied site-wide via shared
  classes (`.secondary`, `.v2-eyebrow`, `.v2-trip-card`, `.v2-subscribe-rail`,
  `.footer`, `.v2-tag-chip`) plus the Builds kanban column heads/badges.
- Added the "Workbench Clean" public-site visual system: unified CSS design
  tokens (palette, typography, radii, shadows), a grotesk display headline face,
  monospace labels/chips, and a subtle white-canvas grid texture.
- Added an accessible mobile navigation drawer (compact header + menu button)
  that replaces the overflowing pill nav below 760px, with `aria-expanded`,
  focus trapping, Escape-to-close, and a no-JS hotbar fallback.
- Added hosted Briefly admin deployment workflow for `/admin/briefly/`.
- Added Cognito admin user/token helper scripts for Briefly v1.
- Added deploy smoke checks for the hosted Briefly admin page and assets.
- Added `.env*` git ignores to reduce accidental local secret commits.
- Added root sub-instruction docs for future agents: `DESIGN.md`, `BRAND.md`, `VOICE.md`, `TECHSTACK.md`, and `OPEN_BUGS.md`.
- Added `CHANGELOG.md` as the canonical place to record meaningful repo documentation and behavior changes.
- Added Briefly HTTP API CORS preflight configuration for admin browser requests.
- Added the `briefly_post_slugs` table as a transactional slug uniqueness lock for Briefly publishes.
- Added `smoke:briefly:e2e` for automated create/generate/update/publish verification with test-post cleanup.

### Changed

- Fixed public post/build list Lambda source to paginate DynamoDB scans before filtering/sorting, avoiding first-page-only truncation when tables exceed the scan page size.
- Aligned the newsletter subscribe Lambda with the current form contract: email is required, phone is optional, `age` is no longer stored, and new subscriber records are email-keyed only.
- Changed public Lambda 500 responses in `get_posts`, `get_builds`, and `subscribe` to return generic client bodies while logging server-side details.
- Replaced unsafe Briefly admin `innerHTML` rendering for draft metadata and slug-conflict messages with DOM node/text rendering.
- Added root documentation excludes to the static-site deploy sync so repo contracts/backlogs are not uploaded to the public site bucket.
- Replaced the stale hosted-admin launch plan in `PLANS.md` with the active 2026-07-02 bug-fix execution plan.
- Balanced public-site display headings, tightened newsletter form text, and cleaned up visible card/post/privacy/contact/unsubscribe copy so rendered text no longer hangs or clips across desktop, tablet, and mobile viewports.
- Stabilized public-site navbar active-link geometry so the active indicator no longer changes the apparent nav footprint when The Build Log is selected.
- Updated `OPEN_BUGS.md` with the 2026-06-28 comprehensive review findings and closed the stale Builds API CORS item after deploy smoke/direct curl validation confirmed the header is present.
- Fixed public-site navbar top-edge clipping by adding a safe top offset to the full sticky header while preserving the existing scroll-compact pill behavior.
- Changed the public Builds board boot state so JS users see loading placeholders until the current API data renders; the old hardcoded fallback cards were replaced with neutral unavailable messages for no-JS/API-error states.
- Kept the raw Cognito ID-token field as a fallback while making browser-side Cognito sign-in the primary hosted-admin auth flow. Passwords are not stored; only the resulting ID token is kept in browser session storage.
- Documented the main-only GitHub workflow: build/validate locally, store source
  in `origin/main`, and treat `push and merge` as approval to deploy live
  through the AWS GitHub Actions workflow, with explicit deploy/smoke handling
  required for Lambda/CDK changes outside the current workflow.
- Changed the GitHub deploy workflow to read the site owner password from SSM instead of requiring a duplicate `SITE_ACCESS_PASSWORD` GitHub secret.
- Changed deploy smoke to use the same SSM-loaded site password as the deployed site password gate.
- Changed Briefly publish e2e smoke cleanup to condition deletes on the returned test post id, slug, and title prefix, while retaining internal Briefly audit artifacts.
- Fixed the public-site type hierarchy so H1 leads (H1 > H2); removed the inverted
  scale and the `white-space: nowrap` headline hacks.
- Reduced newsletter signup friction: removed the age dropdown from every frontend
  form, made email required and phone optional, clarified email + optional SMS
  consent copy, and stopped sending `age` from `assets/js/subscribe.js`.
- Made the primary button a filled purple action and aligned cards/chips/buttons/
  forms to the shared 8px-radius token system across the public pages.
- Changed the Briefly admin Vite build to emit `/admin/briefly/` asset URLs and use local dev port `5173`.
- Changed the Briefly Cognito app client to allow password-based token minting.
- Changed Briefly generation to use Bedrock Converse with Amazon Nova Pro (`us.amazon.nova-pro-v1:0`) after the previous Claude 3.5 Sonnet model reached end of life.
- Changed the hosted Briefly admin token field copy to ask for the raw Cognito ID token.
- Completed hosted Briefly admin launch validation: Cognito admin user, authenticated smoke, browser generation/edit/save/publish, live post detail, and Build Log listing.
- Documented hosted Briefly admin launch operations, acceptance checks, and current deployment state.
- Deployed the Briefly Cognito auth-flow update and hosted admin assets to AWS.
- Updated `AGENTS.md` to require task-relevant sub-instruction docs and changelog/open-bugs maintenance.
- Changed Briefly publish to write approved drafts to the legacy live blog table and return `/blog/post/?slug=...`.
- Changed legacy admin draft listing to send the admin password in `X-Admin-Password` instead of the URL query string.
- Changed Briefly generation start to use an atomic conditional transition to `running`.
- Changed legacy blog slug checks to scan all pages before accepting a slug.
- Changed legacy blog write paths to participate in the shared `briefly_post_slugs` slug-lock table.
- Changed legacy admin update/delete to refuse Briefly-owned slug locks instead of mutating Briefly-managed public rows.
- Changed the deployed Node create-post Lambda source to scan all pages before accepting a slug.
- Changed build updates to require an existing `build_id` before writing.
- Closed the remaining cross-writer live-blog slug race between legacy admin writes and Briefly publishes.
- Removed the repo rule that blocked deployments unless explicitly instructed.
- Deployed live Lambda fixes, public API CORS, the admin JS static asset, and `BrieflyV1Stack` to AWS.
- Updated deploy smoke checks to validate draft listing with `X-Admin-Password`.
