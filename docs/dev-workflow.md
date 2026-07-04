# Development Workflow (Lightweight)

This repo uses a simple main-only operating model optimized for a solo builder.

## Branch model

- `main` is the only active branch.
- `origin/main` is the canonical stored state in GitHub.
- Anything on `origin/main` should be reflected on live `zacksimon.dev` by the AWS deploy workflow.

## Default day-to-day flow

1. Start from latest `main`.
2. Build and validate locally.
3. Commit the intended changes to `main`.
4. When Zack explicitly approves local changes or says `push and merge`, push/merge `main` to `origin/main` unless he explicitly asks to hold the work locally.
5. Expect `.github/workflows/deploy.yml` to deploy to AWS and make the change live.
6. If the change affects Lambda/CDK resources outside that workflow, run the required AWS deploy/smoke steps or add automation before calling the work live.

## Suggested setup

```bash
git checkout main
git pull origin main
```

## Commit guidance

- One shippable/storable milestone per commit when possible.
- Keep unrelated changes out of the same commit.
- Do not leave approved local edits or local-only commits as the final handoff after Zack approves shipping or says `push and merge`; GitHub `origin/main` should match what is live.
- Before large Codex tasks, make a checkpoint only when the work should be preserved in git; otherwise use an out-of-repo safety backup.

## Safety guardrails

- Do not bypass, disable, or weaken the `origin/main` to AWS deploy behavior unless explicitly requested.
- No infrastructure or Lambda automation changes unless explicitly requested, but do not claim Lambda/CDK changes are live from GitHub alone unless the needed deploy step has run.
- Do not refactor public site layout unless explicitly requested.

## Validation and reporting

For meaningful changes (where applicable):

```bash
npm run typecheck
npm run build
```

For hosted Briefly admin launches, also run:

```bash
npm run cdk:synth --workspace @briefly/infra-cdk
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt> \
npm run smoke:briefly
npm run smoke:deploy
```

Browser-check `/admin/briefly/`: JS/CSS under `/admin/briefly/assets/`, Cognito sign-in requirement for API actions, create input, start generation, poll/load draft, edit/save draft, and only publish a deliberately approved draft.

In final handoff notes, always include:

- File-by-file changes
- Validation run and result
- Explicit AWS deployment status

Keep `CHANGELOG.md` active: add meaningful repo behavior, documentation, deployment-process, and risk-tracking changes in the same change that makes them.

## Agent contract

`AGENTS.md` is the primary working contract for future Codex sessions in this repo.
