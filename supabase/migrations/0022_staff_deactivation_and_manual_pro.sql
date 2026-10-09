-- =====================================================================
-- 0022_staff_deactivation_and_manual_pro.sql
-- Staff Deactivation History, Allocation Limits & Manual Admin Pro Activation
-- =====================================================================

-- 1. Extend public.shop_members with deactivation audit fields
ALTER TABLE public.shop_members 
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 2. Extend public.shops with max staff allocation limit
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS max_staff_limit INT DEFAULT 5;

-- 3. Extend public.subscriptions for manual admin activations
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cashfree',
  ADD COLUMN IF NOT EXISTS activated_by_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 4. Create helpful index for deactivation status lookups
CREATE INDEX IF NOT EXISTS idx_shop_members_is_active 
  ON public.shop_members(shop_id, is_active);

-- 5. Atomic RPC function for manual Pro activation by platform admin
CREATE OR REPLACE FUNCTION public.activate_manual_pro_subscription(
  p_shop_id UUID,
  p_admin_id UUID,
  p_duration_months INT,
  p_payment_ref TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop RECORD;
  v_existing_sub RECORD;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_amount NUMERIC(12, 2);
  v_plan_name TEXT;
  v_updated_sub RECORD;
BEGIN
  -- Verify shop exists
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found for ID: %', p_shop_id;
  END IF;

  -- Validate duration
  IF p_duration_months <= 0 THEN
    RAISE EXCEPTION 'Duration must be greater than zero months';
  END IF;

  -- Determine approved plan pricing and label
  IF p_duration_months = 3 THEN
    v_amount := 1499.00;
    v_plan_name := '3 Months';
  ELSIF p_duration_months = 6 THEN
    v_amount := 2799.00;
    v_plan_name := '6 Months';
  ELSIF p_duration_months = 12 THEN
    v_amount := 4999.00;
    v_plan_name := '1 Year';
  ELSE
    v_amount := p_duration_months * 499.00;
    v_plan_name := p_duration_months || ' Months';
  END IF;

  -- Fetch existing subscription
  SELECT * INTO v_existing_sub FROM public.subscriptions WHERE shop_id = p_shop_id;

  IF FOUND AND v_existing_sub.status = 'active' AND v_existing_sub.current_period_end > v_now THEN
    -- Active subscription: EXTEND from existing expiry date
    v_start_date := v_existing_sub.current_period_start;
    v_end_date := v_existing_sub.current_period_end + (p_duration_months || ' months')::INTERVAL;
  ELSE
    -- Expired or Free subscription: start from NOW
    v_start_date := v_now;
    v_end_date := v_now + (p_duration_months || ' months')::INTERVAL;
  END IF;

  -- Upsert subscription
  INSERT INTO public.subscriptions (
    shop_id,
    plan,
    status,
    amount,
    interval,
    current_period_start,
    current_period_end,
    subscription_start_at,
    subscription_end_at,
    duration_months,
    payment_method,
    payment_reference,
    activated_by_admin_id,
    admin_notes,
    updated_at
  ) VALUES (
    p_shop_id,
    'pro',
    'active',
    v_amount,
    v_plan_name,
    v_start_date,
    v_end_date,
    v_start_date,
    v_end_date,
    p_duration_months,
    'manual_admin',
    p_payment_ref,
    p_admin_id,
    p_admin_notes,
    v_now
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    plan = 'pro',
    status = 'active',
    amount = v_amount,
    interval = v_plan_name,
    current_period_start = v_start_date,
    current_period_end = v_end_date,
    subscription_start_at = v_start_date,
    subscription_end_at = v_end_date,
    duration_months = p_duration_months,
    payment_method = 'manual_admin',
    payment_reference = COALESCE(p_payment_ref, public.subscriptions.payment_reference),
    activated_by_admin_id = p_admin_id,
    admin_notes = COALESCE(p_admin_notes, public.subscriptions.admin_notes),
    updated_at = v_now
  RETURNING * INTO v_updated_sub;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    shop_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_shop_id,
    p_admin_id,
    'subscription.manual_pro_activated',
    'subscription',
    v_updated_sub.id::TEXT,
    jsonb_build_object(
      'duration_months', p_duration_months,
      'amount', v_amount,
      'plan_name', v_plan_name,
      'start_date', v_start_date,
      'end_date', v_end_date,
      'payment_ref', p_payment_ref,
      'admin_notes', p_admin_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_updated_sub.id,
    'plan', v_updated_sub.plan,
    'status', v_updated_sub.status,
    'end_date', v_end_date,
    'duration_months', p_duration_months
  );
END;
$$;
