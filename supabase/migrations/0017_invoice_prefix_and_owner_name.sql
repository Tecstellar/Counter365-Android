-- 0017_invoice_prefix_and_owner_name.sql

-- Add owner_name, invoice_prefix, and invoice_reset_cycle to public.shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT,
ADD COLUMN IF NOT EXISTS invoice_reset_cycle TEXT DEFAULT 'monthly';
