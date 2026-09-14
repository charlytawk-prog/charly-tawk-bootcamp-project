# Internal Operations Service Hub
A small, working backend for the AI Academy 2026 bootcamp — Week 2.

## 1. What is this project?
The Internal Operations Service Hub is a ticketing system that lets employees 
submit internal service requests (IT, HR, Finance) and tracks each request 
through a controlled lifecycle as it moves between departments, instead of 
being lost in scattered emails and DMs.

This repository contains the Week 1 design work (product spec, data model, 
architecture diagram) and the Week 2 implementation: a small, working slice 
of the ticket lifecycle — creating tickets and moving them through their 
first states, with clear rules about what's allowed and what isn't.

## 2. What does this implementation actually do?
This is a bounded backend slice, not the full product. It covers:
- Creating a ticket, with validation that it belongs to a real user and a real department queue
- Moving a ticket through its first three lifecycle states, in order: `Submitted` → `Pending Review` → `Routed`
- Rejecting any attempt to skip a state, move backward, or use an unrecognized status — with a clear error, never a crash

Deliberately not included this week: authentication, authorization, a 
frontend, and the later lifecycle states (`In Progress`, `Resolved`). Data 
is persisted in SQLite through Prisma and initialized by `prisma/seed.ts`.

## 3. What do I need installed?
| Tool | Version | Check with |
|---|---|---|
| Node.js | 18+ (LTS) | `node -v` |
| npm | comes with Node.js | `npm -v` |
| Git | any recent version | `git --version` |

No external database, Docker, or accounts are required.

## 4. How do I get the project?
\`\`\`
git clone https://github.com/charlytawk-prog/charly-tawk-bootcamp-project.git
cd charly-tawk-bootcamp-project
\`\`\`
Open the folder in your code editor (VS Code, Cursor — either is fine).

## 5. How do I install the dependencies?
From the root of the project, once:
\`\`\`
npm install
\`\`\`

## 6. Week 2: Run & Verify

### Run the server
\`\`\`
npm run dev
\`\`\`
Server starts on http://localhost:5000 (or the PORT set in .env).

### Verify: 2 valid transitions

**1. Submitted → Pending Review**
\`\`\`
curl -X PUT http://localhost:5000/api/tickets/ticket-1 \
  -H "Content-Type: application/json" \
  -d '{"status": "Pending Review"}'
\`\`\`
Expected: `200`, ticket-1 now has `"status": "Pending Review"`.

**2. Pending Review → Routed**
\`\`\`
curl -X PUT http://localhost:5000/api/tickets/ticket-1 \
  -H "Content-Type: application/json" \
  -d '{"status": "Routed"}'
\`\`\`
Expected: `200`, ticket-1 now has `"status": "Routed"`.

### Verify: 2 invalid transitions

**3. Skipping a state (Submitted → Routed directly)**
\`\`\`
curl -X POST http://localhost:5000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Test skip","description":"test","userId":"user-1","queueId":"queue-1"}'
\`\`\`
(Note the new ticket's id from the response, e.g. `ticket-172...`, then:)
\`\`\`
curl -X PUT http://localhost:5000/api/tickets/<new-ticket-id> \
  -H "Content-Type: application/json" \
  -d '{"status": "Routed"}'
\`\`\`
Expected: `400`, `{"error": "Invalid transition: cannot move from 'Submitted' to 'Routed' directly"}`

**4. Moving backward (Routed → Submitted)**
\`\`\`
curl -X PUT http://localhost:5000/api/tickets/ticket-1 \
  -H "Content-Type: application/json" \
  -d '{"status": "Submitted"}'
\`\`\`
Expected: `400`, `{"error": "Invalid transition: cannot move from 'Routed' to 'Submitted' directly"}`

### Verify: invariant enforcement

**5. Creating a ticket with a nonexistent userId**
\`\`\`
curl -X POST http://localhost:5000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Bad user","description":"test","userId":"user-999","queueId":"queue-1"}'
\`\`\`
Expected: `400`, `{"error": "Invalid userId: no such user exists"}`

## 7. Which folders should I look at first?
\`\`\`
charly-tawk-bootcamp-project/
├── README.md                       <- you are here
├── product-spec.md                 <- Week 1: what we're building and why
├── data-model.md                   <- Week 1: entities, lifecycle, rules
├── architecture.md.excalidraw      <- Week 1: system diagram
├── docs/
│   └── week2-agentic-workflow.md   <- Week 2: how this was built and verified
├── prisma/
│   ├── schema.prisma                <- SQLite schema and relations
│   └── seed.ts                      <- starting users, queues, and tickets
└── src/
  ├── tickets/                     <- ticket controller, service, module
  ├── users/                       <- user controller, service, module
  ├── queues/                      <- queue controller, service, module
  └── prisma/                      <- Prisma client provider
\`\`\`
Start with `src/tickets/tickets.service.ts` — that's where the lifecycle and invariant behavior lives.

## 8. What should I ignore for now?
- `node_modules/` — downloaded packages, never edited by hand
- `package-lock.json` — an exact record of those downloads
- `.env` — local configuration (port number)

## 9. How do I stop the app?
Click into the terminal running it and press `Ctrl + C`.

## If something goes wrong
- **`npm run dev` says a port is already in use.** Something else is using port 5000. Stop it, or change `PORT` in `.env`.
- **A request returns nothing / connection refused.** The server probably isn't running — check the terminal for `Server is running on http://localhost:5000`. If it's not there, restart with `npm run dev`.
- **`node -v` shows a version older than 18.** Install the current LTS from https://nodejs.org and retry.
