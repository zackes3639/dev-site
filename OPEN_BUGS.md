# OPEN_BUGS.md

Known open issues and review findings. Update this file when issues are found, fixed, or intentionally deferred.

## Open

### P1 - Briefly admin browser requests likely fail CORS preflight

- Area: Briefly API/CDK/admin UI
- Files: `infra/cdk/lib/briefly-stack.ts`, `apps/admin-briefly/src/api.ts`
- Problem: The admin client sends `Authorization` and JSON cross-origin, which triggers browser `OPTIONS` preflight. The HTTP API currently has no `corsPreflight` configuration and no explicit `OPTIONS` routes for protected endpoints.
- Impact: Briefly admin workflows can fail in the browser even when Lambda handlers return CORS headers.

### P1 - Briefly publish does not publish to the live Build Log

- Area: Briefly publishing/live-site integration
- Files: `services/publishing/src/handlers/publishDraft.ts`, `assets/js/blog.js`, `blog/post/index.html`
- Problem: Briefly writes published posts to `briefly_posts` and returns `/build-log/{slug}`, while the public blog reads the legacy posts API and uses `/blog/post/?slug=...`.
- Impact: A successfully published Briefly draft is not visible on the current public site.

### P1 - Legacy admin sends write password in a query string

- Area: Live admin/blog API
- Files: `assets/js/admin.js`, `lambda/get_posts.py`
- Problem: Draft listing uses `/posts?include_drafts=1&password=...`.
- Impact: The admin password can appear in access logs, browser history, request telemetry, or copied URLs.

### P2 - Legacy blog slug uniqueness checks can miss duplicates

- Area: Live blog write Lambdas
- Files: `lambda/create_post.py`, `lambda/update_post.py`
- Problem: `Scan` with `FilterExpression` and `Limit=1` can examine one nonmatching item and stop before finding an existing slug.
- Impact: Duplicate slugs can be created, making client-side post lookup ambiguous.

### P2 - Briefly publish slug uniqueness is race-prone

- Area: Briefly publishing
- File: `services/publishing/src/handlers/publishDraft.ts`
- Problem: Slug availability is checked before a transaction, but DynamoDB does not enforce uniqueness on the `by_slug` GSI.
- Impact: Concurrent publishes can create duplicate slugs.

### P2 - Briefly generation start is not an atomic state transition

- Area: Briefly API/workflow start
- Files: `services/api/src/handlers/startGeneration.ts`, `services/api/src/repositories/dailyInputsRepository.ts`
- Problem: Two requests can both read a non-running daily input and start separate workflow executions because status update only checks `attribute_exists`.
- Impact: Duplicate generation runs can be created for one daily input.

### P2 - Build updates can create phantom records

- Area: Live builds admin Lambda
- File: `lambda/update_build.py`
- Problem: `update_item` does not require `attribute_exists(build_id)`.
- Impact: A stale or mistyped build ID can create a partial public build record.

## Recently closed

- None yet.
