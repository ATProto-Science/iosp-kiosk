-- Adds staff revoke capability. schema.sql's CREATE TABLE already has these columns for a
-- fresh database; this migration brings an already-existing (live) database up to date.
ALTER TABLE tickets ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE codes ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
