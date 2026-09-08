# Week 2 Agentic Workflow

## Understand
- **Week 1 sources used:** product-spec.md, data-model.md, architecture.md.excalidraw
- **States implemented:** Submitted → Pending Review → Routed (first 3 of the 5-state lifecycle defined in data-model.md)
- **Rule enforced:** a ticket may only move to the immediate next state in the sequence; any skip, backward move, or unrecognized status is rejected
- **Invariant enforced:** every ticket must reference an existing userId (data/users.json) and an existing queueId (data/queues.json), per data-model.md's Invariants section
- **Explicitly out of scope:** authentication/authorization, a real database, a frontend, an automated test suite, and the remaining two lifecycle states (In Progress, Resolved)

## Direct
- **Bounded task:** extend the existing ticketController.js only — no new entities, no new files beyond documentation
- **Plan before execution:** implement the state-machine check first (updateTicket), then the invariant check (createTicket), keeping both changes isolated to ticket logic
- **Approach:** kept the existing Express/JSON structure rather than introducing a new framework, since the working logic ports over regardless of framework choice

## Prove
See README.md → "Week 2: Run & Verify" for the exact commands and expected results. Summary of what was verified:

| Case | Action | Expected | Actual |

 Submitted → Pending Review | 200, status updated 
 Pending Review → Routed | 200, status updated 
 Submitted → Routed (skip) | 400, rejected 
 Routed → Submitted (backward) | 400, rejected
 Create ticket with fake userId | 400, rejected 
