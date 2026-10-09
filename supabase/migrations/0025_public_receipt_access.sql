-- 0025_public_receipt_access.sql
-- Allow anonymous/public reading of completed bills, items, and shop headers for WhatsApp receipts,
-- add is_vip flag to customers table, and configure public receipts storage bucket.

-- 1. Ensure is_vip column on customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Allow public/anon reading of completed bills for official web receipt lookup
DROP POLICY IF EXISTS "Public guest can view bills for receipt" ON public.bills;
CREATE POLICY "Public guest can view bills for receipt" ON public.bills
  FOR SELECT TO anon, authenticated
  USING (status = 'completed');

-- 3. Allow public/anon reading of bill items belonging to completed bills
DROP POLICY IF EXISTS "Public guest can view bill items for receipt" ON public.bill_items;
CREATE POLICY "Public guest can view bill items for receipt" ON public.bill_items
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills
      WHERE bills.id = bill_items.bill_id
        AND bills.status = 'completed'
    )
  );

-- 4. Allow public/anon reading of shop headers (name, address, phone, GST) for receipt display
DROP POLICY IF EXISTS "Public guest can view basic shop info for receipt" ON public.shops;
CREATE POLICY "Public guest can view basic shop info for receipt" ON public.shops
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5. Public receipts storage bucket for direct PDF download
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view receipt files" ON storage.objects;
CREATE POLICY "Public can view receipt files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Members can upload receipt files" ON storage.objects;
CREATE POLICY "Members can upload receipt files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');
