-- 0018_production_data_integrity.sql
-- Production schema fixes for staff cross-device auth, lifetime bill tracking, and entity metadata

-- 1. Add lifetime monotonic bill counter to public.shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS total_bills_created INT DEFAULT 0;

-- 2. Add phone column and index to public.shop_members for direct cross-device staff phone lookup
ALTER TABLE public.shop_members 
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_members_phone ON public.shop_members(phone);
CREATE INDEX IF NOT EXISTS idx_shop_members_shop_user ON public.shop_members(shop_id, user_id);

-- 3. Add metadata columns to public.customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS status_tag TEXT,
ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE;

-- 4. Add AI image metadata columns to public.menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS image_prompt TEXT,
ADD COLUMN IF NOT EXISTS image_status TEXT DEFAULT 'completed';

-- 5. Trigger or atomic increment helper for lifetime total bills on shops
CREATE OR REPLACE FUNCTION public.increment_shop_bills_counter(p_shop_id UUID)
RETURNS INT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_new_count INT;
BEGIN
  UPDATE public.shops
  SET total_bills_created = COALESCE(total_bills_created, 0) + 1,
      updated_at = NOW()
  WHERE id = p_shop_id
  RETURNING total_bills_created INTO v_new_count;
  
  RETURN COALESCE(v_new_count, 1);
END;
$$;
