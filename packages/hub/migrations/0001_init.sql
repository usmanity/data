-- Scoped tokens for external services writing to /api/ingest/:source.
-- Only the SHA-256 hash of a token is stored; the plaintext is shown once at creation.
CREATE TABLE api_tokens (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  token_hash   TEXT NOT NULL UNIQUE,
  scopes       TEXT NOT NULL,          -- space separated, e.g. "music:write bikes:write"
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER,
  revoked_at   INTEGER
);
