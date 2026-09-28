# Internal Operations Service Hub

Internal Operations Service Hub lets employees submit IT, HR, and Finance service requests and track them through a five-state workflow. Department Agents work their assigned queues; System Admins manage users and tickets. The current implementation uses a React/Vite frontend, a NestJS API, Prisma with PostgreSQL, and JWT authentication.

## Live App

- Frontend: [Netlify app](https://celebrated-medovik-966052.netlify.app)
- Backend: [Railway service](https://charly-tawk-bootcamp-project-production.up.railway.app)
- Health: [GET /api/health](https://charly-tawk-bootcamp-project-production.up.railway.app/api/health)

The live app supports employee ticket submission and history, department queue work and status updates, and guarded System Admin ticket and user management. The public health endpoint reports database availability without exposing credentials or other secrets.

Seeded demo access (TEST-ONLY fake data; password is public on purpose):

| Role at seed time | Email | Password |
|---|---|---|
| Employee | `alice@example.com` | `password123` |
| IT Department Agent | `bob@example.com` | `password123` |
| HR Department Agent | `helen@example.com` | `password123` |
| Finance Department Agent | `frank@example.com` | `password123` |
| System Admin | `charlie@example.com` | `password123` |

Admin users can change roles, so live roles may drift from the seeded roles shown here.

Critical journey to try: Alice signs in, requests an AI suggestion, reviews it, and creates a ticket. Bob signs in and advances a ticket in the IT queue. Alice opening `/admin` is redirected to her Employee workspace.

The Railway backend is on a Limited Trial plan and stays available only while trial credit remains.

## Engineer Quick Start

### Prerequisites

| Tool | Requirement | Verified source |
|---|---|---|
| Node.js | 22 (Dockerfile base image) | `node --version` |
| Docker Desktop | Running Docker engine | `docker compose up -d postgres` |
| Git | Installed | `git --version` |

Clone and install from the repository root:

```sh
git clone https://github.com/charlytawk-prog/charly-tawk-bootcamp-project.git
cd charly-tawk-bootcamp-project
npm install
cd frontend
npm install
cd ..
```

Create the root `.env` from `.env.example` and configure the variable names `DATABASE_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`, and `GROQ_API_KEY`. The frontend example uses `VITE_API_URL`; leave it empty for local Vite proxy use or configure it for the deployed API. Groq is optional for ordinary manual ticket creation. Do not put secret values in documentation or source control.

### Start the local app

Start PostgreSQL with Docker Compose, then apply the schema and seed through the backend container (the container commands also avoid the documented Windows P1000 issue):

```sh
docker compose up -d postgres
docker compose run --rm --entrypoint npx backend prisma migrate deploy
docker compose run --rm --entrypoint npx backend prisma db seed
```

Run the backend from the repository root and the frontend from `frontend/`:

```sh
npm run start:dev
cd frontend
npm run dev
```

Open `http://localhost:5173/login`. The Compose Postgres service is published locally on port 5432; the backend defaults to port 5000 and the frontend to port 5173.

### AI setup and evaluation

AI intake is optional and advisory: it suggests a title, description, queue, and priority; it does not create tickets or advance their state. The employee reviews the suggestion and submits through the existing ticket flow. Backend validation still checks queue and priority values.

Set `GROQ_API_KEY` in the root `.env` to enable real provider requests. `npm run eval:ai` runs six network-dependent cases and requires that variable and network access. Results vary between runs; very thin input may take a graceful fallback path. `npm test` uses the fake provider for deterministic provider-contract tests.

### Tests

Run the suite in the Dockerfile's test stage against `ops_hub_test`. Set `TEST_DATABASE_URL` to use the Compose hostname `postgres` and that test database. In PowerShell, make the same URL available as `$env:TEST_DATABASE_URL` for the migration invocation; keep its value out of documentation.

```powershell
docker compose up -d postgres
docker build --target test -t charly-tawk-bootcamp-project-test .
docker run --rm --network charly-tawk-bootcamp-project_default --env-file .env -e "DATABASE_URL=$env:TEST_DATABASE_URL" charly-tawk-bootcamp-project-test npx prisma migrate deploy
docker run --rm --network charly-tawk-bootcamp-project_default --env-file .env charly-tawk-bootcamp-project-test
```

Verified passing output: `Test Suites: 6 passed, 6 total`; `Tests: 48 passed, 48 total`.

### Release gate

Run `npm run release-gate` from the repository root. It stops at the first failure and runs, in order: backend build, frontend build, the README Dockerfile test workflow against `ops_hub_test`, and a clean `git status --short` check. `RELEASE GATE: GO` means all four checks passed; `RELEASE GATE: NO-GO` means a check failed. The gate also prints the current HEAD SHA and run time. Commit the intended changes before running it when a clean-tree result is required.

The AI evaluation is a separate optional command: `npm run eval:ai`. It requires `GROQ_API_KEY` and network access; output varies between runs.

### Windows Prisma P1000 note

Running Prisma CLI commands directly on Windows against Docker Postgres can fail with P1000 even when `.env` is configured. Run Prisma commands through the Compose backend container instead:

```sh
docker compose run --rm --entrypoint npx backend prisma migrate dev
docker compose run --rm --entrypoint npx backend prisma migrate deploy
docker compose run --rm --entrypoint npx backend prisma db seed
docker compose run --rm --entrypoint npx backend prisma studio
```

## Operations

### Health and logs

`GET /api/health` is public. It runs `SELECT 1` through Prisma and returns `200` with `status: "ok"` and `database: "up"` when the database query succeeds. A failed query returns `503` with `status: "degraded"` and `database: "down"`. The response fields are `status`, `database`, `version`, `commit`, and `uptimeSeconds`; the version comes from `package.json`, and the commit field reads `RAILWAY_GIT_COMMIT_SHA` or falls back to `unknown`.

For local logs, use `docker compose logs --tail 30 backend`. In the captured local tail, Nest logged route mappings including `GET /api/health` and then `Nest application successfully started`. The only explicit application-source log call is `[AI] Provider unavailable` when the AI provider fails; health-query failures are caught without logging the error or stack.

For live logs, use the Railway dashboard, select the backend service, then **Deployments** and **Deploy Logs**. The live `/api/health` check returned `{"status":"ok","database":"up","version":"1.0.0","commit":"unknown","uptimeSeconds":91}`. Live commit identity is not being reported yet.

### Database outage and recovery evidence

The recorded local Docker test showed:

| Stage | Action | Health result |
|---|---|---|
| Before | PostgreSQL running | `{"status":"ok","database":"up",...,"uptimeSeconds":446}`; HTTP 200 |
| During | PostgreSQL stopped with `docker compose stop postgres` | `{"status":"degraded","database":"down",...,"uptimeSeconds":465}`; HTTP 503 |
| Recovery | PostgreSQL started with `docker compose start postgres` | `{"status":"ok","database":"up",...,"uptimeSeconds":504}`; HTTP 200 |

Uptime continued increasing, so the backend process did not restart and required no manual restart. After recovery, login as Alice followed by `GET /api/tickets/mine` returned HTTP 200. During the outage, a login request with an empty body returned 401; that does not establish how a real login behaves during a database outage.

### Deployment and release identity

Netlify builds from GitHub `main`, with base directory `frontend`, publish directory `frontend/dist`, and the `VITE_API_URL` environment variable. The Railway backend is built from the repository-root Dockerfile and uses the variable names `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, and `FRONTEND_ORIGIN`; `DATABASE_URL` references Railway Postgres. Railway GitHub auto-deploy is currently broken, so backend deployments use `railway up` from the developer machine. Do not copy secret values into docs or logs.

Release identity: Railway currently reports `commit: "unknown"`. [PENDING: capture the final commit SHA and verify live commit reporting in `/api/health`].

### Live smoke check

Run `npm run smoke` for seven live, read-only checks: API health; Alice login; authenticated `/api/tickets/mine` returns an array; Alice receives 403 from `/api/admin/users`; unauthenticated `/api/tickets/mine` returns 401; the Netlify root returns 200; and `/employee` returns 200 as a deep link. `SMOKE_API_URL` and `SMOKE_WEB_URL` override the default production base URLs. `SMOKE: GO` means all seven checks returned their expected results; `SMOKE: NO-GO` means at least one did not. The script prints health version, commit, and time, but never credentials or tokens.

Latest run: the first six checks passed, but the Netlify `/employee` deep-link check failed. Do not treat deep-link handling as passing until it is corrected and the smoke check passes.

## Evidence Map

| Week | Evidence | What it records | Reproduction / review |
|---|---|---|---|
| 1 | [Architecture diagram](architecture.md.excalidraw), [data model](data-model.md.txt), [product specification](product-spec.md.txt) | Initial design and requirements | Review the saved design artifacts; the later implementation is documented below. |
| 2 | [Week 2 workflow](docs/week2-agentic-workflow.md) | Point-in-time JSON/Express workflow and lifecycle rules | Current lifecycle regression coverage is in the container test suite above; the original JSON-based implementation is superseded. |
| 3 | [Week 3 delivery](docs/week3-full-stack-delivery.md) | Point-in-time full-stack API and frontend delivery | Run the container test suite above; see the superseding storage/deployment notes in Week 5. |
| 4 | [Week 4 authentication](docs/week4-authentication.md), [Week 4 AI](docs/week4-production-ai.md) | JWT/bcrypt authentication and advisory AI intake | Run the container test suite and, when configured, `npm run eval:ai`. |
| 5 | [Final capstone](docs/week5-final-capstone.md) | PostgreSQL, deployment, health, admin onboarding, and operations evidence | Use the container test workflow above and the health/outage evidence in Operations. |

## Known Limitations

- No password change or reset flow; an admin sets a temporary password.
- Email uniqueness is checked in the service, not enforced by a database constraint.
- JWTs are stored in `localStorage`; there are no refresh tokens or login rate limits.
- Demo credentials are public by design, and the live database contains test users created during verification. Admin role changes can make live roles differ from the seed table.
- Railway is on a Limited Trial plan; availability lasts only while credit remains.
- Audit log and ticket comments are not built.
- Attachment bytes are stored on the container filesystem in `uploads/`; survival across redeploy has not been tested.
- [PENDING: run the README from a fresh clone].
- Attachment persistence: tested and confirmed NOT persistent across a backend redeploy. Attachments uploaded and downloaded successfully before a Railway redeploy (railway up) returned HTTP 404 on download after that redeploy, while the ticket record itself was unaffected. Cause: uploaded files are stored on the container's local disk (uploads/), which Railway does not preserve across redeploys. Ticket data in Postgres is unaffected and persists correctly across redeploys. Fix for a future phase: move file storage to a Railway volume or an external object store (e.g. S3-compatible storage).
│   ├── index.html
