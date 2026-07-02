# BRAND.md

Brand guidance for `zacksimon.dev`, The Build Log, and Briefly.

## Core identity

- Primary personal brand: Zack Simon.
- Site brand: `zacksimon.dev`.
- Public writing/product journal: The Build Log.
- In-progress product/workflow system: Briefly.

## Positioning

- Zack is a consultant turned engineer/builder/founder.
- The site should communicate practical systems thinking, cloud delivery, product judgment, and building in public.
- The repeated promise is useful software and systems that make workflows easier to run.

## Brand language

- Strong existing phrases:
  - `architect · builder · founder`
  - `Building systems that work`
  - `The Build Log`
  - `Building in public`
  - `Real decisions. Real mistakes. Real progress.`
  - `No fluff.`
- Use these as anchors when adding copy, headings, metadata, and CTAs.

## Logo system — "Classic Amber"

The mark is a graphite rounded-square badge containing a geometric `Z` sliced
into three horizontal layers; the middle (diagonal) layer is amber. The wordmark
and tagline in the lockups are vector paths — no webfont dependency.

- Assets (all committed, no build step):
  - `/assets/brand/zs-badge.svg` — icon-only mark, dark tile (primary; also the SVG favicon).
  - `/assets/brand/zs-badge-light.svg` — icon-only mark, light tile with hairline border.
  - `/assets/brand/zs-lockup-light-bg.svg` — badge + `ZACK SIMON` / `ARCHITECT·BUILDER·FOUNDER` for light backgrounds (transparent bg). Used in the site header.
  - `/assets/brand/zs-lockup-dark-bg.svg` — same lockup on a warm-black card for dark backgrounds.
  - `/favicon.ico` (16+32), `/zs-icon-180.png` (Apple touch), `/zs-icon-512.png` (manifest/OG stopgap), `/site.webmanifest`.
- Brand colors (CSS tokens in `assets/css/style.css`): graphite `--zs-ink #18181B`,
  amber `--zs-amber #F59E0B` (accent only — the site-wide `--gold` aliases it),
  warm black `--zs-black #0C0A09`, paper `--zs-paper #FAFAF9`, stone
  `--zs-stone`/`--zs-stone-dark` for muted secondary text.
- Usage: full lockup in the header on light backgrounds; badge-only in tight
  spots (compact nav pill, narrow viewports, favicons). Amber stays accent-only
  per the two-color rule in `DESIGN.md`.
- The lockup SVGs are generated geometry (monoline vector letterforms), not a
  typeface. Regenerate rather than hand-edit if the wordmark needs to change.

## Boundaries

- Do not make the site feel like a generic SaaS landing page unless the task is specifically about a product page.
- Do not overstate Briefly as production-ready; admin hosting and launch state must match `TECHSTACK.md`.
- Do not blur the public Build Log voice with Briefly's private publishing workflow; Briefly can publish into the live Build Log, but it is not a public-facing product yet.
- Do not introduce unrelated visual mascots, slogans, or brand systems.

## Naming

- Use `zacksimon.dev` for the website.
- Use `The Build Log` for the public blog/newsletter.
- Use `Briefly` for the in-progress daily-input to draft/publish workflow.
- Use `Builds` for the portfolio/kanban board.
