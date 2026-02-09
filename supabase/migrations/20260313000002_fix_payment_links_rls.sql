-- Migration: 20260313000002_fix_payment_links_rls.sql
-- Description: Adds missing INSERT/DELETE policies for payment_links table.

-- 1. Allow Admins and Staff to INSERT into payment_links
CREATE POLICY "Admins and Staff can insert payment_links" ON public.payment_links
    FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- 2. Allow Admins and Staff to DELETE payment_links (e.g., when voiding payment)
CREATE POLICY "Admins and Staff can delete payment_links" ON public.payment_links
    FOR DELETE
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );

-- 3. Allow Admins and Staff to UPDATE payment_links
CREATE POLICY "Admins and Staff can update payment_links" ON public.payment_links
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'staff'))
    );
