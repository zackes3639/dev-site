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

The canonical icon mark is a light stone rounded-square badge containing a
clipped geometric `Z` sliced into three horizontal layers; the middle diagonal
layer is amber and the top/bottom layers are graphite. A dark-tile alternate
exists for constrained inverse contexts. The lockup wordmark uses the site's
display face (`Space Grotesk`), while the small descriptor uses the site's mono
label style.

- Assets (all committed, no build step):
  - `/assets/brand/zs-badge-light.svg` — canonical icon-only mark, light tile with hairline border; used as the SVG favicon and the source for raster browser/app icons.
  - `/assets/brand/zs-badge.svg` — icon-only dark-tile alternate using the same clipped `Z` geometry.
  - `/assets/brand/zs-lockup-light-bg.svg` — light-tile badge + `Zack Simon` /
    `ARCHITECT·BUILDER·FOUNDER` for light-background lockup contexts.
  - `/assets/brand/zs-lockup-dark-bg.svg` — same lockup on a warm-black card for dark backgrounds.
  - `/favicon.ico` (16+32), `/apple-touch-icon.png` (Apple/iOS compact link and
    app-icon surfaces), `/zs-icon-180.png` (source alias), `/zs-icon-512.png`
    (manifest icon), `/site.webmanifest`.
- Brand colors (CSS tokens in `assets/css/style.css`): graphite `--zs-ink #18181B`,
  amber `--zs-amber #F59E0B` (accent only — the site-wide `--gold` aliases it),
  warm black `--zs-black #0C0A09`, paper `--zs-paper #FAFAF9`, light icon tile
  `#F5F5F4`, and stone `--zs-stone`/`--zs-stone-dark` for muted secondary text.
- Usage: the site header pairs the light badge with a live `Zack Simon` text
  wordmark so the command bar can compress consistently. Use the full lockup in
  larger light-background brand contexts and the light badge alone in tight
  spots such as the compact tablet nav and favicons. Amber stays accent-only
  per the two-color rule in `DESIGN.md`.
- Link previews should stay compact on Apple/iOS-style surfaces: keep the
  `apple-touch-icon` metadata, but do not add page-level `og:image`/large hero
  preview metadata unless Zack explicitly wants rich card previews.
- Keep the lockup typography aligned to the site font stack instead of
  reintroducing custom display lettering.

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
