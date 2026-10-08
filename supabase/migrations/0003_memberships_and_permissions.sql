-- 0003_memberships_and_permissions.sql

-- Shop Members (Roles: 'Owner', 'Supervisor', 'Biller')
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Supervisor', 'Biller')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, user_id)
);

CREATE TRIGGER trigger_shop_members_updated_at
  BEFORE UPDATE ON public.shop_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Base Permissions table
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
