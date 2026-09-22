# ADR-004: Authentication Strategy

## Status

Accepted

## Context

The original architecture proposed Enterprise SSO/Auth0, but no external identity provider is implemented. The current project needs authenticated API access and role-based authorization while remaining runnable without external infrastructure.

## Decision

Use self-hosted authentication. The NestJS API verifies passwords against bcrypt hashes stored with the local user records, issues signed JWTs after successful login, and validates bearer tokens with `JwtAuthGuard`. Resource-specific NestJS guards enforce ticket ownership and Department Agent department scope.

## Rationale

This removes an external identity dependency and lets the project demonstrate password hashing, token issuance, JWT verification, and guard-based authorization as learning objectives.

## Consequences

The application is self-contained for local development and testing. It assumes responsibility for JWT secret management and password handling, so it is not a substitute for a production identity program. The authentication boundary remains replaceable with an external SSO/OIDC provider in a future phase.