-- 0009_rls_policies.sql

-- Enable RLS on all public tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: Check if current auth user is a member of the shop
CREATE OR REPLACE FUNCTION public.is_shop_member(target_shop_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = target_shop_id
      AND user_id = auth.uid()
      AND is_active = true
  );
END;
$$;

-- Helper: Check if member has specific permission
CREATE OR REPLACE FUNCTION public.has_shop_permission(target_shop_id UUID, perm_key TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql STABLE AS $$
DECLARE
  m_role TEXT;
  m_id UUID;
  has_override BOOLEAN;
  override_val BOOLEAN;
  has_role_perm BOOLEAN;
BEGIN
  -- Get user member record
  SELECT id, role INTO m_id, m_role
  FROM public.shop_members
  WHERE shop_id = target_shop_id
    AND user_id = auth.uid()
    AND is_active = true;

  IF m_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner always has permission
  IF m_role = 'Owner' THEN
    RETURN TRUE;
  END IF;

  -- Check if override exists
  SELECT TRUE, granted INTO has_override, override_val
  FROM public.user_permission_overrides
  WHERE member_id = m_id AND permission_key = perm_key;

  IF has_override THEN
    RETURN override_val;
  END IF;

  -- Fallback to default role permissions
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = m_role AND permission_key = perm_key
  ) INTO has_role_perm;

  RETURN has_role_perm;
END;
$$;

-- 1. Profiles
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Shops
CREATE POLICY "Members can read their shop" ON public.shops
  FOR SELECT USING (public.is_shop_member(id));

CREATE POLICY "Owners and Supervisors can update shop" ON public.shops
  FOR UPDATE USING (public.has_shop_permission(id, 'menu'));

CREATE POLICY "Authenticated users can create a new shop" ON public.shops
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Shop Members
CREATE POLICY "Members can view shop members" ON public.shop_members
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Owners can manage shop members" ON public.shop_members
  FOR ALL USING (public.has_shop_permission(shop_id, 'users'));

-- 4. Menu & Categories
CREATE POLICY "Members can read menu categories" ON public.menu_categories
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with menu permission can write categories" ON public.menu_categories
  FOR ALL USING (public.has_shop_permission(shop_id, 'menu'));

CREATE POLICY "Members can read menu items" ON public.menu_items
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with menu permission can write menu items" ON public.menu_items
  FOR ALL USING (public.has_shop_permission(shop_id, 'menu'));

-- 5. Customers & Vendors
CREATE POLICY "Members can read customers" ON public.customers
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Members can insert/update customers" ON public.customers
  FOR ALL USING (public.is_shop_member(shop_id));

CREATE POLICY "Members can read vendors" ON public.vendors
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Members can insert/update vendors" ON public.vendors
  FOR ALL USING (public.has_shop_permission(shop_id, 'exp'));

-- 6. Bills & Items
CREATE POLICY "Members can read bills" ON public.bills
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with bill permission can insert bills" ON public.bills
  FOR INSERT WITH CHECK (public.has_shop_permission(shop_id, 'bill'));

CREATE POLICY "Members can read bill items" ON public.bill_items
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with bill permission can insert bill items" ON public.bill_items
  FOR INSERT WITH CHECK (public.has_shop_permission(shop_id, 'bill'));

-- 7. Payments & Pending
CREATE POLICY "Members can read payments" ON public.payments
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with bill permission can insert payments" ON public.payments
  FOR INSERT WITH CHECK (public.has_shop_permission(shop_id, 'bill'));

CREATE POLICY "Members can read pending payments" ON public.pending_payments
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with pend permission can update pending payments" ON public.pending_payments
  FOR ALL USING (public.has_shop_permission(shop_id, 'pend'));

-- 8. Expenses
CREATE POLICY "Members can read expenses" ON public.expenses
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with exp permission can write expenses" ON public.expenses
  FOR ALL USING (public.has_shop_permission(shop_id, 'exp'));

-- 9. Cash Sessions & Subscriptions & Audit
CREATE POLICY "Members can read cash sessions" ON public.cash_sessions
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Users with report permission can write cash sessions" ON public.cash_sessions
  FOR ALL USING (public.has_shop_permission(shop_id, 'report'));

CREATE POLICY "Members can read subscriptions" ON public.subscriptions
  FOR SELECT USING (public.is_shop_member(shop_id));

CREATE POLICY "Owners can manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_shop_permission(shop_id, 'subscription'));

CREATE POLICY "Members can read audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_shop_permission(shop_id, 'report'));
