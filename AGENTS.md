# AGENTS.md

This file is the working contract for future Codex/Claude Code sessions in this repo.

## Repo context

- This repo contains both the live site (`zacksimon.dev`) and in-progress Briefly work.
- Briefly is currently implemented in-progress and not yet deployed to AWS.
- Default posture: protect live-site stability while iterating quickly on Briefly.

## Branch strategy (lightweight)

- `main`: stable integration branch.
- `briefly-dev`: active development branch for ongoing Briefly work.

### Operational rule

- From now on, do ongoing Briefly development on `briefly-dev`.
- Merge stable, validated milestones from `briefly-dev` back into `main`.

## Commit discipline

- Commit after each meaningful milestone.
- Keep commits small, readable, and scoped.
- Do not bundle unrelated changes in one commit.
- Create a git checkpoint before larger Codex tasks.

## Safety rules (mandatory)

- Do not deploy unless explicitly instructed.
- Do not change current live-site deployment behavior unless explicitly instructed.
- Do not refactor the public site structure unless explicitly instructed.
- Keep Briefly changes isolated and production-minded.

## Validation rules

After meaningful changes (where applicable):

- Run `npm run typecheck`.
- Run `npm run build`.
- Include relevant targeted checks if the task is isolated to one workspace.

In final summaries, always include:

- Exactly what changed, file-by-file.
- What validation was run and results.
- Clear statement on deployment status:
  - `AWS deployment was run` or
  - `AWS deployment was NOT run`.

## Codex working rules

- Inspect existing files before changing structure.
- Preserve current site stability.
- Keep v1 scope tight.
- Prefer minimal, high-confidence changes over broad refactors.
- If a change could affect production behavior, pause and call it out before proceeding.

## Planning convention

- Use `PLANS.md` for active execution plans on larger tasks.
- Keep plan steps short, measurable, and easy to validate.
