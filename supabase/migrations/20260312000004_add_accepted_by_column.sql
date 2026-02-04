-- Add accepted_by column to work_order_service_employees table
-- This tracks which admin approved the assignment

ALTER TABLE public.work_order_service_employees
ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.work_order_service_employees.accepted_by IS 'Admin user who approved/released this assignment to staff';
