# Week 4 Authentication

## Understand
- **Current scope:** self-hosted password-backed login and JWT-protected API access
- **Identity source:** `POST /api/auth/login` is the authentication trust boundary; it does not delegate to Enterprise SSO, Auth0, or another external identity provider
- **Roles preserved:** seeded users use `Employee`, `Department Agent`, and `System Admin` in the existing `User.role` field
- **Credential storage:** passwords are bcrypt hashes only; deterministic credentials are TEST-ONLY seed data and are not representative of production passwords

## Direct
- **Schema change:** added the required `User.password` field and applied `20260915183636_add_user_password`
- **Auth module:** added `src/auth/` with `POST /api/auth/login`
- **Failure behavior:** unknown email and incorrect password both return `401` with `{ "error": "Invalid email or password" }`
- **Token claims:** successful login returns `access_token` containing the user ID as `sub` and the existing role
- **Configuration:** JWT signing uses `JWT_SECRET` from `.env`; the secret is never hardcoded in source
- **Authorization:** `JwtAuthGuard` protects authenticated routes, while ticket-access, ticket-owner, and department guards apply ownership and role/department authorization
- **Future replacement:** the self-hosted boundary can be exchanged for external SSO in a future production phase without changing the protected-resource model

## Prove
Run from the repository root:

```sh
npx prisma migrate deploy
npm run prisma:seed
npm test
```

Verified results:

| Case | Expected | Actual |
|---|---|---|
| Seeded email and correct TEST-ONLY credential | `200`, JWT access token | Passed |
| Existing email and incorrect credential | `401`, generic error | Passed |
| Unknown email | `401`, same generic error | Passed |
| Existing Week 3 test suite | All regression tests pass | Passed |

The suite includes authentication and JWT-guard coverage alongside ticket authorization and lifecycle coverage.

## Decision Context

JWT plus bcrypt avoids an external authentication dependency and gives the project a concrete authentication and authorization implementation to learn from. It is not a claim that this is the final production identity architecture: enterprise SSO can replace the login/token issuer in a later phase.
