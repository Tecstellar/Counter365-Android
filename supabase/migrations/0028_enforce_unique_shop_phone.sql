-- =====================================================================
-- 0028_enforce_unique_shop_phone.sql
-- Enforce strict uniqueness on phone in shops table to prevent duplicates
-- =====================================================================

-- 1. Ensure any duplicate shops are cleaned up, keeping the latest one
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at DESC) as rn
  FROM public.shops
)
DELETE FROM public.shops
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Add UNIQUE constraint on shops.phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_phone_unique'
  ) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_phone_unique UNIQUE (phone);
  END IF;
END $$;

-- 3. Create unique index as well if not already present
CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_phone_unique ON public.shops (phone);

-- 4. Add trigger to enforce uniqueness and provide clear error messages
CREATE OR REPLACE FUNCTION public.prevent_duplicate_shop_phone()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.shops
    WHERE phone = NEW.phone
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'A shop with phone number % already exists. Duplicate shops are not allowed.', NEW.phone;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_shop_phone ON public.shops;
CREATE TRIGGER trigger_prevent_duplicate_shop_phone
  BEFORE INSERT OR UPDATE OF phone ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_shop_phone();
