# DESIGN.md

Design guidance for future agents working on `zacksimon.dev`, the existing admin screens, and Briefly.

## Design posture

- Protect the live site's current structure unless a task explicitly asks for public-site redesign.
- Favor clean, readable, builder-focused interfaces over marketing-heavy ornament.
- Keep layouts practical: clear navigation, obvious CTAs, strong content hierarchy, and responsive behavior that works on small screens first.
- Existing public-site pages use a restrained white/deep-navy foundation with purple primary actions and amber highlight moments. Extend that system instead of inventing a new visual language.

## Live site patterns

- Primary navigation is the sticky top navbar with logo, hotbar links, and admin link.
- Public pages use root static HTML plus shared CSS in `assets/css/style.css`.
- The site already has recurring patterns: section tags (`/ what i do`, `/ the build log`), card-like build/post surfaces, compact CTA rows, and newsletter forms.
- Preserve recognizability of the home, builds, blog, contact, admin, and privacy/terms page structure.

## Admin and Briefly UI

- Admin tools should feel operational and efficient, not like a landing page.
- Prefer dense, scannable forms with clear status messages and safe error states.
- Do not expose secrets in visible UI beyond intentional password/token fields.
- Make optimistic-locking/version-conflict states explicit when editing drafts.

## Interaction and accessibility

- Keep buttons, labels, inputs, and status messages semantically correct.
- Use `aria-live` for async status updates where users need feedback.
- Preserve keyboard-friendly forms and visible focus states.
- Make link destinations truthful; do not return URLs for routes that do not exist.

## Responsive rules

- Avoid fixed widths that break below mobile viewport sizes.
- Keep nav labels and buttons from wrapping into unusable states.
- Test high-risk UI changes in at least one desktop and one mobile viewport.

## Visual system — "Workbench Clean" (current public-site direction)

Accepted redesign direction for `zacksimon.dev`. Reference mockups live in the
`codex/zacksimon-redesign-mockups` branch under `mockups/` (home hero, builds
board, mobile nav). Extend this system; do not invent a parallel one.

### Design tokens (defined in `:root`, `assets/css/style.css`)

- Use the CSS variables instead of hardcoding values in new/edited rules.
- Palette: `--canvas` (white), `--ink`/`--ink-soft`/`--muted`/`--faint` (deep-navy
  text scale), `--line`/`--surface`/`--surface-violet`/`--surface-gold` (structure),
  `--accent` + `--accent-strong`/`--accent-wash` (purple/indigo action),
  `--gold` + `--gold-strong`/`--gold-ink`/`--gold-wash` (amber energy/highlight),
  `--grid-line` (texture).
- Brand tokens (`--zs-ink`, `--zs-amber`, `--zs-black`, `--zs-paper`,
  `--zs-stone`, `--zs-stone-dark`) carry the Classic Amber logo palette
  (`BRAND.md`). They are additive; the one component-level link is that
  `--gold` now aliases `--zs-amber` (#F59E0B) so site amber matches the mark.
- Two-color rule: purple is the **single primary-action** color (primary buttons,
  links, active nav/states). Amber is **energy/highlight only** — secondary CTAs,
  eyebrow ticks, the headline marker-underline, tinted surfaces, Build Log tag
  chips, and the "In Progress" board column. They must never both style the same
  primary action. Amber on a filled surface needs navy text (`--gold-ink`) for
  contrast, and amber must not become a primary action.
- Type: `--font-display` (Space Grotesk grotesk headline face, with system
  fallbacks), `--font-body` (Inter), `--font-mono` (labels/chips).
- Scale is **H1-led**: `--h1-fluid` is always larger and stronger than `--h2-fluid`
  (`--h3-fluid` below that). Never restore an inverted scale where H1 < H2, and do
  not force headline `white-space: nowrap` to make text fit — let it wrap.
- Radii: `--radius` (8px, the unified default), `--radius-sm` (6px), `--radius-pill`.
- Shadows: `--shadow-sm` / `--shadow-md` / `--shadow-pop`.

### Surface and texture

- White-first canvas with a subtle fixed grid texture (`--grid-line`, 64px) on
  `body` so wide empty areas read as intentional workbench, not unfinished.
- Deep navy (`--ink`) is structure (text, the dark CTA bars/cards), not the whole
  brand. Purple (`--accent`) is reserved for actions and active states; the primary
  button is a filled purple action.
- Headings use the display face; section labels and chips use the mono face.

### Preserved distinctive patterns

- Sticky top nav (`.navbar` / `.hotbar`) that shrinks into a floating compact
  pill on scroll (`.navbar-compact`, driven by `assets/js/script.js`).
- Kanban "board as portfolio" on Builds.
- Contact routing/intent cards.
- Monospace section labels (`/ what i do`, `/ builds · board`, etc.).

### Navbar layout (desktop)

- Brand is the "Classic Amber" lockup (`assets/brand/zs-lockup-light-bg.svg` —
  light-tile badge with the three-layer amber-sliced `Z`, plus a `Space Grotesk`
  `Zack Simon` wordmark and mono descriptor; see `BRAND.md`), rendered as
  `.logo-lockup` at 56px header height. A badge-only fallback (`.logo-badge`,
  `assets/brand/zs-badge-light.svg`) replaces it in the scroll-compact pill, the
  761–900px band, and at ≤480px. The old `assets/images/logo.svg` chip and the
  HTML `.logo-wordmark` span are retired.
- Links (`.hot-btn`) are plain right-aligned text, not a boxed button group; the
  active link (`.hot-btn-active`) is marked by an amber dot, never a filled box.
- The right cluster (`.nav-contact`) holds a muted `Admin` link and the amber
  `Subscribe` action pill (`.nav-cta`). Purple stays the primary-action color;
  the nav CTA is the one sanctioned amber action (highlight intent: list growth).
- In the scroll-compact pill the wordmark and `.nav-contact` collapse away,
  leaving just the logo mark + links. The 761–900px band hides the wordmark so
  links + CTA never crowd before the mobile drawer takes over.

### Navigation (mobile)

- Below 760px the desktop nav is replaced by a compact header + a menu
  button (`.nav-toggle`) and an accessible drawer (`.nav-drawer`). The drawer is
  built by `assets/js/script.js` from the `.hotbar` links plus the Subscribe CTA
  (`.nav-drawer-cta`) and the secondary Admin link, so it stays in sync per page.
- The drawer uses `aria-expanded`/`aria-controls`, focus-moves into the panel on
  open, traps Tab, closes on Escape / backdrop / link click, and restores focus.
- Behavior is gated on `body.has-drawer` (added by JS); without JS the existing
  `.hotbar` remains as the fallback. Mobile nav must never horizontally scroll or
  clip primary links.

### Newsletter forms

- Email is required; phone is optional (for SMS). No age field anywhere on the
  frontend.
- Consent copy must state plainly that subscribing means email, plus optional SMS
  only if a phone number is added, linking the Privacy Policy & Terms.
