# Operational staging deployment — manual security gate

**Current state:** code is built and end-to-end SQL-backed tests pass. This is NOT yet a hosted private application; no Cloudflare staging database, Access-protected hostname or mail-provider credential has been provisioned.

## Provision privately, separate from ARA and Mi Mundo

1. Create a new D1 database named `ibiza-sea-school-ops-staging` under the approved Cloudflare account. Record its non-secret database ID.
2. Make a new Worker from `marine-operations/src/worker.js`, using a copy of `wrangler.staging.toml.example` saved privately as `wrangler.staging.toml` with the actual database ID. Do not touch `cloudflare/worker.js` or `ara-sr-ai-capitan`.
3. **Protect its staging hostname with Cloudflare Access (email identity allowlist)** before sharing any link. Disable public discovery and verify that anonymous requests are rejected. Prefer a dedicated staging subdomain already under your control; no domain has yet been selected or attached.
4. Apply SQL migrations 0001–0005 against the **staging D1 database only**. Create a bootstrap owner identity and one fictional tenant/vessel as a controlled administrative seed (never seed real captain details into code or git).
5. Configure Cloudflare Worker secrets: `AUTH_HMAC_KEY` (random, high entropy), `RESEND_API_KEY` (send-only credential), `OTP_FROM_EMAIL` (verified sender), `OTP_ALLOWED_RECIPIENTS` (comma-separated approved test email addresses). Never place them in GitHub source, browser JavaScript, console screenshots or handover documents.
6. Ensure the Resend sender is verified and permitted to send to your approved staging recipient. Activate sender for test emails only. Check provider acceptance **and** inbox delivery; they are different outcomes.
7. Start with `REGISTRATION_ENABLED=false`, `ADMIN_ACTIONS_ENABLED=false`. Test health and deny-all API behaviour; then enable in a controlled staging window only after threat-model review and current source freeze.
8. Run the staging acceptance sequence: administrator signs in; issues a single-use invitation; test applicant submits; email is verified; wrong and expired codes fail; an admin approves only after examining a certificate; a vessel is assigned; cross-tenant vessels fail; revoked sessions lose access; audits are present.
9. Check audit/backup/recovery and redaction, then decide separately on production hosting, custom domain, client data retention and payment. **No production activation is implied.**

## Security work still outstanding before a real captain can use this

- The latest tests validate a full simulated D1 database path, not real Cloudflare Worker isolation, concurrency, provider delivery or Access policy.
- Registration invitation consumption and email sending must support safe retries.
- Rate limiting must be added to applicant verification endpoints and enforced atomically across Worker instances.
- Final qualification and training evidence, GDPR privacy notice and retention, malware-safe private R2 upload, admin credential escalation audit, recovery testing and explicit authorisation expiry remain outstanding.
- New applicant approval must be tied to reviewed credentials, insurer and flag requirements for the vessel. Self-reported qualifications do not confer authority.
- **Do not switch feature gates on for real users until these checks are signed off.**

## GitHub safety

The Weather Desk continues to publish from the existing repository. This staged marine operations application lives entirely under `marine-operations/`. Do not automatically deploy it from `main`. Set up a separate reviewed staging-only GitHub Actions workflow with dedicated credentials and an explicit manual confirmation when account infrastructure is ready.

## Acceptance definition

A private HTTPS URL, protected by Cloudflare Access, must serve both the Passport and Register UIs, with a staging D1 database and a verified email provider. A synthetic captain must complete the full registration/approval/assignment/revocation flow without permission leakage. Until then, label this as **deploy-preparation**, not **live staging**.
