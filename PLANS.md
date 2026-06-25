# PLANS.md

Use this template for larger or multi-step tasks.

## Task

- Goal: Fix the seven bugs tracked in `OPEN_BUGS.md` at task start.
- Requested by: Zack
- Date: 2026-06-25

## Constraints

- Scope included: Briefly CORS, Briefly publish/live-blog integration, slug uniqueness, generation start atomicity, legacy admin password handling, and build update safety.
- Scope excluded: AWS deployment, public-site redesign, and live-site deploy behavior changes.
- Deployment allowed? (yes/no): yes; requested after implementation

## Plan

1. Assign independent fixes to engineer subagents with a senior review pass.
2. Implement shared Briefly CDK/publishing integration in the senior-agent lane to avoid stack-file conflicts.
3. Review worker patches for build updates, legacy slugs, legacy admin auth, and generation atomicity.
4. Update `OPEN_BUGS.md`, `CHANGELOG.md`, and `TECHSTACK.md`.
5. Run syntax, typecheck, build, and available test validation.

## Milestones / checkpoints

- [x] Checkpoint 1: Independent worker fixes completed and reviewed.
- [x] Checkpoint 2: Briefly CORS, slug lock, and live Build Log publish integration implemented.
- [x] Checkpoint 3: Bug ledger and project docs updated.

## Validation

- Commands to run: `python3 -m py_compile lambda/get_posts.py lambda/create_post.py lambda/update_post.py lambda/update_build.py`; `node --check assets/js/admin.js`; `npm run typecheck`; `npm run build`; `npm test`.
- Expected outputs: syntax checks, TypeScript typecheck, and build pass; tests pass or report no configured tests.

## Delivery notes

- File-by-file changes: See final task summary for exact files.
- Risks/tradeoffs: Briefly publish now intentionally writes to the existing live blog table. Legacy admin and Briefly publish can still race with each other on slug creation until a follow-up makes legacy writes share a transactional slug lock.
- AWS deployment status: `run`
