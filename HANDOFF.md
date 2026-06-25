# Briefly Hosted Admin Handoff

Date: 2026-06-25

## Goal

Finish making Briefly fully operational as a private hosted admin workflow at:

```text
https://zacksimon.dev/admin/briefly/
```

## Current state

- Working branch: `codex/briefly-hosted-admin-launch`
- Commit created: `fed8654 feat: host Briefly admin workflow`
- Local `briefly-dev` was moved to `fed8654`.
- Previous divergent `briefly-dev` history was preserved at:
  - `codex/preserve-briefly-dev-20260625`
- `main` was not merged or pushed.
- `origin/briefly-dev` was not force-pushed.

## What changed

- Hosted Briefly admin build now uses Vite base `/admin/briefly/`.
- Local admin dev server now uses `localhost:5173`; preview uses `4173`.
- Hosted admin no longer supports baked bearer-token env vars.
- Cognito app client now explicitly supports password-based token minting.
- GitHub Actions now:
  - installs npm dependencies,
  - builds `@briefly/admin-briefly`,
  - keeps root static sync behavior,
  - syncs `apps/admin-briefly/dist` to `s3://$S3_BUCKET_NAME/admin/briefly/`.
- Added `scripts/briefly-admin-auth.sh`.
- Added npm scripts:
  - `npm run briefly:admin:ensure-user`
  - `npm run briefly:admin:token`
- Deploy smoke now checks:
  - unauthenticated `/admin/briefly/` is blocked,
  - authenticated `/admin/briefly/` returns 200,
  - JS/CSS load from `/admin/briefly/assets/`.
- Docs were updated:
  - `AGENTS.md`
  - `BRAND.md`
  - `CHANGELOG.md`
  - `CLAUDE.md`
  - `PLANS.md`
  - `README.md`
  - `TECHSTACK.md`
  - `apps/admin-briefly/README.md`
  - `docs/briefly-v1-architecture.md`
  - `docs/dev-workflow.md`

## AWS state

`BrieflyV1Stack` was deployed successfully.

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

Hosted admin assets were manually uploaded to:

```text
s3://dev-site-647932856401-us-east-2-an/admin/briefly/
```

CloudFront distribution invalidated:

```text
E1VYG8DDDLSYLP
```

## Validation already run

Passed:

```bash
npm run typecheck
npm run build
npm run cdk:synth --workspace @briefly/infra-cdk
npm test
bash -n scripts/smoke-test.sh scripts/briefly-admin-auth.sh scripts/smoke/briefly-smoke.sh
git diff --check
```

Passed hosted-style admin build check:

```bash
VITE_BRIEFLY_API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
npm run build --workspace @briefly/admin-briefly
```

Confirmed built `index.html` references:

```text
/admin/briefly/assets/*.js
/admin/briefly/assets/*.css
```

Passed deploy smoke with site owner password from SSM:

```bash
SITE_ACCESS_PASSWORD="$(aws ssm get-parameter \
  --name /zacksimon/site/owner-password \
  --with-decryption \
  --region us-east-2 \
  --query 'Parameter.Value' \
  --output text)" \
npm run smoke:deploy
```

This confirmed:

- site password gate works,
- unauthenticated `/admin/briefly/` is blocked,
- authenticated `/admin/briefly/` returns 200,
- hosted admin JS/CSS load,
- existing public site smoke checks still pass.

Passed health-only Briefly smoke:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
npm run smoke:briefly
```

Authenticated Briefly smoke was skipped because `ADMIN_BEARER_TOKEN` was not available.

Browser QA passed for local hosted-path preview:

```bash
npm run preview --workspace @briefly/admin-briefly -- --host 127.0.0.1
```

Checked:

- `http://127.0.0.1:4173/admin/briefly/`
- desktop render
- mobile render
- API base prefilled
- connection form saves dummy token
- no console warnings/errors

## Remaining blocker

The Cognito admin user has not been created yet because no `BRIEFLY_ADMIN_PASSWORD` was available in the shell.

Current AWS check showed:

```text
ticketsfortampakids@gmail.com does not exist in user pool us-east-2_0hhgJcr4h
```

## Next steps

1. Pick a policy-compliant admin password.

CDK password policy:

- minimum 14 characters,
- at least one digit,
- at least one symbol,
- at least one uppercase letter,
- at least one lowercase letter.

2. Create or reset the Cognito admin user.

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run briefly:admin:ensure-user
```

3. Mint a Cognito ID token.

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

4. Run authenticated Briefly smoke.

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN='<jwt>' \
npm run smoke:briefly
```

5. Browser-test the real hosted workflow.

Open:

```text
https://zacksimon.dev/admin/briefly/
```

Test:

- site password gate,
- paste Cognito ID token,
- create daily input,
- start generation,
- poll/load draft,
- edit and save draft,
- publish only a deliberate approved draft,
- verify returned `/blog/post/?slug=...`,
- verify the post appears in The Build Log listing.

6. Promote only after authenticated workflow passes.

Recommended:

```bash
git push -u origin codex/briefly-hosted-admin-launch
```

Then merge to `main` only after the authenticated workflow and deliberate publish check pass.

## Important risks and constraints

- Do not merge the old divergent `origin/briefly-dev` wholesale.
- Do not remove site password gate files or behavior.
- Do not remove Briefly live Build Log publish integration.
- Do not remove `briefly_post_slugs` slug-lock behavior.
- Do not bake Cognito bearer tokens into hosted Vite builds.
- The remaining cross-writer slug race between legacy admin writes and Briefly publishes is still open in `OPEN_BUGS.md`.

## Deployment status

AWS deployment was run:

- `BrieflyV1Stack` was deployed.
- Hosted admin assets were uploaded manually to S3.
- CloudFront invalidation completed.

AWS deployment is not fully complete operationally:

- Cognito admin user creation is pending.
- Authenticated Briefly smoke is pending.
- End-to-end hosted browser workflow is pending.
- Merge/push to `main` is pending.
