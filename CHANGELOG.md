# CHANGELOG.md

All notable repo-contract, documentation, deployment-process, and project-behavior changes should be recorded here.

## Unreleased

### Added

- Added hosted Briefly admin deployment workflow for `/admin/briefly/`.
- Added Cognito admin user/token helper scripts for Briefly v1.
- Added deploy smoke checks for the hosted Briefly admin page and assets.
- Added `.env*` git ignores to reduce accidental local secret commits.
- Added root sub-instruction docs for future agents: `DESIGN.md`, `BRAND.md`, `VOICE.md`, `TECHSTACK.md`, and `OPEN_BUGS.md`.
- Added `CHANGELOG.md` as the canonical place to record meaningful repo documentation and behavior changes.
- Added Briefly HTTP API CORS preflight configuration for admin browser requests.
- Added the `briefly_post_slugs` table as a transactional slug uniqueness lock for Briefly publishes.

### Changed

- Changed the Briefly admin Vite build to emit `/admin/briefly/` asset URLs and use local dev port `5173`.
- Changed the Briefly Cognito app client to allow password-based token minting.
- Documented hosted Briefly admin launch operations, acceptance checks, and current deployment state.
- Deployed the Briefly Cognito auth-flow update and hosted admin assets to AWS.
- Updated `AGENTS.md` to require task-relevant sub-instruction docs and changelog/open-bugs maintenance.
- Changed Briefly publish to write approved drafts to the legacy live blog table and return `/blog/post/?slug=...`.
- Changed legacy admin draft listing to send the admin password in `X-Admin-Password` instead of the URL query string.
- Changed Briefly generation start to use an atomic conditional transition to `running`.
- Changed legacy blog slug checks to scan all pages before accepting a slug.
- Changed the deployed Node create-post Lambda source to scan all pages before accepting a slug.
- Changed build updates to require an existing `build_id` before writing.
- Documented the remaining cross-writer live-blog slug race between legacy admin writes and Briefly publishes.
- Removed the repo rule that blocked deployments unless explicitly instructed.
- Deployed live Lambda fixes, public API CORS, the admin JS static asset, and `BrieflyV1Stack` to AWS.
- Updated deploy smoke checks to validate draft listing with `X-Admin-Password`.
