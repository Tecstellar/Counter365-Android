-- 0020_shop_upi_id.sql
-- Add upi_id column to public.shops table for WhatsApp receipts and payment collection

ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS upi_id TEXT;
