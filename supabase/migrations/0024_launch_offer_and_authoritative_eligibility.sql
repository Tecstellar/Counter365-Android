-- =====================================================================
-- 0024_launch_offer_and_authoritative_eligibility.sql
-- Server Authoritative Launch Offer, Tamper-Proof Time & Staff Admin RPCs
-- =====================================================================

-- 1. Server time function to prevent client device clock manipulation
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT NOW();
$$;

-- 2. Launch offer eligibility check function based strictly on shops.created_at
CREATE OR REPLACE FUNCTION public.check_launch_offer_eligibility(p_shop_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_eligible_until TIMESTAMPTZ;
  v_is_eligible BOOLEAN;
  v_seconds_remaining BIGINT;
  v_days_remaining INT;
BEGIN
  SELECT id, created_at INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Shop not found'
    );
  END IF;

  v_eligible_until := v_shop.created_at + INTERVAL '30 days';
  v_is_eligible := (v_now < v_eligible_until);
  v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_eligible_until - v_now)))::BIGINT;
  v_days_remaining := CEIL(v_seconds_remaining::NUMERIC / 86400)::INT;

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', v_shop.id,
    'created_at', v_shop.created_at,
    'server_now', v_now,
    'eligible_until', v_eligible_until,
    'is_eligible', v_is_eligible,
    'seconds_remaining', v_seconds_remaining,
    'days_remaining', v_days_remaining
  );
END;
$$;

-- 3. Upgrade activate_manual_pro_subscription to enforce Launch Offer pricing & eligibility
CREATE OR REPLACE FUNCTION public.activate_manual_pro_subscription(
  p_shop_id UUID,
  p_admin_id UUID,
  p_duration_months INT,
  p_payment_ref TEXT DEFAULT NULL,
  p_admin_notes TEXT DEFAULT NULL,
  p_is_launch_offer BOOLEAN DEFAULT FALSE
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
  v_is_eligible BOOLEAN;
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

  -- Verify Launch Offer eligibility if requested
  IF p_is_launch_offer THEN
    v_is_eligible := (v_now < (v_shop.created_at + INTERVAL '30 days'));
    IF NOT v_is_eligible THEN
      RAISE EXCEPTION 'Launch offer eligibility period (30 days from registration) has expired for this shop.';
    END IF;

    -- Authoritative Launch Offer Pricing
    IF p_duration_months = 3 THEN
      v_amount := 2999.00;
      v_plan_name := '3 Months (Launch Offer)';
    ELSIF p_duration_months = 6 THEN
      v_amount := 4799.00;
      v_plan_name := '6 Months (Launch Offer)';
    ELSIF p_duration_months = 12 THEN
      v_amount := 5999.00;
      v_plan_name := '12 Months (Launch Offer)';
    ELSE
      RAISE EXCEPTION 'Unsupported Launch Offer duration: % months', p_duration_months;
    END IF;
  ELSE
    -- Regular Pricing: ₹999 per month
    IF p_duration_months = 3 THEN
      v_amount := 2999.00;
      v_plan_name := '3 Months';
    ELSIF p_duration_months = 6 THEN
      v_amount := 5999.00;
      v_plan_name := '6 Months';
    ELSIF p_duration_months = 12 THEN
      v_amount := 11999.00;
      v_plan_name := '1 Year';
    ELSE
      v_amount := p_duration_months * 999.00;
      v_plan_name := p_duration_months || ' Months';
    END IF;
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
    'Offline Admin',
    COALESCE(p_payment_ref, 'OFFLINE_ADMIN_' || EXTRACT(EPOCH FROM v_now)::BIGINT),
    p_admin_id,
    p_admin_notes,
    v_now
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    plan = 'pro',
    status = 'active',
    amount = EXCLUDED.amount,
    interval = EXCLUDED.interval,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    subscription_start_at = EXCLUDED.subscription_start_at,
    subscription_end_at = EXCLUDED.subscription_end_at,
    duration_months = EXCLUDED.duration_months,
    payment_method = EXCLUDED.payment_method,
    payment_reference = EXCLUDED.payment_reference,
    activated_by_admin_id = EXCLUDED.activated_by_admin_id,
    admin_notes = EXCLUDED.admin_notes,
    updated_at = v_now
  RETURNING * INTO v_updated_sub;

  -- Record in audit logs
  INSERT INTO public.audit_logs (
    shop_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_shop_id,
    p_admin_id,
    'Platform Administrator',
    'subscription.activated_manually',
    'subscription',
    v_updated_sub.id,
    jsonb_build_object(
      'duration_months', p_duration_months,
      'amount', v_amount,
      'is_launch_offer', p_is_launch_offer,
      'start_date', v_start_date,
      'end_date', v_end_date,
      'payment_ref', p_payment_ref,
      'notes', p_admin_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_updated_sub.id,
    'amount', v_amount,
    'plan', 'pro',
    'interval', v_plan_name,
    'current_period_end', v_end_date
  );
END;
$$;

-- 4. Admin RPC to reactivate a previously deactivated staff member
CREATE OR REPLACE FUNCTION public.admin_reactivate_staff_member(
  p_shop_id UUID,
  p_member_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
BEGIN
  SELECT * INTO v_member FROM public.shop_members 
  WHERE id = p_member_id AND shop_id = p_shop_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;

  UPDATE public.shop_members
  SET 
    is_active = true,
    deactivated_at = NULL,
    deactivated_by = NULL,
    deactivation_reason = NULL
  WHERE id = p_member_id;

  INSERT INTO public.audit_logs (
    shop_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_shop_id,
    p_admin_id,
    'Platform Administrator',
    'staff.reactivated_by_admin',
    'shop_member',
    p_member_id,
    jsonb_build_object(
      'member_name', v_member.full_name,
      'role', v_member.role,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'is_active', true
  );
END;
$$;

-- 5. Admin RPC to increase staff allocation limit for a shop
CREATE OR REPLACE FUNCTION public.admin_update_shop_staff_limit(
  p_shop_id UUID,
  p_new_limit INT,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop RECORD;
  v_old_limit INT;
BEGIN
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  v_old_limit := COALESCE(v_shop.max_staff_limit, 5);

  IF p_new_limit <= 0 THEN
    RAISE EXCEPTION 'New limit must be greater than zero';
  END IF;

  UPDATE public.shops
  SET max_staff_limit = p_new_limit
  WHERE id = p_shop_id;

  INSERT INTO public.audit_logs (
    shop_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_shop_id,
    p_admin_id,
    'Platform Administrator',
    'shop.staff_limit_updated',
    'shop',
    p_shop_id,
    jsonb_build_object(
      'old_limit', v_old_limit,
      'new_limit', p_new_limit,
      'notes', p_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'old_limit', v_old_limit,
    'new_limit', p_new_limit
  );
END;
$$;
