-- Tenant-scoped, time-limited applicant invitations and independent applicant email verification.
CREATE TABLE registration_invites(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 token_digest TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT NOT NULL,
 consumed_at TEXT
);
CREATE TABLE applicant_email_challenges(
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 digest TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 consumed_at TEXT
);
CREATE INDEX idx_registration_invites_expiry ON registration_invites(expires_at);
CREATE INDEX idx_applicant_email_challenges ON applicant_email_challenges(application_id,expires_at);
