# Vessel Passport — fleet registry foundation

## Model

- An **organisation/client** owns one or more **vessels**.
- Each vessel has a technical passport: name, flag, registration, make/model, length overall, beam, draft, year, MMSI, call sign and hull ID.
- A **captain** has a separate Captain Passport.
- Captain ↔ vessel authorisation is a separate, revocable, **tenant-scoped** decision made through the Administrator's Captain Register.
- Vessel documents and photos are future **private object-storage** references, never web-public file paths. Actual upload and download endpoints do not exist yet.
- Insurance expiry and document expiry are modelled as dates; reminders are modelled as per-lead-time delivery records, but **nothing is sent**. Any local UI warning is not a delivered notification.

## Security and privacy

- Only authenticated owner/manager of that specific tenant can read and edit its vessel registry via `/api/admin/tenants/{tenant}/vessels`.
- Data creation/edit requires a separate `VESSEL_WRITE_ENABLED=true` server setting; it defaults to disabled.
- A newly created vessel grants no captain access.
- Never request or hold an owner's passport in the general vessel form. If owner identity proof is genuinely required later, implement a separately approved, restricted identity-document vault, with lawful basis, retention limits, logging and encryption.
- Before allowing documents/photos, add malware scanning, private R2 bucket, signed read authorisation, content/size validation, audit and deletion.
- Before automatic reminders, add a reliable scheduled worker, per-client recipients, queue/idempotency/retries and **separate accepted/sent/delivered statuses**.

## Engineering acceptance

1. Use the existing staging client bootstrap and owner login.
2. Register a fictional vessel; verify that listing works only within that client's tenancy.
3. Add a second tenant with a vessel. Verify it is not visible to the first tenant.
4. Check missing/invalid dimensions and dates are rejected.
5. Verify registration does not create vessel_access rows.
6. Grant captain permission separately using existing Captain Register and verify cross-tenant assignments are refused.
7. Keep all real identity documents and real operational records out of staging until security review.

Live Weather Desk and existing Cloudflare Worker remain unchanged. No production hosting or storage has been provisioned by this branch.
