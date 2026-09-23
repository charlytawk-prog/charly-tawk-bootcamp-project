# Internal Operations Service Hub

The Internal Operations Service Hub is a ticketing system that lets employees submit internal service requests (IT, HR, Finance) and tracks each request through a controlled lifecycle as it moves between departments, instead of being lost in scattered emails and DMs.

This repository contains the Week 1 design work and the full-stack delivery: a React/Vite interface with routed Employee and Department Agent workspaces; a NestJS API; Prisma/SQLite persistence; JWT authentication; JWT-backed ownership checks; department-scoped queue access; and the five-state lifecycle `Submitted` -> `Pending Review` -> `Routed` -> `In Progress` -> `Resolved`.

## What this implementation does

- Log in with a seeded email and password to receive a persisted browser JWT session.
- Redirect Employees to `/employee`, Department Agents to `/agent`, and the seeded System Admin to `/admin` after login.
- Protect role dashboards from direct URL access by the wrong role.
- Submit a ticket with a title, description, priority, and queue ID.
- Reject a ticket when its `userId` or `queueId` does not exist.
- View a ticket by ID only when the verified JWT identity matches the ticket owner.
- View the authenticated employee's tickets in newest-first order.
- Let Department Agents view tickets in their own department's queue.
- Let Department Agents search their queue and advance their own department's tickets from `Routed` to `In Progress` to `Resolved`.
- Move tickets through all five lifecycle states in order.
- Persist data in SQLite through Prisma.
- Use optional AI-assisted intake to suggest ticket fields from a free-text issue description.

## Admin capabilities

The seeded System Admin is Charlie Admin: `charlie@example.com` with the test-only password `password123`. After login, the frontend redirects to `/admin`. The admin dashboard lists and filters all tickets across IT, HR, and Finance, edits queue, priority, and any of the five valid ticket states, and manages user roles and departments. The backend endpoints are guarded under `/api/admin/*`; employees and Department Agents cannot access them. User responses use only `id`, `name`, `email`, `role`, and `department`; passwords are never returned. The admin status override is deliberately isolated from the existing one-step employee/agent transition logic, and no audit log or change-history feature is built yet.

## Implementation Notes

The implemented architecture intentionally differs from the original planning diagram in two areas. Authentication is self-hosted: the NestJS API validates bcrypt password hashes and issues signed JWTs. NestJS guards verify JWTs and enforce role- and department-based authorization on protected endpoints. This avoids external authentication dependencies and supports the project's learning objectives; the auth module and token boundary can be replaced with an enterprise SSO integration in a future phase.

Persistence uses Prisma with SQLite. Ticket attachments are written to the repository's `uploads/` directory, while Prisma records each attachment's ticket relationship, original filename, stored path, MIME type, size, and upload time. Cloud blob storage was deferred because production infrastructure is outside the current project phase.

Enterprise SSO/Auth0 and cloud blob storage are therefore not part of the current implementation.

CI/CD, deployment, monitoring, and production infrastructure are out of scope. Admin endpoints are implemented under `/api/admin/*` as described above. AI-assisted intake is implemented as an optional external integration described below. The frontend stores the JWT in `localStorage` for this development/teaching tool so refreshes preserve the session; this is not a production security posture.

## Prerequisites

Install:

| Tool | Required version | Check |
|---|---|---|
| Node.js | 18 or newer | `node --version` |
| npm | Included with Node.js | `npm --version` |
| Git | Any recent version | `git --version` |

No external database or Docker is required. A Groq account and API key are optional for AI-assisted intake; manual ticket creation does not require them.

## Install and run

Use this sequence from a fresh clone.

```sh
git clone https://github.com/charlytawk-prog/charly-tawk-bootcamp-project.git
cd charly-tawk-bootcamp-project
npm install
cd frontend
npm install
cd ..
```

Set up the root `.env` file before starting the app. The app runs completely normally without a Groq API key; the AI assist simply will not work until `GROQ_API_KEY` is configured. For live AI suggestions, add:

```dotenv
GROQ_API_KEY=your-groq-api-key
```

Then apply the schema and seed the demo data:

```sh
npx prisma migrate deploy
npm run prisma:seed
```

Start the backend in one terminal:

```sh
npm run start:dev
```

Then start the frontend in a second terminal:

```sh
cd frontend
npm run dev
```

Confirm the app is healthy before trying AI features: open `http://localhost:5173/login`, log in with `alice@example.com` and `password123`, and verify the Employee dashboard loads normally. After that, use the AI suggestion flow in the Employee workspace.

If every request including login fails with 502, the backend process isn't running or failed to start — check its terminal output directly.

### Other run commands

Run these from the repository root:

```sh
npm run build       # Compile the backend
npm start           # Start the compiled backend
npm run start:prod  # Run dist/main.js
npm test            # Run the test suite
npm run eval:ai     # Run the real Groq evaluation; no key means the app still boots, but AI suggestions will be unavailable
```

## Exercise the flow

