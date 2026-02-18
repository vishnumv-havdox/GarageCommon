-- =============================================================================
-- FIX: Missing RLS for work_order_tasks
-- Migration: 20260320000007_allow_customer_wo_tasks_final.sql
-- Purpose: Allow customers to see work_order_tasks (the new unified table)
-- =============================================================================

-- 1. Enable RLS on work_order_tasks
ALTER TABLE public.work_order_tasks ENABLE ROW LEVEL SECURITY;

-- 2. Create policy for Customers to view work_order_tasks
DROP POLICY IF EXISTS "Customers can view work_order_tasks for their vehicles" ON public.work_order_tasks;

CREATE POLICY "Customers can view work_order_tasks for their vehicles" ON public.work_order_tasks
    FOR SELECT USING (
        public.check_customer_access_to_work_order(work_order_id)
    );

-- 3. Refresh schema
NOTIFY pgrst, 'reload schema';
