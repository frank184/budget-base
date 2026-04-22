# Budget Base API

Minimal local API for the Budget Base UI.

## Run

```powershell
cd api
npm run dev
```

The server listens on `http://127.0.0.1:3001`.
Swagger docs are available at `http://127.0.0.1:3001/docs`.

## Stack

- NestJS
- Fastify adapter
- SQLite via `better-sqlite3`

## Endpoints

- `GET /health`
- `GET /api/budget`
- `PUT /api/budget`
- `GET /api/months`
- `GET /api/months/:monthId`
- `PUT /api/months/:monthId`

## Storage

The API persists data to `api/data/budget-base.sqlite`.
It stores first-class relational resources:

- `budgets`
- `months`
- `categories`
- `category_links`
- `transactions`

On first run, if `api/data/budget-base.json` exists and the SQLite database is empty,
the API seeds those tables from that JSON snapshot automatically.
