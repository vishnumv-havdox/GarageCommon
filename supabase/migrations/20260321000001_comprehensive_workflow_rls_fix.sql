-- Migration: 20260321000000_comprehensive_workflow_rls_fix.sql
-- Description: Fix missing RLS management policies for unified work order tables

-- 1. work_order_tasks
-- Allow Staff, Managers, and Admins to manage tasks
DROP POLICY IF EXISTS "Admins and staff can manage work_order_tasks" ON public.work_order_tasks;
CREATE POLICY "Admins and staff can manage work_order_tasks" ON public.work_order_tasks
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- 2. work_order_services
-- Allow Staff, Managers, and Admins to manage services
DROP POLICY IF EXISTS "Admins and staff can manage work_order_services" ON public.work_order_services;
CREATE POLICY "Admins and staff can manage work_order_services" ON public.work_order_services
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- 3. Ensure RLS is enabled on other related workflow tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_order_service_tasks') THEN
        ALTER TABLE public.work_order_service_tasks ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Staff+ management" ON public.work_order_service_tasks;
        CREATE POLICY "Staff+ management" ON public.work_order_service_tasks 
            FOR ALL TO authenticated 
            USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')))
            WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_order_service_notes') THEN
        ALTER TABLE public.work_order_service_notes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Staff+ management" ON public.work_order_service_notes;
        CREATE POLICY "Staff+ management" ON public.work_order_service_notes 
            FOR ALL TO authenticated 
            USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')))
            WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff')));
    END IF;
END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
