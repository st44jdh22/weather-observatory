# Ibiza Sea School — Independent Marine Operations Foundation

Development-only skeleton. Not deployed. Existing Weather Desk and AEMET Worker remain unchanged.

Architecture: Cloudflare Worker (same-origin static app/API), D1 SQL tenant/vessel/member/declaration/outbox records, private R2 attachments, six-digit emailed verification codes for approved captains, separate public report export. Authentication, sending, uploading and submission are deliberately disabled until reviewed and configured.

**Review and approval gates:** secure authentication and session management; tenant authorisation; tested SQL migrations; sender-domain verification and mail provider; spam/rate limiting; durable idempotent submissions; photo controls; off-provider encrypted backups; staging smoke tests and explicit production release.

See the full locally tested starter package attached to the engineering handover. This directory is kept separate from the existing website.
