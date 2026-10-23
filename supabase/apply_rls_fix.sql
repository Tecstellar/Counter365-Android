-- =====================================================================
-- COUNTERPRO — 1-CLICK SUPABASE RLS & ANONYMOUS ACCESS FIX
-- Run this in your Supabase Dashboard: SQL Editor -> "New query" -> Paste -> "Run"
-- =====================================================================

-- 1. Ensure RLS policies allow the CounterPro Mobile App (anon + authenticated) full access
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on shops" ON public.shops;
CREATE POLICY "Allow all on shops" ON public.shops FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on shop_members" ON public.shop_members;
CREATE POLICY "Allow all on shop_members" ON public.shop_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on menu_categories" ON public.menu_categories;
CREATE POLICY "Allow all on menu_categories" ON public.menu_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on menu_items" ON public.menu_items;
CREATE POLICY "Allow all on menu_items" ON public.menu_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on vendors" ON public.vendors;
CREATE POLICY "Allow all on vendors" ON public.vendors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bills" ON public.bills;
CREATE POLICY "Allow all on bills" ON public.bills FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on bill_items" ON public.bill_items;
CREATE POLICY "Allow all on bill_items" ON public.bill_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on payments" ON public.payments;
CREATE POLICY "Allow all on payments" ON public.payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.pending_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on pending_payments" ON public.pending_payments;
CREATE POLICY "Allow all on pending_payments" ON public.pending_payments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on expenses" ON public.expenses;
CREATE POLICY "Allow all on expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on cash_sessions" ON public.cash_sessions;
CREATE POLICY "Allow all on cash_sessions" ON public.cash_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on subscriptions" ON public.subscriptions;
CREATE POLICY "Allow all on subscriptions" ON public.subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Storage Bucket 'receipts' Policies for Mobile App PDF Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', TRUE, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Public can view receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update receipt files" ON storage.objects;

CREATE POLICY "Anyone can read receipt files" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "Anyone can upload receipt files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Anyone can update receipt files" ON storage.objects FOR UPDATE USING (bucket_id = 'receipts');

-- 3. Mandatory App Version Control Table & Policies
CREATE TABLE IF NOT EXISTS public.app_version_control (
  id TEXT PRIMARY KEY DEFAULT 'counterpro_android',
  min_required_version TEXT NOT NULL DEFAULT '1.0.4',
  latest_version TEXT NOT NULL DEFAULT '1.0.4',
  is_mandatory_update BOOLEAN NOT NULL DEFAULT true,
  update_title TEXT NOT NULL DEFAULT 'Update Required',
  update_message TEXT NOT NULL DEFAULT 'Please update the app to continue using the service.',
  download_url TEXT NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.counterpro.bill',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_version_control ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on app_version_control" ON public.app_version_control;
CREATE POLICY "Allow all on app_version_control" ON public.app_version_control FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_version_control (
  id, min_required_version, latest_version, is_mandatory_update, update_title, update_message, download_url
) VALUES (
  'counterpro_android', '1.0.4', '1.0.4', true, 'Update Required', 'Please update the app to continue using the service.', 'https://play.google.com/store/apps/details?id=com.counterpro.bill'
) ON CONFLICT (id) DO NOTHING;

