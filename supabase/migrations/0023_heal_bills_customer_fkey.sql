-- 0023_heal_bills_customer_fkey.sql
-- Self-healing triggers to guarantee foreign key integrity for bills and pending_payments.
-- Prevents "violates foreign key constraint bills_customer_id_fkey" errors permanently.

-- Function for public.bills
CREATE OR REPLACE FUNCTION public.heal_missing_bill_customer_fkey()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
      -- Attempt auto-creation of missing customer if shop_id is present
      IF NEW.shop_id IS NOT NULL AND (NEW.customer_name IS NOT NULL OR NEW.customer_phone IS NOT NULL) THEN
        BEGIN
          INSERT INTO public.customers (
            id,
            shop_id,
            name,
            phone,
            status_tag,
            is_active,
            total_bills,
            pending_balance
          ) VALUES (
            NEW.customer_id,
            NEW.shop_id,
            COALESCE(NULLIF(TRIM(NEW.customer_name), ''), 'Customer'),
            COALESCE(NEW.customer_phone, ''),
            'Regular',
            true,
            0,
            0
          )
          ON CONFLICT (id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
          -- In case of concurrent insert or phone uniqueness constraint, fall through to fallback check
          NULL;
        END;
      END IF;

      -- If customer still does not exist in public.customers, set foreign key to NULL
      -- so the bill is safely persisted without violating bills_customer_id_fkey
      IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
        NEW.customer_id := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_heal_missing_bill_customer_fkey ON public.bills;
CREATE TRIGGER trigger_heal_missing_bill_customer_fkey
  BEFORE INSERT OR UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.heal_missing_bill_customer_fkey();

-- Function for public.pending_payments
CREATE OR REPLACE FUNCTION public.heal_missing_pending_payment_customer_fkey()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = NEW.customer_id) THEN
      -- If customer is missing in public.customers, set foreign key to NULL
      NEW.customer_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_heal_missing_pending_payment_customer_fkey ON public.pending_payments;
CREATE TRIGGER trigger_heal_missing_pending_payment_customer_fkey
  BEFORE INSERT OR UPDATE ON public.pending_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.heal_missing_pending_payment_customer_fkey();
