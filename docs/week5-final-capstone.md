# Week 5: Final Capstone

## What was added

- PostgreSQL persistence through Prisma, with Docker Compose for local Postgres and Railway managed Postgres for the live backend.
- Netlify frontend deployment and a Railway backend deployment. Railway GitHub auto-deploy is currently broken, so the backend is deployed from the developer machine with `railway up`.
- Public `GET /api/health`, which runs `SELECT 1` through Prisma and returns healthy or degraded status without returning an error, stack trace, or secret.
- Guarded `POST /api/admin/users` for Employee onboarding. It accepts name, email, and password; fixes role to `Employee` and department to `null`; rejects role/department request fields; hashes passwords; and returns only the safe user projection.
- Security changes: public `POST /api/users` was removed; admin endpoints use `JwtAuthGuard` and `AdminGuard`; JWT expiry is four hours; password hashes are never returned; and `.env` is gitignored and was removed from Git history.

## Operations evidence

The live health request returned:

```json
{"status":"ok","database":"up","version":"1.0.0","commit":"unknown","uptimeSeconds":91}
```

The recorded local Docker/Postgres failure and recovery:

| Stage | Action | Observed response |
|---|---|---|
| Before outage | PostgreSQL was running | `{"status":"ok","database":"up",...,"uptimeSeconds":446}`; HTTP 200 |
| Outage | `docker compose stop postgres` | `{"status":"degraded","database":"down",...,"uptimeSeconds":465}`; HTTP 503 |
| Recovery | `docker compose start postgres` | `{"status":"ok","database":"up",...,"uptimeSeconds":504}`; HTTP 200 |

Uptime kept increasing, so the backend process did not restart and needed no manual restart. After recovery, Alice logged in and `GET /api/tickets/mine` returned HTTP 200. An empty-body login during the outage returned 401; this is not evidence about a real login with valid credentials during an outage.

The captured local backend log tail showed Nest route registrations, including `GET /api/health`, followed by `Nest application successfully started`. The only explicit application source log found is the AI provider-unavailable message. Health query errors are caught without logging their details.

## Deployment procedure

- Frontend: Netlify builds from GitHub `main`, with base directory `frontend`, publish directory `frontend/dist`, and environment variable `VITE_API_URL`.
- Backend: Railway builds from the repository-root Dockerfile. Its environment uses the variable names `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, and `FRONTEND_ORIGIN`; `DATABASE_URL` references Railway Postgres. Railway GitHub auto-deploy reports “Could not load branches”; deploy the backend from the developer machine using `railway up`.
- Live endpoints: [Netlify frontend](https://celebrated-medovik-966052.netlify.app), [Railway backend](https://charly-tawk-bootcamp-project-production.up.railway.app), [health endpoint](https://charly-tawk-bootcamp-project-production.up.railway.app/api/health).
- The Railway plan is a Limited Trial; the live backend remains available only while credit remains.

## Verification and pending release checks

The documented Dockerfile test-stage workflow against `ops_hub_test` passed with 6 suites and 48 tests. The health endpoint tests mock the Prisma query to verify HTTP 200 and 503 responses; the actual local database stop/start sequence above was verified by hand. The suite also covers authentication/JWT, ticket ownership and department scope, ticket lifecycle, admin employee creation, and the AI provider contract.

The live health response currently reports `commit: "unknown"`.

- [PENDING: capture the final commit SHA and verify live commit reporting in `/api/health`].
- The release-gate command is implemented as `npm run release-gate`; a GO result requires all four checks to pass, including a clean worktree.
- `npm run smoke` performs seven live read-only checks: health, Alice login, authenticated ticket history, Alice's denied admin-users request, unauthenticated ticket-history denial, Netlify root, and the `/employee` deep link. GO means all expected results pass; NO-GO means at least one fails. The latest run passed the first six checks but failed the deep-link check, so that behavior is not verified as passing.
- Attachment persistence: tested and confirmed NOT persistent across a backend redeploy. Attachments uploaded and downloaded successfully before a Railway redeploy (railway up) returned HTTP 404 on download after that redeploy, while the ticket record itself was unaffected. Cause: uploaded files are stored on the container's local disk (uploads/), which Railway does not preserve across redeploys. Ticket data in Postgres is unaffected and persists correctly across redeploys. Fix for a future phase: move file storage to a Railway volume or an external object store (e.g. S3-compatible storage).
- [PENDING: run the README from a fresh clone].

## Remaining risks

- No password change/reset flow; an admin assigns a temporary password.
- Email uniqueness is checked in the service but has no database uniqueness constraint.
- JWTs are stored in `localStorage`; there are no refresh tokens or login rate limits.
- Demo credentials are public by design. Live user roles can drift because an admin can change them.
- The live database contains test users created during verification.
- Railway's Limited Trial credit may expire.
- Audit log and ticket comments are not implemented.
- Attachment bytes remain on the container filesystem in `uploads/`; redeploy durability is unverified.

## Defense answers

**Allowed action:** An authenticated System Admin can create an Employee through `POST /api/admin/users`; tests verify the response excludes the password and the new credentials can log in.

**Rejected action:** An Employee or Department Agent receives 403 from admin user-management routes, and a request without a token receives 401. These cases are covered by `test/admin.spec.ts`.

**AI boundary:** AI may suggest title, description, queue, and priority. It cannot create a ticket or advance its state. The backend validates the suggestion against real queue/priority choices, and the employee reviews it before submitting through the normal flow.

**Automated versus manual evidence:** The 48-test container suite includes database-backed ticket/admin/auth coverage and mocked health-query success/failure. The reported live health payload and local Postgres outage/recovery sequence were manually checked. The Netlify deep-link and attachment persistence checks remain pending.