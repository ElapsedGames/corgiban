# Security Guidance

This document records the repo's current security-sensitive source rules and the follow-on
implementation guidance that applies when features cross trust boundaries.

## What The Repo Currently Enforces

| Control                                                                                      | Status       | Mechanism                            |
| -------------------------------------------------------------------------------------------- | ------------ | ------------------------------------ |
| No `SharedArrayBuffer` / `Atomics` in authored source                                        | **Enforced** | ESLint ban                           |
| UTF-8 without BOM, ASCII-only by default, no smart punctuation unless allowlisted            | **Enforced** | Encoding checks in pre-commit and CI |
| No `eval()` in authored source                                                               | **Enforced** | ESLint ban                           |
| No `new Function()` in authored runtime code                                                 | **Enforced** | ESLint ban                           |
| No `dangerouslySetInnerHTML` by default                                                      | **Enforced** | ESLint ban                           |
| No raw error objects or `error.message` in `.json()` payloads                                | **Enforced** | ESLint ban                           |
| No `SERVICE_ROLE` references in client code                                                  | **Enforced** | ESLint ban                           |
| No secret-pattern public env vars in client code (`SECRET`, `PASSWORD`, `TOKEN`, `DATABASE`) | **Enforced** | ESLint ban                           |

This repo does not currently run a dedicated secret-scanning or dependency-audit CI gate.
Do not document those checks as enforced unless the workflow is added to `.github/workflows/ci.yml`.

## Current narrow exceptions

- `apps/web/app/root.tsx` uses one documented `dangerouslySetInnerHTML` escape hatch for the
  pre-paint theme bootstrap script. That script is built from repo constants, not user input.
  Treat it as a narrow exception for theme ownership before paint, not as a reusable pattern.
- `apps/web/app/theme/__tests__/*.test.ts` may use `new Function()` to execute the generated
  theme-init script under jsdom. That exception exists only in tests so the shipped inline script
  can be validated without broadening runtime policy.

## Trust-boundary rule of thumb

Untrusted data must cross a validation step before it becomes trusted application data.

The worker protocol already models this correctly:

- validate untrusted input at the boundary
- return a discriminated result or typed error
- expose only safe codes/messages to callers

Use `packages/worker/src/protocol/validation.ts` and the repo's `Result<T, E>` patterns as the
baseline shape.

## Lint-enforced patterns

| Pattern                             | Rule                                                                                                           | Fires when                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Dynamic code execution              | Ban `eval()` and runtime `new Function()`                                                                      | Code tries to execute derived strings as code              |
| Raw HTML injection                  | Ban `dangerouslySetInnerHTML` by default                                                                       | React renders unsanitized HTML                             |
| Raw error exposure                  | Ban raw error values in `.json()` payloads                                                                     | Code writes `json({ error })` or exposes `error.message`   |
| Service-role access in browser code | Ban `SERVICE_ROLE` references                                                                                  | Client code reaches for privileged service credentials     |
| Secret-pattern client env vars      | Ban `VITE_*SECRET*`, `VITE_*PASSWORD*`, `VITE_*TOKEN*`, `VITE_*DATABASE*` and equivalent `NEXT_PUBLIC_*` names | Client bundle reads an env var that should never be public |

## Service-specific patterns

Apply these when the repo grows the corresponding service. They are not globally lint-enforced
today, but they are still the expected implementation pattern.

#### Webhook Signature Verification

**When it applies:** Any project receiving webhooks (Stripe, GitHub, Svix, etc.).

**Anti-pattern:** Parsing the request body and processing events without verifying the
cryptographic signature.

```typescript
// WRONG -- processes forged events
export async function handleWebhook(req: Request) {
  const event = await req.json();
  await processEvent(event); // No signature check
}
```

**Correct pattern:** Always verify the signature before accessing the payload. Every webhook
provider supplies a verification function or library. Use it.

```typescript
// CORRECT -- verifies before processing
export async function handleWebhook(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  const result = verifyWebhookSignature(body, signature, secret);
  if (!result.verified) {
    return new Response('Invalid signature', { status: 401 });
  }
  await processEvent(result.payload);
}
```

For Stripe specifically: `stripe.webhooks.constructEvent()` requires body, signature, and secret.
Calling it without the full verification input means the signature check is missing.