1. Open `http://localhost:5173/login`.
2. Log in with `alice@example.com` and `password123`. This is TEST-ONLY seed data. The app redirects to `/employee` and persists the JWT in browser storage so refresh keeps the Employee dashboard open.
3. In **My Tickets**, Alice sees only her own seeded tickets, newest first, with visible status and priority badges. Select a ticket to load its full detail.
4. In **Submit a ticket**, choose a readable department queue such as `Technical Support (IT)`, enter a title and description, choose a priority, and select **Create ticket**. The request sends the underlying queue ID through the API, while the UI keeps the choice human-readable; the new ticket appears in My Tickets with `Submitted` status.
5. Log out, then log in with `bob@example.com` and `password123`. Bob is a seeded IT Department Agent. The app redirects to `/agent`, where his dashboard shows separate **Open** and **Finished** queue lanes.
6. Use the queue search to filter by title or ID. Ticket rows and detail views show names such as `Technical Support · IT` instead of raw queue IDs. For an `In Progress` ticket, select **Mark Resolved** and confirm it moves to Finished after the queue refreshes. For a `Routed` ticket, select **Start Processing** and confirm it becomes `In Progress`.
7. Try changing the URL manually from `/employee` to `/agent` while logged in as Alice, or from `/agent` to `/employee` while logged in as Bob. The route guard redirects each user back to their permitted dashboard.
8. Log out to return to `/login`; refresh afterward and confirm the stored session is gone.
9. The backend also preserves the owner-only detail rule: a different user's valid JWT receives `HTTP 403`, a missing/invalid JWT receives `HTTP 401`, and a fake ticket ID receives `HTTP 404`.

Seeded TEST-ONLY accounts include `alice@example.com` (Employee), `bob@example.com` (Department Agent, IT), `helen@example.com` (Department Agent, HR), and `frank@example.com` (Department Agent, Finance). They all use `password123`. To reset the known demo records after experimenting, run `npm run prisma:seed` again from the repository root.

## AI-Assisted Intake (Week 4)

The optional AI assist turns an employee's plain-text issue description into a reviewable title, description, queue, and priority suggestion; it never creates a ticket by itself.

### Setup

1. Open [console.groq.com](https://console.groq.com), open **API Keys**, and select **Create API Key**.
2. Add the key to the repository root `.env` file:

```dotenv
GROQ_API_KEY=your-groq-api-key
```

The feature degrades gracefully without a key or with an invalid key: the suggest request returns a handled provider failure, the UI shows `AI suggestion unavailable — please fill out the form below manually`, and manual ticket creation remains available. This was verified through the browser with a forced `provider_unavailable` response; the manually completed ticket still created normally.

### Exercise the AI flow

In the Employee workspace, describe your issue in plain text in **Describe your issue in your own words**, then select **Get AI suggestion**. Review and edit the prefilled title, description, queue, and priority as needed, and select **Create ticket** as normal.

### Run the eval

From the repository root:

```sh
npm run eval:ai
```

The eval checks real Groq suggestions against the real queue catalog and priority enum, exercises the retry-and-hard-fail bounded-context proof, and checks fake invalid-output and provider-failure responses. Unlike `npm test`, it makes real network calls to Groq and requires a working `GROQ_API_KEY`.

## Tests

From the repository root:

```sh
npm test
```

Expected passing output includes:

```text
Test Suites: 5 passed, 5 total
Tests:       38 passed, 38 total
```

The suite covers authentication, JWT verification, the complete five-state lifecycle, real SQLite persistence and foreign-key reference validation, personal ticket history, HTTP ownership authorization, department queue scoping, guarded agent status updates, lifecycle regression behavior, and the AI provider contract and graceful failure outcomes.

## Project structure

```text
charly-tawk-bootcamp-project/
├── README.md
├── architecture.md.excalidraw
├── data-model.md.txt
├── product-spec.md.txt
├── package.json
├── jest.config.js
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── data/
├── docs/
│   ├── week2-agentic-workflow.md
│   ├── week3-full-stack-delivery.md
│   └── week4-production-ai.md
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       └── styles.css
├── postman/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20260914110330_init/
│           └── migration.sql
├── src/
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── main.ts
│   ├── ai/
│   ├── controllers/
│   ├── middleware/
│   ├── prisma/
│   ├── queues/
│   ├── routes/
│   ├── tickets/
│   └── users/
└── test/
    ├── ai-eval.ts
    ├── ai-provider.spec.ts
    ├── test-database.ts
    └── tickets.spec.ts
```

The main ticket flow is in `src/tickets/`; the Prisma client provider is in `src/prisma/`; and the browser flow is in `frontend/src/main.jsx`.

## Troubleshooting

- **Port 5000 is already in use:** Stop the process using port 5000, or change `PORT` in `.env` and update the Vite proxy in `frontend/vite.config.js` to the same backend port.
- **Port 5173 is already in use:** Stop the process using port 5173, or change `server.port` in `frontend/vite.config.js`, then open the new Vite URL.
- **The seeded ticket or users are missing:** From the repository root, run `npm run prisma:seed`, then reload the frontend. Use `ticket-1`, `user-1`, `user-2`, and `queue-1` for the documented flow.
- **The database is not ready:** From the repository root, run `npx prisma migrate deploy`, then `npm run prisma:seed`.
- **Node is older than 18:** Install a current Node.js LTS release, open a new shell, verify with `node --version`, and rerun the install commands.
- **The browser shows connection refused:** Start the backend with `npm run dev` and the frontend with `cd frontend` followed by `npm run dev`.

To stop either development server, focus its terminal and press `Ctrl+C`.
