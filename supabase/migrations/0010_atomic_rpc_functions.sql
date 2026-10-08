-- 0010_atomic_rpc_functions.sql

-- Atomic function to create a complete bill in a single transaction
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
  p_shop_id UUID,
  p_bill_number TEXT,
  p_items JSONB, -- Array of {menu_item_id, item_name, is_half, unit_price, quantity, line_total}
  p_subtotal NUMERIC,
  p_gst_rate NUMERIC,
  p_gst_amount NUMERIC,
  p_total_amount NUMERIC,
  p_payment_mode TEXT, -- 'Cash', 'GPay', 'Pending'
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_client_operation_id UUID DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_customer_id UUID;
  v_paid_amt NUMERIC := 0.00;
  v_pending_amt NUMERIC := 0.00;
  v_existing_bill_id UUID;
BEGIN
  -- Idempotency check: if client_operation_id already exists, return existing bill
  IF p_client_operation_id IS NOT NULL THEN
    SELECT id INTO v_existing_bill_id
    FROM public.bills
    WHERE shop_id = p_shop_id AND client_operation_id = p_client_operation_id;

    IF v_existing_bill_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'bill_id', v_existing_bill_id,
        'bill_number', p_bill_number,
        'is_duplicate', true
      );
    END IF;
  END IF;

  -- Verify caller permission
  IF NOT public.has_shop_permission(p_shop_id, 'bill') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have bill permission for this shop.';
  END IF;

  -- Determine paid vs pending
  IF p_payment_mode = 'Pending' THEN
    v_pending_amt := p_total_amount;
    v_paid_amt := 0.00;
  ELSE
    v_paid_amt := p_total_amount;
    v_pending_amt := 0.00;
  END IF;

  -- Handle customer record if name or phone is provided
  IF p_customer_name IS NOT NULL AND TRIM(p_customer_name) <> '' THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE shop_id = p_shop_id AND (
      (phone IS NOT NULL AND phone = p_customer_phone) OR
      (name = p_customer_name)
    )
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (shop_id, name, phone, total_bills, pending_balance)
      VALUES (p_shop_id, p_customer_name, p_customer_phone, 1, v_pending_amt)
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE public.customers
      SET total_bills = total_bills + 1,
          pending_balance = pending_balance + v_pending_amt,
          phone = COALESCE(p_customer_phone, phone)
      WHERE id = v_customer_id;
    END IF;
  END IF;

  -- Insert Bill
  INSERT INTO public.bills (
    shop_id, bill_number, customer_id, customer_name, customer_phone,
    status, subtotal, gst_rate, gst_amount, total_amount,
    paid_amount, pending_amount, payment_mode, client_operation_id,
    created_by, completed_at
  ) VALUES (
    p_shop_id, p_bill_number, v_customer_id, p_customer_name, p_customer_phone,
    'completed', p_subtotal, p_gst_rate, p_gst_amount, p_total_amount,
    v_paid_amt, v_pending_amt, p_payment_mode, p_client_operation_id,
    auth.uid(), NOW()
  ) RETURNING id INTO v_bill_id;

  -- Insert Bill Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.bill_items (
      shop_id, bill_id, menu_item_id, item_name, is_half,
      unit_price, quantity, line_total
    ) VALUES (
      p_shop_id,
      v_bill_id,
      (v_item->>'menu_item_id')::UUID,
      v_item->>'item_name',
      COALESCE((v_item->>'is_half')::BOOLEAN, false),
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::INT,
      (v_item->>'line_total')::NUMERIC
    );
  END LOOP;

  -- Insert Payment record
  INSERT INTO public.payments (
    shop_id, bill_id, payment_method, amount, status,
    client_operation_id, created_by
  ) VALUES (
    p_shop_id,
    v_bill_id,
    p_payment_mode,
    v_paid_amt,
    CASE WHEN p_payment_mode = 'Pending' THEN 'pending' ELSE 'successful' END,
    p_client_operation_id,
    auth.uid()
  );

  -- Insert Pending Payment record if pending
  IF p_payment_mode = 'Pending' THEN
    INSERT INTO public.pending_payments (
      shop_id, bill_id, customer_id, customer_name, customer_phone,
      amount_due, amount_paid, status, created_by
    ) VALUES (
      p_shop_id,
      v_bill_id,
      v_customer_id,
      COALESCE(p_customer_name, 'Not tracked'),
      p_customer_phone,
      p_total_amount,
      0.00,
      'open',
      auth.uid()
    );
  END IF;

  -- Audit log
  INSERT INTO public.audit_logs (
    shop_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    p_shop_id, auth.uid(), 'bill.created', 'bill', v_bill_id::TEXT,
    jsonb_build_object('bill_number', p_bill_number, 'total', p_total_amount, 'mode', p_payment_mode)
  );

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'bill_number', p_bill_number,
    'is_duplicate', false
  );
END;
$$;
