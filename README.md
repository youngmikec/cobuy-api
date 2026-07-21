# Co-Buy API

Co-Buy is a community pooling platform: a group creates a **pool** with a target amount and a deadline, members join and pay their share into a unique Monnify virtual account, and once the target is reached the full amount is automatically disbursed to a beneficiary (who doesn't even need a Co-Buy account). If the deadline passes before the target is met, every contributor is automatically refunded.

This repo is the backend API — Fastify + TypeScript + PostgreSQL (via Prisma) — that powers pool creation/joining, Monnify-backed payments (virtual accounts, disbursements, refunds, webhooks), auth (with email OTP verification), notifications, and realtime updates over Socket.IO.

> **Branch note:** `main` is stable, but the **`sandbox`** branch is currently the most up to date and is where active work lands first. If you're picking up recent changes, branch off `sandbox`, not `main`.

## Tech stack

- **Runtime:** Node.js 22+, TypeScript
- **Framework:** Fastify 5 (`@fastify/cors`, `@fastify/helmet`, `@fastify/jwt`, `@fastify/swagger`)
- **Database:** PostgreSQL via Prisma ORM
- **Realtime:** Socket.IO (pool/transaction/notification updates)
- **Payments:** Monnify (virtual accounts, name enquiry, disbursements, webhooks)
- **Email:** Brevo or SMTP (via Nodemailer), toggled with `EMAIL_PROVIDER`
- **Validation:** Zod

## Project structure

```
src/
├── controllers/        # Request handlers, one file per domain
├── routes/              # Fastify route registration + Swagger schemas
├── schemas/             # Zod input schemas
├── services/
│   ├── route-services/       # Business logic backing controllers
│   └── third-party-services/ # Monnify, email, etc.
├── middlewares/         # Auth guard, schema validation, etc.
├── helpers/             # OTP, password/JWT, error, and other utilities
├── jobs/                # Scheduled/background jobs (e.g. pool expiry sweep)
├── lib/                 # Prisma client, shared singletons
├── types/               # Shared TypeScript types
└── index.ts             # App bootstrap (plugins, Swagger, Socket.IO, listen)

prisma/
├── schema.prisma        # Data model
└── migrations/          # SQL migration history
```

## Prerequisites

- Node.js `>= 22.12.0` (matches the `engines` field in `package.json`)
- A PostgreSQL database (local install, or use the provided Docker Compose setup)
- npm

## Local setup

### 1. Clone and check out `sandbox`

```bash
git clone <repo-url>
cd co-buy-api
git checkout sandbox
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in the values:

```bash
cp .env.example .env
```

Key variables (see `.env.example` for the full, commented list):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Port the API listens on (default `3000`) |
| `APP_BASE_URL` | Public base URL used for share links, payment redirects, and the Swagger "production" server entry |
| `SOCKET_CORS_ORIGIN` | CORS origin for Socket.IO (mobile-only client, so left permissive by default) |
| `EMAIL_PROVIDER` | `brevo` or `smtp` — selects how OTP/notification emails are sent |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Sender identity for outgoing email |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Required only if `EMAIL_PROVIDER=smtp` |
| `MONNIFY_BASE_URL`, `MONNIFY_API_KEY`, `MONNIFY_SECRET_KEY`, `MONNIFY_MERCHANT_CODE` | Monnify sandbox/production credentials |
| `MONNIFY_ENV` | `sandbox` or `production` — also controls whether webhook signature verification runs |
| `PLATFORM_FEE_PERCENT` | Platform fee percentage deducted before disbursement |

For local development, use Monnify's **sandbox** credentials (`MONNIFY_BASE_URL=https://sandbox.monnify.com/api/v1`, `MONNIFY_ENV=sandbox`) — no real money moves.

### 4. Start PostgreSQL

You have two options:

**Option A — Docker Compose (recommended, no local Postgres install needed):**

```bash
docker compose -f docker-compose.dev.yml up postgres -d
```

This starts Postgres on `localhost:5432`. Point `DATABASE_URL` in your `.env` at it, e.g.:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/cobuy_dev
```

**Option B — your own local Postgres install:**

Create a database and point `DATABASE_URL` at it.

### 5. Run migrations and generate the Prisma client

```bash
npm run prisma:generate
npm run prisma:migrate:dev
```

### 6. Start the dev server

```bash
npm run dev
```

The API starts on `http://localhost:3000` (or whatever `PORT` you set), with hot reload via `tsx watch`.

### 7. Explore the API

Interactive Swagger docs are served at:

```
http://localhost:3000/docs
```

## Running everything in Docker (API + Postgres)

If you'd rather not run Node locally at all:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This builds the dev image, starts Postgres, and runs the API with source mounted for hot reload.

For a production-style build (multi-stage `Dockerfile`, migrations run automatically via `docker-entrypoint.sh` before the app starts):

```bash
docker compose up --build
```

## Useful scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the API in watch mode |
| `npm run build` | Type-check and compile to `dist/` |
| `npm start` | Run the compiled build (`dist/index.js`) |
| `npm run prisma:generate` | Regenerate the Prisma client after a schema change |
| `npm run prisma:migrate:dev` | Create/apply a migration in development |
| `npm run prisma:migrate:deploy` | Apply pending migrations (used in production/CI) |
| `npm run prisma:studio` | Open Prisma Studio to browse/edit data |
| `npm run prisma:reset` | Drop and recreate the database from migrations (destructive) |

## Notes on payments and webhooks

Monnify webhooks (disbursement/collection status changes) require a publicly reachable URL. For local testing, expose your dev server with a tunnel (e.g. `ngrok http 3000`) and register that URL as the webhook endpoint in your Monnify sandbox dashboard.
