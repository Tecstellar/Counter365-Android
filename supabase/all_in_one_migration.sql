-- =====================================================================
-- COUNTERPRO — COMPLETE ALL-IN-ONE SUPABASE DATABASE SETUP SCRIPT
-- Includes ALL 20 Tables, Functions, Seeds, Storage Buckets & RLS
-- Run this in Supabase Dashboard -> SQL Editor -> "New query" -> Run
-- =====================================================================

-- =====================================================================
-- 1. EXTENSIONS & BASE HELPERS
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 2. PROFILES (Users)
-- Standalone UUID allows 2Factor SMS phone authentication without Supabase Auth user dependency
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT 'Shop Owner',
  phone TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop legacy foreign key constraint to auth.users if previously present
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Safe column additions if table already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Shop Owner';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 3. SHOPS
-- =====================================================================
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
  table_management_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  table_count INT NOT NULL DEFAULT 4,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_type TEXT NOT NULL DEFAULT 'Tea Shop';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'Tamil Nadu';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'India';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS pincode TEXT NOT NULL DEFAULT '';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS gst_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS round_off_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS daily_backup_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS printer_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS printer_name TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS table_management_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS table_count INT NOT NULL DEFAULT 4;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_shops_updated_at ON public.shops;
CREATE TRIGGER trigger_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 4. SHOP MEMBERS (Roles: 'Owner', 'Supervisor', 'Biller')
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Owner' CHECK (role IN ('Owner', 'Supervisor', 'Biller')),
  permissions_override JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, user_id)
);

-- Safe column additions if table already existed
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Owner';
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS permissions_override JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.shop_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_shop_members_updated_at ON public.shop_members;
CREATE TRIGGER trigger_shop_members_updated_at
  BEFORE UPDATE ON public.shop_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 5. PERMISSIONS & ROLES
-- =====================================================================
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

-- Default Role Permissions mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('Owner', 'bill'), ('Owner', 'total'), ('Owner', 'exp'), ('Owner', 'pend'),
  ('Owner', 'report'), ('Owner', 'menu'), ('Owner', 'users'), ('Owner', 'subscription'),
  ('Supervisor', 'bill'), ('Supervisor', 'total'), ('Supervisor', 'exp'), ('Supervisor', 'pend'),
  ('Supervisor', 'report'), ('Supervisor', 'menu'), ('Supervisor', 'users'),
  ('Biller', 'bill'), ('Biller', 'total')
ON CONFLICT DO NOTHING;

-- User specific permission overrides
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.shop_members(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, permission_key)
);

-- =====================================================================
-- 6. MENU CATEGORIES & MENU ITEMS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add UNIQUE constraint on (shop_id, name) if not present to support upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_categories_shop_id_name_key'
  ) THEN
    ALTER TABLE public.menu_categories ADD CONSTRAINT menu_categories_shop_id_name_key UNIQUE (shop_id, name);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trigger_menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER trigger_menu_categories_updated_at
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  half_price NUMERIC(10, 2) DEFAULT 0.00,
  has_half BOOLEAN NOT NULL DEFAULT FALSE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  image_prompt TEXT,
  image_status TEXT DEFAULT 'completed',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS half_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS has_half BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_prompt TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_status TEXT DEFAULT 'completed';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trigger_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 7. CUSTOMERS & VENDORS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  notes TEXT,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_bills INT NOT NULL DEFAULT 0,
  status_tag TEXT DEFAULT 'Regular',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_vip BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_bills INT NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status_tag TEXT DEFAULT 'Regular';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  supply_type TEXT NOT NULL DEFAULT 'Supplies',
  location TEXT,
  schedule TEXT DEFAULT 'Regular',
  notes TEXT,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS supply_type TEXT NOT NULL DEFAULT 'Supplies';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS schedule TEXT DEFAULT 'Regular';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_vendors_updated_at ON public.vendors;
