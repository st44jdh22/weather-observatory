-- Vessel Passport: tenant-owned technical registry and future private document metadata.
-- All new equipment/ownership fields are optional; no personal identity documents are stored here.
ALTER TABLE vessels ADD COLUMN registration_number TEXT;
ALTER TABLE vessels ADD COLUMN flag_state TEXT;
ALTER TABLE vessels ADD COLUMN make TEXT;
ALTER TABLE vessels ADD COLUMN model TEXT;
ALTER TABLE vessels ADD COLUMN year_built INTEGER CHECK(year_built IS NULL OR year_built BETWEEN 1850 AND 2200);
ALTER TABLE vessels ADD COLUMN loa_metres REAL CHECK(loa_metres IS NULL OR loa_metres > 0 AND loa_metres < 500);
ALTER TABLE vessels ADD COLUMN beam_metres REAL CHECK(beam_metres IS NULL OR beam_metres > 0 AND beam_metres < 100);
ALTER TABLE vessels ADD COLUMN draft_metres REAL CHECK(draft_metres IS NULL OR draft_metres >= 0 AND draft_metres < 40);
ALTER TABLE vessels ADD COLUMN mmsi TEXT;
ALTER TABLE vessels ADD COLUMN call_sign TEXT;
ALTER TABLE vessels ADD COLUMN hin_cin TEXT;
ALTER TABLE vessels ADD COLUMN insurance_expiry TEXT;
ALTER TABLE vessels ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived'));
ALTER TABLE vessels ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE vessel_documents(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 vessel_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('insurance','registration','survey','radio_licence','certificate','manual','other')),
 display_name TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 20971520),
 expires_on TEXT,
 scan_status TEXT NOT NULL DEFAULT 'pending' CHECK(scan_status IN ('pending','clean','rejected')),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,vessel_id) REFERENCES vessels(tenant_id,id)
);
CREATE INDEX idx_vessel_document_expiry ON vessel_documents(tenant_id,expires_on);
CREATE TABLE vessel_photos(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 vessel_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 10485760),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(tenant_id,vessel_id) REFERENCES vessels(tenant_id,id)
);
CREATE TABLE vessel_document_reminders(
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 vessel_id TEXT NOT NULL,
 document_id TEXT,
 reminder_type TEXT NOT NULL,
 due_on TEXT NOT NULL,
 lead_days INTEGER NOT NULL CHECK(lead_days IN (30,14,7,1,0)),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','cancelled')),
 sent_at TEXT,
 UNIQUE(tenant_id,vessel_id,document_id,lead_days,due_on),
 FOREIGN KEY(tenant_id,vessel_id) REFERENCES vessels(tenant_id,id),
 FOREIGN KEY(document_id) REFERENCES vessel_documents(id)
);
CREATE INDEX idx_vessel_reminders_due ON vessel_document_reminders(status,due_on);
