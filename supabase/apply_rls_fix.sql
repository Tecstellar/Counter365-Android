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
