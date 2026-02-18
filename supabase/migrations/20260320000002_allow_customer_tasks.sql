-- =============================================================================
-- FIX: Enable customers to view service details and tasks
-- Migration: 20260320000002_allow_customer_tasks.sql
-- Purpose: Allow customers to see work_order_services and repair_tasks for their vehicles
-- =============================================================================

-- 1. Policy for work_order_services
DROP POLICY IF EXISTS "Customers can view services for their vehicles" ON public.work_order_services;

CREATE POLICY "Customers can view services for their vehicles" ON public.work_order_services
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.vehicles v ON v.id = wo.vehicle_id
            JOIN public.customers c ON c.id = v.customer_id
            WHERE wo.id = work_order_services.work_order_id
            AND c.user_id = auth.uid()
        )
    );

-- 2. Policy for repair_tasks (Legacy/Simple work orders)
DROP POLICY IF EXISTS "Customers can view repair_tasks for their vehicles" ON public.repair_tasks;

CREATE POLICY "Customers can view repair_tasks for their vehicles" ON public.repair_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.work_orders wo
            JOIN public.vehicles v ON v.id = wo.vehicle_id
            JOIN public.customers c ON c.id = v.customer_id
            WHERE wo.id = repair_tasks.work_order_id
            AND c.user_id = auth.uid()
        )
    );

-- 3. Refresh schema
NOTIFY pgrst, 'reload schema';
