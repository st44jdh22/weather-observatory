# Captain Register — Administrator workflow (development)

## Purpose

Captains self-register through Captain Passport. Registration alone does not provide a user login, a fleet membership or authorisation to command any vessel.

The separate administrator register is under `marine-operations/public/admin/captains/`. Its server API is `/api/admin/tenants/*`, available only to authenticated users with an owner/manager membership **within that tenant**. No client or vessel identifiers are trusted from the UI without database permission checks.

## Workflow

1. Administrator signs in using a verified email-code session.
2. The register lists only client accounts where they are an owner/manager, then applications assigned to that tenant.
3. Administrator opens the captain's name, qualifications, declared sea time, evidence metadata and review history.
4. Administrator checks certificates, endorsement/first-aid/SRC validity, experience and identity using a suitable verification process, records verified qualifications, and moves the application to under review, approves or rejects.
5. **Approval of a captain requires verified email and at least one currently valid verified qualification.** It establishes a captain membership but **no vessel access**.
6. Administrator authorises each vessel individually (e.g. Craig → HYGGELIG and LARISSA, not A58), or revokes vessel authority and active sessions when needed.
7. All review and access actions generate an audit event. Vessel access is ultimately enforced by the server and tenant-scoped database relationships.

## Engineering safety gates

The admin UI and HTTP API are implemented but writes are disabled unless a server-only `ADMIN_ACTIONS_ENABLED=true` setting is deliberately configured after staging review. No setting, credentials, mailer or database has been provisioned; there is no deployed operational administrator register.

Before enabling writes, finish external security and concurrency review, transactional approval invariants, application-to-tenant onboarding, authentic applicant email verification, secure document upload and scanning, evidence access control, credential expiry and ongoing compliance checks, rate limits, stricter CSP/cookie session controls, GDPR retention and deletion, off-provider backups and restore drills.

Qualification checks do not automatically certify legal authority to operate a vessel; regulatory requirements and the yacht's insurance/flag requirements must be confirmed separately.

## Code

- `src/admin.js` contains authenticated tenant-scoped endpoints.
- `db/migrations/0004_admin_review.sql` adds tenant attachment, email verification and audit records.
- `public/admin/captains/` contains the responsive administrator register.
- `test/worker.test.js` exercises authentication fail-closed, origin protection and approval preconditions.
