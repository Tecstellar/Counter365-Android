-- =====================================================================
-- 0027_app_version_control.sql
-- Mandatory App Update Enforcement for Counter365
-- Allows developers/admins to set minimum required app version in Supabase.
-- When installed version < min_required_version, clients receive instant
-- notification and are blocked from proceeding until updated.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.app_version_control (
  id TEXT PRIMARY KEY DEFAULT 'counterpro_android',
  min_required_version TEXT NOT NULL DEFAULT '1.0.4',
  latest_version TEXT NOT NULL DEFAULT '1.0.4',
  is_mandatory_update BOOLEAN NOT NULL DEFAULT true,
  update_title TEXT NOT NULL DEFAULT 'Update Required',
  update_message TEXT NOT NULL DEFAULT 'Please update the app to continue using the service.',
  download_url TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.counterpro.bill',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.app_version_control ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anon & authenticated) so app can verify version on startup
DROP POLICY IF EXISTS "Allow public read of app_version_control" ON public.app_version_control;
CREATE POLICY "Allow public read of app_version_control"
  ON public.app_version_control
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role full update access
DROP POLICY IF EXISTS "Allow service role update app_version_control" ON public.app_version_control;
CREATE POLICY "Allow service role update app_version_control"
  ON public.app_version_control
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed initial row matching current production app release
INSERT INTO public.app_version_control (
  id,
  min_required_version,
  latest_version,
  is_mandatory_update,
  update_title,
  update_message,
  download_url
) VALUES (
  'counterpro_android',
  '1.0.4',
  '1.0.4',
  true,
  'Update Required',
  'Please update the app to continue using the service.',
  'https://play.google.com/store/apps/details?id=com.counterpro.bill'
) ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Enable Supabase Realtime publication for instant push notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_version_control;
