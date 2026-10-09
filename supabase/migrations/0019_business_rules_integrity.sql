-- 0019_business_rules_integrity.sql
-- Production business rules schema updates:
-- 1. Bill cancellation, audit, discount and original amount tracking
-- 2. Menu item cost price (for gross profit accounting)
-- 3. Operational expense classification & payment mode
-- 4. Atomic bill cancellation RPC function

-- 1. Update bills table
DO $$
BEGIN
  -- Expand status check constraint to allow cancelled, edited, deleted
  ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
  ALTER TABLE public.bills ADD CONSTRAINT bills_status_check 
    CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded', 'edited', 'deleted'));
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_subtotal NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS original_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS discount_applied_by TEXT,
  ADD COLUMN IF NOT EXISTS discount_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_by_name TEXT,
  ADD COLUMN IF NOT EXISTS edited_by_role TEXT,
  ADD COLUMN IF NOT EXISTS edited_by_id UUID,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_role TEXT,
  ADD COLUMN IF NOT EXISTS deleted_by_id UUID;

-- 2. Add cost_price to menu_items (enables real gross profit calculation without fabricating costs)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT NULL CHECK (cost_price >= 0);

-- 3. Enhance expenses table with category, payment_mode, and audit fields
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'Cash',
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- 4. Atomic Bill Cancellation & Audit RPC function
CREATE OR REPLACE FUNCTION public.cancel_bill_atomic(
  p_shop_id UUID,
  p_bill_id UUID,
  p_reason TEXT,
  p_actor_name TEXT DEFAULT 'Owner',
  p_actor_role TEXT DEFAULT 'Owner',
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_bill RECORD;
  v_cust_id UUID;
  v_pending NUMERIC;
BEGIN
  -- Lock and retrieve the bill
  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = p_bill_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bill not found');
  END IF;

  IF v_bill.status = 'cancelled' OR v_bill.is_deleted = TRUE THEN
    RETURN jsonb_build_object('success', true, 'message', 'Bill is already cancelled');
  END IF;

  -- Verify actor authorization: Billers cannot cancel bills
  IF p_actor_role = 'Biller' THEN
    RAISE EXCEPTION 'Unauthorized: Billers cannot cancel completed bills.';
  END IF;

  -- 1. Update bill status to cancelled and preserve audit fields
  UPDATE public.bills
  SET status = 'cancelled',
      is_deleted = TRUE,
      is_cancelled = TRUE,
      cancellation_reason = p_reason,
      deleted_at = NOW(),
      deleted_by_name = p_actor_name,
      deleted_by_role = p_actor_role,
      deleted_by_id = p_actor_id,
      updated_at = NOW()
  WHERE id = p_bill_id;

  -- 2. Cancel any open pending payments for this bill
  UPDATE public.pending_payments
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE bill_id = p_bill_id AND shop_id = p_shop_id;

  -- 3. Restore customer pending balance if bill had open dues
  IF v_bill.pending_amount > 0 AND v_bill.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET pending_balance = GREATEST(0, pending_balance - v_bill.pending_amount),
        updated_at = NOW()
    WHERE id = v_bill.customer_id;
  END IF;

  -- 4. Insert audit log
  INSERT INTO public.audit_logs (
    shop_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_shop_id, p_actor_id, 'bill.cancelled', 'bill', p_bill_id::TEXT,
    jsonb_build_object(
      'bill_number', v_bill.bill_number,
      'original_total', v_bill.total_amount,
      'reason', p_reason,
      'cancelled_by', p_actor_name,
      'cancelled_by_role', p_actor_role
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'bill_number', v_bill.bill_number,
    'status', 'cancelled'
  );
END;
$$;
