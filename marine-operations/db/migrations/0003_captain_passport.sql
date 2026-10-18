-- Captain Passport requests are untrusted applicant data until an authorised manager approves.
-- No application creates memberships, vessel_access or login access automatically.
CREATE TABLE captain_applications (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE,
 full_name TEXT NOT NULL,
 phone TEXT,
 country_of_residence TEXT,
 experience_summary TEXT,
 submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','under_review','approved','rejected','withdrawn')),
 reviewed_by TEXT REFERENCES users(id),
 reviewed_at TEXT,
 review_note TEXT,
 approved_user_id TEXT REFERENCES users(id),
 CHECK (length(full_name) BETWEEN 2 AND 150),
 CHECK (length(email) <= 254)
);
CREATE INDEX idx_captain_applications_status ON captain_applications(status,submitted_at);
CREATE TABLE captain_qualifications (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 qualification_type TEXT NOT NULL CHECK(qualification_type IN ('RYA_PB2','RYA_DAY_SKIPPER','RYA_COASTAL_SKIPPER','YACHTMASTER_COASTAL','YACHTMASTER_OFFSHORE','YACHTMASTER_OCEAN','STCW','PWC_INSTRUCTOR','FIRST_AID','SRC_VHF','COMMERCIAL_ENDORSEMENT','OTHER')),
 title TEXT NOT NULL,
 issuing_body TEXT,
 certificate_number TEXT,
 issue_date TEXT,
 expiry_date TEXT,
 verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified','rejected')),
 verified_by TEXT REFERENCES users(id),
 verified_at TEXT
);
CREATE TABLE captain_medical_attestations (
 application_id TEXT PRIMARY KEY REFERENCES captain_applications(id),
 medical_certificate_held INTEGER NOT NULL DEFAULT 0 CHECK(medical_certificate_held IN (0,1)),
 last_medical_date TEXT,
 medical_certificate_expiry TEXT,
 -- No diagnosis, clinical narrative, or health attachments in this table.
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE captain_documents (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 qualification_id TEXT REFERENCES captain_qualifications(id),
 type TEXT NOT NULL CHECK(type IN ('qualification','commercial_endorsement','first_aid','vhf','identity','other')),
 object_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 10485760),
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 scan_status TEXT NOT NULL DEFAULT 'pending' CHECK(scan_status IN ('pending','clean','rejected'))
);
CREATE TABLE captain_vessel_approvals (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 tenant_id TEXT NOT NULL,
 vessel_id TEXT NOT NULL,
 approved_by TEXT NOT NULL REFERENCES users(id),
 approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TEXT,
 status TEXT NOT NULL CHECK(status IN ('approved','suspended','revoked')),
 FOREIGN KEY (tenant_id,vessel_id) REFERENCES vessels(tenant_id,id),
 UNIQUE(application_id,tenant_id,vessel_id)
);
CREATE TABLE captain_sea_time (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL REFERENCES captain_applications(id),
 vessel_class TEXT NOT NULL,
 hours_declared REAL NOT NULL CHECK(hours_declared >= 0),
 verified_hours REAL CHECK(verified_hours >= 0),
 verified_by TEXT REFERENCES users(id),
 notes TEXT
);
