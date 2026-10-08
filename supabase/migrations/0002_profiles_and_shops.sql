-- 0002_profiles_and_shops.sql

-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Shops
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  shop_type TEXT NOT NULL, -- 'Tea Shop', 'Cafe', 'Fast Food', 'Tiffin Shop', 'Restaurant'
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Tamil Nadu',
  country TEXT NOT NULL DEFAULT 'India',
  pincode TEXT NOT NULL,
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

CREATE TRIGGER trigger_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
