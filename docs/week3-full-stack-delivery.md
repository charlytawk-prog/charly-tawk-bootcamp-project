# Week 3: Full-Stack Delivery

## The flow

The built user-facing flow is one narrow Service Request path:

1. Submit a ticket from the React form. `frontend/src/main.jsx` sends the form values as `POST /api/tickets`.
2. View a ticket by ID from the employee or agent workspace. `frontend/src/main.jsx` sends `GET /api/tickets/:id` with the authenticated session's bearer JWT.
3. The backend verifies the JWT, then checks ticket ownership or matching Department Agent scope before returning the ticket. The route is defined in `src/tickets/tickets.controller.ts`; `src/tickets/tickets.service.ts` creates and loads tickets; and guards enforce access rules.

The frontend display and request handling are in `frontend/src/main.jsx`, with presentation styles in `frontend/src/styles.css` and the Vite entry point in `frontend/index.html`.

## Architecture

- **React/Vite frontend:** The `frontend/` folder contains the Vite app. The key files are `frontend/index.html`, `frontend/src/main.jsx`, and `frontend/src/styles.css`.
- **NestJS backend:** `src/app.module.ts` composes `PrismaModule`, `AuthModule`, `TicketsModule`, `UsersModule`, `QueuesModule`, and `AiModule`. The ticket flow is owned by `src/tickets/`; JWT verification lives in `src/auth/`.
- **Prisma + SQLite persistence:** `prisma/schema.prisma` declares the SQLite datasource and the relational `User`, `DepartmentQueue`, `Ticket`, and `Attachment` models. Ticket foreign keys and attachment-ticket relations are indexed.
- **Authentication and authorization:** Self-hosted login verifies bcrypt password hashes and returns a signed JWT. `JwtAuthGuard` verifies bearer tokens, while ticket-access, ticket-owner, and department guards enforce ownership and department scope.
- **Attachments:** Multer writes attachment bytes to `uploads/`; Prisma persists each attachment's metadata and ticket relationship. Cloud storage is deferred with production infrastructure.
- **Why SQLite now:** `data-model.md.txt` requires relational entities and foreign-key integrity between users, tickets, and department queues. SQLite satisfies that requirement for this phase without introducing a server database. The assignment also constrains this phase to no production infrastructure, so a local SQLite database keeps the implementation runnable without external database infrastructure.

## API contract

The frontend flow uses these two endpoints. Nest returns a created ticket with status `201` by default for the `POST` handler and `200` for the successful `GET` handler.

### `POST /api/tickets`

Request JSON:

```json
{
  "title": "Cannot connect to VPN",
  "description": "User is getting a timeout error.",
  "priority": "high",
  "userId": "user-1",
  "queueId": "queue-1"
}
```

`priority` defaults to `medium` in the service when it is omitted. A successful `201` response is the created `Ticket` object, with the fields `id`, `title`, `description`, `status`, `priority`, `userId`, `queueId`, and `createdAt`. New tickets have status `Submitted` and IDs in the form `ticket-${Date.now()}`.

A nonexistent `userId` returns `400`:

```json
{"error":"Invalid userId: no such user exists"}
```

A nonexistent `queueId` returns `400`:

```json
{"error":"Invalid queueId: no such queue exists"}
```

The service checks `userId` first, so a request with both references missing returns the `userId` error.

### `GET /api/tickets/:id`

The request must include a bearer JWT issued by `POST /api/auth/login`:

```http
Authorization: Bearer <access_token>
```

A successful request returns `200` with the stored `Ticket` object. `TicketAccessGuard` permits the ticket owner or a Department Agent whose department matches the ticket's queue. A missing or invalid token returns `401`; an authenticated user without ticket access receives `403`.

If the ticket does not exist, the response is `404`:

```json
{"error":"Ticket not found"}
```

## The authorization rule

JWT identity is verified before authorization. Employees may view only their own tickets. Department Agents may view tickets only when their JWT department matches the ticket's queue department. `TicketAccessGuard` returns `403` for a verified identity that does not meet either rule.

## Invalid request rejected on purpose

Creating a ticket verifies both relational references before inserting it. A nonexistent `userId` is rejected with `400` and `{"error":"Invalid userId: no such user exists"}`. A nonexistent `queueId` is rejected with `400` and `{"error":"Invalid queueId: no such queue exists"}`. This preserves the invariant in `data-model.md.txt` that every ticket references an existing user and department queue.

## Expected failure handled on purpose

Requesting a nonexistent ticket returns a clean `404` with `{"error":"Ticket not found"}`. The service throws `NotFoundException` instead of allowing a missing record to cause a crash or expose a stack trace.

The guard resolves the ticket before applying the ownership or department check. Therefore, a missing ticket returns `404` after token verification rather than being confused with an authorization denial.

## Tests

The four tests in `test/tickets.spec.ts` cover separate contracts:

- **`enforces the lifecycle transition rule in isolation`** checks that the service accepts `Submitted` to `Pending Review` and rejects a direct `Submitted` to `Routed` transition with the exact invalid-transition error. Without it, the core ordering rule could regress independently of HTTP behavior.
- **`persists valid tickets and rejects a nonexistent user`** checks real SQLite persistence, the default `Submitted` status, stored fields, and the invalid-user invariant. Without it, tickets could appear to work in memory while failing to persist or accepting an unknown owner.
- **Authentication and authorization tests** check JWT issuance and verification, owner access, cross-user denial, and Department Agent department scoping.
- **`keeps the valid sequence and rejects moving backward`** checks the real database lifecycle sequence through `Pending Review` and `Routed`, then rejects `Routed` to `Submitted`. Without it, backward transitions could be accepted even if the isolated rule test still passed for its narrower case.

## What is deliberately out of scope

Enterprise SSO, cloud object storage, CI/CD, deployment, monitoring, and production infrastructure are out of scope for this delivery. The implemented local JWT/bcrypt authentication, Prisma/SQLite persistence, local attachment storage, AI intake, and five lifecycle states are in scope.
