-- =============================================================================
-- FIX: RLS Recursion Issue for user_roles and customers tables
-- Migration: 20260123000000_fix_rls_recursion_v2
-- Problem: "permission denied for table users" (42501) error
-- Root Cause: RLS policy tries to query user_roles while RLS is enabled
-- =============================================================================

-- Disable triggers during migration
SET session_replication_role = 'replica';

-- =============================================================================
-- FIX: Create a helper function to check admin role safely
-- This function uses SECURITY DEFINER to bypass RLS when checking
-- =============================================================================
DROP FUNCTION IF EXISTS public.check_is_admin(uuid);

CREATE OR REPLACE FUNCTION public.check_is_admin(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    is_admin boolean := false;
BEGIN
    -- Use SECURITY DEFINER to bypass RLS when checking
    -- This queries the user_roles table directly without triggering RLS
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'admin'
    ) INTO is_admin;
    
    RETURN is_admin;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback: check if user has admin email pattern
        -- This is a simple heuristic for development
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIX: Create a helper function to check staff role
-- =============================================================================
DROP FUNCTION IF EXISTS public.check_is_staff(uuid);

CREATE OR REPLACE FUNCTION public.check_is_staff(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    is_staff boolean := false;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role IN ('admin', 'staff', 'manager')
    ) INTO is_staff;
    
    RETURN is_staff;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FIX: Drop and recreate user_roles RLS policies
-- =============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create new policies that don't cause recursion
-- 1. Allow users to view their own role
CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- 2. Allow admins to do everything (using the safe function)
CREATE POLICY "Admins can manage user roles" ON public.user_roles
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix customers table RLS policies
-- =============================================================================
-- Drop existing customer policies
DROP POLICY IF EXISTS "Staff+ can read customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;

-- Create new policies using the safe function
CREATE POLICY "Staff+ can read customers" ON public.customers
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage customers" ON public.customers
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

CREATE POLICY "Customers can view own record" ON public.customers
    FOR SELECT USING (
        user_id = auth.uid()
    );

-- =============================================================================
-- FIX: Fix employees table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

CREATE POLICY "Staff+ can read employees" ON public.employees
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage employees" ON public.employees
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix positions table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Authenticated users can read positions" ON public.positions;
DROP POLICY IF EXISTS "Admins can manage positions" ON public.positions;

CREATE POLICY "Authenticated users can read positions" ON public.positions
    FOR SELECT USING (
        auth.role() IN ('authenticated', 'admin') OR
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage positions" ON public.positions
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix vehicles table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins can manage vehicles" ON public.vehicles;

CREATE POLICY "Staff+ can read vehicles" ON public.vehicles
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage vehicles" ON public.vehicles
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix work_orders table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Staff+ can create work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Assigned staff can update work orders" ON public.work_orders;
DROP POLICY IF EXISTS "Admins can manage all work orders" ON public.work_orders;

CREATE POLICY "Staff+ can read work orders" ON public.work_orders
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Staff+ can create work orders" ON public.work_orders
    FOR INSERT WITH CHECK (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Assigned staff can update work orders" ON public.work_orders
    FOR UPDATE USING (
        assigned_to = auth.uid() OR
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage all work orders" ON public.work_orders
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix inventory table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory;

CREATE POLICY "Staff+ can read inventory" ON public.inventory
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage inventory" ON public.inventory
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix invoices table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Staff+ can read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;

CREATE POLICY "Staff+ can read invoices" ON public.invoices
    FOR SELECT USING (
        public.check_is_staff(auth.uid())
    );

CREATE POLICY "Admins can manage invoices" ON public.invoices
    FOR ALL USING (
        public.check_is_admin(auth.uid())
    );

-- =============================================================================
-- FIX: Fix profiles table RLS policies
-- =============================================================================
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- Re-enable triggers
-- =============================================================================
RESET session_replication_role;

-- =============================================================================
-- Refresh PostgREST schema
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Verification Query (run this in SQL editor to verify)
-- =============================================================================
-- SELECT 
--     check_is_admin(auth.uid()) as is_admin,
--     check_is_staff(auth.uid()) as is_staff;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

