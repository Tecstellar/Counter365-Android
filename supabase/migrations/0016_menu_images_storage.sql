-- 0016_menu_images_storage.sql
-- Create public storage bucket for authentic menu item food photos

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  TRUE,
  5242880, -- 5 MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Allow public read access to all menu item images
CREATE POLICY "Public Read Menu Images" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

-- Allow authenticated users to upload and manage menu item images
CREATE POLICY "Shop Members Upload Menu Images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "Shop Members Update Menu Images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'menu-images');

CREATE POLICY "Shop Members Delete Menu Images" ON storage.objects
  FOR DELETE USING (bucket_id = 'menu-images');
