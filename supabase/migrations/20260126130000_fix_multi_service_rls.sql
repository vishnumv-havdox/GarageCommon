-- Migration: 20260126130000_fix_multi_service_rls.sql
-- Description: Update RLS policies for multi-service tables to include 'manager' role and ensure visibility

DO $$
BEGIN
    -- Update policies for work_order_services
    DROP POLICY IF EXISTS "Staff+ can read work_order_services" ON public.work_order_services;
    CREATE POLICY "Staff+ can read work_order_services" ON public.work_order_services 
        FOR SELECT USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));
        
    DROP POLICY IF EXISTS "Staff+ can insert work_order_services" ON public.work_order_services;
    CREATE POLICY "Staff+ can insert work_order_services" ON public.work_order_services 
        FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));
        
    DROP POLICY IF EXISTS "Staff+ can update work_order_services" ON public.work_order_services;
    CREATE POLICY "Staff+ can update work_order_services" ON public.work_order_services 
        FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    -- Update policies for work_order_service_tasks
    DROP POLICY IF EXISTS "Staff+ can read service_tasks" ON public.work_order_service_tasks;
    CREATE POLICY "Staff+ can read service_tasks" ON public.work_order_service_tasks 
        FOR SELECT USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    DROP POLICY IF EXISTS "Staff+ can insert service_tasks" ON public.work_order_service_tasks;
    CREATE POLICY "Staff+ can insert service_tasks" ON public.work_order_service_tasks 
        FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    DROP POLICY IF EXISTS "Staff+ can update service_tasks" ON public.work_order_service_tasks;
    CREATE POLICY "Staff+ can update service_tasks" ON public.work_order_service_tasks 
        FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    -- Update policies for work_order_service_employees
    DROP POLICY IF EXISTS "Staff+ can read service_employees" ON public.work_order_service_employees;
    CREATE POLICY "Staff+ can read service_employees" ON public.work_order_service_employees 
        FOR SELECT USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    DROP POLICY IF EXISTS "Staff+ can manage service_employees" ON public.work_order_service_employees;
    CREATE POLICY "Staff+ can manage service_employees" ON public.work_order_service_employees 
        FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    -- Update policies for work_order_service_notes
    DROP POLICY IF EXISTS "Staff+ can read service_notes" ON public.work_order_service_notes;
    CREATE POLICY "Staff+ can read service_notes" ON public.work_order_service_notes 
        FOR SELECT USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    DROP POLICY IF EXISTS "Staff+ can insert service_notes" ON public.work_order_service_notes;
    CREATE POLICY "Staff+ can insert service_notes" ON public.work_order_service_notes 
        FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));

    DROP POLICY IF EXISTS "Staff+ can update service_notes" ON public.work_order_service_notes;
    CREATE POLICY "Staff+ can update service_notes" ON public.work_order_service_notes 
        FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role IN ('admin', 'manager', 'staff')));
        
END $$;
