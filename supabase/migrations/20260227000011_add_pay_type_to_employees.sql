-- Migration: 20260227000011_add_pay_type_to_employees
-- Description: Add pay_type to employees table for UI sync

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT 'monthly';

-- Update existing employees to match their salary configs if they exist
DO $$
BEGIN
    UPDATE public.employees e
    SET pay_type = esc.pay_type
    FROM public.employee_salary_configs esc
    WHERE esc.employee_id = e.id;
END$$;
