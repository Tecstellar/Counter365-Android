-- =====================================================================
-- 0015_subscription_trial_cashfree.sql
-- CounterPro 30-Day Free Trial & Cashfree Subscription Schema Extension
-- =====================================================================

-- 1. Extend public.subscriptions table with trial, cashfree, and duration columns
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS cashfree_order_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS duration_months INT;

-- 2. Add helpful indexes for shop lookups and Cashfree order reference idempotency
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id 
  ON public.subscriptions(shop_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_cashfree_order_id 
  ON public.subscriptions(cashfree_order_id);

-- 3. Ensure RLS policies allow reading and updating subscriptions
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subscriptions" ON public.subscriptions;
CREATE POLICY "Allow all on subscriptions" ON public.subscriptions 
  FOR ALL TO anon, authenticated 
  USING (true) 
  WITH CHECK (true);