CREATE TRIGGER trigger_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 8. BILLS, BILL ITEMS, PAYMENTS, PENDING PAYMENTS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  table_number TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled', 'edited', 'refunded', 'deleted')),
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  pending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  initial_paid_amount NUMERIC(12, 2) DEFAULT 0.00,
  cash_amount NUMERIC(12, 2) DEFAULT 0.00,
  gpay_amount NUMERIC(12, 2) DEFAULT 0.00,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  collections JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  client_operation_id UUID,
  created_by TEXT,
  created_by_name TEXT DEFAULT 'Owner',
  created_by_role TEXT DEFAULT 'Owner',
  created_by_id TEXT,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  edited_by_name TEXT,
  edited_by_role TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by_name TEXT,
  deleted_by_role TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS initial_paid_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS gpay_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'Cash';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS collections JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS client_operation_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_by_name TEXT DEFAULT 'Owner';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_by_role TEXT DEFAULT 'Owner';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_by_id TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_by_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edited_by_role TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS deleted_by_role TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Relax payment_mode check constraint if it exists to allow Partial Pay, Split, Cash + GPay, GPay, Pending
DO $$
BEGIN
  ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_payment_mode_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS trigger_bills_updated_at ON public.bills;
CREATE TRIGGER trigger_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  is_half BOOLEAN NOT NULL DEFAULT FALSE,
  unit_price NUMERIC(10, 2) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  line_total NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS is_half BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2) NOT NULL DEFAULT 1;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.bill_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  reference_number TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  bill_number TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  age_description TEXT DEFAULT 'Today',
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  is_settled BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS bill_number TEXT;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS amount_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS age_description TEXT DEFAULT 'Today';
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.pending_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_pending_payments_updated_at ON public.pending_payments;
CREATE TRIGGER trigger_pending_payments_updated_at
  BEFORE UPDATE ON public.pending_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 9. EXPENSES & CASH SESSIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'General',
  title TEXT NOT NULL DEFAULT 'Expense',
  description TEXT NOT NULL DEFAULT 'Expense',
  item_name TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  notes TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT 'Expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'Cash';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_expenses_updated_at ON public.expenses;
CREATE TRIGGER trigger_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  closing_cash NUMERIC(12, 2),
  actual_cash NUMERIC(12, 2) DEFAULT 0.00,
  difference NUMERIC(12, 2) DEFAULT 0.00,
  total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'closed',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opening_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opening_float NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closing_cash NUMERIC(12, 2);
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS actual_cash NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS difference NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS total_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =====================================================================
-- 10. REFUNDS (Financial Events)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT,
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_operation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 11. AUDIT LOGS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 12. SUBSCRIPTIONS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  interval TEXT NOT NULL DEFAULT 'month',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  subscription_start_at TIMESTAMPTZ,
  subscription_end_at TIMESTAMPTZ,
  payment_reference TEXT,
  cashfree_order_id TEXT,
  currency TEXT DEFAULT 'INR',
  duration_months INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe column additions if table already existed
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS interval TEXT NOT NULL DEFAULT 'month';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month');
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS subscription_start_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS subscription_end_at TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cashfree_order_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS duration_months INT DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON public.subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_cashfree_order_id ON public.subscriptions(cashfree_order_id);

-- =====================================================================
-- 13. ACCOUNT DELETIONS
-- =====================================================================
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

