-- Supplement initial schema with per-IP/email server-side request throttles.
CREATE TABLE IF NOT EXISTS auth_throttles(
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL DEFAULT 0,
 expires_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON login_challenges(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_valid ON sessions(user_id,expires_at);
