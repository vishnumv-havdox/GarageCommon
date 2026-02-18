-- =============================================================================
-- FIX: Ensure customers can view work orders for their vehicles
-- Migration: 20260319000001_ensure_customer_wo_policy
-- Purpose: Allow customers to see work orders (active and history) in Driver History Dialog
-- =============================================================================

-- 1. Create policy for Customers to view work orders
-- Users can see work orders linked to vehicles they own (via customer_id)
DROP POLICY IF EXISTS "Customers can view work orders for their vehicles" ON public.work_orders;

CREATE POLICY "Customers can view work orders for their vehicles" ON public.work_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.vehicles v
            JOIN public.customers c ON v.customer_id = c.id
            WHERE v.id = work_orders.vehicle_id
            AND c.user_id = auth.uid()
        )
    );

-- 2. Verify: refresh schema cache
NOTIFY pgrst, 'reload schema';
