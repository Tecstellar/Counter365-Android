-- =====================================================================
-- 0013_account_deletions.sql
-- Table to store reason for permanent account deletion and user survey details
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  shop_id UUID,
  shop_name TEXT,
  owner_name TEXT,
  phone TEXT,
  reason TEXT NOT NULL,
  feedback TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for lookup and analytics
CREATE INDEX IF NOT EXISTS idx_account_deletions_deleted_at ON public.account_deletions (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletions_reason ON public.account_deletions (reason);

-- Enable Row Level Security
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

-- Allow insert by anyone deleting their account (authenticated or anon)
DROP POLICY IF EXISTS "Allow insert to account_deletions" ON public.account_deletions;
CREATE POLICY "Allow insert to account_deletions"
  ON public.account_deletions
  FOR INSERT
  WITH CHECK (true);

-- Allow reading deletion logs
DROP POLICY IF EXISTS "Allow select account_deletions" ON public.account_deletions;
CREATE POLICY "Allow select account_deletions"
  ON public.account_deletions
  FOR SELECT
  USING (true);
