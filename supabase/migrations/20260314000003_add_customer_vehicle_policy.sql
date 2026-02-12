-- Migration: 20260314000003_add_customer_vehicle_policy
-- Description: Allow customers to view their own vehicles

-- Enable RLS on vehicles (just to be safe, though already enabled)
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Create policy for customers to view their own vehicles
CREATE POLICY "Customers can view own vehicles" ON public.vehicles
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM public.customers WHERE user_id = auth.uid()
        )
    );
