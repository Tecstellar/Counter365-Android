-- 0006_billing_and_payments.sql

-- Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL, -- e.g. '#0042'
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled', 'refunded')),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'GPay', 'Pending', 'Split')),
  client_operation_id UUID UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, bill_number)
);

CREATE TRIGGER trigger_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Bill Items (snapshots for immutable historical records)
CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  is_half BOOLEAN NOT NULL DEFAULT FALSE,
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'GPay', 'Pending', 'Other')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'successful' CHECK (status IN ('successful', 'pending', 'failed', 'refunded')),
  client_operation_id UUID,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pending Payments Tracker
CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount_due NUMERIC(12, 2) NOT NULL CHECK (amount_due >= 0),
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  notes TEXT,
  settled_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_pending_payments_updated_at
  BEFORE UPDATE ON public.pending_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
