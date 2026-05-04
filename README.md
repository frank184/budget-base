# Budget Base

Budget Base is a small budgeting application split into two deployable apps:

- `ui/`: Vite + React frontend for the budgeting workspace.
- `api/`: NestJS + Fastify GraphQL API backed by PostgreSQL through Prisma.

The repo is intentionally a monorepo, but the UI and API are deployed as separate Vercel projects.
Local development is simplest through Docker Compose.

## Quick Start

```bash
docker compose up --build
```

This starts:

- UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3001`
- GraphQL: `http://127.0.0.1:3001/graphql`
- GraphiQL: `http://127.0.0.1:3001/graphiql`
- Postgres: `127.0.0.1:5432`

The API service reads `api/.env` and then Docker Compose overrides the connection settings needed for the local Postgres container.
Use `api/.env.example` as the starting point for local secrets.

## App Docs

- [API README](api/README.md): NestJS, Fastify, GraphQL, Prisma/Postgres, auth, and API deployment notes.
- [UI README](ui/README.md): React app structure, Apollo data flow, autosave behavior, auth bootstrap, and UI deployment notes.

## Local Development

Docker Compose is the default integration path because it gives the API a real Postgres database and runs both apps with file watching:

```bash
docker compose up --build
```

You can also run each app directly:

```bash
cd api
npm install
npm run dev
```

```bash
cd ui
npm install
npm run dev
```

When running outside Compose, make sure `DATABASE_URL`, Google OAuth values, and `VITE_API_BASE_URL` line up with the local URLs you are using.

## Deployment Model

Vercel hosts the UI and API as separate projects:

- `budget-base-ui`: root directory `ui`, framework preset Vite.
- `budget-base-api`: root directory `api`, framework preset NestJS.

There is no repo-root `vercel.json`.
Each Vercel project should use its own root directory setting.

The production UI calls the API through a same-origin proxy:

- browser calls `https://budget-base-ui.vercel.app/api/...`
- `ui/vercel.json` rewrites `/api/:path*` to `https://budget-base-api.vercel.app/:path*`

This keeps OAuth/session cookies first-party for Safari and avoids relying on cross-site cookies between two `vercel.app` subdomains.
For that flow, the Google OAuth redirect URI must include:

```text
https://budget-base-ui.vercel.app/api/auth/google/callback
```

Keep the direct API callback configured too if you still use direct API auth testing:

```text
https://budget-base-api.vercel.app/auth/google/callback
```

## Data Model

Budget data is stored relationally in Postgres through Prisma.
The main resources are users, Google identities, refresh sessions, budgets, months, categories, category plans, and transactions.

The UI treats server state as canonical, but performs local updates immediately and persists snapshots back through GraphQL mutations.
