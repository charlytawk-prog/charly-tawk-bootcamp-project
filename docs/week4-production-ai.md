# Week 4: Production AI Intake Assist

## What was built

The Service Hub now has a free-text ticket intake assist: an employee can describe an issue in their own words, request an AI suggestion, review or edit the suggested title, description, queue, and priority, and then use the existing ticket creation form. The feature adds one endpoint, `POST /api/tickets/suggest`; the existing `POST /api/tickets` creation flow, its validation, and its lifecycle behavior are unchanged.

## Architecture

- **Provider abstraction:** `src/ai/ai-provider.interface.ts` defines the `AiProvider` contract, the `TicketSuggestion` shape, the canonical priority enum, and the structured failure types. `GroqAiProvider` is the real provider. `FakeAiProvider` supplies deterministic normal, invalid-output, and provider-failure modes for tests and evals. The abstraction keeps provider-specific behavior out of the service and makes failure simulation deterministic without making live network calls in `npm test`.
- **Real model:** The working Groq model is `openai/gpt-oss-20b`. The originally planned `llama-3.3-70b-versatile` was not available to this API account, so the provider was changed after checking the account's available model catalog. The model change is an account-availability decision, not a change to the endpoint contract.
- **JSON enforcement:** The Groq request includes `response_format: { type: 'json_object' }` in addition to the system prompt's JSON instructions. Prompt-only instructions were not reliable enough for thin or vague input: the model could return a clarification sentence or incomplete content instead of a parseable suggestion. JSON mode gives the API an additional response-shape constraint, while the provider and service still validate the content.

## Bounded context design

`AiService` loads the real department queues through `QueuesService` and passes each queue's `id`, `name`, and `department` to the provider. It also passes the real priority enum: `Low`, `Medium`, `High`, and `Urgent`. After the provider responds, `AiService` trims and validates the title and description, checks that `queueId` is in the real queue list, and checks that priority is in the real enum before returning anything to the frontend.

The AI proposes; existing backend validation and the employee's own review before clicking Create ticket both remain the actual authority. AI output never creates a ticket directly.

## API contract

The endpoint is protected by `JwtAuthGuard` and is mounted at `POST /api/tickets/suggest`.

Request JSON:

```json
{
  "rawText": "my laptop cannot connect to the office wifi"
}
```

The controller accepts a string `rawText`; a missing or non-string value is treated as empty input. The service returns one of these JSON shapes. These are expected handled outcomes, so the controller returns HTTP `200` for success and for the three failure reasons rather than throwing an HTTP server error.

Successful suggestion:

```json
{
  "success": true,
  "suggestion": {
    "title": "Laptop cannot connect to office Wi-Fi",
    "description": "My laptop is unable to connect to the office Wi-Fi network.",
    "queueId": "queue-1",
    "priority": "Medium"
  }
}
```

Invalid provider output, such as malformed JSON or missing required provider fields:

```json
{
  "success": false,
  "reason": "invalid_ai_output"
}
```

Provider outage, timeout, missing key, or non-success Groq response:

```json
{
  "success": false,
  "reason": "provider_unavailable"
}
```

Empty input or a provider suggestion that reaches the service but fails its server-side queue, title, or description checks:

```json
{
  "success": false,
  "reason": "invalid_suggestion"
}
```

## Eval cases and real results

`npm run eval:ai` runs six cases. The first four use the real Groq provider and the real queue catalog from SQLite. The final two build Nest test modules with `FakeAiProvider` overrides.

1. **`clear-input-it`** sends a laptop/Wi-Fi issue and proves the returned queue ID is in the real catalog and the priority is in the real enum. The refreshed run passed and returned `queue-1` with `Medium`.
2. **`thin-input-valid`** sends the single word `help` and proves that, when Groq returns a suggestion, its queue and priority are bounded. The refreshed run passed with a valid `queue-1` / `Medium` suggestion. On other runs, this input has produced a graceful `invalid_ai_output` result because one word may be too vague to grade; the eval explicitly accepts either valid structured output or that graceful invalid-output fallback.
3. **`ambiguous-input-valid`** sends `my expense report software is broken` and proves the returned queue and priority are valid without asserting a particular choice. The refreshed run passed with `queue-2` and `Medium`.
4. **`bounded-context-proof`** makes fresh live calls for the three samples rather than reusing cases 1-3. Each sample is retried once for the recognized transient/invalid-JSON failure class, then the case hard-fails if the call still fails. Every resulting entry must be non-null and must have a queue ID in the real catalog; null or out-of-scope entries are not silently filtered. The refreshed run passed with all three entries present and catalog-bounded.
5. **`invalid-output-fails-gracefully`** overrides the provider with `FakeAiProvider('invalid-output')` and proves the endpoint returns `{ "success": false, "reason": "invalid_ai_output" }`. It passed.
6. **`provider-failure-fails-gracefully`** overrides the provider with `FakeAiProvider('provider-failure')` and proves the endpoint returns `{ "success": false, "reason": "provider_unavailable" }`. It passed.

The refreshed real eval completed with all six cases passing. `npm test -- --runInBand` also passed unchanged: 4 suites and 27 tests.

## Graceful degradation

The product specification requires System Resilience & Graceful Degradation: backend failures and timeouts should produce a user-friendly message rather than a crash or infinite loading state. This feature applies the same principle to a new dependency, the external AI call. Missing keys, invalid keys, provider failures, malformed model output, empty input, and invalid suggestions become structured outcomes. The frontend shows `AI suggestion unavailable — please fill out the form below manually` for an unsuccessful suggestion and leaves the existing manual ticket fields and Create ticket action usable.

## What is deliberately out of scope

- AI-driven ticket creation: a human must review and confirm through the existing Create ticket action.
- AI-driven state transitions.
- A chat interface.
- Retraining or fine-tuning.
- Any AI feature beyond this intake-assist point.
