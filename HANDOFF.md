# Briefly Hosted Admin Handoff

Last updated: 2026-07-02

## Current state

Briefly is operational as a hosted admin workflow at:

```text
https://zacksimon.dev/admin/briefly/
```

- Current branch: `main`.
- `origin/main` contains the hosted-admin launch, main-only workflow docs, post-launch hardening, and the 2026-07-02 production bug-fix pass.
- No known open issues are currently tracked in `OPEN_BUGS.md`.
- The Cognito admin user `ticketsfortampakids@gmail.com` exists and is `CONFIRMED`.
- A policy-compliant admin password was generated for this launch session and kept out of repo/docs. Reset it with `npm run briefly:admin:ensure-user` whenever a durable user-owned password is needed.
- Normal hosted admin use is Cognito email/password sign-in inside `/admin/briefly/`. Cognito ID tokens are minted with `npm run -s briefly:admin:token` only for smoke tests or fallback UI access; paste raw token output only, never `Bearer ...`.

## AWS state

`BrieflyV1Stack` is deployed in `us-east-2`.

Confirmed CloudFormation outputs:

```text
BrieflyApiUrl = https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com/
BrieflyUserPoolId = us-east-2_0hhgJcr4h
BrieflyUserPoolClientId = 436n9qucieqcg55k6ufv7nr9s6
GenerationStateMachineArn = arn:aws:states:us-east-2:647932856401:stateMachine:GenerationStateMachine89177B8E-0BR6f03dMAoa
PublishingLambdaName = BrieflyV1Stack-BrieflyPublishingLambdaB60FC6E7-Gkq6KVtM9uTn
```

Confirmed deployed Cognito client auth flows:

```text
ALLOW_CUSTOM_AUTH
ALLOW_REFRESH_TOKEN_AUTH
ALLOW_USER_PASSWORD_AUTH
ALLOW_USER_SRP_AUTH
```

Briefly generation now uses Bedrock Converse with:

```text
BEDROCK_MODEL_ID = us.amazon.nova-pro-v1:0
```

Why this changed: the previous Claude 3.5 Sonnet model reached end of life, and Claude Sonnet 4.6 requires the Anthropic Bedrock use-case form to be submitted for this AWS account. Nova Pro works through the existing account without adding that approval dependency.

## Launch validation

Passed in the hosted workflow:

- Site password gate showed before `/admin/briefly/`.
- Correct site password opened the hosted Briefly admin.
- Hosted admin loaded with no browser console warnings/errors.
- Cognito auth succeeded and the admin session token was available in the UI.
- Daily input was created.
- Generation started, completed, and auto-loaded a draft.
- Draft was edited, approved, and saved.
- A deliberate approved draft was published.
- Returned URL was verified:
  - `/blog/post/?slug=briefly-hosted-admin-launch-verification-2026-06-25`
- The published post appeared on The Build Log listing.

Published verification post:

```text
https://zacksimon.dev/blog/post/?slug=briefly-hosted-admin-launch-verification-2026-06-25
```

Also passed before final validation:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='session-generated-password' \
npm run briefly:admin:ensure-user

BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='session-generated-password' \
npm run -s briefly:admin:token

API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN='<jwt>' \
npm run smoke:briefly

npm run typecheck --workspace @briefly/generation
npm run typecheck --workspace @briefly/infra-cdk
npm run cdk:synth --workspace @briefly/infra-cdk
npm run cdk:deploy --workspace @briefly/infra-cdk -- --require-approval never
```

Final validation passed:

```bash
npm run typecheck
VITE_BRIEFLY_API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com npm run build
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com ADMIN_BEARER_TOKEN='<jwt>' npm run smoke:briefly
npm run smoke:deploy
npm test
git diff --check
```

Hosted admin static asset sync passed:

```bash
aws s3 sync apps/admin-briefly/dist s3://dev-site-647932856401-us-east-2-an/admin/briefly/ --delete
aws cloudfront create-invalidation --distribution-id E1VYG8DDDLSYLP --paths '/admin/briefly/*' '/admin/briefly/'
aws cloudfront wait invalidation-completed --distribution-id E1VYG8DDDLSYLP --id I2FCAL6FF2ABTBTDRA7CYQEVMK
```

## Still important

- Keep Briefly API actions protected by Cognito; the site-wide CloudFront password gate has been removed.
- Do not bake Cognito bearer tokens into the Vite build.
- Do not remove Briefly publish integration with the live Build Log.
- Do not remove `briefly_post_slugs` slug-lock behavior.
- Do not resurrect or merge old divergent `briefly-dev` history.
- Legacy admin writes and Briefly publishes now share the `briefly_post_slugs` slug lock.

## Next operator notes

- If Zack needs a durable admin password, reset the Cognito user with a password he owns.
- If switching back to Anthropic on Bedrock, first submit the Anthropic use-case form in AWS Bedrock and then test from the Lambda role, not only from local AWS credentials.
- The hosted admin source and deployed static assets both use Cognito email/password sign-in as the primary path, with raw ID-token paste retained as fallback.
- `smoke:briefly:e2e` publishes a test-prefixed post, verifies public integration, and cleans it up from `briefly_posts`, `briefly_post_slugs`, and `ZS_DEV_BLOG_POSTS`.
- `smoke:briefly:e2e` cleanup is guarded by returned `post_id`, slug, and test title prefix; daily-input, draft, and workflow-run audit artifacts are retained.
- The GitHub Actions deploy workflow removes any default CloudFront site-access gate association before syncing static/admin assets and running public-access deploy smoke.
- Legacy admin update/delete refuse rows whose shared slug lock is Briefly-owned, preventing legacy edits from splitting Briefly-managed public posts from their lock.

## Deployment status

AWS deployment was run:

- `BrieflyV1Stack` was deployed with Bedrock Converse/Nova generation.
- Hosted admin static assets were synced to S3 and CloudFront invalidation `I2FCAL6FF2ABTBTDRA7CYQEVMK` completed.
- Hosted browser publish was verified against the live site.
- Post-launch hardening commit `8c83c57` was pushed to `origin/main`, and GitHub Actions deploy run `28208023042` succeeded after deploy-role IAM was tightened for SSM and Lambda@Edge.
- Legacy writer Lambdas `zs-dev-create-post`, `zs-dev-update-post`, and `zs-dev-delete-post` were manually deployed after the shared slug-lock source changes because `.github/workflows/deploy.yml` does not deploy `lambda/*`.
- Latest confirmed GitHub Actions deploy: run `28557083391` succeeded for `11d166b` (`fix: close open production bugs`) on 2026-07-02, deploying the static/admin asset workflow and confirming the public bug-fix pass.
