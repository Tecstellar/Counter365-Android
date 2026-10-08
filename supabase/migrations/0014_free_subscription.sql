-- =====================================================================
-- 0014_free_subscription.sql
-- Default all subscriptions to free and update any existing records to free
-- =====================================================================

ALTER TABLE public.subscriptions 
ALTER COLUMN plan SET DEFAULT 'free',
ALTER COLUMN amount SET DEFAULT 0.00,
ALTER COLUMN interval SET DEFAULT 'lifetime';

-- Update all existing subscription records to free plan
UPDATE public.subscriptions 
SET plan = 'free', amount = 0.00, interval = 'lifetime', status = 'active'
WHERE plan <> 'free' OR amount <> 0.00;
