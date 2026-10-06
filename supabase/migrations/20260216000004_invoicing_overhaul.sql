-- Migration: 20260129000005_invoicing_overhaul.sql
-- Description: Adds HSN, GST rates, and bank details for invoicing system

-- 1. Update Inventory Table
ALTER TABLE public.inventory 
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 18.0,
ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC DEFAULT 9.0,
ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC DEFAULT 9.0;

-- 2. Update Invoice Items Table
ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS taxable_value NUMERIC,
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC,
ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC,
ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC,
ADD COLUMN IF NOT EXISTS category TEXT; -- Ensure category exists for grouping

-- 3. Update Company Profiles Table
ALTER TABLE public.company_profiles
ADD COLUMN IF NOT EXISTS acc_name TEXT,
ADD COLUMN IF NOT EXISTS acc_number TEXT,
ADD COLUMN IF NOT EXISTS ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- Update existing records if bank_details jsonb has data
-- This is a best-effort migration if data exists in the old format
UPDATE public.company_profiles 
SET 
  acc_number = COALESCE(bank_details->>'account_no', acc_number),
  ifsc = COALESCE(bank_details->>'ifsc', ifsc),
  bank_name = COALESCE(bank_details->>'bank_name', bank_name);

-- 4. Reload Schema
NOTIFY pgrst, 'reload schema';
