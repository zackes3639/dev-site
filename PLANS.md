# PLANS.md

Use this file for active execution plans on larger or multi-step tasks.

## Task

- Goal: Close the current `OPEN_BUGS.md` findings with narrow production-minded fixes.
- Requested by: Zack
- Date: 2026-07-02

## Constraints

- Scope included: public Lambda pagination/error hygiene, newsletter subscribe API contract, Briefly admin unsafe HTML rendering, deploy artifact exclusions, and repo docs.
- Scope excluded: live AWS deployment, broad site/app restructuring, and unrelated public-site redesign.
- Deployment allowed? (yes/no): no; validate locally and report that AWS deployment was not run.

## Agent plan

1. Worker A (`gpt-5.4-mini`): Fix `lambda/get_posts.py` and `lambda/get_builds.py` pagination plus generic public 500 responses.
2. Worker B (`gpt-5.4-mini`): Fix `lambda/subscribe.py` so email is required, phone is optional, age is ignored/unstored, and public 500s are generic.
3. Worker C (`gpt-5.4-mini`): Fix `apps/admin-briefly/src/main.ts` unsafe `innerHTML` rendering for draft metadata and slug conflicts.
4. Worker D (`gpt-5.4-mini`): Fix `.github/workflows/deploy.yml` so root repo docs are not synced to the public site bucket.
5. Lead Codex: Review worker patches, resolve integration issues, update `OPEN_BUGS.md` and `CHANGELOG.md`, then run validation.

## Checkpoints

- [x] Worker fixes returned and reviewed.
- [x] Integrated code is minimal and respects repo docs.
- [x] `OPEN_BUGS.md` records fixed items as recently closed.
- [x] `CHANGELOG.md` records behavior/deploy-process changes.
- [x] Validation passes.

## Validation

- `npm run typecheck`
- `npm run build`
- `npm test`
- Targeted syntax checks for edited Python Lambdas
- `git diff --check`

## Deployment

- AWS deployment status: not run for this task unless Zack explicitly asks for `push and merge` or live deployment.
