-- ================================================================
-- Gateway Agent Toolkit — Cross-Device Sync Schema
-- Run this once in your Supabase project: SQL Editor → New Query
-- ================================================================

-- 1. Agent sync data table (key-value store, one row per key per user)
CREATE TABLE IF NOT EXISTS agent_sync_data (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_key         TEXT        NOT NULL,
  data_value       JSONB,
  client_updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT agent_sync_data_user_key UNIQUE (user_id, data_key)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_agent_sync_data_user_id
  ON agent_sync_data (user_id);

-- Index for looking up a single key quickly
CREATE INDEX IF NOT EXISTS idx_agent_sync_data_key
  ON agent_sync_data (user_id, data_key);

-- 2. Row-Level Security — users can only read/write their own rows
ALTER TABLE agent_sync_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_data" ON agent_sync_data;
CREATE POLICY "users_own_data"
  ON agent_sync_data
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Helper function: upsert a single key (avoids race conditions)
CREATE OR REPLACE FUNCTION upsert_sync_key(
  p_user_id  UUID,
  p_key      TEXT,
  p_value    JSONB,
  p_updated  TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO agent_sync_data (user_id, data_key, data_value, client_updated_at)
  VALUES (p_user_id, p_key, p_value, p_updated)
  ON CONFLICT (user_id, data_key)
  DO UPDATE SET
    data_value        = EXCLUDED.data_value,
    client_updated_at = EXCLUDED.client_updated_at;
$$;

-- 4. OPTIONAL: Seed agent emails so they can self-register
--    Uncomment and fill in your team's email addresses.
--    Supabase Auth will let these addresses sign up with a password.
--    (This does NOT create passwords — agents set their own on first login.)
--
-- INSERT INTO auth.users (email, email_confirmed_at, role)
-- VALUES
--   ('agent1@gatewayrea.com', NOW(), 'authenticated'),
--   ('agent2@gatewayrea.com', NOW(), 'authenticated')
-- ON CONFLICT DO NOTHING;

-- ================================================================
-- SETUP CHECKLIST (after running this migration):
--
--  1. Supabase Dashboard → Authentication → Settings
--     - Disable "Enable email confirmations" (so agents can log in immediately)
--     - OR use "Invite User" to create accounts manually
--
--  2. Copy your Project URL and anon key:
--     Supabase Dashboard → Settings → API
--
--  3. Paste both into config.js:
--       supabaseUrl: 'https://xxxx.supabase.co',
--       supabaseAnonKey: 'eyJh...',
--
--  4. Each agent navigates to the toolkit, clicks the ☁ Sync button,
--     creates an account with their work email + a personal password.
--     All their data will now sync across every device they use.
-- ================================================================
