# auth-service

A secure authentication service built as a portfolio project, focused on
demonstrating practical security engineering rather than just CRUD.

## Stack

Node.js, TypeScript, Express, PostgreSQL, Prisma, argon2, JWT.

## Features (Stage 1 — MVP)

- Register / login with email + password
- Password hashing with **argon2id** (OWASP-recommended over bcrypt)
- Short-lived JWT access tokens (15 min) + opaque refresh tokens
- Refresh tokens are stored **hashed** in the database and rotated on every
  use (reuse of a revoked token is a signal of token theft)
- Refresh token delivered via `httpOnly`, `secure`, `SameSite=strict` cookie
  scoped to `/auth` — never exposed to JS, so it isn't a target for XSS
- Rate limiting on `/auth/login` and `/auth/register`
- Timing-safe login: a non-existent email still runs a dummy password
  verification, so response time can't be used to enumerate accounts
- Security headers via `helmet`, explicit CORS allowlist
- Input validation with `zod` — request bodies are never trusted as-is

## Features (Stage 2)

- Account lockout for 15 minutes after 5 consecutive failed logins
- Security event log (`SecurityEvent` table) recording register, login
  success/failure, account lockouts, logout, and refresh-token reuse
- Refresh-token reuse detection: presenting an already-rotated token
  revokes every refresh token belonging to that user, forcing re-login

## Features (Stage 3)

- TOTP-based 2FA (`otplib`), compatible with Google Authenticator / Authy
- TOTP secrets are **encrypted at rest** (AES-256-GCM) — a database leak
  alone isn't enough to generate valid codes
- Two-step login: with 2FA enabled, `/auth/login` returns a short-lived
  (5 min) `twoFactorToken` instead of real tokens; `/auth/2fa/verify`
  exchanges it plus a TOTP code for the actual access/refresh tokens
- The `twoFactorToken` is signed with a distinct `purpose` claim, so it
  cannot be replayed as a regular access token against protected routes
  even though it shares the same signing secret

## Features (Stage 4)

- Password reset via a one-time link: `/auth/password-reset/request`
  always responds identically whether or not the email is registered
  (no account enumeration), and only logs a reset link — **no real email
  is sent**, this project has no SMTP integration
- Reset tokens are single-use, hashed at rest, and expire after 30 minutes
- Completing a reset revokes every existing refresh token for that user,
  so a stolen session can't outlive a password change

## Features (Stage 5)

- A minimal React + TypeScript demo client in [`frontend/`](frontend/README.md)
  exercising every flow above: register, login, 2FA enrollment (QR code)
  and challenge, password reset, logout
- Access token kept in memory only; session restored on load via a
  silent `/auth/refresh` call using the httpOnly cookie — no token ever
  touches `localStorage`

## Running locally

```bash
docker-compose up --build
```

This starts Postgres and the API on `http://localhost:3000`. On first run,
apply the schema:

```bash
docker-compose exec api npx prisma migrate deploy
```

## Running without Docker

Needs a PostgreSQL database — either install Postgres locally, or use a
free hosted instance (e.g. [neon.tech](https://neon.tech)) and paste its
connection string into `DATABASE_URL`.

```bash
cp .env.example .env      # then edit DATABASE_URL / secrets
npm install
npm run prisma:migrate
npm run dev
```

## Running the demo frontend

With the API running on `http://localhost:3000` (either method above):

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`. See [frontend/README.md](frontend/README.md).

## Tests

Integration tests run the full HTTP stack (register/login/lockout/refresh
rotation/reuse-detection/logout/2FA enrollment and login/password reset)
against the database in `DATABASE_URL`, via `supertest`. They clean up
every row they create.

```bash
npm test
```

## API

| Method | Path            | Auth required | Description                          |
|--------|-----------------|----------------|---------------------------------------|
| POST   | `/auth/register`| no             | Create an account, returns access token, sets refresh cookie |
| POST   | `/auth/login`   | no             | Returns access token, sets refresh cookie |
| POST   | `/auth/refresh` | refresh cookie | Rotates refresh token, returns new access token |
| POST   | `/auth/logout`  | refresh cookie | Revokes the refresh token |
| GET    | `/auth/me`      | access token   | Returns the current user |
| POST   | `/auth/2fa/setup`   | access token       | Generates a TOTP secret + otpauth URL (not yet active) |
| POST   | `/auth/2fa/enable`  | access token       | Confirms a code, turns 2FA on |
| POST   | `/auth/2fa/disable` | access token       | Confirms a code, turns 2FA off |
| POST   | `/auth/2fa/verify`  | `twoFactorToken`   | Exchanges a TOTP code for real access/refresh tokens |
| POST   | `/auth/password-reset/request` | no     | Always returns 202; logs a reset link if the email exists |
| POST   | `/auth/password-reset/confirm` | reset token | Sets a new password, invalidates the token and all sessions |

If 2FA is enabled, `POST /auth/login` responds with
`{ twoFactorRequired: true, twoFactorToken }` instead of an access token —
call `/auth/2fa/verify` with that token and a 6-digit code to finish
logging in.

## Threat model

**In scope / mitigated:**
- Credential stuffing / brute force → rate limiting on login/register, plus
  account lockout after 5 failed attempts
- Password database leak → argon2id hashing, no plaintext/reversible storage
- Refresh token theft → hashed storage, rotation, short access-token lifetime,
  reuse detection revokes all sessions for that user
- XSS stealing the refresh token → httpOnly cookie, token never touches JS
- Account enumeration via login timing → dummy hash verification on unknown email
- CSRF on state-changing auth routes → `SameSite=strict` cookie
- Incident investigation → security events (failed logins, lockouts, token
  reuse) are logged with user/email/IP for later review
- TOTP secret leaked via database dump → secrets are encrypted at rest,
  not stored in plaintext
- Token confusion between login stages → the 2FA challenge token carries a
  distinct `purpose` claim and is rejected by any endpoint expecting a
  real access token
- Account enumeration via password reset → the request endpoint always
  responds identically regardless of whether the email exists
- Reset-token replay / theft from logs → tokens are hashed at rest,
  single-use, short-lived (30 min), and completing a reset revokes every
  active session for that user

**Explicitly out of scope for this project:**
- Real email delivery — password reset links are logged to the server
  console instead of sent, since there's no SMTP/email provider configured
- IP-based reputation or geo-blocking
- Multi-instance/distributed rate limiting (current limiter is in-memory,
  single-instance only — swap in a Redis store for production)

## Security considerations if you deploy this publicly

This is a portfolio project, not a hardened production service. If you
stand up a live demo, don't reuse a real password, and expect the
rate-limiter to be your only line of defense against abuse.
