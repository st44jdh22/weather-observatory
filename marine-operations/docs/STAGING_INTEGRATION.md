# Captain Passport — Integrated staging milestone

This milestone connects three independent development components **without deploying any live system**:

1. **Administrator Captain Register** at `/admin/captains/` — an authenticated owner or manager can create a one-use, seven-day **tenant-specific invitation** and later review applicants.
2. **Captain Passport registration** at `/captain-passport/` — applicant enters a private invitation, legal name, email and declared credentials, then submits to the enabled staging API. Email verification uses an independently generated six-digit code, expiring after ten minutes, with five attempts.
3. **Approval and captain sign-in** — email verification marks the application as verified; an administrator must additionally check actual qualifications and approve a captain. Vessel access is **separate** and individually granted; subsequent email-code login only lists authorised vessels.

**Security boundaries:** The registration API never writes memberships or vessel permissions. Invitation codes are stored only as HMAC digests in SQL, are one-use, and are not put into URL query strings. Origin validation applies to changes. Captains aren't approved merely because they can receive email. Administrator records are tenant-filtered.

**Feature gates:**
- `REGISTRATION_ENABLED` defaults to OFF.
- `ADMIN_ACTIONS_ENABLED` defaults to OFF.
- No application works without a D1 `DB`, server-side `AUTH_HMAC_KEY` secret and an `OTP_MAILER` service configured privately.
- Live Weather Desk, existing Cloudflare Worker, public pages and external users remain unaffected.

**Still required before any real captain uses the system:** Configure a separate staging deployment, private sender verified email service, database migrations, initial tenant and owner bootstrap, professional verification of qualification records, richer certificate submission and private virus-scanned uploads, rate limits/CAPTCHA on invitation and verification routes, structured audit/retention and a full security review. No paid services, resources, live captain registration or emails have been set up.

**Known staging limitations:** First-aid, VHF, commercial endorsement and other auxiliary fields remain in the browser preview, not yet persisted as structured evidence. Qualification type is recorded as unverified until administrator review; full qualification upload/document parsing is a later step. The invitation is consumed on starting registration; email send failures currently require an administrator-issued new invitation (recovery and retry are pending). Concurrency, cross-tenant admin revocations and expiry rules need further hardening.
