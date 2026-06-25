# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

### P2 - Live blog slug uniqueness is not enforced across all writers

- Area: Live blog write paths / Briefly publishing integration
- Files: `lambda/create-post.js`, `lambda/create_post.py`, `lambda/update_post.py`, `lambda/delete_post.py`, `services/publishing/src/handlers/publishDraft.ts`
- Problem: The original legacy slug scan bug is fixed, and Briefly publishes now use a transactional slug lock, but the legacy admin write Lambdas do not yet participate in the same slug-lock mechanism.
- Impact: A rare concurrent write split between legacy admin and Briefly publish could still create duplicate live-blog slugs.

## Recently closed

- 2026-06-25: Fixed Briefly admin browser CORS preflight by adding HTTP API `corsPreflight` for admin origins, JSON, authorization, and protected-route methods.
- 2026-06-25: Fixed Briefly publish visibility by writing published drafts to both `briefly_posts` and the legacy live blog table, returning the current `/blog/post/?slug=...` URL.
- 2026-06-25: Fixed legacy admin draft listing password leakage by moving the admin password from the query string to the `X-Admin-Password` request header.
- 2026-06-25: Fixed legacy blog slug duplicate checks by paginating slug scans in create and update Lambdas.
- 2026-06-25: Fixed Briefly publish slug races by adding a transactional `briefly_post_slugs` lock table.
- 2026-06-25: Fixed Briefly generation duplicate starts by making the daily-input transition to `running` conditional and atomic.
- 2026-06-25: Fixed build update phantom records by requiring `attribute_exists(build_id)` on update.
