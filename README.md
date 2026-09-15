# Internal Operations Service Hub

The Internal Operations Service Hub is a ticketing system that lets employees submit internal service requests (IT, HR, Finance) and tracks each request through a controlled lifecycle as it moves between departments, instead of being lost in scattered emails and DMs.

This repository contains the Week 1 design work and the Week 3 full-stack delivery: a React/Vite interface for submitting a ticket and viewing a ticket by ID, a NestJS API, Prisma/SQLite persistence, relational reference validation, and an ownership check based on the `x-user-id` header. The backend also retains the first three lifecycle states: `Submitted` -> `Pending Review` -> `Routed`.

## What this implementation does

- Submit a ticket with a title, description, priority, user ID, and queue ID.
- Reject a ticket when its `userId` or `queueId` does not exist.
- View a ticket by ID only when the supplied `x-user-id` matches the ticket owner.
- Move tickets through `Submitted`, `Pending Review`, and `Routed` in order.
- Persist data in SQLite through Prisma.

Authentication, external integrations, runtime AI, CI/CD, deployment, monitoring, production infrastructure, and the later lifecycle states `In Progress` and `Resolved` are out of scope. The `x-user-id` header is unverified identity input, not authentication.

## Prerequisites

Install:

| Tool | Required version | Check |
|---|---|---|
| Node.js | 18 or newer | `node --version` |
| npm | Included with Node.js | `npm --version` |
| Git | Any recent version | `git --version` |

No external database, Docker, or account is required.

## Install

From a fresh clone, run these commands from the repository root:

```sh
git clone https://github.com/charlytawk-prog/charly-tawk-bootcamp-project.git
cd charly-tawk-bootcamp-project
npm install
npx prisma migrate deploy
npm run prisma:seed
```

Install the frontend dependencies in a second shell, or after the root commands finish:

```sh
cd frontend
npm install
cd ..
```

`npx prisma migrate deploy` applies the committed migration in `prisma/migrations/`. `npm run prisma:seed` creates the demo users, queues, and `ticket-1`. The local SQLite connection is configured in `.env` as `file:./dev.db`.

## Run

Start the backend from the repository root:

```sh
npm run dev
```

The NestJS API listens on `http://localhost:5000` by default. The port comes from `PORT=5000` in `.env`.

In a second shell, start the frontend:

```sh
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite is configured to proxy `/api` requests to `http://localhost:5000`.

## Exercise the flow

1. Open `http://localhost:5173`.
2. In **Submit a ticket**, enter any title and description. Keep **Acting as user ID** as `user-1`, keep **Queue ID** as `queue-1`, and choose a priority.
3. Select **Create ticket**. The UI shows the returned ticket ID and its initial `Submitted` status. The backend returns `201` for this request.
4. In **View a ticket by ID**, type the seeded ticket ID `ticket-1` and user ID `user-1`, then select **View ticket**. This is the allowed case: `ticket-1` belongs to seeded user `user-1`, so the UI displays the ticket and the API returns `200`.
5. Keep `ticket-1`, change **Your user ID** to `user-2`, and select **View ticket** again. This is the denied case: `user-2` is a real seeded user but is not the owner, so the UI displays the backend error and `HTTP 403`.

The seed data also includes user `user-3` and queue `queue-2`. To reset the known demo records after experimenting, run `npm run prisma:seed` again from the repository root.

## Tests

From the repository root:

```sh
npm test
```

Expected passing output includes:

```text
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

The suite covers lifecycle transition rules, real SQLite persistence and foreign-key reference validation, HTTP ownership authorization, and lifecycle regression behavior.

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
│   └── week3-full-stack-delivery.md
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
│   ├── controllers/
│   ├── middleware/
│   ├── prisma/
│   ├── queues/
│   ├── routes/
│   ├── tickets/
│   └── users/
└── test/
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
