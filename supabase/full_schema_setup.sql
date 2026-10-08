-- =====================================================================
-- COUNTERPRO — COMPLETE DATABASE SETUP & FOREIGN KEY FIX SCRIPT
-- Paste and Run this in Supabase Dashboard -> SQL Editor -> "New query" -> Run
-- =====================================================================

-- 1. EXTENSIONS & BASE HELPERS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. PROFILES (Users) — UNLINK FROM auth.users TO ALLOW 2FACTOR PHONE USERS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT 'Shop Owner',
  phone TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop old foreign key constraint to auth.users if it was previously created
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. SHOPS
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shop_type TEXT NOT NULL DEFAULT 'Tea Shop',
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'Tamil Nadu',
  country TEXT NOT NULL DEFAULT 'India',
  pincode TEXT NOT NULL DEFAULT '',
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  logo_url TEXT,
  currency_code TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
  gst_number TEXT,
  round_off_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  printer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  printer_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_shops_updated_at ON public.shops;
CREATE TRIGGER trigger_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. SHOP MEMBERS (Staff & Roles)
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Owner' CHECK (role IN ('Owner', 'Supervisor', 'Biller')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, user_id)
);

DROP TRIGGER IF EXISTS trigger_shop_members_updated_at ON public.shop_members;
CREATE TRIGGER trigger_shop_members_updated_at
  BEFORE UPDATE ON public.shop_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. PERMISSIONS
CREATE TABLE IF NOT EXISTS public.permissions (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO public.permissions (key, name, description) VALUES
  ('bill', 'Take bills', 'Create and save bills'),
  ('total', 'See day takings', 'View daily sales revenue total'),
  ('exp', 'Add expenses', 'Record shop expenses'),
  ('pend', 'Clear pending', 'Mark pending customer payments as settled'),
  ('report', 'See day report & analytics', 'Access full analytics and reports'),
  ('menu', 'Edit menu & prices', 'Modify menu catalog and prices'),
  ('users', 'Add or remove users', 'Manage shop staff and helper roles'),
  ('subscription', 'Manage plan', 'Upgrade or modify CounterPro subscription')
ON CONFLICT (key) DO NOTHING;

-- 6. MENU CATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, name)
);

DROP TRIGGER IF EXISTS trigger_menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER trigger_menu_categories_updated_at
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  half_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (half_price >= 0),
  has_half BOOLEAN NOT NULL DEFAULT FALSE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  total_bills INT NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. VENDORS
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  supply_type TEXT NOT NULL DEFAULT 'Supplies',
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trigger_vendors_updated_at ON public.vendors;
CREATE TRIGGER trigger_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. BILLS
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded')),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_mode TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_mode IN ('Cash', 'GPay', 'Pending')),
  client_operation_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_shop_date ON public.bills(shop_id, created_at DESC);

-- 11. BILL ITEMS
CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  menu_item_id UUID,
  item_name TEXT NOT NULL,
  is_half BOOLEAN NOT NULL DEFAULT FALSE,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  quantity INT NOT NULL DEFAULT 1,
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON public.bill_items(bill_id);

-- 12. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  status TEXT NOT NULL DEFAULT 'completed',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. PENDING PAYMENTS
CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cleared_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  cleared_at TIMESTAMPTZ,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'General',
  item_name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_shop_date ON public.expenses(shop_id, expense_date DESC);

-- 15. CASH SESSIONS
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  closing_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  actual_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  difference NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- 16. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_name TEXT NOT NULL DEFAULT 'Free Plan',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'expired')),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  interval TEXT NOT NULL DEFAULT 'lifetime',
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  payment_reference TEXT,
  cashfree_order_id TEXT,
  currency TEXT DEFAULT 'INR',
  duration_months INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — ALLOW ANONYMOUS & AUTHENTICATED ACCESS
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on shops" ON public.shops;
CREATE POLICY "Allow all on shops" ON public.shops FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on shop_members" ON public.shop_members;
CREATE POLICY "Allow all on shop_members" ON public.shop_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on menu_categories" ON public.menu_categories;
CREATE POLICY "Allow all on menu_categories" ON public.menu_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on menu_items" ON public.menu_items;
CREATE POLICY "Allow all on menu_items" ON public.menu_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on vendors" ON public.vendors;
CREATE POLICY "Allow all on vendors" ON public.vendors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bills" ON public.bills;
CREATE POLICY "Allow all on bills" ON public.bills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bill_items" ON public.bill_items;
CREATE POLICY "Allow all on bill_items" ON public.bill_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on payments" ON public.payments;
CREATE POLICY "Allow all on payments" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on pending_payments" ON public.pending_payments;
CREATE POLICY "Allow all on pending_payments" ON public.pending_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on expenses" ON public.expenses;
CREATE POLICY "Allow all on expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cash_sessions" ON public.cash_sessions;
CREATE POLICY "Allow all on cash_sessions" ON public.cash_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subscriptions" ON public.subscriptions;
CREATE POLICY "Allow all on subscriptions" ON public.subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 12. ACCOUNT DELETIONS TABLE
CREATE TABLE IF NOT EXISTS public.account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  shop_id UUID,
  shop_name TEXT,
  owner_name TEXT,
  phone TEXT,
  reason TEXT NOT NULL,
  feedback TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_deleted_at ON public.account_deletions (deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletions_reason ON public.account_deletions (reason);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on account_deletions" ON public.account_deletions;
CREATE POLICY "Allow all on account_deletions" ON public.account_deletions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
