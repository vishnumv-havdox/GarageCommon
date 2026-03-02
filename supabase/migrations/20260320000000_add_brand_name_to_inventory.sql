-- Migration to add brand_name to inventory table
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS brand_name TEXT;
