-- Migration: Add DOB and Blood Group to employees
-- Date: 2026-01-30
-- Description: Adds date of birth and blood group fields

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS blood_group TEXT;

NOTIFY pgrst, 'reload schema';
