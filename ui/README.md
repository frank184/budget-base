# Budget Base UI

Vite + React frontend for Budget Base.
It handles Google sign-in, renders the budgeting workspace, and persists edits through the GraphQL API.

## Stack

- Vite
- React 18
- Apollo Client
- GraphQL
- CSS modules by convention through shared stylesheet files
- Vercel static hosting

## Run Locally

From the repo root:

```bash
docker compose up --build
```

The UI listens on `http://127.0.0.1:5173`.

To run only the UI:

```bash
cd ui
npm install
npm run dev
```

Useful scripts:

- `npm run dev`: start Vite dev server.
- `npm run build`: build production assets.
- `npm run preview`: serve the built assets locally.

## Environment

The UI reads:

- `VITE_API_BASE_URL`: base URL used for auth and GraphQL calls.
- `VITE_APOLLO_DEBUG`: when enabled in development, logs GraphQL operation timing and errors.

Local defaults:

```text
VITE_API_BASE_URL=http://127.0.0.1:3001
```

Production on Vercel:

```text
VITE_API_BASE_URL=/api
```

The production value is intentionally same-origin.
Safari is strict about cross-site cookies, so the browser talks to `https://budget-base-ui.vercel.app/api/...` and Vercel rewrites those requests to the API project.

## App Flow

Startup happens in `src/app/App.jsx`:

1. Apply persisted theme.
2. Subscribe to the in-memory session store.
3. Detect `/auth/callback`.
4. Call `bootstrapSession()`.
5. If authenticated, render the budget workspace.
6. If unauthenticated, render the Google sign-in screen.

After a successful Google OAuth callback, the API redirects to `/auth/callback`.
The UI bootstraps the session, then replaces the URL with `/`.

## Auth Client

`src/auth/session.js` owns client-side auth state:

- Builds the Google login URL.
- Calls `POST /auth/session` during app bootstrap.
- Calls `POST /auth/refresh` when the access token is close to expiry.
- Calls `POST /auth/logout` and clears local session state.
- Stores access token and user in memory only.

Refresh tokens stay in an HTTP-only cookie owned by the API response.
The UI never reads the refresh token directly.

## Apollo Data Flow

`src/app/apollo.js` configures Apollo Client:

- `HttpLink` points at `${getApiBaseUrl()}/graphql`.
- Requests include credentials so the API can see cookies when needed.
- `createAuthLink()` attaches a bearer access token when available.
- If a token is close to expiry, `ensureValidAccessToken()` refreshes it before the operation.
- A `401` network response logs the user out.
- Development debug logging reports GraphQL operation timing and errors.

Apollo cache policy is conservative:

- `watchQuery` uses `cache-and-network`.
- one-off `query` calls use `network-only`.
- Budget resource type policies key entities by stable IDs.
- Repeated nested budget collections replace incoming values instead of merging stale rows.

This keeps the UI responsive while treating the server as the canonical source after each save.

## Budget Editing

The main workspace lives in `src/features/budget/pages/BudgetPage.jsx`.
It composes month navigation, planner, transaction editor, summary panels, and snapshot controls.

The UI applies edits locally first, then persists a normalized budget snapshot through `UPDATE_BUDGET_MUTATION`.
This gives immediate feedback for data-entry workflows while keeping the backend authoritative.

Save behavior:

- Most edits schedule a delayed save after local state changes settle.
- Newer edits supersede older queued saves.
- In-flight saves are serialized so the server receives coherent snapshots.
- Manual full-state operations can force a full replace and then sync from the server response.
- Save and month-load errors are shown in the workspace instead of silently failing.

Some numeric fields also commit on blur so typed values can be cleaned up before persistence.

## Feature Layout

Important directories:

- `src/app`: app shell and Apollo setup.
- `src/auth`: session state and auth API helpers.
- `src/features/budget/api`: GraphQL operations.
- `src/features/budget/components`: planner, month bar, transactions, snapshots, and summary panels.
- `src/features/budget/model`: budget normalization helpers and sample state.
- `src/shared/lib`: formatting and theme helpers.
- `src/shared/styles`: global application styles.

## Vercel Deployment

The UI is deployed as its own Vercel project with root directory `ui`.

`ui/vercel.json` contains two rewrites:

- `/api/:path*` -> `https://budget-base-api.vercel.app/:path*`
- `/(.*)` -> `/index.html`

The API rewrite gives Safari a same-origin session flow.
The `index.html` fallback lets client-side routes such as `/auth/callback` load the React app instead of returning a static 404.

Google OAuth must allow this redirect URI:

```text
https://budget-base-ui.vercel.app/api/auth/google/callback
```

## Troubleshooting

- `/auth/callback` returns Vercel 404: verify the SPA fallback rewrite is deployed.
- Login works in Chrome but not Safari: verify production `VITE_API_BASE_URL=/api` and the Google callback uses the UI origin.
- Login redirects back to the sign-in screen: inspect `POST /api/auth/session`; a `401` response body should identify missing, invalid, expired, or already-used refresh token.
- GraphQL requests fail with `401`: check that the access token refresh request succeeds and that cookies are sent with credentials.
