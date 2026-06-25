# PLANS.md

Use this template for larger or multi-step tasks.

## Task

- Goal: Launch Briefly as a private hosted admin workflow at `/admin/briefly/`.
- Requested by: Zack
- Date: 2026-06-25

## Constraints

- Scope included: hosted admin build/deploy path, Cognito password-token flow, admin token ops, launch docs, and smoke coverage.
- Scope excluded: unrelated public-site redesign and merging the old divergent `briefly-dev` stack wholesale.
- Deployment allowed? (yes/no): yes; requested after implementation

## Plan

1. Preserve old `briefly-dev` history and work from current local `main`.
2. Use subagents for infra/auth, admin hosting, ops/smoke, and docs/QA inspection.
3. Implement only senior-reviewed hosted admin launch changes.
4. Run typecheck, build, and CDK synth.
5. Deploy `BrieflyV1Stack`, create/reset the first Cognito admin user, and mint a token.
6. Deploy static site/admin assets and run post-deploy smoke/browser checks.
7. Commit the validated milestone and report exact deployment status.

## Milestones / checkpoints

- [x] Checkpoint 1: Old `briefly-dev` preserved at `codex/preserve-briefly-dev-20260625`.
- [x] Checkpoint 2: Hosted admin/auth/deploy surfaces inspected by senior agent and subagents.
- [x] Checkpoint 3: Launch changes implemented and reviewed.
- [x] Checkpoint 4: Local validation passed.
- [ ] Checkpoint 5: AWS and site deployment completed.

## Validation

- Commands to run: `npm run typecheck`; `npm run build`; `npm run cdk:synth --workspace @briefly/infra-cdk`; `npm run smoke:briefly`; `npm run smoke:deploy`.
- Browser checks: `/admin/briefly/` password gate, JS/CSS under `/admin/briefly/assets/`, create input, start generation, poll/load draft, edit/save draft, and approved publish verification.

## Delivery notes

- File-by-file changes: See final task summary for exact files.
- Risks/tradeoffs: Hosted admin v1 uses pasted Cognito tokens; Hosted UI login is deferred.
- AWS deployment status: `BrieflyV1Stack deployed; hosted admin assets deployed; Cognito admin user and authenticated smoke pending`
