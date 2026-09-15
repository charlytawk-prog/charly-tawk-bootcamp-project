# Week 3: Full-Stack Delivery

## The flow

The built user-facing flow is one narrow Service Request path:

1. Submit a ticket from the React form. `frontend/src/main.jsx` sends the form values as `POST /api/tickets`.
2. View a ticket by ID from the access-check form. `frontend/src/main.jsx` sends `GET /api/tickets/:id` and, when supplied, the `x-user-id` header.
3. The backend checks ownership before returning the ticket. The route is defined in `src/tickets/tickets.controller.ts`; `src/tickets/tickets.service.ts` creates and loads tickets; and `src/tickets/ticket-owner.guard.ts` enforces the owner check.

The frontend display and request handling are in `frontend/src/main.jsx`, with presentation styles in `frontend/src/styles.css` and the Vite entry point in `frontend/index.html`.

## Architecture

- **React/Vite frontend:** The `frontend/` folder contains the Vite app. The key files are `frontend/index.html`, `frontend/src/main.jsx`, and `frontend/src/styles.css`.
- **NestJS backend:** `src/app.module.ts` composes `PrismaModule`, `TicketsModule`, `UsersModule`, and `QueuesModule`. The flow itself is owned by `src/tickets/`, especially `tickets.controller.ts`, `tickets.service.ts`, `ticket-owner.guard.ts`, and `tickets.module.ts`.
- **Prisma + SQLite persistence:** `prisma/schema.prisma` declares the SQLite datasource and the relational `User`, `DepartmentQueue`, and `Ticket` models. `Ticket.userId` and `Ticket.queueId` are foreign-key relations with indexes.
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

The request must include the identity header used by the guard:

```http
x-user-id: user-1
```

A successful owner request returns `200` with the stored `Ticket` object, using the same fields as the `POST` response. For example, `GET /api/tickets/ticket-1` with `x-user-id: user-1` returns the seeded ticket.

If the header is missing or empty, the response is `401`:

```json
{"error":"Missing x-user-id header"}
```

If the header identifies a different user, the response is `403`:

```json
{"error":"Forbidden: you do not have access to this ticket"}
```

If the ticket does not exist, the response is `404`:

```json
{"error":"Ticket not found"}
```

## The authorization rule

A ticket may be viewed only when the supplied user ID exactly matches the ticket's `userId`.

- **Allowed:** `GET /api/tickets/ticket-1` with `x-user-id: user-1`. The seeded `ticket-1` has `userId: "user-1"`, so the response is `200` and the ticket is returned.
- **Denied:** The same request with `x-user-id: user-2` returns `403` and `{"error":"Forbidden: you do not have access to this ticket"}`.

Identity is supplied by an **unverified `x-user-id` header. There is no authentication. Anyone can claim any identity.** This was a deliberate scoping decision because the requirement was an authorization rule, not an authentication system. A production system would replace this header with real authentication. This header must not be treated as production security.

## Invalid request rejected on purpose

Creating a ticket verifies both relational references before inserting it. A nonexistent `userId` is rejected with `400` and `{"error":"Invalid userId: no such user exists"}`. A nonexistent `queueId` is rejected with `400` and `{"error":"Invalid queueId: no such queue exists"}`. This preserves the invariant in `data-model.md.txt` that every ticket references an existing user and department queue.

## Expected failure handled on purpose

Requesting a nonexistent ticket returns a clean `404` with `{"error":"Ticket not found"}`. The service throws `NotFoundException` instead of allowing a missing record to cause a crash or expose a stack trace.

The guard deliberately resolves the ticket before checking identity. Therefore, a missing ticket returns `404` even when the identity is absent or does not match; it is not confused with `401` or `403`.

## Tests

The four tests in `test/tickets.spec.ts` cover separate contracts:

- **`enforces the lifecycle transition rule in isolation`** checks that the service accepts `Submitted` to `Pending Review` and rejects a direct `Submitted` to `Routed` transition with the exact invalid-transition error. Without it, the core ordering rule could regress independently of HTTP behavior.
- **`persists valid tickets and rejects a nonexistent user`** checks real SQLite persistence, the default `Submitted` status, stored fields, and the invalid-user invariant. Without it, tickets could appear to work in memory while failing to persist or accepting an unknown owner.
- **`allows the owner and rejects a different user end to end`** checks the HTTP guard for both the `200` owner case and the `403` different-user case. Without it, the route could return data without enforcing ownership.
- **`keeps the valid sequence and rejects moving backward`** checks the real database lifecycle sequence through `Pending Review` and `Routed`, then rejects `Routed` to `Submitted`. Without it, backward transitions could be accepted even if the isolated rule test still passed for its narrower case.

## What is deliberately out of scope

Authentication, external integrations, runtime AI, CI/CD, deployment, monitoring, production infrastructure, and the remaining lifecycle states `In Progress` and `Resolved` are out of scope for this delivery.
