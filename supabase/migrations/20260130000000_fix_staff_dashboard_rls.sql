-- Migration: 20260130000000_fix_staff_dashboard_rls
-- Description: Fix RLS policies to allow staff and manager roles to see assigned tasks
-- This ensures staff can see their assigned work in the dashboard

SET session_replication_role = 'replica';

-- =============================================================================
-- 1. Fix RLS on work_order_service_employees
-- =============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Staff+ can read service_employees" ON public.work_order_service_employees;
DROP POLICY IF EXISTS "Admins+ can manage service_employees" ON public.work_order_service_employees;
DROP POLICY IF EXISTS "Staff+ can manage service_employees" ON public.work_order_service_employees;

-- Create new policies that include admin, manager, and staff
CREATE POLICY "Staff+ can read service_employees" ON public.work_order_service_employees
    FOR SELECT USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
    );

CREATE POLICY "Admins+ can manage service_employees" ON public.work_order_service_employees
    FOR ALL USING (
        auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
    );

-- =============================================================================
-- 2. Fix RLS on work_order_services
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read work_order_services" ON public.work_order_services;
DROP POLICY IF EXISTS "Staff+ can insert work_order_services" ON public.work_order_services;
DROP POLICY IF EXISTS "Staff+ can update work_order_services" ON public.work_order_services;
DROP POLICY IF EXISTS "Admins can delete work_order_services" ON public.work_order_services;

CREATE POLICY "Staff+ can read work_order_services" ON public.work_order_services FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can insert work_order_services" ON public.work_order_services FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can update work_order_services" ON public.work_order_services FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Admins can delete work_order_services" ON public.work_order_services FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
);

-- =============================================================================
-- 3. Fix RLS on work_order_service_tasks
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read service_tasks" ON public.work_order_service_tasks;
DROP POLICY IF EXISTS "Staff+ can insert service_tasks" ON public.work_order_service_tasks;
DROP POLICY IF EXISTS "Staff+ can update service_tasks" ON public.work_order_service_tasks;
DROP POLICY IF EXISTS "Admins can delete service_tasks" ON public.work_order_service_tasks;

CREATE POLICY "Staff+ can read service_tasks" ON public.work_order_service_tasks FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can insert service_tasks" ON public.work_order_service_tasks FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can update service_tasks" ON public.work_order_service_tasks FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Admins can delete service_tasks" ON public.work_order_service_tasks FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
);

-- =============================================================================
-- 4. Fix RLS on work_order_service_notes
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read service_notes" ON public.work_order_service_notes;
DROP POLICY IF EXISTS "Staff+ can insert service_notes" ON public.work_order_service_notes;
DROP POLICY IF EXISTS "Staff+ can update service_notes" ON public.work_order_service_notes;

CREATE POLICY "Staff+ can read service_notes" ON public.work_order_service_notes FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can insert service_notes" ON public.work_order_service_notes FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

CREATE POLICY "Staff+ can update service_notes" ON public.work_order_service_notes FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

-- =============================================================================
-- 5. Fix RLS on work_orders (for staff to see their assigned work)
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can view assigned work" ON public.work_orders;

CREATE POLICY "Staff+ can view assigned work" ON public.work_orders FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff')) OR
    assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.work_order_service_employees wose
        JOIN public.work_order_services wos ON wos.id = wose.service_id
        WHERE wos.work_order_id = public.work_orders.id
        AND wose.employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
);

-- =============================================================================
-- 6. Fix RLS on work_order_assignments
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read assignments" ON public.work_order_assignments;
DROP POLICY IF EXISTS "Admins+ can manage assignments" ON public.work_order_assignments;

CREATE POLICY "Staff+ can read assignments" ON public.work_order_assignments FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff')) OR
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

CREATE POLICY "Admins+ can manage assignments" ON public.work_order_assignments FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
);

-- =============================================================================
-- 7. Fix RLS on employees table (for staff to see their own record)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view own employee record" ON public.employees;

CREATE POLICY "Users can view own employee record" ON public.employees FOR SELECT USING (
    user_id = auth.uid() OR
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager'))
);

-- =============================================================================
-- 8. Fix RLS on vehicles table (needed for staff to see vehicle info)
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read vehicles" ON public.vehicles;

CREATE POLICY "Staff+ can read vehicles" ON public.vehicles FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
);

-- =============================================================================
-- 9. Fix RLS on customers table (needed for staff to see customer info)
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read customers" ON public.customers;

CREATE POLICY "Staff+ can read customers" ON public.customers FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager', 'staff'))
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

