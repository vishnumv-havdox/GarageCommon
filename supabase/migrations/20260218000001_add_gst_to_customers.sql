-- Add gst_number column to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gst_number text;
