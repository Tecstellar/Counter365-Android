-- =====================================================================
-- 0026_receipt_storage_policies.sql
-- Allow CounterPro mobile app (anon + authenticated) to upload, update,
-- and read PDF receipts in the 'receipts' storage bucket.
-- =====================================================================

-- 1. Ensure receipts bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  TRUE,
  10485760, -- 10 MB max per PDF receipt
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Public can view receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Members can upload receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update receipt files" ON storage.objects;

-- 3. Allow anyone (anon + authenticated) to read receipts
CREATE POLICY "Anyone can read receipt files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'receipts');

-- 4. Allow app users (anon + authenticated) to upload receipts
CREATE POLICY "Anyone can upload receipt files" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

-- 5. Allow app users (anon + authenticated) to update receipts on retry or bill edit
CREATE POLICY "Anyone can update receipt files" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'receipts');