-- =====================================================================
-- 14. HELPER RPC FUNCTIONS (is_shop_member, has_shop_permission, create_bill_atomic)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_shop_member(target_shop_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = target_shop_id
      AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_shop_permission(target_shop_id UUID, perm_key TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_bill_atomic(
  p_shop_id UUID,
  p_bill_number TEXT,
  p_items JSONB,
  p_subtotal NUMERIC,
  p_gst_rate NUMERIC,
  p_gst_amount NUMERIC,
  p_total_amount NUMERIC,
  p_payment_mode TEXT,
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
  -- Idempotency check
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

  -- Determine paid vs pending
  IF p_payment_mode = 'Pending' THEN
    v_pending_amt := p_total_amount;
    v_paid_amt := 0.00;
  ELSE
    v_paid_amt := p_total_amount;
    v_pending_amt := 0.00;
  END IF;

  -- Customer link
  IF p_customer_name IS NOT NULL AND TRIM(p_customer_name) <> '' THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE shop_id = p_shop_id AND name ILIKE TRIM(p_customer_name)
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (shop_id, name, phone, pending_balance, total_spent, total_bills)
      VALUES (p_shop_id, TRIM(p_customer_name), p_customer_phone, v_pending_amt, v_paid_amt, 1)
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE public.customers
      SET total_spent = total_spent + v_paid_amt,
          pending_balance = pending_balance + v_pending_amt,
          total_bills = total_bills + 1,
          phone = COALESCE(p_customer_phone, phone),
          updated_at = NOW()
      WHERE id = v_customer_id;
    END IF;
  END IF;

  -- Insert bill
  INSERT INTO public.bills (
    shop_id, bill_number, customer_id, customer_name, customer_phone,
    status, subtotal, discount_amount, tax_amount, gst_amount, gst_rate,
    total_amount, paid_amount, pending_amount, initial_paid_amount, payment_mode,
    client_operation_id
  ) VALUES (
    p_shop_id, p_bill_number, v_customer_id, p_customer_name, p_customer_phone,
    'completed', p_subtotal, 0.00, p_gst_amount, p_gst_amount, p_gst_rate,
    p_total_amount, v_paid_amt, v_pending_amt, v_paid_amt, p_payment_mode,
    p_client_operation_id
  ) RETURNING id INTO v_bill_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.bill_items (
      bill_id, shop_id, menu_item_id, item_name, is_half, unit_price, quantity, line_total
    ) VALUES (
      v_bill_id, p_shop_id,
      CASE WHEN (v_item->>'menu_item_id') IS NOT NULL AND (v_item->>'menu_item_id') <> ''
           THEN (v_item->>'menu_item_id')::UUID ELSE NULL END,
      v_item->>'item_name',
      COALESCE((v_item->>'is_half')::BOOLEAN, false),
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'line_total')::NUMERIC
    );
  END LOOP;

  -- Insert payment if paid
  IF v_paid_amt > 0 THEN
    INSERT INTO public.payments (shop_id, bill_id, payment_method, amount, status)
    VALUES (p_shop_id, v_bill_id, p_payment_mode, v_paid_amt, 'completed');
  END IF;

  -- Insert pending if applicable
  IF v_pending_amt > 0 THEN
    INSERT INTO public.pending_payments (shop_id, bill_id, customer_id, customer_name, customer_phone, amount, amount_due, amount_paid, is_settled)
    VALUES (p_shop_id, v_bill_id, v_customer_id, COALESCE(p_customer_name, 'Customer'), p_customer_phone, v_pending_amt, v_pending_amt, 0.00, false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'bill_number', p_bill_number
  );
END;
$$;

-- =====================================================================
-- 15. STARTER CATALOG SEED FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION public.seed_starter_catalog(p_shop_id UUID, p_shop_type TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_cat_tea UUID;
  v_cat_snack UUID;
  v_cat_cold UUID;
  v_cat_coffee UUID;
  v_cat_bakes UUID;
  v_cat_rolls UUID;
  v_cat_fried UUID;
  v_cat_morn UUID;
  v_cat_eve UUID;
  v_cat_addons UUID;
  v_cat_starters UUID;
  v_cat_main UUID;
BEGIN
  IF p_shop_type = 'Tea Shop' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Tea & Coffee', 0) RETURNING id INTO v_cat_tea;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Snacks', 1) RETURNING id INTO v_cat_snack;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_tea, 'Tea', 12.00, 7.00, true, true),
      (p_shop_id, v_cat_tea, 'Strong Tea', 15.00, 9.00, true, true),
      (p_shop_id, v_cat_tea, 'Milk Coffee', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_tea, 'Black Tea', 10.00, 6.00, true, false),
      (p_shop_id, v_cat_tea, 'Boost', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_tea, 'Horlicks', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_tea, 'Ginger Tea', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_tea, 'Elaichi Tea', 18.00, 11.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_snack, 'Vada', 12.00, 7.00, true, false),
      (p_shop_id, v_cat_snack, 'Bonda', 10.00, 6.00, true, false),
      (p_shop_id, v_cat_snack, 'Samosa', 15.00, 9.00, true, false),
      (p_shop_id, v_cat_snack, 'Bun Butter', 30.00, 18.00, true, false),
      (p_shop_id, v_cat_snack, 'Egg Puffs', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_snack, 'Biscuit', 10.00, 6.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Lemon Juice', 25.00, 15.00, true, false),
      (p_shop_id, v_cat_cold, 'Butter Milk', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_cold, 'Cool Drink', 20.00, 12.00, true, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Cafe' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Coffee', 0) RETURNING id INTO v_cat_coffee;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Bakes', 1) RETURNING id INTO v_cat_bakes;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_coffee, 'Espresso', 90.00, 0.00, false, true),
      (p_shop_id, v_cat_coffee, 'Cappuccino', 140.00, 0.00, false, true),
      (p_shop_id, v_cat_coffee, 'Latte', 150.00, 0.00, false, false),
      (p_shop_id, v_cat_coffee, 'Mocha', 170.00, 0.00, false, false),
      (p_shop_id, v_cat_coffee, 'Americano', 110.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_bakes, 'Croissant', 110.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Brownie', 95.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Muffin', 85.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Cheese Cake', 160.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Iced Latte', 160.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Cold Coffee', 130.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Lemonade', 90.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Bakery' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Bakes', 0) RETURNING id INTO v_cat_bakes;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Snacks', 1) RETURNING id INTO v_cat_snack;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_bakes, 'Black Forest', 75.00, 0.00, false, true),
      (p_shop_id, v_cat_bakes, 'Butter Biscuit (100g)', 45.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Rusk (250g)', 60.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'White Bread', 40.00, 0.00, false, false),
      (p_shop_id, v_cat_bakes, 'Wheat Bread', 50.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_snack, 'Veg Puff', 20.00, 0.00, false, true),
      (p_shop_id, v_cat_snack, 'Egg Puff', 25.00, 0.00, false, true),
      (p_shop_id, v_cat_snack, 'Chicken Puff', 35.00, 0.00, false, false),
      (p_shop_id, v_cat_snack, 'Samosa', 15.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Badam Milk', 35.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Rose Milk', 35.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Fast Food' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Rolls', 0) RETURNING id INTO v_cat_rolls;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Fried', 1) RETURNING id INTO v_cat_fried;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_rolls, 'Veg Roll', 70.00, 45.00, true, false),
      (p_shop_id, v_cat_rolls, 'Egg Roll', 80.00, 50.00, true, false),
      (p_shop_id, v_cat_rolls, 'Chicken Roll', 110.00, 70.00, true, true),
      (p_shop_id, v_cat_rolls, 'Paneer Roll', 100.00, 65.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_fried, 'Veg Fried Rice', 90.00, 55.00, true, false),
      (p_shop_id, v_cat_fried, 'Egg Fried Rice', 110.00, 70.00, true, false),
      (p_shop_id, v_cat_fried, 'Chicken Fried Rice', 130.00, 80.00, true, true),
      (p_shop_id, v_cat_fried, 'Veg Noodles', 90.00, 55.00, true, false),
      (p_shop_id, v_cat_fried, 'Chicken Noodles', 130.00, 80.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Cool Drink', 20.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);

  ELSIF p_shop_type = 'Juice Shop' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Fresh Juice', 0) RETURNING id INTO v_cat_cold;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Shakes', 1) RETURNING id INTO v_cat_rolls;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Snacks', 2) RETURNING id INTO v_cat_snack;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Orange Juice', 50.00, 30.00, true, true),
      (p_shop_id, v_cat_cold, 'Apple Juice', 60.00, 35.00, true, true),
      (p_shop_id, v_cat_cold, 'Pomegranate Juice', 70.00, 45.00, true, false),
      (p_shop_id, v_cat_cold, 'Watermelon Juice', 40.00, 25.00, true, false),
      (p_shop_id, v_cat_cold, 'Mosambi Juice', 50.00, 30.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_rolls, 'Banana Shake', 50.00, 30.00, true, false),
      (p_shop_id, v_cat_rolls, 'Chocolate Shake', 70.00, 45.00, true, true),
      (p_shop_id, v_cat_rolls, 'Mango Shake', 60.00, 40.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_snack, 'Bread Omelette', 45.00, 0.00, false, true),
      (p_shop_id, v_cat_snack, 'Veg Sandwich', 50.00, 0.00, false, false);

  ELSIF p_shop_type = 'Tiffin / Mess' OR p_shop_type = 'Tiffin Shop' THEN
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Morning', 0) RETURNING id INTO v_cat_morn;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Evening', 1) RETURNING id INTO v_cat_eve;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Addons', 2) RETURNING id INTO v_cat_addons;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_morn, 'Idli (2 pcs)', 30.00, 15.00, true, true),
      (p_shop_id, v_cat_morn, 'Medu Vada (1 pc)', 15.00, 0.00, false, true),
      (p_shop_id, v_cat_morn, 'Plain Dosa', 40.00, 0.00, false, false),
      (p_shop_id, v_cat_morn, 'Masala Dosa', 60.00, 0.00, false, true),
      (p_shop_id, v_cat_morn, 'Poori (2 pcs)', 50.00, 0.00, false, false),
      (p_shop_id, v_cat_morn, 'Pongal', 45.00, 25.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_eve, 'Parotta (2 pcs)', 45.00, 0.00, false, true),
      (p_shop_id, v_cat_eve, 'Egg Dosa', 55.00, 0.00, false, false),
      (p_shop_id, v_cat_eve, 'Chapathi (2 pcs)', 40.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_addons, 'Egg Omelette', 25.00, 0.00, false, false),
      (p_shop_id, v_cat_addons, 'Filter Coffee', 20.00, 0.00, false, false),
      (p_shop_id, v_cat_addons, 'Tea', 15.00, 0.00, false, false);

  ELSE
    -- Generic Restaurant fallback
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Starters', 0) RETURNING id INTO v_cat_starters;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Main Course', 1) RETURNING id INTO v_cat_main;
    INSERT INTO public.menu_categories (shop_id, name, sort_order) VALUES (p_shop_id, 'Cold Drinks', 2) RETURNING id INTO v_cat_cold;

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_starters, 'Veg Soup', 60.00, 0.00, false, false),
      (p_shop_id, v_cat_starters, 'Chicken 65', 140.00, 80.00, true, true),
      (p_shop_id, v_cat_starters, 'Paneer Tikka', 130.00, 75.00, true, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_main, 'Veg Biryani', 120.00, 70.00, true, false),
      (p_shop_id, v_cat_main, 'Chicken Biryani', 160.00, 100.00, true, true),
      (p_shop_id, v_cat_main, 'Parotta (2 pcs)', 40.00, 0.00, false, false),
      (p_shop_id, v_cat_main, 'Meals', 100.00, 0.00, false, false);

    INSERT INTO public.menu_items (shop_id, category_id, name, price, half_price, has_half, is_favorite) VALUES
      (p_shop_id, v_cat_cold, 'Fresh Lime Soda', 40.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Butter Milk', 25.00, 0.00, false, false),
      (p_shop_id, v_cat_cold, 'Water 1L', 20.00, 0.00, false, false);
  END IF;
END;
$$;

-- =====================================================================
-- 16. STORAGE BUCKETS (menu-images & shop-logos)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('menu-images', 'menu-images', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('shop-logos', 'shop-logos', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Storage Policies for menu-images
DROP POLICY IF EXISTS "Public Read Menu Images" ON storage.objects;
CREATE POLICY "Public Read Menu Images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Shop Members Upload Menu Images" ON storage.objects;
CREATE POLICY "Shop Members Upload Menu Images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Shop Members Update Menu Images" ON storage.objects;
CREATE POLICY "Shop Members Update Menu Images" ON storage.objects FOR UPDATE USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Shop Members Delete Menu Images" ON storage.objects;
CREATE POLICY "Shop Members Delete Menu Images" ON storage.objects FOR DELETE USING (bucket_id = 'menu-images');

-- Storage Policies for shop-logos
DROP POLICY IF EXISTS "Public Read Shop Logos" ON storage.objects;
CREATE POLICY "Public Read Shop Logos" ON storage.objects FOR SELECT USING (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "Shop Members Upload Shop Logos" ON storage.objects;
CREATE POLICY "Shop Members Upload Shop Logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "Shop Members Update Shop Logos" ON storage.objects;
CREATE POLICY "Shop Members Update Shop Logos" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-logos');

DROP POLICY IF EXISTS "Shop Members Delete Shop Logos" ON storage.objects;
CREATE POLICY "Shop Members Delete Shop Logos" ON storage.objects FOR DELETE USING (bucket_id = 'shop-logos');

-- =====================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES — ALLOW ALL FOR MOBILE CLIENT
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

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on permissions" ON public.permissions;
CREATE POLICY "Allow all on permissions" ON public.permissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on role_permissions" ON public.role_permissions;
CREATE POLICY "Allow all on role_permissions" ON public.role_permissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on user_permission_overrides" ON public.user_permission_overrides;
CREATE POLICY "Allow all on user_permission_overrides" ON public.user_permission_overrides FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

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

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on refunds" ON public.refunds;
CREATE POLICY "Allow all on refunds" ON public.refunds FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all on audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subscriptions" ON public.subscriptions;
CREATE POLICY "Allow all on subscriptions" ON public.subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on account_deletions" ON public.account_deletions;
CREATE POLICY "Allow all on account_deletions" ON public.account_deletions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
