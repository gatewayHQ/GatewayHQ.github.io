-- ================================================================
-- Gateway Agent Toolkit — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE.
-- ================================================================

-- 1. Agent sync data table (per-user key-value store)
CREATE TABLE IF NOT EXISTS agent_sync_data (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_key         TEXT        NOT NULL,
  data_value       JSONB,
  client_updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT agent_sync_data_user_key UNIQUE (user_id, data_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_sync_data_user_id
  ON agent_sync_data (user_id);

CREATE INDEX IF NOT EXISTS idx_agent_sync_data_key
  ON agent_sync_data (user_id, data_key);

ALTER TABLE agent_sync_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON agent_sync_data;
CREATE POLICY "users_own_data"
  ON agent_sync_data FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Upsert helper (avoids race conditions on rapid saves)
CREATE OR REPLACE FUNCTION upsert_sync_key(
  p_user_id  UUID,
  p_key      TEXT,
  p_value    JSONB,
  p_updated  TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO agent_sync_data (user_id, data_key, data_value, client_updated_at)
  VALUES (p_user_id, p_key, p_value, p_updated)
  ON CONFLICT (user_id, data_key)
  DO UPDATE SET
    data_value        = EXCLUDED.data_value,
    client_updated_at = EXCLUDED.client_updated_at;
$$;

-- 3. Team-wide shared secrets (read-only for authenticated agents)
--    The Claude API key lives here — never in code.
--    Only logged-in Supabase accounts can read it (RLS enforced).
--    Nobody can write via the API — only via this SQL editor.
CREATE TABLE IF NOT EXISTS team_secrets (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE team_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_team_secrets" ON team_secrets;
CREATE POLICY "authenticated_read_team_secrets"
  ON team_secrets FOR SELECT
  TO authenticated
  USING (true);

-- ================================================================
-- AFTER RUNNING THIS MIGRATION:
--
-- Insert your Claude API key (replace the value below):
--   INSERT INTO team_secrets (key, value)
--   VALUES ('claude_api_key', 'sk-ant-...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- To update the key later, run the same INSERT again —
-- the ON CONFLICT clause overwrites the old value.
--
-- Agents log in via ☁ Sync → the key is fetched automatically
-- → ✦ AI On appears → all AI features work.
-- ================================================================
