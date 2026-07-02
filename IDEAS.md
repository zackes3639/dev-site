# IDEAS.md

Later ideas to consider. These are not commitments; use them as a parking lot for product, engineering, marketing, sales, and business-producing experiments.

## Product and Site

- Add a focused "Hire Zack" offer page with 2-3 concrete service packages instead of only a general contact path.
- Turn the best Builds cards into short case studies with problem, shipped artifact, architecture, outcome, and next step.
- Add a public Briefly progress page that shows the workflow, current limitations, and selected Build Log outputs without overstating launch maturity.
- Add topic filters for The Build Log: AWS, product, Briefly, site work, lessons learned.
- Add a "start here" page for new readers that links to the strongest build logs, current builds, and contact/subscribe paths.
- Add lightweight social proof blocks: shipped screenshots, smoke-test snippets, architecture diagrams, and public milestones.
- Add a clearer above-the-fold commercial signal for consulting/freelance work while keeping the builder identity intact.

## Marketing and Sales

- Build Log delivery phase 2: add SMS only after email v1 is proven, SES production access is approved, unsubscribe/suppression behavior has live smoke coverage, and consent copy/provider requirements are revisited.
- Productize three entry offers: AWS launch cleanup, workflow automation sprint, and founder technical audit.
- Build one landing section/page per offer with who it is for, deliverables, timeline, price range or starting point, and a direct CTA.
- Create a Build Log welcome sequence: intro, best posts, current build, offer, and reply prompt.
- Repurpose each Build Log post into a LinkedIn post, a short technical thread, and one practical checklist.
- Create a lead magnet: "AWS static site launch checklist" or "daily build log template" tied to the newsletter.
- Start a small outbound list of Tampa founders, local agencies, and solo operators who may need cloud/product build help.
- Add a contact intake form for project type, urgency, budget range, timeline, and preferred next step.
- Add a referral ask to the newsletter footer once the list has warm readers.

## Business-Producing Experiments

- Define a minimum viable sales pipeline: lead source, status, next action, value, and follow-up date in a simple sheet or CRM.
- Create reusable proposal/SOW templates for the three productized offers.
- Offer a paid discovery session that can credit toward build work.
- Package a monthly "builder in residence" retainer for small teams that need recurring product/cloud help.
- Add a "book a fit check" CTA once calendar routing and qualification are ready.
- Publish one teardown-style post per month aimed at buyer pain: slow internal tools, messy AWS bills, brittle workflows, or manual reporting.
- Track newsletter-to-lead conversion with simple UTM/source fields before adding heavier analytics.

## Briefly

- Add voice-note or mobile quick-capture input for daily bullets.
- Add optional inputs from calendar, GitHub commits, Linear/Jira, or notes to reduce manual daily entry.
- Add draft quality checks for structure, word count, links, title strength, and repeated phrasing.
- Add scheduled publish support after the human review step.
- Add content repurposing outputs: LinkedIn draft, newsletter intro, and short summary.
- Add a source-corpus view that shows which prior posts Briefly may use for context.

## Engineering and Operations

- Automate non-static AWS deploy paths for legacy Lambdas and Briefly CDK changes, including smoke verification, so `origin/main` can be a stronger live-state boundary.
- Migrate root static site files into `apps/site` so deploys can sync a clean build artifact instead of the repo root.
- Add pagination helpers/tests for all DynamoDB scan/query list paths.
- Add focused unit tests around slug locking, publish conflicts, and legacy/Briefly split-brain protection.
- Add HTML/JS smoke checks for public blog, post detail, and Builds rendering using fixture API responses.
- Convert admin/public dynamic HTML rendering paths to DOM builders or a shared escape helper.
- Add deploy artifact allowlisting so project docs and repo metadata cannot be uploaded accidentally.
