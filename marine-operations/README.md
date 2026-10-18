# Ibiza Sea School — Independent Marine Operations Foundation

Development-only skeleton. Not deployed. Existing Weather Desk and AEMET Worker remain unchanged.

Architecture: Cloudflare Worker (same-origin static app/API), D1 SQL tenant/vessel/member/declaration/outbox records, private R2 attachments, six-digit emailed verification codes for approved captains, separate public report export. Authentication, sending, uploading and submission are deliberately disabled until reviewed and configured.

**Review and approval gates:** secure authentication and session management; tenant authorisation; tested SQL migrations; sender-domain verification and mail provider; spam/rate limiting; durable idempotent submissions; photo controls; off-provider encrypted backups; staging smoke tests and explicit production release.

See the full locally tested starter package attached to the engineering handover. This directory is kept separate from the existing website.

## Captain email-code login — engineering staging

- `POST /api/auth/request-code` accepts registered email and sends a 6-digit code **only if** a real DB, server-only HMAC key and mailer have been configured. No external email provider, secrets or database bindings exist yet.
- `POST /api/auth/verify-code` consumes a code at most once, within ten minutes and five tries; issues a Secure, HttpOnly, SameSite=Strict twelve-hour session cookie.
- `GET /api/auth/me` lists only assigned vessels and active tenant memberships. `POST /api/auth/logout` revokes the session.
- Code request throttles on hashed email and IP. Before production, review atomic request throttling, bot protection, timing/user enumeration controls, session management, audit and provider delivery feedback. No customer data or real captains seeded.
- Production submission, photographs and notifications remain closed. Live `ibiza-sea-school/` is unchanged. Never put the email provider API key, OTP HMAC key or real captain addresses in public assets or this repository.

## Captain Passport

A staged self-registration preview and qualification database schema are available under `public/captain-passport/` and `db/migrations/0003_captain_passport.sql`. **No application writes or submissions are enabled.** See [registration and authorisation policy](docs/CAPTAIN_PASSPORT.md).

## Administrator's Captain Register

The [Captain Register](docs/CAPTAIN_REGISTER_ADMIN.md) is staged in `public/admin/captains/`. Protected API endpoints live in `src/admin.js`; they reject anonymous and cross-tenant access and cannot write without a separate server-side staging approval gate. No new service is deployed.

## Registration-to-approval integration

See [staging integration handover](docs/STAGING_INTEGRATION.md). Self-registration is invitation-only, email verified and always subject to administrator review and separate vessel authorisation. No production activation.
