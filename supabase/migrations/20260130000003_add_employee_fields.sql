-- Migration: Add missing employee fields
-- Date: 2026-01-30
-- Description: Adds address, joining date, and identity fields to employees

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
ADD COLUMN IF NOT EXISTS pan_number TEXT;

COMMENT ON COLUMN public.employees.aadhaar_number IS 'Government ID: Aadhaar Number';
COMMENT ON COLUMN public.employees.pan_number IS 'Tax ID: PAN Number';

NOTIFY pgrst, 'reload schema';
