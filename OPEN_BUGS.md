# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

- None currently tracked.

## Recently closed

- 2026-06-25: Fixed cross-writer live-blog slug uniqueness. Legacy create/update/delete paths now participate in the shared `briefly_post_slugs` lock table, while only releasing locks marked `source=legacy_blog`.
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
