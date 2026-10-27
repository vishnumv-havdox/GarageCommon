-- Migration: 20261027000000_fix_work_order_photos_belongings_rls.sql
-- Description: Fix RLS policies on work_order_photos and work_order_belongings
-- The previous policy required auth.uid() to exist in public.employees with status = 'active',
-- which blocked admins, managers, and staff not directly mapped in the employees table.

-- 1. work_order_photos
DROP POLICY IF EXISTS "Admin and staff can manage work order photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Staff can view work order photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Authenticated users can manage work order photos" ON public.work_order_photos;
DROP POLICY IF EXISTS "Anyone can view work order photos" ON public.work_order_photos;

-- Allow public and authenticated read access (needed for customer portal and workshop)
CREATE POLICY "Anyone can view work order photos" ON public.work_order_photos
    FOR SELECT USING (true);

-- Allow authenticated users to manage work order photos
CREATE POLICY "Authenticated users can manage work order photos" ON public.work_order_photos
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. work_order_belongings
DROP POLICY IF EXISTS "Admin and staff can manage belongings" ON public.work_order_belongings;
DROP POLICY IF EXISTS "Staff can view belongings" ON public.work_order_belongings;
DROP POLICY IF EXISTS "Authenticated users can manage belongings" ON public.work_order_belongings;
DROP POLICY IF EXISTS "Anyone can view belongings" ON public.work_order_belongings;

-- Allow public and authenticated read access
CREATE POLICY "Anyone can view belongings" ON public.work_order_belongings
    FOR SELECT USING (true);

-- Allow authenticated users to manage belongings
CREATE POLICY "Authenticated users can manage belongings" ON public.work_order_belongings
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
