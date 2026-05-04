# Budget Base API

NestJS API for Budget Base.
It serves Google OAuth, session management, and the GraphQL budget API used by the React UI.

## Stack

- NestJS 11
- Fastify adapter
- Mercurius GraphQL via `@nestjs/graphql`
- Prisma Client
- PostgreSQL
- Google OAuth / OpenID Connect
- JWT access tokens plus opaque refresh-token cookies

## Run Locally

From the repo root, the easiest path is:

```bash
docker compose up --build
```

The API listens on `http://127.0.0.1:3001`.

To run only the API:

```bash
cd api
npm install
npm run dev
```

Useful scripts:

- `npm run dev`: build once, then run TypeScript watch and Node watch together.
- `npm run build`: generate Prisma Client and compile TypeScript into `dist/`.
- `npm run start`: run `dist/main.js`.
- `npm run prisma:generate`: generate Prisma Client.
- `npm run prisma:migrate`: run local Prisma migrations.
- `npm run prisma:deploy`: apply migrations in deployed environments.
- `npm run prisma:studio`: open Prisma Studio.
- `npm run repl`: run the API REPL script.
- `npm run db:import:sqlite`: import data from the old SQLite format.
- `npm run typecheck:scripts`: typecheck scripts under `scripts/`.

## Runtime URLs

Local defaults:

- Health: `GET http://127.0.0.1:3001/health`
- GraphQL: `POST http://127.0.0.1:3001/graphql`
- GraphiQL: `GET http://127.0.0.1:3001/graphiql`
- Google OAuth start: `GET http://127.0.0.1:3001/auth/google/start`

GraphiQL is a lightweight docs and exploration page backed by the live GraphQL schema.
It is served separately from Mercurius' built-in GraphiQL so the API can keep GraphQL debug behavior explicit.

## Architecture

`src/server.ts` builds the Nest application with the Fastify adapter.
It exports:

- `createApp()`: used by `main.ts` for local and containerized server startup.
- a default request handler: used by Vercel's Node runtime when the API is deployed as a serverless function.

`src/main.ts` is the long-running process entrypoint.
It calls `createApp()` and listens on `HOST` / `PORT`.

The API intentionally does not eagerly connect Prisma during Nest startup.
Prisma connects lazily when a database query runs, which keeps routes like `/health` and OAuth start resilient during serverless initialization.

## GraphQL Surface

Budget data is exposed through GraphQL resolvers in `src/budget`.
The UI currently uses:

- `budgets`: list budget shells.
- `budget`: load budget details.
- `transactions`: page/filter transaction data.
- `categoryPlans`: load planning rows for one or more months.
- `createBudget`: create a budget for a user.
- `updateBudget`: persist a normalized budget snapshot.

Auth also exposes:

- `me`: get the current authenticated user.

Most GraphQL operations require authentication through `AuthGuard`.
The guard accepts a bearer access token first and can fall back to the refresh cookie when appropriate.

## Auth Flow

Browser flow:

1. UI links to `/auth/google/start`.
2. API creates OAuth `state` and `nonce` cookies.
3. API redirects to Google with `redirect_uri=GOOGLE_CALLBACK_URL`.
4. Google redirects to `/auth/google/callback`.
5. API validates state, nonce, and ID token.
6. API upserts the user and Google identity, ensures a starter budget exists, and sets `budget_base_refresh`.
7. API redirects the browser to `${UI_BASE_URL}/auth/callback`.
8. UI calls `POST /auth/session` to exchange the refresh cookie for an access token.

Session routes:

- `POST /auth/session`: bootstrap the UI session from the refresh cookie without rotating it.
- `POST /auth/refresh`: rotate the refresh token and issue a new access token.
- `POST /auth/logout`: revoke the refresh token and clear the cookie.
- `GET /auth/me`: return the authenticated user from bearer token or refresh cookie.

The refresh cookie is opaque.
Only a SHA-256 hash is stored in Postgres.

## Environment

Use `api/.env.example` as the local template.

Important variables:

- `DATABASE_URL`: Prisma PostgreSQL connection string.
- `HOST`: bind host for local/server process mode.
- `PORT`: API port.
- `LOG_LEVEL`: Fastify logger level.
- `GRAPHQL_DEBUG`: enables Mercurius execution logging when not `false`.
- `UI_BASE_URL`: frontend URL for CORS and post-login redirects.
- `API_BASE_URL`: API issuer used for access tokens.
- `GOOGLE_CALLBACK_URL`: OAuth callback URL registered in Google Cloud.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `JWT_ACCESS_SECRET`: HS256 access-token signing secret.
- `JWT_REFRESH_SECRET`: legacy/reserved secret; refresh tokens are currently opaque.
- `JWT_ACCESS_TTL_SECONDS`: access-token lifetime.
- `JWT_REFRESH_TTL_DAYS`: refresh-token lifetime.
- `COOKIE_SECURE`: set `true` in production.
- `COOKIE_SAME_SITE`: local uses `lax`; direct cross-site production used `none`.

For the current Vercel production flow, the UI proxies `/api/*` to the API.
Use this Google callback URL:

```text
https://budget-base-ui.vercel.app/api/auth/google/callback
```

That URL must be listed in Google Cloud under Authorized redirect URIs.

## Database

The canonical database is PostgreSQL.
Prisma schema and migrations live under `api/prisma`.

Local Docker Compose starts Postgres with:

- database: `budget_base`
- user: `budget_base`
- password: `budget_base`

The API's Docker Compose `DATABASE_URL` points at the `postgres` service.

The old SQLite importer remains available through `npm run db:import:sqlite` for migration/recovery work, but SQLite is no longer the runtime store.

## Vercel Deployment

The API is deployed as its own Vercel project with root directory `api`.
There is no `api/vercel.json`; the project settings identify it as a NestJS app.

Vercel expects the invoked module's default export to be a function.
`src/server.ts` provides that default handler and also keeps `createApp()` available for local process mode.

Production environment notes:

- Set `COOKIE_SECURE=true`.
- Use HTTPS URLs for `UI_BASE_URL`, `API_BASE_URL`, and `GOOGLE_CALLBACK_URL`.
- Keep Google OAuth redirect URIs in sync with the deployed callback URL.
- Run Prisma migrations before relying on new schema changes.

## Troubleshooting

- `FUNCTION_INVOCATION_FAILED` with "default export must be a function": Vercel is invoking the wrong module shape; `src/server.ts` must export the default handler.
- Google `redirect_uri_mismatch`: add the exact live `GOOGLE_CALLBACK_URL` to Google Cloud OAuth credentials.
- UI redirects back to login after Google on Safari: verify the UI is using `/api`, `ui/vercel.json` rewrites `/api/:path*`, and the callback URL uses the UI origin.
- Repeated `401` on `/auth/session`: inspect the response body. It should distinguish missing, invalid, expired, or already-used refresh tokens.
