-- =============================================================================
-- FIX: Infinite Recursion WorkOrder <-> Service
-- Migration: 20260320000006_fix_infinite_recursion_services.sql
-- Purpose: Break the RLS loop by using a SECURITY DEFINER function to check access
-- =============================================================================

-- 1. Create helper function to check if customer owns the work order's vehicle
-- SECURITY DEFINER allows this to run without triggering RLS on work_orders/vehicles recursively
CREATE OR REPLACE FUNCTION public.check_customer_access_to_work_order(p_work_order_id uuid)
RETURNS boolean AS $$
DECLARE
    v_user_customer_id uuid;
    v_wo_customer_id uuid;
BEGIN
    -- Get the customer_id for the current user
    v_user_customer_id := public.get_customer_id_for_user(auth.uid());
    
    IF v_user_customer_id IS NULL THEN
        RETURN false;
    END IF;

    -- Get the customer_id associated with the work order's vehicle
    SELECT v.customer_id INTO v_wo_customer_id
    FROM public.work_orders wo
    JOIN public.vehicles v ON v.id = wo.vehicle_id
    WHERE wo.id = p_work_order_id;
    
    RETURN v_user_customer_id = v_wo_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.check_customer_access_to_work_order(uuid) TO authenticated;

-- 2. Update Policy for work_order_services
DROP POLICY IF EXISTS "Customers can view services for their vehicles" ON public.work_order_services;

CREATE POLICY "Customers can view services for their vehicles" ON public.work_order_services
    FOR SELECT USING (
        public.check_customer_access_to_work_order(work_order_id)
    );

-- 3. Update Policy for repair_tasks
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_tasks') THEN
        DROP POLICY IF EXISTS "Customers can view repair_tasks for their vehicles" ON public.repair_tasks;

        CREATE POLICY "Customers can view repair_tasks for their vehicles" ON public.repair_tasks
            FOR SELECT USING (
                public.check_customer_access_to_work_order(work_order_id)
            );
    END IF;
END $$;

-- 4. Refresh schema
NOTIFY pgrst, 'reload schema';
