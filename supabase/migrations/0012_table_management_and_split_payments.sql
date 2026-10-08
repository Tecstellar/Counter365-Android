-- 0012_table_management_and_split_payments.sql

-- Add table management configuration to shops
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS table_management_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS table_count INT DEFAULT 4;

-- Add table number and split payment breakdown columns to bills
ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS table_number TEXT,
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS gpay_amount NUMERIC(12, 2) DEFAULT 0.00;

-- Relax payment_mode check constraint if it exists to allow Partial Pay and Cash + GPay
DO $$
BEGIN
  ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_payment_mode_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
