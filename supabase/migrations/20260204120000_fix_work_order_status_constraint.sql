-- Migration: 20260204120000_fix_work_order_status_constraint
-- Description: Drop legacy work_orders_status_check constraint that conflicts with new status values (Pending Approval, etc.)

SET session_replication_role = 'replica';

-- Drop the old restrictive constraint
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_status_check;

-- Drop other potential legacy constraints that might conflict with v2 versions
ALTER TABLE public.work_order_services DROP CONSTRAINT IF EXISTS work_order_services_status_check;
ALTER TABLE public.work_order_assignments DROP CONSTRAINT IF EXISTS work_order_assignments_status_check;
ALTER TABLE public.work_order_service_employees DROP CONSTRAINT IF EXISTS work_order_service_employees_status_check;

-- Ensure the v2 constraint exists for work_orders (redundant safety check, should already be there from 20260129)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_status_check_v2') THEN
        ALTER TABLE public.work_orders 
        ADD CONSTRAINT work_orders_status_check_v2 
        CHECK (status IN ('Pending', 'In Progress', 'Pending Approval', 'Approved', 'Completed', 'Cancelled', 'Rejected'));
    END IF;
END$$;

NOTIFY pgrst, 'reload schema';

RESET session_replication_role;
