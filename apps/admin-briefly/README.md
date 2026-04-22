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

The app runs at `http://localhost:5174`.

## Auth and API setup

Set either runtime env vars or fill the Connection section in the UI:

- `VITE_BRIEFLY_API_BASE`
- `VITE_ADMIN_BEARER_TOKEN`

Example:

```bash
VITE_BRIEFLY_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com \
VITE_ADMIN_BEARER_TOKEN=<jwt-token> \
npm run dev --workspace @briefly/admin-briefly
```

Connection values saved in the UI are stored in localStorage for this browser profile.

## Notes for v1

- After starting generation, load the resulting draft via draft id.
- The UI supports optimistic locking with `expected_version` for update/publish.
- Slug conflicts are surfaced with suggested alternatives when available.
