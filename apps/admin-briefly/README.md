# Briefly Admin (v1)

Minimal admin UI for the Briefly workflow:

1. Create daily input
2. Start generation
3. Load/view draft
4. Edit draft
5. Publish draft

## Local run

From repo root:

```bash
npm install
npm run dev --workspace @briefly/admin-briefly
```

The app runs at `http://localhost:5173`, matching the local CORS origin in CDK.

## Hosted URL

Hosted admin:

```text
https://zacksimon.dev/admin/briefly/
```

The static admin shell is directly reachable. Inside the UI, sign in with the Briefly Cognito email/password before calling the Briefly API. A raw Cognito ID-token field remains as a fallback.

## Hosted build

```bash
VITE_BRIEFLY_API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
npm run build --workspace @briefly/admin-briefly
```

GitHub Actions builds the same workspace and uploads `apps/admin-briefly/dist` to `s3://$S3_BUCKET_NAME/admin/briefly/`.

## Auth and API setup

Set the API base at build/dev time or fill the Connection section in the UI:

- `VITE_BRIEFLY_API_BASE`

Do not set a Vite bearer-token env var for hosted builds. Vite env values are baked into static assets. The Cognito client id/region may be public runtime configuration; passwords and tokens must stay runtime-only. The UI remembers API base/email locally and keeps the ID token in sessionStorage only.

Create or reset the Cognito admin user:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run briefly:admin:ensure-user
```

For normal use, sign in inside the hosted admin with the admin email/password. Mint an ID token only for smoke tests or fallback access:

```bash
BRIEFLY_ADMIN_EMAIL=ticketsfortampakids@gmail.com \
BRIEFLY_ADMIN_PASSWORD='set-a-policy-compliant-password' \
npm run -s briefly:admin:token
```

If using the fallback token field, paste the raw token output into the UI. Do not prefix it with `Bearer`; the client adds that prefix.

Run API smoke checks with that token:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt-token> \
npm run smoke:briefly
```

Run the full publish e2e smoke with cleanup:

```bash
API_BASE=https://yp2u8kczt9.execute-api.us-east-2.amazonaws.com \
ADMIN_BEARER_TOKEN=<jwt-token> \
npm run smoke:briefly:e2e
```

The e2e smoke removes only the returned test-prefixed public post and slug lock, using guarded DynamoDB conditions. Briefly daily-input, draft, and workflow-run audit artifacts are retained.

The UI remembers API base/email in localStorage and keeps the ID token in sessionStorage for the current browser session.

## Hosted launch checklist

- Deploy `BrieflyV1Stack` before the site deploy.
- Confirm CloudFormation outputs match `TECHSTACK.md`.
- Confirm the app client allows `USER_PASSWORD_AUTH`.
- Confirm `/admin/briefly/` returns 200 and JS/CSS load from `/admin/briefly/assets/`.
- Confirm API actions require Cognito sign-in.
- Confirm Cognito email/password sign-in succeeds inside the hosted UI, no password is stored after sign-in, and sign out clears the session token.
- Create daily input, start generation, poll/load draft, edit draft, and save changes in a browser.
- Publish only a deliberate approved draft, then verify `/blog/post/?slug=...` and The Build Log listing.

## Notes for v1

- After starting generation, load the resulting draft via draft id.
- The UI supports optimistic locking with `expected_version` for update/publish.
- Slug conflicts are surfaced with suggested alternatives when available.
