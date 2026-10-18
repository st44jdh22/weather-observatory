-- Tenant-link applications before they can appear in any administrator review.
-- Existing applications without a tenant stay invisible pending verified administrative assignment.
ALTER TABLE captain_applications ADD COLUMN tenant_id TEXT REFERENCES tenants(id);
ALTER TABLE captain_applications ADD COLUMN email_verified_at TEXT;
CREATE INDEX idx_captain_applications_tenant_queue ON captain_applications(tenant_id,status,submitted_at);
-- Per-tenant approval audit; reviews are separate from authorisation.
CREATE TABLE captain_application_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id),
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 reviewer_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('under_review','approve','reject','suspend','qualification_verified','qualification_rejected','vessel_authorised','vessel_revoked')),
 note TEXT,
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_captain_application_events ON captain_application_events(tenant_id,application_id,recorded_at);
