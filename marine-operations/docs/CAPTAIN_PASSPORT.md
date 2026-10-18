# Captain Passport — registration and approval policy

## Access model

A captain **self-registers**, but only a trusted administrator can activate a captain account or assign vessel access. There is no open self-signup to production fleet access. Registration and authentication are separate systems.

1. Captain provides legal/full name, email, contact details, qualifications and sea-time evidence. The applicant receives a verification email only once the registration service and abuse controls are built.
2. Applicant verifies control of the submitted email (verification does not constitute approval).
3. Evidence enters a private, quarantined upload area. Certificate scans are reviewed before acceptance; no medical diagnoses are requested.
4. Administrator reviews qualifications, dates, declared experience and documents, recording who checked which items and when.
5. Administrator approves or rejects the applicant and assigns specific vessels **in the correct client/tenant**. Merely requesting a vessel never grants access.
6. Only upon approval does a user get a tenant membership and vessel_access row. The existing email-code login then exposes only active assigned vessels.
7. On departure from the fleet, expiry of qualification, or removal of authority, the administrator suspends access and revokes sessions. Reverification and review history must remain auditable.

## Data model (development schema)

- captain_applications: applicant identity and workflow state (pending, under_review, approved, rejected, withdrawn)
- captain_qualifications: certificates, dates and **independent verification state**
- captain_medical_attestations: medical certificate date/expiry only; no diagnosis or clinical files
- captain_documents: private object-storage references, size, MIME whitelist and scan status
- captain_sea_time: declared/verified hours by vessel class
- captain_vessel_approvals: administrator-approved per-vessel permissions (tenant-scoped)
- memberships and vessel_access in initial schema: final enforced authorisation.

**Important:** Approval schema is a starting point; production admin transactions must atomically provision memberships/vessel_access after verifying qualifying documents and a reviewed application, with tenant-scoped foreign keys, access expiry enforcement in the auth query, and immediate session revocation. The existing schema's `captain_vessel_approvals` does not itself grant access.

## Safety / privacy requirements before launch

Private repository and secrets policy, role-protected admin, separate applicant email verification, strict input validation, upload URL expiry, malware scanning, size limits, object access policies, medical-data minimisation, data retention and deletion rights, export, encryption, rate limits, consent notices, GDPR/UK GDPR assessment and backups. No photo/documents may be hosted in the public GitHub Pages tree.

## Status

Development UI only at `marine-operations/public/captain-passport/`; locally reviews draft in-browser. No API integration, storage, approval actions or notification service active. No applicant data sent anywhere. Live Weather Desk unchanged.
