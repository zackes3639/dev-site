# DESIGN.md

Design guidance for future agents working on `zacksimon.dev`, the existing admin screens, and Briefly.

## Design posture

- Protect the live site's current structure unless a task explicitly asks for public-site redesign.
- Favor clean, readable, builder-focused interfaces over marketing-heavy ornament.
- Keep layouts practical: clear navigation, obvious CTAs, strong content hierarchy, and responsive behavior that works on small screens first.
- Existing public-site pages use a restrained white/slate foundation with purple accent moments. Extend that system instead of inventing a new visual language.

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
