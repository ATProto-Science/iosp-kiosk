-- One row per printed/QR ticket. A ticket is claimed once: the first PDS chosen sticks,
-- and re-opening the ticket page returns the same code (so a reload never loses it).
CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,           -- 4 chars, unambiguous alphabet
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at  TEXT,
  pds         TEXT,                        -- 'aster' | 'memo' once claimed
  code_id     INTEGER REFERENCES codes(id),
  disabled    INTEGER NOT NULL DEFAULT 0   -- revoked by staff: can never be claimed
);

-- Invite codes per PDS. Aster: many rows, max_uses=1. memo.dog: few rows, large max_uses.
CREATE TABLE IF NOT EXISTS codes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  pds       TEXT NOT NULL,
  code      TEXT NOT NULL UNIQUE,
  max_uses  INTEGER NOT NULL DEFAULT 1,
  uses      INTEGER NOT NULL DEFAULT 0,
  disabled  INTEGER NOT NULL DEFAULT 0     -- revoked by staff: excluded from claiming regardless of uses left
);
CREATE INDEX IF NOT EXISTS codes_pds_avail ON codes (pds, uses, max_uses);
