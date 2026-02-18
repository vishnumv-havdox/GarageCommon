-- =============================================================================
-- FIX: Recursion/Stack Depth Fix (500 Error) v2
-- Migration: 20260320000003_fix_rls_recursion_final.sql
-- Purpose: Use PLPGSQL to prevent inlining and strictly enforce security context
-- =============================================================================

-- 1. Create helper function to get customer_id safely
-- usage of PLPGSQL prevents inlining, ensuring SECURITY DEFINER works as expected
CREATE OR REPLACE FUNCTION public.get_customer_id_for_user(p_user_id uuid)
RETURNS uuid AS $$
DECLARE
    v_customer_id uuid;
BEGIN
    SELECT id INTO v_customer_id FROM public.customers WHERE user_id = p_user_id LIMIT 1;
    RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_customer_id_for_user(uuid) TO authenticated;

-- 2. Optimize WORK_ORDERS policy
DROP POLICY IF EXISTS "Customers can view work orders for their vehicles" ON public.work_orders;

CREATE POLICY "Customers can view work orders for their vehicles" ON public.work_orders
    FOR SELECT USING (
        vehicle_id IN (
            SELECT id FROM public.vehicles 
            WHERE customer_id = public.get_customer_id_for_user(auth.uid())
        )
    );

-- 3. Optimize DRIVERS policy
DROP POLICY IF EXISTS "Customers can view own company drivers" ON public.drivers;

CREATE POLICY "Customers can view own company drivers" ON public.drivers
    FOR SELECT USING (
        company_id = public.get_customer_id_for_user(auth.uid())
    );

-- 4. Optimize VEHICLES policy
DROP POLICY IF EXISTS "Customers can view own vehicles" ON public.vehicles;

CREATE POLICY "Customers can view own vehicles" ON public.vehicles
    FOR SELECT USING (
        customer_id = public.get_customer_id_for_user(auth.uid())
    );

-- 5. Optimize SERVICES and TASKS policies
DROP POLICY IF EXISTS "Customers can view services for their vehicles" ON public.work_order_services;
CREATE POLICY "Customers can view services for their vehicles" ON public.work_order_services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = work_order_services.work_order_id
            AND wo.vehicle_id IN (
                SELECT id FROM public.vehicles 
                WHERE customer_id = public.get_customer_id_for_user(auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Customers can view repair_tasks for their vehicles" ON public.repair_tasks;
CREATE POLICY "Customers can view repair_tasks for their vehicles" ON public.repair_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            WHERE wo.id = repair_tasks.work_order_id
            AND wo.vehicle_id IN (
                SELECT id FROM public.vehicles 
                WHERE customer_id = public.get_customer_id_for_user(auth.uid())
            )
        )
    );

-- 6. Refresh schema
NOTIFY pgrst, 'reload schema';
