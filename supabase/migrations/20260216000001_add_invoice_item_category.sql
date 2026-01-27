-- Add category column to invoice_items to track Service Type (e.g. Mechanical Repair)
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS category text;
