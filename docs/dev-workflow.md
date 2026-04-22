# Development Workflow (Lightweight)

This repo uses a simple operating model optimized for a solo builder.

## Branch model

- `main` is the stable integration branch.
- `briefly-dev` is the active branch for ongoing Briefly work.

## Default day-to-day flow

1. Start from latest `main`.
2. Work in `briefly-dev` for Briefly tasks.
3. Commit small milestones frequently.
4. Run local validation.
5. Merge stable milestone(s) back into `main`.

## Suggested branch setup

```bash
git checkout main
git pull origin main
git checkout -b briefly-dev
git push -u origin briefly-dev
```

If `briefly-dev` already exists:

```bash
git checkout briefly-dev
git pull origin briefly-dev
```

## Commit guidance

- One milestone per commit when possible.
- Keep unrelated changes out of the same commit.
- Before large Codex tasks, make a checkpoint commit first.

## Safety guardrails

- No deploys unless explicitly requested.
- No AWS resource changes unless explicitly requested.
- Do not alter live-site deploy behavior by default.
- Do not refactor public site layout unless explicitly requested.

## Validation and reporting

For meaningful changes (where applicable):

```bash
npm run typecheck
npm run build
```

In final handoff notes, always include:

- File-by-file changes
- Validation run and result
- Explicit AWS deployment status

## Briefly dev infra workflow

- Briefly AWS infrastructure is dev-only for now (`BrieflyV1DevStack`).
- Use root scripts for infrastructure checks:
  - `npm run briefly:dev:typecheck`
  - `npm run briefly:dev:synth`
  - `npm run briefly:dev:diff`
- Only run `npm run briefly:dev:deploy` when explicitly asked.
- Runbook and manual Cognito steps live in `docs/briefly-dev-deploy.md`.

## Agent contract

`AGENTS.md` is the primary working contract for future Codex sessions in this repo.
