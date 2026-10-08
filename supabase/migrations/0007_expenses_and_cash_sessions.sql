-- 0007_expenses_and_cash_sessions.sql

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cash Sessions (Daily drawer closing)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gpay_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  bills_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
