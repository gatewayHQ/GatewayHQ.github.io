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

-- ================================================================
-- 4. Video render job queue
--    Tracks async video renders triggered from the browser.
--    GitHub Actions writes back via the video-jobs edge function.
--    Supabase Realtime broadcasts row changes to the browser so
--    no polling is needed.
-- ================================================================

CREATE TABLE IF NOT EXISTS video_jobs (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug             TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'queued',
  -- status: queued | rendering | completed | failed
  platform         TEXT,
  composition_path TEXT,        -- storage path: {user_id}/{slug}.html
  render_url       TEXT,        -- raw.githubusercontent.com URL when done
  error_msg        TEXT,
  run_id           TEXT,        -- GitHub Actions run ID for log link
  elapsed_sec      INT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON video_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status  ON video_jobs (status);
CREATE INDEX IF NOT EXISTS idx_video_jobs_created ON video_jobs (created_at DESC);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_video_jobs" ON video_jobs;
CREATE POLICY "users_own_video_jobs"
  ON video_jobs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at on every row change (drives Realtime events)
CREATE OR REPLACE FUNCTION _update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS video_jobs_updated_at ON video_jobs;
CREATE TRIGGER video_jobs_updated_at
  BEFORE UPDATE ON video_jobs
  FOR EACH ROW EXECUTE FUNCTION _update_updated_at();

-- Enable Realtime so browser can subscribe to row changes
-- (Run once; safe to re-run — ADD is idempotent in PG 16+)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE video_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Supabase Storage bucket for video compositions
--    Authenticated users upload their own compositions.
--    Renders live in GitHub (raw.githubusercontent.com) — not here.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-compositions',
  'video-compositions',
  false,
  20971520,   -- 20 MB max (HTML with embedded base64 images)
  ARRAY['text/html', 'application/octet-stream', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "users_upload_own_compositions"  ON storage.objects;
DROP POLICY IF EXISTS "users_read_own_compositions"    ON storage.objects;
DROP POLICY IF EXISTS "users_delete_own_compositions"  ON storage.objects;

CREATE POLICY "users_upload_own_compositions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'video-compositions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_read_own_compositions"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'video-compositions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "users_delete_own_compositions"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'video-compositions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ================================================================
-- Team shared GitHub render PAT
--
-- Store a single GitHub PAT in team_secrets so every logged-in agent
-- can render videos without entering a personal token.
--
-- Required PAT scopes: repo (contents + actions:write)
-- Create at: https://github.com/settings/tokens
--
-- Run once in SQL Editor (replace ghp_... with your actual PAT):
--
--   INSERT INTO team_secrets (key, value)
--   VALUES ('gh_render_pat', 'ghp_...')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- The browser loads this automatically after login (app/sync.js →
-- _fetchTeamRenderPat). The token lives in memory only — never
-- written to localStorage or exposed in the DOM.
-- ================================================================

-- ================================================================
-- GitHub Actions repository secrets (Settings → Secrets → Actions):
--
--   SUPABASE_URL              = https://<ref>.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY = <service role key>
--
-- These allow the render workflow to write job status directly to
-- Supabase without going through any proxy. The browser subscribes
-- to Supabase Realtime (video_jobs table) to receive live updates.
-- ================================================================