Also implement idempotency: store processed event IDs and skip duplicates. Webhook providers
retry deliveries, and without idempotency, events can execute twice.

#### Server-Side Error Sanitization

**When it applies:** Any project with API endpoints.

**Anti-pattern:** Returning raw error objects, `err.message`, or `err.stack` in HTTP responses.
This leaks file paths, dependency versions, database schema names, and SQL fragments.

```typescript
// WRONG -- leaks stack trace and internal details
catch (err) {
  return Response.json({ error: err });
}
```

**Correct pattern:** Map errors to a safe shape with an error code and a generic message. Log
the full error server-side for debugging.

```typescript
// CORRECT -- safe error shape
catch (err) {
  logger.error('Request failed', { error: err, requestId });
  return Response.json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
  });
}
```

#### Client-trusted authorization

**When it applies:** Any project with authorization (role checks, permission gates).

**Anti-pattern:** Reading authorization claims from the request body, URL parameters, or
client-side storage and trusting them for access control decisions.

```typescript
// WRONG -- trusts the client's claim
if (req.body.plan === 'pro') {
  grantAccess();
}

// WRONG -- trusts localStorage
const role = localStorage.getItem('role');
if (role === 'admin') {
  showAdminPanel();
}
```

**Correct pattern:** Authorization decisions must be enforced server-side using verified
session/token claims. Never trust client-supplied role, plan, permissions, or admin status.

```typescript
// CORRECT -- server verifies the session
const session = await verifySession(req.headers.get('authorization'));
if (session.plan === 'pro') {
  grantAccess();
}
```

#### SQL Injection Prevention

**When it applies:** Any project with database queries.

**Anti-pattern:** Building queries with string interpolation.

```typescript
// WRONG -- SQL injection
const result = await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

**Correct pattern:** Use parameterized queries or a query builder (Drizzle, Prisma, Kysely).
Never interpolate user input into query strings.

#### Open Redirect Prevention

**When it applies:** Any project with login flows or redirects based on URL parameters.

**Anti-pattern:** Redirecting to a user-supplied URL without validation.

```typescript
// WRONG -- open redirect
res.redirect(req.query.returnUrl);
```

**Correct pattern:** Validate redirect URLs against an allowlist of permitted origins.

#### JWT verification

**When it applies:** Any project using JWTs for authentication.

**Anti-pattern:** Using `jwt.decode()` instead of `jwt.verify()`, accepting the `none`
algorithm, or not checking expiry.

**Correct pattern:** Always use `jwt.verify()` with an explicit `algorithms` option. Never
use `jwt.decode()` in production code paths.

#### Cookie security flags

**When it applies:** Any project using cookie-based authentication.

**Correct pattern:** Always set `HttpOnly`, `Secure`, and `SameSite=Lax` (or `Strict`) on
authentication cookies.

#### SSRF prevention

**When it applies:** Any project that fetches URLs provided by users (previews, imports, proxies).

**Anti-pattern:** Passing user-supplied URLs directly to server-side `fetch()`.

**Correct pattern:** Validate URLs against an allowlist of permitted domains. Block internal
IP ranges (169.254.x.x, 10.x.x.x, 127.x.x.x, etc.).

## Acceptance criteria templates

When building features that touch trust boundaries, include the corresponding Gherkin scenarios
as acceptance criteria in the feature's PR. These are mandatory when the feature category
applies:

**Webhook endpoints:**

- Given a POST request without a valid signature header, Then the response is 401 and no
  business logic executes.
- Given an event ID that was already processed, When it arrives again, Then no duplicate
  side effects occur.

**API error responses:**

- Given any API endpoint, When an internal error occurs, Then the response does not contain
  file paths, `node_modules`, stack trace patterns, or database schema names.

**Authorization:**

- Given a protected endpoint, When a request arrives without authentication, Then the response
  is 401.
- Given User A is authenticated, When User A requests User B's resource, Then the response
  is 403 or 404.

**Client bundles:**

- Given the production build, When JavaScript bundles are searched for `service_role`, Then
  zero matches are found.
- Given env vars prefixed with `VITE_` or `NEXT_PUBLIC_`, Then none match the banned secret
  patterns `*SECRET*`, `*PASSWORD*`, `*TOKEN*`, or `*DATABASE*`.
