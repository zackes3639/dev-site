# AGENTS.md

This file is the working contract for future Codex/Claude Code sessions in this repo.

## Instruction map (mandatory)

AGENTS.md is the root contract. Before making changes, agents must read this file and then read the sub-instruction docs that match the task:

- `DESIGN.md`: UI, layout, interaction, accessibility, and visual-system guidance.
- `BRAND.md`: product identity, naming, positioning, and brand boundaries.
- `VOICE.md`: writing style for Zack, zacksimon.dev, The Build Log, and Briefly.
- `TECHSTACK.md`: current architecture, deployment model, commands, and integration boundaries.
- `OPEN_BUGS.md`: known bugs, risks, and review findings that should influence implementation.

Default rule: for code changes, read `TECHSTACK.md` and `OPEN_BUGS.md`; for UI/content changes, also read `DESIGN.md`, `BRAND.md`, and `VOICE.md`.

## Documentation update rule

- When a task changes design guidance, brand/voice, tech stack, deploy behavior, or known risks, update the relevant sub-instruction doc in the same change.
- When a known bug is found, fixed, or intentionally deferred, update `OPEN_BUGS.md`.
- When repo behavior, agent rules, deploy process, or meaningful project documentation changes, add an entry to `CHANGELOG.md`.
- Keep these docs short, operational, and accurate. Prefer current facts over aspirational plans.

## Repo context

- This repo contains both the live site (`zacksimon.dev`) and in-progress Briefly work.
- Briefly is currently implemented in-progress and not yet deployed to AWS.
- Default posture: protect live-site stability while iterating quickly on Briefly.
- Sub-instruction docs listed above are part of this contract, not optional background reading.

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
