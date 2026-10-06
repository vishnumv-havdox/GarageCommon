-- =============================================================================
-- FIX: Missing RLS policies for authenticated users (Staff/Admin)
-- Migration: 20260320000008_fix_rls_authenticated_select.sql
-- Purpose: Allow staff and admins to view services and tasks
-- =============================================================================

-- 1. Policies for work_order_services
DROP POLICY IF EXISTS "Authenticated users can view work_order_services" ON public.work_order_services;
CREATE POLICY "Authenticated users can view work_order_services" ON public.work_order_services
    FOR SELECT TO authenticated USING (true);

-- 2. Policies for work_order_tasks
DROP POLICY IF EXISTS "Authenticated users can view work_order_tasks" ON public.work_order_tasks;
CREATE POLICY "Authenticated users can view work_order_tasks" ON public.work_order_tasks
    FOR SELECT TO authenticated USING (true);

-- 3. Policies for repair_tasks (Legacy)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_tasks') THEN
        DROP POLICY IF EXISTS "Authenticated users can view repair_tasks" ON public.repair_tasks;
        CREATE POLICY "Authenticated users can view repair_tasks" ON public.repair_tasks
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- Refresh schema
NOTIFY pgrst, 'reload schema';
