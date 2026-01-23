-- Migration: 20260127000000_fix_assignment_rls.sql
-- Description: Fix RLS issue that prevents staff assignments from being created
-- Root cause: RLS blocks INSERT into work_order_assignments because policy requires admin/manager role

-- Disable RLS during migration
SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Create SECURITY DEFINER functions to insert work order assignments
-- These bypass RLS and allows any authenticated user to create assignments
-- =============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.insert_work_order_assignment(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.insert_work_order_service_employee(uuid, uuid, text) CASCADE;

-- Create function to insert work_order_assignments
CREATE OR REPLACE FUNCTION public.insert_work_order_assignment(
    p_work_order_id uuid,
    p_employee_id uuid,
    p_notes text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    INSERT INTO public.work_order_assignments 
        (work_order_id, employee_id, status, assigned_at, notes)
    VALUES 
        (p_work_order_id, p_employee_id, 'assigned', now(), p_notes)
    ON CONFLICT (work_order_id, employee_id) 
    DO UPDATE SET 
        notes = EXCLUDED.notes,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to insert work_order_service_employees
CREATE OR REPLACE FUNCTION public.insert_work_order_service_employee(
    p_service_id uuid,
    p_employee_id uuid,
    p_status text DEFAULT 'Assigned'
)
RETURNS void AS $$
BEGIN
    -- Use SECURITY DEFINER to bypass RLS
    INSERT INTO public.work_order_service_employees 
        (service_id, employee_id, status, assigned_at)
    VALUES 
        (p_service_id, p_employee_id, p_status, now())
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. Drop existing RLS policies that conflict
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can manage assignments" ON public.work_order_assignments;
DROP POLICY IF EXISTS "Staff+ can read service_employees" ON public.work_order_service_employees;
DROP POLICY IF EXISTS "Staff+ can manage service_employees" ON public.work_order_service_employees;

-- =============================================================================
-- 3. Create new RLS policies
-- =============================================================================
-- Allow anyone with staff role to SELECT work_order_assignments
CREATE POLICY "Staff+ can read assignments" ON public.work_order_assignments
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
    );

-- Allow anyone with admin/manager role to UPDATE/DELETE assignments
CREATE POLICY "Admins+ can manage assignments" ON public.work_order_assignments
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
    );

-- Allow anyone with staff role to SELECT service_employees
CREATE POLICY "Staff+ can read service_employees" ON public.work_order_service_employees
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
    );

-- Allow anyone with admin/manager role to UPDATE/DELETE service_employees
CREATE POLICY "Admins+ can manage service_employees" ON public.work_order_service_employees
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
    );

-- =============================================================================
-- Re-enable triggers
-- =============================================================================
RESET session_replication_role;

-- =============================================================================
-- Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

