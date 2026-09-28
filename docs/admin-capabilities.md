# System Admin Capabilities

System Admin endpoints are exposed under `/api/admin` and require both a valid JWT and the `System Admin` role. Employees and Department Agents receive `403` responses for every endpoint in this namespace.

## Ticket oversight

- `GET /api/admin/tickets` lists all tickets with owner and queue details.
- Optional filters are `department`, `status`, and `search` (ticket title or ID).
- `PATCH /api/admin/tickets/:id` can update `queueId`, `priority`, and `status`.

The admin status update is a deliberate exception to the normal lifecycle rule: it may set a ticket to any of the five valid states (`Submitted`, `Pending Review`, `Routed`, `In Progress`, or `Resolved`). Existing employee and Department Agent endpoints continue to enforce one-step transitions and were not changed.

## User management

- `GET /api/admin/users` returns the safe user projection: `id`, `name`, `email`, `role`, and `department`.
- `POST /api/admin/users` creates an Employee from `name`, `email`, and `password`. Name must be non-empty, email must be valid, and password must contain at least eight characters. Duplicate email returns `409`. The server sets `role` to `Employee` and `department` to `null`; role or department fields in the request are rejected. Passwords are hashed and never returned.
- `PATCH /api/admin/users/:id` updates `role` and/or `department` using the supported role and department values. Passwords are never returned.

The former public `POST /api/users` route was removed; the profile `GET /api/users/:id` route remains available.

No audit log or change-history feature is included in this phase.
