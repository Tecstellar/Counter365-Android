-- =====================================================================
-- 0021_permanent_account_deletion_rpc.sql
-- Atomic RPC to permanently delete an owner account and their shop
-- Enforces protection of demo accounts on the database level
-- =====================================================================

CREATE OR REPLACE FUNCTION public.permanently_delete_owner_account(
  p_shop_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'User requested deletion',
  p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shop RECORD;
  v_phone TEXT;
  v_shop_name TEXT;
  v_owner_name TEXT;
BEGIN
  -- 1. Check if shop exists
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shop not found');
  END IF;

  v_phone := v_shop.phone;
  v_shop_name := v_shop.name;
  v_owner_name := v_shop.owner_name;

  -- 2. HARD DEMO ACCOUNT PROTECTION:
  -- Never delete demo phone 9999999999, demo shop ID 99999999-9999-4999-8999-888888888888, or demo names
  IF p_shop_id = '99999999-9999-4999-8999-888888888888'::uuid
     OR v_phone = '9999999999'
     OR LOWER(COALESCE(v_shop_name, '')) LIKE '%demo%'
     OR LOWER(COALESCE(v_shop_name, '')) LIKE '%sample%' THEN
    RAISE EXCEPTION 'Demo accounts are protected and cannot be deleted.';
  END IF;

  -- 3. Log into account_deletions table for audit and feedback tracking
  INSERT INTO public.account_deletions (
    user_id,
    shop_id,
    shop_name,
    owner_name,
    phone,
    reason,
    feedback,
    deleted_at
  ) VALUES (
    p_user_id,
    p_shop_id,
    v_shop_name,
    v_owner_name,
    v_phone,
    COALESCE(p_reason, 'User requested deletion'),
    p_feedback,
    NOW()
  );

  -- 4. Delete shop_members for this shop
  DELETE FROM public.shop_members WHERE shop_id = p_shop_id;

  -- 5. Delete child entities (bill_items and payments cascade with bills)
  DELETE FROM public.bills WHERE shop_id = p_shop_id;
  DELETE FROM public.menu_items WHERE shop_id = p_shop_id;
  DELETE FROM public.expenses WHERE shop_id = p_shop_id;
  DELETE FROM public.customers WHERE shop_id = p_shop_id;
  DELETE FROM public.vendors WHERE shop_id = p_shop_id;
  DELETE FROM public.subscriptions WHERE shop_id = p_shop_id;

  -- 6. Delete the shop row itself
  DELETE FROM public.shops WHERE id = p_shop_id;

  -- 7. If owner user profile id is provided, delete profile to allow clean re-registration
  IF p_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Shop and owner data deleted successfully',
    'shop_id', p_shop_id
  );
END;
$$;
